import { defineConnector } from "@cargo-ai/cdk";

// Cargo Signals watches public LinkedIn profiles and returns who reacted to or
// commented on their posts, with the person and their company already
// resolved. It is a native integration: no third-party account, billed in
// Cargo credits per row returned.
//
// The slug is also the dataset the models sync into, so storage names their
// tables `cargo_signals.<model slug>`. `DATASET` in
// apps/engagement-board/src/config.ts must match it.
export const cargoSignals = defineConnector("cargo_signals", {
  integration: "cargoSignals",
  name: "Cargo Signals",
  default: true,
});
