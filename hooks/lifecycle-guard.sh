#!/usr/bin/env bash
# Shared deference guard for this plugin's SessionStart hook.
#
# WHY: the full Cargo pack's plugin (`cargo@cargo-skills`, or `cargo@cargo` on
# installs made before its marketplace was renamed) runs the same SessionStart
# refresh. Two plugins re-running `npm install -g @cargo-ai/cli` on every session
# start is wasted work, and this repo is the smaller of the two, so it yields.
#
# FAIL DIRECTION: when ownership cannot be determined (no jq, no registry file),
# we do NOT defer. Running twice wastes a little; deferring wrongly silently
# drops CLI pinning with no signal at all.
#
# Sourced by session-start.sh, which tolerates this file being absent (it just
# stops deferring), so a partial checkout can never break a session.

# Is the full pack's plugin installed and handling the refresh?
gtm_lifecycle_deferred() {
  command -v jq > /dev/null 2>&1 || return 1

  # The pack's hooks are wired by its own manifest, so presence in the
  # installed-plugins registry is the signal.
  #
  # Matched on the MARKETPLACE half of the id (`…@cargo-skills`, or `…@cargo`
  # before the rename Claude Code forced by reserving `cargo`), not the plugin
  # half. Both plugins are named `cargo` — this one installs as `cargo@gtm` and
  # the pack as `cargo@cargo-skills` — so a `cargo@` prefix match would find THIS
  # plugin in the registry and defer to itself, disabling the refresh on every
  # machine where it is the only one installed.
  _installed="$HOME/.claude/plugins/installed_plugins.json"
  if [ -f "$_installed" ]; then
    if jq -e '[(.plugins // {}) | keys[] | select(endswith("@cargo-skills") or endswith("@cargo"))] | length > 0' \
      "$_installed" > /dev/null 2>&1; then
      return 0
    fi
  fi

  return 1
}
