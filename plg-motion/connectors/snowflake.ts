import { defineConnector, secret } from "@cargo-ai/cdk";

// The product-analytics source — your Snowflake warehouse, where product events
// already land (via your event pipeline / Segment / Fivetran). The downstream
// contract is just the events model, so the rest of the PLG cookbook is
// unchanged. Credentials are read from the environment at deploy time via
// `secret()`, keeping them out of the content hash (rotating them isn't drift).
// PLACEHOLDER — set SNOWFLAKE_PASSWORD (and the account/user/role/warehouse/
// database below) before deploy.
export const snowflake = defineConnector("snowflake", {
  integration: "snowflake",
  config: {
    account: "xy12345.us-east-1", // PLACEHOLDER — your Snowflake account locator
    user: "CARGO_SVC", // PLACEHOLDER — service user
    role: "CARGO_RO", // PLACEHOLDER — role with read access
    warehouse: "COMPUTE_WH", // PLACEHOLDER
    database: "PRODUCT", // PLACEHOLDER
    authentication: "password",
    password: secret("SNOWFLAKE_PASSWORD"),
  },
});
