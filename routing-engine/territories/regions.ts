import { defineTerritory, memberRef } from "@cargo-ai/cdk";

// Two regional rep pools with routing weights and fallbacks — the assignment
// rules as versioned code. PLACEHOLDER — replace the uuids with your workspace
// member uuids (Workspace settings → Members).
export const amer = defineTerritory("amer", {
  color: "green",
  description: "AMER accounts",
  members: [
    { ref: memberRef("00000000-0000-0000-0000-000000000001"), weight: 2 },
    { ref: memberRef("00000000-0000-0000-0000-000000000002"), weight: 1 },
  ],
  fallback: memberRef("00000000-0000-0000-0000-000000000001"),
});

export const emea = defineTerritory("emea", {
  color: "purple",
  description: "EMEA accounts",
  members: [
    { ref: memberRef("00000000-0000-0000-0000-000000000003"), weight: 1 },
  ],
  fallback: memberRef("00000000-0000-0000-0000-000000000003"),
});
