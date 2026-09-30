import { defineConnector } from "@cargo-ai/cdk";

// TheirStack: the job-posting source behind the persona work.
//
// One integration, two surfaces, used at two different moments:
//
//   - `searchJobs` is the ACTION the seeding collector calls
//     (scripts/context-seeding/collect/jobs.ts). It takes the same `fields`,
//     `companyFields` and `limit` as the extractor, returns the same rows with
//     `company_object` (employee count, size range, funding stage, industry)
//     on every one, and needs nothing deployed. That is what lets the whole
//     seeding run, personas included, land in ONE pull request.
//   - `fetchJobs` is the EXTRACTOR behind a standing model
//     (../models/persona-jobs.ts). It is incremental, so a scheduled model
//     only bills the postings it has not seen. None is deployed by default;
//     see that file for why, and for how to add one per confirmed persona.
//
// Bound with `default: true`. The workspace's TheirStack connection carries
// either its own API key (then the pull bills TheirStack's plan and no Cargo
// credits) or Cargo's managed access (then every returned posting bills
// credits at the price `cargo-ai connection integration get theirStack`
// reports). The collector reads which one it is and sizes the pull to it; the
// rule is in scripts/context-seeding/collect/budget.ts. A workspace with no
// TheirStack connection fails at deploy, not at plan, because binding
// declares no `config` to typecheck: `cargo-ai connection connector list` is
// the check and `cargo-ai cdk add connector/theirStack` the remedy, or delete
// this file and the persona pull with it and let the personas stay inferred.
export const theirStack = defineConnector("their_stack", {
  integration: "theirStack",
  default: true,
});
