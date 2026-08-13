#!/usr/bin/env bash
# gtm-skills session-end hook: summarize the transcript and finalize the session
# row.
#
# Failures never block a session and fall back to the "Session ended."
# placeholder, but every step logs to $CARGO_SESSION_LOG (default
# ~/.claude/cargo-session.log) so a stuck placeholder row can be diagnosed
# instead of failing silently.
set -u

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

# Re-entrancy: the refinement step below summarizes the transcript by shelling
# out to `claude -p`, and that subprocess is itself a full Claude Code session —
# when it exits it fires SessionEnd, which runs this hook again, which spawns
# another summarizer. The CARGO_SESSION_SUMMARIZER marker is exported across the
# `claude -p` call and propagates to the child's own hooks; every Cargo
# lifecycle checks it and exits immediately, which is what ends the chain. It is
# checked inside the guard AND here, so a missing guard file can never reopen
# the recursion.
# shellcheck source=hooks/lifecycle-guard.sh
. "$SCRIPT_DIR/lifecycle-guard.sh" 2> /dev/null || true
if command -v gtm_lifecycle_deferred > /dev/null 2>&1 && gtm_lifecycle_deferred "session-end.sh"; then
  exit 0
fi
[ "${CARGO_SESSION_SUMMARIZER:-}" = "1" ] && exit 0

LOG="${CARGO_SESSION_LOG:-$HOME/.claude/cargo-session.log}"
mkdir -p "$(dirname "$LOG")" 2> /dev/null || true
log() { printf '[%s] gtm-session-end: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >> "$LOG" 2> /dev/null || true; }

INPUT="$(cat 2> /dev/null || true)"
SESSION_ID="$(printf '%s' "$INPUT" | jq -r '.session_id // "unknown"' 2> /dev/null || echo "unknown")"
TRANSCRIPT_PATH="$(printf '%s' "$INPUT" | jq -r '.transcript_path // ""' 2> /dev/null || echo "")"

# Resolve the claude binary. Hooks frequently run with a minimal PATH, and
# `claude` is a Node script whose shebang also needs `node` on PATH — so a bare
# `command -v claude` misses it whenever the binary lives in a Node/version-
# manager bin dir (nvm, volta, asdf, /opt/node*, npm global prefix).
add_path() {
  [ -n "${1:-}" ] && [ -d "$1" ] || return 0
  case ":$PATH:" in
    *":$1:"*) ;;
    *) PATH="$1:$PATH" ;;
  esac
}
if command -v node > /dev/null 2>&1; then
  add_path "$(dirname "$(command -v node)")"
fi
if command -v npm > /dev/null 2>&1; then
  add_path "$(npm prefix -g 2> /dev/null)/bin"
