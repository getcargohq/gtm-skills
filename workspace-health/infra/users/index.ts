import { defineRole, defineUser } from "@cargo-ai/cdk";

// The workspace system role every reader holds. Adopted, not created: a system
// role cannot be edited, so there is no permission list here to drift.
const viewer = defineRole("viewer", { adopt: true });

// The service user every workspace-health run is signed in as. The sandbox gets a
// short-lived `CARGO_API_TOKEN` for it, so `cargo-ai` reads the workspace as
// this user and not as whoever deployed. Without it the CLI has no session and
// every workspace read fails.
//
// Viewer is enough: it reads runs, plays, agents and usage. It cannot deploy, change a resource or
// touch billing settings, which is what keeps the prompt's "read, never write"
// true even if the prompt is ignored.
export const workspaceHealthUser = defineUser("workspace_health", {
  kind: "service",
  firstName: "Workspace",
  lastName: "Health",
  role: viewer,
});
