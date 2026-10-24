import type { CorporateAccountInput, PagedRows } from './corporate-account-types';
export type { PagedRows };

/** Current operations use Requested → Pending payment → Confirmed, or admin rejection. */
export type CorporateReservationStatus = 'Requested' | 'Pending payment' | 'Pending additional payment' | 'Confirmed' | 'Rejected' | 'Cancelled' | 'Completed';
export interface CorporateEventInput {
  title: string; description: string; location: string;
  starts_at: string; ends_at: string; capacity: number;
  min_group_size: number; max_group_size: number; is_published: boolean;
}
export interface CorporateEvent extends CorporateEventInput {
  id: string; version: number; reserved_places: number; remaining: number;
  state: 'Started' | 'Closed' | 'Full' | 'Reserved' | 'Available' | 'Cancelled'; created_at: string; updated_at: string;
  cancelled_at?: string | null; cancellation_reason?: string | null;
  /** Returned to administrators only; rechecked under the workflow lock before an edit. */
  affected_bookings?: number;
}
export interface CorporateReservation {
  id: string; account_id: string; event_id: string; group_size: number; status: CorporateReservationStatus;
  notes: string; contact_snapshot: CorporateAccountInput; event_snapshot: CorporateEvent;
  payment_due_at: string | null; decision_reason: string | null; version: number; created_at: string; updated_at: string;
  additional_payment_amount?: number | null;
  pending_change?: CorporateBookingChange | null;
  attendance?: CorporateGroupAttendance | null;
}
export interface CorporateBookingRow extends CorporateReservation { event: CorporateEvent; is_overdue: boolean }
export interface CorporatePaymentRecord {
  id: string; reference: string; received_on: string; note: string; recorded_by_name: string; created_at: string;
  additional_amount_snapshot?: number | null;
}
export interface CorporateWorkflowAction {
  id: string; actor_name: string; action: string; reason: string | null; created_at: string;
  before_values: Record<string, unknown> | null; after_values: Record<string, unknown>;
}
export interface CorporateBookingDetail {
  booking: CorporateBookingRow; payments: CorporatePaymentRecord[]; history: CorporateWorkflowAction[];
  changes?: CorporateBookingChange[];
}
export interface CorporateBookingSettings {
  booking_schema_version: number; booking_enabled: boolean; booking_contact_email: string; booking_contact_phone: string;
  changes_schema_version?: number; changes_enabled?: boolean;
  outcomes_schema_version?: number;
  event_hours_schema_version?: number;
  exclusive_sessions_schema_version?: number;
}
export interface CorporateBookingNotice {
  id: string; account_id: string; booking_id: string; title: string; message: string; created_at: string; is_read: boolean;
}
export interface CorporateWorkflowFilters { query: string; from: string; to: string; status?: CorporateReservationStatus | 'Overdue' | 'Change requested' | 'Cancellation requested' | '' }
export interface CorporateBookingChange {
  id: string; booking_id: string; account_id: string; kind: 'Amendment' | 'Cancellation';
  status: 'Requested' | 'Approved' | 'Declined' | 'Closed';
  target_event_id: string | null; target_event_version: number | null; proposed_size: number | null;
  target_snapshot: CorporateEvent | null; original_values: Record<string, unknown>; reason: string;
  created_at: string; reviewed_at: string | null; review_note: string | null;
  additional_amount: number | null; payment_due_at: string | null;
}
/** Actual attendance and whole event duration entered by admin. */
export interface CorporateGroupAttendance {
  attendance_count: number; event_hours: number | null; note: string;
  recorded_by_name: string; updated_at: string;
}
export interface CorporateOutcomeSummary {
  bookings: number; accepted_places: number; completed_groups: number;
  attendance_instances: number; event_hours: number; groups_without_hours: number; overdue_bookings: number;
}
export interface CorporateOutcomeReport extends PagedRows<CorporateBookingRow> {
  summary: CorporateOutcomeSummary;
  /** Stable server revision of the whole filtered scope, not just this page. */
  snapshot: string;
}
