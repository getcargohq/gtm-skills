import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CargoEmpty,
  Input,
  Spinner,
  Textarea,
  useCargoApi,
} from "@cargo-ai/app-sdk";
import { useMutation, useQuery } from "@tanstack/react-query";
import React from "react";
import { useNavigate, useParams } from "react-router-dom";

import { claimsModelUuid, sendToolUuid } from "../config";
import { sql, startTool, submitUpsert, waitForRun } from "../lib/cargo";
import { heldClickFor, useHeldClicks } from "../lib/held";
import {
  claimQuery,
  draftsQuery,
  type Claim,
  type Draft,
} from "../lib/queries";
import { useRep, type Rep } from "../lib/rep";

const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

// The rep edits plain text; the mail goes out as paragraphs.
const toHtml = (text: string): string => {
  return text
    .split(/\n\s*\n/)
    .map(
      (paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
};

// Why Send is off for this draft, or undefined when it can go.
const sendBlocker = (
  rep: Rep | undefined,
  draft: Draft,
  claim: Claim | undefined,
): string | undefined => {
  if (rep === undefined) {
    return "Loading who you are.";
  }
  if (rep.mailboxUuid === undefined) {
    return `No mailbox is attached to ${rep.email}. Ask an admin to attach one to your member.`;
  }
  if (draft.contact_email === null || draft.contact_email === "") {
    return "No work email was found for this person.";
  }
  if (claim === undefined || claim.account_id === null) {
    return "The claim is still being recorded.";
  }
  return undefined;
};

const DraftCard: React.FC<{
  draft: Draft;
  claim: Claim | undefined;
  rep: Rep | undefined;
}> = ({ draft, claim, rep }) => {
  const api = useCargoApi();
  const [subject, setSubject] = React.useState(draft.subject);
  const [body, setBody] = React.useState(draft.body);

  const send = useMutation({
    mutationFn: async () => {
      if (rep === undefined || rep.mailboxUuid === undefined) {
        throw new Error("No mailbox to send from.");
      }
      if (claim === undefined || claim.account_id === null) {
        throw new Error("The claim is still being recorded.");
      }
      const runUuid = await startTool(api, sendToolUuid, {
        contact_id: draft.contact_id,
        account_id: claim.account_id,
        rep_email: rep.email,
        mailbox_uuid: rep.mailboxUuid,
        to: draft.contact_email,
        subject,
        body_text: body,
        body_html: toHtml(body),
      });
      // A mailbox spaces its sends one to three minutes apart, so a send can
      // wait its turn: poll for up to five minutes.
      await waitForRun(api, runUuid, 150);
    },
  });

  const isSent = draft.status === "sent" || send.isSuccess;
  const blocker = sendBlocker(rep, draft, claim);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">{draft.contact_name}</CardTitle>
            <CardDescription>
              {draft.contact_title}
              {draft.contact_email === null ? "" : ` · ${draft.contact_email}`}
            </CardDescription>
          </div>
          {isSent ? <Badge>Sent</Badge> : null}
        </div>
        {draft.why_now === null ? null : (
          <p className="text-sm text-muted-foreground">{draft.why_now}</p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Input
          value={subject}
          disabled={isSent}
          onChange={(event) => setSubject(event.target.value)}
        />
        <Textarea
          value={body}
          rows={8}
          disabled={isSent}
          onChange={(event) => setBody(event.target.value)}
        />
        {send.error === null ? null : (
          <p className="text-sm text-destructive">{String(send.error)}</p>
        )}
        {isSent ? null : (
          <div className="flex items-center justify-end gap-3">
            {blocker === undefined ? null : (
              <span className="text-xs text-muted-foreground">{blocker}</span>
            )}
            <Button
              size="sm"
              disabled={blocker !== undefined || send.isLoading}
              onClick={() => send.mutate()}
            >
              {send.isLoading ? "Sending…" : "Send"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const Account: React.FC = () => {
  const { domain } = useParams();
  const api = useCargoApi();
  const rep = useRep();
  const navigate = useNavigate();
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

  const drafts = useQuery({
    queryKey: ["drafts", accountDomain],
    queryFn: () => sql<Draft>(api, draftsQuery(accountDomain)),
    refetchInterval: isSourcing ? 20 * 1000 : false,
  });

  const release = useMutation({
    mutationFn: async () => {
      if (rep === undefined) {
        throw new Error("Still loading who you are.");
      }
      const accountName =
        claim.data === undefined ? accountDomain : claim.data.account_name;
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

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{name}</h1>
          <p className="text-sm text-muted-foreground">{accountDomain}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={release.isLoading}
          onClick={() => release.mutate()}
        >
          Release to the team
        </Button>
      </div>
      {isSourcing ? (
        <p className="text-sm text-muted-foreground">
          Sourcing the buying committee and drafting a first touch for each
          person. This takes a few minutes; drafts appear as they land.
        </p>
      ) : null}
      {drafts.data.length === 0 && !isSourcing ? (
        <CargoEmpty
          title="Nobody found"
          description="The people search returned no one in your buying committee at this domain."
        />
      ) : null}
      {drafts.data.map((draft) => (
        <DraftCard
          key={draft.contact_id}
          draft={draft}
          claim={claim.data}
          rep={rep}
        />
      ))}
    </div>
  );
};
