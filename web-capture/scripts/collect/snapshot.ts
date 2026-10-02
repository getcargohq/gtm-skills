/**
 * The network-free half of the collector: what a page and a news item are,
 * how a page's HTML becomes text, and how one week's snapshot is diffed
 * against the previous one. Pure apart from reading and writing the snapshot
 * files, so the contract eval runs it on canned data.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";

export type Page = {
  url: string;
  /** ok: read; missing: 404 or 410, never counted as removed; error: anything else. */
  status: "ok" | "missing" | "error";
  /** How the text was read: a plain fetch, or parallel.extract for a rendered page. */
  via: "fetch" | "extract" | null;
  title: string | null;
  /** sha256 of the text, so a change is a comparison, not a judgement. */
  hash: string | null;
  text: string;
  error?: string;
};

export type NewsItem = {
  date: string | null;
  title: string;
  url: string;
  kind: string | null;
  summary: string | null;
};

export type Snapshot = {
  collectedAt: string;
  domain: string;
  /** The news window. */
  window: { from: string; to: string; days: number };
  firstRun: boolean;
  pages: Page[];
  news: NewsItem[];
  /** What the run billed: pages read through parallel.extract, and tasks. */
  spend: { extractPages: number; newsTasks: number };
  changes: {
    previous: string | null;
    pagesAdded: string[];
    pagesRemoved: string[];
    pagesChanged: string[];
    /** News URLs not in the previous snapshot. */
    newsNew: string[];
  };
};

// This file sits at scripts/<cookbook>/collect/, so the repo root is three up.
// Resolved from the file rather than from cwd: the agent may run it from
// anywhere in the working tree.
export const ROOT = resolve(import.meta.dirname, "..", "..", "..");
export const RAW_DIR = join(ROOT, "cadence", "log", "raw", "web");

const PLACEHOLDER = "PLACEHOLDER_COMPANY_DOMAIN";

/** The domain to read, bare, or a reason it cannot be read. */
export function resolveDomain(
  flag: string | undefined,
  configured: string,
): { domain: string } | { error: string } {
  const raw = (flag ?? configured).trim().toLowerCase();
  if (raw === "" || raw === PLACEHOLDER.toLowerCase()) {
    return {
      error:
        "DOMAIN in scripts/web-capture/collect/config.ts is still the placeholder: set it to the company's own domain",
    };
  }
  const domain = raw
    .replace(/^(?:https?:\/\/)?(?:www\.)?/, "")
    .replace(/[/?#].*$/, "");
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)
    ? { domain }
    : { error: `${raw} is not a domain` };
}

export const sha256 = (text: string): string => {
  return createHash("sha256").update(text).digest("hex");
};

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

const decode = (text: string): string => {
  return text
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&([a-z]+);/gi, (match, name: string) => {
      return ENTITIES[name.toLowerCase()] ?? match;
    });
};

/**
 * A page's readable text: scripts, styles, navigation chrome and tags out,
 * whitespace collapsed. Crude on purpose: it only has to be stable from one
 * week to the next, so the same page hashes the same.
 */
export function htmlToText(
  html: string,
  limit: number,
): { title: string | null; text: string } {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const text = decode(
    html
      .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n[\n ]*/g, "\n")
    .trim();
  return {
    title: title === undefined ? null : decode(title).trim() || null,
    text: text.slice(0, limit),
  };
}

/** A URL as one key: no scheme, no `www.`, no tracking query, no trailing slash. */
export const urlKey = (url: string): string => {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
};

/** The most recent earlier snapshot, so a run can say what changed since. */
export function previousSnapshot(
  today: string,
): { path: string; snapshot: Snapshot } | null {
  if (!existsSync(RAW_DIR)) return null;
  const latest = readdirSync(RAW_DIR)
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .filter((name) => name.slice(0, 10) < today)
    .sort()
    .at(-1);
  if (latest === undefined) return null;
  const path = join(RAW_DIR, latest);
  return {
    path: relative(ROOT, path),
    snapshot: JSON.parse(readFileSync(path, "utf8")) as Snapshot,
  };
}

