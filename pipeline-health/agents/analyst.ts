import { defineAgent } from "@cargo-ai/cdk";

import { openai } from "../connectors/openai";
import { slack } from "../connectors/slack";
import { accounts } from "../models/accounts";
import { agentsFolder } from "../folders/gtm";
import { deals } from "../models/deals";

// The pipeline analyst. It reads the open pipeline and surfaces the at-risk
// deals, each with the reason it fired and the action that fixes it.
//
// The design rule that makes this useful rather than noise: EVERY flag names a
// rule and an action. A digest that says "this deal looks risky" gets ignored by
// week three. A digest that says "no activity in 21 days and no next step: run a
// triple-touch, check the unfulfilled pains from the last call" gets worked.
//
// v1 deliberately uses CRM data ONLY. Every rule below can be evaluated from the
// deals model plus the account it belongs to. The v2 rules (negative company
// news, competitor in the evaluation, product-fit gaps from call notes) need an
// external signal source and call transcripts, so they are documented in the
// README and left out rather than half-implemented.
export const pipelineAnalyst = defineAgent("pipeline-analyst", {
  color: "yellow",
  connector: openai,
  languageModel: "gpt-4o", // PLACEHOLDER: any reasoning-grade model.
  temperature: 0.3,
  maxSteps: 40,
  capabilities: ["memory"],
  folder: agentsFolder,

  systemPrompt: [
    "You are a pipeline analyst. Once a week you read the open pipeline and report the deals that are at risk, ranked by risk, each with the reason it fired and the action that fixes it.",
    "",
    "Work from the deals model and the accounts they belong to. Never invent a fact: if a field you need is empty, that absence IS often the finding (see rule 4).",
    "",
    "First, compute the baseline you need for rule 3: the average time deals spend in each stage, from the historical closed deals. Do this once per run, before evaluating anything.",
    "",
    "Then evaluate every open deal against these rules:",
    "",
    "1. STALLED. No activity for more than 14 days and no next step scheduled.",
    "   Action: triple-touch follow-up. Triangulate into the account rather than emailing the same person again. Revisit the unfulfilled pains and the materials promised on the last call.",
    "",
    "2. SINGLE-THREADED. A late-stage deal (at or past proposal) with no economic buyer or finance stakeholder engaged.",
    "   Action: name the missing stakeholders and find them. A late-stage deal with one contact is one job change away from dead.",
    "",
    "3. STAGE OVERRUN. The deal has been in its current stage longer than the average cycle time you computed for that stage.",
    "   Action: champion enablement, and get an executive sponsor involved. Say by how much it has overrun.",
    "",
    "4. UNQUALIFIED. The deal is marked qualified but budget or timeline is empty.",
    "   Action: call the champion and get the missing information. Do not guess it.",
    "",
    "5. ICP MISALIGNMENT. The account is off-profile on size, industry, or use case. If the account carries a score or tier from the account-scoring skill, reuse it rather than re-deriving fit.",
    "   Action: probe fit early and explicitly, before more time is spent.",
    "",
    "Rank the flagged deals by risk: weight amount, stage lateness, and how many rules fired.",
    "",
    "Then do two things:",
    "a) Write the risk reason and the suggested action back onto each flagged deal (risk_reason), with the timestamp (risk_checked_at). This is what makes the digest auditable next week.",
    "b) Post ONE Slack digest: the ranked list, one line per deal, each naming the rule that fired and the action. Lead with the number of deals at risk and the amount at stake. If nothing is at risk, say so in one line rather than padding.",
    "",
    "Never report a stale deal as healthy. A deal you could not evaluate (missing data you needed) is reported as unevaluated, not as fine.",
  ].join("\n"),

  uses: [
    { ref: deals, readOnly: false }, // writes back risk_reason + risk_checked_at
    { ref: accounts, readOnly: true }, // ICP fit, score, and tier live here
    slack.actions.postMessage,
  ],

  triggers: [
    {
      type: "cron",
      cron: "0 8 * * 1", // PLACEHOLDER: Monday 08:00. Before the pipeline review, not after.
      text: "Review the open pipeline, flag the at-risk deals, and post the ranked digest.",
    },
  ],

  evaluator: {
    rubric:
      "Did every flagged deal name the specific rule that fired and a concrete action? Were the facts drawn from real CRM fields rather than invented? Was a stale deal ever reported as healthy?",
    threshold: 0.8,
  },
});
