export interface SiteContent {
  status: "draft" | "ready";
  companyName: string;
  eyebrow: string;
  headline: string;
  description: string;
  cta: { label: string; href: string };
  canonicalUrl: string;
  features: { title: string; body: string }[];
  about: { title: string; description: string; body: string[] };
}
export function sourceHash(root: string): string;
export function escapeHtml(value: unknown): string;
export function validateContent(site: any): asserts site is SiteContent;
export function assertReady(site: any): void;
export function assertUploadable(root: string): void;
export function writeBuildMarker(root: string, output: string): void;
