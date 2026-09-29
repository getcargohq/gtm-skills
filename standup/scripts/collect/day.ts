/**
 * Collect the day's evidence into the cadence layer.
 *
 * The deterministic half of standup: it dumps git commits, pull requests, and
 * an inventory of cadence/log files whose names carry today's date into
 * cadence/log/raw/standup/<YYYY-MM-DD>.md. It makes no judgements — no recap,
 * no Slack copy, no carryover. That is the standup agent's job, and keeping
 * the two apart is the point: a fetch loop an LLM re-derives every evening
 * is a fetch loop that silently changes shape.
 *
 * Run from the repo root:
 *
 *   npx tsx scripts/standup/collect/day.ts
 *   npx tsx scripts/standup/collect/day.ts --dry-run
 *
 * The calendar day is STANDUP_TIMEZONE (default America/Los_Angeles). The
 * cron fires at the end of that evening, so "today" is the day just ending.
 *
 * This file sits at scripts/<cookbook>/collect/, so the repo root is three
 * up. Resolved from the file rather than from cwd: the agent may run it from
 * anywhere in the working tree.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..", "..", "..");
const RAW_DIR = join(ROOT, "cadence", "log", "raw", "standup");
const LOG_DIR = join(ROOT, "cadence", "log");

const TIMEZONE =
  process.env["STANDUP_TIMEZONE"] === undefined ||
  process.env["STANDUP_TIMEZONE"] === ""
    ? "America/Los_Angeles"
    : process.env["STANDUP_TIMEZONE"];

const dryRun = process.argv.includes("--dry-run");

const dateInZone = (value: Date, timeZone: string): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);

const day = dateInZone(new Date(), TIMEZONE);

// GitHub search dates are UTC, and a Pacific evening is already tomorrow in
// UTC. Search a day either side, then keep only what falls on `day` in
// TIMEZONE — the same rule the commits are filtered by.
const shiftDay = (ymd: string, days: number): string => {
  const next = new Date(`${ymd}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
};
const searchWindow = `${shiftDay(day, -1)}..${shiftDay(day, 1)}`;

type Result = { ok: true; stdout: string } | { ok: false; error: string };

const run = (command: string, args: string[]): Result => {
  try {
    const stdout = execFileSync(command, args, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, stdout: stdout.trimEnd() };
  } catch (error) {
    const err = error as { stderr?: string; message?: string };
    const detail =
      typeof err.stderr === "string" && err.stderr.trim() !== ""
        ? err.stderr.trim()
        : (err.message ?? String(error));
    return { ok: false, error: detail };
  }
};

const walk = (dir: string): string[] => {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
};

const commits = run("git", ["log", "--format=%cI %h %s", "--since=3 days ago"]);

const commitLines =
  commits.ok === false
    ? [`_git log failed: ${commits.error}_`]
    : commits.stdout
        .split("\n")
        .filter((line) => line !== "")
        .flatMap((line) => {
          const space = line.indexOf(" ");
          if (space === -1) return [];
          const iso = line.slice(0, space);
          const rest = line.slice(space + 1);
          if (!/^\d{4}-\d{2}-\d{2}T/.test(iso)) return [];
          if (dateInZone(new Date(iso), TIMEZONE) !== day) return [];
          return [`- ${rest} (${iso})`];
        });

const merged = run("gh", [
  "pr",
  "list",
  "--state",
  "merged",
  "--search",
  `merged:${searchWindow}`,
  "--limit",
  "50",
  "--json",
  "number,title,url,author,mergedAt",
]);

const opened = run("gh", [
  "pr",
  "list",
  "--state",
  "all",
  "--search",
  `created:${searchWindow}`,
  "--limit",
  "50",
  "--json",
  "number,title,url,author,createdAt,state",
]);

type Pull = {
  number: number;
  title: string;
  url: string;
  author?: { login?: string };
  mergedAt?: string;
  createdAt?: string;
  state?: string;
};

const formatPulls = (
  result: Result,
  stamp: "mergedAt" | "createdAt",
): string[] => {
  if (result.ok === false) {
    return [`_gh unavailable: ${result.error}_`];
  }
  let rows: Pull[] = [];
  try {
    rows = JSON.parse(result.stdout === "" ? "[]" : result.stdout) as Pull[];
  } catch {
    return [`_gh returned unreadable JSON_`];
  }
  const today = rows.filter((row) => {
    const when = row[stamp];
    return when !== undefined && dateInZone(new Date(when), TIMEZONE) === day;
  });
  if (today.length === 0) return ["_none_"];
  return today.map((row) => {
    const who = row.author?.login ?? "unknown";
    const state = row.state === undefined ? "" : `, ${row.state}`;
    return `- #${row.number} ${row.title} (${who}${state}, ${row[stamp]}) — ${row.url}`;
  });
};

const cadenceFiles = walk(LOG_DIR)
  .filter(
    (path) => path.includes(day) && !path.includes(`${join("raw", "standup")}`),
  )
  .map((path) => `- \`${relative(ROOT, path)}\``);

const lines = [
  `---`,
  `title: Standup capture ${day}`,
  `description: Deterministic evidence dump for the ${TIMEZONE} calendar day ${day}.`,
  `date: ${day}`,
  `timezone: ${TIMEZONE}`,
  `---`,
  ``,
  `## Commits`,
  ``,
  ...(commitLines.length === 0 ? ["_none_"] : commitLines),
  ``,
  `## Pull requests merged`,
  ``,
  ...formatPulls(merged, "mergedAt"),
  ``,
  `## Pull requests opened`,
  ``,
  ...formatPulls(opened, "createdAt"),
  ``,
  `## Cadence files named for this day`,
  ``,
  ...(cadenceFiles.length === 0 ? ["_none_"] : cadenceFiles),
  ``,
];

const markdown = lines.join("\n");

if (dryRun) {
  console.log(markdown);
  process.exit(0);
}

mkdirSync(RAW_DIR, { recursive: true });
const out = join(RAW_DIR, `${day}.md`);
writeFileSync(out, markdown);
console.log(`wrote ${relative(ROOT, out)}`);
