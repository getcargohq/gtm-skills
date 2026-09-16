/**
 * tl;dv. Written from the vendor's own API reference, not yet run against a
 * live workspace: check it with `--dry-run` before you deploy it.
 *
 * tl;dv labels the API `v1alpha1` and expects breaking changes, so this is the
 * adapter here most likely to need a field name changed. Auth is the custom
 * header `x-api-key`, not `Authorization`.
 *
 * Access follows the MEETING ORGANIZER'S plan, not yours: a meeting organized
 * by someone on the free tier is invisible to the API while sitting in your
 * web app, so a call the collector never sees is a plan question before it is
 * a bug.
 *
 * The pagination ceiling that matters on a backfill is in
 * `references/recorder-apis.md`.
 * Docs: https://doc.tldv.io/
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

const API = "https://pasta.tldv.io/v1alpha1";

// The documented maximum; the default is 50.
const PAGE_SIZE = 100;

const headers = (): Record<string, string> => ({
  "x-api-key": recorderKey(),
});

type Meeting = Record<string, unknown> & {
  id?: string;
  invitees?: { name?: string | null; email?: string | null }[] | null;
  organizer?: { name?: string | null; email?: string | null } | null;
};

// `from`/`to` are documented; which key the meeting's own time comes back
// under is not, so these are the candidates.
const START_KEYS = [
  "happenedAt",
  "startTime",
  "scheduledAt",
  "date",
  "createdAt",
] as const;

const TITLE_KEYS = ["name", "title", "subject"] as const;

export const tldv: Recorder = {
  provider: "tldv",

  async listReady(from, to) {
    const calls: Call[] = [];

    for (let page = 1; ; page++) {
      const query = new URLSearchParams({
        from: `${from}T00:00:00Z`,
        to: `${to}T23:59:59Z`,
        page: String(page),
        limit: String(PAGE_SIZE),
      });

      const body: {
        results?: Meeting[];
        pages?: number;
      } = await fetchJson(`${API}/meetings?${query}`, { headers: headers() });

      for (const meeting of body.results ?? []) {
        if (meeting.id === undefined) continue;

        const startAt = pickTimestamp(meeting, START_KEYS);
        if (startAt === undefined) {
          console.error(
            `skip ${meeting.id}: no start timestamp on the meeting ` +
              `(none of ${START_KEYS.join(", ")}) — see references/recorder-apis.md`,
          );
          continue;
        }

        // `invitees` is "invited, or participated" with no way to tell which,
        // so someone who never joined is still an attendee here — harmless,
        // since the account is slugged from domains.
        const attendees = [
          ...(meeting.invitees ?? []),
          ...(meeting.organizer === null || meeting.organizer === undefined
            ? []
            : [meeting.organizer]),
        ];

        calls.push({
          id: meeting.id,
          startAt,
          subject: pickString(meeting, TITLE_KEYS) ?? "call",
          attendees: attendees.map((attendee) => ({
            name: attendee.name ?? undefined,
            email: attendee.email ?? undefined,
          })),
        });
      }

      if (page >= (body.pages ?? 1)) break;
      await sleep(PACE_MS);
    }

    // The only signal is the `TranscriptReady` webhook, which a polling
    // collector never sees, so a null transcript is the retry.
    return calls;
  },

  async transcript(id) {
    await sleep(PACE_MS);

    let payload: {
      data?: { speaker?: string | null; text?: string | null }[];
    };
    try {
      payload = await fetchJson(`${API}/meetings/${id}/transcript`, {
        headers: headers(),
      });
    } catch (error) {
      if (error instanceof HttpError) {
        console.error(`transcript ${id} unavailable (${error.status})`);
        return null;
      }
      throw error;
    }

    const turns: Turn[] = [];
    for (const segment of payload.data ?? []) {
      if (typeof segment.text !== "string") continue;
      turns.push({ speaker: segment.speaker ?? undefined, text: segment.text });
    }

    return renderTurns(turns);
  },

  async notes(id) {
    await sleep(PACE_MS);

    let payload: { markdownContent?: string | null };
    try {
      payload = await fetchJson(`${API}/meetings/${id}/notes`, {
        headers: headers(),
      });
    } catch (error) {
      if (error instanceof HttpError) {
        console.error(`notes ${id} unavailable (${error.status})`);
        return null;
      }
      throw error;
    }

    // `markdownContent` is the whole thing rendered; `structuredNotes` is the
    // same material as segments joined to `topics`, which is more work for the
    // same words.
    return payload.markdownContent ?? null;
  },
};
