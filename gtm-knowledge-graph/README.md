# GTM knowledge graph

Your go-to-market knowledge — ICP, positioning, personas, plays — written as
versioned markdown that agents can read and answer questions from.

## What it does

- Stores your GTM knowledge as markdown files in a context repo, so it lives in
  git and changes are reviewable.
- Adds a chunked knowledge file for retrieval (RAG).
- Ships a Q&A analyst agent that answers questions from that knowledge and cites
  where the answer came from.

This cookbook **owns** the workspace's context repo (`defineContext` is a
per-workspace singleton). `research-agent` and `ai-sdr` rely on it rather than
defining their own.

## How it works

1. **Knowledge lives as markdown.** `context/` (ICP, positioning, personas,
   plays) becomes the workspace context repo via `defineContext`.
2. **A playbook is made searchable.** `files/gtm-playbook.md` is chunked for
   retrieval (RAG) via `defineFile`.
3. **An agent answers from it.** The `gtm-analyst` agent takes questions and
   answers from the context, citing which file it used.

Adds 3 resources on top of the base: the context repo, a file, and an agent.

## Placeholders (edit before deploy)

1. **Every markdown file** — `context/` and `files/` ship as structure with
   example content; the value comes from your real ICP / positioning / personas
   / plays.
2. **Language model** — `agents/gtm-analyst.ts`.
3. **Slack trigger scope** — `agents/gtm-analyst.ts` `triggers[0].config`: the
   channels / mention rules that let the team talk to the analyst from Slack
   (connect Slack once in the Cargo UI first — the base `slack` connector is
   `adopt: true`).

## Done when

Ask the analyst "which play applies to an account that just fired a keyword
signal?" — it answers from `context/plays/outbound-signal-play.md` and cites it.
Ask something the files don't cover — it names the gap instead of guessing.
