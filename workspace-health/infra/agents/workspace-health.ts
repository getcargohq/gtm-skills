import { defineAgent } from "@cargo-ai/cdk";

import { workspaceHealthPrompt } from "./workspace-health.prompt";
import { anthropic } from "../connectors/anthropic";
import { slack } from "../connectors/slack";
import { agentsFolder } from "../folders";

// The channel findings land in, and the only channel this agent reads back.
// One constant for both uses: the agent remembers what it already reported by
// reading its own earlier posts, so posting to one channel and reading another
// would make it repeat every finding every morning.
//
// PLACEHOLDER — a Slack channel id (C…), not a name. Invite the Cargo app to
// it: getConversationHistory cannot read a channel the app is not in.
const HEALTH_CHANNEL_ID = "C0123456789";

// Workspace health: a Claude Code harness agent, not a streamText agent.
//
// It reads the workspace every morning and posts only when something is wrong:
// failing runs grouped by cause, a play that stopped running, runs that
// succeed and write nothing, a credit spike. The harness is what puts Cargo's
// own CLI in reach, with the orchestration SQL surface that groups a day of
// failures in one query. It clones the repository for that toolchain and never
// pushes to it.
//
// It reports and never fixes. A rerun bills again, a disabled play may be
// disabled on purpose, and a watcher that acts on its own findings is a second
// operator nobody reviews.
//
// No `capabilities`, on purpose: the CLI already in the sandbox is the read
// path, and only the prompt can say "read, never execute". The commands are
// listed in `workspace-health.prompt.ts` §2.
export const workspaceHealth = defineAgent("workspace_health", {
  name: "Workspace health",
  description:
    "Every morning, checks the workspace for failing runs, stopped plays, empty outputs and credit spikes, and posts to Slack only when something is wrong.",
  color: "red",
  harness: "claudeCode",
  connector: anthropic,
  languageModel: "claude-sonnet-5", // PLACEHOLDER — your model of choice
  repository: {
    // Deliberately partial, resolved from the checkout's git origin at plan.
    // `cargo-ai project check` prints what it resolved.
    env: {
      // Public thresholds, so plain strings. A failure rate above this share
      // of a workflow's runs is a finding; below it is provider coverage.
      HEALTH_ERROR_RATE: "0.05",
      // A day's credits above this multiple of the prior seven-day mean is a
      // spike.
      HEALTH_SPEND_MULTIPLE: "2",
      // And the excess over that mean must be at least this many credits:
      // below it a spike is noise on a workflow that barely spends.
      HEALTH_SPEND_FLOOR: "10",
    },
  },
  uses: [
    {
      ref: slack.actions.postMessage,
      config: {
        channelId: HEALTH_CHANNEL_ID,
        format: "markdown",
        disableUnfurling: true,
      },
    },
    {
      ref: slack.actions.getConversationHistory,
      config: {
        channelId: HEALTH_CHANNEL_ID,
        limit: 50,
      },
    },
  ],
  triggers: [
    {
      type: "cron",
      name: "daily",
      // 14:00 UTC: early morning in the Americas, afternoon in Europe, before
      // most teams' first review of the day.
      cron: "0 14 * * *",
      text: "Run workspace health. Follow your system prompt exactly: read the last day, compare it to the week, post only what is wrong and new, and on Mondays post the weekly line.",
    },
  ],
  systemPrompt: workspaceHealthPrompt,
  folder: agentsFolder,
});
