import type { VisitorConsentConfig } from "@/visitor-support.mjs";

// Swapped in by next.config.ts while visitor tracking is off, so the export
// carries no consent loader and no tracking code at all.
export function VisitorConsent(_: { config: VisitorConsentConfig }) {
  return null;
}
