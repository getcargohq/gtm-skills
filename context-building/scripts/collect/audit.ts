/**
 * The CRM contract, and the CRM-agnostic half of the audit.
 *
 * Nothing in this file knows which CRM holds the deals. It defines what an
 * adapter must be able to do, and it holds everything that is the same
 * whoever answers: the window, the aggregation, the mode line, the file layout
 * and the diff against the previous snapshot.
 *
 * To support a CRM that is not in `crms/`, write one object satisfying `Crm`
 * beside the HubSpot one and register it. No adapter can reach into the
 * pipeline below because none of them import it.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";

import { LOST_REASON_PROPERTY, VERIFY_MIN_WON, WINDOW_DAYS } from "./config";

/** One closed deal, normalized. Producing these is the adapter's job. */
export type Deal = {
  id: string;
  name: string;
  pipeline: string;
  stage: string;
  outcome: "won" | "lost";
  /** ISO timestamp. */
  closedAt: string;
  amount: number | null;
  currency: string | null;
  dealType: string | null;
  lostReason: string | null;
  /** Contacts associated to the deal, as the CRM counts them. */
  contactCount: number | null;
  /** The primary account on the deal, or null. */
  companyId: string | null;
};

export type Company = {
  id: string;
  name: string | null;
  domain: string | null;
  industry: string | null;
  employees: number | null;
  country: string | null;
  revenue: number | null;
};

export type Contact = {
  id: string;
  title: string | null;
};

export type Crm = {
  /** The integration slug on the Cargo connector. */
  integration: string;

  /**
   * Every deal closed (won or lost) with a close date inside the window,
   * normalized, newest first. Both dates are ISO timestamps. Paginate to the
   * end before returning: a truncated window that looks complete is the
   * failure this whole audit is arranged to avoid.
   */
  closedDeals(from: string, to: string): Promise<Deal[]>;

  /** The accounts behind those deals, by id. Missing ids are simply absent. */
  companies(ids: string[]): Promise<Company[]>;

  /** The contacts associated to one deal, with their titles. */
  contactsOnDeal(dealId: string): Promise<Contact[]>;
};

// This file sits at scripts/<cookbook>/collect/, so the repo root is three up.
// Resolved from the file rather than from cwd: the agent may run it from
// anywhere in the working tree.
export const ROOT = resolve(import.meta.dirname, "..", "..", "..");
export const RAW_DIR = join(ROOT, "cadence", "log", "raw", "crm");

export type Snapshot = {
  collectedAt: string;
  crm: { integration: string; connectorSlug: string; connectorUuid: string };
  window: { from: string; to: string; days: number };
  /** verify when won deals reach the line in config.ts, else hypothesis. */
  mode: "verify" | "hypothesis";
  pipelines: { id: string; closed: number; won: number; lost: number }[];
  counts: { closed: number; won: number; lost: number };
  lostReason: {
    property: string;
    lost: number;
    filled: number;
    values: { value: string; deals: number }[];
  };
  association: { closed: number; dealsWithContacts: number };
  stakeholdersPerDeal: {
    won: StakeholderStats;
    lost: StakeholderStats;
  };
  deals: Deal[];
  companies: (Company & { won: number; lost: number })[];
  wonDealContacts: { dealId: string; contacts: Contact[] }[];
  titlesOnWonDeals: { title: string; deals: number }[];
  newSincePrevious: { previous: string | null; dealIds: string[] };
};

export type StakeholderStats = {
  deals: number;
  mean: number | null;
  median: number | null;
  histogram: { "0": number; "1": number; "2": number; "3+": number };
};

