import { defineModel } from "@cargo-ai/cdk";

import { accounts } from "../../base-gtm/models/accounts";
import { modelsFolder } from "../../base-gtm/folders/gtm";
import { sillage } from "../connectors/sillage";

// The signal feed. The `listenSignals` extractor provisions a Sillage
// workspace, replaces its monitored-account list with the TAM (via
// `account.modelUuid` — the handle's uuid token resolves at deploy, so the
// reconciler deploys `accounts` first), and pulls detections incrementally. No
// `schedule` needed: the extractor auto-fetches every 15 minutes.
//
// Each row is one detection: `signal_type`, `detected_at`, `signal_date`, plus
// the enriched `lead`, `company`, and `interaction_data` objects. Rows unify as
// `accountEvent` on company domain / LinkedIn URL, so signals attach to
// accounts across the workspace.
export const signals = defineModel("account_signals", {
  connector: sillage,
  extractSlug: "listenSignals",
  config: {
    account: {
      // Monitor the accounts held in a Cargo model (rather than a static list).
      source: "model",
      // The base TAM model and the column carrying each account's domain or
      // LinkedIn company URL.
      //
      // `accounts.uuid` is a deferred Token that the reconciler resolves at
      // deploy (which is what orders `accounts` before this model). The
      // generated extractor config types the field as a plain string, so the
      // cast is the bridge between the two. The token, not the literal, is what
      // ends up on the emitted node.
      modelUuid: accounts.uuid as unknown as string,
      columnSlug: accounts.columns.website, // PLACEHOLDER — match your accounts model's column
      limit: 1000,
    },
    // PLACEHOLDER — the persona whose activity Sillage watches on those
    // accounts. Narrow it to your buyer; omit `persona` entirely to monitor
    // the accounts without lead matching.
    persona: {
      jobTitles: ["VP Sales", "Head of Growth", "Revenue Operations"],
      seniorities: ["vp", "head", "director"],
      locations: ["United States", "Europe"],
    },
  },
  folder: modelsFolder,
});
