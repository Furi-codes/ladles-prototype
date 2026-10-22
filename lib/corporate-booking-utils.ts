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
/** Overdue is a flag, not a status transition or capacity release. */
export function corporateBookingOverdue(booking: { status: string; payment_due_at: string | null }, now = Date.now()): boolean {
  return ['Pending payment','Pending additional payment'].includes(booking.status) && booking.payment_due_at !== null && Date.parse(booking.payment_due_at) <= now;
}
export function validateCorporateEvent(input: { starts_at: string; ends_at: string; capacity: number; min_group_size: number; max_group_size: number }) {
  if (!Number.isFinite(Date.parse(input.starts_at)) || !Number.isFinite(Date.parse(input.ends_at)) || Date.parse(input.ends_at) <= Date.parse(input.starts_at) ||
    corporateLocalInput(input.starts_at).slice(0,10) !== corporateLocalInput(input.ends_at).slice(0,10) ||
    ![input.capacity,input.min_group_size,input.max_group_size].every(value => Number.isInteger(value) && value > 0 && value <= 2147483647) ||
    input.max_group_size < input.min_group_size || input.max_group_size > input.capacity) throw new Error('Use same-day times and whole-number group limits within capacity.');
}
