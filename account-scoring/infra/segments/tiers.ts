import { defineSegment } from "@cargo-ai/cdk";
import { accounts } from "../models/accounts";
import { tierNames } from "../runtime/generated";

// CRM outputs, not custom__ aliases. Confirm cargo_tier is selected and typed
// in the target extract; reuse the customer's approved property when present.
export const tiers = tierNames.map((tier) =>
  defineSegment(
    `account-fit-${tier.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    {
      model: accounts,
      filter: {
        conjonction: "and",
        groups: [
          {
            conjonction: "and",
            conditions: [
              {
                kind: "string",
                columnSlug: "cargo_tier",
                operator: "is",
                values: [tier],
              },
            ],
          },
        ],
      },
    },
  ),
);
