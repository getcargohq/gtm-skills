/**
 * What has to hold about the recorder registry, checked on every run of
 * `npm run validate` (scripts/check-pipelines.mjs executes this file).
 *
 * Two kinds of assertion, and the first kind is why this file exists at all.
 *
 * The registry has one invariant that cannot be expressed in the type system
 * and whose violation is silent: a key must equal its recorder's `provider`,
 * because that slug is written into every capture's `source:` line and
 * compiled into the regex that reads those lines back. File an adapter under
 * the wrong key and nothing errors — the collector simply stops recognising
 * what it already captured and re-captures the window every morning until
 * someone notices the repository growing.
 *
 * The second kind pins each adapter against the field names in
 * `references/recorder-apis.md`, by serving one canned response shaped the way
 * that vendor documents and asserting what the adapter made of it. It cannot
 * prove the vendor's documentation is right — only `--dry-run` against a real
 * workspace does that. It does prove that a refactor has not quietly changed
 * which field an adapter reads, which is the regression that would otherwise
 * show up as a clean, empty, successful-looking run.
 *
 * No network: `fetch` is replaced, and an unrecognised URL fails the eval
 * rather than escaping to a vendor.
 */
import assert from "node:assert/strict";

// Read at module load in recorder.ts, so it has to be set before the import.
process.env["CALL_CAPTURE_PACE_MS"] = "0";
delete process.env["CALL_RECORDER"];
process.env["CALL_RECORDER_API_KEY"] = "test-key";

const { ConfigError, recorderKeyPair } = await import(
  "../scripts/collect/recorder.ts"
);
const { renderTurns } = await import("../scripts/collect/recorders/turns.ts");
const { RECORDERS, RECORDER_SLUGS, recorderTable, resolve } = await import(
  "../scripts/collect/recorders/index.ts"
);

const checks = [];
const check = (name, run) => checks.push([name, run]);

// ---------------------------------------------------------------- the registry

check("every registry key is its recorder's provider slug", () => {
  for (const [slug, entry] of Object.entries(RECORDERS)) {
    assert.equal(
      entry.recorder.provider,
      slug,
      `${slug} is filed under a recorder whose provider is "${entry.recorder.provider}": ` +
        `the dedup key and the source: line would drift apart`,
    );
  }
});

