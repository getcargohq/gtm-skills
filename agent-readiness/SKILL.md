---
name: agent-readiness
description: 'Keep your site usable by AI agents: once a week Ora audits how agents discover, read and use your domain and up to three rival domains, one pull request applies the fixes your site source can make, and one Slack digest reports the Ora score and what moved. Triggers: "make our site readable by ai agents", "track our ora score", "can ai agents read our site", "agent readiness audit", "compare our ora score with rivals", "fix llms.txt and agent discovery files". Cargo CDK, defineAgent, harness claudeCode, Ora MCP server, mcpClients, native model, Slack postMessage, GitHub pull request. Skip when: the site itself is to be built or hosted, which is website-building; or rival pages and news belong in context, which is web-capture.'
version: "0.1.0"
compatibility: "Requires @cargo-ai/cli with @cargo-ai/cdk 1.0.104 or later, a Cargo workspace, a repository holding the website's source (website-building puts it there), authorized GitHub, Slack and Anthropic connectors, and outbound access to Ora's public MCP server (no Ora account or key)."
homepage: https://github.com/getcargohq/gtm-skills/tree/main/agent-readiness
metadata:
  author: getcargo
  source: cookbook
  personas:
    - marketing
    - gtm-engineering
  openclaw:
    requires:
      bins:
        - cargo-ai
    install:
      - kind: node
        package: "@cargo-ai/cli@latest"
        bins:
          - cargo-ai
    homepage: https://github.com/getcargohq/gtm-skills
---

# Agent readiness

**State: to-be-approved.** Deploy-verified against a live workspace: not yet. Treat `Done when`
below as the acceptance test and review `cargo-ai cdk plan` before deploying. Make no outcome claim
for this skill until it is approved.

## The outcome

AI agents are now the first reader of a website: they search for it, fetch it, and decide whether
to use the product behind it. This pipeline keeps yours readable to them. Every Monday one agent
runs:

1. **It scores the site.** Ora's MCP server audits your domain and up to three competitors': about
   150 checks across discovery (can agents find you), access (can they read you), usability (can
   they use your API or MCP server) and payments, with a 0-100 score, a grade and a ranked fix list.
2. **It records the week.** One row per domain in the `readiness_scans` model: score, grade and the
   failing check ids. Ora keeps only the latest scan, so this is the history that says what
   regressed, what got fixed and which competitor moved.
3. **It fixes what the source can fix.** It takes Ora's ranked fixes in order, keeps the first
   three a change to the website's source can make (`llms.txt`, robots, structured data, markdown
   alternates, agent discovery files), applies them with Ora's own playbook, and opens one pull
   request. Merging it is the approval, and the deploy.
4. **It posts one digest.** Score and change, what was fixed and what newly fails, where a
   competitor is ahead, the pull request, and the off-site fixes a human has to make (brand search,
   registry listings, Wikipedia).

It never merges, never edits outside the website's source, never forces a scan, and never writes to
Ora. The next Monday's scan is the measurement of what the merged fix did.

## Example

> Every Monday, tell #web-team how agent-ready www.fabrikam.example is, and open a PR with the fixes.

Illustrative output, fictional records:

```text
:robot_face: *Agent readiness: 2026-W43*
*www.fabrikam.example*: 71/100 (C), +6 since last week. ora.ai/www.fabrikam.example
• Fixed: llms.txt formatting, Markdown link alternate
• Newly failing: Sitemap lastmod
*Competitors*
• contoso.example: 84 (B), no change
• wingtip.example: 66 (D), -2
*Where a competitor is ahead*
• ARD discovery: passes at contoso.example
• JSON-LD entity linking: passes at contoso.example, wingtip.example
*Fix pull request*: [agent-readiness] 2026-W43: 3 fixes for www.fabrikam.example
*To do by hand*
• Listed in MCP registries: register the MCP server on a public registry.
```

Three domains were scanned once each; one pull request carries three fixes to the site's source,
and nothing was merged or sent outside the channel.

## Put it in your project

This folder is a **worked example**: real CDK resources written for some other company. The job is
to end up with the code your company would have written, in your project, and an agent does the
adapting. If the `cargo-cdk` skill is in your session it carries the long form of this; if not, this
is enough.

