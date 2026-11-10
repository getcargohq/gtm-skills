import { defineModel } from "@cargo-ai/cdk";

import { modelsFolder } from "../folders";

// The people on the meetings. A Cargo native contact model (`defineContact`:
// id, account_id, name, title, email, linkedin_url, ...), matched to attendees
// by email. A LinkedIn URL on a card comes from `linkedin_url` here or from a
// search for that exact person, never from a guess.
//
// `gtm_contacts` is a shared native model (scripts/native-models.json): every
// pipeline that needs contacts declares it under this slug, so a project that
// installs several keeps one, with each pipeline's added columns merged.
export const gtmContacts = defineModel("gtm_contacts", {
  name: "GTM contacts",
  kind: "native",
  extractSlug: "defineContact",
  folder: modelsFolder,
});
