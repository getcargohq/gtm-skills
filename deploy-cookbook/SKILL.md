---
name: deploy-cookbook
description: 'Install a Cargo cookbook into a workspace: scaffold the worked example, adapt it to this company (offering the variations it supports and defending the invariants it depends on), deploy it, and check it actually worked. Triggers: "install a cookbook", "deploy the cookbook", "set up the revenue engine", "which cookbook do I need", "scaffold this GTM outcome", "finish setting this cookbook up". Cookbooks: base-gtm, crm-sync, tam-building, list-building, signal-based-tam, inbound-flow, contact-sourcing, routing-engine, account-scoring, auto-enrichment, crm-button, meeting-prep, pipeline-health, closed-won-multiplier, gtm-knowledge-graph, research-agent, mcp-copilot, ai-sdr, plg-motion, rep-cockpit. Skip when: the user wants a result once rather than a deployed pipeline that keeps producing it, which is cargo-gtm''s job, not a cookbook''s.'
version: "0.1.0"
compatibility: Requires @cargo-ai/cli (npm) and a Cargo workspace. Sign in with `cargo-ai login --email` (emailed code, no browser), `--oauth`, or an API token.
homepage: https://github.com/getcargohq/cargo-cookbooks
metadata:
  author: getcargo
  openclaw:
    requires:
      bins:
        - cargo-ai
    install:
      - kind: node
        package: "@cargo-ai/cli@latest"
        bins:
          - cargo-ai
    homepage: https://github.com/getcargohq/cargo-cookbooks
---

# Deploy a cookbook

This is the procedure every cookbook shares. Each cookbook's own `SKILL.md` carries what makes it
different: the outcome, the questions, the acceptance test, the bill. It does not restate anything
below, so read this once and then read the cookbook.

## What a cookbook is

A folder of `define*` CDK resources that combine into one outcome, sitting on a shared `base-gtm`
foundation so two cookbooks stack instead of colliding. Installing one is four moves: **scaffold,
adapt, deploy, verify.**

The second move is the reason this is a skill and not a `git clone`. **The code that arrives is a
worked example.** It encodes an architecture that is right, with the specifics of some other
company still in it, and the install is finished when it is this company's code. A cookbook you
merely copied is one nobody adapted, and it will deploy cleanly and produce nothing.

## Setup

```bash
npm install -g @cargo-ai/cli
cargo-ai login --email you@company.com          # sends a code, then exits
cargo-ai login --email you@company.com --code 123456
cargo-ai whoami                                  # already signed in? this confirms it
```

**Confirm which workspace you are pointed at before anything else.** A cookbook deployed into the
wrong workspace looks like a success and is silently wrong.

## 1. Scaffold

```bash
cargo-ai cdk init <dir> --from getcargohq/cargo-cookbooks/<slug>
cd <dir> && npm install
```

`--from` reads `cargo.scaffold.json` and pulls the cookbook **plus its required siblings**,
transitively, keeping the folder layout so cross-folder imports resolve. `base-gtm` always comes
along. Never hand-copy a folder: you will miss a dependency and the imports will not resolve.

Adding a cookbook to a project that already has one? Scaffold into a temp directory and copy the
new folder across. The shared root files and `base-gtm` are already there.

## 2. Adapt it to the company

**The scaffolded code is a worked example, not a template with holes in it.** Your job is to end up
with the code this company would have written, which is rarely the code that arrived. Read the
cookbook's `README.md` first: it explains why the design is the way it is, and you cannot adapt
something safely until you know which parts are load-bearing.

`cookbook.json` tells you which is which.

### `invariants` — argue back about these

Each one carries `holds` (what must stay true) and `whatBreaks` (the concrete symptom if it does
not). These are the parts of the design that are not preference. When an operator asks for
something that violates one, **do not silently comply and do not silently refuse**: tell them what
breaks, in the words of `whatBreaks`, and let them decide. Most change their mind, because the
failure is usually one they have already lived through.

If they still want it, do it, and record it under `decisions` with their reason. An invariant is
the strongest thing this file can say, not a lock.

