import { defineModel, definePlay, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";
// The audit importer derives cluster rows from the selected Attio Companies
// model. The proposal play consumes clusters, not individual CRM company rows.
const crmAccountDuplicateCandidates = defineModel(
  "attio_account_duplicate_candidates",
  {
    kind: "native",
    extractSlug: "defineCustom",
    config: {
      columns: [
        { slug: "cluster_id", type: "string" },
        { slug: "source_model_slug", type: "string" },
        { slug: "ordered_record_ids", type: "array" },
        { slug: "match_class", type: "string" },
        { slug: "normalized_linkedin_id", type: "string" },
        { slug: "identity_conflict", type: "boolean" },
        { slug: "protected_id_conflict", type: "boolean" },
        { slug: "stale", type: "boolean" },
        { slug: "survivor_rank", type: "number" },
      ],
    },
  },
);
const proposeCluster = defineWorkflow(
  "propose_attio_account_cluster",
  {
    input: z.object({
      cluster_id: z.string().trim().min(1),
      source_model_slug: z.string().trim().min(1),
      ordered_record_ids: z.array(z.string().trim().min(1)).min(2),
      match_class: z.string(),
      normalized_linkedin_id: z.string(),
      identity_conflict: z.boolean(),
      protected_id_conflict: z.boolean(),
      stale: z.boolean(),
      survivor_rank: z.number(),
    }),
    output: z.object({
      approvedForMerge: z.boolean(),
      reason: z.string(),
      orderedRecordIds: z.array(z.string()),
    }),
  },
  ({ input }) => {
    if (input.stale)
      return {
        approvedForMerge: false,
        reason: "stale_live_reread",
        orderedRecordIds: input.ordered_record_ids,
      };
    if (input.identity_conflict || input.protected_id_conflict)
      return {
        approvedForMerge: false,
        reason: "identity_or_protected_id_conflict",
        orderedRecordIds: input.ordered_record_ids,
      };
    if (
      input.match_class !== "exact_unique_linkedin" ||
      !input.normalized_linkedin_id
    )
      return {
        approvedForMerge: false,
        reason: "review_only_match_class",
        orderedRecordIds: input.ordered_record_ids,
      };
    return {
      approvedForMerge: false,
      reason: "mandatory_live_guard_and_new_record_id_chain_not_implemented",
      orderedRecordIds: input.ordered_record_ids,
    };
  },
);
export const deduplicateAccounts = definePlay("deduplicate_accounts", {
  model: crmAccountDuplicateCandidates,
  workflow: proposeCluster,
  limit: 15,
  isEnabled: false,
  runCreationRule: "noConcurrency",
  changeKinds: ["added", "updated"],
});
