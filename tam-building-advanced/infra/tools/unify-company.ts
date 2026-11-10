import { defineTool, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { linkedin } from "../connectors/linkedin";
import { toolsFolder } from "../folders";
import { tamUniverse } from "../models/tam-universe";
import { companyDomain } from "../scripts/company-domain";
import { linkedinCompanyUrl } from "../scripts/linkedin-company-url";
import { websiteDomain } from "../scripts/website-domain";
import { tamWriteCompany } from "./write-company";

// The one door into the TAM. Every source play calls it with whatever
// identifier its rows carry; it resolves the company to its LinkedIn page,
// reads it from there, and hands it to tam_write_company.
//
// The order matters for cost: a company the TAM already holds is recognised
// before anything is paid for. Sources run one after another, so most of the
// overlap is caught here and only the new companies are enriched.
const unifyCompany = defineWorkflow(
  "tam_unify_company_workflow",
  {
    input: z.object({
      source: z.enum(["sales_navigator", "ai_ark", "apollo", "exa"]),
      linkedin_url: z.string().optional(),
      domain: z.string().optional(),
    }),
    output: z.object({
      result: z.enum(["added", "merged", "unresolved"]),
      status: z.string().optional(),
    }),
    uses: { linkedin, tamWriteCompany },
    imports: { tamUniverse, linkedinCompanyUrl, websiteDomain, companyDomain },
  },
  ({ input, uses, model }) => {
    if (!input.linkedin_url && !input.domain) {
      return { result: "unresolved" as const };
    }

    // Seen before under the same LinkedIn page: no enrichment needed. The URL
    // is compared in one spelling, whatever the source wrote.
    if (input.linkedin_url) {
      const pageUrl = linkedinCompanyUrl({ url: input.linkedin_url });
      const seen = model.search<{ linkedin_company_id: string }>({
        modelUuid: tamUniverse.uuid,
        filter: {
          conjonction: "and",
          groups: [
            {
              conjonction: "and",
              conditions: [
                {
                  kind: "string",
                  columnSlug: "linkedin_url",
                  operator: "is",
                  values: [pageUrl],
                },
              ],
            },
          ],
        },
        limit: 1,
      });
      if (seen.length > 0) {
        model.update({
          modelUuid: tamUniverse.uuid,
          matchingColumnSlug: "linkedin_company_id",
          matchingValue: seen[0].linkedin_company_id,
          mappings: [
            { columnSlug: `found_by_${input.source}`, value: true },
            { columnSlug: "last_seen_at", value: new Date() },
          ],
        });
        return { result: "merged" as const };
      }

      // LinkedIn first: it is the stronger identifier, and it returns the
      // numeric company id the TAM is keyed on.
      const company = uses.linkedin.enrichCompany({ linkedinUrl: pageUrl });
      if (!company.company_id) {
        return { result: "unresolved" as const };
      }
      const domain = companyDomain({
        linkedinDomain: company.domain,
        linkedinWebsite: company.website,
        sourceDomain: input.domain,
      });
      const written = uses.tamWriteCompany({
        source: input.source,
        linkedin_company_id: company.company_id,
        linkedin_url: linkedinCompanyUrl({ url: company.linkedin_url }),
        name: company.company_name,
        domain: domain,
        website: company.website,
        hq_country: company.hq_country,
        hq_city: company.hq_city,
        employee_count: company.employee_count,
        linkedin_industry: company.industries[0],
        description: company.description,
      });
      return { result: written.result, status: written.status };
    }

    // A website only (Exa). Seen before under the same domain, in one
    // spelling?
    const bareDomain = websiteDomain({ url: input.domain });
    const seenDomain = model.search<{ linkedin_company_id: string }>({
      modelUuid: tamUniverse.uuid,
      filter: {
        conjonction: "and",
        groups: [
          {
            conjonction: "and",
            conditions: [
              {
                kind: "string",
                columnSlug: "domain",
                operator: "is",
                values: [bareDomain],
              },
            ],
          },
        ],
      },
      limit: 1,
    });
    if (seenDomain.length > 0) {
      model.update({
        modelUuid: tamUniverse.uuid,
        matchingColumnSlug: "linkedin_company_id",
        matchingValue: seenDomain[0].linkedin_company_id,
        mappings: [
          { columnSlug: `found_by_${input.source}`, value: true },
          { columnSlug: "last_seen_at", value: new Date() },
        ],
      });
      return { result: "merged" as const };
    }

    const companyFromDomain = uses.linkedin.enrichCompanyFromDomain({
      domain: bareDomain,
    });
    if (!companyFromDomain.company_id) {
      return { result: "unresolved" as const };
    }
    const domainFromDomain = companyDomain({
      linkedinDomain: companyFromDomain.domain,
      linkedinWebsite: companyFromDomain.website,
      sourceDomain: bareDomain,
    });
    const writtenFromDomain = uses.tamWriteCompany({
      source: input.source,
      linkedin_company_id: companyFromDomain.company_id,
      linkedin_url: linkedinCompanyUrl({ url: companyFromDomain.linkedin_url }),
      name: companyFromDomain.company_name,
      domain: domainFromDomain,
      website: companyFromDomain.website,
      hq_country: companyFromDomain.hq_country,
      hq_city: companyFromDomain.hq_city,
      employee_count: companyFromDomain.employee_count,
      linkedin_industry: companyFromDomain.industries[0],
      description: companyFromDomain.description,
    });
    return {
      result: writtenFromDomain.result,
      status: writtenFromDomain.status,
    };
  },
);

export const tamUnifyCompany = defineTool("tam_unify_company", {
  folder: toolsFolder,
  workflow: unifyCompany,
  name: "TAM: unify company",
  description:
    "Resolve a company found by any source to its LinkedIn page, skip it if the TAM already holds it, and otherwise read it from LinkedIn and write it into tam_universe.",
});
