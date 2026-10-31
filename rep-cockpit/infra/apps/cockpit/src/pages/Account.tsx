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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  activitiesModelUuid,
  claimsModelUuid,
  draftsModelUuid,
  enrichToolUuid,
  redraftToolUuid,
  sendToolUuid,
} from "../config";
import {
  sql,
  startTool,
  submitInsert,
  submitUpsert,
  waitForRun,
} from "../lib/cargo";
import { heldClickFor, useHeldClicks } from "../lib/held";
import {
  claimQuery,
  draftsQuery,
  hasText,
  timelineQuery,
  type Activity,
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

// A row the rep can still edit and send: a first touch or a follow-up.
const isOpenDraft = (status: string): boolean => {
  return status === "draft" || status === "no_email" || status === "follow_up";
};

const statusLabel = (status: string): string | undefined => {
  if (status === "sent") {
    return "Sent, waiting for a reply";
  }
  if (status === "follow_up") {
    return "Follow-up, no reply yet";
  }
  if (status === "replied") {
    return "Replied";
  }
  if (status === "no_reply") {
    return "No reply";
  }
  if (status === "meeting_booked") {
    return "Meeting booked";
  }
  return undefined;
};

const replySubject = (subject: string): string => {
  if (/^re:/i.test(subject)) {
    return subject;
  }
  return `Re: ${subject}`;
};

const orEmpty = (value: string | null | undefined): string => {
  if (hasText(value)) {
    return value;
  }
  return "";
};

// SQL returns numbers as strings; a missing count is zero.
const countOf = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined) {
    return 0;
  }
  return Number(value);
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
  if (!hasText(draft.contact_email)) {
    return "No work email yet: try Find email and phone.";
  }
  if (claim === undefined || !hasText(claim.account_id)) {
    return "The claim is still being recorded.";
  }
  return undefined;
};

