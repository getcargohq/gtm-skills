#!/usr/bin/env bash
# gtm-skills session-start hook: keep the Cargo CLI at the pinned version and
# register the session row.
#
# Plugin channel only — this repo has no installer. When the pack's plugin
# (`cargo@cargo`) or the installer's standalone hooks are present, this defers
# to them; see hooks/lifecycle-guard.sh for why and in which direction it fails.
set -u

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

# Absent guard ⇒ never defer. A partial checkout must not break a session.
# shellcheck source=hooks/lifecycle-guard.sh
. "$SCRIPT_DIR/lifecycle-guard.sh" 2> /dev/null || true
if command -v gtm_lifecycle_deferred > /dev/null 2>&1 && gtm_lifecycle_deferred "session-start.sh"; then
  exit 0
fi
# Belt and braces: the summarizer marker is an env test that needs no guard file.
[ "${CARGO_SESSION_SUMMARIZER:-}" = "1" ] && exit 0

INPUT="$(cat 2> /dev/null || true)"
SESSION_ID="$(printf '%s' "$INPUT" | jq -r '.session_id // "unknown"' 2> /dev/null || echo "unknown")"

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-}"
[ -n "$PLUGIN_ROOT" ] || PLUGIN_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"

# Install the CLI version this bundle pins. Unreadable or malformed pin →
# latest; a failed pinned install retries latest. Never a gate.
PIN="$(tr -d '[:space:]' < "$PLUGIN_ROOT/cli-version" 2> /dev/null || true)"
printf '%s' "$PIN" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || PIN=""
npm install -g "@cargo-ai/cli@${PIN:-latest}" > /dev/null 2>&1 \
  || npm install -g @cargo-ai/cli@latest > /dev/null 2>&1 || true

# Placeholder row, overwritten by the checkpoint and end hooks. The skill marker
# is not known yet — no skill has been loaded at session start.
if command -v cargo-ai > /dev/null 2>&1; then
  cargo-ai workspaceManagement session upsert \
    --session-id "$SESSION_ID" \
    --title "Claude Code session ${SESSION_ID}" \
    --summary "Session in progress." > /dev/null 2>&1 || true
fi

# Keep the plugin itself current — the plugin channel's equivalent of a
# `skills add` refresh. Detached (setsid/nohup + closed fds) so session start is
# never blocked; the refreshed plugin takes effect on the NEXT session. Hooks
# often run with a minimal PATH and `claude` is a Node script, so resolve the
# usual Node/version-manager bin dirs first.
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
update_plugin() {
  [ -n "$CLAUDE_BIN" ] || return 0
  "$CLAUDE_BIN" plugin marketplace update gtm > /dev/null 2>&1 || true
  "$CLAUDE_BIN" plugin update cargo@gtm > /dev/null 2>&1 || true
}
export -f update_plugin
export CLAUDE_BIN
if command -v setsid > /dev/null 2>&1; then
  setsid bash -c update_plugin < /dev/null > /dev/null 2>&1 &
else
  nohup bash -c update_plugin < /dev/null > /dev/null 2>&1 &
fi
disown 2> /dev/null || true

exit 0
