import { defineConnector } from "@cargo-ai/cdk";

// Cargo's own prospect & business database — credits-based, zero config.
// `matchBusiness` resolves a domain to a business record, `fetchProspects`
// pulls people by job level/title/department, and the `enrichBusiness*` /
// `enrichProspect*` actions cover firmographics, technographics, funding,
// LinkedIn activity, and more.
export const cargoDb = defineConnector("cargo", {
  integration: "cargo",
  adopt: true,
});
