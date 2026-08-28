# Cargo GTM Skills

[![cargo-ai cli](https://img.shields.io/npm/v/@cargo-ai/cli?label=cargo-ai%20cli&color=black)](https://www.npmjs.com/package/@cargo-ai/cli)
[![skills.sh](https://img.shields.io/badge/skills.sh-23%20skills-black)](https://www.skills.sh)
[![License](https://img.shields.io/github/license/getcargohq/gtm-skills?color=black)](LICENSE)

23 agent skills, each with one routed job. No account required to read them, and a new
Cargo account starts with **100 free credits, no card**.

```bash
npx skills add getcargohq/gtm-skills --all      # all 23
```

Each skill also installs on its own, when you want exactly one and nothing else:

```bash
npx skills add getcargohq/gtm-skills/<skill-name>
```

The three **cookbooks** at the bottom of the table install differently, because they are
not only a procedure — each carries an `infra/` of CDK resources that has to land in your
project's CDK directory, while the procedure goes to your repo's skills layer. `skills add`
would install the folder whole, putting TypeScript where the CDK loader never looks, so the
CDK does the split instead:

```bash
cargo-ai cdk add cookbook/<name>
```

| Skill                                                             | Does                                                                                                                              |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [`clay-to-cargo`](clay-to-cargo/SKILL.md)                         | Rebuild a Clay table on Cargo: map every enrichment column to its provider action, cost it before it runs, and keep it as code.   |
| [`score-leads`](score-leads/SKILL.md)                             | Score a list of companies against your ICP and rank it, with a number, a reason and a tier on every row.                          |
| [`research-account`](research-account/SKILL.md)                   | Research one company before a meeting and hand back a one-page briefing, every line traceable to a source you can open.           |
| [`monitor-buying-signals`](monitor-buying-signals/SKILL.md)       | Watch target accounts for the public events that mean someone is in market, each with a date and a link.                          |
| [`apollo-to-cargo`](apollo-to-cargo/SKILL.md)                     | Rebuild an Apollo list on Cargo and price the two side by side on the same rows before you move anything.                         |
| [`zoominfo-to-cargo`](zoominfo-to-cargo/SKILL.md)                 | Rebuild a ZoomInfo, Lusha or Cognism list on Cargo and measure the coverage you actually lose or gain before the renewal.         |
| [`find-b2b-leads`](find-b2b-leads/SKILL.md)                       | Find B2B leads by job title, company, and keyword, and return them as a structured list.                                          |
| [`build-tam-list`](build-tam-list/SKILL.md)                       | Build a total addressable market list of companies filtered by industry, headcount, and geography.                                |
| [`find-linkedin-url`](find-linkedin-url/SKILL.md)                 | Resolve a person's LinkedIn profile URL from their name and company, with an identity-validation gate that rejects wrong matches. |
| [`enrich-linkedin-profile`](enrich-linkedin-profile/SKILL.md)     | Turn a LinkedIn profile URL into a full person profile plus a verified work email in a single call.                               |
| [`find-work-email`](find-work-email/SKILL.md)                     | Find a verified work email address from a person's name and company domain.                                                       |
| [`verify-email-list`](verify-email-list/SKILL.md)                 | Verify a list of email addresses so you stop sending to bounces.                                                                  |
| [`enrich-company-data`](enrich-company-data/SKILL.md)             | Enrich a list of companies with firmographics — industry, size, geography, founding year, and headquarters.                       |
| [`find-stakeholders`](find-stakeholders/SKILL.md)                 | Find the buying committee at a target account — every stakeholder matching a set of titles, seniorities, and departments.         |
| [`track-job-changes`](track-job-changes/SKILL.md)                 | Detect which of your contacts have changed jobs, and where they went.                                                             |
| [`track-funding-rounds`](track-funding-rounds/SKILL.md)           | Track which companies recently raised funding, with round, amount, and investors.                                                 |
| [`find-companies-using-tech`](find-companies-using-tech/SKILL.md) | Find companies by the technology they run or the roles they are hiring for.                                                       |
| [`find-portfolio-companies`](find-portfolio-companies/SKILL.md)   | Find every portfolio company of an investor or accelerator, then the people inside them.                                          |
| [`waterfall-enrichment`](waterfall-enrichment/SKILL.md)           | Run a waterfall across several providers so a record one vendor misses is caught by the next.                                     |

**Four of them deploy a pipeline rather than running once.** `tam-building`, `account-scoring`,
`crm-enrichment`, and `crm-dedup` are standing pipelines: each folder holds worked CDK
resources written for some other company, and your agent adapts them into your project and
deploys them. Every such folder is self-contained (its own models, connectors and folders; no
shared foundation, no requires graph), so the agent reconciles it with whatever your project
already declares. More are on their way (`contact-sourcing`, `signal-based-tam`, `ai-sdr`,
`rep-cockpit`, …); each lands here the day its skill is written, not before.

| Skill                                                      | Deploys                                                                                                                                  |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| [`tam-building`](tam-building/SKILL.md)                    | Your account universe from a Sales Navigator search, split past the extraction cap, resolved to domains, deduped into an accounts model. |
| [`account-scoring`](account-scoring/SKILL.md)              | Every account scored and tiered against your written ICP by an agent that cites its evidence, rationale on the CRM record.               |
| [`crm-enrichment`](crm-enrichment/SKILL.md)                | CRM accounts stay complete and current through approved enrichment of blank or stale firmographics.                                      |
| [`crm-dedup`](crm-dedup/SKILL.md)                          | CRM accounts stay duplicate-free through scored exact-match merges and manual review of uncertain clusters.                             |

Works with Claude Code, Codex, Cursor, Windsurf, GitHub Copilot, and any agent that supports the
[skills.sh](https://skills.sh) standard.

## As an agent plugin — Claude Code, Codex, Cursor

The same 23 skills also install as a native **agent plugin**: one source, three targets. Take
this route when you want all of them rather than one, and when you want the two things
`skills add` cannot deliver:

- **An approval hook** ([`hooks/approve-cli.sh`](hooks/approve-cli.sh)) that auto-approves safe
  `cargo-ai` calls (reads, queries, run and batch operations) so the agent stops prompting on every
  invocation, while credentials (`login`), token minting, report egress, and any `remove`/`delete`
  always still prompt. Allow-only — it can never override a deny rule. Wired per target:
  `PreToolUse` (Claude Code), `PermissionRequest` (Codex), `beforeShellExecution` (Cursor). The
  file is a **verbatim copy** of the pack's, and CI fails if it drifts: an allowlist should be
  reviewed once, upstream, for both plugins — not forked here.
- **Session-lifecycle hooks** (Claude Code only): `SessionStart` installs the CLI at the version
  [`cli-version`](cli-version) pins — so a command in a SKILL.md always meets the CLI it was
  written against — and `Stop`/`SessionEnd` keep the session row titled and current instead of
  leaving a placeholder behind. They derive the attribution line each skill otherwise asks the
  agent to write by hand, so the skills' own attribution step stands down when the plugin is
  installed and a session is recorded once, not twice.

**Claude Code** (≥ v2.1.154):

```
/plugin marketplace add getcargohq/gtm-skills
/plugin install cargo@gtm
```

**Codex:**

```bash
codex plugin marketplace add getcargohq/gtm-skills
# then install "Cargo GTM" from the Plugins menu
```

**Cursor:** open **Customize** in the sidebar → add the `getcargohq/gtm-skills` marketplace →
install the **Cargo GTM** plugin (UI-driven; the `.cursor-plugin/` manifests are picked up
automatically).

For the **OpenAI Plugins Directory** (ChatGPT + Codex) the archive is built from the tree rather
than hand-assembled, because that listing is the one channel that does not track this repo — every
version is a manual, human-reviewed submission that then serves whatever was approved:

```bash
node scripts/build-codex-package.mjs      # -> dist/gtm-skills-codex.zip
```

It stages the 23 skills under `skills/`, drops the OpenClaw `metadata` block OpenAI rejects,
writes the directory manifest, and asserts every documented limit — description lengths, the
30-char display fields, square icons, archive shape — against the finished zip rather than the
staging directory. Skills only: the hooks are wired with `${CLAUDE_PLUGIN_ROOT}`, which nothing
outside Claude Code is known to set, so packaging them would put a path that cannot run in front
of a reviewer. CI builds it on every commit; `dist/` holds the bytes that were uploaded.

**Pick one channel — and this repo is the smallest of three.** Plugin install and `skills add`
both register the skills, so using both duplicates them (plugin copies are namespaced
`cargo:<skill>`). And if you have the full pack — either channel — you do not want these at all:
every skill here defers to `cargo-gtm` when it is present, and the plugin's lifecycle hooks defer
to the pack's plugin and to the Cargo installer's hooks, so a machine with both never registers a
session twice.

## Want all of it?

These are slices of the full [Cargo skills pack](https://github.com/getcargohq/cargo-skills) — 17 skills covering the whole CLI,
with recipes, provider playbooks, and cost discipline built in. If you install the pack, you do not
need these: each one defers to `cargo-gtm` when it is present.

```bash
npx skills add getcargohq/cargo-skills
```

## Editing these

The markdown is the source — edit it directly. Copy is meant to be iterated on: reword a job,
add a trigger phrase, rewrite a CTA, tune the framing. That is the point of this repo being
separate from the pack.

Two things are not free-form, and CI enforces them:

**Slugs and prices are checked against the upstream playbooks.** Every `integrationSlug` /
`actionSlug` pair in a command must exist in the matching
[`cargo-gtm/provider-playbooks/`](https://github.com/getcargohq/cargo-skills/tree/main/cargo-gtm/provider-playbooks)
file, and every number in a cost table must match that playbook exactly. These skills run inside
agents we do not control, with no session refresh to save them — a stale price fails on a new
user's first command, which is the worst possible moment to be wrong.

**Every skill carries the same blocks:** the `cargo-gtm` deference guard, the free-credits
line, the sample-before-you-spend rule, the CTA back to the pack, the star ask, and the
attribution guard that skips the manual session row when the plugin's hooks already write one.
Drop one and the build goes red. Trigger phrases must also be unique across skills, or they fight
for the same prompts.

**The plugin channel is checked too.** The four manifests
(`.claude-plugin/`, `.codex-plugin/`, `.cursor-plugin/`, `plugin.json`) must agree on name and
version, every hook they wire must exist and be executable, `cli-version` must be a real version,
`skills.sh.json` must group every skill exactly once, the skill list embedded in
[`hooks/skill-loads.sh`](hooks/skill-loads.sh) must match the directory tree, and
`hooks/approve-cli.sh` must be byte-identical to the pack's. Adding a new skill therefore
means adding it in three places, and the build will tell you which one you missed.

```bash
node scripts/validate.ts                                            # against cargo-skills@main
node scripts/validate.ts --playbooks ../cargo-skills/cargo-gtm/provider-playbooks   # local checkout
node scripts/validate.ts --ref v1.18.1                              # pin to a tag
```

CI also runs this weekly on a cron. Upstream pricing can change without anyone touching this
repo, and that is exactly the drift nobody would otherwise notice.

`evals/routing.jsonl` holds one case per trigger phrase, graded in CI by the pack's ranker
(`.github/scripts/routing-eval.ts --skills-root .`). It currently scores 72/72, which is a
ceiling effect rather than a result: every case was generated from the trigger phrases it
grades, so it proves the triggers do not collide, not that the descriptions route. Real cases
have to come from real sessions.
