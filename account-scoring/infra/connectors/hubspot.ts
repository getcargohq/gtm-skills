import { defineConnector } from "@cargo-ai/cdk";

// PLACEHOLDER — the CRM slot. Every skill's accounts/contacts flow through
// this connector; swap the integration for attio/salesforce if that's where
// your data lives (the downstream contract is only the two models in
// `../models/`).
//
// Bound, not created: `default: true` links the CRM connection the workspace
// already holds — the one authenticated once in the UI — so this example
// deploys with no credential of its own. It resolves the integration's default
// connector first and falls back to a slug match.
//
// That is the same posture as the Cargo DB and LLM connectors beside it, and it
// is the right one for a CRM specifically. A created connector needs its access
// token declared here, which means the token has to reach the deploy: exported
// by whoever runs it, or sitting in a `.env` that the next machine does not
// have, and rotated only by re-applying this resource. A CRM connection is also
// the thing a workspace is most likely to already have, and two of them is two
// grants to revoke when someone leaves.
//
// The cost is that a deploy cannot mint one. In a workspace with no CRM
// connection this fails at deploy rather than at plan, because binding declares
// no `config` and there is nothing to typecheck: `cargo-ai connection connector
// list` is the check, and `cargo-ai cdk add connector/hubspot` is how you get
// one. `default: true` and `config` are exclusive — a declared `config` is
// never sent for a bound connector, so adding a token here would silently do
// nothing.
export const hubspot = defineConnector("hubspot", {
  integration: "hubspot",
  default: true,
});
