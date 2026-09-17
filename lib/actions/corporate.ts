import { supabase } from '@/lib/supabase';
import type { CompanyInput, CorporateBooking, CorporateBookingInput, CorporateCompany, CorporateNote, OrganisationSettings, Profile, Event, EventSlot, Booking, AttendanceRecord, SlotAvailability } from '@/lib/types';

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
    ? 'This feature requires the CSR / Reports / Settings database migration. It has not yet been applied. Contact your database administrator.'
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
export async function loadReportData() {
  const [events, slots, bookings, attendance, corporate, companies] = await Promise.all([
    allRows<Event>('events'), allRows<EventSlot>('event_slots'), allRows<Booking>('bookings'),
    allRows<AttendanceRecord>('attendance_records'), allRows<CorporateBooking>('corporate_bookings'), allRows<CorporateCompany>('corporate_companies'),
  ]);
  return { events, slots, bookings, attendance, corporate, companies };
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
export async function saveSettings(input: Omit<OrganisationSettings, 'id' | 'updated_at'>) {
  const { error } = await supabase.from('organisation_settings').update(input).eq('id', 1).select().single();
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

