import { defineAgent } from "@cargo-ai/cdk";

import { contextBootstrapPrompt } from "./context-bootstrap.prompt";
import { anthropic } from "../connectors/anthropic";
import { agentsFolder } from "../folders";

// The bootstrap: a Claude Code harness agent, run once by hand.
//
// `harness: "claudeCode"` swaps the LLM loop for the coding runtime, and that
// is what makes this cookbook possible. The output of a bootstrap is not a
// column value; it is thirty to sixty markdown files across ten domains, plus
// the collectors' snapshots under cadence/, plus an edit to the persona pull
// spec, delivered as one pull request. Only an agent with a working tree can
// produce that diff, and only a pull request makes it reviewable before it
// becomes what every other agent believes.
//
// `connector` and `languageModel` are required even here. The harness does not
// bring its own model: it runs against Cargo's LLM proxy, which bills this
// connector and meters usage against this slug. Any Anthropic model works with
// `claudeCode`; see `../connectors/anthropic.ts`.
//
// No `triggers`, on purpose. This runs once, when someone decides the
// knowledge layer should exist, and it stops twice to ask. Start it with
//
//   cargo-ai ai message create --agent-uuid <uuid> \
//     --parts '[{"type":"text","text":"Run the context bootstrap. Follow your system prompt exactly and open one pull request."}]'
//
// and answer its two stops in the same chat (`--chat-uuid <uuid>` from the
// first reply). A cron here would re-crawl the site every month and ask
// nobody anything; the monthly job is `context-refresh`, beside this file.
//
// No `repository` block, and nothing left to put in one. Plan and deploy
// fill the repo, branch, root and GitHub connector from the git origin of
// the checkout, which is the correct binding: the repository holding
// context/ and cadence/ IS this CDK project's. `cargo-ai cdk check` prints
// what it resolved; confirm the root is the repository root and not
// `infra/`, since that is where the agent's `npx tsx` resolves node_modules
// from.
//
// No `env` either. The CRM choice, the window and the lost-reason property
// are in scripts/context-building/collect/config.ts, where the compiler
// checks the slug and the harness picks up an edit on its next clone. The
// CRM and TheirStack are reached through `cargo-ai`, which the sandbox is
// signed in to, so there is no credential anywhere in this cookbook.
//
// No `uses` and no `capabilities`. Everything it reads it reads with the
// CLI in the sandbox or by fetching public pages, and the prompt is what
// holds those reads to read-only. The one thing it must never do is write
// the workspace context directly (`cargo-ai context runtime write`): a
// `context` capability here would be a second write path that skips the
// pull request.
export const contextBootstrap = defineAgent("context-bootstrap", {
  name: "Context bootstrap",
  description:
    "Populates context/ from the CRM, the calls and the public surface, asks twice, and opens one pull request. Run once by hand.",
  color: "blue",
  harness: "claudeCode",
  connector: anthropic,
  languageModel: "claude-sonnet-5", // PLACEHOLDER — your model of choice
  systemPrompt: contextBootstrapPrompt,
  folder: agentsFolder,
});
