import type { MetadataRoute } from "next";

import { isDraft, siteUrl } from "@/lib/site";

export const dynamic = "force-static";

// Drafts stay out of search indexes; a ready site points at its sitemap on
// the approved public origin.
export default function robots(): MetadataRoute.Robots {
  if (isDraft) return { rules: { userAgent: "*", disallow: "/" } };
  const sitemap = siteUrl("/sitemap.xml");
  return {
    rules: { userAgent: "*", allow: "/" },
    ...(sitemap ? { sitemap } : {}),
  };
}
