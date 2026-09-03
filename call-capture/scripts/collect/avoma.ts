/**
 * The Avoma adapter: the one worked implementation of `Recorder`.
 *
 * This is the file a coding agent replaces to support a different recorder.
 * It is the whole surface — auth, endpoints, pagination, readiness, response
 * shapes — and nothing outside it needs to change. `references/providers.md`
 * carries Gong and Fireflies against this same contract.
 *
 * Verify the transcript response shape against the live API before you trust
 * it; the endpoint is stable and the field names around it have moved. The
 * one-line check is in that reference, and `--dry-run` exercises `listReady`
 * without writing anything.
 */
import {
  fetchJson,
  HttpError,
  PACE_MS,
  sleep,
  type Call,
  type Recorder,
} from "./recorder";

const API = "https://api.avoma.com/v1";

const API_KEY = process.env["CALL_RECORDER_API_KEY"];
if (API_KEY === undefined || API_KEY === "") {
  console.error(
    "CALL_RECORDER_API_KEY is not set. It comes from the agent's repository env " +
      "in infra/call-capture/agents/call-scribe.ts; export it locally to run this by hand.",
  );
  process.exit(1);
}

const headers = { Authorization: `Bearer ${API_KEY}` };

type AvomaCall = {
  uuid: string;
  attendees?: { email?: string; name?: string }[];
  transcript_ready?: boolean;
  notes_ready?: boolean;
  state?: string;
  start_at: string;
  subject?: string;
};

/** Walk a nested block structure and pull out every string of text. */
function blocksToText(node: unknown, out: string[]): void {
  if (Array.isArray(node)) {
    for (const item of node) blocksToText(item, out);
    return;
  }
  if (node === null || typeof node !== "object") return;

  const block = node as Record<string, unknown>;
  if (typeof block["text"] === "string") out.push(block["text"]);
  if (Array.isArray(block["children"])) blocksToText(block["children"], out);
  if (block["object"] === "block") out.push("\n");
}

export const avoma: Recorder = {
  provider: "avoma",

  async listReady(from, to) {
    // from_date and to_date are both required, which is why the window is
    // computed at run time rather than baked into a static URL.
    let next: string | null =
      `${API}/meetings/?from_date=${from}T00:00:00Z` +
      `&to_date=${to}T23:59:59Z&page_size=100`;
    const raw: AvomaCall[] = [];

    while (next !== null) {
      const page: { results?: AvomaCall[]; next?: string | null } =
        await fetchJson(next, { headers });
      raw.push(...(page.results ?? []));
      next = page.next ?? null;
    }

    // `transcript_ready` and `notes_ready` are false until processing
    // finishes, and ABSENT rather than false on anything not yet held. That is
    // the whole reason the pipeline's window overlaps the previous run.
    //
    // `is_internal` is deliberately not used: some workspaces return false on
    // every meeting, including all-internal ones. The pipeline derives that
    // from attendee domains instead.
    return raw
      .filter(
        (call) =>
          call.state === "completed" &&
          (call.transcript_ready === true || call.notes_ready === true),
      )
      .map((call): Call => ({
        id: call.uuid,
        startAt: call.start_at,
        subject: call.subject ?? "call",
        attendees: call.attendees ?? [],
      }));
  },

  async transcript(id) {
    await sleep(PACE_MS);

    let payload: { transcript?: unknown; speakers?: unknown };
    try {
      payload = await fetchJson(`${API}/transcriptions/?meeting_uuid=${id}`, {
        headers,
      });
    } catch (error) {
      if (error instanceof HttpError) {
        console.error(`transcript ${id} unavailable (${error.status})`);
        return null;
      }
      throw error;
    }

    const speakers = new Map<string, string>();
    if (Array.isArray(payload.speakers)) {
      for (const entry of payload.speakers as Record<string, unknown>[]) {
        const speakerId = entry["id"];
        const name = entry["name"];
        if (speakerId !== undefined && typeof name === "string") {
          speakers.set(String(speakerId), name);
        }
      }
    }

    if (!Array.isArray(payload.transcript)) return null;

    const lines: string[] = [];
    for (const entry of payload.transcript as Record<string, unknown>[]) {
      const text = entry["transcript"];
      if (typeof text !== "string" || text.trim() === "") continue;
      const speaker = speakers.get(String(entry["speaker_id"])) ?? "Speaker";
      lines.push(`**${speaker}:** ${text.trim()}`);
    }

    return lines.length > 0 ? lines.join("\n\n") : null;
  },

  async notes(id) {
    await sleep(PACE_MS);

    let notes: { results?: { data?: unknown }[] };
    try {
      notes = await fetchJson(`${API}/notes/?meeting_uuid=${id}`, { headers });
    } catch (error) {
      if (error instanceof HttpError) {
        console.error(`notes ${id} unavailable (${error.status})`);
        return null;
      }
      throw error;
    }

    const parts: string[] = [];
    for (const result of notes.results ?? []) blocksToText(result.data, parts);
    return (
      parts
        .join("")
        .replace(/\n{3,}/g, "\n\n")
        .trim() || null
    );
  },
};
