/**
 * HubSpot, through the workspace's HubSpot connector and Cargo's
 * `hubspot.searchRecords`. The checked example: written and run against a
 * live workspace. Salesforce and Attio adapt this file (object names, the
 * won/lost flags, the association filter) and register beside it.
 *
 * Three reads, all `searchRecords`, none of them billed in credits:
 *
 *   - deals: `hs_is_closed` true and `closedate` inside the window, sorted by
 *     close date descending. HubSpot caps a page at 200, so the window is
 *     walked by moving the upper bound to the last close date seen and
 *     deduplicating on id, until a page adds nothing.
 *   - companies: `hs_object_id` in a list of ids, 100 per call.
 *   - contacts on a deal: the `associations.deal` pseudo-property HubSpot's
 *     search API accepts, so no association endpoint is needed.
 *
 * A search returns every property on the object. The ones read here are
 * standard on every portal except the lost reason, which config.ts names.
 */
import { execute, PACE_MS, sleep } from "../cli";
import { LOST_REASON_PROPERTY } from "../config";
import {
  pageGuard,
  type Company,
  type Contact,
  type Crm,
  type Deal,
} from "../audit";

const PAGE = 200;

type Record_ = {
  id: string;
  properties: Record<string, string | null>;
};

const condition = (
  propertyName: string,
  operator: string,
  value: string | string[],
) =>
  Array.isArray(value)
    ? { propertyName, operator, values: value }
    : { propertyName, operator, value };

const filter = (conditions: unknown[]) => ({
  conjonction: "and",
  groups: [{ conjonction: "and", conditions }],
});

const number = (value: string | null | undefined): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const text = (value: string | null | undefined): string | null =>
  value === undefined || value === null || value === "" ? null : value;

function normalizeDeal(record: Record_): Deal | null {
  const p = record.properties;
  const won = p["hs_is_closed_won"] === "true";
  const lost = p["hs_is_closed_lost"] === "true";
  // Closed but neither flag: a stage HubSpot counts as closed without an
  // outcome. Not a win and not a loss, so not evidence either way.
  if (!won && !lost) return null;
  const closedAt = text(p["closedate"]);
  if (closedAt === null) return null;
  return {
    id: record.id,
    name: text(p["dealname"]) ?? "",
    pipeline: text(p["pipeline"]) ?? "default",
    stage: text(p["dealstage"]) ?? "",
    outcome: won ? "won" : "lost",
    closedAt,
    amount: number(p["amount"]),
    currency: text(p["deal_currency_code"]),
    dealType: text(p["dealtype"]),
    lostReason: text(p[LOST_REASON_PROPERTY]),
    contactCount: number(p["num_associated_contacts"]),
    companyId: text(p["hs_primary_associated_company"]),
  };
}

export const hubspot: Crm = {
  integration: "hubspot",

  async closedDeals(from, to) {
    const seen = new Map<string, Deal>();
    const guard = pageGuard("hubspot deals");
    let upper = to;
    for (;;) {
      guard();
      const page = execute<Record_[]>("hubspot", "searchRecords", {
        objectType: "deals",
        limit: PAGE,
        sort: [{ propertyName: "closedate", direction: "descending" }],
        filter: filter([
          condition("hs_is_closed", "is", ["true"]),
          condition("closedate", "greaterThanOrEquals", from),
          condition("closedate", "lowerThanOrEquals", upper),
        ]),
      });
      let added = 0;
      for (const record of page) {
        if (seen.has(record.id)) continue;
        const deal = normalizeDeal(record);
        if (deal !== null) seen.set(record.id, deal);
        added++;
      }
      const last = page[page.length - 1];
      if (page.length < PAGE || added === 0 || last === undefined) break;
      // Inclusive bound plus the dedup above: a deal sharing the boundary
      // timestamp is fetched twice and kept once, never skipped.
      upper = last.properties["closedate"] ?? upper;
      await sleep(PACE_MS);
    }
    return [...seen.values()].sort((a, b) =>
      a.closedAt < b.closedAt ? 1 : -1,
    );
  },

  async companies(ids) {
    const out: Company[] = [];
    for (let start = 0; start < ids.length; start += 100) {
      const chunk = ids.slice(start, start + 100);
      const page = execute<Record_[]>("hubspot", "searchRecords", {
        objectType: "companies",
        limit: 100,
        filter: filter([condition("hs_object_id", "is", chunk)]),
      });
      for (const record of page) {
        const p = record.properties;
        out.push({
          id: record.id,
          name: text(p["name"]),
          domain: text(p["domain"]),
          industry: text(p["industry"]),
          employees: number(p["numberofemployees"]),
          country: text(p["country"]),
          revenue: number(p["annualrevenue"]),
        });
      }
      if (start + 100 < ids.length) await sleep(PACE_MS);
    }
    return out;
  },

  async contactsOnDeal(dealId) {
    const page = execute<Record_[]>("hubspot", "searchRecords", {
      objectType: "contacts",
      limit: 100,
      filter: filter([condition("associations.deal", "is", [dealId])]),
    });
    return page.map((record): Contact => ({
      id: record.id,
      title: text(record.properties["jobtitle"]),
    }));
  },
};
