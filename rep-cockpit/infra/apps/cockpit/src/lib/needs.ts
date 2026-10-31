import type { Draft } from "./queries";

export type NeedCounts = {
  replies: number;
  drafts: number;
  followUps: number;
  noEmail: number;
};

const plural = (count: number, one: string, many: string): string => {
  if (count === 1) {
    return `1 ${one}`;
  }
  return `${count} ${many}`;
};

// What waits for the rep on an account, most urgent first. My accounts and
// the account page both say it this way.
export const needsOf = (counts: NeedCounts): string[] => {
  const needs: string[] = [];
  if (counts.replies > 0) {
    needs.push(plural(counts.replies, "reply to read", "replies to read"));
  }
  if (counts.followUps > 0) {
    needs.push(
      plural(counts.followUps, "follow-up to send", "follow-ups to send"),
    );
  }
  if (counts.drafts > 0) {
    needs.push(plural(counts.drafts, "draft to send", "drafts to send"));
  }
  if (counts.noEmail > 0) {
    needs.push(plural(counts.noEmail, "email to find", "emails to find"));
  }
  return needs;
};

// The same needs, said as what to do next, for the alert on the account page.
export const nextStepsOf = (counts: NeedCounts): string[] => {
  const steps: string[] = [];
  if (counts.replies > 0) {
    steps.push(
      `Read ${plural(counts.replies, "reply", "replies")} below, then answer or mark the meeting booked.`,
    );
  }
  if (counts.followUps > 0) {
    steps.push(
      `Send ${plural(counts.followUps, "follow-up", "follow-ups")}: each is drafted in its thread, ready to review.`,
    );
  }
  if (counts.drafts > 0) {
    steps.push(
      `Review ${plural(counts.drafts, "first email", "first emails")}, edit if needed, and press Send email.`,
    );
  }
  if (counts.noEmail > 0) {
    steps.push(
      `${plural(counts.noEmail, "person has", "people have")} no email yet: press Find email and phone on their card, or reach them on LinkedIn.`,
    );
  }
  return steps;
};

export const countNeeds = (drafts: Draft[]): NeedCounts => {
  const countStatus = (status: string): number => {
    return drafts.filter((draft) => draft.status === status).length;
  };
  return {
    replies: countStatus("replied"),
    drafts: countStatus("draft"),
    followUps: countStatus("follow_up"),
    noEmail: countStatus("no_email"),
  };
};

export const sourcingLabel = (
  sourcingStatus: string | null | undefined,
): string => {
  if (sourcingStatus === "ready") {
    return "Drafts ready";
  }
  if (sourcingStatus === "failed") {
    return "Sourcing failed";
  }
  return "Sourcing";
};
