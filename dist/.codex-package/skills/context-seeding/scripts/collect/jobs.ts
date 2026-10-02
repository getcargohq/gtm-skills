/**
 * Pull job postings per persona into the cadence layer.
 *
 * The deterministic half of the persona work: for each pull in
 * `personas.ts`, it asks TheirStack for postings matching the persona's
 * titles inside the ICP size band and writes them, description included, to
 * `cadence/log/raw/jobs/<slug>.json`. The agent reads them in batches; it
 * never fetches. Size is filtered AT PULL TIME through `companyFields`, so no
 * row outside the band is ever billed.
 *
 * Run from the repo root:
 *
 *   npx tsx scripts/context-seeding/collect/jobs.ts --dry-run
 *   npx tsx scripts/context-seeding/collect/jobs.ts
 *   npx tsx scripts/context-seeding/collect/jobs.ts --persona=revenue_operations
 *   npx tsx scripts/context-seeding/collect/jobs.ts --persona=revenue_operations --limit=80
 *
 * `--dry-run` prints the budget and what each pull would ask for, spending
 * nothing. `--persona=<slug>` runs one pull. `--limit=<n>` overrides the
 * budgeted limit for that run, and refuses to exceed what the budget rule
 * allows unless `--over-budget` is also passed: the guard is the rule, the
 * flag is the operator saying so out loud.
 *
 * The budget is read, not configured: the balance from
 * `cargo-ai billing subscription get`, the per-posting price from
 * `cargo-ai connection integration get theirStack`, and whether the bound
 * connector bills credits at all from `cargo-ai connection connector list`.
 * The arithmetic is `budget.ts`.
 *
 * A pull that already has a file is skipped unless `--refresh` is passed:
 * postings are billed per row and reading the same rows twice buys nothing.
 * The action is `searchJobs`, so nothing is deployed and no model exists
 * afterwards; see infra/context-seeding/models/persona-jobs.ts for the
 * standing version.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import {
  cargo,
  checkFlags,
  ConfigError,
  connectors,
  execute,
  whoami,
} from "./cli";
import { personaPullBudget } from "./budget";
import { PERSONA_PULLS, pullConfig } from "./personas";

const ROOT = resolve(import.meta.dirname, "..", "..", "..");
const RAW_DIR = join(ROOT, "cadence", "log", "raw", "jobs");

type Posting = {
  id: number | string;
  job_title: string;
  company: string | null;
  company_domain: string | null;
  date_posted: string | null;
  seniority: string | null;
  url: string | null;
  description: string | null;
  company_object: Record<string, unknown> | string | null;
  [key: string]: unknown;
};

try {
  const argv = process.argv.slice(2);
  checkFlags(argv, [
    "--dry-run",
    "--refresh",
    "--over-budget",
    "--persona=",
    "--limit=",
  ]);
  const dryRun = argv.includes("--dry-run");
  const refresh = argv.includes("--refresh");
  const overBudget = argv.includes("--over-budget");
  const only = argv
    .find((a) => a.startsWith("--persona="))
    ?.slice("--persona=".length);
  const limitFlag = argv
    .find((a) => a.startsWith("--limit="))
    ?.slice("--limit=".length);

  const workspace = whoami();
  console.error(`workspace: ${workspace.name}`);

  const pulls = PERSONA_PULLS.filter(
    (pull) => only === undefined || pull.slug === only,
  );
  if (pulls.length === 0) {
    throw new ConfigError(
      only === undefined
        ? "personas.ts lists no pulls"
        : `no pull named ${only} in personas.ts; it lists ${PERSONA_PULLS.map((p) => p.slug).join(", ")}`,
    );
  }

  const connector =
    connectors().find(
      (c) => c.integrationSlug === "theirStack" && c.isDefault,
    ) ?? connectors().find((c) => c.integrationSlug === "theirStack");
  if (connector === undefined) {
    throw new ConfigError(
      "no TheirStack connection in this workspace: cargo-ai cdk add connector/theirStack, " +
        "or skip the pull and leave the personas inferred.",
    );
  }

  // The budget's three inputs, read live.
  const subscription = cargo<{
    subscription?: {
      subscriptionAvailableCreditsCount?: number;
      additionalAvailableCreditsCount?: number;
    };
  }>(["billing", "subscription", "get"]).subscription;
  const balance =
    (subscription?.subscriptionAvailableCreditsCount ?? 0) +
    (subscription?.additionalAvailableCreditsCount ?? 0);
  const integration = cargo<{
    integration?: {
      extractors?: Record<
        string,
        { price?: { costs?: { type?: string; cost?: number }[] } }
      >;
      actions?: Record<
        string,
        { price?: { costs?: { type?: string; cost?: number }[] } }
      >;
    };
  }>(["connection", "integration", "get", "theirStack"]).integration;
  const unitCost = (costs?: { type?: string; cost?: number }[]) =>
    costs?.find((c) => c.type === "unit")?.cost ?? 0;
  const unitPrice =
    unitCost(integration?.actions?.["searchJobs"]?.price?.costs) ||
    unitCost(integration?.extractors?.["fetchJobs"]?.price?.costs);

  const budget = personaPullBudget({
    balance,
    unitPrice,
    billsCredits: connector.useCredits,
    personas: PERSONA_PULLS.length,
  });
  console.error(`budget: ${budget.limit} per persona (${budget.reason})`);

  const requested = limitFlag === undefined ? undefined : Number(limitFlag);
  if (
    requested !== undefined &&
    !(Number.isInteger(requested) && requested > 0)
  ) {
    throw new ConfigError(`--limit=${limitFlag} is not a positive integer`);
  }
  if (requested !== undefined && requested > budget.extendTo && !overBudget) {
    throw new ConfigError(
      `--limit=${requested} exceeds the ${budget.extendTo} the budget rule allows per persona; ` +
        `pass --over-budget to say so out loud.`,
    );
  }
  const limit = requested ?? budget.limit;
  if (limit === 0) {
    console.log(
      JSON.stringify({
        pulled: 0,
        skipped: pulls.map((p) => p.slug),
        reason: budget.reason,
      }),
    );
    process.exit(0);
  }

  if (!dryRun) mkdirSync(RAW_DIR, { recursive: true });
  const results: {
    slug: string;
    rows: number;
    path?: string;
    skipped?: string;
  }[] = [];

  for (const pull of pulls) {
    const config = pullConfig({ ...pull, limit });
    const path = join(RAW_DIR, `${pull.slug}.json`);
    if (existsSync(path) && !refresh) {
      results.push({
        slug: pull.slug,
        rows: 0,
        skipped: `${relative(ROOT, path)} exists; pass --refresh to re-pull`,
      });
      continue;
    }
    if (dryRun) {
      console.log(`would pull ${pull.slug}: ${JSON.stringify(config)}`);
      continue;
    }
    const rows = execute<Posting[]>("theirStack", "searchJobs", config);
    const inBand = rows.filter((row) => {
      const company =
        typeof row.company_object === "string"
          ? (JSON.parse(row.company_object) as Record<string, unknown>)
          : row.company_object;
      const count = company?.["employee_count"];
      return (
        typeof count !== "number" ||
        (count >= pull.band.min && count <= pull.band.max)
      );
    });
    writeFileSync(
      path,
      `${JSON.stringify(
        {
          pulledAt: new Date().toISOString(),
          persona: pull.slug,
          connector: {
            slug: connector.slug,
            uuid: connector.uuid,
            billsCredits: connector.useCredits,
          },
          config,
          unitPrice: connector.useCredits ? unitPrice : 0,
          rows: rows.length,
          rowsInBand: inBand.length,
          postings: rows,
        },
        null,
        2,
      )}\n`,
    );
    results.push({
      slug: pull.slug,
      rows: rows.length,
      path: relative(ROOT, path),
    });
    console.error(
      `${pull.slug}: ${rows.length} postings, ${inBand.length} inside the band`,
    );
  }

  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, limit, budget }));
  } else {
    console.log(
      JSON.stringify({ limit, budget: budget.reason, pulls: results }),
    );
  }
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
