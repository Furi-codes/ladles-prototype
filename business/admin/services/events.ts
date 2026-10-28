/** Event-creation use case: validate, save the event/ranges, save metadata and record activity. UI refresh remains the caller's job. */
import { validateVolunteerEventDraft, type VolunteerEventDraft } from '@/business/admin/events';
import { saveEventWithSlots, updateEventMetadata } from '@/data/admin/management';
import { logAdminAction } from '@/data/admin/audit';
import type { Event } from '@/business/shared/types';

export async function saveVolunteerEvent(draft: VolunteerEventDraft) {
  const invalid = validateVolunteerEventDraft(draft);
  if (invalid) throw new Error(invalid);
  const { data, error } = await saveEventWithSlots(draft.eventId, {
    title: draft.title.trim(), date: draft.date, location: draft.location.trim(),
  }, draft.ranges);
  const savedEvent = data as Event | null;
  if (error || !savedEvent) throw error ?? new Error('The event could not be saved.');
  // These are two existing database calls. A metadata failure cannot undo the core event that was already stored.
  const { error: metadataError } = await updateEventMetadata(savedEvent.id, {
    category: draft.category, location_url: draft.locationUrl.trim() || null, description: draft.description.trim() || null,
  });
  if (metadataError) console.error('Event metadata could not be saved:', metadataError);
  await logAdminAction({
    action: draft.eventId === null ? 'EVENT_CREATED' : 'EVENT_UPDATED', entityType: 'EVENT',
    entityId: savedEvent.id, entityLabel: savedEvent.title,
    details: { date: savedEvent.date, location: savedEvent.location, category: draft.category, slot_count: draft.ranges.length, metadata_saved: !metadataError },
  });
  return { savedEvent, metadataError };
}
