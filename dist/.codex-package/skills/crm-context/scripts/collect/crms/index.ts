/**
 * The CRMs that ship, keyed by the integration slug on the Cargo connector.
 *
 * The key must equal the adapter's `integration`: it is what the collector
 * matches against `cargo-ai connection connector list` to find the connection,
 * and what is written into the snapshot. `evals/contract.mjs` checks the two
 * agree.
 */
import type { Crm } from "../audit";
import { hubspot } from "./hubspot";

export type CrmEntry = {
  crm: Crm;
  label: string;
  /** "live" once run against a real workspace; "docs" when written from the API docs. */
  written: "live" | "docs";
};

const registry = {
  hubspot: { crm: hubspot, label: "HubSpot", written: "live" },
} as const satisfies Record<string, CrmEntry>;

export type CrmSlug = keyof typeof registry;

export const CRMS: Record<CrmSlug, CrmEntry> = registry;

export const CRM_SLUGS = Object.keys(CRMS) as CrmSlug[];
