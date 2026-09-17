import type { AttendanceRecord, Booking, CorporateBooking, Event, EventSlot } from './types';
export interface ReportFilter { from: string; to: string; location: string; event: string }
export interface PerformanceRow { id: number; event: string; date: string; capacity: number; bookings: number; attendance: number; rate: number | null; individualHours: number; corporateHours: number; groups: number; confirmed: number }
export function eventMatches(event: Event, filter: ReportFilter) {
  return (!filter.from || event.date >= filter.from) && (!filter.to || event.date <= filter.to)
    && (!filter.location || event.location === filter.location) && (!filter.event || String(event.id) === filter.event);
}
export function performanceRows(events: Event[], slots: EventSlot[], bookings: Booking[], attendance: AttendanceRecord[], corporate: CorporateBooking[], filter: ReportFilter): PerformanceRow[] {
  return events.filter(e => eventMatches(e, filter)).map(event => {
    const individual = bookings.filter(b => b.event_id === event.id);
    const ids = new Set(individual.map(b => b.id));
    const records = attendance.filter(a => ids.has(a.booking_id));
    const groups = corporate.filter(b => b.event_id === event.id && b.status !== 'Cancelled');
    const total = individual.length + groups.reduce((s, b) => s + b.team_size, 0);
    const attended = records.filter(a => a.clocked_in_at !== null).length + groups.reduce((s, b) => s + (b.status === 'Completed' ? b.attendance_count ?? 0 : 0), 0);
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
  const selected = bookings.filter(b => ids.has(b.event_id) && (!companyId || String(b.company_id) === companyId) && b.status !== 'Cancelled');
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
