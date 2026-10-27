/** Shared roster validation; the database repeats these checks for every approval request. */
import type { Booking, Event, EventSlot } from '@/lib/types';

/** Older bookings can keep a readable range without a slot ID. Never guess an unreadable range. */
export function rosterShiftTimes(event: Pick<Event, 'date'>, booking: Pick<Booking, 'selected_slot'>, slot?: Pick<EventSlot, 'start_time' | 'end_time'>) {
  const legacy = booking.selected_slot.trim().match(/^(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})$/);
  const start = slot?.start_time.slice(0, 5) ?? legacy?.[1];
  const end = slot?.end_time.slice(0, 5) ?? legacy?.[2];
  if (!start || !end) return null;
  // These are South African event times, regardless of the timezone on the admin's computer.
  const startAt = Date.parse(`${event.date}T${start}:00+02:00`);
  const endAt = Date.parse(`${event.date}T${end}:00+02:00`);
  return Number.isFinite(startAt) && Number.isFinite(endAt) && endAt > startAt ? { startAt, endAt } : null;
}

/** Positive, completed attendance stays within the booked shift's existing 30-minute early-arrival allowance. */
export function validateApprovedTimes(date: string, shift: ReturnType<typeof rosterShiftTimes>, arrival: string, departure: string, now = Date.now()) {
  const invalid = (error: string) => ({ error, start: '', end: '', minutes: 0 });
  if (!shift) return invalid('This booking has no valid time range.');
  if (shift.endAt > now) return invalid('Hours can be approved after the booked shift ends.');
  if (!/^\d{2}:\d{2}$/.test(arrival) || !/^\d{2}:\d{2}$/.test(departure)) return invalid('Enter both actual attendance times.');
  const start = `${date}T${arrival}:00+02:00`, end = `${date}T${departure}:00+02:00`;
  const startAt = Date.parse(start), endAt = Date.parse(end);
  if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) return invalid('Departure must be after arrival.');
  // Match the existing QR rules: allow early arrival, but do not count time after the booked end.
  if (startAt < shift.startAt - 30 * 60_000 || endAt > shift.endAt) return invalid('Use times within the booked shift, allowing arrival up to 30 minutes early.');
  return { error: '', start, end, minutes: Math.floor((endAt - startAt) / 60_000) };
}
