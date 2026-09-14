import type { PostgrestResponse } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { AttendanceCheckpoint, Event, EventCategory, EventSlot } from '@/lib/types'

export type EventSlotInput = Pick<EventSlot, 'start_time' | 'end_time' | 'capacity'>

/** Loads events for the admin dashboard, newest records first. */
export async function fetchAdminEvents() {
  return supabase.from('events').select('*').order('id', { ascending: false })
}

/** Loads all bookings so administrators can monitor attendance and activity. */
export async function fetchAdminBookings() {
  return supabase.from('bookings').select('*').order('id', { ascending: false })
}

/** Loads the time slots used to staff each event. */
export async function fetchAdminEventSlots() {
  return supabase.from('event_slots').select('*').order('start_time', { ascending: true })
}

/** Loads the protected QR checkpoint identifiers used for event attendance. */
export async function fetchAdminAttendanceCheckpoints(): Promise<PostgrestResponse<AttendanceCheckpoint>> {
  return supabase
    .from('event_attendance_checkpoints')
    .select('*')
    .order('action', { ascending: true })
}

/** Finalizes missed bookings for finished events so they can be reported as no-shows. */
export async function markMissedBookingsNoShow() {
  return supabase.rpc('mark_missed_bookings_no_show')
}

/** Loads profiles alphabetically for the admin volunteer view. */
export async function fetchVolunteers() {
  return supabase.from('profiles').select('*').order('full_name', { ascending: true })
}

/** Atomically saves an event and all of its capacity-controlled time slots. */
export async function saveEventWithSlots(
  eventId: number | null,
  data: Pick<Event, 'title' | 'date' | 'location'>,
  slots: EventSlotInput[]
) {
  return supabase
    .rpc('save_event_with_slots', {
      p_event_id: eventId,
      p_title: data.title,
      p_date: data.date,
      p_location: data.location,
      p_slots: slots,
    })
    .single()
}

/** Saves event metadata that does not affect time-slot capacity calculations. */
export async function updateEventMetadata(eventId: number, data: { category: EventCategory; location_url: string | null }) {
  return supabase
    .from('events')
    .update(data)
    .eq('id', eventId)
}

/** Permanently removes an event by its database id. */
export async function deleteEvent(id: number) {
  return supabase.from('events').delete().eq('id', id)
}

/** Cancels a future event without deleting its bookings or attendance history. */
export async function cancelEvent(eventId: number, message: string) {
  return supabase
    .rpc('cancel_event', { p_event_id: eventId, p_message: message || null })
    .single()
}

/** Permanently removes a booking by its database id. */
export async function deleteBooking(id: number) {
  return supabase.from('bookings').delete().eq('id', id)
}

/** Marks a booking present or restores it to its confirmed state. */
export async function updateBookingAttendance(
  bookingId: number,
  status: 'Present' | 'Confirmed'
) {
  return supabase.from('bookings').update({ status }).eq('id', bookingId)
}
