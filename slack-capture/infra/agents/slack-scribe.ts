import { agentConnectorTrigger, defineAgent } from "@cargo-ai/cdk";

import { slackScribePrompt } from "./slack-scribe.prompt";
import { anthropic } from "../connectors/anthropic";
import { slack } from "../connectors/slack";
import { agentsFolder } from "../folders";

// The Slack scribe: a Claude Code harness agent, summoned by an @mention.
//
// `harness: "claudeCode"` for the same reason as call-capture's scribe: the
// output of a thread is a diff across the repo — a raw capture, a log entry, a
// context file that just gained its second occurrence — and only a pull
// request makes it reviewable before every other agent believes it.
//
// An @mention, not a reaction. Slack's agent trigger fires on a mention; there
// is no reaction event to listen for. "@Cargo capture this" in the thread is
// the deliberate act, and it is better than an emoji anyway: the platform
// replies in that thread, so whoever asked sees the pull request link.
//
// `channelIds`, never `allChannels`. A channel listed here is owned by this
// agent: an `allChannels` agent such as ask-cargo leaves it alone. That is the
// trade, made on purpose. List the internal channels where customer intel is
// discussed (deal rooms, #customer-feedback, CS escalations), where "capture
// this" is the job, and leave general channels to ask-cargo. `allChannels`
// here would put two agents on every mention in the workspace, and would let
// a capture start in a customer shared channel the bot happens to be in.
//
// Slack reads are on `uses`, locked to what a capture needs: `getThread` for
// the thread it was summoned into, `listUsers` to name authors, `addReaction`
// to mark the summoning message once the push landed. No `postMessage`: the
// reply is the agent's final text, which the trigger posts in the thread, so
// a post action would only be a way to write somewhere else.
//
// No `capabilities`. The context layer is read and written in the checkout, as
// files, under review; a context capability would be a second, unreviewed
// write path into what every other agent reads.
export const slackScribe = defineAgent("slack_scribe", {
  name: "Slack scribe",
  description:
    "Captures a Slack thread into the cadence log when @mentioned, promotes repeated claims into context, and adds it to today's pull request.",
  color: "blue",
  harness: "claudeCode",
  connector: anthropic,
  languageModel: "claude-sonnet-5", // PLACEHOLDER — your model of choice
  // No `repository` block: plan and deploy bind the project's own repository
  // from the checkout's git origin, taking the GitHub connector from the
  // project's `defineConnector`. `cargo-ai cdk check` prints what it resolved;
  // confirm the root is the repository root and not `infra/`.
  uses: [
    slack.actions.getThread,
    slack.actions.listUsers,
    slack.actions.addReaction,
  ],
  triggers: [
    agentConnectorTrigger({
      connector: slack,
      config: {
        // PLACEHOLDER — the internal channels where "capture this" is the
        // job, as Slack ids (C…/G…) read from the connector's channel
        // autocomplete. Never a customer shared channel.
        channelIds: ["C0123456789"],
      },
    }),
  ],
  systemPrompt: slackScribePrompt,
  folder: agentsFolder,
});
