/**
 * Avoma — the adapter that has been run against a live workspace.
 *
 * It is the one to read first when you write a new one: the others in this
 * directory follow its shape, and where they differ it is because the vendor
 * differs, not because the pattern does.
 *
 * Verify the transcript response shape against the live API before you trust
 * any adapter here, including this one; the endpoints are stable and the field
 * names around them have moved. The one-line curl is in
 * `references/recorder-apis.md`, and `--dry-run` exercises `listReady` without
 * writing anything.
 */
import {
  fetchJson,
  HttpError,
  PACE_MS,
  recorderKey,
  sleep,
  type Call,
  type Recorder,
} from "../recorder";
import { renderTurns, type Turn } from "./turns";

const API = "https://api.avoma.com/v1";

// A function, not a const: the key is read when a request is made, because
// this module is imported on every run whatever recorder was selected.
const headers = (): Record<string, string> => ({
  Authorization: `Bearer ${recorderKey()}`,
});

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
        await fetchJson(next, { headers: headers() });
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
        headers: headers(),
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

    const turns: Turn[] = [];
    for (const entry of payload.transcript as Record<string, unknown>[]) {
      const text = entry["transcript"];
      if (typeof text !== "string") continue;
      turns.push({ speaker: speakers.get(String(entry["speaker_id"])), text });
    }

    return renderTurns(turns);
  },

  async notes(id) {
    await sleep(PACE_MS);

    let notes: { results?: { data?: unknown }[] };
    try {
      notes = await fetchJson(`${API}/notes/?meeting_uuid=${id}`, {
        headers: headers(),
      });
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
