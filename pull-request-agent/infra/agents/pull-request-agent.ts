import { agentConnectorTrigger, defineAgent } from "@cargo-ai/cdk";

import { pullRequestAgentPrompt } from "./pull-request-agent.prompt";
import { anthropic } from "../connectors/anthropic";
import { git } from "../connectors/git";
import { agentsFolder } from "../folders";
import { pullRequestAgentUser } from "../users";

// The pull request agent: anyone who mentions @cargo on a pull request in the
// GTM repository gets an agent with that pull request checked out.
//
// `harness: "claudeCode"`, because the job is a working tree: read the diff,
// run `cargo-ai project plan` against it, and push a commit to the branch when
// asked. A streamText agent could talk about the diff but could not do any of
// that.
//
// `connector` and `languageModel` are required even here. The harness does not
// bring its own model: it runs against Cargo's LLM proxy, which bills this
// connector and meters usage against this slug.
//
// No `uses` and no capabilities. The platform posts the reply as a comment on
// the pull request, and the workspace is read with the `cargo-ai` CLI the
// sandbox already has, as a viewer.
export const pullRequestAgent = defineAgent("pull_request_agent", {
  name: "Pull request agent",
  description:
    "Answers @cargo on any pull request in the GTM repository: explains the diff, plans what it would deploy, and pushes the fixes it is asked for to the pull request's branch. Never merges or deploys.",
  color: "blue",
  harness: "claudeCode",
  connector: anthropic,
  languageModel: "claude-sonnet-5", // PLACEHOLDER — your model of choice
  // Only `runAs`. Plan and deploy fill the rest from the project's own
  // repository: the git origin of the checkout, its default branch, and the
  // directory whose package.json declares `@cargo-ai/cdk`. `cargo-ai project
  // check` prints what it resolved.
  repository: { runAs: pullRequestAgentUser },
  triggers: [
    agentConnectorTrigger({
      connector: git,
      config: {
        // Mentions on every pull request in the bound repository, not only
        // the ones this agent opened. A pull request another agent opened
        // (Ask Cargo's, for one) stays with that agent.
        allPullRequests: true,
        // Both only ever apply to a pull request this agent opened itself,
        // which it does when someone asks for a follow-up. A stranger's red
        // CI or review never wakes it unasked.
        fixFailedChecks: true,
        addressReviews: true,
      },
    }),
  ],
  systemPrompt: pullRequestAgentPrompt,
  folder: agentsFolder,
});
