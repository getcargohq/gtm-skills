import { defineConnector } from "@cargo-ai/cdk";

// LinkedIn: the invite and the message a rep sends from the cockpit, as the
// rep's own LinkedIn identity. The Cargo Chrome extension captures it once per
// rep onto their Cargo user (`webExtensionData.edgesIdentityUid`), and the app
// reads it from the signed-in user: no rep table.
//
// Only `connectProfile` and `messageProfile` are used, and only by the
// LinkedIn send tool, on a rep's click.
export const linkedin = defineConnector("linkedin", {
  integration: "linkedin",
  default: true,
});
