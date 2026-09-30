import { defineConnector } from "@cargo-ai/cdk";

// The git provider the two harness agents clone through, and push their
// branch and open their pull request with. Its OAuth grant carries the `repo`
// scope, so this one connector is their entire write path into the
// repository: the bootstrap writes context/ once, the refresh appends to it
// monthly, and neither has another way to land anything.
//
// Nothing imports this handle. That is deliberate: both agents leave
// `repository.connector` unset, and plan/deploy resolve it from the project's
// own GitHub connector, which is this one. Declaring it is what makes it
// exist; wiring it by hand would only re-state what the resolver already
// knows.
//
// Bound, not created. `default: true` authorizes nothing: you grant it once in
// the browser (`cargo-ai cdk add connector/github`) and this declaration binds
// to it. A deploy cannot mint an OAuth grant.
export const git = defineConnector("github", {
  integration: "github",
  default: true,
});
