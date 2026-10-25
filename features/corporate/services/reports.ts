/**
 * Records corporate attendance and loads outcome reports.
 * Exports check every page against the same report revision so a partial or mixed report is not
 * downloaded.
 */

import { supabase } from '@/lib/supabase/client';
import { corporateOutcomesEnabled } from '@/lib/config/features';
import { canRecordCorporateAttendance, cleanCorporateAttendance } from '@/features/corporate/utils/outcomes';
import type { CorporateBookingRow, CorporateOutcomeReport, CorporateWorkflowFilters } from '@/features/corporate/types/bookings';

/**
 * Use the attendance/report feature gate and turn schema/stale-version failures into messages
 * callers can act on.
 */
async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
  if (!corporateOutcomesEnabled) throw new Error('Corporate attendance/reporting is not enabled yet. Your existing booking records are unchanged.');
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(['PGRST202','PGRST205','42P01','42703','42883'].includes(error.code || '') ? 'Corporate attendance/reporting is temporarily unavailable. Please contact the booking team.' : error.code === '40001' ? 'This record or report changed. Refresh and review the latest details before retrying.' : error.message);
  if (data === null || data === undefined) throw new Error('No result was returned. Refresh to check the saved record before retrying.');
  return data as T;
}
/**
 * Check eligibility and whole-event hours before sending attendance with the booking version and
 * retry key. The database repeats the workflow checks.
 */
export async function recordCorporateAttendance(booking: CorporateBookingRow, count: string, hours: string, note: string, key: string) {
  if (!canRecordCorporateAttendance(booking)) throw new Error('Only ended, confirmed/completed bookings without unresolved changes can have attendance recorded.');
  const input = cleanCorporateAttendance(booking.group_size, count, hours, note);
  if (!key) throw new Error('An attendance retry key is required.');
  return call<CorporateBookingRow>('corporate_record_event_attendance', { p_booking_id: booking.id, p_version: booking.version, p_request_key: key, p_count: input.attendance_count, p_hours: input.event_hours, p_note: input.note });
}
/**
 * Validate the report page and totals returned by the RPC. An incomplete result must not become
 * a misleading export.
 */
export async function getCorporateOutcomeReport(filters: CorporateWorkflowFilters, page = 1) {
  if (!Number.isSafeInteger(page) || page < 1 || filters.query.length > 180 || filters.from && filters.to && filters.from > filters.to) throw new Error('Check the report filters and page.');
  const result = await call<CorporateOutcomeReport>('corporate_event_outcome_report', { p_query: filters.query.trim(), p_status: filters.status || '', p_from: filters.from || null, p_to: filters.to || null, p_offset: (page - 1) * 10, p_limit: 10 });
  const counts = ['bookings','accepted_places','completed_groups','attendance_instances','groups_without_hours','overdue_bookings'] as const;
  if (!Array.isArray(result.rows) || !Number.isSafeInteger(result.total) || result.total < 0 || result.rows.length !== Math.min(10,Math.max(0,result.total-(page-1)*10)) || typeof result.snapshot !== 'string' || !result.snapshot || !result.summary ||
    !counts.every(key => Number.isSafeInteger(result.summary[key]) && result.summary[key] >= 0) || result.summary.bookings !== result.total || !Number.isSafeInteger(result.summary.event_hours) || result.summary.event_hours < 0) throw new Error('The report is incomplete. No export can be produced.');
  return result;
}
/** Don't export only the visible page or silently combine revisions while somebody edits bookings. */
export async function loadAllCorporateOutcomeRows(filters: CorporateWorkflowFilters) {
  const first = await getCorporateOutcomeReport(filters), rows = [...first.rows];
  if (first.total > 10000) throw new Error('Narrow the report filters to 10,000 bookings or fewer before exporting/printing.');
  if (first.rows.length !== Math.min(first.total,10)) throw new Error('The report page is incomplete. Retry the report before exporting.');
  for (let page = 2; rows.length < first.total; page++) {
    const next = await getCorporateOutcomeReport(filters, page);
    if (next.snapshot !== first.snapshot || next.total !== first.total || next.rows.length !== Math.min(10,first.total - rows.length)) throw new Error('The report changed or a page is incomplete. Refresh and try again.');
    rows.push(...next.rows);
  }
  if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Duplicate report rows detected. No export was produced.');
  const checked = await getCorporateOutcomeReport(filters);
  if (checked.snapshot !== first.snapshot || checked.total !== first.total) throw new Error('The report changed during export. Refresh and try again.');
  return rows;
}
