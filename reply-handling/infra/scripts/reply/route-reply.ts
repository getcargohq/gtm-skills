// Routing: the classifier's answer in, one of human, reply or suppress out,
// with the reason in words for the card and the row.
//
// The rules table and the confidence floor live in `infra/settings.ts`. This
// script only applies them, and in this order: an unsubscribe flag always
// suppresses; a class routed to "reply" goes to a person anyway below the
// floor; anything unknown goes to a person.

import { defineScript } from "@cargo-ai/cdk";

import { confidenceFloor, routingRules } from "../../settings";

type Verdict = {
  reply_class?: string;
  confidence?: number;
  reasoning?: string;
  compliance_flags?: { unsubscribe_requested?: boolean };
  redirect_info?: unknown;
  tone_guidelines?: string | null;
  calendar_slot_guidelines?: string | null;
  needs_calendar_slots?: boolean;
  contact_first_name?: string | null;
  reply_energy?: string | null;
  positivity_score?: number | null;
};

export const routeReply = defineScript(
  ({
    verdict,
    replyText,
    fallbackFirstName,
  }: {
    verdict: Verdict;
    replyText: string;
    fallbackFirstName: string;
  }) => {
    const replyClass = String(verdict.reply_class || "needs_human_review");
    const confidence = Number(verdict.confidence || 0);
    const flags = verdict.compliance_flags || {};

    let mode = routingRules[replyClass] || "human";
    let reason = "rule for " + replyClass + " is " + mode;
    if (flags.unsubscribe_requested === true) {
      mode = "suppress";
      reason = "unsubscribe requested";
    } else if (mode === "reply" && confidence < confidenceFloor) {
      mode = "human";
      reason =
        "confidence " +
        confidence.toFixed(2) +
        " is below the floor " +
        confidenceFloor;
    }

    let positivity = -1;
    if (
      verdict.positivity_score !== null &&
      verdict.positivity_score !== undefined
    ) {
      positivity = Number(verdict.positivity_score);
    }

    let slotCount = 0;
    if (verdict.needs_calendar_slots === true) {
      slotCount = 3;
    }

    // The slot step reads weekday words and dates. The classifier is asked to
    // keep the reader's own words, and the reply rides along as a backstop,
    // because a weekday resolved to the wrong date once produced a draft that
    // refused the very day the reader asked for.
    const guidance = (
      String(verdict.calendar_slot_guidelines || "") +
      " | " +
      replyText
    ).slice(0, 400);

    return {
      mode: mode,
      reason: reason,
      replyClass: replyClass,
      confidence: confidence,
      positivity: positivity,
      slotCount: slotCount,
      guidance: guidance,
      tone: String(verdict.tone_guidelines || ""),
      energy: String(verdict.reply_energy || "default"),
      contactFirstName: String(
        verdict.contact_first_name || fallbackFirstName || "",
      ),
      reasoning: String(verdict.reasoning || ""),
      redirect: JSON.stringify(verdict.redirect_info || null),
    };
  },
);
