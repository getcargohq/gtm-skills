// The gate every draft passes before anything can send it. It fails closed:
// any flag means a person sees the draft, whatever the routing rule says, and
// a first touch with a flag is not sent at all.
//
// It fixes one thing silently (dashes become commas, so a dash never reaches
// a lead) and flags the rest: a phrase that reveals a machine or reads as a
// template, a time the slot step never offered, a body too short or too long,
// an exclamation mark.

import { defineScript } from "@cargo-ai/cdk";

import { countWords, replaceDashes, toHtml } from "./text";

// PLACEHOLDER: the phrases your own playbook bans belong here too. The
// playbook is what the writer is told; this list is what is checked.
const bannedPhrases = [
  "as an ai",
  "language model",
  "automated message",
  "this message was generated",
  "i hope this finds you",
  "hope this email finds you",
  "i wanted to reach out",
  "just following up",
  "circle back",
  "touching base",
  "at the end of the day",
  "game-changer",
  "synergy",
];

type Slot = { startIso: string };

export const checkDraft = defineScript(
  ({
    subject,
    bodyText,
    usedSlots,
    offeredSlots,
  }: {
    subject: string;
    bodyText: string;
    usedSlots: string[];
    offeredSlots: Slot[];
  }) => {
    const text = replaceDashes(String(bodyText || "")).trim();
    const cleanSubject = replaceDashes(String(subject || "")).trim();
    const flags: string[] = [];

    const lower = text.toLowerCase();
    for (const phrase of bannedPhrases) {
      if (lower.indexOf(phrase) >= 0) {
        flags.push("banned phrase: " + phrase);
      }
    }

    // The engine normalises ISO strings to UTC between nodes, so a slot can
    // come back as "…T19:00:00.000Z" after it was offered as "…T14:00:00-05:00".
    // Compare instants, never strings.
    const offered = (Array.isArray(offeredSlots) ? offeredSlots : []).map(
      (slot) => Date.parse(String(slot.startIso)),
    );
    for (const used of Array.isArray(usedSlots) ? usedSlots : []) {
      if (offered.indexOf(Date.parse(String(used))) < 0) {
        flags.push("slot not offered: " + used);
      }
    }

    const words = countWords(text);
    if (words < 6) {
      flags.push("too short");
    }
    if (words > 220) {
      flags.push("too long: " + words + " words");
    }
    if (text.indexOf("!") >= 0) {
      flags.push("exclamation mark");
    }

    let flagSummary = "clean";
    if (flags.length > 0) {
      flagSummary = flags.join("; ");
    }

    return {
      subject: cleanSubject,
      bodyText: text,
      bodyHtml: toHtml(text),
      flags: flags.join("; "),
      flagSummary: flagSummary,
      ok: flags.length === 0,
      words: words,
    };
  },
);
