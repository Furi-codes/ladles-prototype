import { supabase } from '@/lib/supabase'
import type { Event } from '@/lib/types'

/** Loads events for the admin dashboard, newest records first. */
export async function fetchAdminEvents() {
  return supabase.from('events').select('*').order('id', { ascending: false })
}

/** Loads all bookings so administrators can monitor attendance and activity. */
export async function fetchAdminBookings() {
  return supabase.from('bookings').select('*').order('id', { ascending: false })
}

/** Loads profiles alphabetically for the admin volunteer view. */
export async function fetchVolunteers() {
  return supabase.from('profiles').select('*').order('full_name', { ascending: true })
}

/** Creates an event when no id is supplied, otherwise updates the existing event. */
export async function upsertEvent(data: Partial<Event>, id: number | null) {
  if (id !== null) {
    return supabase.from('events').update(data).eq('id', id)
  }

  return supabase.from('events').insert([data])
}

/** Permanently removes an event by its database id. */
export async function deleteEvent(id: number) {
  return supabase.from('events').delete().eq('id', id)
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