check("every entry carries what the CLI and a reader need", () => {
  for (const [slug, entry] of Object.entries(RECORDERS)) {
    for (const field of ["label", "credential", "docs"]) {
      assert.ok(
        typeof entry[field] === "string" && entry[field].length > 0,
        `${slug} has no ${field}`,
      );
    }
    assert.ok(
      ["live", "docs"].includes(entry.written),
      `${slug} has written: "${entry.written}", which is neither live nor docs`,
    );
    assert.match(entry.docs, /^https:\/\//, `${slug} has no docs URL`);
    for (const method of ["listReady", "transcript", "notes"]) {
      assert.equal(
        typeof entry.recorder[method],
        "function",
        `${slug} does not satisfy Recorder: ${method} is missing`,
      );
    }
  }
});

check("the shipped recorders are listed for a human to choose from", () => {
  const table = recorderTable();
  for (const slug of RECORDER_SLUGS) {
    assert.ok(table.includes(slug), `--list does not mention ${slug}`);
  }
  assert.ok(table.includes("CALL_RECORDER"), "--list does not say how to pick");
});

// ------------------------------------------------------------------ selection

check("no recorder selected stops the run", () => {
  assert.throws(() => resolve([]), ConfigError);
});

check("an unknown slug stops the run and names the alternatives", () => {
  assert.throws(
    () => resolve(["--recorder=zoom"]),
    (error) =>
      error instanceof ConfigError && error.message.includes("granola"),
  );
});

check("the flag overrides the environment for one run", () => {
  process.env["CALL_RECORDER"] = "avoma";
  try {
    assert.equal(resolve([]).entry.label, "Avoma");
    assert.equal(resolve(["--recorder=granola"]).entry.label, "Granola");
    // Typed by a human at a terminal, so the slug is not case-sensitive.
    assert.equal(resolve(["--recorder=Granola"]).recorder.provider, "granola");
  } finally {
    delete process.env["CALL_RECORDER"];
  }
});

check("a two-value credential splits on the first colon only", () => {
  process.env["CALL_RECORDER_API_KEY"] = "key:pa:ss";
  try {
    assert.deepEqual(recorderKeyPair("<a>:<b>"), ["key", "pa:ss"]);
  } finally {
    process.env["CALL_RECORDER_API_KEY"] = "test-key";
  }
  assert.throws(() => recorderKeyPair("<a>:<b>"), ConfigError);
});

// -------------------------------------------------------------------- shaping

check("consecutive segments from one speaker become one turn", () => {
  assert.equal(
    renderTurns([
      { speaker: "Ada", text: "Hello." },
      { speaker: "Ada", text: "One more thing." },
      { speaker: "Grace", text: "Noted." },
      { speaker: "Grace", text: "   " },
    ]),
    "**Ada:** Hello. One more thing.\n\n**Grace:** Noted.",
  );
  assert.equal(renderTurns([{ text: "unattributed" }]), "**Speaker:** unattributed");
  assert.equal(renderTurns([{ speaker: "Ada", text: "  " }]), null);
  assert.equal(renderTurns([]), null);
});

// ------------------------------------------------------------------- adapters
//
// One canned response per adapter, shaped the way the vendor documents it, and
// an assertion about what the adapter made of it.

const routes = new Map();
const seen = [];

globalThis.fetch = async (url, init = {}) => {
  const key = `${init.method ?? "GET"} ${String(url).split("?")[0]}`;
  seen.push({ url: String(url), init });
  const handler = routes.get(key);
  assert.ok(handler, `adapter called an unrouted endpoint: ${key}`);
  const body = await handler(String(url), init);
  return {
    ok: true,
    status: 200,
    headers: new Map(),
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
};

const route = (key, handler) => routes.set(key, handler);
const lastRequest = () => seen[seen.length - 1];
const header = (name) => {
  const headers = lastRequest().init.headers ?? {};
  return headers[name];
};

check("granola: thin list, detail for attendees, paged transcript", async () => {
  const { granola } = await import("../scripts/collect/recorders/granola.ts");
  routes.clear();
  route("GET https://public-api.granola.ai/v1/notes", (url) => {
    assert.ok(url.includes("created_after=2026-01-01T00%3A00%3A00Z"), url);
    return { notes: [{ id: "not_abc", title: "Acme call" }], hasMore: false };
  });
  route("GET https://public-api.granola.ai/v1/notes/not_abc", () => ({
    id: "not_abc",
    created_at: "2026-01-02T09:00:00Z",
    attendees: [{ name: "Ada", email: "ada@acme.com" }],
    summary_markdown: "## Summary\n\nThey liked it.",
  }));
  route(
    "GET https://public-api.granola.ai/v1/notes/not_abc/transcript",
    () => ({
      transcript: [
        { speaker: { name: "Ada" }, text: "We need SSO." },
        { speaker: { diarization_label: "Speaker B" }, text: "By when?" },
      ],
      hasMore: false,
    }),
  );

  const calls = await granola.listReady("2026-01-01", "2026-01-03");
  assert.deepEqual(calls, [
    {
      id: "not_abc",
      startAt: "2026-01-02T09:00:00Z",
      subject: "Acme call",
      attendees: [{ name: "Ada", email: "ada@acme.com" }],
    },
  ]);
  assert.equal(header("Authorization"), "Bearer test-key");
  assert.equal(
    await granola.transcript("not_abc"),
    "**Ada:** We need SSO.\n\n**Speaker B:** By when?",
  );
  // The summary came back on the detail fetch listReady already made.
  assert.equal(await granola.notes("not_abc"), "## Summary\n\nThey liked it.");
});

check("fathom: X-Api-Key, integer ids as strings, invitees as attendees", async () => {
  const { fathom } = await import("../scripts/collect/recorders/fathom.ts");
  routes.clear();
  route("GET https://api.fathom.ai/external/v1/meetings", () => ({
    items: [
      {
        recording_id: 8814,
        title: "Acme <> us",
        recording_start_time: "2026-01-02T15:00:00Z",
        calendar_invitees: [
          { name: "Ada", email: "ada@acme.com", is_external: true },
        ],
      },
      { recording_id: 8815, title: "no timestamp anywhere" },
    ],
    next_cursor: null,
  }));
  route(
    "GET https://api.fathom.ai/external/v1/recordings/8814/transcript",
    () => ({
      transcript: [
        { speaker: { display_name: "Ada" }, text: "Pricing is the issue." },
      ],
    }),
  );
  route("GET https://api.fathom.ai/external/v1/recordings/8814/summary", () => ({
    summary: { markdown_formatted: "- they want annual billing" },
  }));

  const calls = await fathom.listReady("2026-01-01", "2026-01-03");
  // The second meeting resolved to no timestamp, so it is dropped rather than
  // filed under today.
  assert.deepEqual(
    calls.map((call) => call.id),
    ["8814"],
  );
  assert.equal(header("X-Api-Key"), "test-key");
  assert.equal(
    await fathom.transcript("8814"),
    "**Ada:** Pricing is the issue.",
  );
  assert.equal(await fathom.notes("8814"), "- they want annual billing");
});

check("gong: basic pair, cursor only when more, speakerId joined to a party", async () => {
  const { gong } = await import("../scripts/collect/recorders/gong.ts");
  routes.clear();
  process.env["CALL_RECORDER_API_KEY"] = "ak:secret";
  try {
    let page = 0;
    route("POST https://api.gong.io/v2/calls/extensive", (_url, init) => {
      const body = JSON.parse(init.body);
      assert.equal(body.filter.fromDateTime, "2026-01-01T00:00:00Z");
      assert.equal(body.contentSelector.exposedFields.parties, true);
      page += 1;
      if (page === 1) {
        return {
          calls: [
            {
              metaData: {
                id: "7782342029982",
                started: "2026-01-02T10:00:00Z",
                title: "Acme discovery",
              },
              parties: [
                {
                  name: "Ada",
                  emailAddress: "ada@acme.com",
                  speakerId: "sp-1",
                  affiliation: "External",
                },
              ],
              content: { brief: "They evaluate us against Gong." },
            },
          ],
          records: { cursor: "page-2" },
        };
      }
      assert.equal(body.cursor, "page-2");
      return { calls: [], records: {} };
    });
    route("POST https://api.gong.io/v2/calls/transcript", (_url, init) => {
      assert.deepEqual(JSON.parse(init.body).filter.callIds, ["7782342029982"]);
      return {
        callTranscripts: [
          {
            callId: "7782342029982",
            transcript: [
              {
                speakerId: "sp-1",
                sentences: [{ text: "We looked at two others." }, { text: "Both lost." }],
              },
            ],
          },
        ],
      };
    });

    const calls = await gong.listReady("2026-01-01", "2026-01-03");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].id, "7782342029982");
    assert.equal(
      header("Authorization"),
      `Basic ${Buffer.from("ak:secret").toString("base64")}`,
    );
    assert.equal(
      await gong.transcript("7782342029982"),
      "**Ada:** We looked at two others. Both lost.",
    );
    assert.equal(
      await gong.notes("7782342029982"),
      "They evaluate us against Gong.",
    );
  } finally {
    process.env["CALL_RECORDER_API_KEY"] = "test-key";
  }
});

