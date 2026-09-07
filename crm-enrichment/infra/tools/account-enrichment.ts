import { defineTool, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { linkedin } from "../connectors/linkedin";
import { toolsFolder } from "../folders/crm-enrichment";

// Normalize an identifier, make at most one paid call, return company data.
// There is no CRM connector here on purpose: a tool that writes to a CRM is a
// tool nobody can reuse, and the write policy belongs to the play that owns it.
const enrichCompanyData = defineWorkflow(
  "account_enrichment_workflow",
  {
    input: z.object({
      linkedinUrlOrHandle: z.string().optional(),
      domain: z.string().optional(),
    }),
    output: z.object({
      company_id: z.string().optional(),
      company_name: z.string().optional(),
      domain: z.string().optional(),
      website: z.string().optional(),
      linkedin_url: z.string().optional(),
      employee_count: z.number().optional(),
    }),
    uses: { linkedin },
  },
  ({ input, uses }) => {
    // Keeps the tool safe when it is called outside the play. The play's
    // managed segment already excludes rows carrying neither identifier.
    if (!input.linkedinUrlOrHandle && !input.domain) {
      return {};
    }

    // LinkedIn first: it is the stronger identifier. A handle that already
    // reads as a URL is used as-is, anything else is prefixed.
    if (input.linkedinUrlOrHandle) {
      const result = uses.linkedin.enrichCompany({
        linkedinUrl: input.linkedinUrlOrHandle.startsWith("http")
          ? input.linkedinUrlOrHandle
          : `https://www.linkedin.com/company/${input.linkedinUrlOrHandle}`,
      });

      return {
        company_id: result.company_id,
        company_name: result.company_name,
        domain: result.domain,
        website: result.website,
        linkedin_url: result.linkedin_url,
        employee_count: result.employee_count,
      };
    }

    const result = uses.linkedin.enrichCompanyFromDomain({
      domain: input.domain,
    });

    return {
      company_id: result.company_id,
      company_name: result.company_name,
      domain: result.domain,
      website: result.website,
      linkedin_url: result.linkedin_url,
      employee_count: result.employee_count,
    };
  },
);

export const accountEnrichment = defineTool("account_enrichment", {
  folder: toolsFolder,
  workflow: enrichCompanyData,
  name: "Account enrichment",
  description:
    "Normalize a company identifier and return enriched company data without writing to a CRM.",
});
