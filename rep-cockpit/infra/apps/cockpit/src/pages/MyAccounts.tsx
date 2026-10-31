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
import { ChevronRight } from "lucide-react";
import React from "react";
import { Link, useNavigate } from "react-router-dom";

import { CompanyLogo, LinkedinLink } from "../components/CompanyLogo";
import { sql } from "../lib/cargo";
import { countOf } from "../lib/drafts";
import { heldClickFor, useHeldClicks } from "../lib/held";
import { needsOf, sourcingLabel } from "../lib/needs";
import { myClaimsQuery, type MyClaim } from "../lib/queries";
import { useRep } from "../lib/rep";

type Row = {
  domain: string;
  name: string;
  linkedinUrl?: string | null;
  sourcing: string;
  needs: string[];
};

export const MyAccounts: React.FC = () => {
  const api = useCargoApi();
  const rep = useRep();
  const { clicks } = useHeldClicks();
  const navigate = useNavigate();

  const claims = useQuery({
    queryKey: ["my-claims", rep === undefined ? "" : rep.email],
    queryFn: () => {
      if (rep === undefined) {
        return [];
      }
      return sql<MyClaim>(api, myClaimsQuery(rep.email));
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
      linkedinUrl: claim.linkedin_url,
      sourcing: sourcingLabel(claim.sourcing_status),
      needs: needsOf({
        replies: countOf(claim.replies),
        drafts: countOf(claim.drafts),
        followUps: countOf(claim.follow_ups),
        noEmail: countOf(claim.no_email),
      }),
    });
  }
  // Claimed in this browser, not yet in SQL.
  for (const [domain, click] of clicks) {
    if (click.status === "claimed" && !seen.has(domain)) {
      rows.unshift({
        domain,
        name: click.accountName,
        sourcing: "Sourcing",
        needs: [],
      });
    }
  }

  if (rows.length === 0) {
    return (
      <CargoEmpty
        title="No claimed accounts"
        description="Claim one from Hot accounts: it lands here while its buying committee is sourced."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">My accounts</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Needs you</TableHead>
            <TableHead>
              <span className="sr-only">Open</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.domain}
              className="cursor-pointer"
              onClick={() => navigate(`/accounts/${row.domain}`)}
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  <CompanyLogo domain={row.domain} name={row.name} />
                  <div>
                    <Link
                      to={`/accounts/${row.domain}`}
                      className="font-medium hover:underline"
                    >
                      {row.name}
                    </Link>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>{row.domain}</span>
                      <LinkedinLink url={row.linkedinUrl} />
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{row.sourcing}</Badge>
              </TableCell>
              <TableCell>
                {row.needs.length === 0 ? (
                  <span className="text-sm text-muted-foreground">
                    Nothing waiting
                  </span>
                ) : (
                  <div className="flex gap-2">
                    {row.needs.map((need) => (
                      <Badge key={need}>{need}</Badge>
                    ))}
                  </div>
                )}
              </TableCell>
              <TableCell className="w-8 text-right">
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
