"use client";

import { useEffect } from "react";

import type { VisitorConsentConfig } from "@/visitor-support.mjs";

// Rendered by the layout only when visitor-browser.json is enabled and its
// provider script is approved. The gate itself is plain DOM code in
// visitor-runtime.js, fetched as its own chunk after hydration; it loads
// nothing from the provider until the visitor accepts.
export function VisitorConsent({ config }: { config: VisitorConsentConfig }) {
  useEffect(() => {
    void import("@/visitor-runtime.js").then(({ startVisitorConsent }) =>
      startVisitorConsent(config),
    );
  }, [config]);
  return null;
}
