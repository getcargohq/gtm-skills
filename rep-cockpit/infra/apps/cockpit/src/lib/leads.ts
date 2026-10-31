import type { Api } from "@cargo-ai/api";

import { claimToolUuid } from "../config";
import { startTool } from "./cargo";
import { hasText, type HotLead, type Signal } from "./queries";
import type { Rep } from "./rep";

export const signalLabel = (signal: Signal): string => {
  if (!hasText(signal.occurred)) {
    return signal.signal;
  }
  return `${signal.signal} · ${signal.occurred}`;
};

// What the writer is told about the account: everything the queue knew.
export const accountContextOf = (lead: HotLead, signals: Signal[]): string => {
  const parts: string[] = [];
  if (hasText(lead.tier)) {
    parts.push(`Fit tier ${lead.tier}: ${lead.tier_reason}`);
  }
  if (hasText(lead.readiness_stage)) {
    parts.push(
      `Readiness ${lead.readiness_stage} (score ${lead.readiness_score})`,
    );
  }
  if (signals.length > 0) {
    parts.push(`Recent signals: ${signals.map(signalLabel).join("; ")}`);
  }
  return parts.join(". ");
};

export const stageLabel = (stage: string | null | undefined): string => {
  if (stage === "ready_now") {
    return "Ready now";
  }
  if (stage === "warming") {
    return "Warming";
  }
  return "Not scored";
};

export const stageVariant = (
  stage: string | null | undefined,
): "default" | "secondary" | "outline" => {
  if (stage === "ready_now") {
    return "default";
  }
  if (stage === "warming") {
    return "secondary";
  }
  return "outline";
};

// "https://www.Northwind.example/about" -> "northwind.example".
export const toDomain = (website: string): string => {
  return website
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0];
};

export const signalsByDomain = (signals: Signal[]): Map<string, Signal[]> => {
  const byDomain = new Map<string, Signal[]>();
  for (const signal of signals) {
    const list = byDomain.get(signal.domain);
    if (list === undefined) {
      byDomain.set(signal.domain, [signal]);
    } else {
      list.push(signal);
    }
  }
  return byDomain;
};

export type Filters = {
  search: string;
  tier: string;
  stage: string;
  withSignals: boolean;
};

export const noFilters: Filters = {
  search: "",
  tier: "all",
  stage: "all",
  withSignals: false,
};

// The filters narrow what the query already returned, in the browser: the
// query is the queue, the filters are how one rep reads it today.
export const matchesFilters = (
  lead: HotLead,
  filters: Filters,
  signals: Signal[],
): boolean => {
  const search = filters.search.trim().toLowerCase();
  if (
    search !== "" &&
    !lead.name.toLowerCase().includes(search) &&
    !lead.domain.includes(search)
  ) {
    return false;
  }
  if (filters.tier === "none" && hasText(lead.tier)) {
    return false;
  }
  if (
    filters.tier !== "all" &&
    filters.tier !== "none" &&
    lead.tier !== filters.tier
  ) {
    return false;
  }
  if (filters.stage !== "all" && lead.readiness_stage !== filters.stage) {
    return false;
  }
  if (filters.withSignals && signals.length === 0) {
    return false;
  }
  return true;
};

export const startClaim = async (
  api: Api,
  rep: Rep,
  lead: HotLead,
  accountContext: string,
): Promise<void> => {
  await startTool(api, claimToolUuid, {
    account_domain: lead.domain,
    account_name: lead.name,
    rep_email: rep.email,
    rep_first_name: rep.firstName,
    account_context: accountContext,
  });
};
