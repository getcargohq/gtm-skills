import { defineCapacity, memberIds } from "@cargo-ai/cdk";

import { hubspot } from "../connectors/hubspot";
import { accounts } from "../models/accounts";

// Per-rep book caps over the account universe: at most 50 open allocations per
// member, resetting monthly. Territories decide WHO is eligible; the capacity
// decides HOW MANY each rep can hold.
export const accountBook = defineCapacity("account-book", {
  color: "green",
  description: "Account allocation pool with per-rep caps",
  model: accounts,
  idColumnSlug: accounts.columns.website, // PLACEHOLDER — your accounts identity column
  timeColumnSlug: accounts.columns.custom__owner_assigned_at, // PLACEHOLDER — your accounts allocation date column
  // Pool only accounts owned by a member of this pool: `hubspot_owner_id` holds
  // each company's owner id, and `memberIds(hubspot)` resolves to the members'
  // ids in the HubSpot connector at allocation time. PLACEHOLDER — align the
  // slug with your accounts owner column.
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "and",
        conditions: [
          {
            kind: "string",
            columnSlug: accounts.columns.owner_id,
            operator: "is",
            values: memberIds(hubspot),
          },
        ],
      },
    ],
  },
  memberCapacity: 50,
  allocationExpirationPolicy: { interval: "monthly" },
});
