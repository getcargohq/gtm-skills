import { defineConnector } from "@cargo-ai/cdk";

// LinkedIn. Adopted, no key, no config: it belongs in the shared foundation for
// the same reason slack, waterfall, and the Cargo database do. Several cookbooks
// need it (profile enrichment for meeting-prep, similar-company lookup for
// closed-won-multiplier), and a connector slug can only be declared once, so
// declaring it per cookbook would collide the moment two of them were installed
// together.
//
// Sales Navigator is a SEPARATE connector and deliberately not here: it lives in
// tam-building, because a Sales Nav connection is a real prerequisite that the
// cookbooks which never touch LinkedIn search should not inherit.
export const linkedin = defineConnector("linkedin", {
  integration: "linkedin",
  adopt: true,
});
