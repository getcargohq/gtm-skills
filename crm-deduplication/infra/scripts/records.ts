// CRM search results, read into one shape. HubSpot sends a property as whatever
// it felt like sending, so each value is coerced here once, and nothing
// downstream compares raw CRM data.

/** One CRM account. An absent value is `undefined`. */
export type CrmRecord = {
  id: string;
  linkedinId: string | undefined;
  linkedinUrl: string | undefined;
  domain: string | undefined;
  protectedId: string | undefined;
  parentId: string | undefined;
  isCustomer: boolean;
  openDeals: number;
  contacts: number;
  activities: number;
  filledProperties: number;
  lastActivityAt: string | undefined;
  createdAt: string | undefined;
};

/**
 * One record per company the search returned. A company can match several
 * criteria and come back more than once; its first appearance is the one kept.
 */
export const readSearchResults = (found: unknown): CrmRecord[] => {
  if (Array.isArray(found) === false) {
    return [];
  }

  const records = found
    .map((row: unknown) => readRecord(row))
    .filter((record): record is CrmRecord => record !== undefined);

  return records.filter((record, index) => {
    return records.findIndex((other) => other.id === record.id) === index;
  });
};

/**
 * A CRM record ID, normalized exactly as each search result's is — the enrolled
 * row's ID has to compare equal to the search's.
 */
export const readRecordId = (value: unknown): string | undefined => {
  return asText(value);
};

const readRecord = (row: unknown): CrmRecord | undefined => {
  if (typeof row !== "object" || row === null) {
    return undefined;
  }

  const id = readRecordId("id" in row ? row.id : undefined);
  if (id === undefined) {
    return undefined;
  }

  const properties = "properties" in row ? row.properties : undefined;
  const entries: [string, unknown][] =
    typeof properties === "object" && properties !== null
      ? Object.entries(properties)
      : [];
  const fields = Object.fromEntries(entries);
  const lifecycleStage = asText(fields.lifecyclestage);
  const linkedinIdProperty = asText(fields.linkedin_company_id);
  const linkedinPage = readLinkedinPage(fields.linkedin_company_page);

  return {
    id,
    // A page addressed by number carries the LinkedIn ID itself. The ID
    // property wins when both are set: it is what the CRM holds as the ID.
    linkedinId:
      linkedinIdProperty !== undefined
        ? linkedinIdProperty
        : linkedinPage.companyId,
    linkedinUrl: linkedinPage.handle,
    domain: asDomain(fields.domain),
    protectedId: asText(fields.protected_business_id),
    parentId: asText(fields.parent_company_id),
    isCustomer:
      lifecycleStage !== undefined &&
      lifecycleStage.toLowerCase() === "customer",
    openDeals: asNumber(fields.hs_num_open_deals),
    contacts: asNumber(fields.num_associated_contacts),
    activities: asNumber(fields.hs_num_engagements),
    // Raw CRM values, where HubSpot's empty string is a real "unset".
    filledProperties: entries.filter(([, value]) => {
      return value !== null && value !== undefined && value !== "";
    }).length,
    lastActivityAt: asText(fields.notes_last_updated),
    createdAt: asText(fields.createdate),
  };
};

const asText = (value: unknown): string | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }

  // HubSpot sends an unset property as "" about as often as it omits it. This
  // is the one place that collapses the two.
  const text = String(value).trim();
  return text === "" ? undefined : text;
};

const asNumber = (value: unknown): number => {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
};

const asDomain = (value: unknown): string | undefined => {
  const text = asText(value);
  if (text === undefined) {
    return undefined;
  }

  const domain = text
    .toLowerCase()
    .replace(/^(?:https?:\/\/)?(?:www\.)?/, "")
    .replace(/[/?#][\s\S]*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
  return domain === "" ? undefined : domain;
};

// One company page reaches a CRM as `www.`, a country or mobile subdomain, a
// sub-page such as `/about/`, or percent-encoded, and each has to read as the
// same page — otherwise two records for one company disagree on an identity key,
// and a merge that should be automatic goes to review over a conflict that is
// not real.
const COMPANY_PAGE =
  /^(?:https?:\/\/)?(?:[a-z0-9-]+\.)*linkedin\.com\/company(?:\/([^/?#]*))?(?=$|[/?#])/i;

/**
 * A LinkedIn company page read as the vanity handle LinkedIn addresses it by
 * — or, when it is addressed by number, as the company's LinkedIn ID. A value
 * that is not a company page URL is read as the handle the CRM stored.
 */
const readLinkedinPage = (
  value: unknown,
): { handle: string | undefined; companyId: string | undefined } => {
  const text = asText(value);
  if (text === undefined) {
    return { handle: undefined, companyId: undefined };
  }

  const page = COMPANY_PAGE.exec(text);
  const handle =
    page === null
      ? text
          .toLowerCase()
          .replace(/[?#].*$/, "")
          .replace(/\/+$/, "")
      : page[1] === undefined
        ? ""
        : decodePathSegment(page[1]).toLowerCase();

  if (handle === "") {
    return { handle: undefined, companyId: undefined };
  }
  return /^\d+$/.test(handle)
    ? { handle: undefined, companyId: handle }
    : { handle, companyId: undefined };
};

const decodePathSegment = (segment: string): string => {
  try {
    return decodeURIComponent(segment);
  } catch {
    // A malformed escape: compare the segment as written.
    return segment;
  }
};
