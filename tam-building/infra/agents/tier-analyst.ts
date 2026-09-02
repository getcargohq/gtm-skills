import { defineAgent } from "@cargo-ai/cdk";

import { anthropic } from "../connectors/anthropic";
import { agentsFolder } from "../folders/tam-building";

// The tiering agent: one judgment per sourced company.
//
// An agent instead of point weights, because the question is not arithmetic.
// "Does this company already run a technical GTM motion" is answered by an
// open role, a changelog, or an engineering post, and no column in the sourced
// row holds it. Anything the sourced firmographics DO settle (headcount band,
// industry) belongs in the model's filter, where it costs nothing to apply.
//
// Two capabilities do the work named in this skill:
//   - `context` (read-only) is what connects the agent to the rubric. Without
//     it the system prompt's reference to tiering-rubric.md reads nothing, and
//     the agent invents a rubric that looks plausible for every account.
//   - `webSearch` is how a thin row becomes a decidable one. It is for
//     resolving a stated doubt, never for filling in a firmographic the search
//     did not return.
//
// The rubric is deliberately NOT in this prompt. It lives in
// ../context/tiering-rubric.md so that changing what tier A means is a
// reviewed commit rather than a deploy, and so a rep can read the same file the
// agent read. The prompt says how to behave; the rubric says what to decide.
//
// No writable model in `uses`, and none should be added. The agent hands back a
// judgment and the play persists it. An agent that can write decides its own
// routing, and then a null tier is indistinguishable from a bad judgment.
export const tierAnalyst = defineAgent("tam-tier-analyst", {
  color: "green",
  connector: anthropic,
  languageModel: "claude-sonnet-5", // PLACEHOLDER — your model of choice
  systemPrompt: [
    "You tier sourced companies for a B2B seller against that seller's own ICP.",
    "Read icp.md and tiering-rubric.md from the workspace context before every judgment. They are the rubric; nothing in this prompt overrides them.",
    "Judge on the supplied firmographics first. If they settle the tier under the rubric, settle it and stop.",
    "Use web search only to resolve one specific doubt that would change the tier, and record the page you used. Never invent a firmographic: an absent fact is an absent fact, and the rubric says how to tier without it.",
    "A disqualifier in the ICP ends the evaluation at 'disqualified'. It is never a lower tier.",
    "Return the judgment only. The play persists it and routes it; you do not write to any model.",
    "Answer in the exact JSON shape requested: the tier, a two-sentence rationale naming the rubric lines that decided it, and the evidence URL when a search decided it.",
  ].join(" "),
  output: {
    type: "jsonSchema",
    jsonSchema: {
      type: "object",
      properties: {
        tier: {
          type: "string",
          enum: ["A", "B", "C", "disqualified"],
          description: "The tier from tiering-rubric.md.",
        },
        rationale: {
          type: "string",
          description:
            "Two sentences naming the rubric lines that decided the tier and the evidence behind them.",
        },
        evidence_url: {
          type: "string",
          description:
            "The page a web search verified against, or an empty string when the sourced facts alone decided it.",
        },
      },
      required: ["tier", "rationale", "evidence_url"],
      additionalProperties: false,
    },
  },
  // The loop budget. Each step is an LLM call and possibly a search, so this is
  // the per-company ceiling on what a judgment can cost. The rubric's
  // one-question-one-search rule is what keeps a normal row far under it.
  maxSteps: 8,
  capabilities: [
    "webSearch",
    "memory",
    { slug: "context", config: { isReadOnly: true } },
  ],
  // The QA gate. A tier with no grounded rationale fails, which is what stops
  // the book filling with confident nulls that read as judgments.
  evaluator: {
    rubric:
      "Did it tier against the rubric in the workspace context, with a tier the rubric defines, a two-sentence rationale naming the deciding lines, and either verified evidence or an explicit statement that the sourced facts settled it?",
    threshold: 0.8,
  },
  folder: agentsFolder,
});
