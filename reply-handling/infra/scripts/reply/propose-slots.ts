// Up to three meeting slots from the grid in `infra/settings.ts`, steered by
// what the reader asked for: morning or afternoon, "after 2pm", a weekday, or
// a date. No calendar is read: the grid is the sender's stated availability,
// and the `calendar-slots` variation replaces this script with a free/busy
// lookup.
//
// Never today, never a weekend. The first slot lands on the weekday the reader
// named when there is one; the rest follow on the next business days.

import { defineScript } from "@cargo-ai/cdk";

import { meetingGrid } from "../../settings";

const dayNames = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const dayMs = 24 * 60 * 60 * 1000;

const pad = (value: number): string => {
  if (value < 10) {
    return "0" + value;
  }
  return String(value);
};

/** Minutes east of UTC for an offset written "+02:00" or "-05:00". */
const offsetMinutes = (offset: string): number => {
  const sign = offset.charAt(0) === "-" ? -1 : 1;
  return sign * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4, 6)));
};

/** "pm" counts after a digit or a space ("2pm", "2 pm"), never inside a word. */
const mentionsPm = (guidance: string): boolean => {
  let at = guidance.indexOf("pm");
  while (at >= 0) {
    const before = at > 0 ? guidance.charAt(at - 1) : " ";
    if (before === " " || (before >= "0" && before <= "9")) {
      return true;
    }
    at = guidance.indexOf("pm", at + 2);
  }
  return false;
};

/** "after 2pm" or "after 14" raises the earliest hour offered. */
const earliestHour = (guidance: string): number => {
  const afterAt = guidance.indexOf("after ");
  if (afterAt < 0) {
    return meetingGrid.firstHour;
  }
  let digits = "";
  let index = afterAt + 6;
  while (
    index < guidance.length &&
    guidance.charAt(index) >= "0" &&
    guidance.charAt(index) <= "9"
  ) {
    digits += guidance.charAt(index);
    index++;
  }
  if (digits.length === 0) {
    return meetingGrid.firstHour;
  }
  let hour = Number(digits);
  if (guidance.slice(index, index + 3).indexOf("pm") >= 0 && hour < 12) {
    hour += 12;
  }
  if (hour < meetingGrid.firstHour || hour > meetingGrid.lastHour) {
    return meetingGrid.firstHour;
  }
  return hour;
};

/** A weekday named in words, else the weekday of a YYYY-MM-DD date. -1 for none. */
const wantedWeekday = (guidance: string): number => {
  for (let day = 1; day <= 5; day++) {
    if (guidance.indexOf(dayNames[day]) >= 0) {
      return day;
    }
  }
  for (let index = 0; index + 10 <= guidance.length; index++) {
    const candidate = guidance.slice(index, index + 10);
    if (candidate.charAt(4) !== "-" || candidate.charAt(7) !== "-") {
      continue;
    }
    const year = Number(candidate.slice(0, 4));
    const month = Number(candidate.slice(5, 7));
    const date = Number(candidate.slice(8, 10));
    if (year > 2000 && month >= 1 && month <= 12 && date >= 1 && date <= 31) {
      const weekday = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
      if (weekday >= 1 && weekday <= 5) {
        return weekday;
      }
    }
  }
  return -1;
};

const preferredHours = (guidance: string): number[] => {
  const wantsMorning =
    guidance.indexOf("morning") >= 0 ||
    guidance.indexOf("before noon") >= 0 ||
    guidance.indexOf("before 12") >= 0;
  if (wantsMorning) {
    return [10, 11, 9];
  }
  const wantsAfternoon =
    guidance.indexOf("afternoon") >= 0 ||
    guidance.indexOf("after noon") >= 0 ||
    guidance.indexOf("after 12") >= 0 ||
    mentionsPm(guidance);
  if (wantsAfternoon) {
    return [14, 15, 16];
  }
  return [10, 14, 11];
};

/** Wall-clock time in the grid's zone, written with the grid's offset. */
const localIso = (localMs: number): string => {
  const at = new Date(localMs);
  return (
    at.getUTCFullYear() +
    "-" +
    pad(at.getUTCMonth() + 1) +
    "-" +
    pad(at.getUTCDate()) +
    "T" +
    pad(at.getUTCHours()) +
    ":" +
    pad(at.getUTCMinutes()) +
    ":00" +
    meetingGrid.utcOffset
  );
};

const label = (localMs: number, hour: number): string => {
  const at = new Date(localMs);
  const weekday = dayNames[at.getUTCDay()];
  const hour12 = hour > 12 ? hour - 12 : hour;
  const meridiem = hour >= 12 ? "pm" : "am";
  return (
    weekday.charAt(0).toUpperCase() +
    weekday.slice(1) +
    " " +
    monthNames[at.getUTCMonth()] +
    " " +
    at.getUTCDate() +
    " at " +
    hour12 +
    meridiem
  );
};

export const proposeSlots = defineScript(
  ({ guidance, count }: { guidance: string; count: number }) => {
    const text = String(guidance || "").toLowerCase();
    const wanted = Number(count || 0);
    const minimumHour = earliestHour(text);
    const hours = preferredHours(text).map((hour) => {
      if (hour < minimumHour) {
        return minimumHour;
      }
      return hour;
    });
    const weekday = wantedWeekday(text);

    const localNowMs =
      Date.now() + offsetMinutes(meetingGrid.utcOffset) * 60 * 1000;
    const localMidnight = new Date(localNowMs);
    localMidnight.setUTCHours(0, 0, 0, 0);

    const slots: { startIso: string; endIso: string; label: string }[] = [];
    for (
      let dayIndex = 1;
      slots.length < wanted && dayIndex <= meetingGrid.daysAhead;
      dayIndex++
    ) {
      const dayMsLocal = localMidnight.getTime() + dayIndex * dayMs;
      const day = new Date(dayMsLocal).getUTCDay();
      if (day === 0 || day === 6) {
        continue;
      }
      if (weekday >= 0 && day !== weekday && slots.length === 0) {
        continue;
      }
      const hour = hours[slots.length % hours.length];
      const startMs = dayMsLocal + hour * 60 * 60 * 1000;
      const endMs = startMs + meetingGrid.slotMinutes * 60 * 1000;
      slots.push({
        startIso: localIso(startMs),
        endIso: localIso(endMs),
        label: label(startMs, hour),
      });
    }

    return {
      slots: slots,
      labels: slots.map((slot) => slot.label).join(", "),
    };
  },
);
