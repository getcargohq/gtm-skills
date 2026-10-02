import { defineAgent } from "@cargo-ai/cdk";

import { webScribePrompt } from "./web-scribe.prompt";
import { anthropic } from "../connectors/anthropic";
import { agentsFolder } from "../folders";

// The web scribe: a Claude Code harness agent on a weekly cron.
//
// `harness: "claudeCode"` swaps the LLM loop for the coding runtime, and that
// is what makes this cookbook possible. The output of a week is not a column
// value; it is a diff across markdown files under context/, plus the snapshot
// the collector wrote under cadence/, delivered as one pull request. Only an
// agent with a working tree can produce that diff, and only a pull request
// makes it reviewable before it becomes what every other agent believes.
//
// `connector` and `languageModel` are required even here. The harness does not
// bring its own model: it runs against Cargo's LLM proxy, which bills this
// connector and meters usage against this slug. Any Anthropic model works with
// `claudeCode`; see `../connectors/anthropic.ts`.
//
// The first run seeds whatever context/ domain is empty; every run after adds
// what changed that week. Run the first one by hand rather than waiting for
// Monday:
//
//   cargo-ai ai message create --agent-uuid <uuid> \
//     --parts '[{"type":"text","text":"Run the web capture. Follow your system prompt exactly."}]'
//
// No `repository` block, and nothing left to put in one. Plan and deploy
// fill the repo, branch, root and GitHub connector from the git origin of
// the checkout, which is the correct binding: the repository holding
// context/ IS this CDK project's. `cargo-ai cdk check` prints what it
// resolved; confirm the root is the repository root and not `infra/`, since
// that is where the agent's `npx tsx` resolves node_modules from.
//
// No `env` either. The domain, the pages and the news window are in
// scripts/web-capture/collect/config.ts, where the compiler checks them and
// the harness picks up an edit on its next clone. The news search is reached
// through `cargo-ai`, which the sandbox is signed in to, so there is no
// credential anywhere in this cookbook.
//
// No `uses` and no `capabilities`. It reads what the collector wrote, and the
// one thing it must never do is write the workspace context directly: a
// `context` capability here would be a second write path that skips the pull
// request.
export const webScribe = defineAgent("web_scribe", {
  name: "Web scribe",
  description:
    "Weekly: reads the company's website and the week's news, seeds any empty context/ domain, adds what changed as dated files, and opens one pull request.",
  color: "blue",
  harness: "claudeCode",
  connector: anthropic,
  languageModel: "claude-sonnet-5", // PLACEHOLDER: your model of choice
  triggers: [
    {
      type: "cron",
      name: "weekly",
      // 06:00 UTC every Monday, before anyone reads the repository. The news
      // window runs from the last committed snapshot, so a quiet week that
      // opened no pull request is covered by the next one, not skipped.
      cron: "0 6 * * 1",
      text: "Run the weekly web capture. Follow your system prompt exactly: run the collector, add what changed to context/, and open one pull request, or none when nothing changed.",
    },
  ],
  systemPrompt: webScribePrompt,
  folder: agentsFolder,
});
