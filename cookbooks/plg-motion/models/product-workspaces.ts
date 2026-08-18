import { defineModel } from "@cargo-ai/cdk";

import { modelsFolder } from "../../base-gtm/folders/gtm";
import { snowflake } from "../connectors/snowflake";

// The workspace universe — a standalone Snowflake model (not the HubSpot
// `accounts` model) that product events relate to via `workspace_id`.
export const productWorkspaces = defineModel("product_workspaces", {
  connector: snowflake,
  extractSlug: "fetchTable",
  config: {
    // PLACEHOLDER — point at your Snowflake workspaces table and its columns.
    // Keep the workspace key so the product-events relationship still resolves.
    database: "product", // PLACEHOLDER
    schema: "analytics", // PLACEHOLDER
    table: "workspaces", // PLACEHOLDER
    idColumnSlug: "workspace_id", // PLACEHOLDER — the workspace key
    titleColumnSlug: "workspace_name", // PLACEHOLDER — the workspace name
    cursorColumnSlug: "updated_at", // PLACEHOLDER — incremental cursor
  },
  schedule: { type: "cron", cron: "0 6 * * *" },
  folder: modelsFolder,
});
