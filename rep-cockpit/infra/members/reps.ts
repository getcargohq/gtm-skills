import { defineMember } from "@cargo-ai/cdk";

import { jane } from "../mailboxes/jane";

// Which mailbox each rep sends from. The cockpit reads the signed-in rep's
// revenue-organization member by login email and sends from the first mailbox
// attached to it, so there is no rep table in the app to keep in sync.
//
// `defineMember` adopts a member that already exists (invite the rep to the
// workspace first): it never creates one. `mailboxes` replaces the member's
// list, so list every mailbox the rep keeps, including any attached by hand.
// A rep with no mailbox can still claim and review drafts; the cockpit says
// why Send is off.
//
// PLACEHOLDER: the rep's Cargo login email, exactly as they sign in.
export const janeMember = defineMember("jane@example.com", {
  mailboxes: [jane],
});
