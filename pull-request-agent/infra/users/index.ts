import { defineRole, defineUser } from "@cargo-ai/cdk";

// The workspace system role every reader holds. Adopted, not created: a system
// role cannot be edited, so there is no permission list here to drift.
const viewer = defineRole("viewer", { adopt: true });

// The service user every turn runs as. The sandbox gets a short-lived
// `CARGO_API_TOKEN` for it, which is what lets `cargo-ai project plan` diff the
// pull request against the deployed workspace.
//
// Viewer is enough, and it is the point. Anyone who can comment on the
// repository can steer this agent, so its Cargo session must not be able to
// deploy, run an action or change a resource, even when the prompt is talked
// past.
export const pullRequestAgentUser = defineUser("pull_request_agent", {
  kind: "service",
  firstName: "Pull request",
  lastName: "agent",
  role: viewer,
});
