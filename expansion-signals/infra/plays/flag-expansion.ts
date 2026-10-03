import { definePlay, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { expansionAnalyst } from "../agents/analyst";
import { hubspot } from "../connectors/hubspot";
import { playsFolder } from "../folders";
import { crmCompanies } from "../models/crm-companies";

// One customer in, one CRM write out. The analyst decides what moment the
// account is at; this workflow decides what may be written about it.
const flagCompany = defineWorkflow(
  "flag_expansion_company",
  {
    input: z.object({
      hs_object_id: z.string(),
      name: z.string().optional(),
      domain: z.string().optional(),
      recent_deal_close_date: z.any(),
      recent_deal_amount: z.any(),
      num_associated_deals: z.any(),
    }),
    output: z.object({
      status: z.literal("written"),
      signal: z.string(),
    }),
    uses: { expansionAnalyst, hubspot },
  },
  ({ input, uses }) => {
    const judgment = uses.expansionAnalyst({
      prompt: `Judge the expansion moment for customer ${input.name} (${input.domain}), HubSpot company id ${input.hs_object_id}. Its most recent deal closed on ${input.recent_deal_close_date} for ${input.recent_deal_amount}; it has ${input.num_associated_deals} associated deals.`,
    });

    // The only CRM write in the pipeline, on the company record id itself, and
    // only on Cargo's own three properties. The signal and the reason are the
    // judgment; the stamp is bookkeeping that keeps the play from re-judging
    // the same renewal window. No deal, contact or owner is touched.
    uses.hubspot.updateRecords({
      objectType: "companies",
      matchingPropertyName: "hs_object_id",
      matchingValue: input.hs_object_id,
      mappings: [
        {
          propertyName: "cargo_expansion_signal",
          value: judgment.answer.signal,
        },
        {
          propertyName: "cargo_expansion_reason",
          value: `${judgment.answer.reason} Play: ${judgment.answer.suggested_play} Sources: ${judgment.answer.evidence_urls}`,
        },
        { propertyName: "cargo_expansion_signal_at", value: new Date() },
      ],
    });

    return { status: "written" as const, signal: judgment.answer.signal };
  },
);

// Who is judged, asked here and nowhere else:
//   - a customer (`lifecyclestage` is `customer`),
//   - whose most recent deal closed between ten and twelve months ago, which
//     for an annual contract is the sixty days before the renewal,
//   - and who has not been flagged in the last sixty days, so one renewal
//     window produces one judgment, not eight weekly ones.
//
// The window is the one number most teams change: a monthly or two-year
// contract moves both dates. Disabled until the pilot is approved.
export const flagExpansion = definePlay("flag_expansion", {
  folder: playsFolder,
  model: crmCompanies,
  workflow: flagCompany,
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "and",
        conditions: [
          {
            kind: "string",
            columnSlug: crmCompanies.columns.lifecyclestage,
            operator: "is",
            values: ["customer"],
          },
          {
            kind: "date",
            columnSlug: crmCompanies.columns.recent_deal_close_date,
            operator: "lowerThan",
            value: "10 months",
          },
          {
            kind: "date",
            columnSlug: crmCompanies.columns.recent_deal_close_date,
            operator: "greaterThan",
            value: "12 months",
          },
        ],
      },
      {
        conjonction: "or",
        conditions: [
          {
            kind: "date",
            columnSlug: crmCompanies.columns.cargo_expansion_signal_at,
            operator: "isNull",
          },
          {
            kind: "date",
            columnSlug: crmCompanies.columns.cargo_expansion_signal_at,
            operator: "lowerThan",
            value: "60 days",
          },
        ],
      },
    ],
  },
  isEnabled: false,
  runCreationRule: "noConcurrency",
  changeKinds: ["added"],
  // Monday 06:00 UTC. The digest runs at 15:00 the same day.
  schedule: { type: "cron", cron: "0 6 * * 1" },
});
