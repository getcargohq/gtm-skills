import { defineContext } from "@cargo-ai/cdk";

// The workspace's context repository — the git-backed GTM knowledge base every
// agent traverses — as code. One repo per workspace, so exactly ONE cookbook
// defines it (this one; research-agent and ai-sdr require it). Additive on
// deploy: files added in the UI are left in place. Path relative to the
// project root (the cookbooks repo root).
export const context = defineContext({ dir: "gtm-knowledge-graph/context" });
