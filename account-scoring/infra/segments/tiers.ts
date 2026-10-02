import { defineSegment } from "@cargo-ai/cdk";

import { accounts } from "../models/accounts";

// Tier slices over the scored book. `cargo_tier` lands on
// the CRM record (stamped by the scoring play) and arrive here through the
// accounts model's refresh — make sure the `cargo_tier` column is selected on the model.
export const tierA = defineSegment("tier_a_accounts", {
  model: accounts,
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "and",
        conditions: [
          {
            kind: "string",
            columnSlug: accounts.columns.custom__cargo_tier,
            operator: "is",
            values: ["A"],
          },
        ],
      },
    ],
  },
});

export const tierC = defineSegment("tier_c_accounts", {
  model: accounts,
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "and",
        conditions: [
          {
            kind: "string",
            columnSlug: accounts.columns.custom__cargo_tier,
            operator: "is",
            values: ["C"],
          },
        ],
      },
    ],
  },
});
