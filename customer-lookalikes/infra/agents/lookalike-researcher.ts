import { defineAgent } from "@cargo-ai/cdk";

import { aiArk } from "../connectors/ai-ark";
import { anthropic } from "../connectors/anthropic";
import { agentsFolder } from "../folders";
import { lookalikeResearcherPrompt } from "./lookalike-researcher.prompt";

// Reads one customer row and returns the companies that look like that
// customer did when they bought: an AI Ark lookalike search on the customer's
// domain, confirmed and ranked with web research against the rubric in the
// workspace context.
//
// The exclusions arrive in the prompt, from the play: every customer domain
// and every company already found for this one. Without them the same five
// come back every month and the pipeline re-pays to judge companies it has
// already judged.
//
// It returns candidates and writes nothing. The play scores, gates and
// records each one, so a company the researcher liked is still only a
// candidate.
export const lookalikeResearcher = defineAgent("lookalike_researcher", {
  name: "Lookalike researcher",
  description:
    "Reads one customer row and returns lookalike companies: an AI Ark lookalike search on the customer's domain, confirmed and ranked with web research against the lookalike rubric. JSON only.",
  color: "yellow",
  connector: anthropic,
  languageModel: "claude-sonnet-5", // PLACEHOLDER: your model of choice
  temperature: 0.2,
  // The loop budget: each step is an LLM call and maybe a search. One AI Ark
  // search, a handful of confirmations, then the answer. The pilot shows
  // whether the five can be confirmed in fewer.
  maxSteps: 14,
  systemPrompt: lookalikeResearcherPrompt,
  capabilities: [
    "webSearch",
    { slug: "context", config: { isReadOnly: true } },
  ],
  uses: [aiArk.actions.searchCompanies, aiArk.actions.countCompanies],
  output: {
    type: "jsonSchema",
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      required: ["seed_customer", "seed_domain", "seed_summary", "lookalikes"],
      properties: {
        seed_customer: { type: "string" },
        seed_domain: { type: "string" },
        seed_summary: { type: "string" },
        lookalikes: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "company",
              "domain",
              "linkedin_url",
              "why_similar",
              "evidence_urls",
            ],
            properties: {
              company: { type: "string" },
              domain: { type: "string" },
              linkedin_url: { type: "string" },
              why_similar: { type: "string" },
              evidence_urls: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    },
  },
  folder: agentsFolder,
});
