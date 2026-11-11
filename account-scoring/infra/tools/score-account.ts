import { defineTool, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { scoringAgent } from "../agents/scoring-agent";
import { crm } from "../connectors/crm";
import { toolsFolder } from "../folders";
import { tamCompanies } from "../models/tam-companies";
import { crmWriteback } from "../settings";
import { computeFit } from "./compute-fit";

// Step 2, end to end for one company: compute the grade, have the agent
// explain it, write both onto the row, and mirror them to the CRM when
// settings.ts asks for it. Both plays call this tool, the first one after the
// enrichment and the rescore on stored values, so a grade is written one way
// whichever path produced it.
//
// The write takes the grade, the score and the breakdown from `compute_fit`'s
// output, never from the agent's: the agent's answer reaches the reason column
// and nothing else.
const input = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string(),
  values: z.record(z.string(), z.unknown()),
});
const output = z.object({ grade: z.string(), score: z.number() });

// The CRM write-back settings, flattened into constants the CRM body inlines as
// literals. Unused when `crmWriteback.crm` is `none`. HubSpot's company object
// is `companies`; Salesforce's is `Account`.
const crmObjectType =
  crmWriteback.crm === "salesforce" ? "Account" : "companies";
const crmMatchOn =
  crmWriteback.crm === "none" ? "domain" : crmWriteback.matchOn;
const crmMatchProperty =
  crmWriteback.crm === "none" ? "" : crmWriteback.matchProperty;
const crmGradeField =
  crmWriteback.crm === "none" ? "" : crmWriteback.fields.grade;
const crmReasonField =
  crmWriteback.crm === "none" ? "" : crmWriteback.fields.reason;
const crmScoredAtField =
  crmWriteback.crm === "none" ? "" : crmWriteback.fields.scoredAt;

// Two bodies, one chosen by `crmWriteback` in `settings.ts` when the project
// loads: the row write alone, or the row write followed by one CRM update. The
// body is parsed from source rather than executed, so a CRM call cannot sit
// behind a runtime `if` on a connector that `none` never declares. Everything
// above the CRM update is identical in both: change one, change the other.
const scoreAccountWorkflow =
  crm === undefined || crmWriteback.crm === "none"
    ? defineWorkflow(
        "score_account_workflow",
        {
          input,
          output,
          uses: { computeFit, scoringAgent },
          // The body is parsed, not executed: a bare closure reference like
          // `tamCompanies` is a name the parser cannot resolve without this.
          imports: { tamCompanies },
        },
        ({ input, uses, model }) => {
          const fit = uses.computeFit({ values: input.values });

          const explanation = uses.scoringAgent({
            prompt: `Explain the fit grade of ${input.name} (${input.domain}). Grade: ${fit.grade}. Score: ${fit.score} of 100. No Fit filters that fired: ${fit.filtered_by}. Breakdown: ${fit.breakdown}. Unknown attributes: ${fit.unknown_count}. Model version: ${fit.model_version}.`,
          });

          // Bare slugs, NOT the `custom__` names the read side exposes: the
          // write path nests the declared slug under `custom` itself, so
          // `custom__fit_grade` here becomes `custom.custom__fit_grade`, the
          // node still reports "Record upserted" and the value is dropped.
          // The grade, its reason and the stamp go on the same write, so a row
          // is never marked scored without carrying the grade.
          model.customColumn({
            modelUuid: tamCompanies.uuid,
            id: input.id,
            mappings: [
              { columnSlug: "fit_grade", value: fit.grade },
              { columnSlug: "fit_score", value: fit.score },
              { columnSlug: "fit_breakdown", value: fit.breakdown },
              { columnSlug: "fit_reason", value: explanation.answer.reason },
              { columnSlug: "fit_model_version", value: fit.model_version },
              { columnSlug: "scored_at", value: new Date() },
            ],
          });

          return { grade: fit.grade, score: fit.score };
        },
      )
    : defineWorkflow(
        "score_account_workflow",
        {
          input,
          output,
          uses: { computeFit, scoringAgent, crm },
          imports: {
            tamCompanies,
            crmObjectType,
            crmMatchOn,
            crmMatchProperty,
            crmGradeField,
            crmReasonField,
            crmScoredAtField,
          },
        },
        ({ input, uses, model }) => {
          const fit = uses.computeFit({ values: input.values });

          const explanation = uses.scoringAgent({
            prompt: `Explain the fit grade of ${input.name} (${input.domain}). Grade: ${fit.grade}. Score: ${fit.score} of 100. No Fit filters that fired: ${fit.filtered_by}. Breakdown: ${fit.breakdown}. Unknown attributes: ${fit.unknown_count}. Model version: ${fit.model_version}.`,
          });

          model.customColumn({
            modelUuid: tamCompanies.uuid,
            id: input.id,
            mappings: [
              { columnSlug: "fit_grade", value: fit.grade },
              { columnSlug: "fit_score", value: fit.score },
              { columnSlug: "fit_breakdown", value: fit.breakdown },
              { columnSlug: "fit_reason", value: explanation.answer.reason },
              { columnSlug: "fit_model_version", value: fit.model_version },
              { columnSlug: "scored_at", value: new Date() },
            ],
          });

          // The CRM mirror, after the row is written, so the row stays the
          // record of the grade whatever the CRM does. Guarded on a match
          // value: an empty domain would otherwise ask the CRM for every
          // company with an empty domain.
          //
          // `updateRecords`, never `upsertRecords`: a company the CRM does not
          // hold is not created from a TAM row. `continueOnFailure` lets that
          // miss end the run as a success, because most of a sourced TAM is
          // not in the CRM yet; the cost is that a CRM write failing for
          // another reason also ends green, so the pilot reads one record
          // back from the CRM (references/run.md).
          //
          // `isFailingOnMultipleMatches: true`: when the match value finds
          // several CRM companies (duplicates sharing a domain), the update
          // writes nothing and fails instead of grading every one of them.
          if (input[crmMatchOn]) {
            uses.crm.updateRecords(
              {
                objectType: crmObjectType,
                matchingPropertyName: crmMatchProperty,
                matchingValue: input[crmMatchOn],
                isFailingOnMultipleMatches: true,
                mappings: [
                  { propertyName: crmGradeField, value: fit.grade },
                  {
                    propertyName: crmReasonField,
                    value: explanation.answer.reason,
                  },
                  { propertyName: crmScoredAtField, value: new Date() },
                ],
              },
              { continueOnFailure: true },
            );
          }

          return { grade: fit.grade, score: fit.score };
        },
      );

export const scoreAccount = defineTool("score_account", {
  folder: toolsFolder,
  workflow: scoreAccountWorkflow,
  name: "Score account",
  description:
    "Computes one company's fit grade from its attribute values, has the scoring agent explain it, and writes grade, score, breakdown, reason, model version and stamp onto the row (and the CRM when write-back is set).",
});
