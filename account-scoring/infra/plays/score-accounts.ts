import { definePlay, defineWorkflow } from "@cargo-ai/cdk";
import { z } from "zod";
import { hubspot } from "../connectors/hubspot";
import { accounts } from "../models/accounts";
import { accountScorer } from "../agents/scorer";
import { computeFit, snapshotSchema } from "../tools/compute-fit";
import {
  normalizeScript,
  scoringVersion,
  tierNames,
} from "../runtime/generated";
import { playsFolder } from "../folders";

// js() scripts execute in Cargo, where require("zod") is documented. No Node
// modules are imported by these declarative resources.
declare function require(name: string): any;

const allowedTiers: string[] = [...tierNames];

export const scoreAccount = defineWorkflow(
  "score-account",
  {
    // CRM extract passthrough supplies the audited baseline property mappings.
    input: z
      .object({
        id: z.union([z.string(), z.number()]).nullish(),
        hs_object_id: z.union([z.string(), z.number()]).nullish(),
        custom__fit_attempt_version: z.string().nullish(),
        custom__fit_attempt_count: z.union([z.string(), z.number()]).nullish(),
        custom__fit_evidence: z.string().nullish(),
      })
      .passthrough(),
    output: z.object({ scored: z.boolean(), status: z.string() }),
    uses: { accountScorer, hubspot, computeFit },
    imports: { accounts, normalizeScript, scoringVersion, allowedTiers },
  },
  ({ input, uses, model, python, js }) => {
    const prepare = js(({ nodes }) => {
      const ids = [nodes.start.id, nodes.start.hs_object_id]
        .filter((id) => id != null && String(id).length > 0)
        .map(String);
      if (!ids.length || new Set(ids).size !== 1)
        throw new Error("CRM record ID missing or conflicting");
      const attempts = Number(nodes.start.custom__fit_attempt_count ?? 0);
      if (!Number.isInteger(attempts) || attempts < 0)
        throw new Error("Invalid attempt counter; inspect before retry");
      return { id: ids[0], now: new Date().toISOString(), attempts };
    });
    if (
      input.custom__fit_attempt_version === scoringVersion &&
      prepare.attempts >= 3
    ) {
      return { scored: false, status: "retry_exhausted" };
    }
    // Persist the attempt before any paid explanation or CRM write. Failures keep
    // the previous successful evidence and consume the retry allowance.
    model.customColumn({
      modelUuid: accounts.uuid,
      id: prepare.id,
      mappings: [
        { columnSlug: "fit_status", value: "error" },
        { columnSlug: "fit_attempt_version", value: scoringVersion },
        {
          columnSlug: "fit_attempt_count",
          value:
            input.custom__fit_attempt_version === scoringVersion
              ? prepare.attempts + 1
              : 1,
        },
      ],
    });
    const normalized = python<z.infer<typeof snapshotSchema>>({
      script: normalizeScript,
    });
    model.customColumn({
      modelUuid: accounts.uuid,
      id: prepare.id,
      mappings: [
        {
          columnSlug: "fit_snapshot",
          value: JSON.stringify(normalized.result),
        },
      ],
    });
    const computed = uses.computeFit({
      snapshot: normalized.result,
      contract_ref: scoringVersion,
    });
    // Actual runtime validation, not just a TypeScript annotation. Reject extra
    // fields, bad status/null combinations and an identity/version mismatch.
    const trusted = js(({ nodes }) => {
      const z = require("zod").z;
      const r = z
        .object({
          scoring_status: z.enum(["scored", "insufficient_data", "error"]),
          score: z.number().int().min(0).max(100).nullable(),
          tier: z.string().min(1).nullable(),
          scoring_version: z.string().min(1),
          feature_contract_version: z.string().min(1),
          feature_snapshot_at: z.string(),
          snapshot_hash: z.string().regex(/^[a-f0-9]{64}$/),
          applied_gates: z.array(z.string()),
          rule_contributions: z.array(
            z
              .object({ rule: z.string(), points: z.number().finite() })
              .strict(),
          ),
          missing_features: z.array(z.string()),
          data_quality_notes: z.array(z.string()),
        })
        .strict()
        .parse(nodes.tool);
      const snapshot = nodes.python.result;
      if (
        snapshot.account_id !== nodes.script.result.id ||
        r.feature_contract_version !== snapshot.feature_contract_version ||
        r.feature_snapshot_at !== snapshot.snapshot_at
      )
        throw new Error("Scoring identity/version mismatch");
      if (
        (r.scoring_status === "scored") !==
        (r.score !== null && r.tier !== null)
      )
        throw new Error("Invalid score/status combination");
      if (
        r.scoring_status !== "scored" &&
        (r.score !== null || r.tier !== null)
      )
        throw new Error("Unscored values must be null");
      return r;
    });
    if (
      trusted.scoring_status === "scored" &&
      !allowedTiers.includes(trusted.tier)
    ) {
      return { scored: false, status: "error" };
    }
    if (trusted.scoring_version !== scoringVersion) {
      return { scored: false, status: "error" };
    }
    model.customColumn({
      modelUuid: accounts.uuid,
      id: prepare.id,
      mappings: [
        { columnSlug: "fit_result", value: JSON.stringify(trusted) },
        {
          columnSlug: "fit_status",
          value:
            trusted.scoring_status === "scored"
              ? "error"
              : trusted.scoring_status,
        },
      ],
    });
    if (trusted.scoring_status !== "scored") {
      return { scored: false, status: trusted.scoring_status };
    }
    const explanation = uses.accountScorer({
      prompt: `Explain this trusted Python result: ${JSON.stringify(trusted)}. Persisted feature snapshot: ${JSON.stringify(normalized.result)}.`,
    });
    const payload = js(({ nodes }) => {
      const z = require("zod").z;
      const answer = z
        .object({ rationale: z.string().min(1).max(4000) })
        .strict()
        .parse(nodes.agent.answer);
      // Numerical authority comes ONLY from trusted. Agent prose cannot replace it.
      return {
        score: nodes.script_2.result.score,
        tier: nodes.script_2.result.tier,
        version: nodes.script_2.result.scoring_version,
        rationale: answer.rationale,
      };
    });
    // PLACEHOLDER: reuse approved CRM properties after checking live field types.
    uses.hubspot.updateRecords({
      objectType: "companies",
      matchingPropertyName: "hs_object_id",
      matchingValue: prepare.id,
      mappings: [
        { propertyName: "cargo_score", value: payload.score },
        { propertyName: "cargo_tier", value: payload.tier },
        { propertyName: "cargo_rationale", value: payload.rationale },
        { propertyName: "cargo_scoring_version", value: payload.version },
      ],
    });
    const verified = js(({ nodes }) => {
      // Check the update response: getRecord may omit properties in large portals.
      const records = nodes.hubspot;
      if (!Array.isArray(records) || records.length !== 1)
        throw new Error("CRM write must update exactly one record");
      const record = records[0];
      const expected = nodes.script_3.result;
      if (
        String(record?.id) !== nodes.script.result.id ||
        record?.properties?.cargo_score == null ||
        record.properties.cargo_score === "" ||
        Number(record.properties.cargo_score) !== expected.score ||
        record.properties.cargo_tier !== expected.tier ||
        record.properties.cargo_scoring_version !== expected.version ||
        record.properties.cargo_rationale !== expected.rationale
      )
        throw new Error("CRM write readback mismatch; success stamp withheld");
      return { at: new Date().toISOString() };
    });
    const stamped = uses.hubspot.updateRecords({
      objectType: "companies",
      matchingPropertyName: "hs_object_id",
      matchingValue: prepare.id,
      mappings: [{ propertyName: "cargo_last_updated_at", value: verified.at }],
    });
    // A connector can succeed with [] when no row matched. This is not success.
    const stampVerified = js(({ nodes }) => {
      if (
        !Array.isArray(nodes.hubspot_2) ||
        nodes.hubspot_2.length !== 1 ||
        String(nodes.hubspot_2[0]?.id) !== nodes.script.result.id ||
        Date.parse(nodes.hubspot_2[0]?.properties?.cargo_last_updated_at) !==
          Date.parse(nodes.script_4.result.at)
      )
        throw new Error(
          "CRM timestamp write did not update exactly one record",
        );
      return { at: nodes.script_4.result.at };
    });
    model.customColumn({
      modelUuid: accounts.uuid,
      id: prepare.id,
      mappings: [
        { columnSlug: "fit_status", value: "scored" },
        { columnSlug: "fit_attempt_count", value: 0 },
        {
          columnSlug: "fit_last_scored_snapshot",
          value: JSON.stringify(normalized.result),
        },
        {
          columnSlug: "fit_last_scored_result",
          value: JSON.stringify(trusted),
        },
        { columnSlug: "fit_scoring_version", value: payload.version },
        { columnSlug: "fit_scored_at", value: stampVerified.at },
      ],
    });
    return { scored: true, status: "scored" };
  },
);

