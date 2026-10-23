// The reply loop's executable contract: the graph boundaries schema
// validation cannot express, checked against the compiled resources, plus the
// deterministic scripts called directly.
//
// It loads through `loadResources`, the same loader `cargo-ai project check`,
// `plan`, and `deploy` use, so what is asserted here is what would deploy.
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadResources } from "@cargo-ai/cdk";

import { checkDraft } from "../infra/scripts/reply/check-draft.ts";
import { checkRow } from "../infra/scripts/reply/check-row.ts";
import { proposeSlots } from "../infra/scripts/reply/propose-slots.ts";
import { routeReply } from "../infra/scripts/reply/route-reply.ts";
import { screenReply } from "../infra/scripts/reply/screen-reply.ts";
import { routingRules } from "../infra/settings.ts";

const infraDir = fileURLToPath(new URL("../infra", import.meta.url));
const byId = new Map(
  (await loadResources(infraDir)).map((resource) => [resource.id, resource]),
);

assert.deepEqual(
  new Set(byId.keys()),
  new Set([
    "agent:reply_classifier",
    "agent:reply_writer",
    "connector:anthropic",
    "connector:slack",
    "domain:example-outreach.com",
    "folder:reply_handling_agents",
    "folder:reply_handling_mailboxes",
    "folder:reply_handling_models",
    "folder:reply_handling_plays",
    "mailbox:sender",
    "model:reply_threads",
    "play:handle_replies",
  ]),
  "reply-handling deploys one mailbox, one ledger model, two agents and one play, and nothing else",
);

const play = byId.get("play:handle_replies");
assert.equal(play.spec.modelUuid.resourceId, "model:reply_threads");
assert.deepEqual(
  play.spec.changeKinds,
  ["added"],
  "only an ADDED row may start a conversation: an update to the ledger must never re-send",
);
assert.equal(play.spec.isEnabled, false, "the play ships disabled");

const nodes = play.spec.nodes;
const byUuid = (uuid) => nodes.find((node) => node.uuid === uuid);
const reachableFrom = (node, seen = new Set()) => {
  if (node === undefined || seen.has(node.uuid)) return seen;
  seen.add(node.uuid);
  for (const child of node.childrenUuids) reachableFrom(byUuid(child), seen);
  return seen;
};
const only = (predicate, message) => {
  const matches = nodes.filter(predicate);
  assert.equal(matches.length, 1, message);
  return matches[0];
};
const isAgent = (slug) => (node) =>
  node.kind === "agent" && node.agentUuid.resourceId === `agent:${slug}`;
const scriptCalling = (name) => (node) =>
  node.actionSlug === "script" && node.config.script.includes(`return ${name}(`);
const expressionsOf = (node) => JSON.stringify(node.config);

// The wait keys off the first touch the play itself sent.
const wait = only(
  (node) => node.actionSlug === "waitEmailEvent",
  "one waitEmailEvent: the run sleeps on the first touch's thread",
);
assert.equal(wait.config.kind, "replied", "the wait is for a reply, not an open");
const afterWait = reachableFrom(wait);

// The hard stop runs before any model reads the reply.
const screen = only(scriptCalling("screenReply"), "one hard-stop script");
assert.ok(afterWait.has(screen.uuid), "the hard stop screens the reply");
const classifier = only(isAgent("reply_classifier"), "one classifier call");
assert.ok(
  reachableFrom(screen).has(classifier.uuid),
  "the classifier runs only after the hard stop",
);
for (const node of nodes.filter((node) => node.kind === "agent")) {
  if (!afterWait.has(node.uuid)) continue;
  assert.ok(
    reachableFrom(screen).has(node.uuid),
    `${node.slug} reads the reply, so it must come after the hard stop`,
  );
}
const hardStopBranch = byUuid(screen.childrenUuids[0]);
assert.equal(hardStopBranch.actionSlug, "branch");
assert.match(
  expressionsOf(hardStopBranch),
  /hardStop === true/,
  "the branch after the screen tests the hard stop",
);

// Every send goes out from the declared mailbox, never one a run computes.
const sends = nodes.filter((node) => node.actionSlug === "sendEmail");
assert.equal(sends.length, 3, "first touch, Reply Mode answer, approved answer");
for (const send of sends) {
  assert.equal(
    send.config.mailboxUuid.resourceId,
    "mailbox:sender",
    `${send.slug} must send from the declared mailbox`,
  );
}

// The answers thread under the reply, with the whole chain oldest first.
const answers = sends.filter((send) => afterWait.has(send.uuid));
assert.equal(answers.length, 2, "two answer paths after the wait");
for (const send of answers) {
  assert.match(
    JSON.stringify(send.config.inReplyTo),
    /inboundMessageId/,
    `${send.slug} sets inReplyTo to the reply's Message-ID`,
  );
  assert.equal(send.config.references.length, 2);
  assert.match(
    JSON.stringify(send.config.references[0]),
    /nodes\.sendEmail\.rfcMessageId/,
    `${send.slug} starts the references chain with the first touch`,
  );
}

