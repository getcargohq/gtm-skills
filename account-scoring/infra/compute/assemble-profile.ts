import { defineScript } from "@cargo-ai/cdk";

import { fitModel } from "../model";
import { firmographicColumns } from "../settings";
import { buildProfile } from "./fit";

// Step 1's last node: turns the row, the research answer and each provider
// attribute's result into normalized values and the column writes that store
// them. Every provider attribute is passed as its own argument, named after
// its slug (`data_team_size: dataTeam.count`); the contract checks that each
// one in the model is passed.
export const assembleProfile = defineScript(
  ({
    row,
    research,
    ...provider
  }: {
    row: unknown;
    research: unknown;
    [providerAttribute: string]: unknown;
  }) =>
    buildProfile(
      fitModel,
      firmographicColumns,
      row as Record<string, unknown>,
      research as Record<string, unknown>,
      provider,
    ),
);
