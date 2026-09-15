import type { AttendanceRecord, Event, EventSlot } from "./types";

/** Calculates a live duration, never counting later than the booked shift end. */
export function getAttendanceMinutes(record: AttendanceRecord, now = Date.now(), endsAt?: string) {
  if (record.worked_minutes !== null) return record.worked_minutes;
  if (!record.clocked_in_at) return null;
  const clockedIn = new Date(record.clocked_in_at).getTime();
  const shiftEnd = endsAt ? new Date(endsAt).getTime() : now;
  const cappedNow = Number.isFinite(shiftEnd) ? Math.min(now, shiftEnd) : now;
  return Number.isFinite(clockedIn) ? Math.max(0, Math.floor((cappedNow - clockedIn) / 60_000)) : null;
}

/** Builds the exact South African local end timestamp for a booked event slot. */
export function getEventSlotEndAt(event: Pick<Event, "date">, slot: Pick<EventSlot, "end_time">) {
  return `${event.date}T${slot.end_time.slice(0, 5)}:00+02:00`;
}

/** Builds the exact South African local start timestamp for a booked event slot. */
export function getEventSlotStartAt(event: Pick<Event, "date">, slot: Pick<EventSlot, "start_time">) {
  return `${event.date}T${slot.start_time.slice(0, 5)}:00+02:00`;
}

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
