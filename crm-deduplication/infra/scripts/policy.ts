// The knobs a consumer adapts. The rest of `scripts/` is machinery that reads
// them, so an adaptation review starts, and usually ends, here.

import type { CrmRecord } from "./records";

/**
 * Domains thousands of unrelated companies share. One of these tells you
 * nothing, so it can neither pair two records nor score.
 */
export const PARKED_DOMAINS = [
  "bit.ly",
  "facebook.com",
  "github.com",
  "google.com",
  "hubs.ly",
  "instagram.com",
  "linkedin.com",
  "linktr.ee",
  "substack.com",
  "uk.com",
];

/**
 * Which record survives a merge, most decisive rule first. Each rule scores a
 * record and the higher score wins; `rankSurvivors` breaks what is still tied.
 */
export const SURVIVOR_PRECEDENCE: ((record: CrmRecord) => number)[] = [
  (record) => (record.protectedId !== undefined ? 1 : 0),
  (record) => (record.isCustomer === true ? 1 : 0),
  (record) => record.openDeals,
  (record) => record.contacts,
  (record) => record.activities,
  (record) => record.filledProperties,
];
