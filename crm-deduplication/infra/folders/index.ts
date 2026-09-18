import { defineFolder } from "@cargo-ai/cdk";

export const modelsFolder = defineFolder("crm-deduplication-models", {
  kind: "model",
  name: "CRM deduplication",
});

export const playsFolder = defineFolder("crm-deduplication-plays", {
  kind: "play",
  name: "CRM deduplication",
});