check("fireflies: a GraphQL 200 carrying errors is not an empty window", async () => {
  const { fireflies } = await import(
    "../scripts/collect/recorders/fireflies.ts"
  );
  routes.clear();
  let answer = () => ({ errors: [{ message: "invalid api key" }] });
  route("POST https://api.fireflies.ai/graphql", () => answer());

  await assert.rejects(
    () => fireflies.listReady("2026-01-01", "2026-01-03"),
    /invalid api key/,
  );

  answer = () => ({
    data: {
      transcripts: [
        {
          id: "ff-1",
          title: "Acme call",
          dateString: "2026-01-02T11:00:00Z",
          meeting_attendees: [{ displayName: "Ada", email: "ada@acme.com" }],
          meeting_info: { summary_status: "processed" },
        },
        {
          id: "ff-2",
          dateString: "2026-01-02T12:00:00Z",
          meeting_info: { summary_status: "processing" },
        },
      ],
    },
  });
  const calls = await fireflies.listReady("2026-01-01", "2026-01-03");
  // ff-2 is still being processed, so it is not ready.
  assert.deepEqual(
    calls.map((call) => call.id),
    ["ff-1"],
  );
});

check("clari: two headers, status filter, personId joined to a participant", async () => {
  const { clari } = await import("../scripts/collect/recorders/clari.ts");
  routes.clear();
  process.env["CALL_RECORDER_API_KEY"] = "key:password";
  try {
    route("GET https://rest-api.copilot.clari.com/calls", () => ({
      calls: [
        {
          id: "call-1",
          status: "PROCESSED",
          title: "Acme renewal",
          time: "2026-01-02T14:00:00Z",
          externalParticipants: [
            { name: "Ada", email: "ada@acme.com", personId: 4211 },
          ],
        },
        { id: "call-2", status: "UNABLE_TO_JOIN", time: "2026-01-02T15:00:00Z" },
      ],
      pagination: { hasMore: false },
    }));
    route("GET https://rest-api.copilot.clari.com/call-details", () => ({
      call: {
        id: "call-1",
        externalParticipants: [
          { name: "Ada", email: "ada@acme.com", personId: 4211 },
        ],
        transcript: [{ text: "Renewal is approved.", personId: 4211 }],
        summary: { full_summary: "Renewal approved, paperwork next week." },
      },
    }));

    const calls = await clari.listReady("2026-01-01", "2026-01-03");
    assert.deepEqual(
      calls.map((call) => call.id),
      ["call-1"],
    );
    assert.equal(header("X-Api-Key"), "key");
    assert.equal(header("X-Api-Password"), "password");
    assert.equal(
      await clari.transcript("call-1"),
      "**Ada:** Renewal is approved.",
    );
    // The detail response was cached by transcript(), so notes() is free.
    assert.equal(
      await clari.notes("call-1"),
      "Renewal approved, paperwork next week.",
    );
  } finally {
    process.env["CALL_RECORDER_API_KEY"] = "test-key";
  }
});

let failed = 0;
for (const [name, run] of checks) {
  try {
    await run();
    console.log(`ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}\n     ${error.message.split("\n").join("\n     ")}`);
  }
}

if (failed > 0) {
  console.error(`${failed} contract check(s) failed`);
  process.exit(1);
}
console.log(`${checks.length} contract checks passed`);
