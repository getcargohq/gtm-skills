#!/usr/bin/env bash
# gtm-skills session checkpoint hook (Stop event): keep the session row fresh
# mid-session.
#
# Derives a lightweight title/summary from the transcript WITHOUT an LLM call
# (latest user prompt + timestamp) and upserts the row WITHOUT --finished, so a
# session that never reaches SessionEnd (crash, timeout, reclaimed container)
# still shows recent context and still carries its skill marker instead of being
# stuck on "Session in progress." Throttled to at most one update per
# CARGO_CHECKPOINT_INTERVAL seconds (default 45) so it never adds a network call
# to every turn.
set -u

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

# shellcheck source=hooks/lifecycle-guard.sh
. "$SCRIPT_DIR/lifecycle-guard.sh" 2> /dev/null || true
if command -v gtm_lifecycle_deferred > /dev/null 2>&1 && gtm_lifecycle_deferred "session-checkpoint.sh"; then
  exit 0
fi
[ "${CARGO_SESSION_SUMMARIZER:-}" = "1" ] && exit 0

LOG="${CARGO_SESSION_LOG:-$HOME/.claude/cargo-session.log}"
mkdir -p "$(dirname "$LOG")" 2> /dev/null || true
log() { printf '[%s] gtm-checkpoint: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >> "$LOG" 2> /dev/null || true; }

INPUT="$(cat 2> /dev/null || true)"
SESSION_ID="$(printf '%s' "$INPUT" | jq -r '.session_id // "unknown"' 2> /dev/null || echo "unknown")"
TRANSCRIPT_PATH="$(printf '%s' "$INPUT" | jq -r '.transcript_path // ""' 2> /dev/null || echo "")"

command -v cargo-ai > /dev/null 2>&1 || exit 0

# Throttle: skip if this session was checkpointed within the last INTERVAL secs.
INTERVAL="${CARGO_CHECKPOINT_INTERVAL:-45}"
STAMP="${TMPDIR:-/tmp}/gtm-checkpoint-${SESSION_ID}.ts"
NOW="$(date +%s)"
if [ -f "$STAMP" ]; then
  LAST="$(cat "$STAMP" 2> /dev/null || echo 0)"
  case "$LAST" in (*[!0-9]* | "") LAST=0 ;; esac
  if [ $((NOW - LAST)) -lt "$INTERVAL" ]; then
    exit 0
  fi
fi

TITLE="Claude Code session ${SESSION_ID}"
SUMMARY="Session in progress."

if [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ]; then
  # tail by lines (not bytes) so we never feed jq a half-written JSON line.
  TAIL="$(tail -n 600 "$TRANSCRIPT_PATH" 2> /dev/null || true)"
  if [ -n "$TAIL" ]; then
    # Latest real user prompt (string or text blocks; tool_result entries skipped).
    LAST_USER="$(printf '%s\n' "$TAIL" | jq -rR '
      fromjson? | select(.type=="user") | .message.content
      | if type=="string" then .
        elif type=="array" then (map(select(.type=="text").text) | join(" "))
        else empty end
      | select(. != "")' 2> /dev/null | tail -n 1)"
    if [ -n "$LAST_USER" ]; then
      # Prompt-derived text is DATA end-to-end: shell assignments and quoted
      # expansions never evaluate $(…)/backticks inside a variable's VALUE, and
      # the upsert below passes --title/--summary as single quoted argv words —
      # so there is no execution path. Control characters are stripped anyway so
      # a pathological prompt can't mangle logs or the session row.
      SNIP="$(printf '%s' "$LAST_USER" | tr '\n\t' '  ' | tr -d '\000-\037\177' | cut -c1-80)"
      TITLE="$SNIP"
      SUMMARY="In progress. Latest request: \"${SNIP}\". Updated $(date -u +%Y-%m-%dT%H:%M:%SZ)."
    fi
  fi
fi

# Which standalone skill this session loaded — see hooks/skill-loads.sh.
# Recomputed each checkpoint rather than accumulated, so the marker always
# reflects the whole transcript and a session that ends abruptly still carries
# it. Empty for sessions that never loaded one of these skills.
MARKER=""
if [ -x "$SCRIPT_DIR/skill-loads.sh" ]; then
  MARKER="$(bash "$SCRIPT_DIR/skill-loads.sh" "$TRANSCRIPT_PATH" 2> /dev/null || true)"
fi
[ -n "$MARKER" ] && SUMMARY="$SUMMARY $MARKER"

if cargo-ai workspaceManagement session upsert \
  --session-id "$SESSION_ID" \
  --title "$TITLE" \
  --summary "$SUMMARY" >> "$LOG" 2>&1; then
  printf '%s' "$NOW" > "$STAMP" 2> /dev/null || true
  log "checkpointed $SESSION_ID"
else
  log "checkpoint upsert failed for $SESSION_ID"
fi

exit 0
