/**
 * Converts stored activity into readable actions, record names and details.
 * Only recognised fields are displayed, keeping raw snapshots and internal database fields out
 * of the UI.
 */

import { isTechnicalMessage } from '@/business/shared/errors/user-facing';

const actions: Record<string, string> = {
  EVENT_CREATED: 'Event created', EVENT_UPDATED: 'Event updated', EVENT_CANCELLED: 'Event cancelled', EVENT_DELETED: 'Event deleted',
  WMS_EVENT_PUBLISHED: 'Event published by WMS', WMS_EVENT_CANCELLED: 'Event cancelled by WMS', WMS_CAPACITY_UPDATED: 'Capacity updated by WMS', WMS_ATTENDANCE_UPDATED: 'Attendance updated by WMS',
  ADMIN_ACCESS_GRANTED: 'Administrator access granted', ADMIN_ACCESS_REVOKED: 'Administrator access removed', ADMIN_ACCOUNT_NAME_UPDATED: 'Account name updated',
  PORTAL_CONTACTS_UPDATED: 'Portal contacts updated', REPORT_EXPORTED: 'Report exported', NOTIFICATION_PREFERENCES_UPDATED: 'Notification preferences updated',
  CSR_COMPANY_CREATED: 'Company created (legacy CSR)', CSR_COMPANY_UPDATED: 'Company updated (legacy CSR)', CSR_NOTE_ADDED: 'Company note added (legacy CSR)',
  CORPORATE_BOOKING_CREATED: 'Corporate booking created', CORPORATE_BOOKING_UPDATED: 'Corporate booking updated',
  VOLUNTEER_HOURS_APPROVED: 'Volunteer hours approved',
};
export const activityAction = (action: string) => actions[action] ?? 'Action recorded';
export function activityRecordType(type: string) {
  return ({ EVENT: 'Event', EVENT_SLOT: 'Bookable range', BOOKING: 'Booking', PROFILE: 'User account', REPORT: 'Report', CORPORATE_COMPANY: 'Company', CORPORATE_BOOKING: 'Corporate booking', ORGANISATION_SETTINGS: 'Settings', PORTAL_CONTACT_SETTINGS: 'Portal contacts' } as Record<string, string>)[type] ?? 'Record';
}
const text = (value: unknown) => typeof value === 'string' && value.trim() && value.length <= 300 && !isTechnicalMessage(value) ? value : null;
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? String(value) : null;
function date(value: unknown, withTime = false) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value)) return null;
  const parsed = new Date(value); if (!Number.isFinite(parsed.getTime())) return null;
  return new Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } as const : {}) }).format(parsed);
}

/** Only known business fields are displayed. Extra identifiers, debug flags and nested payloads stay private. */
export function activityDetails(details: unknown): { label: string; value: string }[] {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return [];
  const data = details as Record<string, unknown>, rows: { label: string; value: string }[] = [];
  const add = (label: string, value: string | null) => { if (value !== null) rows.push({ label, value }); };
  for (const [key, label] of [['date','Event date'],['from','From date'],['to','To date']] as const) add(label, date(data[key]));
  for (const [key, label] of [['location','Location'],['category','Category'],['status','Status'],['relationship_status','Relationship status'],['attendance_status','Attendance status']] as const) add(label, text(data[key]));
  for (const [key, label] of [['slot_count','Bookable ranges'],['capacity_before','Previous capacity'],['capacity_after','New capacity'],['capacity','Capacity'],['team_size','Group size'],['attendance_count','Actual attendees'],['event_hours','Event hours'],['contact_methods','Contact methods'],['rows','Rows exported']] as const) add(label, number(data[key]));
  // Show the useful parts of an hours correction instead of its full stored record.
  add('Previously recorded minutes', number(data.previous_worked_minutes));
  add('Approved minutes', number(data.worked_minutes));
  add('Reason', text(data.approval_reason));
  if (data.role === 'admin' || data.role === 'volunteer') add('Account access', data.role === 'admin' ? 'Administrator' : 'Volunteer');
  if (data.participation === 'volunteers') add('Report scope', 'Volunteers');
  if (data.cancellation_message_supplied === true) add('Cancellation message', 'Included');
  if (data.note_recorded === true) add('Company note', 'Added');
  for (const [key, label] of [['clock_in','Clock-in (SA time)'],['clock_out','Clock-out (SA time)'],['recorded_at','Recorded (SA time)']] as const) add(label, date(data[key], true));
  if (Array.isArray(data.timeslots)) data.timeslots.slice(0, 40).forEach((slot, index) => {
    if (!slot || typeof slot !== 'object') return;
    const start = typeof slot.start_time === 'string' && /^\d{2}:\d{2}(?::\d{2})?$/.test(slot.start_time) ? slot.start_time.slice(0, 5) : null;
    const end = typeof slot.end_time === 'string' && /^\d{2}:\d{2}(?::\d{2})?$/.test(slot.end_time) ? slot.end_time.slice(0, 5) : null;
    const capacity = number(slot.capacity);
    if (start && end) add(`Bookable range ${index + 1}`, `${start}–${end}${capacity === null ? '' : ` · ${capacity} places`}`);
  });
  return rows;
}
