/**
 * Loads admin volunteer data and performs event, booking and attendance operations.
 * These are browser service helpers, not Next.js Server Actions; database policies and RPCs
 * enforce access.
 */

import type { PostgrestResponse } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import type { AttendanceCheckpoint, AttendanceRecord, Booking, Volunteer, Event, EventCategory, EventSlot } from '@/lib/types'
import { fetchAllPages } from '@/lib/supabase/pagination'
import { userFacingError } from '@/lib/errors/user-facing'

/** The original values let SQL reject a stale approval instead of overwriting another admin's work. */
export async function approveVolunteerHours(booking: Booking, attendance: AttendanceRecord | undefined, start: string, end: string, reason: string) {
  // The deployed function saves attendance, completed status and the audit reason together.
  const { data, error } = await supabase.rpc('admin_approve_volunteer_hours', {
    p_booking_id: booking.id,
    p_clock_in: start,
    p_clock_out: end,
    p_reason: reason,
    p_expected_status: booking.status,
    p_expected_attendance: attendance ? {
      clocked_in_at: attendance.clocked_in_at,
      clocked_out_at: attendance.clocked_out_at,
      worked_minutes: attendance.worked_minutes,
    } : null,
  });
  if (error) throw new Error(userFacingError(error.message, 'Hours could not be approved. Refresh the roster and try again.'));
  return data;
}

/** Fields sent by the event form; an existing slot ID lets the RPC identify an edited range. */
export type EventSlotInput = Pick<EventSlot, 'start_time' | 'end_time' | 'capacity'> & { id?: number }

/** Loads events for the admin dashboard, newest records first. */
export async function fetchAdminEvents() {
  return fetchAllPages<Event>((from, to) => supabase.from('events').select('*', { count: 'exact' }).order('id', { ascending: false }).range(from, to))
}

/** Loads all bookings so administrators can monitor attendance and activity. */
export async function fetchAdminBookings() {
  // Read each page in a stable ID order so the roster is not limited to the first database response.
  return fetchAllPages<Booking>((from, to) => supabase.from('bookings').select('*', { count: 'exact' }).order('id', { ascending: false }).range(from, to))
}

/** Loads the time slots used to staff each event. */
export async function fetchAdminEventSlots() {
  return fetchAllPages<EventSlot>((from, to) => supabase.from('event_slots').select('*', { count: 'exact' }).order('start_time', { ascending: true }).order('id').range(from, to))
}

/** Loads the protected QR checkpoint identifiers used for event attendance. */
export async function fetchAdminAttendanceCheckpoints(): Promise<PostgrestResponse<AttendanceCheckpoint>> {
  return fetchAllPages<AttendanceCheckpoint>((from, to) => supabase
    .from('event_attendance_checkpoints')
    .select('*', { count: 'exact' })
    .order('action', { ascending: true }).order('id').range(from, to))
}

/** Admin-only replacement invalidates the old typed code, not its QR link. */
export async function rotateAttendanceEntryCode(checkpointId: string) {
  return supabase.rpc('rotate_attendance_entry_code', { p_checkpoint_id: checkpointId })
}

/** Loads attendance through a paged RPC; the deployed SQL controls which users' records are returned. */
export async function fetchAdminAttendanceRecords(): Promise<PostgrestResponse<AttendanceRecord>> {
  return fetchAllPages<AttendanceRecord>((from, to) => supabase.rpc('get_attendance_records', {}, { count: 'exact' }).order('booking_id').range(from, to))
}

/** Requests no-show finalisation before admin reads; eligible statuses/times are checked by the RPC. */
export async function markMissedBookingsNoShow() {
  return supabase.rpc('mark_missed_bookings_no_show')
}

/** Loads visible profiles alphabetically; this query itself does not filter role to volunteer. */
export async function fetchVolunteers() {
  return fetchAllPages<Volunteer>((from, to) => supabase.from('profiles').select('*', { count: 'exact' }).order('full_name', { ascending: true }).order('id').range(from, to))
}

/** Sends event details and slot rows in one RPC request; transaction rules belong to the deployed function. */
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
export async function updateEventMetadata(eventId: number, data: { category: EventCategory; location_url: string | null; description: string | null }) {
  return supabase
    .rpc('save_event_metadata', {
      p_event_id: eventId,
      p_category: data.category,
      p_location_url: data.location_url,
      p_description: data.description,
    })
    .single()
}

/** Permanently removes an event by its database id. */
export async function deleteEvent(id: number) {
  return supabase.from('events').delete().eq('id', id)
}

/** Requests cancellation via the corporate-aware RPC, falling back only when that RPC is missing. */
export async function cancelEvent(eventId: number, message: string) {
  const parameters = { p_event_id: eventId, p_message: message || null }
  const corporateCancellation = await supabase
    .rpc('cancel_event_with_corporate_bookings', { p_event_id: eventId, p_message: message || null })
    .single()

  // Keep ordinary event cancellation working until the separately supplied
  // CSR database SQL has been applied. Do not fall back for any other error:
  // those errors may be enforcing the corporate cancellation rules.
  if (corporateCancellation.error?.code === 'PGRST202') {
    return supabase.rpc('cancel_event', parameters).single()
  }

  return corporateCancellation
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
  // This updates attendance status, not the booked event or time slot. Database policies control who may do it.
  return supabase.from('bookings').update({ status }).eq('id', bookingId)
}
