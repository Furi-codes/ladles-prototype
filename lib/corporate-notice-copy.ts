import type { CorporateBookingNotice } from './corporate-booking-types';

// Older notices combine an internal ID, a note and long workflow instructions.
// Tidy that presentation without rewriting the stored notice or audit history.
const nextSteps = [
  ['This request is closed and does not hold a session. You may request another available session. Discuss any payment/refund with the booking team externally.', 'You can request another available session. Contact the booking team about any refund.'],
  ['This booking is cancelled. Do not attend on this booking. You may request another available session; arrange any refund externally with the booking team.', 'Do not attend this session. Contact the booking team about any refund.'],
  ['Wait for admin review in My bookings. Your original booking is unchanged; an unaccepted request still reserves nothing. Do not assume a proposed session is reserved.', 'Awaiting admin review. Your original booking is unchanged.'],
  ['Review the decision in My bookings. Your original booking remains unchanged unless it has been rejected or cancelled.', 'View the booking for the decision and next steps.'],
  ['Submitting a request does not reserve the session. Wait for admin acceptance in My bookings before arranging payment or attendance.', 'Awaiting admin review. The session is not reserved yet.'],
  ['Your booking is confirmed and the session is reserved for your company. Check the current date, time, location and group size in My bookings before attending.', 'Your session is confirmed. View the booking details before attending.'],
  ['Admin has recorded attendance. Review the actual attendees and whole event hours in Group reports. Contact the booking team if a correction is needed.', 'Attendance and event hours are available in Group reports.'],
  ['Open My bookings to review the latest details.', 'View the booking for the latest details.'],
  ['Open the booking to review the request and contact the company externally as needed. No proposed session is reserved until acceptance.', 'Open the booking to review this update.'],
] as const;

const titles: Record<string, string> = {
  'Booking request received': 'Request received',
  'Request accepted — payment pending': 'Request accepted · payment due',
  'External payment recorded — booking confirmed': 'Booking confirmed',
  'Amendment requested': 'Booking change requested',
  'Amendment approved': 'Booking change approved',
  'Amendment declined': 'Booking change declined',
  'Corporate event updated': 'Event details updated',
  'Proposed corporate event updated': 'Proposed event updated',
  'Corporate event cancelled': 'Event cancelled',
};

export function corporateNoticeCopy(notice: Pick<CorporateBookingNotice, 'booking_id' | 'title' | 'message'>) {
  const prefix = `Booking ${notice.booking_id}`;
  // Match the complete known prefix only; never strip an ID from a user's free-text note.
  let note = notice.message;
  if (note === prefix || note.startsWith(prefix + ' — ') || note.startsWith(prefix + ' ')) {
    note = note.slice(prefix.length).replace(/^ — /, '').trim();
  }
  let summary = '';
  for (const [original, shorter] of nextSteps) {
    if (note === original || note.endsWith(' ' + original)) {
      note = note.slice(0, -original.length).trim();
      summary = shorter;
      break;
    }
  }
  // Keep the deadline from this notification, not today's booking state: this is history.
  const payment = note.match(/(?:^| )The whole session is held for your company\. Open My bookings and arrange external payment with the booking team by (\d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}) \(South African time\)\. Admin confirms receipt\. Overdue bookings remain held until admin decides otherwise\.$/);
  if (payment) {
    note = note.slice(0, payment.index).trim();
    summary = `Session reserved. Arrange payment by ${payment[1]} (SA time).`;
  }
  if (notice.title === 'Booking request received' && note === 'Requested — no places held. Admin rechecks capacity on acceptance.') {
    note = '';
    summary ||= 'Awaiting admin review. The session is not reserved yet.';
  }
  let noteLabel = 'Note';
  if (notice.title === 'External payment recorded — booking confirmed') {
    const suffix = ' — payment processed externally';
    if (note.endsWith(suffix)) { note = note.slice(0, -suffix.length); noteLabel = 'Payment reference'; }
  }
  // Unknown formats stay readable and intact rather than silently losing important details.
  return { title: titles[notice.title] ?? notice.title, summary, note, noteLabel };
}
