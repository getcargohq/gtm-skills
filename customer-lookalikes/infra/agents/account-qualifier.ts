import { defineAgent } from "@cargo-ai/cdk";

import { aiArk } from "../connectors/ai-ark";
import { anthropic } from "../connectors/anthropic";
import { agentsFolder } from "../folders";
import { accountQualifierPrompt } from "./account-qualifier.prompt";

// Scores one lookalike against the rubric: account fit, tier, the situation
// with its urgency, and which of the functions you sell to have an owner.
//
// The roles gap is what the contact finder aims at, and it is the claim most
// easily got wrong: a company where AI Ark resolves a tenth of the staff looks
// like it has no one in revenue operations because nobody is visible. The
// coverage rule in the prompt (below 0.20, no gap may be claimed) is what
// stops that guess from becoming the opener.
//
// It judges and writes nothing. The play applies the thresholds in
// `infra/settings.ts`, so moving the bar is a settings diff, not a prompt
// change, and the agent cannot wave its own candidates through.
export const accountQualifier = defineAgent("account_qualifier", {
  name: "Account qualifier",
  description:
    "Scores one company against the lookalike rubric in the workspace context: account fit, tier, situation with urgency, and the roles present and missing. JSON only.",
  color: "blue",
  connector: anthropic,
  languageModel: "claude-sonnet-5", // PLACEHOLDER: your model of choice
  temperature: 0,
  // The per-company ceiling on what a judgement can cost. The prompt's order
  // stops at the first failed gate, so most rejects use a fraction of it.
  maxSteps: 16,
  systemPrompt: accountQualifierPrompt,
  capabilities: [
    "webSearch",
    { slug: "context", config: { isReadOnly: true } },
  ],
  uses: [aiArk.actions.searchCompanies, aiArk.actions.countPeople],
  output: {
    type: "jsonSchema",
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      required: [
        "account_fit",
        "tier",
        "situation",
        "urgency",
        "roles_present",
        "roles_missing",
        "gap_count",
        "coverage_ratio",
        "verdict_reason",
        "evidence_urls",
      ],
      properties: {
        account_fit: { type: "integer", minimum: 0, maximum: 100 },
        tier: { type: "string", enum: ["1", "2", "3", "reject"] },
        situation: { type: "integer", minimum: 0, maximum: 50 },
        urgency: { type: "string" },
        roles_present: { type: "string" },
        roles_missing: { type: "string" },
        gap_count: { type: "integer", minimum: 0 },
        coverage_ratio: { type: "number", minimum: 0 },
        verdict_reason: { type: "string" },
        evidence_urls: { type: "array", items: { type: "string" } },
      },
    },
  },
  folder: agentsFolder,
});
