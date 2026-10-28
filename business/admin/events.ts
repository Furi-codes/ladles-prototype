/** Rules for a volunteer event draft. The form uses these for feedback; the save use case repeats them before persistence. */
import { getLocalDateString, getLocalTimeString } from '@/business/shared/dates/calendar';
import type { EventCategory } from '@/business/shared/types';
import type { EventSlotInput } from '@/data/admin/management';

export type VolunteerEventDraft = {
  eventId: number | null; title: string; date: string; location: string;
  category: EventCategory; locationUrl: string; description: string; ranges: EventSlotInput[];
};
const minuteOfDay = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));

/** Return one useful message rather than sending an incomplete or impossible draft to the repository. */
export function validateVolunteerEventDraft(draft: VolunteerEventDraft, now = new Date()): string | null {
  if (!draft.title.trim() || !draft.date || !draft.location.trim() || !draft.ranges.length) return 'Complete all fields and add at least one time range.';
  const today = getLocalDateString(now);
  if (draft.date < today) return 'Events cannot be created in the past.';
  if (draft.locationUrl.trim() && !/^https?:\/\//i.test(draft.locationUrl.trim())) return 'Map link must start with https:// or http://.';
  const sorted = [...draft.ranges].sort((a, b) => minuteOfDay(a.start_time) - minuteOfDay(b.start_time));
  for (let index = 0; index < sorted.length; index++) {
    const range = sorted[index];
    if (![range.start_time, range.end_time].every(time => /^([01]\d|2[0-3]):[0-5]\d(?::00)?$/.test(time)) || minuteOfDay(range.end_time) <= minuteOfDay(range.start_time)) return 'Each time range must end after its start.';
    if (!Number.isSafeInteger(range.capacity) || range.capacity < 1) return 'Capacity must be a positive whole number.';
    if (index && minuteOfDay(range.start_time) < minuteOfDay(sorted[index - 1].end_time)) return 'Time ranges cannot overlap.';
    if (draft.eventId === null && draft.date === today && minuteOfDay(range.start_time) <= minuteOfDay(getLocalTimeString(now))) return 'An event created for today must use time ranges that start later than the current time.';
  }
  return null;
}
