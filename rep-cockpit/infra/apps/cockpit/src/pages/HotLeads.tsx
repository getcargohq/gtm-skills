import {
  Badge,
  Button,
  CargoEmpty,
  Input,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useCargoApi,
} from "@cargo-ai/app-sdk";
import type { Api } from "@cargo-ai/api";
import { useMutation, useQuery } from "@tanstack/react-query";
import React from "react";
import { useNavigate } from "react-router-dom";

import {
  claimToolUuid,
  claimsModelUuid,
  passReasons,
  type PassReason,
} from "../config";
import { sql, startTool, submitUpsert } from "../lib/cargo";
import { heldClickFor, useHeldClicks } from "../lib/held";
import {
  accountLookupQuery,
  claimQuery,
  hasText,
  hotLeadsQuery,
  signalsQuery,
  type Claim,
  type HotLead,
  type Signal,
} from "../lib/queries";
import { useRep, type Rep } from "../lib/rep";

const dayMs = 24 * 60 * 60 * 1000;

const signalLabel = (signal: Signal): string => {
  if (!hasText(signal.occurred)) {
    return signal.signal;
  }
  return `${signal.signal} · ${signal.occurred}`;
};

// What the writer is told about the account: everything the queue knew.
const accountContextOf = (lead: HotLead, signals: Signal[]): string => {
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

const stageLabel = (stage: string | null | undefined): string => {
  if (stage === "ready_now") {
    return "Ready now";
  }
  if (stage === "warming") {
    return "Warming";
  }
  return "Not scored";
};

const stageVariant = (
  stage: string | null | undefined,
): "default" | "secondary" => {
  if (stage === "ready_now") {
    return "default";
  }
  return "secondary";
};

// "https://www.Northwind.example/about" -> "northwind.example".
const toDomain = (website: string): string => {
  return website
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0];
};

const signalsByDomain = (signals: Signal[]): Map<string, Signal[]> => {
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

const startClaim = async (
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

// An account the queue did not surface: a rep's own lead, a referral, an
// inbound. It goes through the same claim as a Hot lead, with what the queue
// knows about the domain, unless a teammate already holds it.
const AddAccount: React.FC<{ rep: Rep | undefined }> = ({ rep }) => {
  const api = useCargoApi();
  const navigate = useNavigate();
  const { hold } = useHeldClicks();
  const [website, setWebsite] = React.useState("");

  const add = useMutation({
    mutationFn: async (): Promise<string> => {
      if (rep === undefined) {
        throw new Error("Still loading who you are.");
      }
      const domain = toDomain(website);
      if (!domain.includes(".")) {
        throw new Error("Enter the company's website, like northwind.example.");
      }
      const claims = await sql<Claim>(api, claimQuery(domain));
      if (claims.length > 0 && claims[0].status === "claimed") {
        throw new Error(
          `${claims[0].account_name} is already claimed by ${claims[0].rep_email}.`,
        );
      }
      const found = await sql<HotLead>(api, accountLookupQuery(domain));
      let lead: HotLead = { domain, name: domain };
      if (found.length > 0) {
        lead = found[0];
      }
      hold(domain, { status: "claimed", accountName: lead.name });
      const context = accountContextOf(lead, []);
      await startClaim(
        api,
        rep,
        lead,
        `Added by the rep, not surfaced by the queue. ${context}`,
      );
      return domain;
    },
    onSuccess: (domain) => navigate(`/accounts/${domain}`),
  });

  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        add.mutate();
      }}
    >
      <div className="flex gap-2">
        <Input
          value={website}
          placeholder="Add an account by website"
          className="w-72"
          onChange={(event) => setWebsite(event.target.value)}
        />
        <Button
          size="sm"
          type="submit"
          disabled={add.isLoading || rep === undefined || website === ""}
        >
          {add.isLoading ? "Claiming…" : "Add and claim"}
        </Button>
      </div>
      {add.error === null ? null : (
        <p className="text-xs text-destructive">{String(add.error)}</p>
      )}
    </form>
  );
};

