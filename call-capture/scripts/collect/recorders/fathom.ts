/**
 * Fathom. Written from the vendor's own API reference, not yet run against a
 * live workspace: check it with `--dry-run` before you deploy it.
 *
 * The API is on every plan including the free one, which makes this the
 * cheapest of the recorders here to try the pipeline against.
 *
 * Three things to know.
 *
 * Auth is `X-Api-Key`, not `Authorization` — a Bearer header here fails as
 * unauthenticated no matter how correct the key is.
 *
 * The rate limit is two limits. 60 requests a minute in general, but 30 for
 * "heavy" ones, which is every `/recordings/…` call — so both transcript and
 * summary are heavy, and the pace floor below is 2s rather than the pipeline's
 * default second. Under load Fathom documents dropping heavy requests to 5 a
 * minute, at which point the 429 backoff in `fetchJson` is what carries the
 * run.
 *
 * `calendar_invitees[].is_external` is a real flag and is deliberately not
 * used. Internal-versus-customer stays derived from email domains in
 * `recorder.ts`, because the day one recorder's flag is trusted is the day two
 * recorders disagree about what an internal call is and the log splits.
 *
 * Docs: https://developers.fathom.ai/quickstart
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
import { pickString, pickTimestamp } from "./fields";
import { renderTurns, type Turn } from "./turns";

const API = "https://api.fathom.ai/external/v1";

// Every /recordings endpoint counts against the heavy limit of 30/minute.
const HEAVY_PACE_MS = Math.max(PACE_MS, 2000);

const headers = (): Record<string, string> => ({
  "X-Api-Key": recorderKey(),
});

type Meeting = Record<string, unknown> & {
  recording_id?: number | string;
  calendar_invitees?: { name?: string; email?: string }[] | null;
};

// Documented as filtering on `created_at`; which timestamp the meeting object
// itself carries is not in the reference, so the recording's own start is
// preferred and the schedule and the creation time are the fallbacks.
const START_KEYS = [
  "recording_start_time",
  "scheduled_start_time",
  "started_at",
  "start_time",
  "created_at",
] as const;

const TITLE_KEYS = ["title", "meeting_title", "name", "subject"] as const;

export const fathom: Recorder = {
  provider: "fathom",

  async listReady(from, to) {
    const meetings: Meeting[] = [];
    let cursor: string | null = null;

    do {
      const query = new URLSearchParams({
        created_after: `${from}T00:00:00Z`,
        created_before: `${to}T23:59:59Z`,
      });
      if (cursor !== null) query.set("cursor", cursor);

      const page: { items?: Meeting[]; next_cursor?: string | null } =
        await fetchJson(`${API}/meetings?${query}`, { headers: headers() });

      meetings.push(...(page.items ?? []));
      cursor = page.next_cursor ?? null;
      if (cursor !== null) await sleep(PACE_MS);
    } while (cursor !== null);

    // No page size is exposed and the pages are small, so a busy window is
    // several round trips. include_transcript and include_summary would inline
    // the bodies here, but they make the whole list request a heavy one and
    // are refused outright for OAuth-connected apps — so this stays metadata,
    // and the bodies are fetched per call.
    const calls: Call[] = [];
    for (const meeting of meetings) {
      const id = meeting.recording_id;
      if (id === undefined || id === null) continue;

      const startAt = pickTimestamp(meeting, START_KEYS);
      if (startAt === undefined) {
        console.error(
          `skip recording ${String(id)}: no start timestamp on the meeting ` +
            `(none of ${START_KEYS.join(", ")}) — see references/recorder-apis.md`,
        );
        continue;
      }

      calls.push({
        // The id is an integer in the response and a string everywhere in this
        // pipeline: it is written into the `source:` line and read back out of
        // it, and a number that round-trips through a file is a string.
        id: String(id),
        startAt,
        subject: pickString(meeting, TITLE_KEYS) ?? "call",
        attendees: (meeting.calendar_invitees ?? []).map((invitee) => ({
          name: invitee.name,
          email: invitee.email,
        })),
      });
    }

    // Fathom has no readiness flag. The whole window is returned and a call
    // whose transcript is still processing comes back null, which the
    // overlapping window picks up tomorrow.
    return calls;
  },

  async transcript(id) {
    await sleep(HEAVY_PACE_MS);

    let payload: {
      transcript?: {
        speaker?: { display_name?: string | null } | null;
        text?: string;
      }[];
    };
    try {
      payload = await fetchJson(`${API}/recordings/${id}/transcript`, {
        headers: headers(),
      });
    } catch (error) {
      if (error instanceof HttpError) {
        console.error(`transcript ${id} unavailable (${error.status})`);
        return null;
      }
      throw error;
    }

    // `?destination_url=` on this endpoint flips it to async delivery and
    // returns nothing useful inline. Never pass it here.
    const turns: Turn[] = [];
    for (const segment of payload.transcript ?? []) {
      if (typeof segment.text !== "string") continue;
      turns.push({
        speaker: segment.speaker?.display_name ?? undefined,
        text: segment.text,
      });
    }

    return renderTurns(turns);
  },

  async notes(id) {
    await sleep(HEAVY_PACE_MS);

    let payload: {
      summary?: { markdown_formatted?: string | null } | null;
    };
    try {
      payload = await fetchJson(`${API}/recordings/${id}/summary`, {
        headers: headers(),
      });
    } catch (error) {
      if (error instanceof HttpError) {
        console.error(`notes ${id} unavailable (${error.status})`);
        return null;
      }
      throw error;
    }

    // Always English, whatever language the call was in. Worth knowing before
    // you reorder the fallback so notes are preferred over transcripts.
    return payload.summary?.markdown_formatted ?? null;
  },
};
