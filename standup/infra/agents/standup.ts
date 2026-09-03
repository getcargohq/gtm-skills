import { defineAgent } from "@cargo-ai/cdk";

import { standupPrompt } from "./standup.prompt";
import { slack } from "../connectors/slack";
import { agentsFolder } from "../folders";

// The standup: a Claude Code harness agent, not a streamText agent.
//
// `harness: "claudeCode"` swaps the LLM loop for the coding runtime, and that
// is what makes this skill possible. The output of a day is not a column
// value; it is a diff across the repo — a raw dump, a log entry, maybe a
// carryover row — plus one Slack post. Only an agent with a working tree can
// produce the diff, and only a pull request makes the log reviewable before
// it is what next Monday's plan is written from. There is no `connector` /
// `languageModel` here on purpose: the harness brings its own model.
//
// Slack is a Cargo connector action on `uses`, not a script and not a wrapped
// tool. `channelId` is locked the same way `mailboxUuid` is locked on
// sendEmail: if it were a field the agent filled, a mistype would post the
// internal recap into a customer channel, which is the one failure here
// nobody can undo. format and disableUnfurling are locked with it; the agent
// fills `body`.
//
// `platform` is the workspace operating surface (cargo#5815): list and query
// runs, query models, credit usage. Same tools as the platform MCP.
// It is not in @cargo-ai/cdk 1.0.68's Capability union yet; the wire payload
// is still `{ slug, config }`. Drop the assertion once types catch up. This
// recap is read-only against it — execute_action is how a standup starts
// spending, and Slack posting is the locked use below, not a platform execute.
export const standup = defineAgent("standup", {
  name: "Standup",
  description:
    "Recaps the GTM day into the cadence log, opens one reviewable pull request, and posts a Slack digest.",
  color: "blue",
  harness: "claudeCode",
  // @ts-expect-error TS2322: "platform" is not in this package's Capability union yet (cargo#5815)
  capabilities: [{ slug: "platform", config: {} }],
  repository: {
    // Deliberately partial. `repository`, `defaultBranch`, `rootDirectory` and
    // the GitHub `connector` are all OMITTED so plan and deploy fill them from
    // the git origin of the checkout they run in, taking the connector from the
    // project's own `defineConnector`.
    //
    // `rootDirectory` resolves to the directory whose package.json declares
    // `@cargo-ai/cdk` — where node_modules is, and therefore the only place the
    // agent's `npx tsx …/collect/day.ts` resolves. In the scaffolded layout
    // that is the repository root, which is also where cadence/ lives.
    // `cargo-ai cdk check` prints what it resolved; verify it names the
    // repository root and not `infra/`.
    env: {
      // IANA timezone the recapped calendar day is computed in. Public, so a
      // plain string rather than a secret. The cron is 05:00 UTC, which is
      // 10pm here during PDT; change both together if you move the evening.
      STANDUP_TIMEZONE: "America/Los_Angeles",
      // PLACEHOLDER — the short name in the Slack header (":racing_car: *GTM -
      // Sat Aug 1*"). A founder-facing label, not the GitHub repo name.
      STANDUP_TITLE: "GTM",
    },
  },
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
      name: "daily",
      // 05:00 UTC: 10pm PT during PDT, 9pm PT during PST. Recaps the timezone
      // day that is ending. A morning run recaps an incomplete day; keep the
      // cron in the evening.
      cron: "0 5 * * *",
      text: "Run the daily standup. Follow your system prompt exactly: write the log, open one pull request, post the Slack digest.",
    },
  ],
  systemPrompt: standupPrompt,
  folder: agentsFolder,
});
