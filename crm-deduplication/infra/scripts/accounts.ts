// The CRM records a search returned, read into accounts. HubSpot sends a
// property as whatever it felt like sending, so each value is coerced here once,
// and nothing downstream compares raw CRM data.

/** A company account, read from its CRM record. An absent value is `undefined`. */
export type Account = {
  id: string;
  linkedinCompanyId: string | undefined;
  /** The vanity handle LinkedIn addresses the company page by: `acme`. */
  linkedinHandle: string | undefined;
  domain: string | undefined;
  protectedBusinessId: string | undefined;
  parentCompanyId: string | undefined;
  isCustomer: boolean;
  openDealCount: number;
  contactCount: number;
  activityCount: number;
  filledPropertyCount: number;
  lastActivityAt: string | undefined;
  createdAt: string | undefined;
};

/**
 * The accounts a search's records describe, one per company. A company can
 * match several criteria and come back more than once; its first appearance is
 * the one kept.
 */
export const readAccounts = (records: unknown): Account[] => {
  if (Array.isArray(records) === false) {
    return [];
  }

  const accounts = records
    .map((record: unknown) => readAccount(record))
    .filter((account): account is Account => account !== undefined);

  return accounts.filter((account, index) => {
    return accounts.findIndex((other) => other.id === account.id) === index;
  });
};

const readAccount = (record: unknown): Account | undefined => {
  if (typeof record !== "object" || record === null) {
    return undefined;
  }

  const id = asText("id" in record ? record.id : undefined);
  if (id === undefined) {
    return undefined;
  }

  const rawProperties = "properties" in record ? record.properties : undefined;
  const propertyEntries: [string, unknown][] =
    typeof rawProperties === "object" && rawProperties !== null
      ? Object.entries(rawProperties)
      : [];
  const properties = Object.fromEntries(propertyEntries);

  const lifecycleStage = asText(properties.lifecyclestage);
  const linkedinCompanyId = asText(properties.linkedin_company_id);
  const linkedinPage = readLinkedinPage(properties.linkedin_company_page);

  return {
    id,
    // A page addressed by number carries the LinkedIn company ID itself. The
    // property wins when both are set: it is what the CRM holds as the ID.
    linkedinCompanyId:
      linkedinCompanyId !== undefined
        ? linkedinCompanyId
        : linkedinPage.companyId,
    linkedinHandle: linkedinPage.handle,
    domain: asDomain(properties.domain),
    protectedBusinessId: asText(properties.protected_business_id),
    parentCompanyId: asText(properties.parent_company_id),
    isCustomer:
      lifecycleStage !== undefined &&
      lifecycleStage.toLowerCase() === "customer",
    openDealCount: asNumber(properties.hs_num_open_deals),
    contactCount: asNumber(properties.num_associated_contacts),
    activityCount: asNumber(properties.hs_num_engagements),
    // Raw CRM values, where HubSpot's empty string is a real "unset".
    filledPropertyCount: propertyEntries.filter(([, value]) => {
      return value !== null && value !== undefined && value !== "";
    }).length,
    lastActivityAt: asText(properties.notes_last_updated),
    createdAt: asText(properties.createdate),
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
// same page — otherwise two accounts for one company disagree on an identity
// key, and a merge that should be automatic goes to review over a conflict
// that is not real.
const LINKEDIN_COMPANY_PAGE =
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

  const page = LINKEDIN_COMPANY_PAGE.exec(text);
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
