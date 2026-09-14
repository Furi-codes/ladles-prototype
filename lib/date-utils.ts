import type { Event, EventSlot } from "./types";

/** Returns today's date in the user's local calendar, formatted for YYYY-MM-DD fields. */
export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Returns the local time in the same HH:MM format used by event slots. */
export function getLocalTimeString(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/**
 * An event becomes past once its latest published time range has ended.
 * Events without proper slot records keep their previous date-only behaviour
 * because the app cannot safely determine their end time.
 */
export function hasEventFinished(event: Pick<Event, "id" | "date">, eventSlots: EventSlot[], now = new Date()) {
  const today = getLocalDateString(now);

  if (event.date < today) return true;
  if (event.date > today) return false;

  const latestEndTime = eventSlots
    .filter((slot) => slot.event_id === event.id)
    .map((slot) => slot.end_time.slice(0, 5))
    .sort()
    .at(-1);

  return latestEndTime ? getLocalTimeString(now) >= latestEndTime : false;
}
