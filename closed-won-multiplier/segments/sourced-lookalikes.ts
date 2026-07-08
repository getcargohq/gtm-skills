import { defineSegment } from "@cargo-ai/cdk";

import { accounts } from "../../base-gtm/models/accounts";

// Everything this cookbook created: the net-new accounts sourced from a win.
//
// A view of the OUTPUT, which is the only kind of segment worth deploying. The
// obvious alternative ("closed-won deals") would just restate the play's own
// trigger filter in a second place, so the two could drift apart. This one
// answers the question people actually ask: "what did the multiplier put in my
// list, and which win did each account come from?"
//
// Because every sourced account carries `lookalike_of`, a rep can always trace an
// account back to the customer it mirrors, which is the difference between a
// list they trust and a list they ignore.
export const sourcedLookalikes = defineSegment("sourced-lookalikes", {
  model: accounts,
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "and",
        conditions: [
          {
            kind: "string",
            columnSlug: accounts.columns.custom__lookalike_of,
            operator: "isNotEmpty",
          },
        ],
      },
    ],
  },
});
