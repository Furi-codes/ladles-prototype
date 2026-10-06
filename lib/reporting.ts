import type { AttendanceRecord, Booking, CorporateBooking, CorporateCompany, Event, EventSlot } from './types';
export interface ReportFilter { from: string; to: string; location: string; event: string }
export const reportPresets = ['Recent Activity', 'Monthly Volunteer Activity', 'Event Attendance', 'Volunteer Hours', 'Corporate Participation', 'Custom Report'] as const;
export type ReportPreset = typeof reportPresets[number];
export function presetFilter(preset: ReportPreset, now = new Date()): ReportFilter {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const start = new Date(`${today}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - (preset === 'Event Attendance' ? 89 : 29));
  return { from: preset === 'Custom Report' ? '' : ['Monthly Volunteer Activity', 'Volunteer Hours', 'Corporate Participation'].includes(preset) ? `${today.slice(0, 7)}-01` : start.toISOString().slice(0, 10), to: preset === 'Custom Report' ? '' : today, location: '', event: '' };
}
export interface PerformanceRow { id: number; event: string; date: string; capacity: number; corporateCapacity: number; individualReserved: number; corporateReserved: number; bookings: number; attendance: number; rate: number | null; individualHours: number; corporateHours: number; groups: number; confirmed: number }
export function selectedReportRows(data: { events: Event[]; slots: EventSlot[]; bookings: Booking[]; attendance: AttendanceRecord[]; corporate: CorporateBooking[] }, filter: ReportFilter, corporateOnly = false, company = '') {
  if (filter.from && filter.to && filter.from > filter.to) return [];
  return performanceRows(data.events, data.slots, corporateOnly ? [] : data.bookings, data.attendance,
    data.corporate.filter(b => !corporateOnly || !company || String(b.company_id) === company), filter)
    .filter(row => !corporateOnly || row.groups > 0);
}
export function eventMatches(event: Event, filter: ReportFilter) {
  return (!filter.from || event.date >= filter.from) && (!filter.to || event.date <= filter.to)
    && (!filter.location || event.location === filter.location) && (!filter.event || String(event.id) === filter.event);
}
export function performanceRows(events: Event[], slots: EventSlot[], bookings: Booking[], attendance: AttendanceRecord[], corporate: CorporateBooking[], filter: ReportFilter): PerformanceRow[] {
  return events.filter(e => eventMatches(e, filter)).map(event => {
    const individual = bookings.filter(b => b.event_id === event.id && event.status !== 'Cancelled');
    const ids = new Set(individual.map(b => b.id));
    const records = attendance.filter(a => ids.has(a.booking_id));
    const groups = corporate.filter(b => b.event_id === event.id && event.status !== 'Cancelled' && b.status !== 'Cancelled');
    const eventSlotIds = new Set(slots.filter(s => s.event_id === event.id).map(s => s.id));
    const total = individual.length + groups.reduce((s, b) => s + b.team_size, 0);
    const attended = records.filter(a => a.clocked_in_at !== null).length + groups.reduce((s, b) => s + (b.status === 'Completed' ? b.attendance_count ?? 0 : 0), 0);
    return { id: event.id, event: event.title ?? 'Untitled event', date: event.date ?? '',
      capacity: slots.filter(s => s.event_id === event.id).reduce((n, s) => n + s.capacity, 0),
      corporateCapacity: slots.filter(s => s.event_id === event.id).reduce((n, s) => n + (s.corporate_capacity ?? 0), 0),
      individualReserved: individual.filter(b => b.event_slot_id != null && eventSlotIds.has(b.event_slot_id)).length, corporateReserved: groups.reduce((n, b) => n + b.team_size, 0),
      bookings: total, attendance: attended, rate: total ? attended / total * 100 : null,
      individualHours: records.reduce((n, a) => n + (a.clocked_in_at && a.clocked_out_at ? a.worked_minutes ?? 0 : 0), 0) / 60,
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
  const header = ['Event','Date','Individual capacity','Corporate capacity','Individual reserved','Corporate reserved','Total booked participants','Recorded attendance','Attendance rate (%)','Verified individual hours','Recorded corporate hours','Corporate groups','Confirmed booking records'];
  return '\uFEFF' + [header, ...rows.map(r => [r.event,r.date,r.capacity,r.corporateCapacity,r.individualReserved,r.corporateReserved,r.bookings,r.attendance,r.rate === null ? null : r.rate.toFixed(2),r.individualHours.toFixed(2),r.corporateHours.toFixed(2),r.groups,r.confirmed])].map(r => r.map(csvCell).join(',')).join('\r\n');
}

export const dateRanges = ['Last 30 days', 'Last 3 months', 'Last 6 months', 'Last 12 months', 'Custom date range'] as const;
export type DateRange = typeof dateRanges[number];
export function dateRangeFilter(range: DateRange, now = new Date()): ReportFilter {
  const to = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const start = new Date(`${to}T12:00:00Z`);
  if (range === 'Last 30 days') start.setUTCDate(start.getUTCDate() - 29);
  else if (range !== 'Custom date range') {
    // Rolling calendar months, clamped at month-end; both endpoints are inclusive.
    const day = start.getUTCDate();
    start.setUTCDate(1);
    start.setUTCMonth(start.getUTCMonth() - Number(range.split(' ')[1]));
    const lastDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
    start.setUTCDate(Math.min(day, lastDay));
  }
  return { from: start.toISOString().slice(0, 10), to, location: '', event: '' };
}
export interface ReportData {
  events: Event[]; slots: EventSlot[]; bookings: Booking[]; attendance: AttendanceRecord[];
  corporate: CorporateBooking[]; companies: Pick<CorporateCompany, 'id' | 'name'>[];
}
export function reportAnalytics(data: ReportData, filter: ReportFilter, corporateOnly = false, company = '') {
  const valid = !(filter.from && filter.to && filter.from > filter.to);
  const events = valid ? data.events.filter(e => eventMatches(e, filter)) : [];
  const liveIds = new Set(events.filter(e => e.status !== 'Cancelled').map(e => e.id));
  const corporate = data.corporate.filter(b => events.some(e => e.id === b.event_id) && (!corporateOnly || !company || String(b.company_id) === company));
  const bookings = corporateOnly ? [] : data.bookings.filter(b => liveIds.has(b.event_id));
  const bookingMap = new Map(bookings.map(b => [b.id, b]));
  const active = new Set<string>();
  const completedEvents = new Set<number>();
  for (const record of data.attendance) {
    const booking = bookingMap.get(record.booking_id);
    if (!booking || !record.clocked_in_at) continue;
    if (booking.user_id) active.add(booking.user_id);
    if (record.clocked_out_at && record.worked_minutes !== null) completedEvents.add(booking.event_id);
  }
  const companyHours = new Map<number, number>();
  for (const booking of corporate) {
    if (!liveIds.has(booking.event_id) || booking.status !== 'Completed') continue;
    if ((booking.attendance_count ?? 0) > 0) completedEvents.add(booking.event_id);
    companyHours.set(booking.company_id, (companyHours.get(booking.company_id) ?? 0) + Number(booking.volunteer_hours ?? 0));
  }
  const rows = selectedReportRows(data, filter, corporateOnly, company).filter(row => liveIds.has(row.id));
  const months = new Map<string, { month: string; hours: number; booked: number; attended: number }>();
  const from = filter.from || events.map(e => e.date).sort()[0];
  const to = filter.to || events.map(e => e.date).sort().at(-1);
  if (valid && from && to) {
    const cursor = new Date(`${from.slice(0, 7)}-01T12:00:00Z`);
    while (cursor.toISOString().slice(0, 7) <= to.slice(0, 7)) {
      const month = cursor.toISOString().slice(0, 7);
      months.set(month, { month, hours: 0, booked: 0, attended: 0 });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }
  for (const row of rows) {
    const bucket = months.get(row.date.slice(0, 7));
    if (bucket) { bucket.hours += row.individualHours + row.corporateHours; bucket.booked += row.bookings; bucket.attended += row.attendance; }
  }
  const monthly = [...months.values()];
  const booked = rows.reduce((sum, row) => sum + row.bookings, 0);
  const attended = rows.reduce((sum, row) => sum + row.attendance, 0);
  const statuses = (['Pending', 'Confirmed', 'Completed', 'Cancelled'] as const).map(status => ({ status, count: corporate.filter(b => b.status === status).length }));
  return {
    rows, monthly, statuses, activeVolunteers: corporateOnly ? null : active.size, completedEvents: completedEvents.size,
    hours: monthly.reduce((sum, month) => sum + month.hours, 0), attendanceRate: booked ? attended / booked * 100 : null,
    companies: [...companyHours].filter(([, hours]) => hours > 0).map(([id, hours]) => ({ id, name: data.companies.find(c => c.id === id)?.name ?? `Company ${id}`, hours })).sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name)),
  };
}
export type ReportAnalytics = ReturnType<typeof reportAnalytics>;
