import { defineConnector } from "@cargo-ai/cdk";

// The GitHub connector does two jobs here: it is the trigger that wakes the
// agent on a pull request, and the path the harness clones, pushes and comments
// through. Its app installation is also the boundary. A repository the app is
// not installed on sends no webhook, so nothing there can wake the agent.
//
// The repository the agent works on is not written anywhere. The agent leaves
// `repository.connector` unset, so plan and deploy resolve it from this
// connector and the git origin of the checkout they run in.
//
// Bound, not created. `default: true` authorizes nothing: you grant it once in
// the browser (`cargo-ai project add connector/github`) and this declaration
// binds to it. A deploy cannot mint an OAuth grant.
export const git = defineConnector("github", {
  integration: "github",
  default: true,
});
