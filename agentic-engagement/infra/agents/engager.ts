import { defineAgent, agentNativeTrigger } from "@cargo-ai/cdk";

import { openai } from "../connectors/openai";
import { agentsFolder } from "../folders";
import { sendEmailTool } from "../tools/send-email";
import { engagerHeartbeatPrompt, engagerPrompt } from "./engager.prompt";

// The engager: a conversation agent, not a sequencer.
//
// The loop is two wakes on the same chat:
//
// 1. Native email trigger — inbound status. `sendEmail` (via the send-email
//    tool) starts or continues a thread from this agent; the trigger wakes
//    that chat when the thread's status changes to `replied` or
//    `unsubscribed`. Without `agentSlug: "email"` a send goes out and nothing
//    ever comes back into the agent.
// 2. Heartbeat — silence. A thread that stays at `sent` never fires the
//    trigger. The heartbeat re-wakes the chat so the agent can read that
//    status and decide (one follow-up, or stop).
//
// `kinds` is load-bearing. `opened` or `interacted` would wake on a
// tracking-pixel view, which burns a turn and looks like a follow-up nobody
// asked for. `unsubscribed` is status that must stop a send, not a reason
// to write.
export const engager = defineAgent("engager", {
  name: "Engager",
  description:
    "Holds email conversations with leads from one mailbox, waking on reply, unsubscribe, or a heartbeat that checks thread status.",
  color: "blue",
  connector: openai,
  languageModel: "gpt-4o", // PLACEHOLDER — your model of choice
  temperature: 0.6,
  maxSteps: 10,
  systemPrompt: engagerPrompt,
  capabilities: ["memory", { slug: "context", config: { isReadOnly: true } }],
  uses: [sendEmailTool],
  triggers: [
    agentNativeTrigger({
      agentSlug: "email",
      name: "status",
      config: { kinds: ["replied", "unsubscribed"] },
    }),
  ],
  heartbeat: {
    intervalMinutes: 1440, // one business-day gap between status checks
    maxMessages: 16, // first send + a short thread + heartbeats, then stop
    prompt: engagerHeartbeatPrompt,
  },
  evaluator: {
    rubric:
      "Did it stay on this thread, cite only facts in context or in the conversation, thread the reply with inReplyTo and the full references chain, treat heartbeat as a status check rather than a reason to sequence, and stop when the lead declined, unsubscribed, or asked for a human?",
    threshold: 0.8,
  },
  folder: agentsFolder,
});
