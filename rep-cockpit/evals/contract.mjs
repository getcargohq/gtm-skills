import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resetRegistry, resources } from "@cargo-ai/cdk";

resetRegistry();
await import(`../infra/apps/cockpit.ts?contract=${Date.now()}`);
await import(`../infra/members/reps.ts?contract=${Date.now()}`);

const all = resources();
const byId = new Map(all.map((resource) => [resource.id, resource]));

const nodeSlugs = (tool) => {
  return JSON.stringify(tool.spec.nodes);
};

// The claim: one tool run that searches, enriches, drafts and closes the claim.
const claim = byId.get("tool:rep_cockpit_claim_account");
assert.ok(claim, "the claim tool must exist");
const claimGraph = nodeSlugs(claim);
assert.ok(
  claimGraph.includes('"searchPeople"'),
  "the claim must search the buying committee",
);
assert.ok(
  claimGraph.includes('"group"'),
  "the claim must loop over the people it found",
);
assert.ok(
  claimGraph.includes('"findEmail"'),
  "the claim must look up each person's email",
);
assert.ok(
  claimGraph.includes("rep_cockpit_first_touch_writer") ||
    claimGraph.includes("agent:rep_cockpit_first_touch_writer"),
  "the claim must draft with the first-touch writer",
);
assert.equal(
  claimGraph.includes('"sendEmail"'),
  false,
  "a claim must never send: the rep sends, one click per email",
);

// The send: the email, the draft marked sent, the activity row, in one run.
const send = byId.get("tool:rep_cockpit_send_draft");
assert.ok(send, "the send tool must exist");
const sendGraph = nodeSlugs(send);
for (const slug of ["sendEmail", "modelUpsert", "modelInsert"]) {
  assert.ok(sendGraph.includes(`"${slug}"`), `the send must run ${slug}`);
}

// Nothing sends on a schedule.
assert.equal(
  all.some((resource) => resource.kind === "play"),
  false,
  "no play: every send is a rep's click",
);

// The writer judges, the tool persists.
const writer = byId.get("agent:rep_cockpit_first_touch_writer");
assert.ok(writer, "the first-touch writer must exist");
const writerSpec = JSON.stringify(writer.spec);
assert.equal(
  writerSpec.includes("webSearch"),
  false,
  "the writer must not search the web",
);
assert.equal(
  (writer.spec.models ?? []).length,
  0,
  "the writer must not be handed a model to write",
);

// The app is wired to the ids it calls through env, not hard-coded uuids.
const app = byId.get("app:rep-cockpit");
assert.ok(app, "the app must exist");
for (const [key, resourceId] of [
  ["VITE_CLAIM_TOOL_UUID", "tool:rep_cockpit_claim_account"],
  ["VITE_SEND_TOOL_UUID", "tool:rep_cockpit_send_draft"],
  ["VITE_CLAIMS_MODEL_UUID", "model:cockpit_claims"],
]) {
  assert.equal(
    app.spec.env[key].resourceId,
    resourceId,
    `${key} must be the ${resourceId} token`,
  );
}

// Each rep's mailbox is attached to their member.
const members = all.filter((resource) => resource.kind === "member");
assert.ok(members.length > 0, "at least one rep member must be declared");
for (const member of members) {
  assert.ok(
    member.spec.mailboxUuids.length > 0,
    `${member.id} must have a mailbox to send from`,
  );
}

// Claims are keyed by domain, one row per account.
const claimsColumns = byId
  .get("model:cockpit_claims")
  .spec.config.columns.map((column) => column.slug);
assert.ok(claimsColumns.includes("account_domain"));

// The app never hard-codes a rep table or a mailbox.
const repSource = readFileSync(
  new URL("../infra/apps/cockpit/src/lib/rep.ts", import.meta.url),
  "utf8",
);
assert.ok(
  repSource.includes("revenueOrganization.member"),
  "the app must find the rep's mailbox on their member",
);

console.log("rep-cockpit contract: ok");
