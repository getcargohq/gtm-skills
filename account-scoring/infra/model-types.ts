// The shape of the fit model: the json block under `## Model` in
// context/icp/scoring.md, generated into ./model.ts. The rules a valid model
// obeys are in references/scoring-format.md and enforced by
// scripts/account-scoring/sync-model.mjs.

export type AttributeKind = "firmographic" | "provider" | "research";

export type FitAttribute = {
  slug: string;
  label: string;
  type: "number" | "enum";
  // Enum attributes only. "unknown" is implicit, never declared.
  values?: string[];
  definition: string;
  get: { kind: AttributeKind; how: string };
};

export type FitRange = { min: number; points: number };

// One of `points` (enum attributes) or `ranges` (number attributes).
export type FitRule = {
  attribute: string;
  points?: Record<string, number>;
  ranges?: FitRange[];
  unknown?: number;
};

export type FitWeight = FitRule & { weight: number; unknown: number };

export type FitFilter = {
  attribute: string;
  below?: number;
  above?: number;
  in?: string[];
  why: string;
};

export type FitModel = {
  model_version: number;
  attributes: FitAttribute[];
  filters: FitFilter[];
  weights: FitWeight[];
  modifiers: FitRule[];
  bands: { strong: number; moderate: number };
};
