// Which record in a duplicate cluster survives the merge.

import { SURVIVOR_PRECEDENCE } from "./policy";
import type { CrmRecord } from "./records";

/**
 * The cluster, survivor first. `SURVIVOR_PRECEDENCE` decides; records it leaves
 * tied prefer recent activity, then the older record, then the lower ID — so
 * two runs over one cluster can never disagree.
 */
export const rankSurvivors = (cluster: CrmRecord[]): CrmRecord[] => {
  return cluster.slice().sort((left, right) => {
    for (const scoreOf of SURVIVOR_PRECEDENCE) {
      const difference = scoreOf(right) - scoreOf(left);
      if (difference !== 0) {
        return difference;
      }
    }

    const byActivity = compareText(right.lastActivityAt, left.lastActivityAt);
    if (byActivity !== 0) {
      return byActivity;
    }

    const byAge = compareText(left.createdAt, right.createdAt);
    if (byAge !== 0) {
      return byAge;
    }

    return left.id.localeCompare(right.id);
  });
};

// An absent value orders before any present one, exactly as the empty string it
// replaced did. That means a record with no creation date wins "oldest" — kept
// as-is, since changing it would change which record survives.
const compareText = (
  left: string | undefined,
  right: string | undefined,
): number => {
  return (left === undefined ? "" : left).localeCompare(
    right === undefined ? "" : right,
  );
};
