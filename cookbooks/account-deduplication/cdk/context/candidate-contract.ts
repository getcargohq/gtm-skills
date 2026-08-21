// Shared audit/import contract. This is deterministic TypeScript, not a Cargo
// Tool resource. CRM-specific importers use it to build candidate-cluster rows
// from their selected CRM Account model before the proposal play runs.
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

export const normalizeDomain = (value?: string) =>
  value
    ?.trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0]
    .replace(/:\d+$/, "")
    .replace(/\.$/, "") ?? "";

export const normalizeLinkedInId = (id?: string) => id?.trim() ?? "";

export const normalizeLinkedInHandle = (url?: string) =>
  url
    ?.trim()
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?linkedin\.com\/company\//, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "") || "";

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
    records.map((record) => record.protectedId).filter(Boolean),
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
