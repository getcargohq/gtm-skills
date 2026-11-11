import { defineAgent } from "@cargo-ai/cdk";

import { anthropic } from "../connectors/anthropic";
import { agentsFolder } from "../folders";

// The scoring agent: it reads the fit model in the workspace context and
// explains a grade the code already computed, in two sentences a rep can act
// on. It never sets the grade.
//
// Why the grade is not the agent's: on the same stored inputs, a language
// model scoring a rubric changed the tier of 23 of 100 companies between two
// runs, and applied cut-offs written for one total to another. Code does not.
// So `compute_fit` computes, `score_account` writes what it computed, and this
// agent's output reaches only the reason column.
//
// `context` (read-only) is what lets it say WHY an attribute matters: the
// "Why each attribute" section of scoring.md is the reasoning the scoring pass
// wrote with its evidence. No webSearch: everything it may say is in the
// prompt or in that file, and a search would let it add facts the grade was
// not computed from. No model in `uses`: it cannot write.
export const scoringAgent = defineAgent("account_scoring_agent", {
  color: "green",
  connector: anthropic,
  languageModel: "claude-sonnet-5", // PLACEHOLDER: your model of choice
  systemPrompt: [
    "You explain account fit grades for a B2B seller.",
    "The grade and the score in the prompt were computed by code from the scoring model; you never change them, re-grade the company, or add or remove points.",
    "Read the scoring model in the workspace context (the scoring.md file under icp/): its 'Why each attribute' section says why each attribute matters.",
    "Write at most two sentences for a sales rep: what put the company in its grade, naming the two or three attributes that gave the most points, or the No Fit filter that fired, in plain words; then, if an attribute was unknown, the one whose value would most change the grade.",
    "Use only the values in the prompt and the reasoning in the scoring model. Never cite a number the breakdown does not hold, and never invent a fact about the company.",
  ].join(" "),
  output: {
    type: "jsonSchema",
    jsonSchema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description:
            "At most two sentences for a rep, naming the attributes that decided the grade.",
        },
      },
      required: ["reason"],
      additionalProperties: false,
    },
  },
  // Read the model, answer. Three steps leave room for one retry of the read.
  maxSteps: 3,
  capabilities: [{ slug: "context", config: { isReadOnly: true } }],
  // The QA gate: a reason that contradicts the grade, or credits an attribute
  // that scored nothing, fails.
  evaluator: {
    rubric:
      "Does the reason agree with the computed grade, name attributes that carry points in the breakdown (or the filter that fired), and avoid any fact or number that is not in the prompt or the scoring model?",
    threshold: 0.8,
  },
  folder: agentsFolder,
});
