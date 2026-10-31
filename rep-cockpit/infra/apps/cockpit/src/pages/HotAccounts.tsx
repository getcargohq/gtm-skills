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

import { AccountPreview } from "../components/AccountPreview";
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
} from "../lib/hot-accounts";
import {
  hasText,
  hotAccountsQuery,
  signalsQuery,
  type HotAccount,
  type Signal,
} from "../lib/queries";
import { useRep } from "../lib/rep";

const dayMs = 24 * 60 * 60 * 1000;

export const HotAccounts: React.FC = () => {
  const api = useCargoApi();
  const rep = useRep();
  const navigate = useNavigate();
  const { clicks, hold } = useHeldClicks();
  const [passing, setPassing] = React.useState<string | undefined>(undefined);
  const [filters, setFilters] = React.useState<Filters>(noFilters);
  const [previewing, setPreviewing] = React.useState<HotAccount | undefined>(
    undefined,
  );

  const accounts = useQuery({
    queryKey: ["hot-accounts"],
    queryFn: () => sql<HotAccount>(api, hotAccountsQuery),
    refetchInterval: 90 * 1000,
  });

  const domains = (accounts.data ?? []).map((account) => account.domain);
  const signals = useQuery({
    queryKey: ["signals", domains.join(",")],
    queryFn: () => sql<Signal>(api, signalsQuery(domains)),
    enabled: domains.length > 0,
    staleTime: 10 * 60 * 1000,
  });
  const signalsOf = signalsByDomain(signals.data ?? []);

  const claim = useMutation({
    mutationFn: async (account: HotAccount) => {
      if (rep === undefined) {
        throw new Error("Still loading who you are.");
      }
      hold(account.domain, { status: "claimed", accountName: account.name });
      const accountSignals = signalsOf.get(account.domain) ?? [];
      await startClaim(
        api,
        rep,
        account,
        accountContextOf(account, accountSignals),
      );
    },
    onSuccess: (_, account) => navigate(`/accounts/${account.domain}`),
  });

  const pass = useMutation({
    mutationFn: async ({
      account,
      reason,
    }: {
      account: HotAccount;
      reason: PassReason;
    }) => {
      if (rep === undefined) {
        throw new Error("Still loading who you are.");
      }
      hold(account.domain, { status: "passed", accountName: account.name });
      setPassing(undefined);
      setPreviewing(undefined);
      const values: Record<string, unknown> = {
        account_domain: account.domain,
        account_name: account.name,
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
        account.domain,
        values,
      );
    },
  });

  if (accounts.isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Spinner />
      </div>
    );
  }

  if (accounts.isError) {
    return (
      <CargoEmpty
        title="Could not load Hot accounts"
        description={String(accounts.error)}
      />
    );
  }

  const open = accounts.data.filter((account) => {
    const click = heldClickFor(clicks, account.domain);
    if (click === undefined) {
      return true;
    }
    return click.status === "released";
  });
  const shown = open.filter((account) =>
    matchesFilters(account, filters, signalsOf.get(account.domain) ?? []),
  );
  const failure = claim.error === null ? pass.error : claim.error;

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Hot accounts</h1>
          <p className="text-sm text-muted-foreground">
            Best fit first, then readiness. Click a company to read about it;
            claim it and its buying committee is found with a draft for each
            person.
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
          title="No hot accounts to claim"
          description="Nothing ready now or warming is open. Readiness rebuilds every hour."
        />
      ) : null}
      {open.length > 0 && shown.length === 0 ? (
        <CargoEmpty
          title="No hot accounts match these filters"
          description="Clear the filters to see the whole queue."
        />
      ) : null}
      {shown.length === 0 ? null : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Fit</TableHead>
              <TableHead>Readiness</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((account) => (
              <TableRow
                key={account.domain}
                className="cursor-pointer"
                onClick={() => setPreviewing(account)}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <CompanyLogo domain={account.domain} name={account.name} />
                    <div>
                      <button
                        type="button"
                        className="text-left font-medium hover:underline"
                        onClick={(event) => {
                          event.stopPropagation();
                          setPreviewing(account);
                        }}
                      >
                        {account.name}
                      </button>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span>{account.domain}</span>
                        <LinkedinLink url={account.linkedin_url} />
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="max-w-xs">
                  {hasText(account.tier) ? (
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline" className="w-fit">
                        Tier {account.tier}
                      </Badge>
                      <span
                        className="line-clamp-2 text-xs text-muted-foreground"
                        title={account.tier_reason ?? ""}
                      >
                        {account.tier_reason}
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
                    {hasText(account.readiness_stage) ? (
                      <Badge
                        variant={stageVariant(account.readiness_stage)}
                        className="w-fit"
                      >
                        {stageLabel(account.readiness_stage)}
                      </Badge>
                    ) : null}
                    {!hasText(account.readiness_stage) &&
                    (signalsOf.get(account.domain) ?? []).length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        No signal yet
                      </span>
                    ) : null}
                    {(signalsOf.get(account.domain) ?? []).map((signal) => (
                      <span
                        key={`${signal.signal}-${signal.occurred}`}
                        className="text-xs text-muted-foreground"
                      >
                        {signalLabel(signal)}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell
                  className="text-right"
                  onClick={(event) => event.stopPropagation()}
                >
                  {passing === account.domain ? (
                    <div className="flex flex-wrap justify-end gap-2">
                      <span className="self-center text-xs text-muted-foreground">
                        Why pass?
                      </span>
                      {passReasons.map((reason) => (
                        <Button
                          key={reason.slug}
                          size="sm"
                          variant="outline"
                          onClick={() => pass.mutate({ account, reason })}
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
                        onClick={() => setPassing(account.domain)}
                      >
                        Pass
                      </Button>
                      <Button
                        size="sm"
                        disabled={claim.isLoading || rep === undefined}
                        onClick={() => claim.mutate(account)}
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
      <AccountPreview
        account={previewing}
        signals={signalsOf.get(previewing?.domain ?? "") ?? []}
        isBusy={claim.isLoading || pass.isLoading || rep === undefined}
        onClose={() => setPreviewing(undefined)}
        onClaim={(account) => claim.mutate(account)}
        onPass={(account, reason) => pass.mutate({ account, reason })}
      />
    </div>
  );
};
