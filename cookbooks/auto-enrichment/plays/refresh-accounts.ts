import { definePlay, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { hubspot } from "../../crm-sync/connectors/hubspot";
import { waterfall } from "../../base-gtm/connectors/waterfall";
import { accounts } from "../../base-gtm/models/accounts";

// The company side of CRM freshness: waterfall-enrich accounts missing
// firmographics and stamp the CRM record. `skipIfExist` keeps human-entered
// values authoritative.
const refreshAccount = defineWorkflow(
  "refresh-account",
  {
    input: z.object({ domain: z.string() }),
    output: z.object({ refreshed: z.boolean() }),
    uses: { waterfall, hubspot },
  },
  ({ input, uses }) => {
    const company = uses.waterfall.enrichCompany(
      { domain: input.domain },
      { continueOnFailure: true },
    );

    uses.hubspot.updateRecords({
      objectType: "companies",
      matchingPropertyName: "domain",
      matchingValue: input.domain,
      mappings: [
        { propertyName: "industry", value: company.company.industry },
        {
          propertyName: "numberofemployees",
          value: company.company.employees_count,
        },
      ],
    });

    return { refreshed: true };
  },
);

// PLACEHOLDER — the staleness filter; ships as "industry missing".
export const refreshAccounts = definePlay("refresh-accounts", {
  model: accounts,
  workflow: refreshAccount,
  runCreationRule: "always",
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "and",
        conditions: [
          {
            kind: "string",
            columnSlug: accounts.columns.industry,
            operator: "isNull",
          },
          {
            kind: "string",
            columnSlug: accounts.columns.website,
            operator: "isNotNull",
          },
        ],
      },
    ],
  },
  schedule: { type: "cron", cron: "0 3 * * *" },
});
