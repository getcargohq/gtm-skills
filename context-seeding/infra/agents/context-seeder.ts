import { defineAgent } from "@cargo-ai/cdk";

import { contextSeederPrompt } from "./context-seeder.prompt";
import { anthropic } from "../connectors/anthropic";
import { agentsFolder } from "../folders";

// The seeding agent: a Claude Code harness agent, run once by hand or once at
// workspace setup.
//
// `harness: "claudeCode"` swaps the LLM loop for the coding runtime, and that
// is what makes this cookbook possible. The output of a seeding run is not a
// column value; it is thirty to sixty markdown files across seven domains,
// plus the postings the collector pulled under cadence/, plus an edit to the
// persona pull spec, delivered as one pull request. Only an agent with a
// working tree can produce that diff, and only a pull request makes it
// reviewable before it becomes what every other agent believes.
//
// `connector` and `languageModel` are required even here. The harness does not
// bring its own model: it runs against Cargo's LLM proxy, which bills this
// connector and meters usage against this slug. Any Anthropic model works with
// `claudeCode`; see `../connectors/anthropic.ts`.
//
// No `triggers`, on purpose. This runs when someone decides the knowledge
// layer should exist, from a chat (where it stops twice to ask) or at setup
// (where it asks nothing and writes its questions into the pull request).
// Start it with
//
//   cargo-ai ai message create --agent-uuid <uuid> \
//     --parts '[{"type":"text","text":"Run the context seeding for <domain>. Follow your system prompt exactly and open one pull request."}]'
//
// and answer its two stops in the same chat (`--chat-uuid <uuid>` from the
// first reply), or add "setup mode" to that text for the no-questions run.
// A cron here would re-crawl the site every month and ask nobody anything;
// seeded domains are skipped on a re-run, so re-running by hand when the
// site changes is the refresh.
//
// No `repository` block, and nothing left to put in one. Plan and deploy
// fill the repo, branch, root and GitHub connector from the git origin of
// the checkout, which is the correct binding: the repository holding
// context/ IS this CDK project's. `cargo-ai cdk check` prints what it
// resolved; confirm the root is the repository root and not `infra/`, since
// that is where the agent's `npx tsx` resolves node_modules from.
//
// No `env` either. The persona pulls are in
// scripts/context-seeding/collect/personas.ts, where the compiler checks the
// shape and the harness picks up an edit on its next clone. TheirStack is
// reached through `cargo-ai`, which the sandbox is signed in to, so there is
// no credential anywhere in this cookbook.
//
// No `uses` and no `capabilities`. Everything it reads it reads by fetching
// public pages or with the CLI in the sandbox, and the prompt is what holds
// those reads to read-only. The one thing it must never do is write the
// workspace context directly (`cargo-ai context runtime write`): a `context`
// capability here would be a second write path that skips the pull request.
export const contextSeeder = defineAgent("context_seeder", {
  name: "Context seeding",
  description:
    "Seeds context/ from the company's public surface and job postings, every claim tagged, as one pull request. Run once by hand or at setup.",
  color: "blue",
  harness: "claudeCode",
  connector: anthropic,
  languageModel: "claude-sonnet-5", // PLACEHOLDER — your model of choice
  systemPrompt: contextSeederPrompt,
  folder: agentsFolder,
});
