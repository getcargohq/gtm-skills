import { defineAgent } from "@cargo-ai/cdk";

import { cargoDb } from "../connectors/cargo";
import { openai } from "../connectors/openai";
import { agentsFolder } from "../folders/gtm";
import { accounts } from "../models/accounts";

// The researcher. Everything it can read or call is one `uses` array: the base
// accounts model (read-only) and the Cargo business database (credits-based
// firmographics + strategic insights). `webSearch` covers public sources; the
// context repo (synced by `../context.ts`) grounds the brief in your ICP and
// personas. `connector` is the LLM provider, from base.
export const researcher = defineAgent("account-researcher", {
  color: "purple",
  connector: openai,
  languageModel: "gpt-4o", // PLACEHOLDER — your model of choice
  systemPrompt: `You research a target account and produce a one-page brief for
an AE. Ground every brief in the workspace context (ICP, personas): state the
fit against the ICP, the likely buyer personas, three conversation angles, and
any disqualifiers. Cite what you found; never invent facts about the account.`,
  maxSteps: 12,
  capabilities: ["webSearch", "memory"],
  uses: [
    { ref: accounts, readOnly: true },
    cargoDb.actions.matchBusiness,
    cargoDb.actions.enrichBusinessFirmographics,
    cargoDb.actions.enrichBusinessStrategicInsights,
  ],
  folder: agentsFolder,
  evaluator: {
    rubric:
      "Is the brief grounded in the ICP, specific to the account, and free of invented facts?",
    threshold: 0.8,
  },
});
