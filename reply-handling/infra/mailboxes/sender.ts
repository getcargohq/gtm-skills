import { defineMailbox } from "@cargo-ai/cdk";

import { outreach } from "../domains/outreach";
import { mailboxesFolder } from "../folders";

// PLACEHOLDER: the inbox every first touch and every approved reply goes out
// from. Yields `alex@example-outreach.com` once the domain and username are
// real. `firstName` and `lastName` are the From name the lead sees, and the
// writer signs as this person, so they are a real person under a real
// identity.
//
// Domain, username and type are create-only. Changing any of them is destroy
// plus a new mailbox: a new address the lead does not know, back at the bottom
// of the send ramp.
//
// A mailbox is a recurring monthly credit charge for as long as it exists.
// Quote the live figure from `cargo-ai mailboxManagement pricing get` and get
// an explicit yes before the plan's `+ create mailbox:…` line is applied.
// `destroy` is the only way to stop the charge.
//
// `google` is the only type that provisioned in the build this example comes
// from: `private` and `shared` answered `provisioningFailed` on the same
// domain, through the deploy and the CLI alike.
//
// Start warm-up once the mailbox is active (references/run.md). A mailbox
// that never starts it stays at five real sends a day.
export const sender = defineMailbox("sender", {
  domain: outreach,
  type: "google",
  username: "alex",
  firstName: "Alex",
  lastName: "Morgan",
  folder: mailboxesFolder,
});

// The name the writer signs with. Keep it equal to the mailbox's From name.
export const senderName = "Alex Morgan";
