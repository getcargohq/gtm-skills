import { defineAgent } from "@cargo-ai/cdk";

import { anthropic } from "../connectors/anthropic";
import { agentsFolder } from "../folders";
import { replyWriterPrompt } from "./reply-writer.prompt";

// Writes as the sender: the first touch, and the answer to whatever came back.
// One agent for both, so the person who replies sounds like the person who
// wrote first.
//
// `context` (read-only) is how it reads the reply playbook: the sender, the
// offer, the voice, the claims allowed and the phrases banned. Without it the
// prompt's reference to the playbook reads nothing, and the writer invents an
// offer that sounds plausible for every lead.
//
// It returns plain text. The play builds the HTML from it, runs the gate on
// it and sends it: the writer never sends anything and holds no model, so a
// draft cannot reach a lead without passing the gate and, by default, a
// person.
export const replyWriter = defineAgent("reply_writer", {
  name: "Reply writer",
  description:
    "Writes the first touch and the answer to each reply as the sender, from the reply playbook in the workspace context. JSON only; never sends.",
  color: "purple",
  connector: anthropic,
  languageModel: "claude-sonnet-5", // PLACEHOLDER: your model of choice
  temperature: 0.4,
  maxSteps: 4,
  systemPrompt: replyWriterPrompt,
  capabilities: [{ slug: "context", config: { isReadOnly: true } }],
  output: {
    type: "jsonSchema",
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      required: ["subject", "body_text", "used_slots"],
      properties: {
        subject: {
          type: "string",
          description:
            "The subject of a first touch. Empty in reply mode: the play answers on the original subject.",
        },
        body_text: {
          type: "string",
          description:
            "The email body as plain text, paragraphs separated by a blank line.",
        },
        used_slots: {
          type: "array",
          items: { type: "string" },
          description:
            "The ISO values from calendar_slots that the body offers, and nothing else.",
        },
      },
    },
  },
  folder: agentsFolder,
});
