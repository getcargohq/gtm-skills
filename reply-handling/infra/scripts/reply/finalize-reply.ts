// What actually goes out after a click: the reviewer's edit when there is one,
// the gated draft otherwise, and whether it was edited. The reviewer's words
// are sent as written. They were approved by a person, and the gate is for
// drafts, not for people.

import { defineScript } from "@cargo-ai/cdk";

import { toHtml } from "./text";

export const finalizeReply = defineScript(
  ({
    reviewedText,
    draftText,
  }: {
    reviewedText: string;
    draftText: string;
  }) => {
    const reviewed = String(reviewedText || "").trim();
    const draft = String(draftText || "").trim();
    let text = draft;
    if (reviewed.length > 0) {
      text = reviewed;
    }
    let decision = "approved";
    if (text !== draft) {
      decision = "edited";
    }
    return {
      text: text,
      html: toHtml(text),
      decision: decision,
    };
  },
);
