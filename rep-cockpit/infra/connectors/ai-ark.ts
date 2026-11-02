import { defineConnector } from "@cargo-ai/cdk";

// AI Ark: the people search behind a claim. `default: true` binds the
// workspace's own connector, so the pipeline deploys with no key of its own.
// When tam-building or account-scoring is installed, drop this file and point
// the import at their connector: two connectors with one slug collide.
export const aiArk = defineConnector("ai_ark", {
  integration: "aiArk",
  default: true,
});
