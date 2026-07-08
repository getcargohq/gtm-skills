import { defineCapacity, memberIds } from "@cargo-ai/cdk";

import { contacts } from "../../base-gtm/models/contacts";
import { hubspot } from "../../crm-sync/connectors/hubspot";

// Caps each rep's book: at most 25 open inbound allocations per member;
// allocations reset weekly and return to the pool. Allocates over the base
// contacts model, so ownership is visible wherever contacts are read.
export const inboundCapacity = defineCapacity("inbound-capacity", {
  color: "green",
  description: "Inbound allocation pool with per-rep caps",
  model: contacts,
  idColumnSlug: contacts.columns.email, // PLACEHOLDER — your contacts identity column
  timeColumnSlug: contacts.columns.custom__owner_assigned_at, // PLACEHOLDER — your contacts allocation date column
  // Only pool contacts that came through the inbound pipeline: the
  // `inbound-intake` tool stamps `lead_source = "inbound"` on upsert, and this
  // filters on that same column. PLACEHOLDER — align the slug/value with the
  // source property your intake writes.
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "and",
        conditions: [
          {
            kind: "string",
            columnSlug: contacts.columns.lead_source,
            operator: "is",
            values: ["inbound"],
          },
          {
            kind: "string",
            columnSlug: contacts.columns.owner_id,
            operator: "is",
            values: memberIds(hubspot),
          },
        ],
      },
    ],
  },
  memberCapacity: 25,
  allocationExpirationPolicy: { interval: "weekly" },
});
