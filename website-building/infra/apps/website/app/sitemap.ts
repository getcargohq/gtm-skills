import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";

export const dynamic = "force-static";

// Sitemaps need absolute URLs, so the list stays empty until site.json has
// the approved canonicalUrl.
export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/about/"].flatMap((path) => {
    const url = siteUrl(path);
    return url ? [{ url }] : [];
  });
}
