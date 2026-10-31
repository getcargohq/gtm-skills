import { hasText, type Signal } from "./queries";

const dayMs = 24 * 60 * 60 * 1000;

// "job_posting" -> "Job posting". A source model's name passes through as is.
export const signalName = (signal: Signal): string => {
  const words = signal.signal.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

// "today", "3 days ago", "2 weeks ago", then the date itself.
export const timeAgo = (date: string | null | undefined): string => {
  if (!hasText(date)) {
    return "";
  }
  const days = Math.floor((Date.now() - new Date(date).getTime()) / dayMs);
  if (days <= 0) {
    return "today";
  }
  if (days === 1) {
    return "yesterday";
  }
  if (days < 14) {
    return `${days} days ago`;
  }
  if (days < 60) {
    return `${Math.floor(days / 7)} weeks ago`;
  }
  return date;
};

// One line per signal for the writer: what happened, when, and the detail.
export const signalLine = (signal: Signal): string => {
  const parts = [signalName(signal)];
  if (hasText(signal.occurred)) {
    parts.push(signal.occurred);
  }
  if (hasText(signal.summary)) {
    parts.push(signal.summary);
  }
  return parts.join(" · ");
};
