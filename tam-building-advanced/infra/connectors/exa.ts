import { defineConnector } from "@cargo-ai/cdk";

// Exa: search by meaning. It finds companies by what their website says they
// do, which is how it reaches the ones filed under an industry nobody would
// filter on. It has no extractor, so it runs from a play over written queries.
export const exa = defineConnector("exa", {
  integration: "exa",
  default: true,
});
