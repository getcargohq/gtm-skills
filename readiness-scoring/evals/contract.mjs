// The boundaries schema validation cannot express, checked against the
// compiled registry. `cargo-ai project check` proves the resources are well formed;
// this proves they are still the pipeline this skill describes after an agent
// has adapted them.
//
// Run it from the skill folder after every adaptation:
//   node --import tsx evals/contract.mjs
import assert from "node:assert/strict";
import { resetRegistry, resources } from "@cargo-ai/cdk";

resetRegistry();
const stamp = Date.now();
const { signals, readyThreshold, warmingThreshold, horizonDays } = await import(
  `../infra/settings.ts?contract=${stamp}`
);
await import(`../infra/models/signal-feeds.ts?contract=${stamp}`);
await import(`../infra/models/account-events.ts?contract=${stamp}`);
await import(`../infra/plays/route-ready-accounts.ts?contract=${stamp}`);
await import(`../infra/segments/readiness.ts?contract=${stamp}`);

const byId = new Map(resources().map((resource) => [resource.id, resource]));

const get = (id) => {
  const resource = byId.get(id);
  assert.ok(resource, `${id} must exist`);
  return resource;
};

const cronMinute = (schedule, what) => {
  assert.equal(schedule?.type, "cron", `${what} must run on a cron`);
  const minute = Number(schedule.cron.split(" ")[0]);
  assert.ok(
    Number.isInteger(minute),
    `${what} must run at a fixed minute so the three steps stay in order`,
  );
  return minute;
};

// ---------------------------------------------------------------------------
// Settings: the weights decide, and the lines are in their unit.
// ---------------------------------------------------------------------------
const signalTypes = Object.keys(signals);
assert.ok(signalTypes.length > 0, "settings.ts must weigh at least one signal");
for (const [type, signal] of Object.entries(signals)) {
  assert.match(
    type,
    /^[a-z0-9_]+$/,
    `signal "${type}" must be a bare signal type or model slug: it is inlined into the query as a string literal`,
  );
  assert.ok(
    signal.weight > 0,
    `signal "${type}" must weigh more than 0: a type that should not count is deleted from signals, where unknown types already weigh 0`,
  );
  assert.ok(
    signal.halfLifeDays > 0,
    `signal "${type}" must have a positive half-life: the decay divides by it`,
  );
}
assert.ok(
  readyThreshold > warmingThreshold && warmingThreshold > 0,
  "readyThreshold must be above warmingThreshold, and both above 0: otherwise a stage is empty or every account is in it",
);

// ---------------------------------------------------------------------------
// The score is a query over Account Events, recomputed on a schedule. Decay
// happens at read time; nothing writes a score.
// ---------------------------------------------------------------------------
const accountEvents = get("model:account_events").spec;
assert.equal(
  accountEvents.extractorSlug,
  "unifyAccountEvents",
  "account_events must be the workspace's Unify Account Events, adopted: any other extractor under that slug collides with it",
);

const scores = get("model:readiness_scores").spec;
assert.equal(
  scores.extractorSlug,
  "defineQuery",
  "readiness_scores must be a native query model: a score written onto rows by a play stops decaying between signals",
);
assert.equal(
  scores.config.idColumnSlug,
  "account_id",
  "readiness_scores must be keyed by account_id: the play's added diff runs on the id, and any other key re-posts accounts",
);
const query = scores.config.query;
assert.match(
  query,
  /from object\.account_events\b/,
  "the score must read object.account_events: every feed reaches the score by unifying there, with no edit to the query",
);
assert.match(
  query,
  /current_timestamp\(\)/,
  "the score must compute the age at query time: an age stored on the event never moves",
);
assert.match(
  query,
  /exp\(-ln\(2\) \* age_days \/ half_life_days\)/,
  "the score must decay by half-life: weight × 0.5 ^ (age / half-life)",
);
assert.match(
  query,
  /else 0 end as weight/,
  "a signal type that settings.ts does not weigh must weigh 0: otherwise a new feed moves every score before anyone decided what it is worth",
);
assert.match(
  query,
  /select distinct/,
  "events must be deduplicated per account, type and day: the same round from two feeds otherwise counts twice",
);
assert.ok(
  query.includes(`interval ${horizonDays} day`),
  "the query must cut at horizonDays from settings.ts: without it the hourly rebuild scans every event ever recorded",
);
for (const type of signalTypes) {
  assert.ok(
    query.includes(`when '${type}' then ${signals[type].weight}`) &&
      query.includes(`when '${type}' then ${signals[type].halfLifeDays}`),
    `the query must carry the weight and half-life of "${type}" from settings.ts`,
  );
}
assert.ok(
  query.includes(`>= ${readyThreshold} then 'ready_now'`) &&
    query.includes(`>= ${warmingThreshold} then 'warming'`),
  "the stage must come from the thresholds in settings.ts",
);

