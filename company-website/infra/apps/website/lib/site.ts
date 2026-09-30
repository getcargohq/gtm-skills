import type { Metadata } from "next";
import content from "../site.json";
import { validateContent } from "../build-support.mjs";

// Read at build time only: every page is prerendered by the static export, so
// site.json is validated once and never shipped as a separate request.
validateContent(content);
export const site = content;

export const isDraft = site.status === "draft";

/** Absolute URL for a route on the approved public origin, if one is set. */
export function siteUrl(path = "/"): string | undefined {
  return site.canonicalUrl ? new URL(path, site.canonicalUrl).href : undefined;
}

export function pageMetadata(
  path: string,
  title: string,
  description: string,
): Metadata {
  const url = siteUrl(path);
  return {
    title,
    description,
    robots: isDraft
      ? { index: false, follow: false }
      : { index: true, follow: true },
    alternates: url ? { canonical: url } : undefined,
    openGraph: {
      type: "website",
      siteName: site.companyName,
      title,
      description,
      url,
    },
    twitter: { card: "summary", title, description },
  };
}
