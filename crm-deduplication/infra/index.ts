import {
  defineConnector,
  defineModel,
  definePlay,
  defineWorkflowFromNodes,
} from "@cargo-ai/cdk";

const connectorCacheTtlMilliseconds = 15 * 24 * 60 * 60 * 1000;

// Checked HubSpot example. For Salesforce or Attio, replace the connector
// integration, account extractor, record-ID field, search action, merge
// action, and property slugs. Keep one CRM shape in this file.
const crm = defineConnector("crm", {
  integration: "hubspot",
  adopt: true,
  cacheTtlMilliseconds: connectorCacheTtlMilliseconds,
});

export const crmAccounts = defineModel("crm_accounts", {
  connector: crm,
  extractSlug: "fetchRecords",
  config: { objectType: "companies", columnSelectionMode: "all" },
  schedule: { type: "cron", cron: "0 * * * *" },
});

export const crmContacts = defineModel("crm_contacts", {
  connector: crm,
  extractSlug: "fetchRecords",
  config: { objectType: "contacts", columnSelectionMode: "all" },
  schedule: { type: "cron", cron: "0 * * * *" },
});

const manualReviewConnector = defineConnector("manual_review", {
  integration: "slack",
  adopt: true,
  cacheTtlMilliseconds: connectorCacheTtlMilliseconds,
});
export type AccountCandidate = {
  id: string;
  linkedinId?: string;
  linkedinUrl?: string;
  domain?: string;
  protectedId?: string;
  isJunkDomain?: boolean;
  parentOrSubsidiaryWarning?: boolean;
  isCustomer: boolean;
  openOpportunities: number;
  contacts: number;
  activities: number;
  populatedProperties: number;
  lastActivityAt?: string;
  createdAt: string;
};

export type ContactCandidate = {
  id: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  linkedinPersonId?: string;
  jobTitle?: string;
  primaryAssociatedCompanyId?: string;
  associatedDeals: number;
  activities: number;
  populatedProperties: number;
  createdAt: string;
};

export const normalizeDomain = (value?: string) =>
  value
    ?.trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0]
    .replace(/:\d+$/, "")
    .replace(/\.$/, "") ?? "";

export const normalizeLinkedInId = (value?: string) => value?.trim() ?? "";

