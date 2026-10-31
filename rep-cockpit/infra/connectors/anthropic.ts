import { defineConnector } from "@cargo-ai/cdk";

// The model the first-touch writer runs on. `default: true` binds the
// workspace's authorized Anthropic connector rather than creating one.
export const anthropic = defineConnector("anthropic", {
  integration: "anthropic",
  default: true,
});
