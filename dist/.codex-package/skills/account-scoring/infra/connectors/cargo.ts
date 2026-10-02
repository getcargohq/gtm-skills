import { defineConnector } from "@cargo-ai/cdk";

// Cargo's own prospect & business database — credits-based and zero config,
// because it binds the workspace's default connection rather than creating one.
// `matchBusiness` resolves a domain to a business record, `fetchProspects`
// pulls people by job level/title/department, and the `enrichBusiness*` /
// `enrichProspect*` actions cover firmographics, technographics, funding,
// LinkedIn activity, and more.
export const cargoDb = defineConnector("cargo", {
  integration: "cargo",
  default: true,
});
