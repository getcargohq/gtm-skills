import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resetRegistry, resources } from "@cargo-ai/cdk";

resetRegistry();
await import(`../infra/apps/cockpit.ts?contract=${Date.now()}`);
await import(`../infra/members/reps.ts?contract=${Date.now()}`);
await import(`../infra/plays/watch-replies.ts?contract=${Date.now()}`);

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

// Inside the per-person loop, `input` is the person, not the tool's input: a
// loop that reads `input.account_domain` sends an empty domain to every lookup.
const claimSource = readFileSync(
  new URL("../infra/tools/claim-account.ts", import.meta.url),
  "utf8",
);
const loopStart = claimSource.indexOf("for (const person of people)");
const loopBody = claimSource.slice(
  loopStart,
  claimSource.indexOf("modelUuid: cockpitClaims.uuid", loopStart),
);
assert.equal(
  loopBody.includes("input."),
  false,
  "the loop must read the claim from the claim row's output, never from input",
);

// The send: the email, the draft marked sent, the activity row, in one run.
const send = byId.get("tool:rep_cockpit_send_draft");
assert.ok(send, "the send tool must exist");
const sendGraph = nodeSlugs(send);
for (const slug of ["sendEmail", "modelUpsert", "modelInsert"]) {
  assert.ok(sendGraph.includes(`"${slug}"`), `the send must run ${slug}`);
}

// A follow-up threads under the email before it.
assert.ok(
  sendGraph.includes("inReplyTo"),
  "a follow-up must be sent as a reply in its thread",
);

// Nothing sends on a schedule: the one play waits for replies and drafts.
const plays = all.filter((resource) => resource.kind === "play");
assert.equal(plays.length, 1, "one play: the reply watch");
const watchGraph = JSON.stringify(plays[0].spec);
assert.ok(
  watchGraph.includes('"waitEmailEvent"'),
  "the play must wait on the thread for a reply",
);
assert.equal(
  watchGraph.includes('"sendEmail"'),
  false,
  "the play must never send: every send is a rep's click",
);
assert.ok(
  watchGraph.includes("rep_cockpit_first_touch_writer"),
  "the play must draft the follow-up with the writer",
);

// LinkedIn goes out from one tool, on a rep's click, never from the claim, the
// play or a rewrite.
const sendLinkedin = byId.get("tool:rep_cockpit_send_linkedin");
assert.ok(sendLinkedin, "the LinkedIn send tool must exist");
for (const slug of ["connectProfile", "messageProfile", "modelInsert"]) {
  assert.ok(
    nodeSlugs(sendLinkedin).includes(`"${slug}"`),
    `the LinkedIn send must run ${slug}`,
  );
}
for (const [label, graph] of [
  ["claim", claimGraph],
  ["play", watchGraph],
]) {
  for (const slug of ["connectProfile", "messageProfile"]) {
    assert.equal(
      graph.includes(`"${slug}"`),
      false,
      `the ${label} must never send on LinkedIn`,
    );
  }
}
assert.ok(
  JSON.stringify(byId.get("agent:rep_cockpit_first_touch_writer").spec).includes(
    "linkedin_note",
  ),
  "the writer must draft the LinkedIn note with the email",
);

// Regenerate and Find email and phone are tool runs, never connector calls
// from the browser.
const redraft = byId.get("tool:rep_cockpit_redraft");
assert.ok(redraft, "the redraft tool must exist");
assert.equal(
  nodeSlugs(redraft).includes('"sendEmail"'),
  false,
  "a redraft must never send",
);
const enrich = byId.get("tool:rep_cockpit_enrich_contact");
assert.ok(enrich, "the enrich tool must exist");
for (const slug of ["findEmail", "findPhone"]) {
  assert.ok(
    nodeSlugs(enrich).includes(`"${slug}"`),
    `the enrich tool must run ${slug}`,
  );
}

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
  ["VITE_LINKEDIN_TOOL_UUID", "tool:rep_cockpit_send_linkedin"],
  ["VITE_REDRAFT_TOOL_UUID", "tool:rep_cockpit_redraft"],
  ["VITE_ENRICH_TOOL_UUID", "tool:rep_cockpit_enrich_contact"],
  ["VITE_CLAIMS_MODEL_UUID", "model:cockpit_claims"],
  ["VITE_DRAFTS_MODEL_UUID", "model:cockpit_drafts"],
  ["VITE_ACTIVITIES_MODEL_UUID", "model:gtm_activities"],
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
