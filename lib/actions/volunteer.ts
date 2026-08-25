import type { PostgrestResponse, PostgrestSingleResponse } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Booking, BookingStatus, Event, Profile } from '@/lib/types'

/** The fields required to create a volunteer booking. */
export interface CreateBookingInput {
  event_id: number
  user_id: string
  volunteer_name: string
  volunteer_email: string | null
  selected_slot: string
  status: BookingStatus
}

/** Loads events in chronological order for the volunteer calendar. */
export async function fetchEventsForVolunteer(): Promise<PostgrestResponse<Event>> {
  return supabase.from('events').select('*').order('date', { ascending: true })
}

/** Loads booking records used to show slot availability and the user's shifts. */
export async function fetchBookingsForVolunteer(): Promise<PostgrestResponse<Booking>> {
  return supabase.from('bookings').select('*').order('id', { ascending: false })
}

/**
 * Returns an existing profile, or creates a volunteer profile for a newly
 * authenticated user who does not yet have one.
 */
export async function ensureUserProfile(
  userId: string,
  email: string | undefined,
  fullName?: string
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

  // Do not overwrite profile details when the user already has a profile.
  if (existingProfile) {
    return { data: existingProfile as Profile, error: null } as PostgrestSingleResponse<Profile>
  }

  // Fall back to a readable name and a non-empty email when OAuth metadata is absent.
  const profilePayload: Omit<Profile, 'phone'> & { role: string } = {
    id: userId,
    full_name: fullName || email?.split('@')[0] || 'Volunteer',
    email: email || `${userId}@placeholder.local`,
    role: 'volunteer',
  }

  return supabase.from('profiles').insert([profilePayload]).select().single()
}

/** Inserts a new booking and returns the created booking record. */
export async function createBooking(payload: CreateBookingInput): Promise<PostgrestSingleResponse<Booking>> {
  return supabase.from('bookings').insert([payload]).select().single()
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