### `variations` — offer these unprompted

Each carries `when` (the situation that makes it right), `how` (what changes in the code), and
`trade` (what it costs). **Nobody asks for a variant they do not know exists**, so name the ones
whose `when` matches what you have already learned about this company. If they have no CRM, say so
before you ask them for a CRM credential.

A variation is a real reshape: files get rewritten, resources get dropped, a connector gets
swapped. That is expected and is not a bug in the cookbook.

### `inputs` — the floor of the conversation

These must be answered whichever shape you land on. **Derive before you ask.** Every input carrying
a `derive` is a lookup, not a question: which connector is authenticated, which models exist, how
many closed-won rows there are, what the CRM schema actually contains. **If you are asking more
than about four questions, you have skipped lookups you should have run.**

| `kind`      | What you do                                                                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`     | Patch the answer into the named `file` at `path`.                                                                                                                                                             |
| `generated` | Write the whole `file` from the answers. These are the files whose content _is_ the configuration, like an ICP.                                                                                               |
| `env`       | Tell the operator to set the variable in `.env`. **Never read, print, echo or commit the value.**                                                                                                             |
| `manual`    | Something that must be true outside the repo: a CRM property, an OAuth connection. Check it and report. You cannot write it, and deploying without it produces a run that looks successful and lands nowhere. |

Every input carries a `why`, which is what you say when the operator pushes back. Every input with
a `validate` is checked before you move on, not after the deploy.

### Record what you changed

Append to `decisions` in the scaffolded project's `cookbook.json`: `what`, `why`, the `variation`
id if it was one the cookbook anticipated, and the date. This is the only thing that will tell
somebody in six months why their code diverges from the cookbook it came from. Write it as you go,
not from memory at the end.

Ask your questions in one pass, not one at a time across several turns.

## 3. Plan, then stop

```bash
npm run typecheck      # needs `cargo-ai login` then `npm run types` first
cargo-ai cdk plan
```

**Show the plan and stop there.** Review it the way you would review a terraform plan: it is the
last point at which nothing has happened yet. Deploy only on an explicit yes from the person whose
workspace it is.

```bash
cargo-ai cdk deploy
```

Never deploy to production on your own judgement, and never deploy a plan the operator has not
seen.

## 4. Verify

Walk `doneWhen` from `cookbook.json`, one line at a time, and report each as pass or fail with the
evidence. This is the acceptance test, not a formality: a cookbook that deployed cleanly and
produces nothing is the normal failure, because CDK resources reconcile happily whether or not the
data behind them is right.

If every check passes on a **fresh** workspace, say so explicitly. That is half the approval
evidence a cookbook needs, and it is recorded in `cookbook.json` under `approval.demoWorkspace` by
a human, not by you.

## 5. Record the install

```bash
grep -q '"cargo@gtm"' ~/.claude/plugins/installed_plugins.json 2>/dev/null ||
  cargo-ai workspaceManagement session upsert \
    --session-id "${SESSION_ID:-$(date +%s)}" \
    --title "<slug>" \
    --summary "[cookbook: <slug>] Installed via deploy-cookbook."
```

Installs per cookbook is one of the two numbers the cookbook programme is measured on. The guard
skips the stamp when the Cargo GTM plugin is installed, because its session hooks already record
the same session and two rows would double-count.

## What this skill will not do

- Deploy without showing the plan.
- Mark a cookbook approved. Approval needs a fresh-workspace test **and** two customer or partner
  implementations, and it is recorded by a person.
- Claim an outcome for a cookbook whose `state` is `to-be-approved`. Every cookbook is
  `to-be-approved` until the evidence is in `cookbook.json`, and most are.
- Violate an `invariant` without telling the operator what breaks and getting an explicit yes.
- Reshape the code and leave no `decisions` entry. Undocumented divergence is how a project stops
  being recognisably the cookbook it came from.
- Treat a missing input as licence to guess. If the cookbook needs something `cookbook.json` does
  not list, say so and add it in a PR: the next person installing it hits the same gap.
