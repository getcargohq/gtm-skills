import { defineConnector } from "@cargo-ai/cdk";

// AI Ark: the lookalike search, the firmographics, the role counts and the
// people search, all through one managed connection on Cargo credits. Bound to
// the workspace's default AI Ark connection, so nothing goes in `.env`.
//
// The agents call it as tools: `searchCompanies` with `lookalikeDomains` finds
// the candidates, `countCompanies` and `countPeople` are free and size a
// filter or a function before anything bills, and `searchPeople` plus
// `enrichPerson` find the one person and their work email.
//
// When tam-building or account-scoring is installed, they carry this same
// connector: keep one and rewire the imports, since two connectors with one
// slug collide at deploy.
export const aiArk = defineConnector("ai_ark", {
  integration: "aiArk",
  default: true,
});
