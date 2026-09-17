import { defineScript } from "@cargo-ai/cdk";

import {
  clusterAroundContact,
  isGenericEmail,
  isHighConfidenceConnected,
  mergeRecordSets,
  phoneKeysOverlap,
  rankContacts,
  readContacts,
  valuesFor,
} from "./contacts";

export const deriveContactEvidence = defineScript(
  ({
    directRecords,
    transitiveRecords,
    sourceId,
  }: {
    directRecords: unknown;
    transitiveRecords: unknown;
    sourceId: string;
  }) => {
    const contacts = readContacts(
      mergeRecordSets(directRecords, transitiveRecords),
    );
    const source = contacts.find((contact) => contact.id === sourceId);
    const cluster = clusterAroundContact(contacts, source);
    const candidates = cluster.slice(1);
    const linkedinPersonIds = valuesFor(cluster, "linkedinPersonId");
    const linkedinUrls = valuesFor(cluster, "linkedinUrl");
    const emails = valuesFor(cluster, "email");
    const conflictingLinkedinPersonIds = linkedinPersonIds.length > 1;
    const conflictingLinkedinIdentity =
      conflictingLinkedinPersonIds || linkedinUrls.length > 1;
    const genericOrSharedEmail =
      cluster.some((contact) => isGenericEmail(contact.email)) ||
      (emails.length === 1 && conflictingLinkedinIdentity);

    const exactLinkedinPersonId =
      candidates.length > 0 &&
      source?.linkedinPersonId !== undefined &&
      candidates.every(
        (candidate) => candidate.linkedinPersonId === source.linkedinPersonId,
      );
    const exactLinkedinUrl =
      candidates.length > 0 &&
      source?.linkedinUrl !== undefined &&
      candidates.every(
        (candidate) => candidate.linkedinUrl === source.linkedinUrl,
      ) &&
      conflictingLinkedinPersonIds === false;
    const exactNonGenericEmail =
      candidates.length > 0 &&
      source?.email !== undefined &&
      candidates.every((candidate) => candidate.email === source.email) &&
      genericOrSharedEmail === false &&
      conflictingLinkedinIdentity === false;
    const transitiveHighConfidence =
      isHighConfidenceConnected(cluster) &&
      conflictingLinkedinIdentity === false &&
      genericOrSharedEmail === false &&
      exactLinkedinPersonId === false &&
      exactLinkedinUrl === false &&
      exactNonGenericEmail === false;
    const phoneOnly =
      candidates.length > 0 &&
      source !== undefined &&
      source.phoneKeys.length > 0 &&
      candidates.every(
        (candidate) =>
          candidate.phoneKeys.length > 0 &&
          phoneKeysOverlap(source.phoneKeys, candidate.phoneKeys),
      ) &&
      exactLinkedinPersonId === false &&
      exactLinkedinUrl === false &&
      exactNonGenericEmail === false &&
      transitiveHighConfidence === false;

    const [survivor, ...merged] = rankContacts(cluster);

    return {
      sourceFound: source !== undefined,
      hasDuplicates: candidates.length > 0,
      duplicateCount: candidates.length,
      primaryId: survivor?.id,
      idsToMerge: merged.map((contact) => contact.id),
      mergeSteps: merged.map((contact) => ({
        primaryId: survivor?.id,
        idToMerge: contact.id,
      })),
      exactLinkedinPersonId,
      exactLinkedinUrl,
      exactNonGenericEmail,
      transitiveHighConfidence,
      phoneOnly,
      conflictingLinkedinPersonIds,
      conflictingLinkedinIdentity,
      genericOrSharedEmail,
      autoEligible:
        (exactLinkedinPersonId ||
          exactLinkedinUrl ||
          exactNonGenericEmail ||
          transitiveHighConfidence) &&
        conflictingLinkedinIdentity === false &&
        genericOrSharedEmail === false,
      reviewLines: cluster.map((contact) => {
        return [
          contact.id,
          [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
            "(no name)",
          contact.rawValues.email ?? "(no email)",
          contact.linkedinPersonId ?? "(no LinkedIn ID)",
          contact.jobTitle ?? "(no title)",
          contact.primaryAssociatedCompanyId ?? "(no company)",
        ].join(" | ");
      }),
    };
  },
);
