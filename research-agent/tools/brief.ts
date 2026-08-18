import { defineTool, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

import { researcher } from "../agents/researcher";

// The callable surface: domain in, brief out. Wrapping the agent in a
// tool-backed workflow gives it a typed contract, so other skills (plays,
// MCP servers, the rep cockpit) can call it per account.
const briefFlow = defineWorkflow(
  "account-brief",
  {
    input: z.object({ domain: z.string() }),
    output: z.object({ brief: z.string() }),
    uses: { researcher },
  },
  ({ input, uses }) => {
    const brief = uses.researcher({
      prompt: `Research the account with domain ${input.domain} and write the brief.`,
    }).answer;
    return { brief };
  },
);

export const accountBrief = defineTool("account-brief", {
  workflow: briefFlow,
  description: "Research an account by domain and produce an AE-ready brief.",
  emojiSlug: "mag",
});
