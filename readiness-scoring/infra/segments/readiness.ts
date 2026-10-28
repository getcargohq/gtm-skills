import { defineSegment } from "@cargo-ai/cdk";

import { readinessScores } from "../models/readiness-scores";

// Views onto the score, by stage. They read `stage`, which the query computes
// from the thresholds in settings.ts, so moving a threshold moves both
// segments at the next sync with no edit here. `cold` gets no segment: it is
// every account with a weighed event that is neither, and nothing routes on it.

// Ready now: the handle a sequencer, contact sourcing or a rep's list takes.
// The play routes the accounts that enter it.
export const readyNow = defineSegment("ready_now_accounts", {
  model: readinessScores,
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
});

// Warming: one more signal from ready. Worth a nurture, not a rep.
export const warming = defineSegment("warming_accounts", {
  model: readinessScores,
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
            values: ["warming"],
          },
        ],
      },
    ],
  },
});
