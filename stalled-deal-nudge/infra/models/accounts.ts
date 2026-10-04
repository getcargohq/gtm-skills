import { defineModel } from "@cargo-ai/cdk";

import { modelsFolder } from "../folders";

// The companies the deals belong to, for the name the digest prints. A Cargo
// native account model (`defineAccount`: id, name, website, industry, ...),
// joined on `deals.account_id`.
export const accounts = defineModel("accounts", {
  kind: "native",
  extractSlug: "defineAccount",
  folder: modelsFolder,
});
