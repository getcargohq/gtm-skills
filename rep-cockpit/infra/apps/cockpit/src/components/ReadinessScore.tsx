import { Badge } from "@cargo-ai/app-sdk";
import React from "react";

import { stageLabel, stageVariant } from "../lib/hot-accounts";
import { hasText } from "../lib/queries";

// The readiness score readiness-scoring keeps on the account: its stage and
// the number behind it. `explain` adds what the score is when there is none.
export const ReadinessScore: React.FC<{
  stage: string | null | undefined;
  score: number | string | null | undefined;
  explain?: boolean;
}> = ({ stage, score, explain }) => {
  if (!hasText(stage)) {
    if (explain === true) {
      return (
        <p className="text-sm text-muted-foreground">
          Not scored. Readiness scoring adds up recent signals, newer ones
          counting more, into a score every hour.
        </p>
      );
    }
    return <span className="text-sm text-muted-foreground">Not scored</span>;
  }
  return (
    <div className="flex items-center gap-2">
      <Badge variant={stageVariant(stage)} className="w-fit">
        {stageLabel(stage)}
      </Badge>
      {score === null || score === undefined ? null : (
        <span className="text-sm text-muted-foreground">
          Score {Math.round(Number(score))}
        </span>
      )}
    </div>
  );
};
