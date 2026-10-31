// The ids this app calls, baked into the bundle by `defineApp`'s `env` in
// `../cockpit.ts`. The Cargo variables (workspace, OAuth, API URL) are read by
// the SDK through `getCargoEnv()`; these are the app's own.
const readEnv = (key: string): string => {
  const value = (import.meta as unknown as { env: Record<string, string> }).env[
    key
  ];
  if (value === undefined || value === "") {
    throw new Error(
      `${key} is not set. It is injected by defineApp's env on deploy; for local dev, add it to .env.local.`,
    );
  }
  return value;
};

export const claimToolUuid = readEnv("VITE_CLAIM_TOOL_UUID");
export const sendToolUuid = readEnv("VITE_SEND_TOOL_UUID");
export const linkedinToolUuid = readEnv("VITE_LINKEDIN_TOOL_UUID");
export const redraftToolUuid = readEnv("VITE_REDRAFT_TOOL_UUID");
export const enrichToolUuid = readEnv("VITE_ENRICH_TOOL_UUID");
export const claimsModelUuid = readEnv("VITE_CLAIMS_MODEL_UUID");
export const draftsModelUuid = readEnv("VITE_DRAFTS_MODEL_UUID");
export const activitiesModelUuid = readEnv("VITE_ACTIVITIES_MODEL_UUID");

// Why a rep passes on a Hot lead. A pass with `parkDays` comes back to Hot
// leads after that many days; the others stay passed until someone releases
// the account. Read together, the reasons say what the queue gets wrong.
export type PassReason = {
  slug: "no_fit" | "not_now" | "in_touch";
  label: string;
  parkDays: number | undefined;
};

export const passReasons: PassReason[] = [
  { slug: "no_fit", label: "No fit", parkDays: undefined },
  { slug: "not_now", label: "Not now, back in 90 days", parkDays: 90 },
  { slug: "in_touch", label: "Already in touch", parkDays: undefined },
];
