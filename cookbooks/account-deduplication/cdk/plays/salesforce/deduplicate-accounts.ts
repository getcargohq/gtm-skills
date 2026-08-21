import { defineModel, definePlay, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";
// The audit importer derives cluster rows from the selected Salesforce Account
// model. The proposal play consumes clusters, not individual CRM Account rows.
const crmAccountDuplicateCandidates = defineModel(
  "salesforce_account_duplicate_candidates",
  {
    kind: "native",
    extractSlug: "defineCustom",
    config: {
      columns: [
        { slug: "cluster_id", type: "string" },
        { slug: "source_model_slug", type: "string" },
        { slug: "master_id", type: "string" },
        { slug: "duplicate_id", type: "string" },
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
const proposePair = defineWorkflow(
  "propose_salesforce_account_pair",
  {
    input: z.object({
      cluster_id: z.string().trim().min(1),
      source_model_slug: z.string().trim().min(1),
      master_id: z.string().trim().min(1),
      duplicate_id: z.string().trim().min(1),
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
      masterId: z.string(),
      duplicateId: z.string(),
    }),
  },
  ({ input }) => {
    if (input.stale)
      return {
        approvedForMerge: false,
        reason: "stale_live_reread",
        masterId: input.master_id,
        duplicateId: input.duplicate_id,
      };
    if (input.identity_conflict || input.protected_id_conflict)
      return {
        approvedForMerge: false,
        reason: "identity_or_protected_id_conflict",
        masterId: input.master_id,
        duplicateId: input.duplicate_id,
      };
    if (
      input.match_class !== "exact_unique_linkedin" ||
      !input.normalized_linkedin_id
    )
      return {
        approvedForMerge: false,
        reason: "review_only_match_class",
        masterId: input.master_id,
        duplicateId: input.duplicate_id,
      };
    return {
      approvedForMerge: false,
      reason: "mandatory_live_guard_not_implemented",
      masterId: input.master_id,
      duplicateId: input.duplicate_id,
    };
  },
);
export const deduplicateAccounts = definePlay("deduplicate_accounts", {
  model: crmAccountDuplicateCandidates,
  workflow: proposePair,
  limit: 15,
  isEnabled: false,
  runCreationRule: "noConcurrency",
  changeKinds: ["added", "updated"],
});
