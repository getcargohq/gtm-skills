---
name: create-cargo-skill
description: >-
  Author a Cargo GTM skill in getcargohq/gtm-skills (one-off CLI job or
  deployed pipeline). Use when creating, adding, scaffolding, or reviewing a
  new skill, SKILL.md, cookbook, or pipeline folder in gtm-skills.
---

# Create a Cargo skill

This is an authoring skill for people writing this repo. It is not a
customer skill and does not install with `npx skills add`.

Read `CONTRIBUTING.md` first. That file is the contract the validators
enforce; this file is the procedure.

One folder at the repo root is one customer skill. Install path:
`npx skills add getcargohq/gtm-skills/<name>`.

## 1. Pick the kind

| Kind     | Frontmatter                 | Job                                                                        |
| -------- | --------------------------- | -------------------------------------------------------------------------- |
| one-off  | `metadata.source: one-off`  | Runs once in a turn: exact `cargo-ai` command and a price                  |
| pipeline | `metadata.source: cookbook` | Deploys a standing play. Customer copy says **pipeline**, never "cookbook" |

`metadata.source` must be exactly one of those two strings. The validator
uses `cookbook` as the internal discriminator. Do not put that word in
README, plugin listings, skill body, or examples. Customers learn: some
skills run once; some deploy a pipeline that keeps running.

If the same job exists both ways, they compete for prompts. Pin the seam in
`evals/routing.jsonl`: one case that must hit the pipeline, one that must
hit the one-off sibling. Example: "build a TAM list" → `build-tam-list`;
"keep our TAM current" → `tam-building`.

Name the folder after the job (`tam-building`, `account-scoring`), not the
vendor. `name` in frontmatter equals the folder name.

## 2. Description (the only text before load)

Four parts, in order:

1. The job in one sentence
2. `Triggers:` literal quoted phrases a user would type
3. Proper nouns (connectors, CRM, CDK)
4. `Skip when:` the sibling skill that should win instead

Quote any YAML value that contains colon-space. Unquoted, the installer
skips the file with a warning nobody reads.

## 3. Write the kind

### One-off

Copy the structure of `enrich-company-data/SKILL.md`:

- Setup (CLI install, login, session stamp)
- Do the job (exact `cargo-ai orchestration action execute` / `execute-batch`)
- What it costs (table of `integration.action` → credits)
- Worth knowing / Going further / star ask

Slugs and prices are not yours to invent. `validate.ts` asserts every
`integrationSlug`/`actionSlug` and every credit number against
`getcargohq/cargo-skills` playbooks. Copy from a sibling, then run
`node scripts/validate.ts`.

Register: `skills.sh.json`, `hooks/skill-loads.sh`, root `README.md` table.

### Pipeline

Copy the section order from `tam-building/SKILL.md`. The validator requires
these headings:

1. Honest banner: `**State: to-be-approved.**`
2. `## The outcome`
3. `## Put it in your project` (copy the procedure from `tam-building`; each
   skill carries its own)
4. `## What you will be asked` — derive before ask; more than ~4 asked rows
   means you skipped lookups
5. `## What you can change` — offer unprompted; every variation has a cost
6. `## What should not change` — name the concrete symptom if violated
7. `## Done when`
8. `## What it costs`
9. `## Composes into`

Folder:

```
<name>/
  SKILL.md
  README.md
  infra/           # or models/, plays/, agents/ — whatever the outcome needs
  references/      # supporting agent docs; never a nested SKILL.md
  evals/acceptance.md
```

Isolation: every model and connector the resources import lives in this
folder. No relative import may leave it. Two pipeline skills may both
carry an `accounts` model; the placing agent rewires to the project's
existing one.

Resources must earn their deploy:

- Do not wrap a single connector action in a tool. That is a one-off.
- Do not declare a segment that restates the play's own filter.
- Do not add `examples/example.md` until a live install has sanitized
  audit findings, mappings, a plan summary, and lookup-backed credits.
- A folder of CDK with no `SKILL.md` does not belong at the root. Older
  examples live in history: `git checkout 305cd88 -- <name>`, then write
  the skill.

**Credits.** Pipeline markdown must not contain a numeric credit amount.
Fetch live prices at run time (`cargo-ai connection integration get <slug>`).
One-offs quote playbook numbers; pipelines do not.

**Write the system you write back to.** If the outcome updates a CRM
record, the play runs on that CRM extract and matches the CRM record id.
Do not sit a native `unifyAccounts` / `ids` map between the play and the
write — the run looks successful and nothing lands.

**One CRM shape in the file.** HubSpot as the checked example; Salesforce
and Attio adapt that file (connector, extractor, record-id, write action,
fill-blank guard). No parallel branches.

CDK workflow bodies must compile. These fail `cargo-cdk check` / `plan`:
`undefined`/`void`, comma / SequenceExpression, `Date#getTime()`.

Register: `skills.sh.json` ("Make it run forever"), `hooks/skill-loads.sh`,
root README pipeline table, `.github/data/approvals.json` with
`state: to-be-approved` and empty evidence.

## 4. Finish

```sh
node scripts/build-catalog.mjs
node scripts/generate-llms-txt.ts
npm run typecheck
npm run validate
npm run format:check
```

`catalog.json` and `llms.txt` are generated. Edit SKILL.md, then regenerate.

Do not claim an outcome for a pipeline skill until it is approved (demo
workspace + two implementations in `approvals.json`). The banner in
`SKILL.md` must match that file exactly.

## Anti-patterns

- A new root skill that is the same job as an existing slug with extra
  words (`crm-account-enrichment` vs `crm-enrichment`)
- Customer-facing "cookbook"
- Hardcoded credits in a pipeline
- Stub walkthroughs that restate `SKILL.md`
- `PLACEHOLDER` values that survive into a "done" template when the
  checked example can use real HubSpot (or whatever) property names
- Asking the operator for anything a connector or live schema can answer
