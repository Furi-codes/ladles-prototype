/**
 * Loads rows and search options needed by the selected admin report.
 * Related queries are restricted to selected event IDs, and paged loading avoids silently
 * cutting off a report.
 */

import { supabase } from '@/data/supabase/client';
import type { CorporateBooking, CorporateCompany, Event, EventSlot, Booking, AttendanceRecord } from '@/business/shared/types';
import type { ReportFilter } from '@/business/admin/utils/reporting';

/** Explicit pagination avoids silently truncating reports at the API row limit. */
export async function allRows<T>(table: string, order = 'id'): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ;) {
    const { data, error, count } = await supabase.from(table).select('*', { count: 'exact' }).order(order).range(offset, offset + 499);
    if (error) throw new Error(featureError(error));
    rows.push(...(data as T[]));
    // Advance by returned rows, because the server may return fewer than the requested 500.
    offset += data.length;
    if (count === null) throw new Error('The server did not return a complete row count. Please retry.');
    if (offset >= count) return rows;
    if (!data.length) throw new Error('Data changed while loading. Refresh to load a complete report.');
  }
}
/** Gives missing database objects a setup message; other failures keep their database message. */
export function featureError(error: { message: string; code?: string }) {
  return ['42P01', 'PGRST205', 'PGRST202'].includes(error.code ?? '')
    ? 'This section is temporarily unavailable. Please try again later.'
    : error.message;
}
/** Loads matching events first, then their slots/bookings/groups and the bookings' attendance. */
export async function loadReportData(filter: ReportFilter, includeLegacyCorporate = true) {
  const events: Event[] = [];
  // Reversed dates produce an empty report instead of unrelated data. Category filtering is in reporting.ts.
  if (filter.from && filter.to && filter.from > filter.to) return { events, slots: [], bookings: [], attendance: [], corporate: [], companies: [] };
  for (let offset = 0; ;) {
    let query = supabase.from('events').select('*', { count: 'exact' }).order('id');
    if (filter.from) query = query.gte('date', filter.from);
    if (filter.to) query = query.lte('date', filter.to);
    if (filter.event) query = query.eq('id', filter.event);
    if (filter.location) query = query.eq('location', filter.location);
    const { data, error, count } = await query.range(offset, offset + 499);
    if (error) throw new Error(featureError(error));
    if (count === null) throw new Error('The server did not return a complete row count. Please retry.');
    events.push(...data as Event[]); offset += data.length;
    if (offset >= count) break;
    if (!data.length) throw new Error('Data changed while loading. Refresh to load a complete report.');
  }
  const ids = events.map(e => e.id);
  // Related queries use event IDs so rows outside this date/location/event scope are not downloaded.
  const [slots, bookings, corporate, companies] = await Promise.all([
    reportRelatedRows<EventSlot>('event_slots', 'event_id', ids), reportRelatedRows<Booking>('bookings', 'event_id', ids),
    includeLegacyCorporate ? reportRelatedRows<CorporateBooking>('corporate_bookings', 'event_id', ids) : Promise.resolve([] as CorporateBooking[]),
    includeLegacyCorporate ? allRows<CorporateCompany>('corporate_companies') : Promise.resolve([] as CorporateCompany[]),
  ]);
  const attendance = await reportRelatedRows<AttendanceRecord>('attendance_records', 'booking_id', bookings.map(b => b.id));
  return { events, slots, bookings, attendance, corporate, companies };
}
/** Volunteer analytics must not query legacy CSR tables or mix group totals into volunteer figures. */
export function loadVolunteerReportData(filter: ReportFilter) { return loadReportData(filter, false); }
/** Small IN batches avoid URL limits; each batch still follows the server's exact count. */
export async function reportRelatedRows<T>(table: string, column: string, ids: number[]): Promise<T[]> {
  const rows: T[] = [];
  for (let batch = 0; batch < ids.length; batch += 100) {
    for (let offset = 0; ;) {
      const { data, error, count } = await supabase.from(table).select('*', { count: 'exact' }).in(column, ids.slice(batch, batch + 100)).order('id').range(offset, offset + 499);
      if (error) throw new Error(featureError(error));
      if (count === null) throw new Error('The server did not return a complete row count. Please retry.');
      rows.push(...data as T[]); offset += data.length;
      if (offset >= count) break;
      if (!data.length) throw new Error('Data changed while loading. Refresh to load a complete report.');
    }
  }
  return rows;
}
/** Escapes user wildcard characters so ilike searches for the supplied text, not a custom pattern. */
function literalPattern(query: string) { return `%${query.trim().replace(/[\\%_]/g, '\\$&')}%`; }
/** Returns eight recent matching event choices; an empty term limits suggestions to today or earlier. */
export async function searchReportEvents(term: string) {
  let query = supabase.from('events').select('id,title,date').order('date', { ascending: false }).order('id', { ascending: false }).limit(8);
  if (term.trim()) query = query.ilike('title', literalPattern(term));
  else query = query.lte('date', new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
  const { data, error } = await query;
  if (error) throw new Error(featureError(error));
  return data.map(e => ({ value: String(e.id), label: `${e.title} · ${e.date}` }));
}
/** Builds up to eight distinct location choices from fifty recent matching events, not all locations. */
export async function searchReportLocations(term: string) {
  const { data, error } = await supabase.from('events').select('location').ilike('location', literalPattern(term)).order('date', { ascending: false }).order('id', { ascending: false }).limit(50);
  if (error) throw new Error(featureError(error));
  return Array.from(new Set(data.map(e => String(e.location)).filter(Boolean))).sort().slice(0, 8).map(location => ({ value: location, label: location }));
}

