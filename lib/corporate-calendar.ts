import { corporateLocalInput } from './corporate-booking-utils';
import type { CorporateBookingRow, CorporateEvent, CorporateWorkflowFilters, PagedRows } from './corporate-booking-types';

export type SessionState = 'available' | 'reserved' | 'unpublished' | 'cancelled' | 'past';
/** Presentation never grants booking access; the protected RPC checks time, publication and exclusivity again. */
export function sessionPresentation(event: Partial<CorporateEvent>, now = Date.now()): { state: SessionState; label: string } {
  if (event.cancelled_at || event.state==='Cancelled') return { state:'cancelled',label:'Cancelled' };
  if (!event.starts_at || !Number.isFinite(Date.parse(event.starts_at)) || Date.parse(event.starts_at)<=now) return { state:'past',label:'Past session' };
  if ((event.reserved_places ?? 0)>0 || event.state==='Reserved' || event.state==='Full') return { state:'reserved',label:'Reserved' };
  if (event.is_published===false || event.state==='Closed') return { state:'unpublished',label:'Unpublished' };
  return { state:'available',label:'Available' };
}
export function canRequestCorporateSession(event: CorporateEvent, now = Date.now()): boolean {
  return sessionPresentation(event,now).state==='available' && event.state==='Available' && event.remaining>=event.min_group_size;
}
/** A company may propose a size change to its own held session, but never a past,
 * cancelled or unpublished one. The RPC still checks the latest reservation. */
export function canProposeCorporateSession(event: CorporateEvent, booking: Pick<CorporateBookingRow, 'event_id' | 'status'>, now = Date.now()): boolean {
  if (canRequestCorporateSession(event,now)) return true;
  return event.id===booking.event_id && ['Pending payment','Pending additional payment','Confirmed'].includes(booking.status)
    && sessionPresentation(event,now).state==='reserved' && event.is_published!==false && event.max_group_size>=event.min_group_size;
}

/** Use date keys in South African time, even when the browser is in another timezone. */
export function calendarDate(timestamp: string | number = Date.now()): string {
  return corporateLocalInput(timestamp).slice(0, 10);
}
export function calendarMonthDays(month: string): (string | null)[][] {
  const { year, index } = monthParts(month);
  const offset = (new Date(Date.UTC(year, index, 1)).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, index + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array(offset).fill(null);
  for (let day = 1; day <= count; day++) cells.push(`${month}-${String(day).padStart(2, '0')}`);
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, row) => cells.slice(row * 7, row * 7 + 7));
}
function monthParts(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month < '1900-01' || month > '9998-12') throw new Error('Choose a valid calendar month.');
  const [year, number] = month.split('-').map(Number);
  return { year, index: number - 1 };
}
export function moveCalendarMonth(month: string, amount: number): string {
  const { year, index } = monthParts(month);
  const next = new Date(Date.UTC(year, index + amount, 1)).toISOString().slice(0, 7);
  monthParts(next);
  return next;
}
/** Intersect search dates with the displayed month; never load an unbounded calendar. */
export function calendarFilters(month: string, filters: CorporateWorkflowFilters): CorporateWorkflowFilters | null {
  if (filters.from && filters.to && filters.from > filters.to) throw new Error('From date must be on or before To date.');
  const { year, index } = monthParts(month);
  const first = `${month}-01`, last = `${month}-${new Date(Date.UTC(year, index + 1, 0)).getUTCDate()}`;
  const from = filters.from && filters.from > first ? filters.from : first;
  const to = filters.to && filters.to < last ? filters.to : last;
  return from > to ? null : { ...filters, from, to };
}
export function calendarLabel(date: string, monthOnly = false): string {
  return new Date(`${date.length === 7 ? date + '-01' : date}T12:00:00+02:00`).toLocaleDateString('en-ZA', {
    timeZone: 'Africa/Johannesburg', year: 'numeric', month: 'long', ...(monthOnly ? {} : { day: 'numeric' }),
  });
}
export function calendarTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString('en-ZA', { timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit', hour12: false });
}
/** A calendar needs every matching row, not just the first ten results from the list. */
export async function loadCalendarRows<T extends { id: string }>(fetchPage: (page: number) => Promise<PagedRows<T>>): Promise<T[]> {
  const rows: T[] = [], ids = new Set<string>();
  let expected: number | undefined;
  for (let page = 1; ; page++) {
    const result = await fetchPage(page);
    if (!Number.isSafeInteger(result.total) || result.total < 0 || !Array.isArray(result.rows) ||
      expected !== undefined && result.total !== expected || result.rows.length !== Math.min(10, result.total - rows.length)) {
      throw new Error('The calendar changed or could not be loaded completely. Refresh to try again.');
    }
    if (result.total > 1000) throw new Error('Too many results for one month. Narrow your search to view the calendar.');
    expected = result.total;
    for (const row of result.rows) {
      if (!row.id || ids.has(row.id)) throw new Error('The calendar changed while loading. Refresh to try again.');
      ids.add(row.id); rows.push(row);
    }
    if (rows.length === expected) return rows;
  }
}
