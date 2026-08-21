import { defineModel, definePlay, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";

// The audit importer reads the selected HubSpot Account model and materializes
// one fully classified pair per row. A raw CRM Account row cannot represent the
// complete duplicate cluster required by this proposal play.
const crmAccountDuplicateCandidates = defineModel(
  "hubspot_account_duplicate_candidates",
  {
    kind: "native",
    extractSlug: "defineCustom",
    config: {
      columns: [
        { slug: "cluster_id", type: "string" },
        { slug: "source_model_slug", type: "string" },
        { slug: "primary_id", type: "string" },
        { slug: "secondary_id", type: "string" },
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
  "propose_hubspot_account_pair",
  {
    input: z.object({
      cluster_id: z.string().trim().min(1),
      source_model_slug: z.string().trim().min(1),
      primary_id: z.string().trim().min(1),
      secondary_id: z.string().trim().min(1),
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
      primaryId: z.string(),
      secondaryId: z.string(),
    }),
  },
  ({ input }) => {
    if (input.stale)
      return {
        approvedForMerge: false,
        reason: "stale_live_reread",
        primaryId: input.primary_id,
        secondaryId: input.secondary_id,
      };
    if (input.identity_conflict || input.protected_id_conflict)
      return {
        approvedForMerge: false,
        reason: "identity_or_protected_id_conflict",
        primaryId: input.primary_id,
        secondaryId: input.secondary_id,
      };
    if (
      input.match_class !== "exact_unique_linkedin" ||
      !input.normalized_linkedin_id
    )
      return {
        approvedForMerge: false,
        reason: "review_only_match_class",
        primaryId: input.primary_id,
        secondaryId: input.secondary_id,
      };
    return {
      approvedForMerge: false,
      reason: "mandatory_live_guard_not_implemented",
      primaryId: input.primary_id,
      secondaryId: input.secondary_id,
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
