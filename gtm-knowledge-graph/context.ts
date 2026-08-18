import { defineContext } from "@cargo-ai/cdk";

// The workspace's context repository — the git-backed GTM knowledge base every
// agent traverses — as code. One repo per workspace, so exactly ONE file in a
// project may define it (this one; if research-agent or ai-sdr are also in the
// project, point their agents at this context rather than adding a second). Additive on
// deploy: files added in the UI are left in place. Path relative to the
// project root .
export const context = defineContext({ dir: "gtm-knowledge-graph/context" });
