import { defineAgent } from "@cargo-ai/cdk";

import { anthropic } from "../connectors/anthropic";
import { agentsFolder } from "../folders";

// The researcher: one brief and one tier per new inbound contact.
//
// It researches the way research-account does (what the company does, what it
// publicly says is hard, who it competes with, each line traced to a page), cut
// to what an owner reads before replying to a demo request. Then it tiers the
// company against the ICP and the tiering rubric in the workspace context.
//
// Two capabilities do the work:
//   - `context` (read-only) connects it to the ICP and the rubric. Without it
//     the prompt's reference to them reads nothing, and the agent invents a
//     plausible ICP for every lead.
//   - `webSearch` is the research. It is capped by `maxSteps` and by the
//     prompt's search budget.
//
// A judge, not a writer. No CRM, no Slack and no writable model are in reach:
// the agent hands back JSON and the play decides what lands where. An agent
// that could write would decide its own routing, and a missing brief could
// then be a failed run, a skip or a choice.
export const researcher = defineAgent("inbound_researcher", {
  name: "Inbound researcher",
  description:
    "Researches a new inbound contact and their company, and tiers the company against the ICP and the tiering rubric.",
  color: "yellow",
  connector: anthropic,
  languageModel: "claude-sonnet-5", // PLACEHOLDER: your model of choice
  maxSteps: 10,
  systemPrompt: [
    "You brief the owner of a new inbound lead before anyone replies to them. You are handed the contact record and its account, if any; you research the person and the company, and you tier the company.",
    "Read the ICP and the account tiering rubric from the workspace context first. They are the rubric; nothing in this prompt overrides them.",
    "Research with at most four web searches: what the company does and for whom, one thing it publicly says is hard or is changing (a launch, a hire, a funding round, a stated priority), and the person's role there. Prefer the company's own site; record every page you rely on.",
    "Never invent a fact, a title or a URL. An absent fact is absent: say so and tier on what is known. A personal email domain (gmail.com and the like) means the company is unknown unless the record names it.",
    "A disqualifier in the ICP ends the evaluation at 'disqualified'. A competitor, a student, a job seeker or a vendor pitching us is 'disqualified', and the rationale says which.",
    "Return the judgment only, in the exact JSON shape requested. The brief is at most three sentences an owner can read in ten seconds: who they are, what their company does, and why they might be talking to us now.",
  ].join(" "),
  output: {
    type: "jsonSchema",
    jsonSchema: {
      type: "object",
      properties: {
        tier: {
          type: "string",
          enum: ["A", "B", "C", "disqualified"],
          description: "The tier from the tiering rubric.",
        },
        rationale: {
          type: "string",
          description:
            "Two sentences naming the rubric lines that decided the tier and the evidence behind them.",
        },
        brief: {
          type: "string",
          description:
            "At most three sentences: who they are, what the company does, why they might be talking to us now.",
        },
        evidence_urls: {
          type: "array",
          items: { type: "string" },
          description: "Every page the brief or the tier relied on.",
        },
      },
      required: ["tier", "rationale", "brief", "evidence_urls"],
      additionalProperties: false,
    },
  },
  capabilities: [
    "webSearch",
    { slug: "context", config: { isReadOnly: true } },
  ],
  // The QA gate. A tier with no grounded rationale, or a brief carrying a fact
  // no evidence URL supports, fails.
  evaluator: {
    rubric:
      "Did it tier against the rubric in the workspace context, with a tier the rubric defines and a rationale naming the deciding lines? Is every fact in the brief supported by the record or a listed evidence URL?",
    threshold: 0.8,
  },
  folder: agentsFolder,
});
