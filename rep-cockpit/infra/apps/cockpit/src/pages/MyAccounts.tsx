import {
  Badge,
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
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { Link } from "react-router-dom";

import { sql } from "../lib/cargo";
import { heldClickFor, useHeldClicks } from "../lib/held";
import { myClaimsQuery, type Claim } from "../lib/queries";
import { useRep } from "../lib/rep";

type Row = { domain: string; name: string; sourcing: string };

const sourcingLabel = (sourcingStatus: string | null): string => {
  if (sourcingStatus === "ready") {
    return "Drafts ready";
  }
  if (sourcingStatus === "failed") {
    return "Sourcing failed";
  }
  return "Sourcing";
};

export const MyAccounts: React.FC = () => {
  const api = useCargoApi();
  const rep = useRep();
  const { clicks } = useHeldClicks();

  const claims = useQuery({
    queryKey: ["my-claims", rep === undefined ? "" : rep.email],
    queryFn: () => {
      if (rep === undefined) {
        return [];
      }
      return sql<Claim>(api, myClaimsQuery(rep.email));
    },
    enabled: rep !== undefined,
    refetchInterval: 60 * 1000,
  });

  if (claims.isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Spinner />
      </div>
    );
  }

  if (claims.isError) {
    return (
      <CargoEmpty
        title="Could not load your accounts"
        description={String(claims.error)}
      />
    );
  }

  const rows: Row[] = [];
  const seen = new Set<string>();
  for (const claim of claims.data) {
    seen.add(claim.account_domain);
    const click = heldClickFor(clicks, claim.account_domain);
    if (click !== undefined && click.status !== "claimed") {
      continue;
    }
    rows.push({
      domain: claim.account_domain,
      name: claim.account_name,
      sourcing: sourcingLabel(claim.sourcing_status),
    });
  }
  // Claimed in this browser, not yet in SQL.
  for (const [domain, click] of clicks) {
    if (click.status === "claimed" && !seen.has(domain)) {
      rows.unshift({ domain, name: click.accountName, sourcing: "Sourcing" });
    }
  }

  if (rows.length === 0) {
    return (
      <CargoEmpty
        title="No claimed accounts"
        description="Claim one from Hot leads: it lands here while its buying committee is sourced."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">My accounts</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Account</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.domain}>
              <TableCell>
                <Link
                  to={`/accounts/${row.domain}`}
                  className="font-medium hover:underline"
                >
                  {row.name}
                </Link>
                <div className="text-xs text-muted-foreground">
                  {row.domain}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{row.sourcing}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
