import type { MailboxManagement } from "@cargo-ai/api";

export const replySubject = (subject: string): string => {
  if (/^re:\s/i.test(subject) === true) {
    return subject;
  }

  return `Re: ${subject}`;
};

export const collectReferences = (
  messages: MailboxManagement.Message[],
  inboundReplies: MailboxManagement.Event[],
): string[] => {
  const ids: string[] = [];

  const push = (id: string): void => {
    if (ids.indexOf(id) === -1) {
      ids.push(id);
    }
  };

  for (const message of messages) {
    push(message.rfcMessageId);
  }

  for (const event of inboundReplies) {
    if (event.inboundRfcMessageId !== null) {
      push(event.inboundRfcMessageId);
    }
  }

  return ids;
};

export const lastInboundRfcId = (
  inboundReplies: MailboxManagement.Event[],
): string | undefined => {
  let last: string | undefined;

  for (const event of inboundReplies) {
    if (event.inboundRfcMessageId !== null) {
      last = event.inboundRfcMessageId;
    }
  }

  return last;
};

export const textToHtml = (text: string): string => {
  const escaped = text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

  return `<p>${escaped.replaceAll("\n", "<br/>")}</p>`;
};

export const formatWhen = (value: string | Date): string => {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};
