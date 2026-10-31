import { Button, Spinner, useCargoApi } from "@cargo-ai/app-sdk";
import { useQuery } from "@tanstack/react-query";
import React from "react";

import { sql } from "../lib/cargo";
import { factsOf } from "../lib/company";
import {
  companyProfileQuery,
  hasText,
  type CompanyProfile,
} from "../lib/queries";

// What the company does and the facts its tier was judged on. The description
// is long on most sources, so it opens on a few lines.
export const CompanyAbout: React.FC<{ domain: string }> = ({ domain }) => {
  const api = useCargoApi();
  const [isExpanded, setIsExpanded] = React.useState(false);
  const profile = useQuery({
    queryKey: ["company-profile", domain],
    queryFn: async () => {
      const rows = await sql<CompanyProfile>(api, companyProfileQuery(domain));
      return rows[0];
    },
    staleTime: 60 * 60 * 1000,
  });

  if (profile.isLoading) {
    return <Spinner />;
  }
  if (profile.isError) {
    return <p className="text-sm text-destructive">{String(profile.error)}</p>;
  }
  if (profile.data === undefined) {
    return (
      <p className="text-sm text-muted-foreground">
        Not in the sourced market yet, so there is nothing on file beyond the
        domain.
      </p>
    );
  }

  const facts = factsOf(profile.data);
  let descriptionClass = "whitespace-pre-line text-sm";
  if (!isExpanded) {
    descriptionClass = `${descriptionClass} line-clamp-4`;
  }

  return (
    <div className="flex flex-col gap-3">
      {hasText(profile.data.description) ? (
        <div className="flex flex-col items-start gap-1">
          <p className={descriptionClass}>{profile.data.description.trim()}</p>
          <Button
            size="sm"
            variant="link"
            className="h-auto p-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? "Show less" : "Show more"}
          </Button>
        </div>
      ) : null}
      {facts.length === 0 ? null : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {facts.map((fact) => (
            <React.Fragment key={fact.label}>
              <dt className="text-muted-foreground">{fact.label}</dt>
              <dd>{fact.value}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}
    </div>
  );
};
