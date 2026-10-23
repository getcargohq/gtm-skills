import { defineAgent } from "@cargo-ai/cdk";

import { aiArk } from "../connectors/ai-ark";
import { anthropic } from "../connectors/anthropic";
import { agentsFolder } from "../folders";
import { contactFinderPrompt } from "./contact-finder.prompt";

// Finds the one person to write to at a company that passed the account gate,
// aimed at the function nobody owns, and returns their work email from AI
// Ark. One search, one enrichment: an enrichment costs only when it finds an
// email, so the agent is told never to enrich someone it would not write to.
//
// The email it returns is not trusted yet. The play verifies it before the
// person can qualify.
export const contactFinder = defineAgent("contact_finder", {
  name: "Contact finder",
  description:
    "Finds the one person to write to at a qualified company, by the missing function and the persona tiers in the lookalike rubric, and returns their work email from AI Ark. JSON only.",
  color: "green",
  connector: anthropic,
  languageModel: "claude-sonnet-5", // PLACEHOLDER: your model of choice; a smaller one is often enough
  temperature: 0,
  maxSteps: 8,
  systemPrompt: contactFinderPrompt,
  capabilities: [{ slug: "context", config: { isReadOnly: true } }],
  uses: [aiArk.actions.searchPeople, aiArk.actions.enrichPerson],
  output: {
    type: "jsonSchema",
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      required: [
        "found",
        "first_name",
        "last_name",
        "title",
        "linkedin_url",
        "email",
        "persona_tier",
        "function",
        "why",
        "started_role_on",
      ],
      properties: {
        found: { type: "boolean" },
        first_name: { type: "string" },
        last_name: { type: "string" },
        title: { type: "string" },
        linkedin_url: { type: "string" },
        email: { type: "string" },
        persona_tier: {
          type: "string",
          enum: ["1", "2", "3", "review", "reject"],
        },
        function: { type: "string" },
        why: { type: "string" },
        started_role_on: { type: "string" },
      },
    },
  },
  folder: agentsFolder,
});
