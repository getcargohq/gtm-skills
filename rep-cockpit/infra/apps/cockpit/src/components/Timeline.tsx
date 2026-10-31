import { Badge, Spinner, useCargoApi } from "@cargo-ai/app-sdk";
import { useQuery } from "@tanstack/react-query";
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
    <ol className="flex flex-col gap-4 border-l pl-4">
      {activities.data.map((activity, index) => (
        <li key={`${activity.occurred_at}-${index}`} className="text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{kindLabel(activity)}</Badge>
            <span className="text-xs text-muted-foreground">
              {activity.occurred_at.slice(0, 10)}
              {hasText(activity.contact_name)
                ? ` · ${activity.contact_name}`
                : ""}
            </span>
          </div>
          <div className="mt-1 font-medium">{activity.subject}</div>
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
