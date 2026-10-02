import type { Metadata } from "next";
import content from "../site.json";

// Read at build time only: every page is prerendered by the static export, so
// site.json is checked once and never shipped as a separate request. A bad
// value fails `next build` with the field named, instead of a broken page.
function assertContent(site: typeof content): void {
  for (const key of [
    "companyName",
    "eyebrow",
    "headline",
    "description",
  ] as const)
    if (site[key].trim() === "") throw new Error(`site.json: ${key} is empty.`);
  if (site.status !== "draft" && site.status !== "ready")
    throw new Error('site.json: status must be "draft" or "ready".');
  if (!/^(https:\/\/|mailto:|#|\/)/.test(site.cta.href))
    throw new Error(
      "site.json: cta.href must be HTTPS, mailto, an anchor or a path.",
    );
  if (
    site.canonicalUrl !== "" &&
    !/^https:\/\/[a-z0-9.-]+\/$/i.test(site.canonicalUrl)
  )
    throw new Error(
      "site.json: canonicalUrl must be an HTTPS origin ending in /, e.g. https://www.example.com/.",
    );
  if (site.features.length === 0 || site.about.body.length === 0)
    throw new Error(
      "site.json: features and about.body need at least one entry.",
    );
}
assertContent(content);
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
