// The ids this app calls, baked into the bundle by `defineApp`'s `env` in
// `../cockpit.ts`. The Cargo variables (workspace, OAuth, API URL) are read by
// the SDK through `getCargoEnv()`; these three are the app's own.
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
export const claimsModelUuid = readEnv("VITE_CLAIMS_MODEL_UUID");
