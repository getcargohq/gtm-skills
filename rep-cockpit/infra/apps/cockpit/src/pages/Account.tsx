import {
  Badge,
  Button,
  Card,
  CardContent,
  CargoEmpty,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useCargoApi,
} from "@cargo-ai/app-sdk";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Undo2 } from "lucide-react";
import React from "react";
import { useNavigate, useParams } from "react-router-dom";

import { AddPerson } from "../components/AddPerson";
import { CompanyLogo, LinkedinLink } from "../components/CompanyLogo";
import { CompanySidebar } from "../components/CompanySidebar";
import { DraftCard } from "../components/DraftCard";
import { Timeline } from "../components/Timeline";
import { claimsModelUuid } from "../config";
import { sql, submitUpsert } from "../lib/cargo";
import { byAttention } from "../lib/drafts";
import { heldClickFor, isClaimRowCurrent, useHeldClicks } from "../lib/held";
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

const sourcingSteps = "three people in the buying committee";

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

  const click = heldClickFor(clicks, accountDomain);
  const isStarting = !isClaimRowCurrent(claim.data, click);
  const isSourcing =
    isStarting ||
    claim.data === undefined ||
    claim.data.sourcing_status !== "ready";

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
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <CompanyLogo domain={accountDomain} name={name} size="lg" />
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold">{name}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <a
                href={`https://${accountDomain}`}
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
              >
                {accountDomain}
              </a>
              <LinkedinLink url={company.data?.linkedin_url} />
              {replies > 0 ? <Badge>{replies} to read</Badge> : null}
              {toSend > 0 ? (
                <Badge variant="secondary">{toSend} to send</Badge>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AddPerson claim={claim.data} rep={rep} onAdded={refresh} />
          <Button
            variant="ghost"
            disabled={release.isLoading}
            onClick={() => release.mutate()}
          >
            <Undo2 className="mr-2 h-4 w-4" />
            Release
          </Button>
        </div>
      </header>
      {release.error === null ? null : (
        <p className="text-sm text-destructive">{String(release.error)}</p>
      )}
      {isSourcing ? (
        <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <Spinner />
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-medium">
              {isStarting ? "Claim started" : "Sourcing the buying committee"}
            </span>
            <span className="text-muted-foreground">
              Finding up to {sourcingSteps} and drafting a first touch for each.
              It usually takes 2 to 4 minutes, and keeps going if you leave this
              page. People appear below as they are ready.
            </span>
          </div>
        </div>
      ) : null}
      <div className="grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6">
          <CompanySidebar domain={accountDomain} company={company.data} />
        </aside>
        <Tabs defaultValue="people" className="flex flex-col gap-4">
          <TabsList className="w-fit">
            <TabsTrigger value="people">People ({people.length})</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
          <TabsContent value="people" className="mt-0 flex flex-col gap-4">
            {people.length === 0 && !isSourcing ? (
              <CargoEmpty
                title="Nobody found"
                description="The people search found no one in your buying committee at this domain. Add someone you know, or release the account."
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
          </TabsContent>
          <TabsContent value="activity" className="mt-0">
            <Card>
              <CardContent className="p-6">
                {claim.data !== undefined && hasText(claim.data.account_id) ? (
                  <Timeline accountId={claim.data.account_id} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    The timeline starts once the claim is recorded.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
