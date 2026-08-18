import { definePlay, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { hubspot } from "../connectors/hubspot";
import { slack } from "../connectors/slack";
import { accounts } from "../models/accounts";
import { accountBook } from "../capacities/book";
import { amer, emea } from "../territories/regions";

// Per new account: resolve the territory from the country column, stamp it on
// the CRM record, allocate the account to a rep in that territory (respecting
// the `account-book` capacity), and alert the routing channel.
const routeAccount = defineWorkflow(
  "route-account",
  {
    // `id` is the account model's record id — the handle allocation targets.
    input: z.object({ id: z.any(), domain: z.string(), country: z.any() }),
    output: z.object({ territory: z.string() }),
    uses: { hubspot, slack },
  },
  ({ input, uses, allocate }) => {
    // PLACEHOLDER — your territory rules (geo, segment, named lists). Branch on
    // the country and route each territory through its own arm, passing that
    // territory's handle straight to `allocate`.
    //
    // Each arm allocates FIRST, so the chosen owner can be stamped on the CRM
    // record in the same write. `allocate` caps by `account-book` (weighted
    // round-robin, per-rep limits) and its output is `{ member }`. `skipIfExist`
    // protects an existing owner: the weekly re-route refreshes the territory
    // label but never reassigns an account that already has an owner.
    // PLACEHOLDER — confirm the member field carrying the HubSpot owner id.
    if (input.country === "United States" || input.country === "Canada") {
      const allocation = allocate({
        type: "territory",
        territoryUuid: amer.uuid,
        capacityUuid: accountBook.uuid,
        recordId: input.id,
      });

      uses.hubspot.updateRecords({
        objectType: "companies",
        matchingPropertyName: "domain",
        matchingValue: input.domain,
        mappings: [
          { propertyName: "territory", value: "amer" },
          {
            propertyName: "hubspot_owner_id",
            value: allocation.member.ids.hubspot,
            skipIfExist: true,
          },
        ],
      });

      uses.slack.postMessage({
        channelId: "C0000000000", // PLACEHOLDER — your routing channel
        format: "markdown",
        body: `:world_map: *${input.domain}* routed to *AMER*`,
      });

      return { territory: "amer" };
    } else {
      const allocation = allocate({
        type: "territory",
        territoryUuid: emea.uuid,
        capacityUuid: accountBook.uuid,
        recordId: input.id,
      });

      uses.hubspot.updateRecords({
        objectType: "companies",
        matchingPropertyName: "domain",
        matchingValue: input.domain,
        mappings: [
          { propertyName: "territory", value: "emea" },
          {
            propertyName: "hubspot_owner_id",
            value: allocation.member.ids.hubspot,
            skipIfExist: true,
          },
        ],
      });

      uses.slack.postMessage({
        channelId: "C0000000000", // PLACEHOLDER — your routing channel
        format: "markdown",
        body: `:world_map: *${input.domain}* routed to *EMEA*`,
      });

      return { territory: "emea" };
    }
  },
);

// Re-routes as the account universe shifts: fires on new accounts and re-runs
// weekly so rule changes propagate to the whole book.
export const routeAccounts = definePlay("route-accounts", {
  model: accounts,
  workflow: routeAccount,
  changeKinds: ["added"],
  runCreationRule: "always",
  schedule: { type: "cron", cron: "0 7 * * 1" },
});
