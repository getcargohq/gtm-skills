import { defineFolder } from "@cargo-ai/cdk";
export const modelsFolder = defineFolder("account-scoring-models", {
  kind: "model",
  name: "Account scoring",
});
export const agentsFolder = defineFolder("account-scoring-agents", {
  kind: "agent",
  name: "Account scoring",
});
export const playsFolder = defineFolder("account-scoring-plays", {
  kind: "play",
  name: "Account scoring",
});
export const toolsFolder = defineFolder("account-scoring-tools", {
  kind: "tool",
  name: "Account scoring",
});
