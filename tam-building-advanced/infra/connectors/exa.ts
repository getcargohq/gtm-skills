import { defineConnector } from "@cargo-ai/cdk";

// Exa: search by meaning. It finds companies by what their website says they
// do, which is how it reaches the ones filed under an industry nobody would
// filter on. It has no extractor: the queries in settings.ts are run from the
// CLI and what they find is loaded into tam_source_exa (references/run.md).
export const exa = defineConnector("exa", {
  integration: "exa",
  default: true,
});
