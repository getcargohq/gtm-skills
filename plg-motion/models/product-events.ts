import { defineModel } from "@cargo-ai/cdk";

import { modelsFolder } from "../../base-gtm/folders/gtm";
import { snowflake } from "../connectors/snowflake";

// Product events as a data model — the raw material of every PLG signal. The
// PQL segment counts occurrences of these rows per workspace. Sourced from
// Snowflake via `fetchTable` against your events table; keep the output columns
// (workspace key, event_type, timestamp) so the downstream PQL segment and
// workspace relationship still resolve.
export const productEvents = defineModel("product_events", {
  connector: snowflake,
  extractSlug: "fetchTable",
  config: {
    // PLACEHOLDER — point at your Snowflake events table and its columns. Keep
    // the workspace key, event type, and timestamp so the downstream PQL segment
    // and workspace relationship still resolve.
    database: "product", // PLACEHOLDER
    schema: "analytics", // PLACEHOLDER
    table: "events", // PLACEHOLDER
    idColumnSlug: "event_id", // PLACEHOLDER — the event id
    titleColumnSlug: "event_type", // PLACEHOLDER — the event name
    cursorColumnSlug: "event_time", // PLACEHOLDER — incremental cursor
  },
  schedule: { type: "cron", cron: "0 6 * * *" },
  folder: modelsFolder,
});
