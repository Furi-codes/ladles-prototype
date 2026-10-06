import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
async function load(path) {
  const js = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}
const { corporateRemaining, validateCorporateTeamSize } = await load('../lib/capacity.ts');
const { performanceRows, reportCsv, selectedReportRows } = await load('../lib/reporting.ts');
const sql = read('../supabase/migrations/20261006100404_separate_corporate_capacity.sql');
const body = name => sql.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?(?:\\$\\$;|\\$function\\$;)`, 'i'))[0];
const slot = { id: 1, event_id: 1, capacity: 30, corporate_capacity: 40 };
const team = (id, size, status = 'Pending') => ({ id, event_id: 1, event_slot_id: 1, company_id: 1, team_size: size, status });
const filter = { from: '', to: '', location: '', event: '' };

test('individual availability and booking RPC count only individual bookings', () => {
  for (const name of ['get_slot_availability', 'book_event_slot', 'csr_guard_individual_capacity']) {
    assert.doesNotMatch(body(name), /csr_reserved_spaces|corporate_bookings|corporate_capacity/);
    assert.match(body(name), /public\.bookings/);
  }
  assert.match(body('get_slot_availability'), /s\.capacity - \(select count\(\*\)/);
  assert.match(body('book_event_slot'), /v_booking_count >= v_slot\.capacity/);
  assert.match(body('csr_guard_individual_capacity'), /v_count \+ 1 > v_slot\.capacity/);
});

test('corporate RPC counts only corporate reservations and protects the last place under lock', () => {
  const rpc = body('save_corporate_booking');
  assert.doesNotMatch(rpc, /from public\.bookings|v_slot\.capacity/);
  assert.match(rpc, /csr_reserved_spaces\(v_slot\.id, p_id\) \+ p_team_size > v_slot\.corporate_capacity/);
  assert.ok(rpc.indexOf('order by id for update') < rpc.indexOf('if public.csr_reserved_spaces'));
  for (const name of ['save_corporate_booking', 'csr_guard_individual_capacity', 'csr_guard_slot_capacity']) assert.match(body(name), /transaction_isolation/);
});

test('individual participation does not change corporate availability; only teams consume it', () => {
  const teams = [team(1, 20)];
  assert.equal(corporateRemaining(slot, teams), 20);
  const rows = performanceRows([{ id: 1, title: 'Shift', status: 'Scheduled' }], [slot], Array.from({ length: 25 }, (_, id) => ({ id, event_id: 1, event_slot_id: 1 })), [], teams, filter);
  assert.equal(rows[0].individualReserved, 25);
  assert.equal(rows[0].corporateReserved, 20);
  assert.equal(rows[0].capacity - rows[0].individualReserved, 5);
  assert.equal(rows[0].corporateCapacity - rows[0].corporateReserved, 20);
  assert.equal(corporateRemaining(slot, [...teams, team(2, 5, 'Confirmed')]), 15);
});

test('corporate validation rejects overflow, invalid sizes and unconfigured capacity', () => {
  assert.doesNotThrow(() => validateCorporateTeamSize(20, corporateRemaining(slot, [team(1, 20)])));
  assert.throws(() => validateCorporateTeamSize(21, corporateRemaining(slot, [team(1, 20)])), /corporate capacity/);
  for (const size of [0, -1, 1.5, NaN, 2147483648]) assert.throws(() => validateCorporateTeamSize(size, 40), /positive integer/);
  assert.throws(() => corporateRemaining({ id: 1 }, []), /migration/);
  assert.throws(() => validateCorporateTeamSize(1, corporateRemaining({ ...slot, corporate_capacity: 0 }, [])), /capacity/);
});

test('corporate lifecycle reserves Pending, Confirmed and Completed; cancellation releases only corporate places', () => {
  for (const status of ['Pending', 'Confirmed', 'Completed']) assert.equal(corporateRemaining(slot, [team(1, 20, status)]), 20);
  assert.equal(corporateRemaining(slot, [team(1, 20, 'Cancelled')]), 40);
  assert.equal(corporateRemaining(slot, [team(1, 20), team(2, 10)], 1), 30);
  const rpc = body('save_corporate_booking');
  assert.match(rpc, /if p_status <> 'Cancelled' then/);
  assert.match(rpc, /v_old\.status = 'Completed'/);
  assert.match(rpc, /New bookings must be Pending or Confirmed/);
  assert.match(rpc, /only correct attendance or contact details/);
  // The lifecycle helper and event-cancellation function are intentionally retained.
  assert.doesNotMatch(sql, /create or replace function public\.(csr_reserved_spaces|cancel_event_with_corporate_bookings)/);
});

test('individual cancellation still deletes the owned booking and both individual writers retain safeguards', () => {
  assert.match(read('../lib/actions/volunteer.ts'), /from\('bookings'\)\.delete\(\)\.eq\('id', bookingId\)\.eq\('user_id', userId\)/);
  const rpc = body('book_event_slot');
  for (const text of ['auth.uid()', "role = 'volunteer'", 'You already have a booking', 'already ended', 'has been cancelled', 'for update']) assert.ok(rpc.includes(text));
  assert.match(body('csr_guard_individual_capacity'), /new\.event_slot_id is null then return new/);
});

test('slot editing and direct updates prevent each capacity shrinking below its own reservations', () => {
  const save = body('save_event_with_slots');
  assert.match(save, /if v_capacity < v_reserved then/);
  assert.match(save, /if v_corporate_capacity < v_corporate_reserved then/);
  assert.doesNotMatch(save, /select count\(\*\) \+ public\.csr_reserved_spaces/);
  const guard = body('csr_guard_slot_capacity');
  assert.match(guard, /if new.capacity < v_count then/);
  assert.match(guard, /if new.corporate_capacity < public.csr_reserved_spaces\(old.id\) then/);
  assert.match(sql, /before update of capacity,corporate_capacity,event_id/);
  assert.match(save, /coalesce\(v_corporate_capacity, v_existing_slot.corporate_capacity\)/);
  assert.match(save, /sum\(capacity\)/); // Existing total_slots stays individual-only.
});

test('migration is additive and backfills corporate limits without modifying bookings', () => {
  assert.match(sql, /add column corporate_capacity integer not null default 0/);
  assert.match(sql, /check \(corporate_capacity >= 0\)/);
  assert.match(sql, /greatest\(s.capacity, public.csr_reserved_spaces\(s.id\)\)/);
  assert.doesNotMatch(sql, /drop table|truncate|alter table[^;]*rename/i);
  assert.match(sql, /revoke all on function public.get_slot_availability\(\) from public, anon, authenticated/);
});

test('reports and CSV distinguish both capacities and reservations while retaining combined participation', () => {
  const data = { events: [{ id: 1, title: 'Shift', status: 'Scheduled' }], slots: [slot], bookings: [{ id: 1, event_id: 1, event_slot_id: 1 }], attendance: [], corporate: [team(1, 20), team(2, 10, 'Cancelled')] };
  const row = performanceRows(data.events, data.slots, data.bookings, [], data.corporate, filter)[0];
  assert.deepEqual([row.capacity, row.corporateCapacity, row.individualReserved, row.corporateReserved, row.bookings], [30, 40, 1, 20, 21]);
  assert.match(reportCsv([row]), /Individual capacity.*Corporate capacity.*Individual reserved.*Corporate reserved.*Total booked participants/);
  const only = selectedReportRows(data, filter, true, '1')[0];
  assert.equal(only.individualReserved, 0); assert.equal(only.corporateReserved, 20);
  assert.equal(only.corporateCapacity, 40);
  assert.doesNotMatch(read('../app/admin/components/ReportCharts.tsx'), /Reserved places|Booked places/);
  assert.match(read('../app/admin/components/ReportsManager.tsx'), /Individual capacity.*Corporate capacity.*Individual reserved.*Corporate reserved/);
});

test('legacy unslotted participation does not reserve slot capacity', () => {
  const row = performanceRows([{ id: 1, status: 'Scheduled' }], [slot], [{ id: 1, event_id: 1, event_slot_id: null }], [], [], filter)[0];
  assert.equal(row.individualReserved, 0);
  assert.equal(row.bookings, 1);
});
