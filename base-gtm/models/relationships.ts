import { defineRelationship } from "@cargo-ai/cdk";

import { accounts } from "./accounts";
import { contacts } from "./contacts";

// One account has many contacts. Cargo unification uses this to resolve a
// contact back to its account (and vice versa) so plays/segments can hop
// between the two models.
//
// Join keys are HubSpot's native company↔contact association: a company's
// record id on the account side, `associatedcompanyid` on the contact side.
// PLACEHOLDER — swap the `column` slugs if your CRM/source names them
// differently (e.g. a shared `domain` column if that's how you associate).
export const accountContacts = defineRelationship("account-contacts", {
  from: {
    model: accounts,
    column: accounts.columns.id,
    property: "contacts",
  },
  to: {
    model: contacts,
    column: contacts.columns.account_id,
    property: "account",
  },
  relation: "oneToMany",
});
