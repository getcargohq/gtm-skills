import { defineAgent } from "@cargo-ai/cdk";

import { openai } from "../../base-gtm/connectors/openai";
import { agentsFolder } from "../../base-gtm/folders/gtm";

// The copywriter: research brief in, one short outreach email out. It leans on
// the context repo (positioning, plays — owned by gtm-knowledge-graph) for
// voice and rules rather than a giant system prompt.
export const copywriter = defineAgent("sdr-copywriter", {
  color: "blue",
  connector: openai,
  languageModel: "gpt-4o", // PLACEHOLDER — your model of choice
  systemPrompt: `You write first-touch outreach emails from an account research
brief. Follow the outreach rules in the workspace context (one true recent
fact, no more than 90 words, one clear ask). Output only the email body — no
subject, no signature.`,
  maxSteps: 6,
  // `context` (read-only) connects the agent to the outreach rules/positioning
  // in the workspace context repo — without it the systemPrompt's reference to
  // the workspace context has nothing to read.
  capabilities: ["memory", { slug: "context", config: { isReadOnly: true } }],
  folder: agentsFolder,
  evaluator: {
    rubric:
      "Is the email under 90 words, grounded in the brief, with exactly one ask?",
    threshold: 0.8,
  },
});
