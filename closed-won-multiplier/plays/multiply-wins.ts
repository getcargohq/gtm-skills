import { definePlay, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { cargoDb } from "../../base-gtm/connectors/cargo";
import { accounts } from "../../base-gtm/models/accounts";
import { deals } from "../../pipeline-health/models/deals";
import { linkedin } from "../../base-gtm/connectors/linkedin";

// Turn one won deal into net-new lookalike accounts.
//
// The order of operations is the whole cookbook, and the dedupe is the step
// people skip. Sourcing lookalikes is easy; sourcing lookalikes that are ALREADY
// in your CRM is worse than useless, because it hands reps a list of accounts
// their colleagues are already working and teaches them not to trust the list.
//
// So: profile the win, source lookalikes, then check every candidate against the
// account universe BEFORE creating anything. Only genuinely net-new companies get
// written, and each one is tagged with the win it mirrors, so a rep can always
// answer "why is this account in my list?".
const multiplyWin = defineWorkflow(
  "multiply-won-account",
  {
    input: z.object({
      name: z.string(),
      account_id: z.any(),
    }),
    output: z.object({ sourced: z.boolean() }),
    uses: { linkedin, cargoDb },
  },
  ({ input, uses, model }) => {
    // The won account itself: we need its LinkedIn page to find its neighbours.
    const wonAccount = model.search<{
      name: string;
      website: string;
      linkedin_url: string;
    }>({
      modelUuid: accounts.uuid as unknown as string,
      filter: {
        conjonction: "and",
        groups: [
          {
            conjonction: "and",
            conditions: [
              {
                kind: "string",
                columnSlug: accounts.columns.id,
                operator: "is",
                values: [input.account_id],
              },
            ],
          },
        ],
      },
      limit: 1,
    });

    const seed = wonAccount[0];

    // Lookalikes of the won account. Credits-based, no key.
    //
    // The cast is the bridge between the typed Ref the SDK returns and the
    // for-of below: workflow bodies are parsed rather than executed, so the loop
    // lowers to a real loop node either way, but TypeScript will not iterate a
    // Ref array without it.
    const similar = uses.linkedin.extractSimilarCompanies(
      { linkedinUrl: seed.linkedin_url },
      { continueOnFailure: true },
    ) as unknown as Array<{
      company_name: string;
      linkedin_company_url: string;
    }>;

    // PLACEHOLDER: the volume cap per win. Cap the candidate list up front so
    // the credited match + enrich calls per win stay bounded no matter how many
    // lookalikes LinkedIn returns.
    for (const candidate of similar.slice(0, 25)) {
      // Resolve the candidate to a real business record and a domain: a
      // lookalike without a domain cannot be deduped, and an account that
      // cannot be deduped will fork into duplicates.
      const match = uses.cargoDb.matchBusiness(
        { name: candidate.company_name },
        { continueOnFailure: true },
      );
      if (match.business_id) {
        const firmographics = uses.cargoDb.enrichBusinessFirmographics(
          { business_id: match.business_id },
          { continueOnFailure: true },
        );
        if (firmographics.website) {
          // THE DEDUPE. Anything already in the account universe is skipped,
          // whether it came from the CRM, a previous run of this play, or
          // another sourcing cookbook. This is what keeps the output net-new.
          const existing = model.search({
            modelUuid: accounts.uuid as unknown as string,
            filter: {
              conjonction: "and",
              groups: [
                {
                  conjonction: "and",
                  conditions: [
                    {
                      kind: "string",
                      columnSlug: accounts.columns.website,
                      operator: "is",
                      values: [firmographics.website],
                    },
                  ],
                },
              ],
            },
            limit: 1,
          });

          if (existing.length === 0) {
            model.insert({
              modelUuid: accounts.uuid as unknown as string,
              mappings: [
                {
                  columnSlug: accounts.columns.website,
                  value: firmographics.website,
                },
                {
                  columnSlug: accounts.columns.name,
                  value: firmographics.name,
                },
                {
                  columnSlug: accounts.columns.industry,
                  value: firmographics.linkedin_industry_category,
                },
                {
                  columnSlug: accounts.columns.description,
                  value: firmographics.business_description,
                },
                {
                  columnSlug: accounts.columns.linkedin_url,
                  value: firmographics.linkedin_profile,
                },
                // The traceability tag: every sourced account can answer
                // "which win put me here?".
                {
                  columnSlug: accounts.columns.custom__lookalike_of,
                  value: seed.name,
                },
                {
                  columnSlug: accounts.columns.custom__cargo_last_updated_at,
                  value: new Date(),
                },
              ],
            });
          }
        }
      }
    }

    return { sourced: true };
  },
);

// Fires when a deal is won. A win is the trigger, which is the point: the moment
// you learn what a good customer looks like is the moment to go find more.
export const multiplyWins = definePlay("multiply-wins", {
  model: deals,
  workflow: multiplyWin,
  changeKinds: ["added", "updated"],
  runCreationRule: "always",
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "and",
        conditions: [
          {
            kind: "boolean",
            columnSlug: deals.columns.is_won,
            operator: "isTrue",
          },
        ],
      },
    ],
  },
  schedule: { type: "watch" },
});
