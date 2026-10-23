import { defineModel } from "@cargo-ai/cdk";

import { modelsFolder } from "../folders";

// One row per customer worth finding more of, written by a person. The play
// runs every row once a month.
//
// The columns are what a lookalike is matched against, and most of them are
// not in any CRM: what the customer bought, why they bought it, who signed,
// and what they looked like at the moment they bought (headcount, stage,
// funding, the role they were missing). A lookalike shares that shape, not the
// customer's shape today. A row with only a name and a domain gets lookalikes
// of the domain, which is what every lookalike search already returns.
//
// Customer names and deal shapes are internal. This model, its prospects and
// any screen they appear on stay inside the workspace.
export const lookalikeSeeds = defineModel("lookalike_seeds", {
  kind: "native",
  extractSlug: "defineCustom",
  name: "Lookalike seeds",
  description:
    "One row per customer to find more of: what they bought, why, who signed, and their shape at purchase. The lookalike play runs every row monthly.",
  folder: modelsFolder,
  config: {
    columns: [
      { slug: "customer", type: "string" },
      { slug: "domain", type: "string" },
      { slug: "relationship", type: "string" },
      { slug: "what_they_bought", type: "string" },
      { slug: "deal_shape", type: "string" },
      { slug: "trigger", type: "string" },
      { slug: "signer", type: "string" },
      { slug: "at_purchase", type: "string" },
      { slug: "segment_hint", type: "string" },
      { slug: "notes", type: "string" },
    ],
  },
});