export function buildSnapshot(input: {
  domain: string;
  window: Snapshot["window"];
  pages: Page[];
  news: NewsItem[];
  previous: { path: string; snapshot: Snapshot } | null;
  now?: string;
}): Snapshot {
  const previous = input.previous?.snapshot;
  const before = new Map(
    (previous?.pages ?? [])
      .filter((page) => page.status === "ok")
      .map((page) => [urlKey(page.url), page.hash]),
  );
  const now = new Map(
    input.pages
      .filter((page) => page.status === "ok")
      .map((page) => [urlKey(page.url), page.hash]),
  );
  const seen = new Set((previous?.news ?? []).map((item) => urlKey(item.url)));
  const news = input.news.filter(
    (item, index, all) =>
      all.findIndex((other) => urlKey(other.url) === urlKey(item.url)) ===
      index,
  );

  return {
    collectedAt: input.now ?? new Date().toISOString(),
    domain: input.domain,
    window: input.window,
    firstRun: previous === undefined,
    pages: input.pages,
    news,
    spend: {
      extractPages: input.pages.filter((page) => page.via === "extract").length,
      newsTasks: 1,
    },
    changes: {
      previous: input.previous?.path ?? null,
      // With no previous snapshot nothing "changed": the first run seeds.
      pagesAdded:
        previous === undefined
          ? []
          : [...now.keys()].filter((key) => !before.has(key)),
      pagesRemoved:
        previous === undefined
          ? []
          : [...before.keys()].filter((key) => !now.has(key)),
      pagesChanged: [...now.entries()]
        .filter(([key, hash]) => before.has(key) && before.get(key) !== hash)
        .map(([key]) => key),
      newsNew: news
        .map((item) => item.url)
        .filter((url) => !seen.has(urlKey(url))),
    },
  };
}

/** Write the snapshot as cadence/log/raw/web/<today>.json and return the path. */
export function writeSnapshot(snapshot: Snapshot, today: string): string {
  mkdirSync(RAW_DIR, { recursive: true });
  const path = join(RAW_DIR, `${today}.json`);
  writeFileSync(path, `${JSON.stringify(snapshot, null, 2)}\n`);
  return relative(ROOT, path);
}

/**
 * The first array of objects under `key` anywhere in an action's output. The
 * output shapes of `parallel.extract` and `parallel.createTask` are read
 * defensively: an unexpected shape yields nothing rather than a crash, and
 * the run reports the zero.
 */
export function findArray(
  value: unknown,
  match: (item: Record<string, unknown>) => boolean,
): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    const objects = value.filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null && !Array.isArray(item),
    );
    if (objects.length > 0 && objects.every(match)) return objects;
    for (const item of value) {
      const found = findArray(item, match);
      if (found.length > 0) return found;
    }
    return [];
  }
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) {
      const found = findArray(child, match);
      if (found.length > 0) return found;
    }
  }
  return [];
}

const str = (value: unknown): string | null => {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
};

/** News items from a createTask output, keeping only the ones with a URL. */
export function readNews(output: unknown): NewsItem[] {
  return findArray(output, (item) => typeof item["url"] === "string")
    .map((item) => ({
      date: str(item["date"]),
      title: str(item["title"]) ?? "",
      url: str(item["url"]) ?? "",
      kind: str(item["kind"]),
      summary: str(item["summary"]),
    }))
    .filter((item) => item.url !== "" && item.title !== "");
}

/** The text of one page from an extract output: full content, else excerpts. */
export function readExtract(output: unknown): string {
  const [result] = findArray(output, (item) => typeof item["url"] === "string");
  if (result === undefined) return "";
  const content =
    str(result["full_content"]) ??
    str(result["content"]) ??
    str(result["markdown"]) ??
    str(result["text"]);
  if (content !== null) return content;
  const excerpts = result["excerpts"];
  return Array.isArray(excerpts)
    ? excerpts.filter((e) => typeof e === "string").join("\n")
    : "";
}
