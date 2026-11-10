import { defineTool, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { toolsFolder } from "../folders";
import { gtmAccounts } from "../models/gtm-accounts";
import { tamUniverse } from "../models/tam-universe";
import { judgeCompany } from "../scripts/judge-company";
import {
  inScopeCategories,
  outOfScopeCategories,
  unknownCategory,
} from "../settings";

// The options the classifier picks from: your categories, then what a company
// can be instead. Built here because a workflow body cannot map an array.
const categoryOptions = [
  ...inScopeCategories,
  ...outOfScopeCategories,
  unknownCategory,
].map((option) => ({ option }));

// One resolved company in, one row of the TAM out. The company already went
// through LinkedIn (tam_unify_company), so every field below means the same
// thing whichever source found it.
const writeCompany = defineWorkflow(
  "tam_write_company_workflow",
  {
    input: z.object({
      source: z.enum(["sales_navigator", "ai_ark", "apollo", "exa"]),
      linkedin_company_id: z.string(),
      linkedin_url: z.string().optional(),
      name: z.string().optional(),
      domain: z.string().optional(),
      website: z.string().optional(),
      hq_country: z.string().optional(),
      hq_city: z.string().optional(),
      employee_count: z.number().optional(),
      linkedin_industry: z.string().optional(),
      description: z.string().optional(),
    }),
    output: z.object({
      result: z.enum(["added", "merged"]),
      status: z.string().optional(),
    }),
    imports: { tamUniverse, gtmAccounts, categoryOptions, judgeCompany },
  },
  ({ input, model, classify }) => {
    // Already in the TAM under this LinkedIn id: another source found it
    // first. Record that this one did too, and stop. The overlap is kept, not
    // thrown away: how many sources found a company is a fit signal.
    const known = model.search<{ linkedin_company_id: string }>({
      modelUuid: tamUniverse.uuid,
      filter: {
        conjonction: "and",
        groups: [
          {
            conjonction: "and",
            conditions: [
              {
                kind: "string",
                columnSlug: "linkedin_company_id",
                operator: "is",
                values: [input.linkedin_company_id],
              },
            ],
          },
        ],
      },
      limit: 1,
    });
    if (known.length > 0) {
      model.update({
        modelUuid: tamUniverse.uuid,
        matchingColumnSlug: "linkedin_company_id",
        matchingValue: input.linkedin_company_id,
        mappings: [
          { columnSlug: `found_by_${input.source}`, value: true },
          { columnSlug: "last_seen_at", value: new Date() },
        ],
      });
      return { result: "merged" as const };
    }

    // Your categories, read from the company's own description, never from a
    // provider's industry label. One call answers both questions.
    const judged = classify({
      state: {
        name: input.name,
        website: input.website,
        linkedin_industry: input.linkedin_industry,
        description: input.description,
      },
      questions: [
        {
          type: "choice",
          id: "category",
          instructions:
            "Which category describes what this company sells and to whom? Judge from the description, not from the industry label. If the description is too thin to tell, pick Not enough information.",
          options: categoryOptions,
        },
        {
          type: "noul",
          id: "subsidiary",
          instructions:
            "Is this page a subsidiary, a regional or country page, or an acquired brand of a larger company, rather than an independent company?",
        },
      ],
    });

    const judgment = judgeCompany({
      category: judged.answers.category.choice,
      subsidiaryProbability: judged.answers.subsidiary.noul,
      employeeCount: input.employee_count,
      hqCountry: input.hq_country,
    });

    // Net new or already known: the CRM side of the report. Matched on the
    // domain, the one identifier every CRM holds.
    const inCrm = model.search<{ id: string }>({
      modelUuid: gtmAccounts.uuid,
      filter: {
        conjonction: "and",
        groups: [
          {
            conjonction: "and",
            conditions: [
              {
                kind: "string",
                columnSlug: "website",
                operator: "is",
                values: [input.domain],
              },
            ],
          },
        ],
      },
      limit: 1,
    });

    model.upsert({
      modelUuid: tamUniverse.uuid,
      matchingColumnSlug: "linkedin_company_id",
      matchingValue: input.linkedin_company_id,
      mappings: [
        { columnSlug: "linkedin_company_id", value: input.linkedin_company_id },
        { columnSlug: "linkedin_url", value: input.linkedin_url },
        { columnSlug: "name", value: input.name },
        { columnSlug: "domain", value: input.domain },
        { columnSlug: "website", value: input.website },
        { columnSlug: "hq_country", value: input.hq_country },
        { columnSlug: "hq_city", value: input.hq_city },
        { columnSlug: "employee_count", value: input.employee_count },
        { columnSlug: "linkedin_industry", value: input.linkedin_industry },
        { columnSlug: "description", value: input.description },
        { columnSlug: "category", value: judged.answers.category.choice },
        { columnSlug: "status", value: judgment.status },
        { columnSlug: "exclusion_reason", value: judgment.exclusionReason },
        { columnSlug: "in_crm", value: inCrm.length > 0 },
        {
          columnSlug: "crm_account_id",
          value: inCrm.length > 0 ? inCrm[0].id : "",
        },
        { columnSlug: `found_by_${input.source}`, value: true },
        { columnSlug: "first_source", value: input.source },
        { columnSlug: "first_seen_at", value: new Date() },
        { columnSlug: "last_seen_at", value: new Date() },
      ],
    });

    return { result: "added" as const, status: judgment.status };
  },
);

export const tamWriteCompany = defineTool("tam_write_company", {
  folder: toolsFolder,
  workflow: writeCompany,
  name: "TAM: write company",
  description:
    "Classify a resolved company into your categories, apply the ICP gates, mark it in the CRM or net new, and add it to tam_universe, or record that one more source found it.",
});
