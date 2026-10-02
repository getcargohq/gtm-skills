/**
 * The credit rule for persona pulls, as code, so the same arithmetic runs
 * whether an operator sizes a pull by hand or the collector sizes it before
 * spending. Pure: every input is read by the caller
 * (`cargo-ai billing subscription get`, `cargo-ai connection integration get
 * theirStack`, the confirmed persona list) and passed in.
 *
 * Billing is per returned posting, so `limit` is the whole cost of a pull.
 * The rule:
 *
 *   - A connection that carries its own TheirStack key (`useCredits: false`)
 *     bills no Cargo credits. The pull runs at `target` per persona and the
 *     cap is TheirStack's own plan, which this cannot read.
 *   - Otherwise at most `reserveShare` of the balance is never spent on
 *     postings, so the rest of the seeding run and the month after it stay
 *     funded. What is left is divided across the personas. Each gets `target`
 *     rows, or its equal share when the share is smaller.
 *   - Below `floor` rows a pull cannot reach saturation and buys nothing a
 *     careers page did not already say: the pull is skipped and the personas
 *     stay inferred, tagged as such.
 *   - `extendTo` is the second batch for a persona that has not saturated
 *     after `target`, allowed only when the share could fund it for every
 *     persona: headroom is a property of the workspace, not of one persona.
 */
export type BudgetInput = {
  /** Credits the workspace can still spend: subscription plus purchased. */
  balance: number;
  /** Credits per returned posting, from the integration's published price. */
  unitPrice: number;
  /** `useCredits` on the bound TheirStack connector. */
  billsCredits: boolean;
  /** Confirmed personas the pull will run for. */
  personas: number;
  /** Rows per persona a normal pull asks for. */
  target?: number;
  /** Rows per persona when saturation is not reached at `target`. */
  extendTo?: number;
  /** Below this many rows, do not pull. */
  floor?: number;
  /** Share of the balance kept back from postings. */
  reserveShare?: number;
};

export type Budget = {
  /** Rows per persona for the first batch; 0 means skip the pull. */
  limit: number;
  /** Rows per persona a second batch may extend to; equals `limit` when none. */
  extendTo: number;
  /** Credits the first batch will spend across all personas. */
  spend: number;
  reason: string;
};

export function personaPullBudget(input: BudgetInput): Budget {
  const target = input.target ?? 40;
  const extendTo = input.extendTo ?? 80;
  const floor = input.floor ?? 15;
  const reserveShare = input.reserveShare ?? 0.5;
  const personas = Math.max(1, Math.floor(input.personas));

  if (!input.billsCredits) {
    return {
      limit: target,
      extendTo,
      spend: 0,
      reason:
        "the bound TheirStack connector carries its own key, so postings bill no Cargo credits; the cap is TheirStack's plan",
    };
  }
  if (!(input.unitPrice > 0)) {
    return {
      limit: 0,
      extendTo: 0,
      spend: 0,
      reason:
        "no published per-posting price could be read, so the pull cannot be sized; read it with `cargo-ai connection integration get theirStack` and pass --limit by hand",
    };
  }

  const spendable = Math.max(0, input.balance) * (1 - reserveShare);
  const share = Math.floor(spendable / input.unitPrice / personas);
  if (share < floor) {
    return {
      limit: 0,
      extendTo: 0,
      spend: 0,
      reason: `${share} postings per persona fit inside ${Math.round(100 * (1 - reserveShare))}% of the balance, under the ${floor} a pull needs to reach saturation; skipping the pull, personas stay inferred`,
    };
  }
  const limit = Math.min(target, share);
  const canExtend = share >= extendTo;
  return {
    limit,
    extendTo: canExtend ? extendTo : limit,
    spend: limit * personas * input.unitPrice,
    reason:
      limit < target
        ? `${limit} postings per persona is the equal share of ${Math.round(100 * (1 - reserveShare))}% of the balance across ${personas} personas`
        : canExtend
          ? `${limit} postings per persona, and a second batch to ${extendTo} fits for every persona`
          : `${limit} postings per persona; a second batch does not fit for every persona, so none is offered`,
  };
}