export const HotLeads: React.FC = () => {
  const api = useCargoApi();
  const rep = useRep();
  const navigate = useNavigate();
  const { clicks, hold } = useHeldClicks();
  const [passing, setPassing] = React.useState<string | undefined>(undefined);

  const leads = useQuery({
    queryKey: ["hot-leads"],
    queryFn: () => sql<HotLead>(api, hotLeadsQuery),
    refetchInterval: 90 * 1000,
  });

  const domains = (leads.data ?? []).map((lead) => lead.domain);
  const signals = useQuery({
    queryKey: ["signals", domains.join(",")],
    queryFn: () => sql<Signal>(api, signalsQuery(domains)),
    enabled: domains.length > 0,
    staleTime: 10 * 60 * 1000,
  });
  const signalsOf = signalsByDomain(signals.data ?? []);

  const claim = useMutation({
    mutationFn: async (lead: HotLead) => {
      if (rep === undefined) {
        throw new Error("Still loading who you are.");
      }
      hold(lead.domain, { status: "claimed", accountName: lead.name });
      const leadSignals = signalsOf.get(lead.domain) ?? [];
      await startClaim(api, rep, lead, accountContextOf(lead, leadSignals));
    },
    onSuccess: (_, lead) => navigate(`/accounts/${lead.domain}`),
  });

  const pass = useMutation({
    mutationFn: async ({
      lead,
      reason,
    }: {
      lead: HotLead;
      reason: PassReason;
    }) => {
      if (rep === undefined) {
        throw new Error("Still loading who you are.");
      }
      hold(lead.domain, { status: "passed", accountName: lead.name });
      setPassing(undefined);
      const values: Record<string, unknown> = {
        account_domain: lead.domain,
        account_name: lead.name,
        rep_email: rep.email,
        status: "passed",
        status_at: new Date().toISOString(),
        pass_reason: reason.slug,
      };
      if (reason.parkDays !== undefined) {
        values.parked_until = new Date(
          Date.now() + reason.parkDays * dayMs,
        ).toISOString();
      }
      await submitUpsert(
        api,
        claimsModelUuid,
        "account_domain",
        lead.domain,
        values,
      );
    },
  });

  if (leads.isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Spinner />
      </div>
    );
  }

  if (leads.isError) {
    return (
      <CargoEmpty
        title="Could not load Hot leads"
        description={String(leads.error)}
      />
    );
  }

  const open = leads.data.filter((lead) => {
    const click = heldClickFor(clicks, lead.domain);
    if (click === undefined) {
      return true;
    }
    return click.status === "released";
  });

  const failure = claim.error === null ? pass.error : claim.error;

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Hot leads</h1>
          <p className="text-sm text-muted-foreground">
            Ready now or warming, best fit first. Claim one and its buying
            committee is sourced with a first-touch email each.
          </p>
        </div>
        <AddAccount rep={rep} />
      </div>
      {failure === null ? null : (
        <p className="text-sm text-destructive">{String(failure)}</p>
      )}
      {open.length === 0 ? (
        <CargoEmpty
          title="No hot leads to claim"
          description="Nothing is ready now or warming that nobody holds. Readiness rebuilds every hour."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Fit</TableHead>
              <TableHead>Why now</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {open.map((lead) => (
              <TableRow key={lead.domain}>
                <TableCell>
                  <div className="font-medium">{lead.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {lead.domain}
                  </div>
                </TableCell>
                <TableCell className="max-w-sm">
                  {!hasText(lead.tier) ? (
                    <span className="text-muted-foreground">Not tiered</span>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline" className="w-fit">
                        Tier {lead.tier}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {lead.tier_reason}
                      </span>
                    </div>
                  )}
                </TableCell>
                <TableCell className="max-w-sm">
                  <div className="flex flex-col gap-1">
                    <Badge
                      variant={stageVariant(lead.readiness_stage)}
                      className="w-fit"
                    >
                      {stageLabel(lead.readiness_stage)}
                    </Badge>
                    {(signalsOf.get(lead.domain) ?? []).map((signal) => (
                      <span
                        key={`${signal.signal}-${signal.occurred}`}
                        className="text-xs text-muted-foreground"
                      >
                        {signalLabel(signal)}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {passing === lead.domain ? (
                    <div className="flex flex-wrap justify-end gap-2">
                      {passReasons.map((reason) => (
                        <Button
                          key={reason.slug}
                          size="sm"
                          variant="outline"
                          onClick={() => pass.mutate({ lead, reason })}
                        >
                          {reason.label}
                        </Button>
                      ))}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPassing(undefined)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pass.isLoading || claim.isLoading}
                        onClick={() => setPassing(lead.domain)}
                      >
                        Pass
                      </Button>
                      <Button
                        size="sm"
                        disabled={claim.isLoading || rep === undefined}
                        onClick={() => claim.mutate(lead)}
                      >
                        Claim
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};
