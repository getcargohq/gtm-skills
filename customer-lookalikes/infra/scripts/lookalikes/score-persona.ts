// The persona score: arithmetic on what the finder and the verifier returned,
// with the points in `infra/settings.ts`. A script rather than an agent, so
// the same person always scores the same, the reason shows the sum, and no
// model call is paid to add three numbers.
//
// It also reads the verification safely. The verify node runs with
// `continueOnFailure`, so its output can be empty; an empty or unreadable
// verdict counts as not verified, never as valid.

import { defineScript } from "@cargo-ai/cdk";

import {
  newInSeatDays,
  newInSeatPoints,
  personaFloor,
  personaTierPoints,
  verifiedEmailPoints,
} from "../../settings";

type Verification = { email_status?: string; status?: string } | null;

const dayMs = 24 * 60 * 60 * 1000;

const readEmailStatus = (verification: Verification): string => {
  if (verification === null || typeof verification !== "object") {
    return "unknown";
  }
  const status = String(verification.email_status || verification.status || "");
  if (status.length === 0) {
    return "unknown";
  }
  return status.toLowerCase();
};

/** Whole days since the person took the seat, or -1 when the date is unknown. */
const daysInSeat = (startedRoleOn: string): number => {
  const startedMs = Date.parse(startedRoleOn);
  if (Number.isNaN(startedMs)) {
    return -1;
  }
  return Math.floor((Date.now() - startedMs) / dayMs);
};

export const scorePersona = defineScript(
  ({
    personaTier,
    verification,
    startedRoleOn,
  }: {
    personaTier: string;
    verification: Verification;
    startedRoleOn: string;
  }) => {
    const tier = String(personaTier || "reject");
    const emailStatus = readEmailStatus(verification);

    const tierPoints = personaTierPoints[tier] || 0;
    let emailPoints = 0;
    if (emailStatus === "valid") {
      emailPoints = verifiedEmailPoints;
    }
    const days = daysInSeat(String(startedRoleOn || ""));
    let seatPoints = 0;
    if (days >= 0 && days <= newInSeatDays) {
      seatPoints = newInSeatPoints;
    }
    const personaScore = tierPoints + emailPoints + seatPoints;

    const qualified =
      (tier === "1" || tier === "2") &&
      emailStatus === "valid" &&
      personaScore >= personaFloor;

    let seat = "seat date unknown";
    if (days >= 0) {
      seat = days + " days in seat";
    }
    const reason =
      "tier " +
      tier +
      " " +
      tierPoints +
      " + email " +
      emailStatus +
      " " +
      emailPoints +
      " + " +
      seat +
      " " +
      seatPoints +
      " = " +
      personaScore +
      ", floor " +
      personaFloor;

    let verdict = "qualified";
    if (emailStatus !== "valid") {
      verdict = "viable_email_not_verified";
    } else if (!qualified) {
      verdict = "viable_contact_not_qualified";
    }

    return {
      emailStatus: emailStatus,
      personaScore: personaScore,
      qualified: qualified,
      verdict: verdict,
      reason: reason,
    };
  },
);
