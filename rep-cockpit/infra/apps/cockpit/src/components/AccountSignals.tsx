import { Spinner, useCargoApi } from "@cargo-ai/app-sdk";
import { useQuery } from "@tanstack/react-query";
import { Zap } from "lucide-react";
import React from "react";

import { sql } from "../lib/cargo";
import { accountSignalsQuery, hasText, type Signal } from "../lib/queries";
import { signalName, timeAgo } from "../lib/signals";

// Every signal on the account, newest first: what happened, when, the detail
// the source gave, and which feed it came from.
export const AccountSignals: React.FC<{ domain: string }> = ({ domain }) => {
  const api = useCargoApi();
  const signals = useQuery({
    queryKey: ["account-signals", domain],
    queryFn: () => sql<Signal>(api, accountSignalsQuery(domain)),
    staleTime: 10 * 60 * 1000,
  });

  if (signals.isLoading) {
    return <Spinner />;
  }
  if (signals.isError) {
    return <p className="text-sm text-destructive">{String(signals.error)}</p>;
  }
  if (signals.data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No signal recorded yet: no hire, funding, visit or engagement on file.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {signals.data.map((signal, index) => (
        <li
          key={`${signal.signal}-${signal.occurred}-${index}`}
          className="flex items-start gap-2 text-sm"
        >
          <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">{signalName(signal)}</span>
              <span
                className="shrink-0 text-xs text-muted-foreground"
                title={signal.occurred ?? ""}
              >
                {timeAgo(signal.occurred)}
              </span>
            </div>
            {hasText(signal.summary) ? (
              <p className="text-muted-foreground">{signal.summary}</p>
            ) : null}
            {hasText(signal.source) ? (
              <span className="text-xs text-muted-foreground">
                From {signal.source}
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
};
