import { defineTool, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";
import { scoringScript } from "../runtime/generated";
import { toolsFolder } from "../folders";

export const snapshotSchema = z
  .object({
    account_id: z.string().min(1),
    snapshot_at: z.string(),
    feature_contract_version: z.string(),
    features: z.record(
      z.string(),
      z
        .object({
          value: z.union([z.number(), z.string(), z.null()]),
          as_of: z.string().nullable(),
          source_or_evidence_reference: z.string().nullable(),
          snapshot_quality: z.enum([
            "exact",
            "reconstructed",
            "current_proxy",
            "missing",
          ]),
          extraction_version: z.string(),
        })
        .strict(),
    ),
  })
  .strict();
export const scoreSchema = z
  .object({
    scoring_status: z.enum(["scored", "insufficient_data", "error"]),
    score: z.number().nullable(),
    tier: z.string().nullable(),
    scoring_version: z.string(),
    feature_contract_version: z.string(),
    feature_snapshot_at: z.string(),
    snapshot_hash: z.string(),
    applied_gates: z.array(z.string()),
    rule_contributions: z.array(
      z.object({ rule: z.string(), points: z.number() }),
    ),
    missing_features: z.array(z.string()),
    data_quality_notes: z.array(z.string()),
  })
  .strict();

const compute = defineWorkflow(
  "compute-account-fit",
  {
    input: z
      .object({ snapshot: snapshotSchema, contract_ref: z.string() })
      .strict(),
    output: scoreSchema,
    imports: { scoringScript },
  },
  ({ python }) => {
    const computed = python<z.infer<typeof scoreSchema>>({
      script: scoringScript,
    });
    return {
      scoring_status: computed.result.scoring_status,
      score: computed.result.score,
      tier: computed.result.tier,
      scoring_version: computed.result.scoring_version,
      feature_contract_version: computed.result.feature_contract_version,
      feature_snapshot_at: computed.result.feature_snapshot_at,
      snapshot_hash: computed.result.snapshot_hash,
      applied_gates: computed.result.applied_gates,
      rule_contributions: computed.result.rule_contributions,
      missing_features: computed.result.missing_features,
      data_quality_notes: computed.result.data_quality_notes,
    };
  },
);

// Earns its resource: validates a versioned contract, evidence, gates, missingness,
// contributions and tiering in one reusable Python implementation.
export const computeFit = defineTool("compute-account-fit", {
  workflow: compute,
  folder: toolsFolder,
});
