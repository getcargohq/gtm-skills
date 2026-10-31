import { defineConnector } from "@cargo-ai/cdk";

// LinkedIn: the invite and the message a rep sends from the cockpit, as the
// rep's own LinkedIn identity. An identity is captured once per rep with the
// Cargo Chrome extension and lands on the rep's member, under this connector,
// so the app finds it the way it finds the mailbox: no rep table.
//
// Only `connectProfile` and `messageProfile` are used, and only by the
// LinkedIn send tool, on a rep's click.
export const linkedin = defineConnector("linkedin", {
  integration: "linkedin",
  default: true,
});
