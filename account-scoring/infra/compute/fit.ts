// The arithmetic of the fit model, and nothing else: no model call, no I/O, no
// judgment. The same values always produce the same grade. Bundled into the
// script nodes in ./score-fit.ts, ./assemble-profile.ts and
// ./values-from-row.ts, and called directly by the contract's tests.

import type { FitAttribute, FitModel, FitRule } from "../model-types";

export type FitValue = number | string | null;

export type FitResult = {
  grade: "Strong" | "Moderate" | "Weak" | "No Fit";
  score: number;
  filtered_by: string;
  breakdown: string;
  unknown_count: number;
  model_version: number;
};

// A value the attribute can hold, or null. Anything else (a missing field, an
// empty string, "unknown", a label outside the list, a number that is not one)
// is a coverage gap: neutral in the score, never a "no".
export function normalize(attribute: FitAttribute, raw: unknown): FitValue {
  if (raw === undefined || raw === null || raw === "" || raw === "unknown")
    return null;
  if (attribute.type === "number") {
    const value = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(value) ? value : null;
  }
  const label = String(raw).trim().toLowerCase();
  return (attribute.values ?? []).includes(label) ? label : null;
}

function pointsFor(rule: FitRule, value: number | string): number {
  if (rule.points !== undefined) return rule.points[String(value)] ?? 0;
  const range = (rule.ranges ?? []).find((candidate) => {
    return typeof value === "number" && value >= candidate.min;
  });
  return range === undefined ? 0 : range.points;
}

export function computeFit(
  model: FitModel,
  rawValues: Record<string, unknown> | null | undefined,
): FitResult {
  const values = rawValues ?? {};
  const attributes = new Map(
    model.attributes.map((attribute) => [attribute.slug, attribute]),
  );
  const valueOf = (slug: string): FitValue => {
    const attribute = attributes.get(slug);
    return attribute === undefined ? null : normalize(attribute, values[slug]);
  };
  const labelOf = (slug: string) => attributes.get(slug)?.label ?? slug;

  const fired = model.filters.filter((filter) => {
    const value = valueOf(filter.attribute);
    if (value === null) return false;
    if (filter.below !== undefined)
      return typeof value === "number" && value < filter.below;
    if (filter.above !== undefined)
      return typeof value === "number" && value > filter.above;
    return (filter.in ?? []).includes(String(value));
  });

  const lines: string[] = [];
  let total = 0;
  let unknownCount = 0;
  for (const rule of model.weights) {
    const value = valueOf(rule.attribute);
    const points = value === null ? rule.unknown : pointsFor(rule, value);
    if (value === null) unknownCount += 1;
    total += points;
    lines.push(
      `${labelOf(rule.attribute)}: ${value ?? "unknown"} (${points} of ${rule.weight})`,
    );
  }
  for (const rule of model.modifiers) {
    const value = valueOf(rule.attribute);
    const points =
      value === null ? (rule.unknown ?? 0) : pointsFor(rule, value);
    total += points;
    if (points !== 0)
      lines.push(
        `${labelOf(rule.attribute)}: ${value ?? "unknown"} (${points > 0 ? "+" : ""}${points})`,
      );
  }

  const score = Math.max(0, Math.min(100, total));
  const grade =
    fired.length > 0
      ? "No Fit"
      : score >= model.bands.strong
        ? "Strong"
        : score >= model.bands.moderate
          ? "Moderate"
          : "Weak";

  return {
    grade,
    score,
    filtered_by: fired
      .map((filter) => `${labelOf(filter.attribute)}: ${filter.why}`)
      .join(" · "),
    breakdown: lines.join(" · "),
    unknown_count: unknownCount,
    model_version: model.model_version,
  };
}

// The enrichment's results, normalized, plus the column writes that store them
// on the row: one value column and one evidence column per attribute, and the
// enrichment stamp. `provider` holds the provider attributes' raw results by
// attribute slug; `research` is the structured research answer, whose
// `<slug>` and `<slug>_evidence` fields the research schema declares.
export function buildProfile(
  model: FitModel,
  firmographicColumns: Record<string, string>,
  row: Record<string, unknown> | null | undefined,
  research: Record<string, unknown> | null | undefined,
  provider: Record<string, unknown>,
) {
  const values: Record<string, FitValue> = {};
  const mappings: Array<{ columnSlug: string; value: unknown }> = [];
  let unknown = 0;
  for (const attribute of model.attributes) {
    const kind = attribute.get.kind;
    const raw =
      kind === "firmographic"
        ? row?.[firmographicColumns[attribute.slug] ?? ""]
        : kind === "provider"
          ? provider[attribute.slug]
          : research?.[attribute.slug];
    const value = normalize(attribute, raw);
    const evidence =
      value === null
        ? ""
        : kind === "research"
          ? String(research?.[`${attribute.slug}_evidence`] ?? "")
          : kind === "provider"
            ? attribute.get.how
            : "account record";
    if (value === null) unknown += 1;
    values[attribute.slug] = value;
    mappings.push({
      columnSlug: `fit_${attribute.slug}`,
      value: value ?? (attribute.type === "enum" ? "unknown" : null),
    });
    mappings.push({
      columnSlug: `fit_${attribute.slug}_evidence`,
      value: evidence,
    });
  }
  mappings.push({ columnSlug: "enriched_at", value: new Date().toISOString() });
  return {
    values,
    mappings,
    filled: model.attributes.length - unknown,
    unknown,
  };
}

// The values stored on a row by an earlier enrichment, read back for a rescore.
// Custom columns read as `custom__<slug>`.
export function readStoredValues(
  model: FitModel,
  row: Record<string, unknown> | null | undefined,
): Record<string, FitValue> {
  const values: Record<string, FitValue> = {};
  for (const attribute of model.attributes)
    values[attribute.slug] = normalize(
      attribute,
      row?.[`custom__fit_${attribute.slug}`],
    );
  return values;
}
