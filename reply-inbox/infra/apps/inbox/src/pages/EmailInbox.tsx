import type { MailboxManagement } from "@cargo-ai/api";
import {
  Badge,
  Button,
  CargoEmpty,
  Input,
  ScrollArea,
  Spinner,
  Textarea,
  useCargoApi,
} from "@cargo-ai/app-sdk";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";

import {
  collectReferences,
  formatWhen,
  lastInboundRfcId,
  replySubject,
  textToHtml,
} from "../lib/thread";

type QueueFilter = "replied" | "all";

const PAGE_SIZE = 50;

export const EmailInbox: React.FC = () => {
  const api = useCargoApi();
  const queryClient = useQueryClient();
  const [queue, setQueue] = React.useState<QueueFilter>("replied");
  const [search, setSearch] = React.useState("");
  const [selectedUuid, setSelectedUuid] = React.useState<string | undefined>(
    undefined,
  );

  const mailboxesQuery = useQuery({
    queryKey: ["mailboxManagement.mailbox", "list"],
    queryFn: () => api.mailboxManagement.mailbox.list({ limit: 200 }),
  });

  const threadsQuery = useQuery({
    queryKey: ["mailboxManagement.thread", "list", queue, search],
    queryFn: () =>
      api.mailboxManagement.thread.list({
        statuses: queue === "replied" ? ["replied"] : undefined,
        search: search.trim() === "" ? undefined : search.trim(),
        limit: PAGE_SIZE,
      }),
  });

  const threads: MailboxManagement.Thread[] =
    threadsQuery.data === undefined ? [] : threadsQuery.data.threads;

  const selected =
    selectedUuid === undefined
      ? undefined
      : threads.find((thread) => thread.uuid === selectedUuid);

  React.useEffect(() => {
    if (selectedUuid !== undefined) {
      return;
    }
    const first = threads[0];
    if (first !== undefined) {
      setSelectedUuid(first.uuid);
    }
  }, [selectedUuid, threads]);

  const mailboxEmailByUuid: Record<string, string> = {};
  const mailboxes =
    mailboxesQuery.data === undefined ? [] : mailboxesQuery.data.mailboxes;
  for (const mailbox of mailboxes) {
    mailboxEmailByUuid[mailbox.uuid] = mailbox.email;
  }

  return (
    <div className="flex h-full min-h-0 w-full">
      <div className="flex w-[22rem] shrink-0 flex-col border-r">
        <div className="flex flex-col gap-2 border-b p-3">
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={queue === "replied" ? "default" : "ghost"}
              onClick={() => {
                setQueue("replied");
                setSelectedUuid(undefined);
              }}
            >
              Needs reply
            </Button>
            <Button
              size="sm"
              variant={queue === "all" ? "default" : "ghost"}
              onClick={() => {
                setQueue("all");
                setSelectedUuid(undefined);
              }}
            >
              All
            </Button>
          </div>
          <Input
            placeholder="Search threads"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setSelectedUuid(undefined);
            }}
          />
        </div>
        {threadsQuery.isLoading === true ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner />
          </div>
        ) : threads.length === 0 ? (
          <CargoEmpty
            title={
              queue === "replied" ? "Nothing waiting" : "No threads yet"
            }
            description={
              queue === "replied"
                ? "Replies to Cargo mailboxes land here. Send from a play, then wait."
                : "Send from a Cargo mailbox and the conversation appears here."
            }
          />
        ) : (
          <ScrollArea className="flex-1">
            {threads.map((thread) => {
              const isSelected = thread.uuid === selectedUuid;
              const snippet =
                thread.lastEvent === null || thread.lastEvent.snippet === null
                  ? undefined
                  : thread.lastEvent.snippet;
              const kind =
                thread.lastEvent === null ? undefined : thread.lastEvent.kind;

              return (
                <button
                  key={thread.uuid}
                  type="button"
                  onClick={() => setSelectedUuid(thread.uuid)}
                  className={
                    isSelected === true
                      ? "flex w-full flex-col items-start gap-1 border-b bg-muted px-3 py-3 text-left"
                      : "flex w-full flex-col items-start gap-1 border-b px-3 py-3 text-left hover:bg-muted/60"
                  }
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {thread.toEmail}
                    </span>
                    {kind === undefined ? null : (
                      <Badge variant="outline">{kind}</Badge>
                    )}
                  </div>
                  <span className="w-full truncate text-sm">
                    {thread.subject}
                  </span>
                  {snippet === undefined ? null : (
                    <span className="line-clamp-2 w-full text-xs text-muted-foreground">
                      {snippet}
                    </span>
                  )}
                </button>
              );
            })}
          </ScrollArea>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {selected === undefined ? (
          <CargoEmpty
            title="Pick a thread"
            description="The conversation opens here."
          />
        ) : (
          <ThreadPane
            thread={selected}
            fromEmail={mailboxEmailByUuid[selected.mailboxUuid]}
            onSent={() => {
              void queryClient.invalidateQueries({
                queryKey: ["mailboxManagement.thread"],
              });
            }}
          />
        )}
      </div>
    </div>
  );
};

