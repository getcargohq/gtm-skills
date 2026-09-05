/**
 * Reading a field whose name the vendor does not document.
 *
 * Every recorder here documents the parameter you filter a list by. Not all of
 * them document the key the list comes back under — Fathom, tl;dv, Modjo and
 * Clari Copilot all name their date filter in the reference and leave the
 * meeting object's own timestamp to be discovered from a live response.
 *
 * Guessing one is the worst option: a wrong key reads as "no calls", which is
 * a clean empty run every morning rather than an error. So the adapters for
 * those four read a small candidate list, and anything that resolves to no
 * timestamp at all is dropped loudly by name rather than filed under today.
 * `--dry-run` prints the date each call resolved to, which is where you see
 * that the right key was found.
 */

/** The first candidate key holding a non-empty string. */
export function pickString(
  record: Record<string, unknown>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return undefined;
}

/**
 * The first candidate key holding something a Date can parse, as ISO.
 *
 * Accepts epoch milliseconds as well as a string, because Read.ai and
 * Fireflies both hand back numbers where the neighbouring field is a
 * timestamp, and an adapter that only accepted strings would silently skip
 * every call on those.
 */
export function pickTimestamp(
  record: Record<string, unknown>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return new Date(value).toISOString();
    }
    if (typeof value !== "string" || value.trim() === "") continue;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return undefined;
}
