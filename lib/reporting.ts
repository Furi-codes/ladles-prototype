import type { AttendanceRecord, Booking, CorporateBooking, Event, EventSlot } from './types';
export interface ReportFilter { from: string; to: string; location: string; event: string; category?: string }
export const reportPresets = ['Latest 6 months', 'Recent Activity', 'Monthly Volunteer Activity', 'Event Attendance', 'Volunteer Hours', 'Corporate Participation', 'Custom Report'] as const;
export type ReportPreset = typeof reportPresets[number];
export function presetFilter(preset: ReportPreset, now = new Date()): ReportFilter {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const start = new Date(`${today}T12:00:00Z`);
  if (preset === 'Latest 6 months') {
    start.setUTCDate(1);
    start.setUTCMonth(start.getUTCMonth() - 5);
    return { from: start.toISOString().slice(0, 10), to: today, location: '', event: '' };
  }
  start.setUTCDate(start.getUTCDate() - (preset === 'Event Attendance' ? 89 : 29));
  return { from: preset === 'Custom Report' ? '' : ['Monthly Volunteer Activity', 'Volunteer Hours', 'Corporate Participation'].includes(preset) ? `${today.slice(0, 7)}-01` : start.toISOString().slice(0, 10), to: preset === 'Custom Report' ? '' : today, location: '', event: '' };
}
export interface PerformanceRow { id: number; event: string; date: string; capacity: number; bookings: number; attendance: number; rate: number | null; individualHours: number; corporateHours: number; groups: number; confirmed: number }
export interface AnalyticsData { events: Event[]; slots: EventSlot[]; bookings: Booking[]; attendance: AttendanceRecord[]; corporate: CorporateBooking[] }
/** One scope for charts, totals, heatmap, table and CSV. Cancelled events are excluded. */
export function selectedReportData(data: AnalyticsData, filter: ReportFilter, corporateOnly = false, company = ''): AnalyticsData {
  const corporate = data.corporate.filter(b => b.status !== 'Cancelled' && (!corporateOnly || !company || String(b.company_id) === company));
  const groupEvents = new Set(corporate.map(b => b.event_id));
  const invalid = Boolean(filter.from && filter.to && filter.from > filter.to);
  const events = data.events.filter(e => !invalid && e.status !== 'Cancelled' && eventMatches(e, filter) && (!corporateOnly || groupEvents.has(e.id)));
  const ids = new Set(events.map(e => e.id));
  const bookings = corporateOnly ? [] : data.bookings.filter(b => ids.has(b.event_id));
  const bookingIds = new Set(bookings.map(b => b.id));
  return { events, bookings, slots: data.slots.filter(s => ids.has(s.event_id)), attendance: data.attendance.filter(a => bookingIds.has(a.booking_id)), corporate: corporate.filter(b => ids.has(b.event_id)) };
}
export function selectedReportRows(data: { events: Event[]; slots: EventSlot[]; bookings: Booking[]; attendance: AttendanceRecord[]; corporate: CorporateBooking[] }, filter: ReportFilter, corporateOnly = false, company = '') {
  const scoped = selectedReportData(data, filter, corporateOnly, company);
  return performanceRows(scoped.events, scoped.slots, scoped.bookings, scoped.attendance, scoped.corporate, filter);
}
/** Monthly points use EVENT dates, matching report filters, rather than clock-in timestamps. */
export function participationSummary(data: AnalyticsData, filter: ReportFilter) {
  const eventById = new Map(data.events.map(e => [e.id, e]));
  const checkedIn = new Set(data.attendance.filter(a => Boolean(a.clocked_in_at)).map(a => a.booking_id));
  const months = new Map<string, { volunteers: Set<string>; attendance: number }>();
  const eventMonths = data.events.map(e => e.date.slice(0, 7)).sort();
  const first = filter.from.slice(0, 7) || eventMonths[0];
  const last = filter.to.slice(0, 7) || eventMonths.at(-1);
  if (first && last && first <= last) {
    const cursor = new Date(`${first}-01T00:00:00Z`);
    while (cursor.toISOString().slice(0, 7) <= last) {
      months.set(cursor.toISOString().slice(0, 7), { volunteers: new Set(), attendance: 0 });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }
  const people = new Set<string>();
  for (const booking of data.bookings) {
    if (!checkedIn.has(booking.id)) continue;
    const month = months.get(eventById.get(booking.event_id)?.date.slice(0, 7) ?? '');
    if (!month) continue;
    if (booking.user_id) { month.volunteers.add(booking.user_id); people.add(booking.user_id); }
    month.attendance += 1;
  }
  for (const booking of data.corporate) {
    if (booking.status !== 'Completed') continue;
    const month = months.get(eventById.get(booking.event_id)?.date.slice(0, 7) ?? '');
    if (month) month.attendance += booking.attendance_count ?? 0;
  }
  return { uniqueVolunteers: people.size, months: [...months].map(([month, value]) => ({ month, uniqueVolunteers: value.volunteers.size, attendance: value.attendance })) };
}
export function eventMatches(event: Event, filter: ReportFilter) {
  return (!filter.from || event.date >= filter.from) && (!filter.to || event.date <= filter.to)
    && (!filter.location || event.location === filter.location) && (!filter.event || String(event.id) === filter.event)
    && (!filter.category || (event.category || 'Other') === filter.category);
}
export function performanceRows(events: Event[], slots: EventSlot[], bookings: Booking[], attendance: AttendanceRecord[], corporate: CorporateBooking[], filter: ReportFilter): PerformanceRow[] {
  return events.filter(e => eventMatches(e, filter)).map(event => {
    const individual = bookings.filter(b => b.event_id === event.id);
    const ids = new Set(individual.map(b => b.id));
    const records = attendance.filter(a => ids.has(a.booking_id));
    const groups = corporate.filter(b => b.event_id === event.id && event.status !== 'Cancelled' && b.status !== 'Cancelled');
    const total = individual.length + groups.reduce((s, b) => s + b.team_size, 0);
    const attended = new Set(records.filter(a => Boolean(a.clocked_in_at)).map(a => a.booking_id)).size + groups.reduce((s, b) => s + (b.status === 'Completed' ? b.attendance_count ?? 0 : 0), 0);
    return { id: event.id, event: event.title ?? 'Untitled event', date: event.date ?? '',
      capacity: slots.filter(s => s.event_id === event.id).reduce((n, s) => n + s.capacity, 0),
      bookings: total, attendance: attended, rate: total ? attended / total * 100 : null,
      individualHours: records.reduce((n, a) => n + (a.worked_minutes ?? 0), 0) / 60,
      corporateHours: groups.reduce((n, b) => n + (b.status === 'Completed' ? Number(b.volunteer_hours ?? 0) : 0), 0),
      groups: groups.length, confirmed: individual.filter(b => b.status === 'Confirmed').length + groups.filter(b => b.status === 'Confirmed').length };
  });
}
export function corporateImpact(bookings: CorporateBooking[], events: Event[], companyId: string, filter: ReportFilter) {
  const ids = new Set(events.filter(e => eventMatches(e, filter)).map(e => e.id));
  const selected = bookings.filter(b => ids.has(b.event_id) && events.find(e => e.id === b.event_id)?.status !== 'Cancelled' && (!companyId || String(b.company_id) === companyId) && b.status !== 'Cancelled');
  return { participating: selected.reduce((n, b) => n + b.team_size, 0), events: new Set(selected.map(b => b.event_id)).size,
    attendance: selected.reduce((n, b) => n + (b.status === 'Completed' ? b.attendance_count ?? 0 : 0), 0),
    hours: selected.reduce((n, b) => n + (b.status === 'Completed' ? Number(b.volunteer_hours ?? 0) : 0), 0) };
}
/** Quote every cell and neutralize spreadsheet formula injection, including leading whitespace. */
export function csvCell(value: string | number | null) {
  let text = value === null ? '' : String(value);
  if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function reportCsv(rows: PerformanceRow[]) {
  if (!rows.length) return null;
  const header = ['Event','Date','Capacity','Reserved places','Recorded attendance','Attendance rate (%)','Verified individual hours','Recorded corporate hours','Corporate groups','Confirmed booking records'];
  return '\uFEFF' + [header, ...rows.map(r => [r.event,r.date,r.capacity,r.bookings,r.attendance,r.rate === null ? null : r.rate.toFixed(2),r.individualHours.toFixed(2),r.corporateHours.toFixed(2),r.groups,r.confirmed])].map(r => r.map(csvCell).join(',')).join('\r\n');
}
