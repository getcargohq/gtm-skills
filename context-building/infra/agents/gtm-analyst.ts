import { agentConnectorTrigger, defineAgent } from "@cargo-ai/cdk";

import { anthropic } from "../connectors/anthropic";
import { slack } from "../connectors/slack";
import { agentsFolder } from "../folders";

// The consumer: the Q&A surface over the knowledge base the other two agents
// build. It exists to prove the graph is traversable. If the analyst cannot
// answer "who do we sell to and why do we lose?" from context/ with a file
// citation, the knowledge base has a gap, and the analyst names the missing
// file instead of guessing.
//
// An ordinary agent, not a harness: it reads the deployed context through the
// `context` capability, read-only, and needs no working tree. The same
// connector as the two harness agents, so one LLM binding covers the
// cookbook.
//
// Triggered from Slack: an @mention in a listed channel opens (or resumes) a
// chat, and the platform streams the answer back into the thread, so there
// is no postMessage to declare and nothing to lock. List the channels rather
// than `allChannels`: an analyst that answers in a customer shared channel is
// quoting the objection file to the customer.
//
// If `ask-cargo` or `gtm-knowledge-graph` is also installed, their agents
// overlap this one: a channel listed here is left to this agent by an
// `allChannels` trigger elsewhere, so the split is by channel, not by slug.
export const gtmAnalyst = defineAgent("gtm-analyst", {
  name: "GTM analyst",
  description:
    "Answers GTM questions strictly from the context repository, cites the file, and names the gap when there is none.",
  color: "yellow",
  connector: anthropic,
  languageModel: "claude-sonnet-5", // PLACEHOLDER — your model of choice
  systemPrompt: `You answer go-to-market questions strictly from the workspace context: the
ICP, personas, jobs to be done, alternatives, clients, proof, objections,
signals and insights. Every answer cites the file it drew from, by path. When
the context does not cover the question, say which file is missing (the
domain and the slug you would expect) instead of guessing, and stop there.

Read the evidence tags: [R] is receipted, [I] is inferred, [TR] is unknown.
Repeat the tag when you repeat the claim, so an inferred ICP is never quoted
as a fact. A confidence: hypothesis file is a hypothesis; say so.

Answer in the reader's words, short, one question at a time. Never invent a
customer, a number or a quote that is not in a file.`,
  maxSteps: 8,
  capabilities: ["memory", { slug: "context", config: { isReadOnly: true } }],
  triggers: [
    agentConnectorTrigger({
      connector: slack,
      config: {
        // PLACEHOLDER — the channels the team asks from. Ids (C…), not names.
        channelIds: ["C0123456789"],
      },
    }),
  ],
  folder: agentsFolder,
});
