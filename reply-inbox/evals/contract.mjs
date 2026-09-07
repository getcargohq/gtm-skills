import assert from "node:assert/strict";
import { resetRegistry, resources } from "@cargo-ai/cdk";

resetRegistry();
await import(`../infra/folders/index.ts?contract=${Date.now()}`);
await import(`../infra/apps/inbox.ts?contract=${Date.now()}`);

const byId = new Map(resources().map((resource) => [resource.id, resource]));

assert.ok(
  byId.get("folder:reply-inbox-apps"),
  "defineFolder(reply-inbox-apps) must exist",
);
const folder = byId.get("folder:reply-inbox-apps");
assert.equal(
  folder.spec.folderKind,
  "app",
  "the folder must be kind app",
);

const app = byId.get("app:reply-inbox");
assert.ok(app, "defineApp(reply-inbox) must exist");
assert.equal(
  app.spec.folderUuid !== undefined,
  true,
  "the app must file under the skill's app folder",
);

assert.equal(
  [...byId.keys()].some((id) => id.startsWith("mailbox:")),
  false,
  "this skill must not provision mailboxes",
);
assert.equal(
  [...byId.keys()].some((id) => id.startsWith("agent:")),
  false,
  "this skill must not deploy an agent — that is agentic-engagement",
);
assert.equal(
  [...byId.keys()].some((id) => id.startsWith("tool:")),
  false,
  "sendEmail must be called from the app, not wrapped in a tool",
);

console.log("ok: reply-inbox contract");
