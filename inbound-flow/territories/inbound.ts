import { defineTerritory, memberRef } from "@cargo-ai/cdk";

// The rep pool inbound leads route to. Members are workspace users, referenced
// by uuid (`memberRef`) with routing weights — a weight of 2 gets twice the
// share. The fallback catches leads when no member is available.
//
// PLACEHOLDER — replace the uuids with your workspace member uuids
// (Workspace settings → Members).
export const inboundTerritory = defineTerritory("inbound-reps", {
  color: "green",
  description: "AEs taking inbound demo requests",
  members: [
    { ref: memberRef("00000000-0000-0000-0000-000000000001"), weight: 1 },
    { ref: memberRef("00000000-0000-0000-0000-000000000002"), weight: 1 },
  ],
  fallback: memberRef("00000000-0000-0000-0000-000000000001"),
});
