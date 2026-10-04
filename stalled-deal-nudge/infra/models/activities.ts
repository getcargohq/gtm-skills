import { defineModel } from "@cargo-ai/cdk";

import { modelsFolder } from "../folders";

// Every logged touch on a deal: one row per email, meeting, call or note.
//
// Last activity is computed from these rows in SQL, max(occurred_at) per deal,
// not read off a roll-up property somebody else maintains. A roll-up that a
// sync forgets to refresh makes every deal look quiet; a row that exists is a
// touch that happened. The same rows hold the line the draft picks up from.
//
// Native and custom, so it deploys with no connector. Fill it from whatever
// logs your touches: a CRM engagement extract, call-capture, or a sequencer.
export const activities = defineModel("activities", {
  kind: "native",
  extractSlug: "defineCustom",
  config: {
    columns: [
      { slug: "deal_id", type: "string" },
      { slug: "account_id", type: "string" },
      { slug: "occurred_at", type: "date" },
      // email | meeting | call | note
      { slug: "kind", type: "string" },
      { slug: "subject", type: "string" },
      { slug: "body", type: "string" },
      { slug: "owner", type: "string" },
    ],
  },
  folder: modelsFolder,
});
