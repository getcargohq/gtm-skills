// The loop's settings, in one place. Plain values only: the scripts under
// `infra/scripts/` import this file and are bundled into their nodes, and a
// script node cannot load the SDK.

// PLACEHOLDER: the Slack channel every reply card is posted to, as a channel id
// (C…) read from the connector's autocomplete, never a name. Locked here so no
// run can post a lead's reply anywhere else.
export const reviewChannelId = "C0123456789";

// How long the play waits for a reply to the first touch. When it runs out the
// run ends at `waitEmailEvent` and the row stays `waiting`. Cargo caps it at
// 720 hours.
export const replyWaitHours = 168;

// How long a review card waits for a click. After that it declines itself, and
// a decline sends nothing: the safe outcome.
export const reviewTimeoutMilliseconds = 3 * 24 * 60 * 60 * 1000;

export type RoutingMode = "human" | "reply" | "suppress";

// What happens to each class the classifier can return. Human Mode is the
// default for every class that deserves an answer: the draft waits for a click
// in Slack. Changing one value to "reply" lets that class send without a click
// (only when the draft also passes the gate), and that change is a reviewed
// diff and a deploy rather than a setting someone flips in a UI.
export const routingRules: Record<string, RoutingMode> = {
  super_positive_meeting: "human",
  super_positive_info: "human",
  super_positive: "human",
  positive_question: "human",
  positive_timing: "human",
  positive: "human",
  neutral: "human",
  negative_thoughtful: "human",
  negative_simple: "suppress",
  negative: "human",
  redirect: "human",
  needs_human_review: "human",
  out_of_office: "suppress",
  spam: "suppress",
  hard_stop: "suppress",
};

// Below this confidence a class routed to "reply" goes to a person anyway.
export const confidenceFloor = 0.75;

// PLACEHOLDER: the grid meeting slots are proposed on, in the sender's own time
// zone. Weekdays only, never today, `slotMinutes` long, starting on the hour
// between `firstHour` and `lastHour`. `utcOffset` is fixed, so it does not
// follow daylight saving: update it when the clocks change, or replace the
// grid with a calendar (the `calendar-slots` variation in SKILL.md).
export const meetingGrid = {
  utcOffset: "-05:00",
  firstHour: 9,
  lastHour: 16,
  slotMinutes: 30,
  daysAhead: 14,
};
