import { defineAgent } from "@cargo-ai/cdk";

import { anthropic } from "../connectors/anthropic";
import { agentsFolder } from "../folders";
import { replyClassifierPrompt } from "./reply-classifier.prompt";

// Reads one reply and returns a routing decision: one of fifteen classes, a
// confidence, and what the writer needs (tone, calendar preferences, the
// reader's first name). It decides nothing on its own: the play routes on its
// answer with the rules in `infra/settings.ts`, so changing what a class does
// never touches this prompt.
//
// It never sees an opt-out. The hard-stop script runs before it, so an
// unsubscribe is recorded and stopped without a model reading it.
//
// Temperature 0 and a JSON schema: the same reply should route the same way
// twice. No context, no tools: the classes are mechanics, not company
// knowledge.
export const replyClassifier = defineAgent("reply_classifier", {
  name: "Reply classifier",
  description:
    "Classifies one reply to an outbound email into one of fifteen classes, with confidence, tone guidance, calendar preferences and a positivity score. JSON only.",
  color: "blue",
  connector: anthropic,
  languageModel: "claude-sonnet-5", // PLACEHOLDER: your model of choice; a smaller one is enough here
  temperature: 0,
  maxSteps: 3,
  systemPrompt: replyClassifierPrompt,
  output: {
    type: "jsonSchema",
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      required: [
        "reply_class",
        "confidence",
        "reasoning",
        "compliance_flags",
        "redirect_info",
        "tone_guidelines",
        "calendar_slot_guidelines",
        "needs_calendar_slots",
        "contact_first_name",
        "reply_energy",
        "positivity_score",
      ],
      properties: {
        reply_class: {
          type: "string",
          enum: [
            "super_positive_meeting",
            "super_positive_info",
            "super_positive",
            "positive_question",
            "positive_timing",
            "positive",
            "neutral",
            "negative_thoughtful",
            "negative_simple",
            "negative",
            "redirect",
            "out_of_office",
            "needs_human_review",
            "hard_stop",
            "spam",
          ],
        },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        reasoning: { type: "string" },
        compliance_flags: {
          type: "object",
          additionalProperties: false,
          required: ["unsubscribe_requested"],
          properties: { unsubscribe_requested: { type: "boolean" } },
        },
        redirect_info: {
          anyOf: [
            { type: "null" },
            {
              type: "object",
              additionalProperties: false,
              required: ["full_name", "email", "title", "context"],
              properties: {
                full_name: { type: ["string", "null"] },
                email: { type: ["string", "null"] },
                title: { type: ["string", "null"] },
                context: { type: ["string", "null"] },
              },
            },
          ],
        },
        tone_guidelines: { type: ["string", "null"] },
        calendar_slot_guidelines: { type: ["string", "null"] },
        needs_calendar_slots: { type: "boolean" },
        contact_first_name: { type: ["string", "null"] },
        reply_energy: {
          type: ["string", "null"],
          enum: ["light_touch", "default", "deep", null],
        },
        positivity_score: {
          type: ["integer", "null"],
          minimum: 0,
          maximum: 100,
        },
      },
    },
  },
  folder: agentsFolder,
});
