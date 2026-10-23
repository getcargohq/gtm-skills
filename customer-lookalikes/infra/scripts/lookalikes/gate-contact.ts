// The contact gate: a person was found and an email came back with them.
// Without an email there is nothing to verify, and an unverified guess is not
// a contact.

import { defineScript } from "@cargo-ai/cdk";

type FoundContact = {
  found?: boolean;
  email?: string;
};

export const gateContact = defineScript(
  ({ contact }: { contact: FoundContact }) => {
    const email = String(contact.email || "").trim();
    if (contact.found !== true || email.length === 0) {
      return { found: false, verdict: "viable_no_contact" };
    }
    return { found: true, verdict: "contact_found" };
  },
);
