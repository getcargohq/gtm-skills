// The knobs a consumer adapts. Everything else under `scripts/` is machinery
// that reads them, so an adaptation review starts and usually ends here.

/**
 * Domains thousands of unrelated companies share. One of these tells you
 * nothing, so it can neither pair two records nor score.
 */
export const parkedDomains = [
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
 * Which record survives, most decisive rule first: each scores a record and the
 * higher score wins. A record level on every rule falls through to the date
 * tiebreaks in `rankCluster`.
 */
export const survivorPrecedence = [
  (record: CrmRecord) => {
    return record.protectedId !== "" ? 1 : 0;
  },
  (record: CrmRecord) => {
    return record.isCustomer ? 1 : 0;
  },
  (record: CrmRecord) => {
    return record.openDeals;
  },
  (record: CrmRecord) => {
    return record.contacts;
  },
  (record: CrmRecord) => {
    return record.activities;
  },
  (record: CrmRecord) => {
    return record.filledProperties;
  },
];

/** One CRM account, normalized. Every comparison below reads this shape. */
export type CrmRecord = {
  id: string;
  linkedinId: string;
  linkedinUrl: string;
  domain: string;
  protectedId: string;
  parentId: string;
  isCustomer: boolean;
  openDeals: number;
  contacts: number;
  activities: number;
  filledProperties: number;
  lastActivityAt: string;
  createdAt: string;
};
