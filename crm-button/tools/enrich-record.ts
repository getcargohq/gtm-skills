import { defineTool, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { cargoDb } from "../../base-gtm/connectors/cargo";
import { waterfall } from "../../base-gtm/connectors/waterfall";
import { hubspot } from "../../crm-sync/connectors/hubspot";

// The tool behind the button. A rep opens a company record in the CRM, clicks,
// and this runs for that exact record: enrich it, then write the result straight
// back onto the record they are looking at.
//
// The input schema IS the form. `recordId` is what the CRM passes in, so the
// button needs no configuration beyond the URL.
//
// Note the write-back at the end. A tool that enriches but does not write back
// is a demo: the rep clicks, sees a spinner, and then has to copy values by hand.
// The whole value is that the record they are staring at changes.
const enrichCrmRecord = defineWorkflow(
  "enrich-crm-record",
  {
    input: z.object({
      // PLACEHOLDER: the CRM passes the record id here. In HubSpot this is the
      // company's hs_object_id, surfaced to the button by the CRM card.
      recordId: z.string(),
    }),
    output: z.object({
      enriched: z.boolean(),
      summary: z.string(),
    }),
    uses: { hubspot, waterfall, cargoDb },
  },
  ({ input, uses, ai }) => {
    // Read the record the rep is looking at.
    const record = uses.hubspot.getRecord({
      objectType: "companies", // PLACEHOLDER: companies | contacts | deals
      id: input.recordId,
    });

    const domain = record.properties.domain;

    // Enrich it: firmographics and funding in one waterfall call.
    const company = uses.waterfall.enrichCompany(
      { domain: domain },
      { continueOnFailure: true },
    );

    // A one-paragraph brief the rep can actually read, rather than a wall of
    // fields. This is what makes the button feel like a colleague instead of a
    // data sync.
    const brief = ai(
      `Write a three-sentence brief for a sales rep about to open ${domain}. Cover what the company does, its size and stage, and the single most useful thing to know before a call. Ground every sentence in this data and never invent a fact: ${company}`,
    );

    // Write back to the record the rep is looking at. PLACEHOLDER: map these to
    // your own CRM properties (these must already exist in HubSpot).
    uses.hubspot.updateRecords({
      objectType: "companies",
      matchingPropertyName: "hs_object_id",
      matchingValue: input.recordId,
      mappings: [
        { propertyName: "industry", value: company.company.industry },
        {
          propertyName: "numberofemployees",
          value: company.company.employees_count,
        },
        { propertyName: "description", value: brief },
      ],
    });

    return { enriched: true, summary: brief as unknown as string };
  },
);

export const enrichRecord = defineTool("enrich-record", {
  workflow: enrichCrmRecord,
  description:
    "Enrich the CRM record a rep is looking at, and write the result back onto it.",
  emojiSlug: "sparkles",

  // What turns a tool into a button. The tool's input schema is served as a
  // public form; the CRM custom button points at that form's URL with the record
  // id filled in.
  //
  // See "Embed in CRM, step 5" in the docs for adding the button itself:
  // https://docs.getcargo.ai/tools/embed-in-crm#step-5-add-a-custom-button-to-your-accounts-interface
  publicForm: {
    isEnabled: true,
    // PLACEHOLDER: lock this to your CRM's origin. An empty or wildcard origin
    // list means anyone who finds the URL can run this tool against your
    // workspace, on your credits.
    allowedOrigins: ["https://app.hubspot.com"],
    spam: {
      // The form is reached from inside an authenticated CRM, so a captcha is
      // friction with no benefit. The origin allowlist is the real control.
      captchaProvider: null,
      captchaSiteKey: null,
      captchaSecret: null,
      minFillMillis: 0,
    },
    presentation: null,
  },
});
