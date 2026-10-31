import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  useCargoApi,
} from "@cargo-ai/app-sdk";
import { useMutation } from "@tanstack/react-query";
import React from "react";

import {
  activitiesModelUuid,
  draftsModelUuid,
  enrichToolUuid,
  redraftToolUuid,
  sendToolUuid,
} from "../config";
import {
  startTool,
  submitInsert,
  submitUpsert,
  waitForRun,
} from "../lib/cargo";
import {
  countOf,
  isOpenDraft,
  orEmpty,
  replySubject,
  sendBlocker,
  statusBadge,
  stopIfReplied,
  toHtml,
} from "../lib/drafts";
import { hasText, type Claim, type Draft } from "../lib/queries";
import type { Rep } from "../lib/rep";
import { LinkedinTab } from "./LinkedinTab";

type CardProps = {
  draft: Draft;
  claim: Claim | undefined;
  rep: Rep | undefined;
  onChanged: () => void;
};

// Who the person is and how to reach them, with the lookup that fills the
// gaps right where the gap shows.
const ContactLine: React.FC<CardProps> = ({ draft, claim, onChanged }) => {
  const api = useCargoApi();
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
  const canLookUp =
    hasText(draft.linkedin_url) &&
    (!hasText(draft.contact_email) || !hasText(draft.contact_phone));

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
      {hasText(draft.contact_email) ? <span>{draft.contact_email}</span> : null}
      {hasText(draft.contact_phone) ? (
        <a href={`tel:${draft.contact_phone}`} className="hover:underline">
          {draft.contact_phone}
        </a>
      ) : null}
      {hasText(draft.linkedin_url) ? (
        <a
          href={draft.linkedin_url}
          target="_blank"
          rel="noreferrer"
          className="hover:underline"
        >
          LinkedIn
        </a>
      ) : null}
      {canLookUp ? (
        <Button
          size="sm"
          variant="link"
          className="h-auto p-0"
          disabled={enrich.isLoading}
          onClick={() => enrich.mutate()}
        >
          {enrich.isLoading ? "Looking up…" : "Find email and phone"}
        </Button>
      ) : null}
      {enrich.error === null ? null : (
        <span className="text-destructive">{String(enrich.error)}</span>
      )}
    </div>
  );
};

// The reply's first lines, and the one thing to do with it here.
const ReplyBox: React.FC<CardProps & { isBooked: boolean }> = ({
  draft,
  claim,
  rep,
  isBooked,
}) => {
  const api = useCargoApi();
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
  let replied = "Their reply";
  if (hasText(draft.replied_at)) {
    replied = `Their reply, ${draft.replied_at.slice(0, 10)}`;
  }

  return (
    <div className="flex flex-col gap-2 rounded-md bg-muted p-3 text-sm">
      <div className="text-xs font-medium text-muted-foreground">{replied}</div>
      <p className="whitespace-pre-wrap">{draft.reply_snippet}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          Answer from your mailbox: the whole thread is there.
        </span>
        {isBooked || book.isSuccess ? null : (
          <Button
            size="sm"
            disabled={book.isLoading}
            onClick={() => book.mutate()}
          >
            Meeting booked
          </Button>
        )}
      </div>
      {book.error === null ? null : (
        <p className="text-destructive">{String(book.error)}</p>
      )}
    </div>
  );
};

// The email: editable while it is a draft or a follow-up, read-only once
// sent. The AI rewrite stays one click away, not in the way.
const EmailTab: React.FC<CardProps> = ({ draft, claim, rep, onChanged }) => {
  const api = useCargoApi();
  const isFollowUp = draft.status === "follow_up";
  const [subject, setSubject] = React.useState(() => {
    if (isFollowUp) {
      return replySubject(draft.subject);
    }
    return draft.subject;
  });
  const [body, setBody] = React.useState(draft.body);
  const [isRewriting, setIsRewriting] = React.useState(false);
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
      if (isFollowUp && hasText(draft.message_uuid)) {
        await stopIfReplied(api, draft);
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

  if (!isOpenDraft(draft.status) || send.isSuccess) {
    return (
      <div className="flex flex-col gap-1 text-sm">
        <div className="font-medium">{subject}</div>
        <p className="whitespace-pre-wrap text-muted-foreground">{body}</p>
      </div>
    );
  }

  const blocker = sendBlocker(rep, draft, claim);
  const failure = send.error === null ? redraft.error : send.error;
  let sendLabel = "Send";
  if (isFollowUp) {
    sendLabel = "Send follow-up";
  }
  if (send.isLoading) {
    sendLabel = "Sending…";
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        value={subject}
        aria-label="Subject"
        onChange={(event) => setSubject(event.target.value)}
      />
      <Textarea
        value={body}
        rows={7}
        aria-label="Email"
        onChange={(event) => setBody(event.target.value)}
      />
      {isRewriting ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            redraft.mutate();
          }}
        >
          <Input
            value={instruction}
            autoFocus
            placeholder="What should change? e.g. shorter, lead with the hire"
            className="min-w-64 flex-1"
            onChange={(event) => setInstruction(event.target.value)}
          />
          <Button
            size="sm"
            type="submit"
            variant="outline"
            disabled={redraft.isLoading || instruction.trim() === ""}
          >
            {redraft.isLoading ? "Rewriting…" : "Rewrite"}
          </Button>
          <Button
            size="sm"
            type="button"
            variant="ghost"
            onClick={() => setIsRewriting(false)}
          >
            Cancel
          </Button>
        </form>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {isRewriting ? (
          <span />
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsRewriting(true)}
          >
            Rewrite with AI
          </Button>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {blocker === undefined ? null : (
            <span className="text-xs text-muted-foreground">{blocker}</span>
          )}
          <Button
            size="sm"
            disabled={blocker !== undefined || send.isLoading}
            onClick={() => send.mutate()}
          >
            {sendLabel}
          </Button>
        </div>
      </div>
      {failure === null ? null : (
        <p className="text-sm text-destructive">{String(failure)}</p>
      )}
    </div>
  );
};

// One person on the account: who they are, why now, where the thread stands,
// and the email and LinkedIn note to send.
export const DraftCard: React.FC<CardProps> = (props) => {
  const { draft } = props;
  const badge = statusBadge(draft.status);
  const hasReply =
    draft.status === "replied" || draft.status === "meeting_booked";

  return (
    <Card>
      <CardHeader className="gap-2 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-semibold">{draft.contact_name}</div>
            <div className="text-sm text-muted-foreground">
              {draft.contact_title}
            </div>
          </div>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
        <ContactLine {...props} />
        {!hasText(draft.why_now) ? null : (
          <p className="border-l-2 pl-3 text-sm text-muted-foreground">
            {draft.why_now}
          </p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {hasReply ? (
          <ReplyBox {...props} isBooked={draft.status === "meeting_booked"} />
        ) : null}
        <Tabs defaultValue="email">
          <TabsList>
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger
              value="linkedin"
              disabled={!hasText(draft.linkedin_url)}
            >
              LinkedIn
            </TabsTrigger>
          </TabsList>
          <TabsContent value="email" className="pt-2">
            <EmailTab {...props} />
          </TabsContent>
          <TabsContent value="linkedin" className="pt-2">
            <LinkedinTab {...props} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
