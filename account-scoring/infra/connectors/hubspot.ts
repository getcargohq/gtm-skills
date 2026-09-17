import { defineConnector } from "@cargo-ai/cdk";

// PLACEHOLDER — the CRM slot. Every skill's accounts/contacts flow through
// this connector; swap the integration for attio/salesforce if that's where
// your data lives (the downstream contract is only the two models in
// `../models/`).
//
// Bound, not created: `default: true` links the CRM connection the workspace
// already holds, as the Cargo DB and LLM connectors beside it do, so this
// example deploys with no credential of its own.
//
// The cost is that a deploy cannot mint one, and binding declares no `config`
// to typecheck, so a workspace with no CRM connection fails at deploy rather
// than at plan. `cargo-ai connection connector list` is the check and
// `cargo-ai cdk add connector/hubspot` is the remedy. Do not add `config` as a
// fallback: it is exclusive with `default` and would be silently ignored.
export const hubspot = defineConnector("hubspot", {
  integration: "hubspot",
  default: true,
});
