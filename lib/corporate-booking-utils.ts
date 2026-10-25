/** Convert a datetime-local control to an unambiguous South African timestamp. Never assume browser timezone. */
export function corporateTimestamp(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Choose a valid South African date and time.');
  const iso = value + ':00+02:00';
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed) || new Date(parsed + 7200000).toISOString().slice(0,16) !== value) throw new Error('Choose a valid South African date and time.');
  return iso;
}
export function corporateLocalInput(value: string | number = Date.now()): string {
  const parsed = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed + 7200000).toISOString().slice(0,16) : '';
}
export function corporateDateLabel(value: string): string {
  return new Date(value).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', dateStyle: 'medium', timeStyle: 'short' });
}
/** Display only: keep the complete booking ID for lookups, updates and exports. */
export function corporateBookingReference(id: string): string {
  return `Booking #${id.slice(0, 8).toUpperCase()}`;
}
/** Overdue is a flag, not a status transition or capacity release. */
export function corporateBookingOverdue(booking: { status: string; payment_due_at: string | null }, now = Date.now()): boolean {
  return ['Pending payment','Pending additional payment'].includes(booking.status) && booking.payment_due_at !== null && Date.parse(booking.payment_due_at) <= now;
}
/** Show the next action beside the current state, including for bookings created before new notices. */
export function corporateBookingNextStep(booking: { status: string; payment_due_at?: string | null; pending_change?: { kind: string } | null }, now = Date.now()): string {
  if (booking.status === 'Cancelled') return 'This booking is cancelled. Do not attend on this booking. Arrange any refund externally with the booking team; you may request another available session.';
  if (booking.status === 'Rejected') return 'This request is closed and holds no session. Review the reason below; you may request another available session. Discuss any payment or refund externally.';
  if (booking.pending_change) return 'Wait for admin to review your ' + (booking.pending_change.kind === 'Cancellation' ? 'cancellation' : 'change') + ' request. Your original booking is unchanged. A proposed session is not reserved.';
  if (booking.status === 'Requested') return 'Wait for admin review in My bookings. This request does not reserve the session. Admin acceptance reserves the whole session; do not arrange payment or attendance before acceptance.';
  if (booking.status.startsWith('Pending')) return corporateBookingOverdue({ status: booking.status, payment_due_at: booking.payment_due_at ?? null }, now)
    ? 'Payment is overdue, but your session remains reserved. Contact the booking team externally; admin may extend the deadline or reject the booking.'
    : 'Your company has the whole session reserved. Arrange external payment with the booking team by the deadline below. Admin will confirm receipt; this portal does not process payment.';
  if (booking.status === 'Confirmed') return 'Your booking is confirmed. Check the current date, time, location and group size before attending. Submit any change or cancellation for admin review.';
  if (booking.status === 'Completed') return 'Admin has recorded completion. Review actual attendees and whole event hours in Group reports. Contact the booking team if a correction is needed.';
  return 'Review the latest booking details below.';
}
export function validateCorporateEvent(input: { starts_at: string; ends_at: string; capacity: number; min_group_size: number; max_group_size: number }) {
  if (!Number.isFinite(Date.parse(input.starts_at)) || !Number.isFinite(Date.parse(input.ends_at)) || Date.parse(input.ends_at) <= Date.parse(input.starts_at) ||
    corporateLocalInput(input.starts_at).slice(0,10) !== corporateLocalInput(input.ends_at).slice(0,10) ||
    ![input.capacity,input.min_group_size,input.max_group_size].every(value => Number.isInteger(value) && value > 0 && value <= 2147483647) ||
    input.max_group_size < input.min_group_size || input.max_group_size > input.capacity) throw new Error('Use same-day times and whole-number group limits within capacity.');
}
