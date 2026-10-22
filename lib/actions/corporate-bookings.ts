/** Browser workflow calls. Protected database functions own capacity, status changes and history. */
import { supabase } from '@/lib/supabase';
import { corporateBookingsEnabled, corporateChangesEnabled, corporateOutcomesEnabled } from '@/lib/feature-flags';
import { isValidPhone, normalisePhone } from '@/lib/contact-details';
import { validateCorporateEvent } from '@/lib/corporate-booking-utils';
import type { CorporateEvent, CorporateEventInput, CorporateReservation, CorporateBookingDetail, CorporateBookingRow, CorporateBookingSettings, CorporateBookingNotice, CorporateWorkflowFilters, PagedRows } from '@/lib/corporate-booking-types';

async function call<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!corporateBookingsEnabled) throw new Error('Corporate booking rollout is not enabled on this deployment.');
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(['PGRST202','PGRST205','42P01','42703','42883'].includes(error.code ?? '')
    ? 'Corporate bookings are temporarily unavailable. Please contact the booking team.'
    : error.code === '40001' ? error.message.startsWith('Proposed event changed since submission.') ? error.message : 'This record changed while you were reviewing it. Refresh the record and review the latest details before retrying.' : error.message);
  if (data === null || data === undefined) throw new Error('The server returned no result. Refresh and check the saved record before retrying.');
  return data as T;
}
function pageArgs(page: number) {
  if (!Number.isInteger(page) || page < 1) throw new Error('Choose a valid page.');
  return { p_offset: (page - 1) * 10, p_limit: 10 };
}
function filters(input: CorporateWorkflowFilters) {
  if (input.query.length > 180 || input.from && input.to && input.to < input.from) throw new Error('Check the search text and date range.');
  return { p_query: input.query.trim(), p_from: input.from || null, p_to: input.to || null };
}
export const emptyWorkflowFilters: CorporateWorkflowFilters = { query: '', from: '', to: '', status: '' };
export async function getCorporateBookingSettings() {
  const settings = await call<CorporateBookingSettings>('corporate_booking_settings');
  if (settings.booking_schema_version !== 1) throw new Error('Corporate bookings are temporarily unavailable. Please contact the booking team.');
  if (corporateChangesEnabled && settings.changes_schema_version !== 1) throw new Error('Corporate change requests are temporarily unavailable. Please contact the booking team.');
  if (corporateOutcomesEnabled && settings.outcomes_schema_version !== 1) throw new Error('Corporate attendance/reporting is temporarily unavailable. Please contact the booking team.');
  return settings;
}
export async function configureCorporateBookings(enabled: boolean, email: string, phone: string) {
  const cleanEmail = email.trim(), cleanPhone = normalisePhone(phone);
  if (enabled && (!cleanEmail || !cleanPhone) || cleanEmail && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 254) || cleanPhone && !isValidPhone(cleanPhone)) throw new Error('Enter approved booking email and phone details before opening requests.');
  return call<CorporateBookingSettings>('corporate_configure_bookings', { p_enabled: enabled, p_email: cleanEmail, p_phone: cleanPhone });
}
export async function searchCorporateEvents(input = emptyWorkflowFilters, page = 1) {
  return call<PagedRows<CorporateEvent>>('corporate_search_events', { ...filters(input), ...pageArgs(page) });
}
export async function searchCorporateBookings(input = emptyWorkflowFilters, page = 1) {
  return call<PagedRows<CorporateBookingRow>>('corporate_search_bookings', { ...filters(input), p_status: input.status || '', ...pageArgs(page) });
}
export async function saveCorporateEvent(input: CorporateEventInput, reason: string, creationKey: string | null, current?: CorporateEvent) {
  validateCorporateEvent(input);
  const clean: CorporateEventInput = { title: input.title.trim(), description: input.description.trim(), location: input.location.trim(), starts_at: input.starts_at, ends_at: input.ends_at, capacity: input.capacity, min_group_size: input.min_group_size, max_group_size: input.max_group_size, is_published: input.is_published };
  if (!clean.title || clean.title.length > 180 || !clean.description || clean.description.length > 2000 || !clean.location || clean.location.length > 300 || !reason.trim() || reason.trim().length > 800) throw new Error('Complete the event details and a reason/message for this change.');
  return call<CorporateEvent>('corporate_save_event', { p_event_id: current?.id ?? null, p_version: current?.version ?? null, p_details: clean, p_creation_key: creationKey, p_reason: reason.trim() });
}
export async function requestCorporateBooking(event: Pick<CorporateEvent, 'id' | 'version'>, size: number, notes: string, key: string) {
  if (!Number.isInteger(size) || size < 1 || size > 2147483647 || notes.length > 800 || !key) throw new Error('Enter a whole-number group size, notes up to 800 characters and a request key.');
  return call<CorporateReservation>('corporate_request_booking', { p_event_id: event.id, p_event_version: event.version, p_group_size: size, p_notes: notes.trim(), p_request_key: key });
}
export async function getCorporateBookingDetail(id: string) { return call<CorporateBookingDetail>('corporate_booking_detail', { p_booking_id: id }); }
export async function setCorporatePaymentDeadline(booking: CorporateReservation, deadline: string, note: string) {
  if (!note.trim() || note.length > 800 || !Number.isFinite(Date.parse(deadline))) throw new Error('Enter a valid deadline and external follow-up note.');
  return call<CorporateReservation>('corporate_booking_deadline', { p_booking_id: booking.id, p_version: booking.version, p_deadline: deadline, p_note: note.trim() });
}
export async function rejectCorporateBooking(booking: CorporateReservation, reason: string) {
  if (!reason.trim() || reason.length > 800) throw new Error('Enter a rejection reason and any external payment/refund follow-up.');
  return call<CorporateReservation>('corporate_reject_booking', { p_booking_id: booking.id, p_version: booking.version, p_reason: reason.trim() });
}
export async function recordCorporatePayment(booking: CorporateReservation, key: string, reference: string, receivedOn: string, note: string) {
  if (!key || !reference.trim() || reference.length > 180 || !/^\d{4}-\d{2}-\d{2}$/.test(receivedOn) || note.length > 800) throw new Error('Enter a payment reference, valid received date and retry key.');
  return call<CorporateReservation>('corporate_record_payment', { p_booking_id: booking.id, p_version: booking.version, p_request_key: key, p_reference: reference.trim(), p_received_on: receivedOn, p_note: note.trim() });
}
export async function getCorporateBookingNotices(page = 1) { return call<PagedRows<CorporateBookingNotice>>('corporate_workflow_notices', pageArgs(page)); }

