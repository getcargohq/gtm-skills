import { defineMcpServer } from "@cargo-ai/cdk";

import { waterfall } from "../connectors/waterfall";
import { accounts } from "../models/accounts";
import { contacts } from "../models/contacts";
import { researcher } from "../agents/researcher";
import { accountBrief } from "../tools/brief";

// The GTM stack as tools, behind one MCP endpoint. Everything the server
// exposes is one `uses` array — the same surface as an agent: tools, agents,
// connector actions, and data models, each a handle the reconciler resolves.
// Any MCP client (Claude Code, Cursor, claude.ai) connects to it and gets:
//   - account-brief (tool): domain in, AE-ready brief out
//   - account-researcher (agent): free-form research questions
//   - waterfall enrichContact / verifyEmail (credits-based connector actions)
//   - accounts + contacts (data models, read-only)
export const gtmServer = defineMcpServer("gtm-copilot", {
  description:
    "GTM copilot: research briefs, contact lookup, and read access to accounts and contacts.",
  uses: [
    accountBrief,
    researcher,
    waterfall.actions.enrichContact,
    waterfall.actions.verifyEmail,
    { ref: accounts, readOnly: true },
    { ref: contacts, readOnly: true },
  ],
});
