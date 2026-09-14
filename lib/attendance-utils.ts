import type { AttendanceRecord } from "./types";

/** Calculates a live duration while a volunteer is clocked in. */
export function getAttendanceMinutes(record: AttendanceRecord, now = Date.now()) {
  if (record.worked_minutes !== null) return record.worked_minutes;
  if (!record.clocked_in_at) return null;

  const clockedIn = new Date(record.clocked_in_at).getTime();
  return Number.isFinite(clockedIn) ? Math.max(0, Math.floor((now - clockedIn) / 60_000)) : null;
}

/** Formats minutes for concise volunteer and administrator-facing displays. */
export function formatWorkedTime(minutes: number | null) {
  if (minutes === null) return "Not recorded";
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes} min`;
  if (remainingMinutes === 0) return `${hours} hr${hours === 1 ? "" : "s"}`;
  return `${hours} hr ${remainingMinutes} min`;
}

export function formatAttendanceTime(timestamp: string | null) {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat("en-ZA", { hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
}
