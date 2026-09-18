import { defineConfig } from "vite";
import { visitorTrackingPlugin } from "./visitor-support.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  escapeHtml as e,
  sourceHash,
  validateContent,
} from "./build-support.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
export default defineConfig({
  plugins: [
    visitorTrackingPlugin(root),
    {
      name: "company-content",
      transformIndexHtml(html) {
        const site = JSON.parse(
          readFileSync(new URL("./site.json", import.meta.url), "utf8"),
        );
        validateContent(site);
        const values: Record<string, string> = {
          COMPANY: e(site.companyName),
          EYEBROW: e(site.eyebrow),
          HEADLINE: e(site.headline),
          DESCRIPTION: e(site.description),
          CTA_LABEL: e(site.cta.label),
          CTA_HREF: e(site.cta.href),
          DRAFT:
            site.status === "draft"
              ? '<p class="draft" role="status">Draft preview</p>'
              : "",
          ROBOTS: site.status === "draft" ? "noindex,nofollow" : "index,follow",
          CANONICAL: site.canonicalUrl
            ? `<link rel="canonical" href="${e(site.canonicalUrl)}"><meta property="og:url" content="${e(site.canonicalUrl)}">`
            : "",
          FEATURES: site.features
            .map(
              (f: { title: string; body: string }, i: number) =>
                `<article class="feature"><span class="number">0${i + 1}</span><h3>${e(f.title)}</h3><p>${e(f.body)}</p></article>`,
            )
            .join(""),
        };
        return html.replace(
          /\{\{([A-Z_]+)\}\}/g,
          (_, key: string) => values[key] ?? "",
        );
      },
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "website-build.json",
          source:
            JSON.stringify({ version: 1, sourceSha256: sourceHash(root) }) +
            "\n",
        });
      },
    },
  ],
});
