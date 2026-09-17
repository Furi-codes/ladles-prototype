import { fetchSlotAvailability } from '@/lib/actions/corporate'
import type { PostgrestResponse, PostgrestSingleResponse } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { AttendanceRecord, Booking, Event, EventSlot, Notification, Profile } from '@/lib/types'

/** Loads events in chronological order for the volunteer dashboard. */
export async function fetchEventsForVolunteer(): Promise<PostgrestResponse<Event>> {
  return supabase.from('events').select('*').order('date', { ascending: true })
}

/** Loads booking records used to show slot availability and the user's shifts. */
export async function fetchBookingsForVolunteer(): Promise<PostgrestResponse<Booking>> {
  return supabase.from('bookings').select('*').order('id', { ascending: false })
}

/** Loads the ranges and capacities available for volunteer booking. */
export async function fetchEventSlotsForVolunteer(): Promise<PostgrestResponse<EventSlot>> {
  const availabilityRequest = fetchSlotAvailability().catch((error: unknown) => {
    console.error("Unexpected slot availability failure:", error);
    throw new Error("Availability could not be loaded. Please try again.");
  });
  const [result, availability] = await Promise.all([
    supabase.from('event_slots').select('*').order('start_time', { ascending: true }),
    availabilityRequest,
  ]);
  if (result.error) return result;
  const remaining = new Map(availability?.map(row => [row.event_slot_id, Number(row.remaining)]));
  return { ...result, data: result.data.map(slot => ({ ...slot, remaining: remaining.get(slot.id) })) };
}

/** Loads unread in-app notices for the signed-in volunteer. */
export async function fetchVolunteerNotifications(): Promise<PostgrestResponse<Notification>> {
  return supabase
    .from('notifications')
    .select('*')
    .eq('is_read', false)
    .order('created_at', { ascending: false })
}

/** Marks one notice as read for the signed-in volunteer. */
export async function markVolunteerNotificationRead(notificationId: number) {
  return supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
}

/** Records a validated clock-in or clock-out through the attendance QR function. */
export async function recordEventAttendance(checkpointId: string): Promise<PostgrestSingleResponse<AttendanceRecord>> {
  return supabase.rpc('record_event_attendance', { p_checkpoint_id: checkpointId }).single()
}

/** Loads attendance for the signed-in volunteer, including any live clock-in. */
export async function fetchVolunteerAttendanceRecords(): Promise<PostgrestResponse<AttendanceRecord>> {
  return supabase.rpc('get_attendance_records')
}

/**
 * Returns an existing profile, or creates a volunteer profile for a newly
 * authenticated user who does not yet have one.
 */
export async function ensureUserProfile(
  userId: string,
  email: string | undefined,
  fullName?: string,
  dateOfBirth?: string
): Promise<PostgrestSingleResponse<Profile>> {
  const { data: existingProfile, error: selectError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  // Return the query error unchanged so the caller can display or handle it.
  if (selectError) {
    return { data: null, error: selectError } as PostgrestSingleResponse<Profile>
  }

  // Keep the display email in sync after Supabase confirms an email change.
  if (existingProfile) {
    if (email && existingProfile.email !== email) {
      return await supabase
        .from('profiles')
        .update({ email })
        .eq('id', userId)
        .select()
        .single() as PostgrestSingleResponse<Profile>
    }
    return { data: existingProfile as Profile, error: null } as PostgrestSingleResponse<Profile>
  }

  // Fall back to a readable name and a non-empty email when OAuth metadata is absent.
  const profilePayload: Omit<Profile, 'phone'> & { role: string } = {
    id: userId,
    full_name: fullName || email?.split('@')[0] || 'Volunteer',
    email: email || `${userId}@placeholder.local`,
    role: 'volunteer',
    date_of_birth: dateOfBirth,
  }

  return supabase.from('profiles').insert([profilePayload]).select().single()
}

/** Saves the volunteer's date of birth to their own profile. */
export async function updateVolunteerDateOfBirth(userId: string, dateOfBirth: string) {
  return supabase
    .from('profiles')
    .update({ date_of_birth: dateOfBirth })
    .eq('id', userId)
    .select()
    .single()
}

/** Books a slot through the database function that enforces capacity atomically. */
export async function bookEventSlot(eventSlotId: number): Promise<PostgrestSingleResponse<Booking>> {
  return supabase.rpc('book_event_slot', { p_event_slot_id: eventSlotId }).single()
}

/** Deletes one booking, restricted to the user who owns it. */
export async function cancelUserBooking(
  bookingId: number,
  userId: string
): Promise<{ data: null; error: { message: string } | null }> {
  const result = await supabase.from('bookings').delete().eq('id', bookingId).eq('user_id', userId)

  return {
    data: result.data as null,
    error: result.error ? { message: result.error.message } : null,
  }
}
