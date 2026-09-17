/** The lifecycle states a volunteer booking can have. */
export type BookingStatus = 'Confirmed' | 'Present' | 'Completed' | 'No show';
export type UserRole = 'admin' | 'volunteer';
export type EventStatus = 'Scheduled' | 'Cancelled';

/** A record from the `profiles` table for an authenticated user. */
export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role?: UserRole;
  date_of_birth?: string;
  phone?: string;
  is_present?: boolean;
}

/** The current recorded acceptance of the volunteer onboarding agreements. */
export interface VolunteerConsent {
  user_id: string;
  code_of_conduct_accepted: boolean;
  data_use_accepted: boolean;
  information_accuracy_accepted: boolean;
  consent_version: string;
  accepted_at: string;
  updated_at?: string;
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
  status: EventStatus;
  cancellation_message?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  category?: EventCategory;
  location_url?: string | null;
}

/** Categories reflect Ladles of Love's regular volunteer programmes and reporting needs. */
export type EventCategory = 'Dignity Kitchen' | 'Warehouse HQ' | 'Feed The Soil' | 'Campaign / Special Event' | 'Other';

/** A bookable time range with its own capacity for one event. */
export interface EventSlot {
  id: number;
  event_id: number;
  start_time: string;
  end_time: string;
  capacity: number;
  /** Privacy-safe aggregate; absent until the reviewed migration is installed. */
  remaining?: number;
  created_at?: string;
}

/** One of the two event QR checkpoints used to record attendance. */
export interface AttendanceCheckpoint {
  id: string;
  event_id: number;
  action: 'clock_in' | 'clock_out';
  is_active: boolean;
  created_at: string;
}

/** The actual attendance timestamps and calculated minutes for one booking. */
export interface AttendanceRecord {
  id?: number;
  booking_id: number;
  clocked_in_at: string | null;
  clocked_out_at: string | null;
  worked_minutes: number | null;
  created_at?: string;
}

/** A volunteer's reservation for one time slot at an event. */
export interface Booking {
  id: number;
  volunteer_name: string;
  event_id: number;
  user_id: string;
  event_slot_id?: number | null;
  selected_slot: string;
  status: BookingStatus;
  volunteer_email?: string;
}

/** An in-app update sent to a volunteer about one of their events. */
export interface Notification {
  id: number;
  user_id: string;
  event_id: number;
  type: 'event_cancelled';
  title: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
}

/** A profile shown in the admin volunteer list, where the role is required. */
export interface Volunteer extends Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_present?: boolean;
}

/** Semantic alias used when a profile is handled in volunteer-facing code. */
export type VolunteerProfile = Profile;

export type CorporateStatus = 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled';
export type RelationshipStatus = 'Lead' | 'Contacted' | 'Interested' | 'Active Partner' | 'Inactive';
export interface CorporateCompany {
  id: number; name: string; industry: string | null; website: string | null;
  location: string | null; contact_name: string | null; contact_email: string | null;
  contact_phone: string | null; relationship_status: RelationshipStatus;
  charities_supported: number | null; estimated_annual_csr: number | null;
  csr_focus_areas: string | null; partnership_potential: 'Low' | 'Medium' | 'High';
  notes: string | null; created_at: string; updated_at: string;
}
export type CompanyInput = Omit<CorporateCompany, 'id' | 'created_at' | 'updated_at'>;
export interface CorporateBooking {
  id: number; company_id: number; event_id: number; event_slot_id: number;
  contact_name: string | null; contact_email: string | null; team_size: number;
  status: CorporateStatus; notes: string | null; attendance_count: number | null;
  volunteer_hours: number | null; created_at: string; updated_at: string;
}
export type CorporateBookingInput = Omit<CorporateBooking, 'id' | 'event_id' | 'created_at' | 'updated_at'>;
export interface CorporateNote { id: number; company_id: number; body: string; created_by: string | null; created_at: string }
export interface OrganisationSettings {
  id: 1; organisation_name: string; default_location: string; contact_email: string;
  timezone: 'Africa/Johannesburg'; booking_confirmation_enabled: boolean;
  booking_cancellation_enabled: boolean; shift_reminder_enabled: boolean;
  corporate_booking_confirmation_enabled: boolean; updated_at: string;
}
export interface SlotAvailability { event_slot_id: number; remaining: number }