const DraftCard: React.FC<{
  draft: Draft;
  claim: Claim | undefined;
  rep: Rep | undefined;
  onChanged: () => void;
}> = ({ draft, claim, rep, onChanged }) => {
  const api = useCargoApi();
  const isFollowUp = draft.status === "follow_up";
  const [subject, setSubject] = React.useState(() => {
    if (isFollowUp) {
      return replySubject(draft.subject);
    }
    return draft.subject;
  });
  const [body, setBody] = React.useState(draft.body);
  const [instruction, setInstruction] = React.useState("");

  const send = useMutation({
    mutationFn: async () => {
      if (rep === undefined || rep.mailboxUuid === undefined) {
        throw new Error("No mailbox to send from.");
      }
      if (claim === undefined || !hasText(claim.account_id)) {
        throw new Error("The claim is still being recorded.");
      }
      const data: Record<string, unknown> = {
        contact_id: draft.contact_id,
        account_id: claim.account_id,
        rep_email: rep.email,
        mailbox_uuid: rep.mailboxUuid,
        to: draft.contact_email,
        subject,
        body_text: body,
        body_html: toHtml(body),
        touches: countOf(draft.touches) + 1,
      };
      if (isFollowUp && hasText(draft.rfc_message_id)) {
        data.in_reply_to = draft.rfc_message_id;
      }
      const runUuid = await startTool(api, sendToolUuid, data);
      // A mailbox spaces its sends one to three minutes apart, so a send can
      // wait its turn: poll for up to five minutes.
      await waitForRun(api, runUuid, 150);
    },
    onSuccess: onChanged,
  });

  const redraft = useMutation({
    mutationFn: async () => {
      if (claim === undefined) {
        throw new Error("Still loading the account.");
      }
      const runUuid = await startTool(api, redraftToolUuid, {
        contact_id: draft.contact_id,
        instruction,
        rep_name: orEmpty(draft.rep_name),
        account_name: claim.account_name,
        account_domain: claim.account_domain,
        account_context: orEmpty(claim.account_context),
        contact_name: draft.contact_name,
        contact_title: orEmpty(draft.contact_title),
        linkedin_url: orEmpty(draft.linkedin_url),
        subject,
        body,
      });
      await waitForRun(api, runUuid, 90);
    },
    onSuccess: onChanged,
  });

  const enrich = useMutation({
    mutationFn: async () => {
      if (claim === undefined || !hasText(draft.linkedin_url)) {
        throw new Error("No LinkedIn profile to look this person up by.");
      }
      const runUuid = await startTool(api, enrichToolUuid, {
        contact_id: draft.contact_id,
        contact_name: draft.contact_name,
        account_domain: claim.account_domain,
        linkedin_url: draft.linkedin_url,
      });
      await waitForRun(api, runUuid, 90);
    },
    onSuccess: onChanged,
  });

  const book = useMutation({
    mutationFn: async () => {
      if (rep === undefined || claim === undefined) {
        throw new Error("Still loading the account.");
      }
      await submitUpsert(api, draftsModelUuid, "contact_id", draft.contact_id, {
        status: "meeting_booked",
      });
      await submitInsert(api, activitiesModelUuid, {
        account_id: claim.account_id,
        contact_id: draft.contact_id,
        occurred_at: new Date().toISOString(),
        kind: "meeting",
        subject: `Meeting booked with ${draft.contact_name}`,
        body: "Booked from the reply in the rep cockpit.",
        owner_email: rep.email,
      });
    },
  });

  const status = book.isSuccess ? "meeting_booked" : draft.status;
  const isOpen = isOpenDraft(status) && !send.isSuccess;
  let label = statusLabel(status);
  if (send.isSuccess) {
    label = statusLabel("sent");
  }
  const blocker = sendBlocker(rep, draft, claim);
  const failure = [send, redraft, enrich, book].find(
    (mutation) => mutation.error !== null,
  );
  const needsLookup =
    !hasText(draft.contact_email) || !hasText(draft.contact_phone);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">{draft.contact_name}</CardTitle>
            <CardDescription>
              {draft.contact_title}
              {hasText(draft.contact_email) ? ` · ${draft.contact_email}` : ""}
              {hasText(draft.contact_phone) ? (
                <>
                  {" · "}
                  <a href={`tel:${draft.contact_phone}`} className="underline">
                    {draft.contact_phone}
                  </a>
                </>
              ) : null}
            </CardDescription>
          </div>
          {label === undefined ? null : <Badge>{label}</Badge>}
        </div>
        {!hasText(draft.why_now) ? null : (
          <p className="text-sm text-muted-foreground">{draft.why_now}</p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {status === "replied" || status === "meeting_booked" ? (
          <div className="rounded-md border p-3 text-sm">
            <div className="mb-1 text-xs text-muted-foreground">
              Reply
              {hasText(draft.replied_at)
                ? `, ${draft.replied_at.slice(0, 10)}`
                : ""}
            </div>
            <p className="whitespace-pre-wrap">{draft.reply_snippet}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Answer it from your mailbox: the full thread is there.
            </p>
          </div>
        ) : null}
        <Input
          value={subject}
          disabled={!isOpen}
          onChange={(event) => setSubject(event.target.value)}
        />
        <Textarea
          value={body}
          rows={8}
          disabled={!isOpen}
          onChange={(event) => setBody(event.target.value)}
        />
        {failure === undefined ? null : (
          <p className="text-sm text-destructive">{String(failure.error)}</p>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {needsLookup && hasText(draft.linkedin_url) ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={enrich.isLoading}
              onClick={() => enrich.mutate()}
            >
              {enrich.isLoading ? "Looking up…" : "Find email and phone"}
            </Button>
          ) : null}
          {status === "replied" ? (
            <Button
              size="sm"
              variant="outline"
              disabled={book.isLoading}
              onClick={() => book.mutate()}
            >
              Meeting booked
            </Button>
          ) : null}
        </div>
        {!isOpen ? null : (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Input
              value={instruction}
              placeholder="What should change? e.g. shorter, lead with the hire"
              className="max-w-sm"
              onChange={(event) => setInstruction(event.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={redraft.isLoading || instruction === ""}
              onClick={() => redraft.mutate()}
            >
              {redraft.isLoading ? "Rewriting…" : "Regenerate"}
            </Button>
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

const kindLabel = (activity: Activity): string => {
  if (
    activity.kind === "email" &&
    /^reply from/i.test(orEmpty(activity.subject))
  ) {
    return "Reply";
  }
  return activity.kind.charAt(0).toUpperCase() + activity.kind.slice(1);
};

const Timeline: React.FC<{ accountId: string }> = ({ accountId }) => {
  const api = useCargoApi();
  const activities = useQuery({
    queryKey: ["timeline", accountId],
    queryFn: () => sql<Activity>(api, timelineQuery(accountId)),
    refetchInterval: 60 * 1000,
  });

  if (activities.isLoading) {
    return <Spinner />;
  }
  if (activities.isError) {
    return (
      <p className="text-sm text-destructive">{String(activities.error)}</p>
    );
  }
  if (activities.data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing logged on this account yet.
      </p>
    );
  }
  return (
    <ol className="flex flex-col gap-3">
      {activities.data.map((activity, index) => (
        <li key={`${activity.occurred_at}-${index}`} className="text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{kindLabel(activity)}</Badge>
            <span className="text-xs text-muted-foreground">
              {activity.occurred_at.slice(0, 10)}
              {hasText(activity.contact_name)
                ? ` · ${activity.contact_name}`
                : ""}
              {hasText(activity.owner_email)
                ? ` · ${activity.owner_email}`
                : ""}
            </span>
          </div>
          <div className="font-medium">{activity.subject}</div>
          {hasText(activity.body) ? (
            <p className="line-clamp-2 text-muted-foreground">
              {activity.body}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
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
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-4">
          {drafts.data.length === 0 && !isSourcing ? (
            <CargoEmpty
              title="Nobody found"
              description="The people search returned no one in your buying committee at this domain."
            />
          ) : null}
          {drafts.data.map((draft) => (
            <DraftCard
              key={`${draft.contact_id}:${draft.status}:${draft.drafted_at}:${draft.contact_email}`}
              draft={draft}
              claim={claim.data}
              rep={rep}
              onChanged={refresh}
            />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Timeline</h2>
          {claim.data !== undefined && hasText(claim.data.account_id) ? (
            <Timeline accountId={claim.data.account_id} />
          ) : (
            <p className="text-sm text-muted-foreground">
              The timeline starts once the claim is recorded.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
