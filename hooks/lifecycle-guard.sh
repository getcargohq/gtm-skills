#!/usr/bin/env bash
# Shared deference guard for this plugin's session-lifecycle hooks.
#
# WHY: three separate Cargo lifecycles can be present on one machine, and each
# of them registers the same session row against the same session id:
#
#   1. the installer's standalone hooks in ~/.claude/hooks/ (cargo-ai's
#      install.sh fallback channel),
#   2. the full pack's plugin (`cargo@cargo`, getcargohq/cargo-skills),
#   3. this plugin (`cargo@gtm`).
#
# The upsert is idempotent, so a duplicate is not corrupting — but each extra
# lifecycle re-runs `npm install -g @cargo-ai/cli` on session start and spawns
# its own `claude -p` summarizer on session end. That is real cost for a row
# that is going to be overwritten anyway. This repo is the newest and smallest
# of the three, so it is the one that yields.
#
# FAIL DIRECTION: when ownership cannot be determined (no jq, no config files),
# we do NOT defer. Running twice wastes a little; deferring wrongly silently
# drops CLI pinning and the session row with no signal at all.
#
# Sourced by session-start.sh / session-checkpoint.sh / session-end.sh. Each of
# those tolerates this file being absent (it just stops deferring), so a partial
# checkout can never break a session.

# Is some other Cargo lifecycle responsible for this session?
#   $1 — hook filename, matched against the installer's registered copies.
gtm_lifecycle_deferred() {
  _hook="${1:-}"

  # The SessionEnd summarizer child is itself a full Claude Code session: its
  # hooks fire, spawn another summarizer, and so on. The marker is exported
  # across the `claude -p` call and every Cargo lifecycle (this one and the
  # pack's) checks the same variable name, so a child of either implementation
  # stops both. See the recursion note in session-end.sh.
  [ "${CARGO_SESSION_SUMMARIZER:-}" = "1" ] && return 0

  command -v jq > /dev/null 2>&1 || return 1

  # 1. The installer's standalone hook, but only if it is REGISTERED in
  #    settings.json — a leftover file nothing invokes must not suppress us.
  if [ -n "$_hook" ] && [ -x "$HOME/.claude/hooks/$_hook" ] && [ -f "$HOME/.claude/settings.json" ]; then
    if jq -e --arg cmd "$HOME/.claude/hooks/$_hook" \
      '[.hooks[]?[]? | .hooks[]? | select(.command | contains($cmd))] | length > 0' \
      "$HOME/.claude/settings.json" > /dev/null 2>&1; then
      return 0
    fi
  fi

  # 2. The full pack's plugin. Its hooks are wired by its own manifest rather
  #    than settings.json, so presence in the installed-plugins registry is the
  #    signal.
  #
  #    Matched on the MARKETPLACE half of the id (`…@cargo`), not the plugin
  #    half. Both plugins are named `cargo` — this one installs as `cargo@gtm`
  #    and the pack as `cargo@cargo` — so a `cargo@` prefix match would find
  #    THIS plugin in the registry and defer to itself, disabling the lifecycle
  #    on every machine where it is the only one installed.
  _installed="$HOME/.claude/plugins/installed_plugins.json"
  if [ -f "$_installed" ]; then
    if jq -e '[(.plugins // {}) | keys[] | select(endswith("@cargo"))] | length > 0' \
      "$_installed" > /dev/null 2>&1; then
      return 0
    fi
  fi

  return 1
}
