import { defineTool, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { linkedin } from "../connectors/linkedin";
import { toolsFolder } from "../folders/crm-enrichment";

// Enrich a known LinkedIn profile without CRM access. Identifier resolution
// stays visible in the play through the two Cargo-native tools.
const enrichContactFromLinkedin = defineWorkflow(
  "contact_linkedin_enrichment_workflow",
  {
    input: z.object({
      linkedinUrl: z.string().optional(),
    }),
    output: z.object({
      person_id: z.string().optional(),
      job_title: z.string().optional(),
      linkedin_url: z.string().optional(),
    }),
    uses: { linkedin },
  },
  ({ input, uses }) => {
    if (!input.linkedinUrl) {
      return {};
    }

    const profileUrl = input.linkedinUrl.startsWith("http")
      ? input.linkedinUrl
      : `https://www.linkedin.com/in/${input.linkedinUrl}`;
    const profile = uses.linkedin.enrichProfile({ linkedinUrl: profileUrl });

    return {
      person_id: profile.profile_id,
      job_title: profile.job_title,
      linkedin_url: profile.linkedin_url,
    };
  },
);

export const contactLinkedinEnrichment = defineTool(
  "contact_linkedin_enrichment",
  {
    folder: toolsFolder,
    workflow: enrichContactFromLinkedin,
    name: "Contact LinkedIn enrichment",
    description:
      "Enrich one LinkedIn profile into approved contact identity and role fields without writing to a CRM.",
  },
);
