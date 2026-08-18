import { defineAgent } from "@cargo-ai/cdk";

import { openai } from "../connectors/openai";
import { slack } from "../connectors/slack";
import { agentsFolder } from "../folders/gtm";

// The Q&A surface over the knowledge base: ask it anything the context repo
// answers (ICP fit, which play applies, positioning language). It proves the
// graph is traversable — if the analyst can't answer from the files, the
// knowledge base has a gap.
export const gtmAnalyst = defineAgent("gtm-analyst", {
  color: "yellow",
  connector: openai,
  languageModel: "gpt-4o", // PLACEHOLDER — your model of choice
  systemPrompt: `You answer GTM questions strictly from the workspace context
(ICP, positioning, personas, plays). Cite the file you drew from. If the
context doesn't cover the question, say what file is missing instead of
guessing.`,
  maxSteps: 8,
  capabilities: ["memory"],
  // Talk to the analyst from Slack: a connector trigger opens a chat with the
  // agent (e.g. @Cargo it in a channel) so GTM questions get answered where
  // the team already works. `connector` pins the base Slack handle by ref;
  triggers: [
    {
      type: "connector",
      integration: "slack",
      connector: slack,
      config: {
        channelIds: ["C0XXXXXX"], // PLACEHOLDER — the channel to trigger the agent
      },
    },
  ],
  folder: agentsFolder,
});
