import { defineConnector } from "@cargo-ai/cdk";

// Prospeo: the work email of each sourced person, from name and company
// domain. One provider, not a waterfall: a miss leaves the email blank and the
// cockpit says so, rather than paying a second provider on every claim.
export const prospeo = defineConnector("prospeo", {
  integration: "prospeo",
  default: true,
});
