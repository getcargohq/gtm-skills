// Everything the merge decision rests on, derived deterministically: no model,
// no judgement. The same records always produce the same evidence.
//
// This is the body of the play's single script node. It takes what it needs as
// arguments — the fresh CRM search and the enrolled row's record ID — and never
// reads `nodes.<slug>`: the play passes the values, and the SDK writes where
// each one lives at runtime. So nothing here breaks when a node is inserted
// ahead of the script, and `evals/contract.mjs` calls it with plain values.

import { jsFn } from "@cargo-ai/cdk";

import {
  agreementOn,
  clusterAround,
  rankCluster,
  readSearchResults,
  summarize,
} from "./cluster";
import { asText, identifiesOneCompany } from "./normalize";

type EvidenceArgs = {
  /** What `findRecords` returned for the enrolled row's identity keys. */
  found: unknown;
  /** The enrolled row's CRM record ID. */
  sourceId: string;
};

export default jsFn((args: EvidenceArgs) => {
  const records = readSearchResults(args.found);
  const sourceId = asText(args.sourceId);
  const source = records.find((record) => record.id === sourceId);
  const cluster = clusterAround(records, source);
  const duplicates = cluster.filter((record) => record.id !== sourceId);
  const hasDuplicates = duplicates.length > 0;

  const linkedinId = agreementOn(cluster, "linkedinId");
  const linkedinUrl = agreementOn(cluster, "linkedinUrl");
  const domain = agreementOn(cluster, "domain");
  const protectedId = agreementOn(cluster, "protectedId");

  const exactLinkedinId = hasDuplicates && linkedinId.sharedByAll;
  const exactLinkedinUrl = hasDuplicates && linkedinUrl.sharedByAll;
  const exactDomain =
    hasDuplicates && domain.sharedByAll && identifiesOneCompany(domain.value);
  const identityConflict =
    linkedinId.conflicting || linkedinUrl.conflicting || domain.conflicting;

  // A record whose parent is also in the cluster is a subsidiary, and a
  // subsidiary is a different company however much it looks like this one.
  const clusterIds = cluster.map((record) => record.id);
  const parentOrSubsidiaryWarning = cluster.some((record) => {
    return record.parentId !== "" && clusterIds.includes(record.parentId);
  });

  const ranked = rankCluster(cluster);

  return {
    sourceFound: source !== undefined,
    hasDuplicates,
    duplicateCount: duplicates.length,
    primaryId: ranked.length > 0 ? ranked[0]!.id : "",
    idsToMerge: ranked.slice(1).map((record) => record.id),
    exactLinkedinId,
    exactLinkedinUrl,
    exactDomain,
    identityConflict,
    protectedIdConflict: protectedId.conflicting,
    parentOrSubsidiaryWarning,
    // The only class safe enough to merge unattended.
    autoEligible:
      exactLinkedinId &&
      !identityConflict &&
      !protectedId.conflicting &&
      !parentOrSubsidiaryWarning,
    evidenceSummary: summarize(cluster),
  };
});
