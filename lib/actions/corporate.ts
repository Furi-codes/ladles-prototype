import { supabase } from '@/lib/supabase';
import type { CompanyInput, CorporateBooking, CorporateBookingInput, CorporateCompany, CorporateNote, OrganisationSettings, Profile, Event, EventSlot, Booking, AttendanceRecord, SlotAvailability } from '@/lib/types';
import type { ReportFilter } from '@/lib/reporting';

/** Explicit pagination avoids silently truncating reports at the API row limit. */
export async function allRows<T>(table: string, order = 'id'): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ;) {
    const { data, error, count } = await supabase.from(table).select('*', { count: 'exact' }).order(order).range(offset, offset + 499);
    if (error) throw new Error(featureError(error));
    rows.push(...(data as T[]));
    offset += data.length;
    if (count === null) throw new Error('The server did not return a complete row count. Please retry.');
    if (offset >= count) return rows;
    if (!data.length) throw new Error('Data changed while loading. Refresh to load a complete report.');
  }
}
export function featureError(error: { message: string; code?: string }) {
  return ['42P01', 'PGRST205', 'PGRST202'].includes(error.code ?? '')
    ? 'A required database object is unavailable. Ask your database administrator to check the schema and API cache. Do not rerun the applied CSR migration.'
    : error.message;
}
export async function loadCorporateData() {
  const [companies, bookings, notes, events, slots] = await Promise.all([
    allRows<CorporateCompany>('corporate_companies'), allRows<CorporateBooking>('corporate_bookings'),
    allRows<CorporateNote>('corporate_notes'), allRows<Event>('events'), allRows<EventSlot>('event_slots'),
  ]);
  return { companies, bookings, notes, events, slots };
}
export async function saveCompany(id: number | null, input: CompanyInput) {
  const query = id === null ? supabase.from('corporate_companies').insert(input) : supabase.from('corporate_companies').update(input).eq('id', id);
  const { data, error } = await query.select().single();
  if (error) throw new Error(featureError(error));
  return data as CorporateCompany;
}
export async function addCorporateNote(companyId: number, body: string) {
  const { error } = await supabase.from('corporate_notes').insert({ company_id: companyId, body: body.trim() });
  if (error) throw new Error(featureError(error));
}
export async function saveCorporateBooking(id: number | null, input: CorporateBookingInput) {
  const { data, error } = await supabase.rpc('save_corporate_booking', {
    p_id: id, p_company_id: input.company_id, p_event_slot_id: input.event_slot_id,
    p_team_size: input.team_size, p_status: input.status, p_contact_name: input.contact_name,
    p_contact_email: input.contact_email, p_notes: input.notes,
    p_attendance_count: input.attendance_count, p_volunteer_hours: input.volunteer_hours,
  }).single();
  if (error) throw new Error(featureError(error));
  return data as CorporateBooking;
}
export async function loadReportData(filter: ReportFilter) {
  const events: Event[] = [];
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
  const [slots, bookings, corporate, companies] = await Promise.all([
    reportRelatedRows<EventSlot>('event_slots', 'event_id', ids), reportRelatedRows<Booking>('bookings', 'event_id', ids),
    reportRelatedRows<CorporateBooking>('corporate_bookings', 'event_id', ids), allRows<CorporateCompany>('corporate_companies'),
  ]);
  const attendance = await reportRelatedRows<AttendanceRecord>('attendance_records', 'booking_id', bookings.map(b => b.id));
  return { events, slots, bookings, attendance, corporate, companies };
}
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
function literalPattern(query: string) { return `%${query.trim().replace(/[\\%_]/g, '\\$&')}%`; }
export async function searchReportEvents(term: string) {
  let query = supabase.from('events').select('id,title,date').order('date', { ascending: false }).order('id', { ascending: false }).limit(8);
  if (term.trim()) query = query.ilike('title', literalPattern(term));
  else query = query.lte('date', new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
  const { data, error } = await query;
  if (error) throw new Error(featureError(error));
  return data.map(e => ({ value: String(e.id), label: `${e.title} · ${e.date}` }));
}
export async function searchReportLocations(term: string) {
  const { data, error } = await supabase.from('events').select('location').ilike('location', literalPattern(term)).order('date', { ascending: false }).order('id', { ascending: false }).limit(50);
  if (error) throw new Error(featureError(error));
  return Array.from(new Set(data.map(e => String(e.location)).filter(Boolean))).sort().slice(0, 8).map(location => ({ value: location, label: location }));
}
export async function loadSettings() {
  const [settings, admins] = await Promise.all([
    supabase.from('organisation_settings').select('*').eq('id', 1).single(),
    supabase.from('profiles').select('id,full_name,email,role').eq('role', 'admin').order('full_name'),
  ]);
  if (settings.error) throw new Error(featureError(settings.error));
  if (admins.error) throw new Error(admins.error.message);
  return { settings: settings.data as OrganisationSettings, admins: admins.data as Profile[] };
}
export async function saveSettings(input: Omit<OrganisationSettings, 'id' | 'updated_at' | 'organisation_name'>) {
  // Explicit allowlist also rejects unexpected runtime properties from callers.
  const { default_location, contact_email, timezone, booking_confirmation_enabled, booking_cancellation_enabled, shift_reminder_enabled, corporate_booking_confirmation_enabled } = input;
  const { error } = await supabase.from('organisation_settings').update({ default_location, contact_email, timezone, booking_confirmation_enabled, booking_cancellation_enabled, shift_reminder_enabled, corporate_booking_confirmation_enabled }).eq('id', 1).select().single();
  if (error) throw new Error(featureError(error));
}
export async function saveAdminName(name: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error(error?.message ?? 'Please sign in again.');
  const result = await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', data.user.id).select().single();
  if (result.error) throw new Error(result.error.message);
}
export async function fetchSlotAvailability(): Promise<SlotAvailability[] | null> {
  const { data, error } = await supabase.rpc('get_slot_availability');
  // Existing booking remains usable before the DBA deploys the additive migration.
  if (error?.code === 'PGRST202') return null;
  if (error) throw new Error(error.message);
  return data as SlotAvailability[];
}

