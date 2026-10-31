import {
  Badge,
  Button,
  CargoEmpty,
  Spinner,
  useCargoApi,
} from "@cargo-ai/app-sdk";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { useNavigate, useParams } from "react-router-dom";

import { CompanyLogo, LinkedinLink } from "../components/CompanyLogo";
import { DraftCard } from "../components/DraftCard";
import { Timeline } from "../components/Timeline";
import { claimsModelUuid } from "../config";
import { sql, submitUpsert } from "../lib/cargo";
import { byAttention } from "../lib/drafts";
import { heldClickFor, useHeldClicks } from "../lib/held";
import {
  accountLookupQuery,
  claimQuery,
  draftsQuery,
  hasText,
  type Claim,
  type Draft,
  type HotLead,
} from "../lib/queries";
import { useRep } from "../lib/rep";

const countWhere = (drafts: Draft[], statuses: string[]): number => {
  return drafts.filter((draft) => statuses.includes(draft.status)).length;
};

export const Account: React.FC = () => {
  const { domain } = useParams();
  const api = useCargoApi();
  const rep = useRep();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { clicks, hold } = useHeldClicks();
  const accountDomain = domain === undefined ? "" : domain;

  const claim = useQuery({
    queryKey: ["claim", accountDomain],
    queryFn: async () => {
      const rows = await sql<Claim>(api, claimQuery(accountDomain));
      return rows[0];
    },
    refetchInterval: 20 * 1000,
  });

  const isSourcing =
    claim.data === undefined || claim.data.sourcing_status !== "ready";

  // The company's LinkedIn page, from tam-building when it holds the domain.
  const company = useQuery({
    queryKey: ["company", accountDomain],
    queryFn: async () => {
      const rows = await sql<HotLead>(api, accountLookupQuery(accountDomain));
      return rows[0];
    },
    staleTime: 60 * 60 * 1000,
  });

  const drafts = useQuery({
    queryKey: ["drafts", accountDomain],
    queryFn: () => sql<Draft>(api, draftsQuery(accountDomain)),
    refetchInterval: isSourcing ? 20 * 1000 : 60 * 1000,
  });

  const refresh = (): void => {
    queryClient.invalidateQueries(["drafts", accountDomain]);
    queryClient.invalidateQueries(["timeline"]);
  };

  const release = useMutation({
    mutationFn: async () => {
      if (rep === undefined) {
        throw new Error("Still loading who you are.");
      }
      let accountName = accountDomain;
      if (claim.data !== undefined) {
        accountName = claim.data.account_name;
      }
      hold(accountDomain, { status: "released", accountName });
      await submitUpsert(
        api,
        claimsModelUuid,
        "account_domain",
        accountDomain,
        {
          rep_email: rep.email,
          status: "released",
          status_at: new Date().toISOString(),
        },
      );
    },
    onSuccess: () => navigate("/accounts"),
  });

  if (drafts.isLoading || claim.isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Spinner />
      </div>
    );
  }

  if (drafts.isError) {
    return (
      <CargoEmpty
        title="Could not load the drafts"
        description={String(drafts.error)}
      />
    );
  }

  const click = heldClickFor(clicks, accountDomain);
  let name = accountDomain;
  if (claim.data !== undefined) {
    name = claim.data.account_name;
  } else if (click !== undefined) {
    name = click.accountName;
  }
  const people = [...drafts.data].sort(byAttention);
  const replies = countWhere(people, ["replied"]);
  const toSend = countWhere(people, ["draft", "follow_up"]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <CompanyLogo domain={accountDomain} name={name} />
          <div>
            <h1 className="text-xl font-semibold">{name}</h1>
            <div className="flex gap-3 text-sm text-muted-foreground">
              <span>{accountDomain}</span>
              <LinkedinLink url={company.data?.linkedin_url} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {replies > 0 ? <Badge>{replies} to read</Badge> : null}
          {toSend > 0 ? (
            <Badge variant="secondary">{toSend} to send</Badge>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            disabled={release.isLoading}
            onClick={() => release.mutate()}
          >
            Release to the team
          </Button>
        </div>
      </div>
      {release.error === null ? null : (
        <p className="text-sm text-destructive">{String(release.error)}</p>
      )}
      {isSourcing ? (
        <div className="flex items-center gap-3 rounded-md border p-3 text-sm text-muted-foreground">
          <Spinner />
          Finding the buying committee and drafting a first touch for each
          person. It takes a few minutes; people appear as they are ready.
        </div>
      ) : null}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          {people.length === 0 && !isSourcing ? (
            <CargoEmpty
              title="Nobody found"
              description="The people search found no one in your buying committee at this domain. Release the account, or widen the committee in settings."
            />
          ) : null}
          {people.map((draft) => (
            <DraftCard
              key={`${draft.contact_id}:${draft.status}:${draft.drafted_at}:${draft.contact_email}`}
              draft={draft}
              claim={claim.data}
              rep={rep}
              onChanged={refresh}
            />
          ))}
        </div>
        <aside className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Timeline</h2>
          {claim.data !== undefined && hasText(claim.data.account_id) ? (
            <Timeline accountId={claim.data.account_id} />
          ) : (
            <p className="text-sm text-muted-foreground">
              The timeline starts once the claim is recorded.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
};
