import { defineMailbox } from "@cargo-ai/cdk";

import { outreach } from "../domains/outreach";
import { mailboxesFolder } from "../folders";

// PLACEHOLDER: one mailbox per rep, named after the rep. This one yields
// `jane@example-outreach.com`. Copy the file for each rep who sends from the
// cockpit, and attach it to that rep in `../members/reps.ts`.
//
// Domain, username and type are create-only: changing one is a destroy plus a
// new inbox back at the bottom of the send ramp. A new mailbox sends a handful
// a day and ramps to 40 over its warm-up, so a rep's first week from the
// cockpit is capped by the ramp, not by the drafts.
//
// A mailbox is a recurring monthly credit charge for as long as it exists.
// Quote the live figure from `cargo-ai mailboxManagement pricing get` and get
// an explicit yes before the plan's `+ create mailbox:…` line is applied.
// `destroy` is the only way to stop the charge.
export const jane = defineMailbox("jane", {
  domain: outreach,
  type: "google",
  username: "jane",
  firstName: "Jane",
  lastName: "Doe",
  folder: mailboxesFolder,
});
