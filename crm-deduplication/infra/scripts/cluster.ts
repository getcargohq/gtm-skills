// Which records are the same company as the enrolled one, and how their
// identity keys agree across that cluster.

import { PARKED_DOMAINS } from "./policy";
import type { CrmRecord } from "./records";

/**
 * The enrolled record plus every record sharing an identity key with it. A
 * source the search no longer returns was absorbed by an earlier merge, so its
 * cluster is empty — which leaves every flag false and emits no merge ID.
 */
export const clusterAround = (
  records: CrmRecord[],
  source: CrmRecord | undefined,
): CrmRecord[] => {
  if (source === undefined) {
    return [];
  }

  return records.filter((record) => {
    return (
      record.id === source.id ||
      (source.linkedinId !== undefined &&
        record.linkedinId === source.linkedinId) ||
      (source.linkedinUrl !== undefined &&
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
    .filter((value): value is string => value !== undefined);
  const distinct = present.filter((value, index) => {
    return present.indexOf(value) === index;
  });

  return {
    value: distinct.length === 1 ? distinct[0] : undefined,
    sharedByAll: present.length === cluster.length && distinct.length === 1,
    conflicting: distinct.length > 1,
  };
};

/** A domain that names one company, rather than a host thousands share. */
export const identifiesOneCompany = (domain: string | undefined): boolean => {
  return domain !== undefined && PARKED_DOMAINS.includes(domain) === false;
};
