import { defineConnector } from "@cargo-ai/cdk";

// The provider behind the example model's one provider attribute: people in
// data roles, counted by `findCustomHeadcount` on the company's LinkedIn page.
// Each provider attribute in your model gets the connector its action needs;
// a model with none drops this file and the call in tools/enrich-account.ts.
//
// Same slug as crm-enrichment's LinkedIn connector, so a project running it
// shares one: drop this copy and import theirs. `default: true` binds the
// workspace's existing connection.
export const linkedin = defineConnector("linkedin", {
  integration: "linkedin",
  default: true,
});
