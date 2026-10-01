import { defineConnector } from "@cargo-ai/cdk";

// The enrichment provider. Account enrichment chooses one of the company
// actions. Contact LinkedIn enrichment uses the profile action only after the
// play has a LinkedIn URL.
export const linkedin = defineConnector("linkedin", {
  integration: "linkedin",
  default: true,
});
