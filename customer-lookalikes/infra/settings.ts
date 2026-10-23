// The pipeline's thresholds, in one place. Plain values only: the persona
// script imports this file and is bundled into its node, and a script node
// cannot load the SDK.

// How many lookalikes each customer yields a month, at most. The researcher
// never pads: fewer come back when fewer survive the rubric.
export const lookalikesPerCustomer = 5;

// The account gate. A company goes on to the contact search only with an
// account fit at or above `accountFitFloor`, a live situation at or above
// `situationFloor`, and a tier other than "reject". Set `situationFloor` to 0
// to pursue fits with nothing happening at them now.
export const accountFitFloor = 45;
export const situationFloor = 10;

// PLACEHOLDER: the persona score. Arithmetic, not judgement, so it is a
// script rather than an agent: the persona tier the finder assigned, a
// verified email, and how recently the person took the seat. A person
// qualifies with tier 1 or 2, a `valid` email, and a score at or above
// `personaFloor`. With these numbers that is any tier 1 or 2 person with a
// verified email; recency only ranks them.
export const personaTierPoints: Record<string, number> = {
  "1": 40,
  "2": 25,
  "3": 10,
  review: 0,
  reject: 0,
};
export const verifiedEmailPoints = 20;
export const newInSeatPoints = 10;
export const newInSeatDays = 90;
export const personaFloor = 45;
