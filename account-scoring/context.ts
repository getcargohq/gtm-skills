import { defineContext } from "@cargo-ai/cdk";

// The workspace's context repository, as code: the git-backed GTM knowledge
// base the scorer agent reads the ICP from. It is a per-workspace SINGLETON,
// so exactly one file in a project may call defineContext. If the project
// already has one (the gtm-knowledge-graph skill defines it, or you wrote your
// own), move context/icp.md into that directory and delete this file: the
// agent's `context` capability reads whatever the workspace context holds.
// Path relative to the project root.
export const context = defineContext({ dir: "account-scoring/context" });
