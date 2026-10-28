import { definePlay, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { slack } from "../connectors/slack";
import { playsFolder } from "../folders";
import { readinessScores } from "../models/readiness-scores";

// PLACEHOLDER: the Slack channel every ready account is posted to. A channel
// id (C…), not a name: names collide, and the connector's autocomplete
// resolves the id. Locked here so no run can post anywhere else.
const slackChannelId = "PLACEHOLDER_SLACK_CHANNEL_ID";

// One account that just crossed `readyThreshold`: one Slack message with the
// score, the signals behind it and their age. Nothing is written to a CRM and
// nothing is sent to anyone at the account; what happens after the ping is the
// team's, or a sequencer's on `ready_now_accounts`.
const routeReadyAccount = defineWorkflow(
  "route_ready_account",
  {
    // The `readiness_scores` columns, which the query in
    // models/readiness-scores.ts names. Rename one there, rename it here.
    input: z.object({
      account_id: z.string(),
      domain: z.string().optional(),
      readiness_score: z.number(),
      top_signals: z.string().optional(),
      signal_count: z.number(),
    }),
    output: z.object({ status: z.enum(["posted"]) }),
    uses: { slack },
    imports: { slackChannelId },
  },
  ({ input, uses }) => {
    // Field names follow standup's locked postMessage use. Confirm them with
    // `cargo-ai project types` after the Slack connector is authorized.
    uses.slack.postMessage({
      channelId: slackChannelId,
      format: "markdown",
      disableUnfurling: true,
      body: `*${input.domain} is ready* (score ${input.readiness_score})\n${input.signal_count} recent signals. Strongest: ${input.top_signals}.`,
    });

    return { status: "posted" as const };
  },
);

// Routes every account that enters `ready_now`.
//
// `changeKinds: ["added"]` is what makes an account posted once per climb. The
// score model is rebuilt every hour, and the play diffs the filtered rows on
// the account id, so an account that stays ready creates no run. One that
// falls below the line and climbs back is posted again, which is the point: a
// new signal brought it back.
//
// Cron at :20, after Account Events at :00 and the score at :10, so a tick
// reads the score the same hour's events produced. Ticks with nothing added
// create nothing.
//
// Ships disabled. Enabling is the last yes after the pilot query has set the
// thresholds (references/run.md). Then execute once by hand only if the team
// wants the accounts already ready posted too: `added` does not backfill the
// rows that were ready while the play was off.
export const routeReadyAccounts = definePlay("route_ready_accounts", {
  description:
    "Posts each account whose decaying readiness score just crossed the ready line to Slack, with the score and the signals behind it.",
  folder: playsFolder,
  model: readinessScores,
  workflow: routeReadyAccount,
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "and",
        conditions: [
          {
            kind: "string",
            columnSlug: readinessScores.columns.stage,
            operator: "is",
            values: ["ready_now"],
          },
        ],
      },
    ],
  },
  isEnabled: false,
  runCreationRule: "noConcurrency",
  changeKinds: ["added"],
  schedule: { type: "cron", cron: "20 * * * *" },
});
