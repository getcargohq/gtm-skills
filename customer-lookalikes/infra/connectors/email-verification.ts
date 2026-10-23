import { defineConnector } from "@cargo-ai/cdk";

// Cargo's email verification waterfall: one `verifyEmail` per contact the
// finder returns, before anything is written about that person as reachable.
// AI Ark's work email is a guess until a verifier says `valid`, and a guessed
// address that bounces costs the sending domain's reputation for everyone
// else on the list.
//
// Bound to the workspace's default connection, so nothing goes in `.env`.
export const emailVerification = defineConnector("email_verification", {
  integration: "waterfall",
  default: true,
});