export const normalizeLinkedInHandle = (value?: string) =>
  value
    ?.trim()
    .toLowerCase()
    .replace(/^(?:https?:\/\/)?(?:www\.)?linkedin\.com\/company\//, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "") || "";

export const normalizeEmail = (value?: string) =>
  value?.trim().toLowerCase() ?? "";

export const normalizeLinkedInPersonUrl = (value?: string) =>
  value
    ?.trim()
    .toLowerCase()
    .replace(/^(?:https?:\/\/)?(?:[\w-]+\.)?linkedin\.com\/in\//, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "") || "";

export const normalizePhone = (value?: string) => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return "";
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("00") && digits.length > 4)
    return `+${digits.slice(2)}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return digits;
};

export const phoneMatchKeys = (value?: string) => {
  const trimmed = value?.trim() ?? "";
  const digits = trimmed.replace(/[^\d]/g, "");
  const keys = new Set<string>();
  const normalized = normalizePhone(value);
  if (normalized) keys.add(normalized);
  if (digits) keys.add(digits);
  if (digits.startsWith("00") && digits.length > 4) {
    keys.add(`+${digits.slice(2)}`);
  }
  if (
    (digits.length === 10 || digits.length === 11) &&
    digits.startsWith("0")
  ) {
    keys.add(`+44${digits.slice(1)}`);
  }
  if (digits.length === 10 && digits.startsWith("0")) {
    keys.add(`+33${digits.slice(1)}`);
  }
  if (digits.length === 10 && !digits.startsWith("0")) {
    keys.add(`+1${digits}`);
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    keys.add(`+${digits}`);
  }
  return [...keys].filter(Boolean);
};

const valuesOverlap = (left: string[], right: string[]) =>
  left.some((value) => right.includes(value));

const genericEmailLocalParts = new Set([
  "admin",
  "contact",
  "hello",
  "info",
  "office",
  "sales",
  "support",
  "team",
]);

export const isGenericEmail = (value?: string) => {
  const email = normalizeEmail(value);
  const localPart = email.split("@")[0] ?? "";
  return genericEmailLocalParts.has(localPart);
};

export const selectSurvivor = (records: AccountCandidate[]) =>
  [...records].sort(
    (a, b) =>
      Number(Boolean(b.protectedId)) - Number(Boolean(a.protectedId)) ||
      Number(b.isCustomer) - Number(a.isCustomer) ||
      b.openOpportunities - a.openOpportunities ||
      b.contacts - a.contacts ||
      b.activities - a.activities ||
      b.populatedProperties - a.populatedProperties ||
      (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? "") ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  )[0];

export const classifyCluster = (records: AccountCandidate[]) => {
  if (records.length < 2)
    throw new Error("Duplicate clusters require at least two records");
  if (records.some((record) => !record.id.trim()))
    throw new Error("Every duplicate candidate requires a non-empty record ID");
  if (
    new Set(records.map((record) => record.id.trim())).size !== records.length
  )
    throw new Error("Duplicate clusters require distinct source record IDs");

  const linkedinIds = new Set(
    records
      .map((record) => normalizeLinkedInId(record.linkedinId))
      .filter(Boolean),
  );
  const linkedinHandles = new Set(
    records
      .map((record) => normalizeLinkedInHandle(record.linkedinUrl))
      .filter(Boolean),
  );
  const domains = new Set(
    records.map((record) => normalizeDomain(record.domain)).filter(Boolean),
  );
  const protectedIds = new Set(
    records.map((record) => record.protectedId?.trim()).filter(Boolean),
  );
  const identityConflict =
    linkedinIds.size > 1 || linkedinHandles.size > 1 || domains.size > 1;
  const protectedIdConflict = protectedIds.size > 1;
  const hasJunkDomain = records.some((record) => record.isJunkDomain);
  const hasParentOrSubsidiaryWarning = records.some(
    (record) => record.parentOrSubsidiaryWarning,
  );
  const matchClass =
    identityConflict || protectedIdConflict
      ? "conflict"
      : hasParentOrSubsidiaryWarning
        ? "parent_or_subsidiary_review"
        : linkedinIds.size === 1 &&
            records.every((record) => normalizeLinkedInId(record.linkedinId))
          ? "exact_unique_linkedin"
          : linkedinHandles.size === 1 &&
              records.every((record) =>
                normalizeLinkedInHandle(record.linkedinUrl),
              )
            ? "linkedin_url_review"
            : hasJunkDomain
              ? "junk_domain_review"
              : domains.size === 1 &&
                  records.every((record) => normalizeDomain(record.domain))
                ? "domain_review"
                : "conflict";

  return {
    matchClass,
    identityConflict,
    protectedIdConflict,
    hasJunkDomain,
    hasParentOrSubsidiaryWarning,
    survivor: selectSurvivor(records),
  };
};

export const selectContactSurvivor = (records: ContactCandidate[]) =>
  [...records].sort(
    (a, b) =>
      b.associatedDeals - a.associatedDeals ||
      b.activities - a.activities ||
      a.createdAt.localeCompare(b.createdAt) ||
      b.populatedProperties - a.populatedProperties ||
      a.id.localeCompare(b.id),
  )[0];

export const classifyContactCluster = (records: ContactCandidate[]) => {
  if (records.length < 2)
    throw new Error("Duplicate contact clusters require at least two records");
  if (records.some((record) => !record.id.trim()))
    throw new Error(
      "Every duplicate contact candidate requires a non-empty record ID",
    );
  if (
    new Set(records.map((record) => record.id.trim())).size !== records.length
  )
    throw new Error(
      "Duplicate contact clusters require distinct source record IDs",
    );

  const linkedinPersonIds = new Set(
    records
      .map((record) => normalizeLinkedInId(record.linkedinPersonId))
      .filter(Boolean),
  );
  const linkedinUrls = new Set(
    records
      .map((record) => normalizeLinkedInPersonUrl(record.linkedinUrl))
      .filter(Boolean),
  );
  const emails = new Set(
    records.map((record) => normalizeEmail(record.email)).filter(Boolean),
  );
  const phoneKeysByRecord = records.map((record) =>
    phoneMatchKeys(record.phone),
  );
  const conflictingLinkedInPersonIds = linkedinPersonIds.size > 1;
  const conflictingLinkedInIdentity =
    conflictingLinkedInPersonIds || linkedinUrls.size > 1;
  const hasGenericOrSharedEmail =
    records.some((record) => isGenericEmail(record.email)) ||
    (emails.size === 1 && conflictingLinkedInIdentity);
  const hasExactLinkedInPersonId =
    linkedinPersonIds.size === 1 &&
    records.every((record) => normalizeLinkedInId(record.linkedinPersonId));
  const hasExactLinkedInUrl =
    linkedinUrls.size === 1 &&
    records.every((record) => normalizeLinkedInPersonUrl(record.linkedinUrl));
  const hasExactEmail =
    emails.size === 1 &&
    records.every((record) => normalizeEmail(record.email)) &&
    !hasGenericOrSharedEmail;
  const hasSharedPhone =
    phoneKeysByRecord.every((keys) => keys.length > 0) &&
    phoneKeysByRecord
      .slice(1)
      .every((keys) => valuesOverlap(phoneKeysByRecord[0] ?? [], keys));
  const highConfidenceEdges = records.map(() => new Set<number>());
  for (let leftIndex = 0; leftIndex < records.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < records.length;
      rightIndex += 1
    ) {
      const left = records[leftIndex];
      const right = records[rightIndex];
      const samePersonId =
        normalizeLinkedInId(left.linkedinPersonId) &&
        normalizeLinkedInId(left.linkedinPersonId) ===
          normalizeLinkedInId(right.linkedinPersonId);
      const sameLinkedInUrl =
        normalizeLinkedInPersonUrl(left.linkedinUrl) &&
        normalizeLinkedInPersonUrl(left.linkedinUrl) ===
          normalizeLinkedInPersonUrl(right.linkedinUrl) &&
        !(
          normalizeLinkedInId(left.linkedinPersonId) &&
          normalizeLinkedInId(right.linkedinPersonId) &&
          normalizeLinkedInId(left.linkedinPersonId) !==
            normalizeLinkedInId(right.linkedinPersonId)
        );
      const sameEmail =
        normalizeEmail(left.email) &&
        normalizeEmail(left.email) === normalizeEmail(right.email) &&
        !isGenericEmail(left.email) &&
        !isGenericEmail(right.email) &&
        !conflictingLinkedInIdentity;
      if (samePersonId || sameLinkedInUrl || sameEmail) {
        highConfidenceEdges[leftIndex].add(rightIndex);
        highConfidenceEdges[rightIndex].add(leftIndex);
      }
    }
  }
  const seen = new Set<number>([0]);
  const queue = [0];
  while (queue.length) {
    const current = queue.shift() ?? 0;
    for (const next of highConfidenceEdges[current]) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  const hasTransitiveHighConfidenceChain =
    seen.size === records.length &&
    !conflictingLinkedInIdentity &&
    !hasGenericOrSharedEmail &&
    records.length > 2 &&
    !(hasExactLinkedInPersonId || hasExactLinkedInUrl || hasExactEmail);
  const hasPhoneOnly =
    hasSharedPhone &&
    !hasExactLinkedInPersonId &&
    !hasExactLinkedInUrl &&
    !hasExactEmail &&
    !hasTransitiveHighConfidenceChain;

  const matchClass = hasExactLinkedInPersonId
    ? "exact_linkedin_person_id"
    : hasExactLinkedInUrl && !conflictingLinkedInPersonIds
      ? "exact_linkedin_url"
      : hasExactEmail && !conflictingLinkedInIdentity
        ? "exact_non_generic_email"
        : hasTransitiveHighConfidenceChain
          ? "transitive_high_confidence_chain"
          : hasPhoneOnly
            ? "phone_only_review"
            : hasGenericOrSharedEmail
              ? "generic_or_shared_email_review"
              : conflictingLinkedInIdentity
                ? "conflicting_linkedin_identity_review"
                : "low_confidence_review";

  return {
    matchClass,
    conflictingLinkedInPersonIds,
    conflictingLinkedInIdentity,
    hasGenericOrSharedEmail,
    hasTransitiveHighConfidenceChain,
    survivor: selectContactSurvivor(records),
  };
};

const expression = (value: string) => ({
  kind: "templateExpression" as const,
  expression: value,
  instructTo: "none",
  fromRecipe: false,
});

const prepareDuplicateEvidenceScript = `
const source = nodes.start;
const found = Array.isArray(nodes.find_duplicate_companies)
  ? nodes.find_duplicate_companies
  : [];

const text = (value) =>
  value === null || value === undefined ? "" : String(value).trim();
const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const domain = (value) =>
  text(value)
    .toLowerCase()
    .replace(/^https?:\\/\\//, "")
    .replace(/^www\\./, "")
    .split(/[/?#]/)[0]
    .replace(/:\\d+$/, "")
    .replace(/\\.$/, "");
const linkedinHandle = (value) =>
  text(value)
    .toLowerCase()
    .replace(/^(?:https?:\\/\\/)?(?:www\\.)?linkedin\\.com\\/company\\//, "")
    .replace(/[?#].*$/, "")
    .replace(/\\/+$/, "");
const genericDomains = new Set([
  "bit.ly",
  "facebook.com",
  "github.com",
  "google.com",
  "hubs.ly",
  "instagram.com",
  "linktr.ee",
  "linkedin.com",
  "substack.com",
  "uk.com",
]);

const sourceId = text(source.hs_object_id);
const liveSource = found.find((record) => text(record && record.id) === sourceId);
if (!liveSource) {
  return {
    sourceFound: false,
    duplicateCount: 0,
    cluster: [],
    candidateEvidence: [],
    exactLinkedinId: false,
    exactLinkedinUrl: false,
    exactDomain: false,
    identityConflict: false,
    protectedIdConflict: false,
    parentOrSubsidiaryWarning: false,
    autoEligible: false,
  };
}

const unique = new Map([[sourceId, liveSource]]);
for (const record of found) {
  const id = text(record && record.id);
  if (id && id !== sourceId) unique.set(id, record);
}

const records = [...unique.values()];
const normalized = records.map((record) => {
  const properties = record.properties || {};
  const populatedProperties = Object.values(properties).filter(
    (value) => value !== null && value !== undefined && value !== "",
  ).length;
  return {
    id: text(record.id),
    linkedinId: text(properties.linkedin_company_id),
    linkedinUrl: linkedinHandle(properties.linkedin_company_page),
    domain: domain(properties.domain),
    protectedId: text(properties.protected_business_id),
    parentId: text(properties.parent_company_id),
    customer: Number(text(properties.lifecyclestage).toLowerCase() === "customer"),
    openDeals: number(properties.hs_num_open_deals),
    contacts: number(properties.num_associated_contacts),
    activities: number(properties.hs_num_engagements),
    populatedProperties,
    lastActivityAt: text(properties.notes_last_updated),
    createdAt: text(properties.createdate),
  };
});
const reference = normalized[0];
const candidates = normalized.slice(1).filter((candidate) => {
  const linkedinIdMatch =
    reference.linkedinId && candidate.linkedinId === reference.linkedinId;
  const linkedinUrlMatch =
    reference.linkedinUrl && candidate.linkedinUrl === reference.linkedinUrl;
  const domainMatch =
    reference.domain &&
    !genericDomains.has(reference.domain) &&
    candidate.domain === reference.domain;
  return Boolean(linkedinIdMatch || linkedinUrlMatch || domainMatch);
});
const cluster = [reference, ...candidates];
const distinct = (key) =>
  new Set(cluster.map((record) => record[key]).filter(Boolean));
const linkedinIds = distinct("linkedinId");
const linkedinUrls = distinct("linkedinUrl");
const domains = distinct("domain");
const protectedIds = distinct("protectedId");
const recordIds = new Set(cluster.map((record) => record.id));
const parentOrSubsidiaryWarning = cluster.some(
  (record) => record.parentId && recordIds.has(record.parentId),
);
const exactLinkedinId = Boolean(
  reference.linkedinId &&
    candidates.length > 0 &&
    candidates.every((candidate) => candidate.linkedinId === reference.linkedinId),
);
const exactLinkedinUrl = Boolean(
  reference.linkedinUrl &&
    candidates.length > 0 &&
    candidates.every((candidate) => candidate.linkedinUrl === reference.linkedinUrl),
);
const exactDomain = Boolean(
  reference.domain &&
    !genericDomains.has(reference.domain) &&
    candidates.length > 0 &&
    candidates.every((candidate) => candidate.domain === reference.domain),
);
const identityConflict =
  linkedinIds.size > 1 || linkedinUrls.size > 1 || domains.size > 1;
const protectedIdConflict = protectedIds.size > 1;

return {
  sourceFound: true,
  duplicateCount: candidates.length,
  cluster,
  candidateEvidence: cluster.map((record) => ({
    id: record.id,
    linkedinId: record.linkedinId,
    linkedinUrl: record.linkedinUrl,
    domain: record.domain,
    protectedIdPresent: Boolean(record.protectedId),
    parentId: record.parentId,
  })),
  exactLinkedinId,
  exactLinkedinUrl,
  exactDomain,
  identityConflict,
  protectedIdConflict,
  parentOrSubsidiaryWarning,
  autoEligible:
    exactLinkedinId &&
    !identityConflict &&
    !protectedIdConflict &&
    !parentOrSubsidiaryWarning,
};
`;

const selectDuplicateSurvivorScript = `
const cluster = Array.isArray(nodes.prepare_duplicate_evidence.result.cluster)
  ? nodes.prepare_duplicate_evidence.result.cluster
  : [];
const ordered = [...cluster].sort((left, right) =>
  Number(Boolean(right.protectedId)) - Number(Boolean(left.protectedId)) ||
  right.customer - left.customer ||
  right.openDeals - left.openDeals ||
  right.contacts - left.contacts ||
  right.activities - left.activities ||
  right.populatedProperties - left.populatedProperties ||
  right.lastActivityAt.localeCompare(left.lastActivityAt) ||
  left.createdAt.localeCompare(right.createdAt) ||
  left.id.localeCompare(right.id)
);
return {
  primaryId: ordered[0] ? ordered[0].id : "",
  idsToMerge: ordered.slice(1).map((record) => record.id),
};
`;

const prepareContactSearchVariantsScript = `
const source = nodes.start;
const text = (value) =>
  value === null || value === undefined ? "" : String(value).trim();
const linkedinPersonUrl = (value) =>
  text(value)
    .toLowerCase()
    .replace(/^(?:https?:\\/\\/)?(?:[\\w-]+\\.)?linkedin\\.com\\/in\\//, "")
    .replace(/[?#].*$/, "")
    .replace(/\\/+$/, "");

const handle = linkedinPersonUrl(source.linkedin_url);
const linkedinUrlVariants = handle
  ? [
      "https://linkedin.com/in/" + handle,
      "https://linkedin.com/in/" + handle + "/",
      "https://www.linkedin.com/in/" + handle,
      "https://www.linkedin.com/in/" + handle + "/",
    ]
  : [];

return {
  sourceId: text(source.hs_object_id),
  linkedinPersonId: text(source.linkedin_person_id),
  linkedinUrlVariants,
  email: text(source.email).toLowerCase(),
  phone: text(source.phone),
};
`;

const prepareContactTransitiveSearchScript = `
const source = nodes.start;
const found = Array.isArray(nodes.find_duplicate_contacts)
  ? nodes.find_duplicate_contacts
  : [];
const text = (value) =>
  value === null || value === undefined ? "" : String(value).trim();
const linkedinPersonUrl = (value) =>
  text(value)
    .toLowerCase()
    .replace(/^(?:https?:\\/\\/)?(?:[\\w-]+\\.)?linkedin\\.com\\/in\\//, "")
    .replace(/[?#].*$/, "")
    .replace(/\\/+$/, "");
const urlVariants = (value) => {
  const handle = linkedinPersonUrl(value);
  return handle
    ? [
        "https://linkedin.com/in/" + handle,
        "https://linkedin.com/in/" + handle + "/",
        "https://www.linkedin.com/in/" + handle,
        "https://www.linkedin.com/in/" + handle + "/",
      ]
    : [];
};
const records = [source, ...found.map((record) => record.properties || {})];
const unique = (values) => [...new Set(values.filter(Boolean))];

return {
  linkedinPersonIds: unique(records.map((record) => text(record.linkedin_person_id))),
  linkedinUrlVariants: unique(records.flatMap((record) => urlVariants(record.linkedin_url))),
  emails: unique(records.map((record) => text(record.email).toLowerCase())),
  phones: unique(records.map((record) => text(record.phone))),
};
`;

const prepareContactDuplicateEvidenceScript = `
const source = nodes.start;
const directFound = Array.isArray(nodes.find_duplicate_contacts)
  ? nodes.find_duplicate_contacts
  : [];
const transitiveFound = Array.isArray(nodes.find_transitive_duplicate_contacts)
  ? nodes.find_transitive_duplicate_contacts
  : [];
const found = [...directFound, ...transitiveFound];

const text = (value) =>
  value === null || value === undefined ? "" : String(value).trim();
const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const email = (value) => text(value).toLowerCase();
const linkedinPersonUrl = (value) =>
  text(value)
    .toLowerCase()
    .replace(/^(?:https?:\\/\\/)?(?:[\\w-]+\\.)?linkedin\\.com\\/in\\//, "")
    .replace(/[?#].*$/, "")
    .replace(/\\/+$/, "");
const phone = (value) => {
  const raw = text(value);
  if (!raw) return "";
  const digits = raw.replace(/[^\\d]/g, "");
  if (!digits) return "";
  if (raw.startsWith("+")) return "+" + digits;
  if (digits.startsWith("00") && digits.length > 4) return "+" + digits.slice(2);
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  if (digits.length === 10) return "+1" + digits;
  return digits;
};
const phoneKeys = (value) => {
  const raw = text(value);
  const digits = raw.replace(/[^\\d]/g, "");
  const keys = new Set();
  const normalized = phone(value);
  if (normalized) keys.add(normalized);
  if (digits) keys.add(digits);
  if (digits.startsWith("00") && digits.length > 4) keys.add("+" + digits.slice(2));
  if ((digits.length === 10 || digits.length === 11) && digits.startsWith("0")) {
    keys.add("+44" + digits.slice(1));
  }
  if (digits.length === 10 && digits.startsWith("0")) keys.add("+33" + digits.slice(1));
  if (digits.length === 10 && !digits.startsWith("0")) keys.add("+1" + digits);
  if (digits.length === 11 && digits.startsWith("1")) keys.add("+" + digits);
  return [...keys].filter(Boolean);
};
const overlaps = (left, right) => left.some((value) => right.includes(value));
const genericEmailLocalParts = new Set([
  "admin",
  "contact",
  "hello",
  "info",
  "office",
  "sales",
  "support",
  "team",
]);
const isGenericEmail = (value) => {
  const normalized = email(value);
  const localPart = normalized.split("@")[0] || "";
  return genericEmailLocalParts.has(localPart);
};

const sourceId = text(source.hs_object_id);
const liveSource = found.find((record) => text(record && record.id) === sourceId);
if (!liveSource) {
  return {
    sourceFound: false,
    duplicateCount: 0,
    cluster: [],
    candidateEvidence: [],
    exactLinkedinPersonId: false,
    exactLinkedinUrl: false,
    exactNonGenericEmail: false,
    phoneOnly: false,
    conflictingLinkedinPersonIds: false,
    conflictingLinkedinIdentity: false,
    genericOrSharedEmail: false,
    autoEligible: false,
  };
}

const unique = new Map([[sourceId, liveSource]]);
for (const record of found) {
  const id = text(record && record.id);
  if (id && id !== sourceId) unique.set(id, record);
}

const records = [...unique.values()];
const normalized = records.map((record) => {
  const properties = record.properties || {};
  const populatedProperties = Object.values(properties).filter(
    (value) => value !== null && value !== undefined && value !== "",
  ).length;
  return {
    id: text(record.id),
    email: email(properties.email),
    phone: phone(properties.phone),
    phoneKeys: phoneKeys(properties.phone),
    linkedinUrl: linkedinPersonUrl(properties.linkedin_url),
    linkedinPersonId: text(properties.linkedin_person_id),
    firstName: text(properties.firstname),
    lastName: text(properties.lastname),
    jobTitle: text(properties.jobtitle),
    primaryAssociatedCompanyId: text(properties.associatedcompanyid),
    associatedDeals: number(properties.num_associated_deals),
    activities: number(properties.hs_sales_email_last_replied) +
      number(properties.num_contacted_notes),
    populatedProperties,
    createdAt: text(properties.createdate),
    lastModifiedAt: text(properties.lastmodifieddate),
    rawValues: {
      email: text(properties.email),
      phone: text(properties.phone),
      linkedin_url: text(properties.linkedin_url),
      linkedin_person_id: text(properties.linkedin_person_id),
      jobtitle: text(properties.jobtitle),
      associatedcompanyid: text(properties.associatedcompanyid),
    },
  };
});
const reference = normalized[0];
const sharesSupportedKey = (left, right) => {
  const linkedinPersonIdMatch =
    left.linkedinPersonId && left.linkedinPersonId === right.linkedinPersonId;
  const linkedinUrlMatch =
    left.linkedinUrl && left.linkedinUrl === right.linkedinUrl;
  const emailMatch = left.email && left.email === right.email;
  const phoneMatch = left.phone && left.phone === right.phone;
  const phoneVariantMatch =
    left.phoneKeys.length > 0 && overlaps(left.phoneKeys, right.phoneKeys);
  return Boolean(
    linkedinPersonIdMatch ||
      linkedinUrlMatch ||
      emailMatch ||
      phoneMatch ||
      phoneVariantMatch,
  );
};
const cluster = [reference];
const remaining = normalized.slice(1);
let changed = true;
while (changed) {
  changed = false;
  for (let index = remaining.length - 1; index >= 0; index -= 1) {
    const candidate = remaining[index];
    if (cluster.some((record) => sharesSupportedKey(record, candidate))) {
      cluster.push(candidate);
      remaining.splice(index, 1);
      changed = true;
    }
  }
}
const candidates = cluster.slice(1);
const distinct = (key) =>
  new Set(cluster.map((record) => record[key]).filter(Boolean));
const linkedinPersonIds = distinct("linkedinPersonId");
const linkedinUrls = distinct("linkedinUrl");
const emails = distinct("email");
const phoneKeysByRecord = cluster.map((record) => record.phoneKeys || []);
const conflictingLinkedinPersonIds = linkedinPersonIds.size > 1;
const conflictingLinkedinIdentity =
  conflictingLinkedinPersonIds || linkedinUrls.size > 1;
const genericOrSharedEmail =
  cluster.some((record) => isGenericEmail(record.email)) ||
  (emails.size === 1 && conflictingLinkedinIdentity);
const exactLinkedinPersonId = Boolean(
  reference.linkedinPersonId &&
    candidates.length > 0 &&
    candidates.every(
      (candidate) => candidate.linkedinPersonId === reference.linkedinPersonId,
    ),
);
const exactLinkedinUrl = Boolean(
  reference.linkedinUrl &&
    candidates.length > 0 &&
    candidates.every((candidate) => candidate.linkedinUrl === reference.linkedinUrl) &&
    !conflictingLinkedinPersonIds,
);
const exactNonGenericEmail = Boolean(
  reference.email &&
    candidates.length > 0 &&
    candidates.every((candidate) => candidate.email === reference.email) &&
    !genericOrSharedEmail &&
    !conflictingLinkedinIdentity,
);
const highConfidenceEdges = cluster.map(() => new Set());
for (let leftIndex = 0; leftIndex < cluster.length; leftIndex += 1) {
  for (let rightIndex = leftIndex + 1; rightIndex < cluster.length; rightIndex += 1) {
    const left = cluster[leftIndex];
    const right = cluster[rightIndex];
    const samePersonId =
      left.linkedinPersonId && left.linkedinPersonId === right.linkedinPersonId;
    const sameLinkedinUrl =
      left.linkedinUrl &&
      left.linkedinUrl === right.linkedinUrl &&
      !(
        left.linkedinPersonId &&
        right.linkedinPersonId &&
        left.linkedinPersonId !== right.linkedinPersonId
      );
    const sameEmail =
      left.email &&
      left.email === right.email &&
      !isGenericEmail(left.email) &&
      !isGenericEmail(right.email) &&
      !conflictingLinkedinIdentity;
    if (samePersonId || sameLinkedinUrl || sameEmail) {
      highConfidenceEdges[leftIndex].add(rightIndex);
      highConfidenceEdges[rightIndex].add(leftIndex);
    }
  }
}
const seen = new Set([0]);
const queue = [0];
while (queue.length) {
  const current = queue.shift();
  for (const next of highConfidenceEdges[current] || []) {
    if (!seen.has(next)) {
      seen.add(next);
      queue.push(next);
    }
  }
}
const transitiveHighConfidence =
  seen.size === cluster.length &&
  cluster.length > 2 &&
  !conflictingLinkedinIdentity &&
  !genericOrSharedEmail &&
  !(exactLinkedinPersonId || exactLinkedinUrl || exactNonGenericEmail);
const phoneOnly = Boolean(
  phoneKeysByRecord.every((keys) => keys.length > 0) &&
    candidates.length > 0 &&
    phoneKeysByRecord
      .slice(1)
      .every((keys) => overlaps(phoneKeysByRecord[0] || [], keys)) &&
    !exactLinkedinPersonId &&
    !exactLinkedinUrl &&
    !exactNonGenericEmail &&
    !transitiveHighConfidence,
);

return {
  sourceFound: true,
  duplicateCount: candidates.length,
  cluster,
  candidateEvidence: cluster.map((record) => ({
    id: record.id,
    email: record.email,
    phone: record.phone,
    linkedinUrl: record.linkedinUrl,
    linkedinPersonId: record.linkedinPersonId,
    name: [record.firstName, record.lastName].filter(Boolean).join(" "),
    jobTitle: record.jobTitle,
    primaryAssociatedCompanyId: record.primaryAssociatedCompanyId,
  })),
  reviewLines: cluster.map((record) =>
    [
      record.id,
      [record.firstName, record.lastName].filter(Boolean).join(" ") || "(no name)",
      record.rawValues.email || "(no email)",
      record.linkedinPersonId || "(no LinkedIn ID)",
      record.jobTitle || "(no title)",
      record.primaryAssociatedCompanyId || "(no company)",
    ].join(" · "),
  ),
  exactLinkedinPersonId,
  exactLinkedinUrl,
  exactNonGenericEmail,
  transitiveHighConfidence,
  phoneOnly,
  conflictingLinkedinPersonIds,
  conflictingLinkedinIdentity,
  genericOrSharedEmail,
  autoEligible:
    exactLinkedinPersonId ||
    exactLinkedinUrl ||
    exactNonGenericEmail ||
    transitiveHighConfidence,
};
`;

const prepareContactMergePayloadScript = `
const cluster = Array.isArray(nodes.prepare_contact_duplicate_evidence.result.cluster)
  ? nodes.prepare_contact_duplicate_evidence.result.cluster
  : [];
const nonEmpty = (value) => value !== null && value !== undefined && value !== "";
const ordered = [...cluster].sort((left, right) =>
  right.associatedDeals - left.associatedDeals ||
  right.activities - left.activities ||
  left.createdAt.localeCompare(right.createdAt) ||
  right.populatedProperties - left.populatedProperties ||
  left.id.localeCompare(right.id)
);
const primary = ordered[0];
const idsToMerge = ordered.slice(1).map((record) => record.id);
const writeBackFields = [
  ["email", "email"],
  ["phone", "phone"],
  ["linkedin_url", "linkedin_url"],
  ["linkedin_person_id", "linkedin_person_id"],
  ["jobtitle", "jobtitle"],
  ["associatedcompanyid", "associatedcompanyid"],
];
const validatedValues = {};
const valueOrder = [...ordered].sort(
  (left, right) =>
    right.lastModifiedAt.localeCompare(left.lastModifiedAt) ||
    ordered.indexOf(left) - ordered.indexOf(right),
);
for (const [propertyName, outputKey] of writeBackFields) {
  const donor = valueOrder.find(
    (record) => record.rawValues && nonEmpty(record.rawValues[propertyName]),
  );
  if (donor) validatedValues[outputKey] = donor.rawValues[propertyName];
}

return {
  primaryId: primary ? primary.id : "",
  idsToMerge,
  mergeSteps: idsToMerge.map((idToMerge) => ({
    primaryId: primary ? primary.id : "",
    idToMerge,
  })),
  writeBackMappings: Object.entries(validatedValues).map(([propertyName, value]) => ({
    propertyName,
    value,
  })),
};
`;

// PLACEHOLDER: replace with the approved Slack channel ID before deployment.
const manualReviewChannelId = "PLACEHOLDER_REVIEW_CHANNEL_ID";
// PLACEHOLDER: set to false if the approved contact policy leaves
// low-confidence groups untouched instead of routing them to Human Review.
const lowConfidenceContactReviewEnabled = true;

// Direct CRM-model play. It performs a fresh HubSpot candidate search for each
// enrolled account, scores the resulting cluster, then either merges a narrow
// exact-ID class or pauses for human approval. No staging model is deployed.
const deduplicateCrmAccount = defineWorkflowFromNodes(
  "deduplicate_crm_account",
  {
    formFields: [
      {
        slug: "hs_object_id",
        name: "HubSpot company ID",
        kind: "string",
        isRequired: true,
      },
      { slug: "name", name: "Company name", kind: "string", isRequired: false },
      { slug: "domain", name: "Domain", kind: "string", isRequired: false },
      {
        slug: "linkedin_company_page",
        name: "LinkedIn company page",
        kind: "string",
        isRequired: false,
      },
      {
        slug: "linkedin_company_id",
        name: "LinkedIn company ID",
        kind: "string",
        isRequired: false,
      },
      // PLACEHOLDER: map these two slugs to the protected-ID and parent-company
      // properties approved in the live CRM audit before deployment.
      {
        slug: "protected_business_id",
        name: "Protected business ID",
        kind: "string",
        isRequired: false,
      },
      {
        slug: "parent_company_id",
        name: "Parent company ID",
        kind: "string",
        isRequired: false,
      },
      {
        slug: "lifecyclestage",
        name: "Lifecycle stage",
        kind: "string",
        isRequired: false,
      },
      {
        slug: "hs_num_open_deals",
        name: "Open deals",
        kind: "number",
        isRequired: false,
      },
      {
        slug: "num_associated_contacts",
        name: "Associated contacts",
        kind: "number",
        isRequired: false,
      },
      {
        slug: "hs_num_engagements",
        name: "Activities",
        kind: "number",
        isRequired: false,
      },
      {
        slug: "notes_last_updated",
        name: "Last activity at",
        kind: "string",
        isRequired: false,
      },
      {
        slug: "createdate",
        name: "Created at",
        kind: "string",
        isRequired: false,
      },
      {
        slug: "lastmodifieddate",
        name: "Last modified at",
        kind: "string",
        isRequired: false,
      },
    ],
    nodes: [
      {
        uuid: "20000000-0000-4000-8000-000000000001",
        slug: "start",
        kind: "native",
        actionSlug: "start",
        config: {},
        childrenUuids: ["20000000-0000-4000-8000-000000000002"],
        fallbackOnFailure: false,
        position: { x: 0, y: 0 },
      },
      {
        uuid: "20000000-0000-4000-8000-000000000002",
        slug: "find_duplicate_companies",
        name: "Find duplicate companies",
        kind: "connector",
        integrationSlug: "hubspot",
        actionSlug: "findRecords",
        connectorUuid: crm.uuid as unknown as string,
        config: {
          objectType: "companies",
          criterias: [
            {
              propertyName: "linkedin_company_id",
              value: expression("{{nodes.start.linkedin_company_id}}"),
            },
            {
              propertyName: "linkedin_company_page",
              value: expression("{{nodes.start.linkedin_company_page}}"),
            },
            {
              propertyName: "domain",
              value: expression("{{nodes.start.domain}}"),
            },
          ],
        },
        childrenUuids: ["20000000-0000-4000-8000-000000000003"],
        fallbackOnFailure: false,
        position: { x: 0, y: 166 },
      },
      {
        uuid: "20000000-0000-4000-8000-000000000003",
        slug: "prepare_duplicate_evidence",
        name: "Normalize duplicate evidence",
        kind: "native",
        actionSlug: "script",
        config: { script: prepareDuplicateEvidenceScript },
        childrenUuids: ["20000000-0000-4000-8000-000000000004"],
        fallbackOnFailure: false,
        position: { x: 0, y: 332 },
      },
      {
        uuid: "20000000-0000-4000-8000-000000000004",
        slug: "has_duplicates",
        name: "Duplicates found?",
        kind: "native",
        actionSlug: "branch",
        config: {
          condition: expression(
            "{{nodes.prepare_duplicate_evidence.result.duplicateCount > 0}}",
          ),
        },
        childrenUuids: [
          "20000000-0000-4000-8000-000000000005",
          "20000000-0000-4000-8000-00000000000d",
        ],
        fallbackOnFailure: false,
        position: { x: 0, y: 498 },
      },
      {
        uuid: "20000000-0000-4000-8000-000000000005",
        slug: "duplicate_score",
        name: "Score duplicate evidence",
        kind: "native",
        actionSlug: "scoring",
        config: {
          criterias: [
            {
              name: "Exact LinkedIn company ID",
              value: expression(
                "{{nodes.prepare_duplicate_evidence.result.exactLinkedinId}}",
              ),
              score: 60,
            },
            {
              name: "Exact LinkedIn company URL",
              value: expression(
                "{{nodes.prepare_duplicate_evidence.result.exactLinkedinUrl}}",
              ),
              score: 25,
            },
            {
              name: "Exact non-generic domain",
              value: expression(
                "{{nodes.prepare_duplicate_evidence.result.exactDomain}}",
              ),
              score: 15,
            },
          ],
        },
        childrenUuids: ["20000000-0000-4000-8000-00000000000e"],
        fallbackOnFailure: false,
        position: { x: 0, y: 664 },
      },
      {
        uuid: "20000000-0000-4000-8000-00000000000e",
        slug: "select_survivor",
        name: "Select deterministic survivor",
        kind: "native",
        actionSlug: "script",
        config: { script: selectDuplicateSurvivorScript },
        childrenUuids: ["20000000-0000-4000-8000-000000000006"],
        fallbackOnFailure: false,
        position: { x: 0, y: 830 },
      },
      {
        uuid: "20000000-0000-4000-8000-000000000006",
        slug: "automatic_merge_gate",
        name: "Safe automatic merge?",
        kind: "native",
        actionSlug: "branch",
        config: {
          condition: expression(
            "{{nodes.duplicate_score.score >= 60 && nodes.prepare_duplicate_evidence.result.autoEligible === true}}",
          ),
        },
        childrenUuids: [
          "20000000-0000-4000-8000-000000000007",
          "20000000-0000-4000-8000-000000000009",
        ],
        fallbackOnFailure: false,
        position: { x: 0, y: 996 },
      },
      {
        uuid: "20000000-0000-4000-8000-000000000007",
        slug: "merge_automatically",
        name: "Merge exact LinkedIn ID cluster",
        kind: "connector",
        integrationSlug: "hubspot",
        actionSlug: "mergeRecords",
        connectorUuid: crm.uuid as unknown as string,
        config: {
          objectType: "companies",
          primaryId: expression("{{nodes.select_survivor.result.primaryId}}"),
          idsToMerge: expression("{{nodes.select_survivor.result.idsToMerge}}"),
        },
        childrenUuids: ["20000000-0000-4000-8000-000000000008"],
        fallbackOnFailure: false,
        position: { x: -260, y: 1162 },
      },
      {
        uuid: "20000000-0000-4000-8000-000000000008",
        slug: "merged_automatically",
        kind: "native",
        actionSlug: "end",
        config: {
          variables: [
            { name: "status", type: "string", value: "merged_automatically" },
            {
              name: "score",
              type: "number",
              value: expression("{{nodes.duplicate_score.score}}"),
            },
            {
              name: "survivorId",
              type: "string",
              value: expression("{{nodes.select_survivor.result.primaryId}}"),
            },
            {
              name: "mergedIds",
              type: "array",
              value: expression("{{nodes.select_survivor.result.idsToMerge}}"),
            },
          ],
        },
        childrenUuids: [],
        fallbackOnFailure: false,
        position: { x: -260, y: 1328 },
      },
      {
        uuid: "20000000-0000-4000-8000-000000000009",
        slug: "manual_review",
        name: "Validate duplicate merge",
        kind: "native",
        actionSlug: "humanReview",
        config: {
          connectorUuid: manualReviewConnector.uuid as unknown as string,
          channelId: manualReviewChannelId,
          title: expression(
            '{{"Review CRM account merge into " + nodes.select_survivor.result.primaryId}}',
          ),
          content: expression(
            '{{"Duplicate score: " + nodes.duplicate_score.score + "/100\\nSurvivor: " + nodes.select_survivor.result.primaryId + "\\nRecords to merge: " + nodes.select_survivor.result.idsToMerge.join(", ") + "\\nIdentity conflict: " + nodes.prepare_duplicate_evidence.result.identityConflict + "\\nProtected ID conflict: " + nodes.prepare_duplicate_evidence.result.protectedIdConflict + "\\nParent/subsidiary warning: " + nodes.prepare_duplicate_evidence.result.parentOrSubsidiaryWarning + "\\nEvidence: " + JSON.stringify(nodes.prepare_duplicate_evidence.result.candidateEvidence)}}',
          ),
          timeoutMilliseconds: 86_400_000,
          enableEditButton: false,
        },
        childrenUuids: [
          "20000000-0000-4000-8000-00000000000a",
          "20000000-0000-4000-8000-00000000000c",
        ],
        fallbackOnFailure: false,
        position: { x: 260, y: 1162 },
      },
      {
        uuid: "20000000-0000-4000-8000-00000000000a",
        slug: "merge_after_review",
        name: "Merge approved cluster",
        kind: "connector",
        integrationSlug: "hubspot",
        actionSlug: "mergeRecords",
        connectorUuid: crm.uuid as unknown as string,
        config: {
          objectType: "companies",
          primaryId: expression("{{nodes.select_survivor.result.primaryId}}"),
          idsToMerge: expression("{{nodes.select_survivor.result.idsToMerge}}"),
        },
        childrenUuids: ["20000000-0000-4000-8000-00000000000b"],
        fallbackOnFailure: false,
        position: { x: 160, y: 1328 },
      },
      {
        uuid: "20000000-0000-4000-8000-00000000000b",
        slug: "merged_after_review",
        kind: "native",
        actionSlug: "end",
        config: {
          variables: [
            { name: "status", type: "string", value: "merged_after_review" },
            {
              name: "score",
              type: "number",
              value: expression("{{nodes.duplicate_score.score}}"),
            },
            {
              name: "survivorId",
              type: "string",
              value: expression("{{nodes.select_survivor.result.primaryId}}"),
            },
            {
              name: "mergedIds",
              type: "array",
              value: expression("{{nodes.select_survivor.result.idsToMerge}}"),
            },
          ],
        },
        childrenUuids: [],
        fallbackOnFailure: false,
        position: { x: 160, y: 1494 },
      },
      {
        uuid: "20000000-0000-4000-8000-00000000000c",
        slug: "review_declined",
        kind: "native",
        actionSlug: "end",
        config: {
          variables: [
            {
              name: "status",
              type: "string",
              value: "review_declined_or_timed_out",
            },
            {
              name: "score",
              type: "number",
              value: expression("{{nodes.duplicate_score.score}}"),
            },
          ],
        },
        childrenUuids: [],
        fallbackOnFailure: false,
        position: { x: 360, y: 1328 },
      },
      {
        uuid: "20000000-0000-4000-8000-00000000000d",
        slug: "no_duplicates",
        kind: "native",
        actionSlug: "end",
        config: {
          variables: [
            {
              name: "status",
              type: "string",
              value: expression(
                '{{nodes.prepare_duplicate_evidence.result.sourceFound ? "no_duplicates" : "source_missing_or_changed"}}',
              ),
            },
          ],
        },
        childrenUuids: [],
        fallbackOnFailure: false,
        position: { x: 280, y: 664 },
      },
    ],
  },
);

const deduplicateCrmContact = defineWorkflowFromNodes(
  "deduplicate_crm_contact",
  {
    formFields: [
      {
        slug: "hs_object_id",
        name: "HubSpot contact ID",
        kind: "string",
        isRequired: true,
      },
      { slug: "email", name: "Email", kind: "string", isRequired: false },
      { slug: "phone", name: "Phone", kind: "string", isRequired: false },
      {
        slug: "linkedin_url",
        name: "LinkedIn URL",
        kind: "string",
        isRequired: false,
      },
      {
        slug: "linkedin_person_id",
        name: "LinkedIn person ID",
        kind: "string",
        isRequired: false,
      },
      {
        slug: "firstname",
        name: "First name",
        kind: "string",
        isRequired: false,
      },
      {
        slug: "lastname",
        name: "Last name",
        kind: "string",
        isRequired: false,
      },
      {
        slug: "jobtitle",
        name: "Job title",
        kind: "string",
        isRequired: false,
      },
      {
        slug: "associatedcompanyid",
        name: "Primary associated company ID",
        kind: "string",
        isRequired: false,
      },
      {
        slug: "num_associated_deals",
        name: "Associated deals",
        kind: "number",
        isRequired: false,
      },
      {
        slug: "num_contacted_notes",
        name: "Contact activities",
        kind: "number",
        isRequired: false,
      },
      {
        slug: "hs_sales_email_last_replied",
        name: "Sales email replies",
        kind: "number",
        isRequired: false,
      },
      {
        slug: "createdate",
        name: "Created at",
        kind: "string",
        isRequired: false,
      },
    ],
    nodes: [
      {
        uuid: "30000000-0000-4000-8000-000000000001",
        slug: "start",
        kind: "native",
        actionSlug: "start",
        config: {},
        childrenUuids: ["30000000-0000-4000-8000-000000000013"],
        fallbackOnFailure: false,
        position: { x: 0, y: 0 },
      },
      {
        uuid: "30000000-0000-4000-8000-000000000013",
        slug: "prepare_contact_search_variants",
        name: "Prepare contact search variants",
        kind: "native",
        actionSlug: "script",
        config: { script: prepareContactSearchVariantsScript },
        childrenUuids: ["30000000-0000-4000-8000-000000000002"],
        fallbackOnFailure: false,
        position: { x: 0, y: 166 },
      },
      {
        uuid: "30000000-0000-4000-8000-000000000002",
        slug: "find_duplicate_contacts",
        name: "Find duplicate contacts",
        kind: "connector",
        integrationSlug: "hubspot",
        actionSlug: "findRecords",
        connectorUuid: crm.uuid as unknown as string,
        config: {
          objectType: "contacts",
          criterias: [
            {
              propertyName: "linkedin_person_id",
              value: expression(
                "{{nodes.prepare_contact_search_variants.result.linkedinPersonId}}",
              ),
            },
            {
              propertyName: "linkedin_url",
              value: expression(
                "{{nodes.prepare_contact_search_variants.result.linkedinUrlVariants[0]}}",
              ),
            },
            {
              propertyName: "linkedin_url",
              value: expression(
                "{{nodes.prepare_contact_search_variants.result.linkedinUrlVariants[1]}}",
              ),
            },
            {
              propertyName: "linkedin_url",
              value: expression(
                "{{nodes.prepare_contact_search_variants.result.linkedinUrlVariants[2]}}",
              ),
            },
            {
              propertyName: "linkedin_url",
              value: expression(
                "{{nodes.prepare_contact_search_variants.result.linkedinUrlVariants[3]}}",
              ),
            },
            {
              propertyName: "email",
              value: expression(
                "{{nodes.prepare_contact_search_variants.result.email}}",
              ),
            },
            {
              propertyName: "phone",
              value: expression(
                "{{nodes.prepare_contact_search_variants.result.phone}}",
              ),
            },
          ],
        },
        childrenUuids: ["30000000-0000-4000-8000-000000000014"],
        fallbackOnFailure: false,
        position: { x: 0, y: 332 },
      },
      {
        uuid: "30000000-0000-4000-8000-000000000014",
        slug: "prepare_transitive_contact_search",
        name: "Prepare transitive contact search",
        kind: "native",
        actionSlug: "script",
        config: { script: prepareContactTransitiveSearchScript },
        childrenUuids: ["30000000-0000-4000-8000-000000000015"],
        fallbackOnFailure: false,
        position: { x: 0, y: 498 },
      },
      {
        uuid: "30000000-0000-4000-8000-000000000015",
        slug: "find_transitive_duplicate_contacts",
        name: "Find transitive duplicate contacts",
        kind: "connector",
        integrationSlug: "hubspot",
        actionSlug: "findRecords",
        connectorUuid: crm.uuid as unknown as string,
        config: {
          objectType: "contacts",
          criterias: [
            {
              propertyName: "linkedin_person_id",
              value: expression(
                "{{nodes.prepare_transitive_contact_search.result.linkedinPersonIds}}",
              ),
            },
            {
              propertyName: "linkedin_url",
              value: expression(
                "{{nodes.prepare_transitive_contact_search.result.linkedinUrlVariants}}",
              ),
            },
            {
              propertyName: "email",
              value: expression(
                "{{nodes.prepare_transitive_contact_search.result.emails}}",
              ),
            },
            {
              propertyName: "phone",
              value: expression(
                "{{nodes.prepare_transitive_contact_search.result.phones}}",
              ),
            },
          ],
        },
        childrenUuids: ["30000000-0000-4000-8000-000000000003"],
        fallbackOnFailure: false,
        position: { x: 0, y: 664 },
      },
      {
        uuid: "30000000-0000-4000-8000-000000000003",
        slug: "prepare_contact_duplicate_evidence",
        name: "Normalize contact duplicate evidence",
        kind: "native",
        actionSlug: "script",
        config: { script: prepareContactDuplicateEvidenceScript },
        childrenUuids: ["30000000-0000-4000-8000-000000000004"],
        fallbackOnFailure: false,
        position: { x: 0, y: 830 },
      },
      {
        uuid: "30000000-0000-4000-8000-000000000004",
        slug: "has_contact_duplicates",
        name: "Contact duplicates found?",
        kind: "native",
        actionSlug: "branch",
        config: {
          condition: expression(
            "{{nodes.prepare_contact_duplicate_evidence.result.duplicateCount > 0}}",
          ),
        },
        childrenUuids: [
          "30000000-0000-4000-8000-000000000005",
          "30000000-0000-4000-8000-00000000000f",
        ],
        fallbackOnFailure: false,
        position: { x: 0, y: 498 },
      },
      {
        uuid: "30000000-0000-4000-8000-000000000005",
        slug: "contact_duplicate_score",
        name: "Score contact duplicate evidence",
        kind: "native",
        actionSlug: "scoring",
        config: {
          criterias: [
            {
              name: "Exact LinkedIn person ID",
              value: expression(
                "{{nodes.prepare_contact_duplicate_evidence.result.exactLinkedinPersonId}}",
              ),
              score: 60,
            },
            {
              name: "Exact LinkedIn person URL without person-ID conflict",
              value: expression(
                "{{nodes.prepare_contact_duplicate_evidence.result.exactLinkedinUrl}}",
              ),
              score: 60,
            },
            {
              name: "Exact non-generic email without LinkedIn conflict",
              value: expression(
                "{{nodes.prepare_contact_duplicate_evidence.result.exactNonGenericEmail}}",
              ),
              score: 60,
            },
            {
              name: "Transitive high-confidence chain",
              value: expression(
                "{{nodes.prepare_contact_duplicate_evidence.result.transitiveHighConfidence}}",
              ),
              score: 60,
            },
          ],
        },
        childrenUuids: ["30000000-0000-4000-8000-000000000006"],
        fallbackOnFailure: false,
        position: { x: 0, y: 664 },
      },
      {
        uuid: "30000000-0000-4000-8000-000000000006",
        slug: "prepare_contact_merge_payload",
        name: "Select contact survivor and write-back",
        kind: "native",
        actionSlug: "script",
        config: { script: prepareContactMergePayloadScript },
        childrenUuids: ["30000000-0000-4000-8000-000000000007"],
        fallbackOnFailure: false,
        position: { x: 0, y: 830 },
      },
      {
        uuid: "30000000-0000-4000-8000-000000000007",
        slug: "contact_automatic_merge_gate",
        name: "Safe automatic contact merge?",
        kind: "native",
        actionSlug: "branch",
        config: {
          condition: expression(
            "{{nodes.contact_duplicate_score.score >= 60 && nodes.prepare_contact_duplicate_evidence.result.autoEligible === true}}",
          ),
        },
        childrenUuids: [
          "30000000-0000-4000-8000-000000000008",
          "30000000-0000-4000-8000-00000000000b",
        ],
        fallbackOnFailure: false,
        position: { x: 0, y: 996 },
      },
      {
        uuid: "30000000-0000-4000-8000-000000000008",
        slug: "merge_contact_automatically",
        name: "Merge high-confidence contact cluster",
        kind: "connector",
        integrationSlug: "hubspot",
        actionSlug: "mergeRecords",
        connectorUuid: crm.uuid as unknown as string,
        config: {
          objectType: "contacts",
          primaryId: expression(
            "{{nodes.prepare_contact_merge_payload.result.primaryId}}",
          ),
          idsToMerge: expression(
            "{{nodes.prepare_contact_merge_payload.result.idsToMerge}}",
          ),
        },
        childrenUuids: ["30000000-0000-4000-8000-000000000009"],
        fallbackOnFailure: false,
        position: { x: -360, y: 1162 },
      },
      {
        uuid: "30000000-0000-4000-8000-000000000009",
        slug: "write_back_contact_enrichment_after_auto_merge",
        name: "Write validated contact values",
        kind: "connector",
        integrationSlug: "hubspot",
        actionSlug: "updateRecords",
        connectorUuid: crm.uuid as unknown as string,
        config: {
          objectType: "contacts",
          matchingPropertyName: "hs_object_id",
          matchingValue: expression(
            "{{nodes.prepare_contact_merge_payload.result.primaryId}}",
          ),
          mappings: expression(
            "{{nodes.prepare_contact_merge_payload.result.writeBackMappings}}",
          ),
        },
        childrenUuids: ["30000000-0000-4000-8000-00000000000a"],
        fallbackOnFailure: false,
        position: { x: -360, y: 1328 },
      },
      {
        uuid: "30000000-0000-4000-8000-00000000000a",
        slug: "contact_merged_automatically",
        kind: "native",
        actionSlug: "end",
        config: {
          variables: [
            { name: "status", type: "string", value: "merged_automatically" },
            {
              name: "survivorId",
              type: "string",
              value: expression(
                "{{nodes.prepare_contact_merge_payload.result.primaryId}}",
              ),
            },
            {
              name: "mergedIds",
              type: "array",
              value: expression(
                "{{nodes.prepare_contact_merge_payload.result.idsToMerge}}",
              ),
            },
          ],
        },
        childrenUuids: [],
        fallbackOnFailure: false,
        position: { x: -360, y: 1494 },
      },
      {
        uuid: "30000000-0000-4000-8000-00000000000b",
        slug: "contact_manual_review_enabled",
        name: "Manual review enabled?",
        kind: "native",
        actionSlug: "branch",
        config: {
          condition: expression(
            `{{${lowConfidenceContactReviewEnabled ? "true" : "false"}}}`,
          ),
        },
        childrenUuids: [
          "30000000-0000-4000-8000-00000000000c",
          "30000000-0000-4000-8000-000000000012",
        ],
        fallbackOnFailure: false,
        position: { x: 360, y: 1162 },
      },
      {
        uuid: "30000000-0000-4000-8000-00000000000c",
        slug: "contact_manual_review",
        name: "Validate contact merge",
        kind: "native",
        actionSlug: "humanReview",
        config: {
          connectorUuid: manualReviewConnector.uuid as unknown as string,
          channelId: manualReviewChannelId,
          title: expression(
            '{{"Review CRM contact merge into " + nodes.prepare_contact_merge_payload.result.primaryId}}',
          ),
          content: expression(
            '{{"Score: " + nodes.contact_duplicate_score.score + "/100\\nSurvivor: " + nodes.prepare_contact_merge_payload.result.primaryId + "\\nSerial merge steps: " + JSON.stringify(nodes.prepare_contact_merge_payload.result.mergeSteps) + "\\nConflicting LinkedIn person IDs: " + nodes.prepare_contact_duplicate_evidence.result.conflictingLinkedinPersonIds + "\\nConflicting LinkedIn identity: " + nodes.prepare_contact_duplicate_evidence.result.conflictingLinkedinIdentity + "\\nGeneric or shared email: " + nodes.prepare_contact_duplicate_evidence.result.genericOrSharedEmail + "\\nRecords:\\n" + nodes.prepare_contact_duplicate_evidence.result.reviewLines.join("\\n") + "\\nOptional AI evidence: not enabled in the deterministic merge path"}}',
          ),
          timeoutMilliseconds: 86_400_000,
          enableEditButton: false,
        },
        childrenUuids: [
          "30000000-0000-4000-8000-00000000000d",
          "30000000-0000-4000-8000-000000000011",
        ],
        fallbackOnFailure: false,
        position: { x: 260, y: 1328 },
      },
      {
        uuid: "30000000-0000-4000-8000-00000000000d",
        slug: "merge_contact_after_review",
        name: "Merge approved contact cluster",
        kind: "connector",
        integrationSlug: "hubspot",
        actionSlug: "mergeRecords",
        connectorUuid: crm.uuid as unknown as string,
        config: {
          objectType: "contacts",
          primaryId: expression(
            "{{nodes.prepare_contact_merge_payload.result.primaryId}}",
          ),
          idsToMerge: expression(
            "{{nodes.prepare_contact_merge_payload.result.idsToMerge}}",
          ),
        },
        childrenUuids: ["30000000-0000-4000-8000-00000000000e"],
        fallbackOnFailure: false,
        position: { x: 160, y: 1494 },
      },
      {
        uuid: "30000000-0000-4000-8000-00000000000e",
        slug: "write_back_contact_enrichment_after_review_merge",
        name: "Write validated contact values",
        kind: "connector",
        integrationSlug: "hubspot",
        actionSlug: "updateRecords",
        connectorUuid: crm.uuid as unknown as string,
        config: {
          objectType: "contacts",
          matchingPropertyName: "hs_object_id",
          matchingValue: expression(
            "{{nodes.prepare_contact_merge_payload.result.primaryId}}",
          ),
          mappings: expression(
            "{{nodes.prepare_contact_merge_payload.result.writeBackMappings}}",
          ),
        },
        childrenUuids: ["30000000-0000-4000-8000-000000000010"],
        fallbackOnFailure: false,
        position: { x: 160, y: 1660 },
      },
      {
        uuid: "30000000-0000-4000-8000-000000000010",
        slug: "contact_merged_after_review",
        kind: "native",
        actionSlug: "end",
        config: {
          variables: [
            { name: "status", type: "string", value: "merged_after_review" },
            {
              name: "survivorId",
              type: "string",
              value: expression(
                "{{nodes.prepare_contact_merge_payload.result.primaryId}}",
              ),
            },
            {
              name: "mergedIds",
              type: "array",
              value: expression(
                "{{nodes.prepare_contact_merge_payload.result.idsToMerge}}",
              ),
            },
          ],
        },
        childrenUuids: [],
        fallbackOnFailure: false,
        position: { x: 160, y: 1826 },
      },
      {
        uuid: "30000000-0000-4000-8000-000000000011",
        slug: "contact_review_declined",
        kind: "native",
        actionSlug: "end",
        config: {
          variables: [
            {
              name: "status",
              type: "string",
              value: "review_declined_or_timed_out",
            },
            {
              name: "score",
              type: "number",
              value: expression("{{nodes.contact_duplicate_score.score}}"),
            },
          ],
        },
        childrenUuids: [],
        fallbackOnFailure: false,
        position: { x: 360, y: 1494 },
      },
      {
        uuid: "30000000-0000-4000-8000-000000000012",
        slug: "contact_low_confidence_not_reviewed",
        kind: "native",
        actionSlug: "end",
        config: {
          variables: [
            {
              name: "status",
              type: "string",
              value: "low_confidence_not_reviewed",
            },
          ],
        },
        childrenUuids: [],
        fallbackOnFailure: false,
        position: { x: 560, y: 1328 },
      },
      {
        uuid: "30000000-0000-4000-8000-00000000000f",
        slug: "no_contact_duplicates",
        kind: "native",
        actionSlug: "end",
        config: {
          variables: [
            {
              name: "status",
              type: "string",
              value: expression(
                '{{nodes.prepare_contact_duplicate_evidence.result.sourceFound ? "no_duplicates" : "source_missing_or_changed"}}',
              ),
            },
          ],
        },
        childrenUuids: [],
        fallbackOnFailure: false,
        position: { x: 280, y: 664 },
      },
    ],
  },
);

export const deduplicateAccounts = definePlay("deduplicate_accounts", {
  model: crmAccounts,
  workflow: deduplicateCrmAccount,
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "and",
        conditions: [
          {
            kind: "string",
            columnSlug: crmAccounts.columns.hs_object_id,
            operator: "isNotEmpty",
          },
        ],
      },
      {
        conjonction: "or",
        conditions: [
          {
            kind: "string",
            columnSlug: crmAccounts.columns.linkedin_company_id,
            operator: "isNotEmpty",
          },
          {
            kind: "string",
            columnSlug: crmAccounts.columns.linkedin_company_page,
            operator: "isNotEmpty",
          },
          {
            kind: "string",
            columnSlug: crmAccounts.columns.domain,
            operator: "isNotEmpty",
          },
        ],
      },
    ],
  },
  limit: 15,
  isEnabled: false,
  runCreationRule: "noConcurrency",
  changeKinds: ["added", "updated"],
  schedule: { type: "cron", cron: "0 7 * * *" },
});

export const deduplicateContacts = definePlay("deduplicate_contacts", {
  model: crmContacts,
  workflow: deduplicateCrmContact,
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "and",
        conditions: [
          {
            kind: "string",
            columnSlug: crmContacts.columns.hs_object_id,
            operator: "isNotEmpty",
          },
        ],
      },
      {
        conjonction: "or",
        conditions: [
          {
            kind: "string",
            columnSlug: crmContacts.columns.linkedin_person_id,
            operator: "isNotEmpty",
          },
          {
            kind: "string",
            columnSlug: crmContacts.columns.linkedin_url,
            operator: "isNotEmpty",
          },
          {
            kind: "string",
            columnSlug: crmContacts.columns.email,
            operator: "isNotEmpty",
          },
          {
            kind: "string",
            columnSlug: crmContacts.columns.phone,
            operator: "isNotEmpty",
          },
        ],
      },
    ],
  },
  limit: 15,
  isEnabled: false,
  runCreationRule: "noConcurrency",
  changeKinds: ["added", "updated"],
  schedule: { type: "cron", cron: "30 7 * * *" },
});
