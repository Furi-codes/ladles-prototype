import type { AttendanceRecord, Booking, Event, EventSlot } from "./types";

/** Only finalised attendance for this volunteer contributes to certificate totals. */
export function getVerifiedContribution(bookings: Booking[], attendance: AttendanceRecord[], userId?: string) {
  if (!userId) return { completed: [], totalMinutes: 0 };
  const records = new Map(attendance.map(record => [record.booking_id, record]));
  const completed = bookings.filter(booking => {
    const record = records.get(booking.id);
    return booking.user_id === userId && booking.status === "Completed" && !!record &&
      !!record.clocked_in_at && !!record.clocked_out_at &&
      Number.isFinite(Date.parse(record.clocked_in_at)) &&
      Date.parse(record.clocked_out_at) >= Date.parse(record.clocked_in_at) &&
      record.worked_minutes !== null && Number.isFinite(record.worked_minutes) && record.worked_minutes >= 0;
  });
  return { completed, totalMinutes: completed.reduce((sum, booking) => sum + records.get(booking.id)!.worked_minutes!, 0) };
}

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
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit" }).format(date);
}
