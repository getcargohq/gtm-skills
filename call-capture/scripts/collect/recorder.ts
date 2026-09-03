/**
 * The recorder contract, and the provider-agnostic half of call capture.
 *
 * Nothing in this file knows which vendor records your calls. It defines what
 * a recorder must be able to do, and it holds everything that is the same
 * whoever answers: deduplication, account slugging, file layout, the rolling
 * window, and the run itself.
 *
 * To support a different recorder, write one object satisfying `Recorder` (see
 * `avoma.ts` for the worked one) and pass it to `capture`. TypeScript is what
 * keeps the boundary honest: an adapter that cannot satisfy this type is
 * telling you something real about the API, and an adapter cannot reach into
 * the pipeline below because it does not import it.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";

/** One call, normalized. Producing these is the adapter's job. */
export type Call = {
  /** The recorder's own id. The only idempotency key this system has. */
  id: string;
  /** ISO timestamp. Its date half becomes the filename and the frontmatter. */
  startAt: string;
  subject: string;
  attendees: { email?: string; name?: string }[];
};

export type Recorder = {
  /**
   * A slug, and load-bearing in a way that is easy to miss: it is written into
   * every file's `source:` line AND compiled into the regex that reads those
   * lines back for deduplication. One field feeds both, so they cannot drift.
   * Two literals that drift is the failure that re-captures the whole window
   * every morning without ever erroring.
   */
  provider: string;

  /**
   * Every call in the window whose transcript the recorder has finished
   * processing, normalized. Readiness is decided HERE, in the recorder's own
   * vocabulary, because there is no portable spelling of it: Avoma has `state`
   * plus `transcript_ready`, Gong has neither.
   *
   * Both dates are YYYY-MM-DD. Paginate to the end before returning.
   */
  listReady(from: string, to: string): Promise<Call[]>;

  /** The transcript as markdown, speaker-attributed, or null if there is none. */
  transcript(id: string): Promise<string | null>;

  /** The recorder's own AI notes, or null. The fallback when there is no transcript. */
  notes(id: string): Promise<string | null>;
};

// Auth is NOT in this file on purpose. Bearer, Basic and a signed GraphQL POST
// are three different things, and pretending otherwise is how the "agnostic"
// half ends up carrying one vendor's header. What IS shared is the retrying:
// rate limits and timeouts behave the same everywhere, and every adapter
// should get the backoff for free rather than reinventing it badly.
export class HttpError extends Error {
  constructor(
    readonly status: number,
    body: string,
  ) {
    super(`HTTP ${status}: ${body}`);
  }
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((done) => setTimeout(done, ms));

/**
 * Fetch JSON with 429 backoff and a timeout. The caller supplies the whole
 * request — method, headers, body — so the auth scheme stays the adapter's.
 */
export async function fetchJson<T>(
  url: string,
  init: RequestInit,
  maxAttempts = 5,
): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(120_000),
    });

    if (response.status === 429 && attempt < maxAttempts - 1) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const waitSeconds = Number.isFinite(retryAfter)
        ? retryAfter
        : 2 ** (attempt + 3);
      console.error(`429, backing off ${waitSeconds.toFixed(0)}s`);
      await sleep(waitSeconds * 1000);
      continue;
    }

    if (!response.ok)
      throw new HttpError(response.status, await response.text());
    return (await response.json()) as T;
  }

  throw new Error(`request exhausted retries: ${url}`);
}

/** Space out requests: a 429 storm on a backfill day half-captures the run. */
export const PACE_MS = Number(process.env["CALL_CAPTURE_PACE_MS"] ?? "1000");

// This file sits at scripts/<cookbook>/collect/, so the repo root is three up.
// Resolved from the file rather than from cwd: the agent may run it from
// anywhere in the working tree, and a cwd-relative path would then write the
// cadence layer into a subdirectory nobody reads.
const ROOT = resolve(import.meta.dirname, "..", "..", "..");
const LOG_DIR = join(ROOT, "cadence", "log");
const RAW_DIR = join(LOG_DIR, "raw", "calls");

// Three days, not one. A transcript is not ready when a call ends, so a
// one-day window drops every call the recorder was still processing at the
// cron minute — and because the window only ever moves forward, those calls
// are never seen again. The overlap costs nothing: ids already on disk are
// skipped before any transcript is fetched.
const LOOKBACK_DAYS = Number(process.env["CALL_CAPTURE_LOOKBACK_DAYS"] ?? "3");

