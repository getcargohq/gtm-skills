import { defineSegment } from "@cargo-ai/cdk";

import { deals } from "../models/deals";

// The deals the analyst flagged: a standing, always-current view of what is at
// risk right now.
//
// This is a view of the agent's OUTPUT, not a restatement of its input. A
// segment that merely repeats a play's own trigger filter is dead weight and a
// drift trap (change one, forget the other). This one earns its place: the Slack
// digest is a moment in time, and by Wednesday nobody can find it. The segment is
// the thing a manager opens on Thursday.
export const atRiskDeals = defineSegment("at-risk-deals", {
  model: deals,
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "and",
        conditions: [
          {
            kind: "string",
            columnSlug: deals.columns.custom__risk_reason,
            operator: "isNotEmpty",
          },
          {
            kind: "boolean",
            columnSlug: deals.columns.is_closed,
            operator: "isFalse",
          },
        ],
      },
    ],
  },
});
