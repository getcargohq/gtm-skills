import { defineScript } from "@cargo-ai/cdk";

import { fitModel } from "../model";
import { computeFit } from "./fit";

// Step 2's arithmetic as a script node: the filters, the points, the total and
// the band, from the model bundled into the node at deploy. No agent and no
// credits.
export const scoreFit = defineScript(({ values }: { values: unknown }) =>
  computeFit(fitModel, values as Record<string, unknown>),
);
