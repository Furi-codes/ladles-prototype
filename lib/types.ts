/** The lifecycle states a volunteer booking can have. */
export type BookingStatus = 'Confirmed' | 'Present' | 'Completed';

/** A record from the `profiles` table for an authenticated user. */
export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role?: string;
  phone?: string;
  is_present?: boolean;
}

/** An activity that volunteers can book, from the `events` table. */
export interface Event {
  id: number;
  title: string;
  date: string;
  location: string;
  time_slots: string;
  total_slots: number;
  description?: string;
}

/** A volunteer's reservation for one time slot at an event. */
export interface Booking {
  id: number;
  volunteer_name: string;
  event_id: number;
  user_id: string;
  selected_slot: string;
  status: BookingStatus | string;
  volunteer_email?: string;
}

/** A profile shown in the admin volunteer list, where the role is required. */
export interface Volunteer extends Profile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_present?: boolean;
}

/** Semantic alias used when a profile is handled in volunteer-facing code. */
export type VolunteerProfile = Profile;
