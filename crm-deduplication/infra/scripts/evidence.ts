// Everything the merge decision rests on, derived deterministically: no model,
// no judgement. The same records always produce the same evidence.

import { jsFn } from "@cargo-ai/cdk";

import { agreementOn, clusterAround, identifiesOneCompany } from "./cluster";
import { type CrmRecord, readRecordId, readSearchResults } from "./records";
import { rankSurvivors } from "./survivor";

export const deriveEvidence = jsFn(
  ({ found, sourceId }: { found: unknown; sourceId: string }) => {
    const records = readSearchResults(found);
    const enrolledId = readRecordId(sourceId);
    const source = records.find((record) => record.id === enrolledId);
    const cluster = clusterAround(records, source);
    const duplicates = cluster.filter((record) => record.id !== enrolledId);
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
      return (
        record.parentId !== undefined && clusterIds.includes(record.parentId)
      );
    });

    const [survivor, ...merged] = rankSurvivors(cluster);

    return {
      sourceFound: source !== undefined,
      hasDuplicates,
      duplicateCount: duplicates.length,
      primaryId: survivor === undefined ? undefined : survivor.id,
      idsToMerge: merged.map((record) => record.id),
      exactLinkedinId,
      exactLinkedinUrl,
      exactDomain,
      identityConflict,
      protectedIdConflict: protectedId.conflicting,
      parentOrSubsidiaryWarning,
      // The only class safe enough to merge unattended.
      autoEligible:
        exactLinkedinId &&
        identityConflict === false &&
        protectedId.conflicting === false &&
        parentOrSubsidiaryWarning === false,
      evidenceSummary: summarize(cluster),
    };
  },
);

// For the review message. Protected IDs are reported as present or absent,
// never printed.
const summarize = (cluster: CrmRecord[]): string => {
  return cluster
    .map((record) => {
      return [
        record.id,
        `linkedin id ${record.linkedinId === undefined ? "none" : record.linkedinId}`,
        `linkedin ${record.linkedinUrl === undefined ? "none" : record.linkedinUrl}`,
        `domain ${record.domain === undefined ? "none" : record.domain}`,
        `protected ${record.protectedId === undefined ? "no" : "yes"}`,
        `parent ${record.parentId === undefined ? "none" : record.parentId}`,
      ].join(", ");
    })
    .join("\n");
};
