import type { Api } from "@cargo-ai/api";

import { draftsModelUuid } from "../config";
import { submitUpsert } from "./cargo";
import { hasText, type Claim, type Draft } from "./queries";
import type { Rep } from "./rep";

export const orEmpty = (value: string | null | undefined): string => {
  if (hasText(value)) {
    return value;
  }
  return "";
};

// SQL returns numbers as strings; a missing count is zero.
export const countOf = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined) {
    return 0;
  }
  return Number(value);
};

const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

// The rep edits plain text; the mail goes out as paragraphs.
export const toHtml = (text: string): string => {
  return text
    .split(/\n\s*\n/)
    .map(
      (paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
};

export const replySubject = (subject: string): string => {
  if (/^re:/i.test(subject)) {
    return subject;
  }
  return `Re: ${subject}`;
};

// A row the rep can still edit and send: a first touch or a follow-up.
export const isOpenDraft = (status: string): boolean => {
  return status === "draft" || status === "no_email" || status === "follow_up";
};

type StatusBadge = {
  label: string;
  variant: "default" | "secondary" | "outline";
};

// What a card says about where the thread stands. Solid for what needs the
// rep now, muted for what is waiting on someone else.
export const statusBadge = (status: string): StatusBadge => {
  if (status === "replied") {
    return { label: "Replied", variant: "default" };
  }
  if (status === "follow_up") {
    return { label: "Follow-up ready", variant: "default" };
  }
  if (status === "no_email") {
    return { label: "No email yet", variant: "outline" };
  }
  if (status === "sent") {
    return { label: "Waiting for a reply", variant: "outline" };
  }
  if (status === "no_reply") {
    return { label: "No reply", variant: "outline" };
  }
  if (status === "meeting_booked") {
    return { label: "Meeting booked", variant: "secondary" };
  }
  return { label: "Draft", variant: "secondary" };
};

const attentionOrder = [
  "replied",
  "follow_up",
  "draft",
  "no_email",
  "sent",
  "no_reply",
  "meeting_booked",
];

// Cards that need the rep first: replies to read, then sends to make.
export const byAttention = (left: Draft, right: Draft): number => {
  return (
    attentionOrder.indexOf(left.status) - attentionOrder.indexOf(right.status)
  );
};

// Why Send is off for this draft, or undefined when it can go.
export const sendBlocker = (
  rep: Rep | undefined,
  draft: Draft,
  claim: Claim | undefined,
): string | undefined => {
  if (rep === undefined) {
    return "Loading who you are.";
  }
  if (rep.mailboxUuid === undefined) {
    return `No mailbox is attached to ${rep.email}. Ask an admin to attach one to your member.`;
  }
  if (!hasText(draft.contact_email)) {
    return "No work email yet: try Find email and phone.";
  }
  if (claim === undefined || !hasText(claim.account_id)) {
    return "The claim is still being recorded.";
  }
  return undefined;
};

// A reply reaches the mailbox minutes after it is sent, and can land after
// the play drafted the follow-up. Before a follow-up goes out, ask the mailbox
// whether the email it follows got one: if so, mark the card replied and send
// nothing.
export const stopIfReplied = async (api: Api, draft: Draft): Promise<void> => {
  const { events } = await api.mailboxManagement.event.list({
    messageUuid: orEmpty(draft.message_uuid),
    kinds: ["replied"],
    limit: 1,
  });
  if (events.length === 0) {
    return;
  }
  await submitUpsert(api, draftsModelUuid, "contact_id", draft.contact_id, {
    status: "replied",
    reply_snippet: orEmpty(events[0].snippet),
    replied_at: events[0].occurredAt,
  });
  throw new Error(
    `${draft.contact_name} replied before this follow-up went out, so nothing was sent. Their reply shows here in a minute.`,
  );
};