const ThreadPane: React.FC<{
  thread: MailboxManagement.Thread;
  fromEmail: string | undefined;
  onSent: () => void;
}> = (props) => {
  const { thread, fromEmail, onSent } = props;
  const api = useCargoApi();
  const [draft, setDraft] = React.useState("");

  const messagesQuery = useQuery({
    queryKey: ["mailboxManagement.message", "list", thread.uuid],
    queryFn: () =>
      api.mailboxManagement.message.list({
        threadUuid: thread.uuid,
        limit: 200,
      }),
  });

  const eventsQuery = useQuery({
    queryKey: ["mailboxManagement.event", "list", thread.uuid],
    queryFn: () =>
      api.mailboxManagement.event.list({
        threadUuid: thread.uuid,
        kinds: ["replied"],
        limit: 200,
      }),
  });

  const messages: MailboxManagement.Message[] =
    messagesQuery.data === undefined ? [] : messagesQuery.data.messages;
  const inboundReplies: MailboxManagement.Event[] =
    eventsQuery.data === undefined ? [] : eventsQuery.data.events;

  type ConversationEntry =
    | {
        type: "outbound";
        key: string;
        at: number;
        message: MailboxManagement.Message;
      }
    | {
        type: "inbound";
        key: string;
        at: number;
        event: MailboxManagement.Event;
      };

  const conversation: ConversationEntry[] = [
    ...messages.map((message) => {
      const at =
        message.sentAt === null
          ? new Date(message.createdAt).getTime()
          : new Date(message.sentAt).getTime();

      return { type: "outbound" as const, key: message.uuid, at, message };
    }),
    ...inboundReplies.map((event) => {
      return {
        type: "inbound" as const,
        key: event.uuid,
        at: new Date(event.occurredAt).getTime(),
        event,
      };
    }),
  ].sort((left, right) => left.at - right.at);

  const send = useMutation({
    mutationFn: async () => {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage === undefined) {
        throw new Error("This thread has no outbound message to reply to.");
      }

      const inboundId = lastInboundRfcId(inboundReplies);
      const inReplyTo =
        inboundId !== undefined ? inboundId : lastMessage.rfcMessageId;
      const references = collectReferences(messages, inboundReplies);

      return await api.orchestration.action.execute({
        action: { kind: "native", actionSlug: "sendEmail" },
        data: {
          mailboxUuid: thread.mailboxUuid,
          to: thread.toEmail,
          subject: replySubject(thread.subject),
          bodyHtml: textToHtml(draft),
          inReplyTo,
          references,
        },
        waitUntilFinished: true,
      });
    },
    onSuccess: () => {
      setDraft("");
      onSent();
      void messagesQuery.refetch();
      void eventsQuery.refetch();
    },
  });

  const isLoading =
    messagesQuery.isLoading === true || eventsQuery.isLoading === true;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b px-4 py-3">
        <div className="text-sm font-medium">{thread.subject}</div>
        <div className="text-xs text-muted-foreground">
          {fromEmail === undefined ? thread.mailboxUuid : fromEmail}
          {" → "}
          {thread.toEmail}
        </div>
      </div>
      {isLoading === true ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <ScrollArea className="flex-1 p-4">
          <div className="flex flex-col gap-3">
            {conversation.map((entry) => {
              if (entry.type === "inbound") {
                return (
                  <Bubble
                    key={entry.key}
                    kind="inbound"
                    who={entry.event.actorEmail}
                    when={entry.event.occurredAt}
                    body={
                      entry.event.snippet === null ? "" : entry.event.snippet
                    }
                  />
                );
              }

              const message = entry.message;

              return (
                <Bubble
                  key={entry.key}
                  kind="outbound"
                  who={fromEmail === undefined ? "You" : fromEmail}
                  when={
                    message.sentAt === null
                      ? message.createdAt
                      : message.sentAt
                  }
                  body={
                    message.bodyText !== null
                      ? message.bodyText
                      : message.bodyHtml === null
                        ? ""
                        : message.bodyHtml
                  }
                />
              );
            })}
          </div>
        </ScrollArea>
      )}
      <div className="flex flex-col gap-2 border-t p-3">
        {send.isError === true ? (
          <p className="text-sm text-destructive">
            {send.error instanceof Error
              ? send.error.message
              : "The reply did not send."}
          </p>
        ) : null}
        <Textarea
          rows={4}
          placeholder="Write a reply"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <div className="flex justify-end">
          <Button
            disabled={draft.trim() === "" || send.isLoading === true}
            onClick={() => send.mutate()}
          >
            {send.isLoading === true ? "Sending…" : "Reply"}
          </Button>
        </div>
      </div>
    </div>
  );
};

const Bubble: React.FC<{
  kind: "outbound" | "inbound";
  who: string;
  when: string | Date;
  body: string;
}> = (props) => {
  const { kind, who, when, body } = props;
  const isOutbound = kind === "outbound";

  return (
    <div
      className={
        isOutbound === true
          ? "ml-8 rounded-md border bg-muted/40 p-3"
          : "mr-8 rounded-md border p-3"
      }
    >
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate font-medium text-foreground">{who}</span>
        <span className="shrink-0">{formatWhen(when)}</span>
      </div>
      <div className="whitespace-pre-wrap text-sm">{body}</div>
    </div>
  );
};
