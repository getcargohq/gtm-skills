import { defineConnector } from "@cargo-ai/cdk";

// The research step: one Linkup `instruct` call per company, structured, that
// answers every research attribute of the model at once with a label from its
// allowed values and the page that shows it. One flat-priced call however many
// research attributes the model holds. `default: true` binds the workspace's
// existing connection.
export const linkup = defineConnector("linkup", {
  integration: "linkup",
  default: true,
});