fi
add_path "$HOME/.claude/local"
add_path "$HOME/.local/bin"
add_path "${VOLTA_HOME:-$HOME/.volta}/bin"
add_path "$HOME/.asdf/shims"
add_path "/usr/local/bin"
add_path "/opt/homebrew/bin"
for d in /opt/node*/bin "${NVM_DIR:-$HOME/.nvm}"/versions/node/*/bin; do
  add_path "$d"
done
export PATH

CLAUDE_BIN="$(command -v claude 2> /dev/null || true)"

# 1) Synchronous, fast finalize so the row is always closed with --finished even
#    if the async refinement below never completes. The hook MUST return quickly
#    — a blocking `claude -p` here is aborted during session teardown, which
#    Claude Code reports as "Hook cancelled".
#
#    The skill marker goes in the placeholder too, so attribution survives a
#    refine() that fails, times out, or is skipped. It is fast: no LLM call,
#    just a grep over the transcript.
PLACEHOLDER_SUMMARY="Session ended."
if [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ] && [ -x "$SCRIPT_DIR/skill-loads.sh" ]; then
  PLACEHOLDER_MARKER="$(bash "$SCRIPT_DIR/skill-loads.sh" "$TRANSCRIPT_PATH" 2> /dev/null || true)"
  [ -n "$PLACEHOLDER_MARKER" ] && PLACEHOLDER_SUMMARY="$PLACEHOLDER_SUMMARY $PLACEHOLDER_MARKER"
fi

if command -v cargo-ai > /dev/null 2>&1; then
  if cargo-ai workspaceManagement session upsert \
    --session-id "$SESSION_ID" \
    --title "Claude Code session ${SESSION_ID}" \
    --summary "$PLACEHOLDER_SUMMARY" \
    --finished >> "$LOG" 2>&1; then
    log "finalized $SESSION_ID with placeholder summary"
  else
    log "session upsert failed for $SESSION_ID"
  fi
else
  log "cargo-ai not found; cannot finalize $SESSION_ID"
fi

# 2) Async refinement: summarize the transcript with claude and re-upsert a
#    better title/summary. Fully detached (setsid/nohup + closed fds) so it
#    survives the parent session exiting and never blocks — or is cancelled
#    with — the hook.
refine() {
  command -v cargo-ai > /dev/null 2>&1 || return 0
  if [ -z "$CLAUDE_BIN" ]; then
    log "claude binary not found; keeping placeholder summary for $SESSION_ID"
    return 0
  fi
  if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
    log "transcript not available (path='$TRANSCRIPT_PATH'); keeping placeholder for $SESSION_ID"
    return 0
  fi

  TAIL="$(tail -c 60000 "$TRANSCRIPT_PATH" 2> /dev/null || true)"
  if [ -z "$TAIL" ]; then
    log "transcript at '$TRANSCRIPT_PATH' was empty; keeping placeholder for $SESSION_ID"
    return 0
  fi

  # Spawn budget — a mechanism-independent backstop for the recursion guarded at
  # the top of this file. The environment marker is the real fix; this bounds the
  # damage if it is ever lost (a hook runner that re-execs with a scrubbed
  # environment, a wrapper that resets PATH and env together). At most
  # CARGO_SUMMARIZER_MAX (default 20) summarizer spawns per rolling hour on this
  # machine: real sessions end far below that rate, a runaway chain blows through
  # it in about a minute. Exhausting the budget costs a refined title, nothing
  # more — the row is already finalized with the placeholder above.
  BUDGET="${TMPDIR:-/tmp}/gtm-summarizer-spawns"
  MAX="${CARGO_SUMMARIZER_MAX:-20}"
  CUTOFF=$(($(date +%s) - 3600))
  RECENT="$(awk -v c="$CUTOFF" '$1 > c' "$BUDGET" 2> /dev/null || true)"
  SPAWNS="$(printf '%s' "$RECENT" | grep -c . 2> /dev/null || true)"
  if [ "${SPAWNS:-0}" -ge "$MAX" ]; then
    log "summarizer budget exhausted (${SPAWNS}/${MAX} in the last hour); keeping placeholder for $SESSION_ID"
    return 0
  fi
  { printf '%s\n' "$RECENT"; date +%s; } | grep . > "$BUDGET" 2> /dev/null || true

  PROMPT='Read the Claude Code transcript on stdin and reply with a single JSON object: {"title":"<5-8 word title>","summary":"<1-2 sentence summary>"}. JSON only, no markdown fences.'
  if command -v timeout > /dev/null 2>&1; then
    RESPONSE="$(printf '%s' "$TAIL" | CARGO_SESSION_SUMMARIZER=1 timeout 120 "$CLAUDE_BIN" -p "$PROMPT" 2>> "$LOG" || true)"
  else
    RESPONSE="$(printf '%s' "$TAIL" | CARGO_SESSION_SUMMARIZER=1 "$CLAUDE_BIN" -p "$PROMPT" 2>> "$LOG" || true)"
  fi
  if [ -z "$RESPONSE" ]; then
    log "claude -p produced no output for $SESSION_ID (see stderr above); keeping placeholder"
    return 0
  fi

  # Strip markdown code fences, then extract the JSON object.
  CLEAN="$(printf '%s' "$RESPONSE" | sed 's/```json//g; s/```//g' | sed -n '/{/,/}/p')"
  PARSED_TITLE="$(printf '%s' "$CLEAN" | jq -r '.title // empty' 2> /dev/null || true)"
  PARSED_SUMMARY="$(printf '%s' "$CLEAN" | jq -r '.summary // empty' 2> /dev/null || true)"
  if [ -z "$PARSED_TITLE" ] || [ -z "$PARSED_SUMMARY" ]; then
    log "could not parse title/summary from claude output for $SESSION_ID: $RESPONSE"
    return 0
  fi

  # Which standalone skill the session loaded — see hooks/skill-loads.sh.
  # Appended to the summary because the session row has no structured field for
  # it yet, and it is the column the README's attribution query reads.
  MARKER=""
  if [ -x "$SCRIPT_DIR/skill-loads.sh" ]; then
    MARKER="$(bash "$SCRIPT_DIR/skill-loads.sh" "$TRANSCRIPT_PATH" 2> /dev/null || true)"
  fi
  [ -n "$MARKER" ] && PARSED_SUMMARY="$PARSED_SUMMARY $MARKER"

  if cargo-ai workspaceManagement session upsert \
    --session-id "$SESSION_ID" \
    --title "$PARSED_TITLE" \
    --summary "$PARSED_SUMMARY" \
    --finished >> "$LOG" 2>&1; then
    log "refined $SESSION_ID with title: $PARSED_TITLE"
  else
    log "refine upsert failed for $SESSION_ID"
  fi
}

export -f refine log
export SESSION_ID TRANSCRIPT_PATH CLAUDE_BIN LOG SCRIPT_DIR

# Detach: prefer setsid, fall back to nohup. Redirect all fds so nothing keeps
# the hook's stdio open and holds the session teardown.
if command -v setsid > /dev/null 2>&1; then
  setsid bash -c refine < /dev/null >> "$LOG" 2>&1 &
else
  nohup bash -c refine < /dev/null >> "$LOG" 2>&1 &
fi
disown 2> /dev/null || true

exit 0
