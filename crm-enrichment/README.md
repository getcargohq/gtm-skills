# CRM enrichment

Keep CRM accounts complete, current, and duplicate-safe. This folder is a worked example: copy it
into a Cargo CDK project as a sibling, reconcile it with what is already there, adapt
`infra/index.ts`, and follow the operator approval gates before deploying disabled resources,
running enrichment, or merging duplicate accounts.

The agent joins the live LinkedIn and CRM schemas, presents the starting and optional field
mappings, recommends LinkedIn company ID as a durable matching key, and waits for approval of the
complete field contract. After approval, it builds and deploys the tool and disabled play, sends
direct Cargo UI links, and shows the exact target and estimated cost for a second approval. Only
then does enrichment run. The reusable tool normalizes company identifiers and returns provider
data without touching the CRM. The play calls that tool, fills approved blank CRM fields, and owns
writeback. The final report compares before-and-after coverage, outcomes, failures, and actual
credits. Once matching-key coverage is healthy, a second disabled play runs directly on
`crm_accounts`, searches the live CRM for matching companies, scores identity evidence, and ranks a
deterministic survivor. Exact shared LinkedIn company ID clusters without conflicts can merge
automatically. Every other candidate pauses at native Human Review; approval merges and decline or
timeout keeps the records separate. The enrichment play writes freshness only after a real fill and
re-enrolls a record after six months. The checked example is HubSpot; Salesforce and Attio adapt
that one file. Nothing in this folder deploys, runs, or touches customer data by itself.

This pipeline requires the `cargo-cdk` authoring skill. Install it before adapting the worked
example:

```sh
npx skills add getcargohq/cargo-skills --skill cargo-cdk
```

The agent reads `.agents/skills/cargo-cdk/SKILL.md` directly after installation and follows its CDK
bootstrap, authoring, state, plan, and deployment rules.

`SKILL.md` is the procedure. Supporting depth:

| Path                        | Purpose                                                   |
| --------------------------- | --------------------------------------------------------- |
| `SKILL.md`                  | Outcome, install, contracts, approvals, and cost          |
| `infra/index.ts`            | The only infrastructure adaptation surface                |
| `references/audit.md`       | Enrichment audit contract and live-price preview          |
| `references/configure.md`   | Model, mappings, and Salesforce or Attio adaptation       |
| `references/deduplicate.md` | Duplicate audit, score, survivor, merge, and review gates |
| `references/run.md`         | Workflow boundaries and consumer verification             |
| `evals/acceptance.md`       | Acceptance checklist                                      |
| `evals/contract.mjs`        | Executable enrichment and deduplication graph contract    |

Do not declare a standalone segment. The play's filter is its managed backing
segment.
