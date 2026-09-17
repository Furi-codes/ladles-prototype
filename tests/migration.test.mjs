import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
const sql = readFileSync(new URL('../supabase/migrations/20260916190557_csr_reports_settings_review.sql', import.meta.url),'utf8');
const functionBody = name => sql.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\$function\\$;`, 'i'))?.[0];
test('individual RPC preserves all verified validations and shared slot locking', () => {
 const body = functionBody('book_event_slot');
 for (const fragment of ['v_user_id is null','for update',"v_event_status = 'Cancelled'",'v_event_date < (now() at time zone \'Africa/Johannesburg\')::date',"role = 'volunteer'",'b.user_id = v_user_id','v_booking_count + public.csr_reserved_spaces(v_slot.id)',"'Confirmed'"]) assert.ok(body.includes(fragment),fragment);
 assert.match(body, /v_slot\.end_time <= \(now\(\) at time zone 'Africa\/Johannesburg'\)::time/);
});
test('slot editing preserves booked identities and rejects invalidating changes', () => {
 const body = functionBody('save_event_with_slots');
 assert.ok(body.includes('An event date cannot change after bookings exist.'));
 assert.ok(body.includes('A booked slot cannot change its times.'));
 assert.ok(body.includes('A booked slot cannot be removed.'));
 assert.ok(body.includes('where id = v_slot_id and event_id = v_event.id'));
 assert.ok(body.includes('sum(capacity)'));
});
test('corporate RPC grants execution only to authenticated and has no direct write policy', () => {
 assert.ok(sql.includes('auth.uid() is null or not public.is_admin()'));
 assert.ok(sql.includes('order by id for update'));
 assert.ok(sql.includes('attendance_count is not null and volunteer_hours is not null'));
 assert.ok(sql.includes("status <> 'Completed' and attendance_count is null and volunteer_hours is null"));
 assert.ok(sql.includes('grant select on public.corporate_bookings to authenticated'));
 assert.ok(!/create policy[^;]*corporate_bookings[^;]*for (insert|update|all)/i.test(sql));
 for(const table of ['corporate_companies','corporate_bookings','corporate_notes','organisation_settings']) assert.ok(sql.includes(`alter table public.${table} enable row level security`));
});

test('charities supported is a nullable nonnegative integer count', () => {
 assert.match(sql, /charities_supported integer\s+check \(charities_supported is null or charities_supported >= 0\)/);
 assert.doesNotMatch(sql, /charities_supported (text|integer not null)/);
});
const newFunction = name => sql.match(new RegExp(`create function public\\.${name}\\([\\s\\S]*?\\$\\$;`, 'i'))?.[0];
test('new functions have explicit search paths and only the two public RPCs receive client execution', () => {
 const signatures = [
  ['csr_touch_updated_at', ''], ['csr_reserved_spaces', 'bigint,bigint'],
  ['save_corporate_booking', 'bigint,bigint,bigint,integer,text,text,text,text,integer,numeric'],
  ['get_slot_availability', ''], ['csr_guard_individual_capacity', ''], ['csr_guard_slot_capacity', ''],
 ];
 for (const [name, args] of signatures) {
  assert.ok(newFunction(name)?.includes("set search_path = ''"), name);
  assert.ok(sql.includes(`revoke all on function public.${name}(${args}) from public, anon, authenticated;`), name);
 }
 const granted = [...sql.matchAll(/grant execute on function public\.([a-z_]+)\([^;]*?\) to authenticated;/g)].map(m => m[1]).sort();
 assert.deepEqual(granted, ['cancel_event_with_corporate_bookings', 'get_slot_availability', 'save_corporate_booking']);
 assert.match(sql, /revoke all on sequence public\.corporate_companies_id_seq,\s+public\.corporate_bookings_id_seq, public\.corporate_notes_id_seq\s+from public, anon, authenticated;/);
 assert.match(sql, /grant usage on sequence public\.corporate_companies_id_seq, public\.corporate_notes_id_seq to authenticated;/);
 assert.doesNotMatch(sql, /grant[^;]*corporate_bookings_id_seq[^;]*to authenticated/);
});
test('capacity mutation guards reject transaction snapshots that cannot refresh after slot locks', () => {
 for (const name of ['save_corporate_booking', 'csr_guard_individual_capacity', 'csr_guard_slot_capacity']) {
  const body = newFunction(name);
  assert.ok(body.includes("pg_catalog.current_setting('transaction_isolation') not in ('read committed', 'read uncommitted')"), name);
  assert.ok(body.includes("using errcode = '25000'"), name);
  assert.ok(body.indexOf("current_setting('transaction_isolation')") < body.indexOf('select count(*)'), name);
 }
});
test('raw corporate hours are validated before rounding and migration has no destructive production changes', () => {
 const body = newFunction('save_corporate_booking');
 assert.ok(body.includes('p_volunteer_hours < 0 or (p_attendance_count = 0 and p_volunteer_hours > 0)'));
 assert.ok(body.indexOf('p_volunteer_hours < 0') < body.indexOf('insert into public.corporate_bookings'));
 assert.doesNotMatch(sql, /\bdrop\s+(table|function|policy|trigger)\b/i);
 assert.doesNotMatch(sql, /alter table public\.(events|profiles)\b/i);
});
test('event cancellation atomically protects completed history and cancels reserving corporate rows', () => {
 const body = newFunction('cancel_event_with_corporate_bookings');
 assert.ok(body.includes('for update'));
 assert.ok(body.includes("status = 'Completed'"));
 assert.ok(body.includes('completed attendance records and cannot be cancelled'));
 assert.ok(body.includes("status in ('Pending', 'Confirmed')"));
 assert.ok(body.includes("cancellation_reason = 'Parent event cancelled'"));
 assert.ok(body.includes('perform public.cancel_event(p_event_id, p_message)'));
 assert.ok(sql.includes('grant execute on function public.cancel_event_with_corporate_bookings(bigint,text) to authenticated;'));
});
test('corporate cancellation keeps an audit reason without changing completed rows', () => {
 assert.match(sql, /alter table public\.corporate_bookings add column cancellation_reason text;/);
 assert.ok(sql.includes("'Company/admin cancelled'"));
});
