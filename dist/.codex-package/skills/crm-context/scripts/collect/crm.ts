/**
 * Audit the CRM into the cadence layer.
 *
 * The deterministic half of CRM context, and the step that decides the
 * mode. It reads every deal closed in the window, the accounts behind them
 * and the contacts on the won ones, and writes one JSON snapshot under
 * `cadence/log/raw/crm/`: pipelines, won and lost counts, the lost-reason
 * fill rate, the deal-to-contact association rate, stakeholders per deal,
 * the titles on won deals, and which deals are new since the previous
 * snapshot. It makes no judgements: no ICP, no persona, no insight. That is
 * the agent's job, and keeping the two apart is the point: a fetch loop an
 * LLM re-derives each run is a fetch loop that silently changes shape.
 *
 * Run from the repo root:
 *
 *   npx tsx scripts/crm-context/collect/crm.ts --dry-run
 *   npx tsx scripts/crm-context/collect/crm.ts
 *   npx tsx scripts/crm-context/collect/crm.ts --crm=hubspot
 *
 * `--dry-run` reads the deals and prints the counts and the mode without
 * fetching companies or contacts and without writing. `--crm=<slug>`
 * overrides `config.ts` for one run. `PIPELINES` in `config.ts` narrows the
 * audit to the sales pipeline(s) once you know their ids; "all" reads every
 * pipeline and the snapshot lists each with its counts.
 *
 * No CRM connection is not an error: the snapshot is not written, the exit
 * code is 0, and the output says `crm: null` so the agent opens no pull
 * request and says why. A CRM connection that fails to answer IS an error.
 *
 * One file per day, overwritten on a re-run: the snapshot is a function of
 * the CRM at that moment, not an archive to append to. The previous day's
 * file is what "new since last run" is computed against.
 */
import {
  checkFlags,
  ConfigError,
  connectors,
  PACE_MS,
  sleep,
  whoami,
} from "./cli";
import {
  buildSnapshot,
  isoDateOffset,
  previousSnapshot,
  windowFor,
  writeSnapshot,
} from "./audit";
import { CRM, MAX_WON_DEALS_FOR_CONTACTS, PIPELINES } from "./config";
import { CRM_SLUGS, CRMS, type CrmSlug } from "./crms";

try {
  const argv = process.argv.slice(2);
  checkFlags(argv, ["--dry-run", "--crm="]);
  const dryRun = argv.includes("--dry-run");
  const override = argv
    .find((a) => a.startsWith("--crm="))
    ?.slice("--crm=".length);

  const workspace = whoami();
  console.error(`workspace: ${workspace.name}`);

  const wanted = (override ?? CRM).toLowerCase();
  const held = connectors().filter((c) =>
    (CRM_SLUGS as string[]).includes(c.integrationSlug),
  );
  const connector =
    wanted === "auto"
      ? (held.find((c) => c.isDefault) ?? held[0])
      : (held.find((c) => c.integrationSlug === wanted && c.isDefault) ??
        held.find((c) => c.integrationSlug === wanted));

  if (wanted !== "auto" && !(wanted in CRMS)) {
    throw new ConfigError(
      `--crm=${wanted} is not a CRM this collector knows; it ships ${CRM_SLUGS.join(", ")}.`,
    );
  }
  if (connector === undefined) {
    console.log(
      JSON.stringify({
        mode: "hypothesis",
        crm: null,
        reason:
          wanted === "auto"
            ? `no ${CRM_SLUGS.join("/")} connection in this workspace`
            : `no ${wanted} connection in this workspace`,
        remedy:
          "cargo-ai cdk add connector/<integration>, or proceed without a CRM",
      }),
    );
    process.exit(0);
  }
  if (wanted === "auto" && held.length > 1) {
    console.error(
      `note: ${held.length} CRM connections held (${held.map((c) => c.integrationSlug).join(", ")}); ` +
        `using ${connector.integrationSlug}. Pin CRM in config.ts if that is wrong.`,
    );
  }

  const entry = CRMS[connector.integrationSlug as CrmSlug];
  if (entry.written === "docs") {
    console.error(
      `note: the ${entry.label} adapter was written from API docs and not yet run ` +
        `against a live workspace. Check --dry-run reports real counts before trusting a run.`,
    );
  }

  const window = windowFor();
  const today = isoDateOffset(0);
  const every = await entry.crm.closedDeals(
    `${window.from}T00:00:00Z`,
    `${window.to}T23:59:59Z`,
  );
  const deals =
    PIPELINES === "all"
      ? every
      : every.filter((d) => PIPELINES.includes(d.pipeline));
  if (PIPELINES !== "all") {
    console.error(
      `pipelines pinned to ${PIPELINES.join(", ")}: ${every.length - deals.length} closed deal(s) in other pipelines left out`,
    );
  }
  const won = deals.filter((d) => d.outcome === "won");
  const lost = deals.filter((d) => d.outcome === "lost");
  const pipelines = new Set(deals.map((d) => d.pipeline));
  console.error(
    `${entry.crm.integration} ${window.from}..${window.to}: ${deals.length} closed, ` +
      `${won.length} won, ${lost.length} lost, ${pipelines.size} pipeline(s)`,
  );

  if (dryRun) {
    console.log(
      JSON.stringify({
        mode: won.length >= 20 ? "verify" : "hypothesis",
        crm: entry.crm.integration,
        counts: { closed: deals.length, won: won.length, lost: lost.length },
        pipelines: [...pipelines],
        dryRun: true,
      }),
    );
    process.exit(0);
  }

  const companyIds = [
    ...new Set(
      deals.map((d) => d.companyId).filter((id): id is string => id !== null),
    ),
  ];
  const companies = await entry.crm.companies(companyIds);
  console.error(`${companies.length} of ${companyIds.length} accounts read`);

  const wonDealContacts: {
    dealId: string;
    contacts: { id: string; title: string | null }[];
  }[] = [];
  for (const deal of won.slice(0, MAX_WON_DEALS_FOR_CONTACTS)) {
    wonDealContacts.push({
      dealId: deal.id,
      contacts: await entry.crm.contactsOnDeal(deal.id),
    });
    await sleep(PACE_MS);
  }
  console.error(`contacts read on ${wonDealContacts.length} won deal(s)`);

  const snapshot = buildSnapshot({
    crm: {
      integration: entry.crm.integration,
      connectorSlug: connector.slug,
      connectorUuid: connector.uuid,
    },
    window,
    deals,
    companies,
    wonDealContacts,
    previous: previousSnapshot(today),
  });
  const path = writeSnapshot(snapshot, today);
  console.log(
    JSON.stringify({
      mode: snapshot.mode,
      crm: snapshot.crm.integration,
      counts: snapshot.counts,
      pipelines: snapshot.pipelines.map((p) => p.id),
      lostReasonFillRate: `${snapshot.lostReason.filled} of ${snapshot.lostReason.lost}`,
      associationRate: `${snapshot.association.dealsWithContacts} of ${snapshot.association.closed}`,
      newSincePrevious: snapshot.newSincePrevious.dealIds.length,
      path,
    }),
  );
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
