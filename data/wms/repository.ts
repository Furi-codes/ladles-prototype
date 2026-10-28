/** Server persistence for WMS. Handlers receive named methods rather than constructing database queries. */
import 'server-only';
import { getIntegrationDatabase, logWmsAction } from '@/data/server/wms-integration';
import { fetchAllPages, fetchRowsByIds } from '@/data/supabase/pagination';
import type { WmsEventPayload } from '@/data/server/wms-integration';

export type SyncSlot = { id: number; external_timeslot_id: string | null; capacity: number };
export type SyncBooking = { id: number; event_slot_id: number | null; status: string; user_id: string; volunteer_name: string | null; volunteer_email: string | null };
export type SyncProfile = { id: string; full_name: string; email: string | null };
export type SyncGroup = { event_slot_id: number; team_size: number; status: string };

/** One request uses the same server client for every read/write and its audit record. */
export function createWmsRepository() {
  const database = getIntegrationDatabase();
  return {
    findEvent: (externalId: string) => database.from('events').select('id').eq('external_event_id', externalId).maybeSingle(),
    findSlot: (externalId: string) => database.from('event_slots').select('id, capacity, event_id').eq('external_timeslot_id', externalId).maybeSingle(),
    listSlots: (eventId: number) => fetchAllPages<SyncSlot>((from, to) => database.from('event_slots').select('id, external_timeslot_id, capacity', { count: 'exact' }).eq('event_id', eventId).not('external_timeslot_id', 'is', null).order('start_time', { ascending: true }).order('id').range(from, to)),
    listBookings: (slotIds: number[]) => fetchRowsByIds<SyncBooking>(slotIds, (ids, from, to) => database.from('bookings').select('id, event_slot_id, status, user_id, volunteer_name, volunteer_email', { count: 'exact' }).in('event_slot_id', ids).order('id').range(from, to)),
    listGroups: (slotIds: number[]) => fetchRowsByIds<SyncGroup>(slotIds, (ids, from, to) => database.from('corporate_bookings').select('event_slot_id, team_size, status', { count: 'exact' }).in('event_slot_id', ids).neq('status', 'Cancelled').order('id').range(from, to)),
    listProfiles: (userIds: string[]) => fetchRowsByIds<SyncProfile>(userIds, (ids, from, to) => database.from('profiles').select('id, full_name, email', { count: 'exact' }).in('id', ids).order('id').range(from, to)),
    countIndividuals: (slotId: number) => database.from('bookings').select('id', { count: 'exact', head: true }).eq('event_slot_id', slotId).neq('status', 'Cancelled'),
    listSlotGroups: (slotId: number) => fetchAllPages<{ team_size: number }>((from, to) => database.from('corporate_bookings').select('team_size', { count: 'exact' }).eq('event_slot_id', slotId).neq('status', 'Cancelled').order('id').range(from, to)),
    saveCapacity: (slotId: number, capacity: number) => database.from('event_slots').update({ capacity }).eq('id', slotId).select('id, capacity').single(),
    publishEvent: (payload: WmsEventPayload) => database.rpc('upsert_wms_event', {
      p_external_event_id: payload.externalEventId, p_title: payload.title, p_event_date: payload.eventDate,
      p_location_name: payload.locationName, p_status: payload.status, p_description: payload.description,
      p_category: payload.category, p_location_url: payload.locationUrl,
      p_timeslots: payload.timeslots.map(slot => ({ external_timeslot_id: slot.externalTimeslotId, start_time: slot.startTime, end_time: slot.endTime, capacity: slot.capacity })),
    }).single(),
    saveAttendance: (bookingId: number, status: string, source: string, recordedAt: string) => database.rpc('record_wms_attendance_outcome', {
      p_booking_id: bookingId, p_attendance_status: status, p_source: source, p_recorded_at: recordedAt,
    }).single(),
    logAction: (entry: Parameters<typeof logWmsAction>[1]) => logWmsAction(database, entry),
  };
}
