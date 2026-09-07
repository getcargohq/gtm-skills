import { defineConnector } from "@cargo-ai/cdk";

// The enrichment provider, and the only paid call in this skill. Both of its
// actions the tool uses — `enrichCompany` from a LinkedIn company URL and
// `enrichCompanyFromDomain` — answer the same question from a different
// identifier, so a row takes exactly one of them and never both.
export const linkedin = defineConnector("linkedin", {
  integration: "linkedin",
  adopt: true,
});