1. **Install it: the CLI does the copy.** From inside the CDK project,
   `cargo-ai cdk add cookbook/agent-readiness` writes this example to `infra/agent-readiness/` and
   this procedure to `.claude/skills/agent-readiness/`. No project yet?
   `cargo-ai cdk init <dir> --cookbook agent-readiness && cd <dir> && npm install` does both. **If
   you are reading this from the project's `.claude/skills/`, the install already happened, so start
   at step 2.**
2. **Reconcile it with what is already declared.** If the project already has a GitHub, Slack or
   Anthropic connector, rewire the imports to the existing one and drop the copy; two resources with
   one slug is a collision at deploy.
3. **Find the website's source.** Set `WEBSITE_ROOT` in `infra/agents/readiness-auditor.ts` to the
   folder the site builds from, relative to the repository root. `website-building` puts it at
   `infra/website-building/apps/website`, the default. Source in another repository is the
   `separate-site-repo` variation.
4. **Name the domains.** `AUDIT_DOMAIN` is the hostname the site is served on. `COMPETITOR_DOMAINS`
   is at most three competitors, read from the workspace context's competitor files. Score each once
   by hand first (`curl -s https://ora.ai/api/score/<domain>`) so a typo is caught before the cron.
5. **Point Slack at your channel.** Set `channelId` to a channel id (`C…`) from the Slack
   connector's channel autocomplete, and invite the bot. `references/digest.md` (installed beside
   this file) is the message shape.
6. **Adapt.** Work the sections below in order: _What should not change_ is what you argue back
   about; _What you can change_ is what you offer unprompted; _What you will be asked_ is the floor,
   and you derive before you ask. Record what you changed and why under a `## Decisions` section in
   your copy of this file.
7. **Check, then plan.** `node --import tsx evals/contract.mjs` from this skill's folder, then
   `npm run check && cargo-ai cdk plan` from the project root. Confirm `cargo-ai cdk check` prints
   the agent bound to your repository with no trailing subdirectory. Show the diff, and deploy only
   on an explicit yes: `cargo-ai cdk deploy`.
8. **Verify.** Send the agent its trigger text once by hand (`cargo-ai ai message create`), and walk
   _Done when_ with evidence. Send it again: the second run must scan nothing, open nothing and post
   nothing.

## What you will be asked

**Derive before you ask.** An input with a lookup is looked up, not asked.

