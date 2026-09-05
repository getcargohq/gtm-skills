/**
 * The recorders this cookbook ships, and how one gets chosen.
 *
 * `CALL_RECORDER=<slug>` in the agent's repository env, or `--recorder=<slug>`
 * when you run the collector by hand. Nothing else changes when you switch:
 * the credential keeps its name, the pipeline keeps its rules, and the entry
 * below is the only place that knows the vendor exists.
 *
 * Two properties of this file are load-bearing.
 *
 * **The key IS the provider slug.** `resolve` refuses an entry whose recorder
 * disagrees with the key it is filed under, because `provider` is written into
 * every capture's `source:` line and compiled into the regex that reads those
 * lines back. A registry that let the two drift would re-capture the whole
 * window every morning, producing files and never erroring.
 *
 * **`written` is not decoration.** `live` means the adapter has been run
 * against a real workspace and its response shapes are confirmed. `docs` means
 * it was written from the vendor's own specification and compiles, and nothing
 * more. Both are honest; only one has been proven, and printing the difference
 * is what keeps a registry from turning "shipped" into an implied "tested".
 * Move an entry to `live` in the same commit that reports the `--dry-run` it
 * passed against your workspace.
 *
 * Adding a recorder that is not here: write the adapter beside the others,
 * add the entry, and the CLI, the error messages and `--list` pick it up.
 * `references/providers.md` is the procedure and `references/recorder-apis.md`
 * has the endpoints for five more, including the ones deliberately not shipped
 * and why.
 */
import { ConfigError, type Recorder } from "../recorder";
import { avoma } from "./avoma";
import { clari } from "./clari";
import { fathom } from "./fathom";
import { fireflies } from "./fireflies";
import { gong } from "./gong";
import { grain } from "./grain";
import { granola } from "./granola";
import { modjo } from "./modjo";
import { tldv } from "./tldv";

export type RecorderEntry = {
  recorder: Recorder;
  /** The vendor's own spelling of its name, for the messages a human reads. */
  label: string;
  /**
   * `live`: run against a real workspace, response shapes confirmed.
   * `docs`: written from the vendor's specification and compiles. Verify it
   * with `--dry-run` before you deploy it, and say which you did.
   */
  written: "live" | "docs";
  /** What `CALL_RECORDER_API_KEY` has to hold for this one. */
  credential: string;
  docs: string;
};

export const RECORDERS: Record<string, RecorderEntry> = {
  avoma: {
    recorder: avoma,
    label: "Avoma",
    written: "live",
    credential: "API key",
    docs: "https://api.avoma.com/docs",
  },
  clari: {
    recorder: clari,
    label: "Clari Copilot",
    written: "docs",
    credential: "<apiKey>:<apiPassword>",
    docs: "https://api-doc.copilot.clari.com/",
  },
  fathom: {
    recorder: fathom,
    label: "Fathom",
    written: "docs",
    credential: "API key",
    docs: "https://developers.fathom.ai/quickstart",
  },
  fireflies: {
    recorder: fireflies,
    label: "Fireflies.ai",
    written: "docs",
    credential: "API key",
    docs: "https://docs.fireflies.ai/",
  },
  gong: {
    recorder: gong,
    label: "Gong",
    written: "docs",
    credential: "<accessKey>:<accessKeySecret>",
    docs: "https://help.gong.io/apidocs/introduction-2",
  },
  grain: {
    recorder: grain,
    label: "Grain",
    written: "docs",
    credential: "personal or workspace access token",
    docs: "https://developers.grain.com/",
  },
  granola: {
    recorder: granola,
    label: "Granola",
    written: "docs",
    credential: "API key (Business or Enterprise plan)",
    docs: "https://docs.granola.ai/",
  },
  modjo: {
    recorder: modjo,
    label: "Modjo",
    written: "docs",
    credential: "API key",
    docs: "https://api.modjo.ai/v2/docs",
  },
  tldv: {
    recorder: tldv,
    label: "tl;dv",
    written: "docs",
    credential: "API key",
    docs: "https://doc.tldv.io/",
  },
};

export const RECORDER_SLUGS = Object.keys(RECORDERS).sort();

/** The table `--list` prints, and the tail of every selection error. */
export function recorderTable(): string {
  const headings = ["slug", "recorder", "CALL_RECORDER_API_KEY holds", "state"];
  const cells = RECORDER_SLUGS.map((slug) => {
    const entry = RECORDERS[slug]!;
    return [
      slug,
      entry.label,
      entry.credential,
      entry.written === "live"
        ? "verified against a live workspace"
        : "written from vendor docs, verify with --dry-run",
    ];
  });

  // Widths from the content: a hard-coded column is a column that stops
  // lining up the moment someone registers a tenth recorder.
  const widths = headings.map((heading, column) =>
    Math.max(heading.length, ...cells.map((row) => row[column]!.length)),
  );
  const line = (row: string[]): string =>
    `  ${row.map((cell, column) => cell.padEnd(widths[column]!)).join("  ")}`.trimEnd();

  return [
    "recorders this collector ships:",
    "",
    line(headings),
    ...cells.map(line),
    "",
    "select one with CALL_RECORDER=<slug>, or --recorder=<slug> to override it",
    "for one run. Anything else is a new adapter in scripts/call-capture/",
    "collect/recorders/ plus an entry in its index.ts — see",
    "references/providers.md.",
  ].join("\n");
}

/**
 * The selected recorder, from `--recorder=` or `CALL_RECORDER`.
 *
 * There is deliberately NO default. Falling back to whichever adapter happens
 * to be first would mean an unset variable produces a clean, empty, entirely
 * successful-looking run every morning against a recorder you do not use —
 * which is the failure this cookbook spends most of its warnings on. An
 * unreadable configuration stops the run instead.
 */
export function resolve(argv: readonly string[] = process.argv.slice(2)): {
  recorder: Recorder;
  entry: RecorderEntry;
} {
  const flag = argv
    .find((argument) => argument.startsWith("--recorder="))
    ?.slice("--recorder=".length);
  const slug = (flag ?? process.env["CALL_RECORDER"] ?? "")
    .trim()
    .toLowerCase();

  if (slug === "") {
    throw new ConfigError(
      "No recorder selected. Set CALL_RECORDER in the agent's repository env " +
        `(infra/call-capture/agents/call-scribe.ts), or pass --recorder=<slug>.\n\n${recorderTable()}`,
    );
  }

  const entry = RECORDERS[slug];
  if (entry === undefined) {
    throw new ConfigError(`Unknown recorder "${slug}".\n\n${recorderTable()}`);
  }

  // The registry key and the slug written into every capture must be the same
  // string. See the note at the top of this file: this is the one check that
  // stops the deduplication key drifting away from what is on disk.
  if (entry.recorder.provider !== slug) {
    throw new ConfigError(
      `Registry mismatch: "${slug}" is filed under a recorder whose provider is ` +
        `"${entry.recorder.provider}". One of the two is wrong, and until they ` +
        `agree the collector cannot recognise what it has already captured.`,
    );
  }

  return { recorder: entry.recorder, entry };
}
