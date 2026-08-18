import { defineSegment } from "@cargo-ai/cdk";

import { productEvents } from "../models/product-events";
import { productWorkspaces } from "../models/product-workspaces";

// The PQL detector: workspaces whose related product events crossed the usage
// threshold — an `occurrence` condition counting rows of the events model in a
// rolling window. The model handle's uuid is a deploy-time token; the filter
// type wants a string, so it's asserted here and resolved by the reconciler.
//
// PLACEHOLDER — the threshold (10 key events in 14 days) and the event-name
// condition are your PQL definition. Requires the workspaces ↔ product-events
// relationship (see `models/product-relationships.ts`).
export const pqls = defineSegment("pql-accounts", {
  model: productWorkspaces,
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "and",
        conditions: [
          {
            kind: "occurrence",
            relatedModelUuid: productEvents.uuid,
            frequency: { operator: "moreThan", value: 10 },
            period: { operator: "lessThan", value: 14, unit: "day" },
            conjonction: "and",
            conditions: [
              {
                kind: "string",
                columnSlug: productEvents.columns.event_type,
                operator: "is",
                values: ["workflow_published"], // PLACEHOLDER — your key event
              },
            ],
          },
        ],
      },
    ],
  },
});
