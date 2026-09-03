import { defineAgent } from "@cargo-ai/cdk";

import { cargoDb } from "../connectors/cargo";
import { openai } from "../connectors/openai";
import { agentsFolder } from "../folders/account-scoring";

// The scorer: an agent instead of point weights. The scoring criteria are the
// ICP files in the context repo (gtm-knowledge-graph) — versioned in git, no
// weights in code — and the agent pulls its own evidence from Cargo's
// business database before judging. The evaluator is the QA gate: a score
// without grounded rationale fails the rubric.
export const accountScorer = defineAgent("account-scorer", {
  color: "green",
  connector: openai,
  languageModel: "gpt-4o", // PLACEHOLDER — your model of choice
  systemPrompt: `You score accounts against the ICP defined in the workspace
context (icp.md and related files). Look up the account in the Cargo business
database first; never score on the domain name alone. Respond with ONLY a JSON
object: {"score": <0-100>, "tier": "A"|"B"|"C", "rationale": "<2 sentences
citing the evidence and the ICP criteria applied>"}. Disqualifiers in the ICP
cap the score at 20.`,
  output: {
    type: "jsonSchema",
    jsonSchema: {
      type: "object",
      properties: {
        score: { type: "integer", minimum: 0, maximum: 100 },
        tier: { type: "string", enum: ["A", "B", "C"] },
        rationale: {
          type: "string",
          description:
            "2 sentences citing the evidence and the ICP criteria applied",
        },
      },
      required: ["score", "tier", "rationale"],
      additionalProperties: false,
    },
  },
  maxSteps: 8,
  // `context` (read-only) is what actually connects the agent to the ICP files
  // in the workspace context repo — without it the systemPrompt's reference to
  // icp.md has nothing to read.
  //
  // This skill declares no `defineContext` of its own. That resource is a
  // per-workspace singleton owned by the project (a scaffolded repo points it
  // at the root `context/`), so a copy here would collide at deploy — and one
  // nested under `infra/` would plan green while syncing markdown the humans
  // who curate the knowledge layer never see.
  capabilities: ["memory", { slug: "context", config: { isReadOnly: true } }],
  uses: [
    cargoDb.actions.matchBusiness,
    cargoDb.actions.enrichBusinessFirmographics,
  ],
  folder: agentsFolder,
});
