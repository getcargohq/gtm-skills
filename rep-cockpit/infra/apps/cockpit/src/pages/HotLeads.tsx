import {
  Badge,
  Button,
  CargoEmpty,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useCargoApi,
} from "@cargo-ai/app-sdk";
import { useMutation, useQuery } from "@tanstack/react-query";
import React from "react";
import { useNavigate } from "react-router-dom";

import { AddAccount } from "../components/AddAccount";
import { CompanyLogo, LinkedinLink } from "../components/CompanyLogo";
import { FilterBar } from "../components/FilterBar";
import { claimsModelUuid, passReasons, type PassReason } from "../config";
import { sql, submitUpsert } from "../lib/cargo";
import { heldClickFor, useHeldClicks } from "../lib/held";
import {
  accountContextOf,
  matchesFilters,
  noFilters,
  signalLabel,
  signalsByDomain,
  stageLabel,
  stageVariant,
  startClaim,
  type Filters,
} from "../lib/leads";
import {
  hasText,
  hotLeadsQuery,
  signalsQuery,
  type HotLead,
  type Signal,
} from "../lib/queries";
import { useRep } from "../lib/rep";

const dayMs = 24 * 60 * 60 * 1000;

export const HotLeads: React.FC = () => {
  const api = useCargoApi();
  const rep = useRep();
  const navigate = useNavigate();
  const { clicks, hold } = useHeldClicks();
  const [passing, setPassing] = React.useState<string | undefined>(undefined);
  const [filters, setFilters] = React.useState<Filters>(noFilters);

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
  const shown = open.filter((lead) =>
    matchesFilters(lead, filters, signalsOf.get(lead.domain) ?? []),
  );
  const failure = claim.error === null ? pass.error : claim.error;

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Hot leads</h1>
          <p className="text-sm text-muted-foreground">
            Best fit first, with why now. Claim one and its buying committee is
            found with a draft for each person.
          </p>
        </div>
        <AddAccount rep={rep} />
      </div>
      <FilterBar
        filters={filters}
        onChange={setFilters}
        shown={shown.length}
        total={open.length}
      />
      {failure === null ? null : (
        <p className="text-sm text-destructive">{String(failure)}</p>
      )}
      {open.length === 0 ? (
        <CargoEmpty
          title="No hot leads to claim"
          description="Nothing ready now or warming is open. Readiness rebuilds every hour."
        />
      ) : null}
      {open.length > 0 && shown.length === 0 ? (
        <CargoEmpty
          title="No hot leads match these filters"
          description="Clear the filters to see the whole queue."
        />
      ) : null}
      {shown.length === 0 ? null : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Fit</TableHead>
              <TableHead>Why now</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((lead) => (
              <TableRow key={lead.domain}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <CompanyLogo domain={lead.domain} name={lead.name} />
                    <div>
                      <div className="font-medium">{lead.name}</div>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span>{lead.domain}</span>
                        <LinkedinLink url={lead.linkedin_url} />
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="max-w-xs">
                  {hasText(lead.tier) ? (
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline" className="w-fit">
                        Tier {lead.tier}
                      </Badge>
                      <span
                        className="line-clamp-2 text-xs text-muted-foreground"
                        title={lead.tier_reason ?? ""}
                      >
                        {lead.tier_reason}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Not tiered
                    </span>
                  )}
                </TableCell>
                <TableCell className="max-w-xs">
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
                      <span className="self-center text-xs text-muted-foreground">
                        Why pass?
                      </span>
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
