#!/usr/bin/env bash
# Which standalone gtm-skill did this session actually load?
#
# The README's whole measurement question — which of these twelve doors people
# walk through, and whether registry discovery has any volume at all — is
# answered by one marker in the session row. Each SKILL.md asks the agent to
# write that marker by hand on setup; agents forget, and a forgotten marker is
# indistinguishable from a skill nobody used. On the plugin channel this hook
# derives it from the transcript instead, so the signal does not depend on the
# model remembering an attribution step.
#
# WHAT IT READS: tool-use records only. Skill invocations appear as
#   {"name":"Skill","input":{"skill":"find-work-email"}}
# and plugin installs namespace them by PLUGIN name — `cargo:find-work-email`.
# That is the same prefix the pack's skills carry (this plugin is `cargo@gtm`,
# the pack is `cargo@cargo`), so the prefix cannot tell the two apart and the
# name list below is what does: `cargo:cargo-gtm` never matches here, and
# `cargo:find-work-email` never matches the pack's detector.
#
# WHAT IT NEVER EMITS: prompts, file contents, record data, arguments, or
# anything a user typed. Only skill names that already exist in this public repo.
#
# The name list is embedded rather than globbed because this runs from a
# transcript, not from a checkout — scripts/validate.ts asserts it matches the
# skill directories, so adding a skill without adding it here fails the build.
#
# Usage:  skill-loads.sh <transcript-path>     # prints the marker, or nothing
#         skill-loads.sh --self-test           # fixture check, used by CI
set -u

MARKER_PREFIX="gtm-skills:"

# BEGIN SKILL LIST (checked by scripts/validate.ts)
SKILL_NAMES="build-tam-list clay-to-cargo enrich-company-data enrich-linkedin-profile find-b2b-leads find-companies-using-tech find-linkedin-url find-portfolio-companies find-stakeholders find-work-email track-funding-rounds track-job-changes verify-email-list"
# END SKILL LIST

emit_marker() {
  transcript="$1"
  [ -n "$transcript" ] && [ -f "$transcript" ] || return 0

  # Alternation over the known names, so a foreign skill (`code-review`) and the
  # pack's own skills (`cargo-gtm`) are never reported as ours. The pack has its
  # own detector and its own `[cargo-skills: …]` prefix; two markers in one
  # summary would double-count a single session.
  pattern="$(printf '%s' "$SKILL_NAMES" | tr ' ' '|')"

  # IMPORTANT: preserve load order (first occurrence wins) so the first skill in
  # a multi-skill session is the one that answered the prompt. `awk '!seen[$0]++'`
  # dedupes while keeping order, unlike `sort -u`.
  skills="$(
    grep -oE "\"skill\":\"(cargo:)?($pattern)\"" "$transcript" 2> /dev/null \
      | sed 's/.*"skill":"//; s/"$//; s/^cargo://' \
      | awk '!seen[$0]++' | paste -sd, - 2> /dev/null || true
  )"

  [ -n "$skills" ] || return 0
  printf '[%s %s]' "$MARKER_PREFIX" "$skills"
}

self_test() {
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  fail=0

  check() {
    label="$1"; want="$2"; got="$3"
    if [ "$got" = "$want" ]; then
      printf 'ok    %s\n' "$label"
    else
      printf 'FAIL  %s\n        want: %s\n        got:  %s\n' "$label" "$want" "$got"
      fail=1
    fi
  }

  # 1. A plain skill invocation.
  printf '%s\n' '{"name":"Skill","input":{"skill":"find-work-email"}}' > "$tmp/a.jsonl"
  check "single skill" "[gtm-skills: find-work-email]" "$(emit_marker "$tmp/a.jsonl")"

  # 2. Plugin namespacing must collapse onto the bare name, not double-count.
  {
    printf '%s\n' '{"name":"Skill","input":{"skill":"cargo:find-work-email"}}'
    printf '%s\n' '{"name":"Skill","input":{"skill":"find-work-email"}}'
  } > "$tmp/b.jsonl"
  check "plugin namespace dedupes" "[gtm-skills: find-work-email]" "$(emit_marker "$tmp/b.jsonl")"

  # 2b. Both plugins are named `cargo`, so the prefix is shared. A namespaced
  #     PACK skill must still be ignored here — the name list is the only thing
  #     separating `cargo:cargo-gtm` from `cargo:find-work-email`.
  printf '%s\n' '{"name":"Skill","input":{"skill":"cargo:cargo-gtm"}}' > "$tmp/b2.jsonl"
  check "namespaced pack skill ignored" "" "$(emit_marker "$tmp/b2.jsonl")"

  # 3. Load order is preserved — the first skill is the one that answered.
  {
    printf '%s\n' '{"name":"Skill","input":{"skill":"verify-email-list"}}'
    printf '%s\n' '{"name":"Skill","input":{"skill":"find-work-email"}}'
    printf '%s\n' '{"name":"Skill","input":{"skill":"verify-email-list"}}'
  } > "$tmp/c.jsonl"
  check "skills preserve load order" \
    "[gtm-skills: verify-email-list,find-work-email]" "$(emit_marker "$tmp/c.jsonl")"

  # 4. A session that never touched these skills emits nothing at all — no
  #    marker, no empty brackets polluting the summary.
  printf '%s\n' '{"name":"Bash","input":{"command":"ls"}}' > "$tmp/d.jsonl"
  check "no usage → empty" "" "$(emit_marker "$tmp/d.jsonl")"

  # 5. The pack's skills belong to the pack's detector, not this one.
  printf '%s\n' '{"name":"Skill","input":{"skill":"cargo-gtm"}}' > "$tmp/e.jsonl"
  check "pack skill ignored" "" "$(emit_marker "$tmp/e.jsonl")"

  # 6. Foreign skills are not ours to report.
  printf '%s\n' '{"name":"Skill","input":{"skill":"code-review"}}' > "$tmp/f.jsonl"
  check "foreign skill ignored" "" "$(emit_marker "$tmp/f.jsonl")"

  # 7. A skill NAMED in prose was not loaded. Every SKILL.md links its siblings
  #    in the "Skip when" line, so matching the bare name anywhere would report
  #    a load for every skill the loaded one mentions.
  {
    printf '%s\n' '{"name":"Skill","input":{"skill":"find-work-email"}}'
    printf '%s\n' '{"text":"you already have emails — use verify-email-list instead"}'
  } > "$tmp/g.jsonl"
  check "prose mentions are not loads" "[gtm-skills: find-work-email]" "$(emit_marker "$tmp/g.jsonl")"

  # 8. A missing transcript must not error — hooks never block a session.
  check "missing file → empty" "" "$(emit_marker "$tmp/does-not-exist.jsonl")"

  [ "$fail" -eq 0 ] && printf '\nskill-loads.sh: all checks passed\n'
  return "$fail"
}

case "${1:-}" in
  --self-test) self_test ;;
  "") exit 0 ;;
  *) emit_marker "$1" ;;
esac
