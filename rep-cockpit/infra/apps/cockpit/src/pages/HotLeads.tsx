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

import { claimToolUuid, claimsModelUuid } from "../config";
import { sql, startTool, submitUpsert } from "../lib/cargo";
import { heldClickFor, useHeldClicks } from "../lib/held";
import { hasText, hotLeadsQuery, type HotLead } from "../lib/queries";
import { useRep } from "../lib/rep";

// What the writer is told about the account: everything the queue knew.
const accountContextOf = (lead: HotLead): string => {
  const parts: string[] = [];
  if (hasText(lead.tier)) {
    parts.push(`Fit tier ${lead.tier}: ${lead.tier_reason}`);
  }
  if (hasText(lead.readiness_stage)) {
    parts.push(
      `Readiness ${lead.readiness_stage} (score ${lead.readiness_score})`,
    );
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

export const HotLeads: React.FC = () => {
  const api = useCargoApi();
  const rep = useRep();
  const navigate = useNavigate();
  const { clicks, hold } = useHeldClicks();

  const leads = useQuery({
    queryKey: ["hot-leads"],
    queryFn: () => sql<HotLead>(api, hotLeadsQuery),
    refetchInterval: 90 * 1000,
  });

  const claim = useMutation({
    mutationFn: async (lead: HotLead) => {
      if (rep === undefined) {
        throw new Error("Still loading who you are.");
      }
      hold(lead.domain, { status: "claimed", accountName: lead.name });
      await startTool(api, claimToolUuid, {
        account_domain: lead.domain,
        account_name: lead.name,
        rep_email: rep.email,
        rep_first_name: rep.firstName,
        account_context: accountContextOf(lead),
      });
    },
    onSuccess: (_, lead) => navigate(`/accounts/${lead.domain}`),
  });

  const pass = useMutation({
    mutationFn: async (lead: HotLead) => {
      if (rep === undefined) {
        throw new Error("Still loading who you are.");
      }
      hold(lead.domain, { status: "passed", accountName: lead.name });
      await submitUpsert(api, claimsModelUuid, "account_domain", lead.domain, {
        account_domain: lead.domain,
        account_name: lead.name,
        rep_email: rep.email,
        status: "passed",
        status_at: new Date().toISOString(),
      });
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

  if (open.length === 0) {
    return (
      <CargoEmpty
        title="No hot leads to claim"
        description="Nothing is ready now or warming that nobody has claimed or passed. Readiness rebuilds every hour."
      />
    );
  }

  const failure = claim.error === null ? pass.error : claim.error;

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">Hot leads</h1>
        <p className="text-sm text-muted-foreground">
          Ready now or warming, best fit first. Claim one and its buying
          committee is sourced with a first-touch email each.
        </p>
      </div>
      {failure === null ? null : (
        <p className="text-sm text-destructive">{String(failure)}</p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Account</TableHead>
            <TableHead>Fit</TableHead>
            <TableHead>Readiness</TableHead>
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
              <TableCell className="max-w-md">
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
              <TableCell>
                <Badge variant={stageVariant(lead.readiness_stage)}>
                  {stageLabel(lead.readiness_stage)}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pass.isLoading || claim.isLoading}
                    onClick={() => pass.mutate(lead)}
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