| Input                                                        | Kind    | How it is answered                                                                                                                                                         | Why it matters                                                                                                                                       |
| ------------------------------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUDIT_DOMAIN` (`infra/agents/readiness-auditor.ts`)         | derived | From the website app's `domains` (`website-building`'s `infra/apps/website.ts`) or the context's company file. Asked only when neither names it.                              | It is the site scored and the one the pull request fixes. The apex and `www.` can score differently when one redirects; use the host the site serves. |
| `COMPETITOR_DOMAINS` (`infra/agents/readiness-auditor.ts`)   | derived | From the competitor files in the workspace context, at most three, confirmed with the operator.                                                                             | Each is a scan a week from a budget shared by every caller on the same IP. More than three is a digest nobody reads to the end.                     |
| `WEBSITE_ROOT` (`infra/agents/readiness-auditor.ts`)         | derived | `ls` the repository for the site's `package.json` (or its static root).                                                                                                    | The only folder the agent may change. Wrong, and every fix lands in a folder nothing deploys.                                                       |
| `channelId` (`infra/agents/readiness-auditor.ts`)            | asked   | The Slack channel id (`C…`) from the connector's autocomplete. Invite the bot.                                                                                             | Locked, so the digest lands where the web team reads it and nowhere else.                                                                           |
| repository binding (`infra/agents/readiness-auditor.ts`)     | value   | **derived**: leave `repository`, `defaultBranch` and `connector` unset; plan fills them from the checkout's git origin. `cargo-ai cdk check` prints what it resolved.          | It is where the site's source is cloned and the pull request opens.                                                                                 |
| LLM connector and model (`infra/connectors/anthropic.ts`)    | value   | **derived**: `cargo-ai connection connector list`. Any Anthropic model pairs with `claudeCode`; `languageModel` is a placeholder to set.                                    | The harness runs against Cargo's LLM proxy, so this is what each Monday is billed against.                                                          |

## What you can change

| Variation            | When it is right                                                         | How                                                                                                                                                         | What it costs                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `report-only`        | The site is owned by another team and a pull request from an agent is unwelcome | Delete §4 of `infra/agents/readiness-auditor.prompt.ts` and the pull request line of the digest                                                              | Nothing gets fixed on its own; the digest becomes a to-do list someone has to pick up.                                                             |
| `separate-site-repo` | The website's source lives in a repository other than the CDK project's   | Set `repository.repository`, `defaultBranch` and `connector` explicitly on the agent, and `WEBSITE_ROOT` relative to that repository                         | The binding is no longer derived, so a renamed repository breaks the run silently. Check it with `cargo-ai cdk check` after every rename.          |
| `ora-scan-key`       | Several domains, or other tools on the same IP, hit Ora's daily scan limit | Ask Ora for a scan key and pass it on the MCP client's `authentication` as a bearer token                                                                    | A credential to rotate. Without it, a scan over the limit fails and the digest names the domain skipped.                                           |
| `more-fixes`         | The pull requests are merged quickly and the site is far from an A        | Raise "the first three" in §4 of the prompt                                                                                                                 | A bigger diff to review. Each fix changes what agents read about the company; three is a pull request someone reads in one sitting.                |
| `no-competitors`     | You only care about your own score                                       | Empty `COMPETITOR_DOMAINS`                                                                                                                                  | You lose "where a competitor is ahead", which is often the most persuasive line in the digest.                                                     |

## What should not change

- **Ora is read, never written.** (`infra/agents/readiness-auditor.ts`) The feedback tools post
  under an agent identity to a public product page; they are disabled on the MCP client and the
  contract fails if one is enabled. `disabledToolSlugs` is a deny list, so name any tool Ora adds
  that writes.
- **No forced scan, and no `run_checks`.** (`infra/agents/readiness-auditor.prompt.ts` §2) Both
  always scan live and spend a daily budget Ora counts per IP, which a hosted agent shares with
  every other caller from the same address. A stored result from the last few hours is free.
- **The agent changes only `WEBSITE_ROOT`, and never merges.** (`infra/agents/readiness-auditor.prompt.ts`
  §4) A fix is a change to what agents read about the company. A human reviews it; merging is what
  deploys it.
- **Ora's ranking is the order.** (§4) Re-ranking topFixes by what looks easy is how a pull request
  ships a cosmetic fix while the check that matters stays red.
- **The ledger is written before the pull request, and `digest_ts` after the post.** (§2, §4, §5)
  A re-run the same week then scans nothing, opens no second pull request, and posts once; a failed
  post is retried next run.
- **No gain is claimed as measured.** (§4, Rules) `estScoreGain` is Ora's estimate. The next
  Monday's scan, after the fix is merged and deployed, is the number.

## Done when

- `node --import tsx evals/contract.mjs` passes
- `cargo-ai cdk plan` reports the agent, the `readiness_scans` model, the three connectors and the
  two folders
- the first run wrote one `readiness_scans` row per configured domain for this ISO week, each with
  a score, a grade and its failing check ids, and the run transcript shows no `force` on any scan
- one pull request is open on `agent-readiness/<week>`, changing only files under `WEBSITE_ROOT`,
  each fix naming a check from our result's topFixes; or none, with the digest saying why
- one digest landed in the locked channel in the `references/digest.md` shape
- a second run the same week wrote no row, opened no pull request and posted nothing
- after the pull request is merged and deployed, the next week's row shows its checks out of
  `failing_checks`

## What it costs

Ora's reads are free and keyless; Cargo bills nothing for them. The post is `slack.postMessage` on
the bound connector; immediately before the plan, run
`cargo-ai orchestration action list postMessage --kind connector --integration-slug slack` and read
the current cost out loud. The recurring cost is the harness run itself, once a week, billed as LLM
tokens through the Anthropic connector. It is largest on a week with a pull request, when the agent
reads Ora's playbook, the site's source and runs its build; a re-run that stops at the ledger costs
a small fraction of that.

## Composes into

`website-building` (the site whose source this pipeline fixes, and whose deploy ships the merged
pull request), `web-capture` (what competitors publish, next to how readable it is to agents), and
`weekly-planning` (the digest's to-dos are week-sized work).