function requireChanges() {
  if (!corporateChangesEnabled) throw new Error('Corporate booking changes are not enabled on this deployment.');
}
/** One intent key is reused on a lost-response retry; database ownership and state checks remain authoritative. */
export async function requestCorporateChange(booking: CorporateReservation, kind: 'Amendment' | 'Cancellation', target: Pick<CorporateEvent, 'id' | 'version'> | null, size: number | null, reason: string, key: string) {
  requireChanges();
  if (!key || !reason.trim() || reason.trim().length > 800 || kind === 'Amendment' && (!target || !Number.isInteger(size) || size! < 1)) throw new Error('Enter the proposed event, whole-number group size and reason.');
  return call<CorporateBookingRow>('corporate_request_change', { p_booking_id: booking.id, p_version: booking.version, p_kind: kind, p_target_id: kind === 'Amendment' ? target?.id : null, p_target_version: kind === 'Amendment' ? target?.version : null, p_size: kind === 'Amendment' ? size : null, p_reason: reason.trim(), p_request_key: key });
}
export async function reviewCorporateChange(booking: CorporateReservation, changeId: string, approve: boolean, note: string, amount: number | null = null, deadline: string | null = null) {
  requireChanges();
  if (!note.trim() || note.trim().length > 800 || amount !== null && (!Number.isFinite(amount) || amount <= 0 || amount > 9999999999.99 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.0001)) throw new Error('Enter a decision note and, if applicable, a positive ZAR amount with at most two decimals.');
  return call<CorporateBookingRow>('corporate_review_change', { p_booking_id: booking.id, p_version: booking.version, p_change_id: changeId, p_approve: approve, p_note: note.trim(), p_amount: amount, p_deadline: deadline });
}
export async function cancelCorporateEvent(event: Pick<CorporateEvent, 'id' | 'version'>, reason: string) {
  requireChanges();
  if (!reason.trim() || reason.trim().length > 800) throw new Error('Record a cancellation reason and external payment/refund follow-up.');
  return call<CorporateEvent>('corporate_cancel_event', { p_event_id: event.id, p_version: event.version, p_reason: reason.trim() });
}
export async function configureCorporateChanges(enabled: boolean) {
  requireChanges();
  return call<CorporateBookingSettings>('corporate_configure_changes', { p_enabled: enabled });
}
