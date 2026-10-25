/**
 * Provides the shared South African date and time checks for volunteer events.
 * Explicit timezone formatting keeps day boundaries consistent even when a browser uses another
 * timezone.
 */

import type { Event, EventSlot } from "@/lib/types";

/** Admin event dates always use South African time, including when the browser is elsewhere. */
export function getLocalDateString(date = new Date()) {
  const { year, month, day } = getBusinessDateTime(date);
  return `${year}-${month}-${day}`;
}

/** Returns South African time in the same HH:MM format used by event slots. */
export function getLocalTimeString(date = new Date()) {
  const { hour, minute } = getBusinessDateTime(date);
  return `${hour}:${minute}`;
}

/** Extracts South African calendar parts without using the browser's local timezone. */
function getBusinessDateTime(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value])) as Record<string, string>;
}

/** Checks a slot's date and end time in the hard-coded Africa/Johannesburg timezone. */
export function hasSlotEnded(event: Pick<Event, "date">, slot: Pick<EventSlot, "end_time">, now = new Date()) {
  const current = getBusinessDateTime(now);
  const currentDate = `${current.year}-${current.month}-${current.day}`;
  const currentTime = `${current.hour}:${current.minute}`;
  const endTime = slot.end_time.slice(0, 5);
  // YYYY-MM-DD and zero-padded HH:MM can be compared as strings, including equality at the end.
  return event.date < currentDate || (event.date === currentDate && endTime <= currentTime);
}

/**
 * An event becomes past once its latest published time range has ended.
 * Events without proper slot records keep their previous date-only behaviour
 * because the app cannot safely determine their end time.
 */
export function hasEventFinished(event: Pick<Event, "id" | "date">, eventSlots: EventSlot[], now = new Date()) {
  const current = getBusinessDateTime(now);
  const today = `${current.year}-${current.month}-${current.day}`;

  if (event.date < today) return true;
  if (event.date > today) return false;

  const latestEndTime = eventSlots
    .filter((slot) => slot.event_id === event.id)
    .map((slot) => slot.end_time.slice(0, 5))
    .sort()
    .at(-1);

  return latestEndTime ? `${current.hour}:${current.minute}` >= latestEndTime : false;
}