export const scoreAccounts = definePlay("score-accounts", {
  description:
    "Apply approved structural-fit rules to normalized CRM account evidence; explain and verify CRM writeback.",
  folder: playsFolder,
  model: accounts,
  workflow: scoreAccount,
  isEnabled: false,
  // Per sweep, not a total budget. Add the approved pilot ID filter before enable.
  limit: 25,
  runCreationRule: "noConcurrency",
  // Sweep all eligible members, including unchanged rows. Version changes and
  // rows present before enable must not depend on a new 'added' event.
  changeKinds: ["added", "updated", "unchanged"],
  schedule: { type: "cron", cron: "0 6 * * 1" },
  filter: {
    conjonction: "and",
    groups: [
      {
        conjonction: "or",
        conditions: [
          {
            kind: "string",
            columnSlug: accounts.columns.custom__fit_attempt_version,
            operator: "isNull",
          },
          {
            kind: "string",
            columnSlug: accounts.columns.custom__fit_attempt_version,
            operator: "isNot",
            values: [scoringVersion],
          },
          {
            kind: "number",
            columnSlug: accounts.columns.custom__fit_attempt_count,
            operator: "isNull",
          },
          {
            kind: "number",
            columnSlug: accounts.columns.custom__fit_attempt_count,
            operator: "lowerThan",
            value: 3,
          },
        ],
      },
      {
        conjonction: "or",
        conditions: [
          {
            kind: "date",
            columnSlug: accounts.columns.custom__fit_scored_at,
            operator: "isNull",
          },
          {
            kind: "date",
            columnSlug: accounts.columns.custom__fit_scored_at,
            operator: "lowerThan",
            value: "3 months",
          },
          {
            kind: "string",
            columnSlug: accounts.columns.custom__fit_scoring_version,
            operator: "isNull",
          },
          {
            kind: "string",
            columnSlug: accounts.columns.custom__fit_scoring_version,
            operator: "isNot",
            values: [scoringVersion],
          },
        ],
      },
    ],
  },
});
