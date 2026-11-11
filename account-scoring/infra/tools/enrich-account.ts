import { defineTool, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { assembleProfile } from "../compute/assemble-profile";
import { linkedin } from "../connectors/linkedin";
import { linkup } from "../connectors/linkup";
import { toolsFolder } from "../folders";
import { researchBrief, researchSchema } from "../research";

// Step 1: make a company complete for the fit model. A tool, not an agent:
// scoring.md already says which values are needed and where each comes from,
// so the path is known before the first call. Every company gets the same
// calls, which is what makes two grades comparable, and the cost per company
// is fixed. An agent here would skip a call one time and add a search the
// next, and two companies would be graded on different evidence.
//
// Three kinds of attribute, as `get.kind` declares them in the model:
//   - firmographic: read from the row (settings.ts maps each to its column).
//   - provider: one connector action each, wired below by hand. The example
//     model has one, `data_team_size`, from LinkedIn. Each provider attribute
//     in your model gets its own call and is passed to `assembleProfile`
//     under its slug; the contract fails when one is missing.
//   - research: one structured Linkup call answers all of them at once, each
//     with a label from its allowed values (or "unknown") and the page that
//     shows it. The question and its schema are built from the model in
//     ../research.ts, so a new research attribute needs no edit here.
//
// Every action runs with `continueOnFailure`: a provider that fails or has no
// coverage leaves that attribute unknown, which the model scores as neutral.
// The tool returns the values and the column writes; the play persists them.
//
// It writes nothing itself, so any play or agent can call it to see what the
// model would collect about a company.

// PLACEHOLDER: the title keywords LinkedIn counts as the data team. Check them
// on two companies you know before the pilot: the count is only as good as
// the keywords.
const dataTeamKeywords = "data analytics";

export const accountInput = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string(),
  linkedin_url: z.string().nullable().optional(),
  // One field per firmographic attribute, named after its column in
  // settings.ts `firmographicColumns`.
  employee_count: z.number().nullable().optional(),
});

const enrichAccountWorkflow = defineWorkflow(
  "enrich_account_workflow",
  {
    input: accountInput,
    output: z.object({
      values: z.record(z.string(), z.unknown()),
      mappings: z.array(
        z.object({ columnSlug: z.string(), value: z.unknown() }),
      ),
      filled: z.number(),
      unknown: z.number(),
    }),
    uses: { linkedin, linkup },
    imports: {
      assembleProfile,
      dataTeamKeywords,
      researchBrief,
      researchSchema,
    },
  },
  ({ input, uses }) => {
    // Provider attribute: data_team_size.
    const dataTeam = uses.linkedin.findCustomHeadcount(
      {
        companyLinkedinUrl: input.linkedin_url,
        keywords: dataTeamKeywords,
        includeSubsidiaries: false,
      },
      { continueOnFailure: true },
    );

    // Every research attribute, in one call.
    const research = uses.linkup.instruct(
      {
        q: `Research ${input.name} (${input.domain}). ${researchBrief}`,
        depth: "standard",
        outputType: "structured",
        structuredOutputSchema: researchSchema,
      },
      { continueOnFailure: true },
    );

    const profile = assembleProfile({
      row: input,
      research,
      data_team_size: dataTeam.count,
    });

    return {
      values: profile.values,
      mappings: profile.mappings,
      filled: profile.filled,
      unknown: profile.unknown,
    };
  },
);

export const enrichAccount = defineTool("enrich_account", {
  folder: toolsFolder,
  workflow: enrichAccountWorkflow,
  name: "Enrich account for the fit model",
  description:
    "Collects every attribute the fit model in context/icp/scoring.md needs about one company: firmographics from the row, one call per provider attribute, one structured research call for the rest. Returns the values and their evidence; writes nothing.",
});
