import { definePlay, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { hubspot } from "../../crm-sync/connectors/hubspot";
import { slack } from "../../base-gtm/connectors/slack";
import { productEvents } from "../models/product-events";
import { productWorkspaces } from "../models/product-workspaces";

// PLACEHOLDER — per-territory review channels. A PQL is routed to its
// territory's channel (same regions as the routing-engine cookbook), and a
// human approves the handoff there.
const TERRITORY_CHANNELS: Record<string, string> = {
  amer: "C0000000000", // PLACEHOLDER — AMER PQL review channel
  emea: "C0000000001", // PLACEHOLDER — EMEA PQL review channel
};

// The product-to-sales handoff, territory-first + human-reviewed: when a
// workspace crosses the PQL threshold we resolve its territory FIRST so it lands
// with the right owner, then open a `humanReview` gate in that territory's Slack
// channel. The workflow BLOCKS on Approve/Decline — and only on approval does it
// upsert the account in HubSpot and assign the approving reviewer as its owner.
const handoffWorkspace = defineWorkflow(
  "pql-handoff",
  {
    input: z.object({
      workspace_id: z.string(),
      workspace_name: z.any(),
      country: z.any(),
      domain: z.any(),
    }),
    output: z.object({ territory: z.string(), approved: z.boolean() }),
    uses: { hubspot, slack },
  },
  ({ input, uses, ai, humanReview }) => {
    // Territory-first: resolve the territory before the handoff. PLACEHOLDER —
    // same geo rule as routing-engine; swap for your rules (segment, named
    // lists, etc.). Needs a geo column (`country`) on the product-workspaces
    // model.
    const territory =
      input.country === "United States" || input.country === "Canada"
        ? "amer"
        : "emea";

    // Human-in-the-loop gate: post an Approve/Decline request to the territory's
    // channel and block until a reviewer acts (the action posts to Slack itself).
    const review = humanReview({
      connectorUuid: slack.uuid,
      channelId: TERRITORY_CHANNELS[territory],
      title: `PQL ready for ${territory.toUpperCase()} review`,
      content: ai(
        `Write a two-line PQL handoff for workspace ${input.workspace_name}
(${input.workspace_id}): it just crossed our threshold (10+ key product events
in 14 days). Line 1: what happened. Line 2: the suggested first move.`,
      ) as unknown as string,
    });

    // On approval only: upsert the account (company) and set its owner to the
    // reviewer who approved. PLACEHOLDER — `product-workspaces` needs a `domain`
    // column mapping the workspace to its CRM company, and the reviewer's Slack
    // id must map to the matching HubSpot owner id (the two id spaces differ).
    if (review.approved) {
      const reviewer = review.user as unknown as { id: string };
      uses.hubspot.upsertRecords({
        objectType: "companies",
        matchingPropertyName: "domain",
        matchingValue: input.domain,
        mappings: [
          { propertyName: "lifecyclestage", value: "salesqualifiedlead" },
          { propertyName: "hubspot_owner_id", value: reviewer.id },
        ],
      });
    }

    return { territory, approved: review.approved as unknown as boolean };
  },
);

// Same occurrence condition as the `pql-accounts` segment, as the play's
// filter — `once` per record, so a workspace is handed off a single time even
// as its usage keeps qualifying.
export const pqlHandoff = definePlay("pql-handoff", {
  model: productWorkspaces,
  workflow: handoffWorkspace,
  changeKinds: ["added", "updated"],
  runCreationRule: "once",
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "and",
        conditions: [
          {
            kind: "occurrence",
            relatedModelUuid: productEvents.uuid as unknown as string,
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
  schedule: { type: "realtime" },
});
