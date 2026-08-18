import { defineConnector } from "@cargo-ai/cdk";

// Cargo's native waterfall enrichment — multi-provider fallback built in, so
// there is no per-provider key to bring: it runs on Cargo credits with zero
// config. Actions used across the cookbooks: `enrichContact`, `enrichCompany`,
// `verifyEmail`, `findPhone`, `searchProspects`, `detectJobChange`.
export const waterfall = defineConnector("waterfall", {
  integration: "waterfall",
  adopt: true,
});
