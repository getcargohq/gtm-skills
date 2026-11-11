import { defineScript } from "@cargo-ai/cdk";

import { fitModel } from "../model";
import { readStoredValues } from "./fit";

// A rescore reads the values an earlier enrichment stored on the row, so a new
// model version is applied without paying for a single provider call.
export const valuesFromRow = defineScript(({ row }: { row: unknown }) => ({
  values: readStoredValues(fitModel, row as Record<string, unknown>),
}));