// A person decides, and the decision is read from the node's own output.
const review = only(
  (node) => node.actionSlug === "humanReview",
  "one human review",
);
assert.equal(review.config.connectorUuid.resourceId, "connector:slack");
assert.ok(
  review.config.enabledButtons.includes("edit"),
  "the reviewer can edit the draft before approving it",
);
const decisionNode = byUuid(review.childrenUuids[0]);
assert.ok(
  review.childrenUuids.every((uuid) => uuid === decisionNode.uuid),
  "approve, decline and timeout all continue into the decision read",
);
assert.match(
  decisionNode.config.script,
  /nodes\.humanReview/,
  "the decision is read from the review node's output, not from the call's return value",
);
assert.match(decisionNode.config.script, /approved === true/);
const approvedSend = answers.find((send) => reachableFrom(review).has(send.uuid));
assert.ok(approvedSend, "the approved answer is sent after the review");

// No end node depends on `??`, which fails at run time.
for (const end of nodes.filter((node) => node.actionSlug === "end")) {
  assert.equal(
    expressionsOf(end).includes("??"),
    false,
    `${end.slug} must end on a literal status`,
  );
}

// Human Mode by default: nothing is answered without a click until someone
// switches a class in settings.ts, on purpose, in a reviewed diff.
assert.equal(
  Object.values(routingRules).includes("reply"),
  false,
  "no class sends without a click by default",
);
for (const replyClass of ["hard_stop", "spam", "out_of_office"]) {
  assert.equal(routingRules[replyClass], "suppress", `${replyClass} is never answered`);
}

// The writer reads the playbook; the classifier needs nothing but the reply.
const writer = byId.get("agent:reply_writer");
assert.ok(
  JSON.stringify(writer.spec.capabilities).includes("context"),
  "the writer reads the reply playbook from the workspace context",
);
for (const agentId of ["agent:reply_writer", "agent:reply_classifier"]) {
  const spec = byId.get(agentId).spec;
  for (const key of [
    "models",
    "tools",
    "connectorActions",
    "nativeActions",
    "subAgents",
  ]) {
    assert.equal(
      (spec[key] || []).length,
      0,
      `${agentId} has no ${key}: it sends nothing and writes nothing, the play does`,
    );
  }
}

// The scripts, called directly.
assert.equal(checkRow({ email: "pat@northwind.example", fact: "" }).ok, false);
assert.equal(checkRow({ email: "not an address", fact: "x" }).ok, false);
assert.equal(
  checkRow({ email: "pat@northwind.example", fact: "Opened a Denver office." }).ok,
  true,
);

const optOut = screenReply({
  reply: {
    snippet:
      "Please remove me from this list. On Tue, Nov 3, 2026 at 9:02 AM Alex Morgan wrote: hi there",
  },
  events: [{ inboundRfcMessageId: "<reply-1@northwind.example>" }],
});
assert.equal(optOut.hardStop, true);
assert.equal(optOut.text, "Please remove me from this list.");
assert.equal(optOut.inboundMessageId, "<reply-1@northwind.example>");
assert.equal(
  screenReply({ reply: { snippet: "Sounds good, Thursday works." }, events: [] })
    .hardStop,
  false,
);

const unsubscribed = routeReply({
  verdict: {
    reply_class: "positive",
    confidence: 0.9,
    compliance_flags: { unsubscribe_requested: true },
  },
  replyText: "",
  fallbackFirstName: "Pat",
});
assert.equal(unsubscribed.mode, "suppress", "an unsubscribe flag always suppresses");
assert.equal(
  routeReply({
    verdict: { reply_class: "something_new", confidence: 1 },
    replyText: "",
    fallbackFirstName: "Pat",
  }).mode,
  "human",
  "an unknown class goes to a person",
);

const emDash = String.fromCharCode(8212);
const draft = checkDraft({
  subject: "",
  bodyText: `Hi Pat ${emDash} Thursday at 2pm works, or Friday at 10am. As an AI I can help!`,
  usedSlots: ["2026-11-05T19:00:00.000Z"],
  offeredSlots: [{ startIso: "2026-11-05T14:00:00-05:00" }],
});
assert.equal(draft.bodyText.includes(emDash), false, "dashes never reach a lead");
assert.equal(draft.ok, false);
assert.match(draft.flags, /banned phrase: as an ai/);
assert.match(draft.flags, /exclamation mark/);
assert.equal(
  draft.flags.includes("slot not offered"),
  false,
  "a slot is compared as an instant, not as text",
);
assert.match(
  checkDraft({
    subject: "",
    bodyText: "Hi Pat, would Monday at 9am work for a call with me?",
    usedSlots: ["2026-11-09T09:00:00-05:00"],
    offeredSlots: [],
  }).flags,
  /slot not offered/,
  "a time the slot step never offered is flagged",
);

assert.equal(proposeSlots({ guidance: "", count: 0 }).slots.length, 0);
const thursday = proposeSlots({ guidance: "thursday afternoon", count: 3 });
assert.equal(thursday.slots.length, 3);
assert.match(thursday.slots[0].label, /^Thursday .* at 2pm$/);
for (const slot of thursday.slots) {
  const weekday = new Date(slot.startIso).getUTCDay();
  assert.ok(weekday >= 1 && weekday <= 5, "slots fall on weekdays");
  assert.ok(Date.parse(slot.startIso) > Date.now(), "slots are never in the past");
}

console.log("ok: reply-handling contract");
