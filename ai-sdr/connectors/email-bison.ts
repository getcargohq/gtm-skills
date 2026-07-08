import { defineConnector, secret } from "@cargo-ai/cdk";

// The sending tool. Email Bison runs on a dedicated instance URL per workspace,
// so `domain` is your instance (e.g. https://send.acme.com) and `apiKey` is the
// instance API key. Set EMAIL_BISON_API_KEY in your environment before deploy —
// `secret()` reads it at deploy time and keeps it out of the content hash.
export const emailBison = defineConnector("email_bison", {
  integration: "emailBison",
  config: {
    domain: "https://send.example.com", // PLACEHOLDER — your Email Bison instance URL
    apiKey: secret("EMAIL_BISON_API_KEY"),
  },
});