// PLACEHOLDER — your own email domain, set from the agent's repository env. It
// is how internal-only calls are recognised: Avoma's `is_internal` is false on
// every meeting in some workspaces, including all-internal ones, so a vendor
// flag cannot be trusted for this.
const INTERNAL_DOMAIN =
  process.env["CALL_CAPTURE_INTERNAL_DOMAIN"] ?? "example.com";

// A personal address is not an account. Slugging by domain would file every
// unrelated gmail.com guest under one "gmail" account, and the scribe would
// then read a stranger's history as this account's.
const CONSUMER_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "proton.me",
  "protonmail.com",
]);

function isoDateOffset(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Every id already recorded anywhere under cadence/log/ — raw captures AND
 * scribed entries. Reading both is what stops a call being re-captured months
 * after it was scribed and its raw file archived away.
 */
function capturedIds(provider: string): Set<string> {
  const pattern = new RegExp(`source: ${provider} ([\\w.@|-]+)`, "g");
  const seen = new Set<string>();
  if (!existsSync(LOG_DIR)) return seen;

  for (const entry of readdirSync(LOG_DIR, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const text = readFileSync(join(entry.parentPath, entry.name), "utf8");
    for (const match of text.matchAll(pattern)) seen.add(match[1]!);
  }

  return seen;
}

function externalAttendees(call: Call): { email?: string; name?: string }[] {
  return call.attendees.filter(
    (attendee) =>
      attendee.email !== undefined && !attendee.email.endsWith(INTERNAL_DOMAIN),
  );
}

function accountSlug(call: Call): string {
  const domains = [
    ...new Set(
      externalAttendees(call)
        .map((attendee) => attendee.email!.split("@")[1]!.toLowerCase())
        .filter((domain) => !CONSUMER_DOMAINS.has(domain)),
    ),
  ].sort();

  const base = domains[0]?.split(".")[0] ?? "unknown";
  return base.replace(/[^a-z0-9-]/g, "") || "unknown";
}

/** Never overwrite: two calls with one account on one day both keep their file. */
function freePath(day: string, slug: string): string {
  let path = join(RAW_DIR, `${day}-${slug}.md`);
  for (let n = 2; existsSync(path); n++) {
    path = join(RAW_DIR, `${day}-${slug}-${n}.md`);
  }
  return path;
}

function writeRaw(provider: string, call: Call, body: string): string {
  const day = call.startAt.slice(0, 10);
  const path = freePath(day, accountSlug(call));
  const attendees = call.attendees
    .map((attendee) => attendee.name ?? attendee.email ?? "unknown")
    .join(", ");

  const frontmatter = [
    "---",
    `title: "RAW: ${call.subject.replace(/"/g, "'")}"`,
    `date: ${day}`,
    `attendees: [${attendees}]`,
    // The written half of the idempotency key. Its reader is capturedIds(),
    // and both are built from `provider` so they cannot disagree.
    `source: ${provider} ${call.id}`,
    "status: raw, awaiting scribe",
    "---",
    "",
  ].join("\n");

  writeFileSync(path, `${frontmatter}\n${body}\n`);
  return relative(ROOT, path);
}

/**
 * Run one capture pass. `--dry-run` reports what it would take and writes
 * nothing: the first thing to run against a freshly written adapter, because
 * it exercises the list call and the readiness filter without putting anything
 * in the repository you would then have to unpick.
 */
export async function capture(recorder: Recorder): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  if (!dryRun) mkdirSync(RAW_DIR, { recursive: true });

  const from = isoDateOffset(-LOOKBACK_DAYS);
  const to = isoDateOffset(0);
  const captured = capturedIds(recorder.provider);
  const ready = await recorder.listReady(from, to);

  const pending = ready.filter(
    (call) => !captured.has(call.id) && externalAttendees(call).length > 0,
  );

  console.log(
    `${recorder.provider} ${from}..${to}: ${ready.length} ready, ` +
      `${captured.size} already captured, ${pending.length} pending`,
  );

  if (dryRun) {
    for (const call of pending) {
      console.log(
        `would capture: ${call.startAt.slice(0, 10)}-${accountSlug(call)} — ${call.subject}`,
      );
    }
    console.log("dry run, nothing written");
    return;
  }

  let written = 0;
  for (const call of pending) {
    const body =
      (await recorder.transcript(call.id)) ?? (await recorder.notes(call.id));
    if (body === null) {
      console.error(
        `skip ${call.id}: no transcript or notes, next run retries`,
      );
      continue;
    }
    console.log(`raw: ${writeRaw(recorder.provider, call, body)}`);
    written++;
  }

  console.log(`captured ${written} new call(s) into cadence/log/raw/calls/`);
}