// ---------------------------------------------------------------------------
// Feeds: company signals, on a watchlist, into Account Events.
// ---------------------------------------------------------------------------
const feeds = [...byId.values()].filter(
  (resource) =>
    resource.id.startsWith("model:") &&
    typeof resource.spec.extractorSlug === "string" &&
    resource.spec.extractorSlug.startsWith("listen"),
);
assert.ok(feeds.length > 0, "the skill must carry at least one signal feed");
for (const feed of feeds) {
  assert.equal(
    feed.spec.config?.scope?.kind,
    "watchlist",
    `${feed.id} must watch a list of accounts: market scope bills for every event in the market, most of them on companies no account model holds`,
  );
  assert.equal(
    feed.spec.unification?.type,
    "accountEvent",
    `${feed.id} must unify as an account event: an event that lands in Contact Events never reaches the score`,
  );
  assert.ok(
    feed.spec.config?.advancedSettings?.dailyLeadLimit > 0,
    `${feed.id} must cap deliveries per day: the first delivery on a new watchlist looks back months`,
  );
}

// ---------------------------------------------------------------------------
// The play posts once per climb, after the score it reads.
// ---------------------------------------------------------------------------
const play = get("play:route_ready_accounts").spec;
assert.equal(
  play.modelUuid?.resourceId,
  "model:readiness_scores",
  "the play must run on readiness_scores",
);
assert.deepEqual(
  play.changeKinds,
  ["added"],
  "the play must create runs only for accounts entering ready_now: without it every ready account is posted every hour",
);
assert.equal(play.isEnabled, false, "the first plan must ship the play disabled");
const playConditions = play.filter.groups.flatMap((group) => group.conditions);
assert.ok(
  playConditions.length === 1 &&
    playConditions[0].columnSlug === "stage" &&
    playConditions[0].values?.join() === "ready_now",
  "the play must filter on stage = ready_now, never on the raw score: the threshold lives in settings.ts and only reaches the play through stage",
);

const eventsMinute = cronMinute(accountEvents.schedule, "account_events");
const scoresMinute = cronMinute(scores.schedule, "readiness_scores");
const playMinute = cronMinute(play.schedule, "the play");
assert.ok(
  eventsMinute < scoresMinute && scoresMinute < playMinute,
  "Account Events must sync before the score rebuilds, and the score before the play reads it: out of order, each tick acts on the previous hour",
);

const connectorNodes = play.nodes.filter((node) => node.kind === "connector");
assert.equal(
  connectorNodes.length,
  1,
  "the play must contain exactly one connector node, the Slack post: anything else is a per-account action nobody approved",
);
assert.equal(connectorNodes[0].integrationSlug, "slack");

// ---------------------------------------------------------------------------
// Segments view the stages the query emits.
// ---------------------------------------------------------------------------
const segments = [...byId.values()].filter((resource) =>
  resource.id.startsWith("segment:"),
);
const segmentStages = new Set();
for (const segment of segments) {
  const conditions = segment.spec.filter.groups.flatMap(
    (group) => group.conditions,
  );
  assert.equal(
    conditions.every((condition) => condition.columnSlug === "stage"),
    true,
    `${segment.id} filters on something other than stage: a threshold restated in a segment drifts from settings.ts`,
  );
  for (const condition of conditions) {
    for (const value of condition.values ?? []) segmentStages.add(value);
  }
}
assert.deepEqual(
  [...segmentStages].sort(),
  ["ready_now", "warming"],
  "there must be one segment for ready_now and one for warming",
);

assert.equal(
  [...byId.keys()].some((id) => id.startsWith("agent:")),
  false,
  "this skill must declare no agent: the score is arithmetic, and an LLM per account per hour is a bill with no judgment in it",
);

console.log(
  "ok: the score decays at read time from Account Events, the feeds watch a list, and the play posts once per climb after the score it reads",
);
