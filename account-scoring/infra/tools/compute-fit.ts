import { defineTool, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { scoreFit } from "../compute/score-fit";
import { toolsFolder } from "../folders";

// Step 2's arithmetic, as a tool: values in, grade out. One script node holds
// the model (bundled from ../model.ts at deploy) and the code in
// ../compute/fit.ts: No Fit filters first, then the points of every weighted
// attribute and modifier, the total held between 0 and 100, and the band.
//
// No agent and no credits, so the same values always give the same grade, and
// any play or agent can ask what a company would score.
const computeFitWorkflow = defineWorkflow(
  "compute_fit_workflow",
  {
    input: z.object({ values: z.record(z.string(), z.unknown()) }),
    output: z.object({
      grade: z.string(),
      score: z.number(),
      filtered_by: z.string(),
      breakdown: z.string(),
      unknown_count: z.number(),
      model_version: z.number(),
    }),
    imports: { scoreFit },
  },
  ({ input }) => {
    const fit = scoreFit({ values: input.values });
    return {
      grade: fit.grade,
      score: fit.score,
      filtered_by: fit.filtered_by,
      breakdown: fit.breakdown,
      unknown_count: fit.unknown_count,
      model_version: fit.model_version,
    };
  },
);

export const computeFit = defineTool("compute_fit", {
  folder: toolsFolder,
  workflow: computeFitWorkflow,
  name: "Compute fit grade",
  description:
    "Computes the fit grade (Strong, Moderate, Weak, No Fit), the score out of 100 and its breakdown from a company's attribute values, with the model in context/icp/scoring.md. Code only: no model call, no credits.",
});
