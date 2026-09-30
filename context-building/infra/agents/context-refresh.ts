import { defineAgent } from "@cargo-ai/cdk";

import { contextRefreshPrompt } from "./context-refresh.prompt";
import { anthropic } from "../connectors/anthropic";
import { slack } from "../connectors/slack";
import { agentsFolder } from "../folders";

// The refresh: the same harness pattern as the bootstrap, on a monthly cron,
// append-only.
//
// It runs the CRM collector, reads the call entries call-capture wrote since
// the last refresh, and appends dated insight, objection, client and proof
// files. It never edits icp/ or persona/: a change there is a proposal in the
// pull request body, because those two domains are what the scorer and every
// outbound agent key on, and a monthly agent quietly rewriting them is how a
// knowledge base drifts without anyone deciding it should.
//
// Slack is a Cargo connector action on `uses`, not a script and not a wrapped
// tool. `channelId` is locked the same way `mailboxUuid` is locked on
// sendEmail: if it were a field the agent filled, a mistype would post the
// digest into a customer channel. format and disableUnfurling are locked with
// it; the agent fills `body`. The digest is five lines, so a teammate reads
// it in ten seconds and opens the pull request when a line surprises them.
//
// See ../agents/context-bootstrap.ts for why there is no `repository`, no
// `env` and no `capabilities` here either.
export const contextRefresh = defineAgent("context-refresh", {
  name: "Context refresh",
  description:
    "Monthly: reads the new calls and closed deals, appends what is new to context/, opens one pull request, posts a five-line digest to Slack.",
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
      // 06:00 UTC on the first of the month: after call-capture's 07:00 run
      // of the previous day has landed, before anyone reads the repo. The
      // window is "since the last refresh", so a missed month is caught up
      // by the next one rather than lost.
      cron: "0 6 1 * *",
      text: "Run the monthly context refresh. Follow your system prompt exactly: append to context/, open one pull request, post the five-line digest.",
    },
  ],
  systemPrompt: contextRefreshPrompt,
  folder: agentsFolder,
});
