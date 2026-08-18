# Research agent

Turn an account into an AE-ready brief, grounded in your own GTM knowledge.

## What it does

- Reads an account from the base accounts model.
- Pulls firmographics and strategic insights from Cargo's business database
  (credits-based).
- Reads your GTM knowledge (the context repo owned by `gtm-knowledge-graph`) so
  the brief reflects your ICP and personas.
- Writes a brief, and wraps it in a tool with a simple contract: give it a
  domain, get back a brief — so any other skill can call it.

## How it works

1. **Ask for a brief.** Call the `account-brief` tool with a domain.
2. **The agent gathers facts.** `account-researcher` reads the account and pulls
   firmographics and strategic insights from Cargo's business database.
3. **Grounded in your knowledge.** It reads the context repo (owned by
   `gtm-knowledge-graph`) so the brief reflects your ICP and personas.
4. **Get a brief back.** The tool returns it through a simple contract:
   domain in, brief out — so other skills can call it.

Adds 2 resources on top of the base (plus the knowledge graph it requires):
an agent and a tool with an embedded workflow.

## Placeholders (edit before deploy)

1. **Context files** — in `gtm-knowledge-graph/context/`: brief quality is
   bounded by your real ICP and personas.
2. **Language model** — `agents/researcher.ts` `languageModel` (and the LLM
   connector in `connectors/openai.ts` must be authenticated).

## Done when

Run the `account-brief` tool with a domain (e.g. `attio.com`): the brief cites
the ICP fit and personas from your context files, and the evaluator scores
≥ 0.8.

## Composes into

`mcp-copilot` (the brief as an MCP tool), `ai-sdr` (the brief feeds
copywriting), and signal-based TAM (a brief on every hot signal).
