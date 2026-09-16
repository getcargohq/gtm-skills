// Everything the merge decision rests on, derived deterministically: no model,
// no judgement. The same records always produce the same evidence.
//
// This is the body of the play's single script node, bundled in by
// `js({ path })`. It reads one sibling node output — `nodes.hubspot`, the CRM
// search — plus the enrolled row on `nodes.start`. Those are slugs the compiler
// assigned, so inserting a connector node ahead of the script renames them;
// `evals/contract.mjs` calls this module with the slugs it expects.

import type { ScriptNode } from "@cargo-ai/cdk";

import {
  agreementOn,
  clusterAround,
  rankCluster,
  readSearchResults,
  summarize,
} from "./cluster";
import { asText, identifiesOneCompany } from "./normalize";

export type Evidence = {
  sourceFound: boolean;
  hasDuplicates: boolean;
  duplicateCount: number;
  primaryId: string;
  idsToMerge: string[];
  exactLinkedinId: boolean;
  exactLinkedinUrl: boolean;
  exactDomain: boolean;
  identityConflict: boolean;
  protectedIdConflict: boolean;
  parentOrSubsidiaryWarning: boolean;
  autoEligible: boolean;
  evidenceSummary: string;
};

const evidence: ScriptNode<Evidence> = ({ nodes }) => {
  const records = readSearchResults(nodes.hubspot);
  const sourceId = asText(nodes.start.hs_object_id);
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
};

export default evidence;
