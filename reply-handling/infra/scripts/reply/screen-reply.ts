// The deterministic hard stop. It runs before any model reads the reply, so
// an opt-out or a legal threat is recorded and stopped without being
// classified, drafted or answered. A model can misread "please take me off
// your list"; a phrase list cannot.
//
// It also cuts the quoted thread off the reply, so the gate and the models see
// only the words the person wrote, and it picks up the Message-ID the answer
// threads under.
//
// The `replied` event carries a snippet of the reply (its first characters),
// not the full body. Everything downstream reads that snippet.

import { defineScript } from "@cargo-ai/cdk";

// PLACEHOLDER: add the phrases your compliance policy names. Remove one only on
// purpose, and record why.
const hardStopPhrases = [
  "unsubscribe",
  "remove me",
  "take me off",
  "stop emailing",
  "do not contact",
  "stop contacting",
  "cease and desist",
  "legal action",
  "lawyer",
  "attorney",
  "gdpr",
  "casl",
  "harassment",
  "report this as spam",
  "this is spam",
  "mark as spam",
];

type RawReply = {
  snippet?: string | null;
  actorEmail?: string;
  occurredAt?: string;
  threadUuid?: string;
};

type RawEvent = {
  snippet?: string | null;
  inboundRfcMessageId?: string | null;
};

/** Gmail quotes the thread under "On <date> <name> wrote:", Outlook under "From:". */
const stripQuotedThread = (text: string): string => {
  let result = text;
  const wroteAt = result.indexOf(" wrote:");
  if (wroteAt > 0) {
    const onAt = result.lastIndexOf("On ", wroteAt);
    if (onAt >= 0 && wroteAt - onAt < 140) {
      result = result.slice(0, onAt);
    }
  }
  const originalAt = result.indexOf("-----Original Message-----");
  if (originalAt > 0) {
    result = result.slice(0, originalAt);
  }
  const fromAt = result.indexOf("From: ");
  if (fromAt > 20) {
    result = result.slice(0, fromAt);
  }
  return result.trim();
};

export const screenReply = defineScript(
  ({ reply, events }: { reply: RawReply; events: RawEvent[] }) => {
    const newest: RawEvent =
      Array.isArray(events) && events.length > 0 ? events[0] : {};
    const text = stripQuotedThread(
      String(reply.snippet || newest.snippet || ""),
    );
    const lower = text.toLowerCase();
    const hits = hardStopPhrases.filter((phrase) => lower.indexOf(phrase) >= 0);
    return {
      text: text,
      hardStop: hits.length > 0,
      hits: hits.join(", "),
      from: String(reply.actorEmail || ""),
      at: String(reply.occurredAt || ""),
      threadUuid: String(reply.threadUuid || ""),
      inboundMessageId: String(newest.inboundRfcMessageId || ""),
    };
  },
);
