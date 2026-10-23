import { defineAgent } from "@cargo-ai/cdk";

import { anthropic } from "../connectors/anthropic";
import { agentsFolder } from "../folders";
import { openerWriterPrompt } from "./opener-writer.prompt";

// Writes the two sentences of a first email that only this reader could
// receive: what is happening at their company, as a consequence for their
// job, and the gap. Nothing else. The rest of the email (greeting, offer, ask,
// sign-off) belongs to whatever sends it: a sequencer's template, or
// reply-handling's writer with this opener as its fact.
//
// Runs only for a person who qualified, so the pipeline never pays to write to
// someone it will not reach.
export const openerWriter = defineAgent("opener_writer", {
  name: "Opener writer",
  description:
    "Writes a two-sentence personal opener and a subject for one qualified person, from what is happening at their company and the role nobody owns. JSON only; sends nothing.",
  color: "purple",
  connector: anthropic,
  languageModel: "claude-sonnet-5", // PLACEHOLDER: your model of choice
  temperature: 0.4,
  maxSteps: 3,
  systemPrompt: openerWriterPrompt,
  capabilities: [{ slug: "context", config: { isReadOnly: true } }],
  output: {
    type: "jsonSchema",
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      required: ["subject", "opener"],
      properties: {
        subject: { type: "string" },
        opener: { type: "string" },
      },
    },
  },
  folder: agentsFolder,
});
