import type { CorporateBookingRow } from './corporate-booking-types';
import { corporateLocalInput } from './corporate-booking-utils';

/** Blank hours stay unknown. Zero is an explicit recorded value, including a zero-attendance group. */
export function cleanCorporateAttendance(groupSize: number, count: string, hours: string, note: string) {
  const attendanceCount = Number(count), eventHours = hours.trim() === '' ? null : Number(hours);
  if (!count.trim() || !Number.isInteger(attendanceCount) || attendanceCount < 0 || attendanceCount > groupSize ||
    eventHours !== null && (!Number.isInteger(eventHours) || eventHours < 0 || eventHours > 24 || attendanceCount === 0 && eventHours > 0) ||
    !note.trim() || note.trim().length > 800) throw new Error('Enter whole-number attendance within the booked group size and a note. Event hours must be blank or a non-negative whole number from 0 to 24; zero attendees cannot have positive hours.');
  return { attendance_count: attendanceCount, event_hours: eventHours, note: note.trim() };
}
export function canRecordCorporateAttendance(booking: CorporateBookingRow, now = Date.now()) {
  return ['Confirmed','Completed'].includes(booking.status) && !booking.event.cancelled_at && booking.event.state !== 'Cancelled' && !booking.pending_change && Date.parse(booking.event.ends_at) <= now;
}
function csvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return '"' + (/^\s*[=+@-]/.test(text) || /^[\t\r]/.test(text) ? "'" + text : text).replaceAll('"','""') + '"';
}
/** Aggregate group data only: no phone, email, billing address, private notes or payment references. */
export function corporateOutcomesCsv(rows: CorporateBookingRow[]) {
  if (!rows.length) throw new Error('There are no filtered bookings to export.');
  const lines: unknown[][] = [['Booking ID','Company at submission','Corporate event','Start (South Africa)','End (South Africa)','Location','Booked group size','Booking status','Actual attendees','Event hours']];
  for (const row of rows) {
    const completed = row.status === 'Completed' && !row.event.cancelled_at && row.event.state !== 'Cancelled';
    lines.push([row.id,row.contact_snapshot.company_name,row.event.title,corporateLocalInput(row.event.starts_at).replace('T',' '),corporateLocalInput(row.event.ends_at).replace('T',' '),row.event.location,row.group_size,row.status,completed ? row.attendance?.attendance_count : null,completed ? row.attendance?.event_hours : null]);
  }
  return '\uFEFF' + lines.map(line => line.map(csvCell).join(',')).join('\r\n');
}
