/**
 * The choices the collectors need. None of them is a credential: the CRM and
 * TheirStack are Cargo connectors the workspace already holds, and the
 * collectors reach them through `cargo-ai`, which the harness sandbox is
 * already signed in to.
 */
import type { CrmSlug } from "./crms";

/**
 * Which CRM holds the deals, or `"auto"` to take the workspace's default CRM
 * connection (`cargo-ai connection connector list`, first authorized one of
 * the registry's slugs). Typed against the registry, so an unknown slug fails
 * `npm run typecheck`. Pin it when the workspace holds two.
 */
export const CRM: CrmSlug | "auto" = "auto";

/**
 * How far back the audit looks, in days. Twelve months by default, and the
 * agents never ask: a shorter window under-counts won deals and flips the mode
 * to hypothesis on a workspace that has the evidence.
 */
export const WINDOW_DAYS = 365;

/**
 * PLACEHOLDER: the deal property that carries the lost reason. HubSpot's
 * standard one is `closed_lost_reason`; many workspaces record it on a custom
 * property instead, and the audit's fill rate then reads 0 of N. A fill rate
 * of zero with lost deals in the window is the cue to look for the real
 * property, not a fact about the team.
 */
export const LOST_REASON_PROPERTY = "closed_lost_reason";

/**
 * The verify/hypothesis line. At or above this many closed-won deals in the
 * window, won versus lost is an analysis; below it, the ICP is a hypothesis
 * from the website and the CRM only corroborates.
 */
export const VERIFY_MIN_WON = 20;

/**
 * How many won deals get their contacts fetched, newest first. Each is one
 * CRM read; the titles on those deals are what the personas are reconciled
 * against. Raise it on a workspace with hundreds of wins a year.
 */
export const MAX_WON_DEALS_FOR_CONTACTS = 150;
