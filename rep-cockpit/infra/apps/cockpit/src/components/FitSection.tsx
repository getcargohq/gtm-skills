import { Badge, Button, useCargoApi } from "@cargo-ai/app-sdk";
import { useMutation } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import React from "react";

import { hasText, type HotLead } from "../lib/queries";
import { queueRescore } from "../lib/rescore";

const dateLabel = (value: string): string => {
  const date = new Date(value.replace(" ", "T").replace(/\+00$/, "Z"));
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// The fit tier, when account scoring judged it and why, and a rescore that
// queues the company for account scoring's next hourly run.
export const FitSection: React.FC<{ company: HotLead | undefined }> = ({
  company,
}) => {
  const api = useCargoApi();
  const rescore = useMutation({
    mutationFn: async () => {
      if (company === undefined || !hasText(company.company_id)) {
        throw new Error("This company is not in the sourced market.");
      }
      await queueRescore(api, company.company_id);
    },
  });

  if (company === undefined || !hasText(company.tier)) {
    return (
      <p className="text-sm text-muted-foreground">
        Not tiered yet. Account scoring judges new companies on its hourly run.
      </p>
    );
  }

  const isQueued = rescore.isSuccess || !hasText(company.tiered_at);
  let scored = "Rescore queued for the next hourly run";
  if (!isQueued && hasText(company.tiered_at)) {
    scored = `Scored ${dateLabel(company.tiered_at)}`;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline">Tier {company.tier}</Badge>
          <span className="text-xs text-muted-foreground">{scored}</span>
        </div>
        {isQueued || !hasText(company.company_id) ? null : (
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            disabled={rescore.isLoading}
            onClick={() => rescore.mutate()}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Rescore
          </Button>
        )}
      </div>
      {hasText(company.tier_reason) ? (
        <p className="text-sm">{company.tier_reason}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          This score was saved without a reason. Rescore it to get one.
        </p>
      )}
      {hasText(company.tier_evidence_url) ? (
        <a
          href={company.tier_evidence_url}
          target="_blank"
          rel="noreferrer"
          className="w-fit text-xs underline"
        >
          Evidence
        </a>
      ) : null}
      {rescore.error === null ? null : (
        <p className="text-sm text-destructive">{String(rescore.error)}</p>
      )}
    </div>
  );
};
