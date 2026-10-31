import { defineAgent } from "@cargo-ai/cdk";

import { anthropic } from "../connectors/anthropic";
import { agentsFolder } from "../folders";
import { firstTouchWriterPrompt } from "./first-touch-writer.prompt";

// The writer: one draft per sourced person, called by the claim tool.
//
// `context` (read-only) is what makes the draft sound like the company: the
// positioning, the personas and the proof live there. Without it the prompt's
// "read the positioning" reads nothing, and every draft pitches a product that
// sounds plausible for everyone.
//
// No webSearch and no writable model. The claim tool hands the writer what it
// knows about the account and the person, and persists the answer itself, so
// a missing draft is always a failed step, never a choice the agent made.
export const firstTouchWriter = defineAgent("rep_cockpit_first_touch_writer", {
  name: "First-touch writer",
  description:
    "Drafts one first-touch email per sourced person for a rep to review and send from the cockpit.",
  color: "yellow",
  connector: anthropic,
  languageModel: "claude-sonnet-5", // PLACEHOLDER: your model of choice
  temperature: 0.5,
  systemPrompt: firstTouchWriterPrompt,
  output: {
    type: "jsonSchema",
    jsonSchema: {
      type: "object",
      properties: {
        subject: {
          type: "string",
          description: "At most five words, about their world.",
        },
        body: {
          type: "string",
          description:
            "50 to 90 words, plain text, ending on one commercially useful question.",
        },
        why_now: {
          type: "string",
          description:
            "One or two sentences for the rep: the read on this account and person, naming the signals behind it.",
        },
      },
      required: ["subject", "body", "why_now"],
      additionalProperties: false,
    },
  },
  // Read up to four context files, then write: five steps is the per-person
  // ceiling on what a draft can cost.
  maxSteps: 5,
  capabilities: [{ slug: "context", config: { isReadOnly: true } }],
  evaluator: {
    rubric:
      "Is every fact in the draft present in the input, with no qualification leak, no invented pain or customer, a subject of at most five words, a body of 50 to 90 words, and one commercially useful closing question?",
    threshold: 0.8,
  },
  folder: agentsFolder,
});
