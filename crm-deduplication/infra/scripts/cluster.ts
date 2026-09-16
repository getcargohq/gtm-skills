// Turning what the CRM search returned into a cluster, and reading the identity
// keys across it.

import {
  asDomain,
  asHandle,
  asNumber,
  asText,
  identifiesOneCompany,
} from "./normalize";
import { survivorPrecedence, type CrmRecord } from "./policy";

/**
 * One normalized row per company the search returned. A company can match
 * several criteria, so the first row wins and later appearances are dropped on
 * the way in.
 */
export const readSearchResults = (found: unknown) => {
  const rows: unknown[] = Array.isArray(found) ? found : [];
  const unique = new Map<string, CrmRecord>();

  for (const row of rows) {
    const record = row as {
      id?: unknown;
      properties?: Record<string, unknown>;
    };
    const id = asText(record && record.id);
    if (id === "" || unique.has(id)) continue;
    const fields = (record && record.properties) || {};

    unique.set(id, {
      id,
      linkedinId: asText(fields.linkedin_company_id),
      linkedinUrl: asHandle(fields.linkedin_company_page),
      domain: asDomain(fields.domain),
      protectedId: asText(fields.protected_business_id),
      parentId: asText(fields.parent_company_id),
      isCustomer: asText(fields.lifecyclestage).toLowerCase() === "customer",
      openDeals: asNumber(fields.hs_num_open_deals),
      contacts: asNumber(fields.num_associated_contacts),
      activities: asNumber(fields.hs_num_engagements),
      filledProperties: Object.values(fields).filter((value) => {
        return value !== null && value !== undefined && value !== "";
      }).length,
      lastActivityAt: asText(fields.notes_last_updated),
      createdAt: asText(fields.createdate),
    });
  }

  return Array.from(unique.values());
};

/**
 * The enrolled row plus every record sharing an identity key with it. A source
 * the search no longer returns was absorbed by an earlier merge: the cluster
 * comes back empty, which leaves every flag false and stops any merge ID being
 * emitted.
 */
export const clusterAround = (
  records: CrmRecord[],
  source: CrmRecord | undefined,
) => {
  if (source === undefined) return [];

  return records.filter((record) => {
    if (record.id === source.id) return true;
    return (
      (source.linkedinId !== "" && record.linkedinId === source.linkedinId) ||
      (source.linkedinUrl !== "" &&
        record.linkedinUrl === source.linkedinUrl) ||
      (identifiesOneCompany(source.domain) && record.domain === source.domain)
    );
  });
};

/**
 * How one identity key behaves across the cluster. `sharedByAll` is the bar for
 * merging unattended — every record carries the key and they all agree — and
 * `conflicting` is what disqualifies a cluster outright.
 */
export const agreementOn = (
  cluster: CrmRecord[],
  key: "linkedinId" | "linkedinUrl" | "domain" | "protectedId",
) => {
  const present = cluster
    .map((record) => record[key])
    .filter((value) => value !== "");
  const distinct = present.filter((value, index, all) => {
    return all.indexOf(value) === index;
  });

  return {
    value: distinct.length === 1 ? distinct[0] : "",
    sharedByAll: present.length === cluster.length && distinct.length === 1,
    conflicting: distinct.length > 1,
  };
};

/**
 * Survivor order. Policy, not evidence, but it ranks the same cluster: the most
 * connected record wins, ties break towards the oldest, and the last tiebreak is
 * the record ID so two runs over one cluster can never disagree.
 */
export const rankCluster = (cluster: CrmRecord[]) => {
  return cluster.slice().sort((left, right) => {
    for (const scoreOf of survivorPrecedence) {
      const difference = scoreOf(right) - scoreOf(left);
      if (difference !== 0) return difference;
    }
    return (
      right.lastActivityAt.localeCompare(left.lastActivityAt) ||
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id)
    );
  });
};

/**
 * For the review message only. Protected IDs are reported as present or absent,
 * never printed.
 */
export const summarize = (cluster: CrmRecord[]) => {
  return cluster
    .map((record) => {
      return [
        record.id,
        `linkedin id ${record.linkedinId || "none"}`,
        `linkedin ${record.linkedinUrl || "none"}`,
        `domain ${record.domain || "none"}`,
        `protected ${record.protectedId === "" ? "no" : "yes"}`,
        `parent ${record.parentId || "none"}`,
      ].join(", ");
    })
    .join("\n");
};
