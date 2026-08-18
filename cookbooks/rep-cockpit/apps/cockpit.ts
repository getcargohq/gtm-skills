import { defineApp } from "@cargo-ai/cdk";

import { accounts } from "../../base-gtm/models/accounts";

// The cockpit as a hosted Cargo app: the reconciler uploads the Vite bundle,
// the backend builds and promotes it, and the live URL lands on
// `repCockpit.url`. The accounts model uuid is baked into the build via env —
// a deploy-time token, so the app source carries no hardcoded ids.
export const repCockpit = defineApp("rep-cockpit", {
  path: new URL("./cockpit", import.meta.url).pathname,
  description:
    "Each rep's routed, scored accounts with the outreach draft and a next action that writes back.",
  env: {
    VITE_ACCOUNTS_MODEL_UUID: accounts.uuid as unknown as string,
  },
});
