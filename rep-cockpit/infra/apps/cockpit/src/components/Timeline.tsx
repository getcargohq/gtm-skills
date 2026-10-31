import { Badge, Spinner, useCargoApi } from "@cargo-ai/app-sdk";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarCheck,
  Linkedin,
  Mail,
  MessageSquareReply,
  Phone,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import React from "react";

import { sql } from "../lib/cargo";
import { orEmpty } from "../lib/drafts";
import { hasText, timelineQuery, type Activity } from "../lib/queries";

const kindLabel = (activity: Activity): string => {
  const subject = orEmpty(activity.subject);
  if (/^reply from/i.test(subject)) {
    return "Reply";
  }
  if (/^linkedin/i.test(subject)) {
    return "LinkedIn";
  }
  return activity.kind.charAt(0).toUpperCase() + activity.kind.slice(1);
};

const kindIcon = (kind: string): LucideIcon => {
  if (kind === "Reply") {
    return MessageSquareReply;
  }
  if (kind === "LinkedIn") {
    return Linkedin;
  }
  if (kind === "Email") {
    return Mail;
  }
  if (kind === "Meeting") {
    return CalendarCheck;
  }
  if (kind === "Call") {
    return Phone;
  }
  return StickyNote;
};

// "2026-10-31T07:04:16.000Z" -> "Oct 31, 07:04" in the rep's own time zone.
const whenLabel = (occurredAt: string): string => {
  const date = new Date(occurredAt);
  if (Number.isNaN(date.getTime())) {
    return occurredAt.slice(0, 10);
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Everything logged on the account, newest first, by any pipeline.
export const Timeline: React.FC<{ accountId: string }> = ({ accountId }) => {
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
        Nothing logged on this account yet. Your first send shows here.
      </p>
    );
  }
  return (
    <ol className="flex flex-col">
      {activities.data.map((activity, index) => {
        const kind = kindLabel(activity);
        const Icon = kindIcon(kind);
        return (
          <li
            key={`${activity.occurred_at}-${index}`}
            className="relative flex gap-4 pb-6 last:pb-0"
          >
            {index < activities.data.length - 1 ? (
              <span className="absolute left-4 top-9 h-[calc(100%-2.25rem)] w-px bg-border" />
            ) : null}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{activity.subject}</span>
                <span className="text-xs text-muted-foreground">
                  {whenLabel(activity.occurred_at)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{kind}</Badge>
                {hasText(activity.contact_name) ? (
                  <span>{activity.contact_name}</span>
                ) : null}
                {hasText(activity.owner_email) ? (
                  <span>by {activity.owner_email}</span>
                ) : null}
              </div>
              {hasText(activity.body) ? (
                <p className="line-clamp-3 whitespace-pre-line text-sm text-muted-foreground">
                  {activity.body}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
};
