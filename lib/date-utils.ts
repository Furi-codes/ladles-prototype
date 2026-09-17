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

/** Returns whether a slot has ended in the organisation's configured timezone. */
export function hasSlotEnded(event: Pick<Event, "date">, slot: Pick<EventSlot, "end_time">, now = new Date()) {
  const current = getBusinessDateTime(now);
  const currentDate = `${current.year}-${current.month}-${current.day}`;
  const currentTime = `${current.hour}:${current.minute}`;
  const endTime = slot.end_time.slice(0, 5);
  return event.date < currentDate || (event.date === currentDate && endTime <= currentTime);
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
