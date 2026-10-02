import { defineAgent } from "@cargo-ai/cdk";

import { winLossAnalystPrompt } from "./win-loss-analyst.prompt";
import { anthropic } from "../connectors/anthropic";
import { slack } from "../connectors/slack";
import { agentsFolder } from "../folders";

// The win-loss review agent: a Claude Code harness agent on a monthly cron, and
// run by hand once for the first pass.
//
// `harness: "claudeCode"` swaps the LLM loop for the coding runtime, and that
// is what makes this cookbook possible. The output of a month is not a column
// value; it is a diff across markdown files: an ICP verified against won and
// lost, dated insights with denominators, objections from lost reasons,
// clients from closed-won, plus the audit snapshot under cadence/. Only an
// agent with a working tree can produce that diff, and only a pull request
// makes it reviewable before it becomes what every other agent believes.
//
// `connector` and `languageModel` are required even here. The harness does not
// bring its own model: it runs against Cargo's LLM proxy, which bills this
// connector and meters usage against this slug. Any Anthropic model works with
// `claudeCode`; see `../connectors/anthropic.ts`.
//
// Slack is a Cargo connector action on `uses`, not a script and not a wrapped
// tool. `channelId` is locked the same way `mailboxUuid` is locked on
// sendEmail: if it were a field the agent filled, a mistype would post the
// month's lost deals into a customer channel. format and disableUnfurling
// are locked with it; the agent fills `body`. The digest is five lines, so a
// teammate reads it in ten seconds and opens the pull request when a line
// surprises them.
//
// No `repository` block, and nothing left to put in one. Plan and deploy
// fill the repo, branch, root and GitHub connector from the git origin of
// the checkout, which is the correct binding: the repository holding
// context/ and cadence/ IS this CDK project's. `cargo-ai cdk check` prints
// what it resolved; confirm the root is the repository root and not
// `infra/`, since that is where the agent's `npx tsx` resolves node_modules
// from.
//
// No `env` either. The CRM choice, the pipelines, the window, the lost-reason
// property and the verify line are in scripts/win-loss-review/collect/config.ts,
// where the compiler checks the slug and the harness picks up an edit on its
// next clone. The CRM is reached through `cargo-ai`, which the sandbox is
// signed in to, so there is no credential anywhere in this cookbook.
//
// No `capabilities`. The audit is read from the snapshot the collector wrote,
// and the one thing this agent must never do is write the workspace context
// directly: a `context` capability here would be a second write path that
// skips the pull request.
export const winLossAnalyst = defineAgent("win_loss_analyst", {
  name: "Win-loss analyst",
  description:
    "Monthly: audits the CRM's won and lost deals, verifies the ICP, appends dated insights, objections, clients and proof to context/, opens one pull request, posts a five-line digest to Slack.",
  color: "blue",
  harness: "claudeCode",
  connector: anthropic,
  languageModel: "claude-sonnet-5", // PLACEHOLDER — your model of choice
  uses: [
    {
      ref: slack.actions.postMessage,
      config: {
        // PLACEHOLDER — the channel the digest is allowed to land in. Locked
        // so the agent cannot pick a customer shared channel. A Slack channel
        // id (C…), not a name: names collide and autocomplete is what the
        // connector uses.
        channelId: "C0123456789",
        format: "markdown",
        disableUnfurling: true,
      },
    },
  ],
  triggers: [
    {
      type: "cron",
      name: "monthly",
      // 06:00 UTC on the first of the month, before anyone reads the repo.
      // The window is "since the previous snapshot", so a missed month is
      // caught up by the next one rather than lost. The first pass is run by
      // hand: same agent, same prompt, no previous snapshot to diff against.
      cron: "0 6 1 * *",
      text: "Run the monthly win-loss review. Follow your system prompt exactly: run the audit, append to context/, open one pull request, post the five-line digest.",
    },
  ],
  systemPrompt: winLossAnalystPrompt,
  folder: agentsFolder,
});