export function isoDateOffset(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function stats(counts: (number | null)[]): StakeholderStats {
  const known = counts.filter((n): n is number => n !== null);
  const histogram = { "0": 0, "1": 0, "2": 0, "3+": 0 };
  for (const n of known) {
    if (n >= 3) histogram["3+"]++;
    else histogram[String(n) as "0" | "1" | "2"]++;
  }
  if (known.length === 0) {
    return { deals: counts.length, mean: null, median: null, histogram };
  }
  const sorted = [...known].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1
      ? sorted[middle]!
      : (sorted[middle - 1]! + sorted[middle]!) / 2;
  const mean = known.reduce((sum, n) => sum + n, 0) / known.length;
  return {
    deals: counts.length,
    mean: Math.round(mean * 100) / 100,
    median,
    histogram,
  };
}

function tally<T>(
  items: T[],
  key: (item: T) => string | null,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (k === null || k === "") continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

/**
 * The most recent earlier snapshot in the raw folder, so a run can say which
 * deals are new since the last one. Today's own file is excluded: re-running
 * the audit on one day must not make yesterday's deals disappear from "new".
 */
export function previousSnapshot(
  today: string,
): { path: string; deals: Deal[] } | null {
  if (!existsSync(RAW_DIR)) return null;
  const files = readdirSync(RAW_DIR)
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .filter((name) => name.slice(0, 10) < today)
    .sort();
  const latest = files[files.length - 1];
  if (latest === undefined) return null;
  const path = join(RAW_DIR, latest);
  const parsed = JSON.parse(readFileSync(path, "utf8")) as { deals?: Deal[] };
  return { path: relative(ROOT, path), deals: parsed.deals ?? [] };
}

/**
 * Turn what the adapter returned into the snapshot. Pure apart from reading
 * the previous file, so the contract eval can run it on canned deals.
 */
export function buildSnapshot(input: {
  crm: Snapshot["crm"];
  window: Snapshot["window"];
  deals: Deal[];
  companies: Company[];
  wonDealContacts: Snapshot["wonDealContacts"];
  previous: { path: string; deals: Deal[] } | null;
  now?: string;
}): Snapshot {
  const { deals } = input;
  const won = deals.filter((deal) => deal.outcome === "won");
  const lost = deals.filter((deal) => deal.outcome === "lost");

  const pipelines = [...tally(deals, (deal) => deal.pipeline).keys()]
    .sort()
    .map((id) => ({
      id,
      closed: deals.filter((deal) => deal.pipeline === id).length,
      won: won.filter((deal) => deal.pipeline === id).length,
      lost: lost.filter((deal) => deal.pipeline === id).length,
    }));

  const lostReasons = tally(lost, (deal) => deal.lostReason);
  const outcomesByCompany = new Map<string, { won: number; lost: number }>();
  for (const deal of deals) {
    if (deal.companyId === null) continue;
    const entry = outcomesByCompany.get(deal.companyId) ?? { won: 0, lost: 0 };
    entry[deal.outcome]++;
    outcomesByCompany.set(deal.companyId, entry);
  }
  const titles = tally(
    input.wonDealContacts.flatMap((entry) =>
      // One deal counts a title once, however many people on it share it.
      [
        ...new Set(
          entry.contacts.map((contact) => contact.title?.trim() ?? ""),
        ),
      ].map((title) => ({ title })),
    ),
    (item) => item.title,
  );
  const previousIds = new Set(
    (input.previous?.deals ?? []).map((deal) => deal.id),
  );

  return {
    collectedAt: input.now ?? new Date().toISOString(),
    crm: input.crm,
    window: input.window,
    mode: won.length >= VERIFY_MIN_WON ? "verify" : "hypothesis",
    pipelines,
    counts: { closed: deals.length, won: won.length, lost: lost.length },
    lostReason: {
      property: LOST_REASON_PROPERTY,
      lost: lost.length,
      filled: lost.filter((deal) => (deal.lostReason ?? "") !== "").length,
      values: [...lostReasons.entries()]
        .map(([value, count]) => ({ value, deals: count }))
        .sort((a, b) => b.deals - a.deals),
    },
    association: {
      closed: deals.length,
      dealsWithContacts: deals.filter((deal) => (deal.contactCount ?? 0) > 0)
        .length,
    },
    stakeholdersPerDeal: {
      won: stats(won.map((deal) => deal.contactCount)),
      lost: stats(lost.map((deal) => deal.contactCount)),
    },
    deals,
    companies: input.companies.map((company) => ({
      ...company,
      ...(outcomesByCompany.get(company.id) ?? { won: 0, lost: 0 }),
    })),
    wonDealContacts: input.wonDealContacts,
    titlesOnWonDeals: [...titles.entries()]
      .map(([title, count]) => ({ title, deals: count }))
      .sort((a, b) => b.deals - a.deals || a.title.localeCompare(b.title)),
    newSincePrevious: {
      previous: input.previous?.path ?? null,
      dealIds: deals
        .filter((deal) => !previousIds.has(deal.id))
        .map((deal) => deal.id),
    },
  };
}

/** Write the snapshot as cadence/log/raw/crm/<today>.json and return the path. */
export function writeSnapshot(snapshot: Snapshot, today: string): string {
  mkdirSync(RAW_DIR, { recursive: true });
  const path = join(RAW_DIR, `${today}.json`);
  writeFileSync(path, `${JSON.stringify(snapshot, null, 2)}\n`);
  return relative(ROOT, path);
}

export const windowFor = (days = WINDOW_DAYS) => ({
  from: isoDateOffset(-days),
  to: isoDateOffset(0),
  days,
});

/** A page counter that stops a paginated read that never terminates. */
export function pageGuard(label: string, limit = 100): () => void {
  let pages = 0;
  return () => {
    pages++;
    if (pages > limit) {
      throw new Error(
        `${label}: pagination did not terminate after ${limit} pages; ` +
          `this run wrote nothing rather than part of the window.`,
      );
    }
  };
}
