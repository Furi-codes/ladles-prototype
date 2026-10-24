import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { fixture, asUser, rpc, ids, details, openRegistration, register } from './helpers/corporate-database.mjs';

const exclusive = readFileSync(new URL('../supabase/migrations/20261023070518_corporate_exclusive_sessions.sql', import.meta.url), 'utf8');
const duration = readFileSync(new URL('../supabase/migrations/20261022203830_corporate_event_duration.sql', import.meta.url), 'utf8');
const admin = (db, name, args, who = ids.admin) => asUser(db, who, () => rpc(db, name, args));
const request = (db, event, who = ids.owner, size = 4, key = randomUUID()) => asUser(db, who, () => rpc(db, 'corporate_request_booking', [event.id, event.version, size, '', key]));
const accept = (db, b, who = ids.admin) => admin(db, 'corporate_booking_deadline', [b.id, b.version, '2099-11-14T17:00:00+02:00', 'Payment instructions discussed externally.'], who);
const fresh = async (db, b) => (await admin(db, 'corporate_booking_detail', [b.id])).booking;
const event = (db, title = 'Exclusive session') => admin(db, 'corporate_save_event', [null, null, JSON.stringify({ title, description: 'Corporate session.', location: 'Test venue', starts_at: '2099-11-15T09:00:00+02:00', ends_at: '2099-11-15T11:00:00+02:00', capacity: 30, min_group_size: 1, max_group_size: 30, is_published: true }), randomUUID(), 'Created.']);
async function setup(t) {
  const db = await fixture(t, { outcomes: true });
  await db.exec(duration); await db.exec(exclusive); await openRegistration(db);
  for (const who of [ids.owner, ids.other]) {
    const account = await register(db, who, { ...details, company_name: who === ids.owner ? 'Company A' : 'Company B' });
    await admin(db, 'corporate_review_account', [account.id, 'approve', 'Reviewed.']);
  }
  await admin(db, 'corporate_configure_bookings', [true, 'booking@example.invalid', '+27215551234']);
  await admin(db, 'corporate_configure_changes', [true]);
  return db;
}

test('requests reserve nothing; acceptance exclusively holds a session and atomically declines competitors', async t => {
  const db = await setup(t), e = await event(db), key = randomUUID();
  const a = await request(db, e, ids.owner, 4, key), b = await request(db, e, ids.other, 5);
  assert.equal((await fresh(db, a)).event.remaining, 30);
  assert.equal((await request(db, e, ids.owner, 4, key)).id, a.id);
  const accepted = await accept(db, a);
  const current = await fresh(db, a), declined = await fresh(db, b);
  assert.equal(current.event.state, 'Reserved'); assert.equal(current.event.remaining, 0);
  assert.equal(current.event.reserved_places, 4); assert.equal(declined.status, 'Rejected');
  assert.equal(declined.version, b.version + 1);
  await assert.rejects(accept(db, b, ids.admin2), /changed|open bookings|deadline/);
  await assert.rejects(request(db, e, ids.other), /already reserved/);
  assert.equal((await request(db, e, ids.owner, 4, key)).id, a.id);
  const notices = (await db.query('select title,message from public.corporate_account_notifications where target_id=$1 and audience=$2 order by created_at', [b.id, 'corporate'])).rows;
  assert.ok(notices.some(n => /Session no longer available/.test(n.title) && /another available session/.test(n.message)));
  assert.ok((await db.query('select message from public.corporate_account_notifications where target_id=$1', [a.id])).rows.some(n => /whole session is held/.test(n.message) && /14 Nov 2099 17:00/.test(n.message)));
  await assert.rejects(asUser(db, ids.other, () => rpc(db, 'corporate_booking_detail', [a.id])), /not available/);
  assert.equal((await admin(db, 'corporate_booking_settings')).exclusive_sessions_schema_version, 1);
  // Overdue is a flag, not a release: moving only the deadline must leave the session held.
  await db.query("update public.corporate_reservations set payment_due_at='2020-01-01' where id=$1", [a.id]);
  assert.equal((await fresh(db, a)).event.state, 'Reserved');
  await admin(db, 'corporate_reject_booking', [a.id, accepted.version, 'Cannot proceed.']);
  assert.equal((await fresh(db, a)).event.state, 'Available');
  const replacement = await request(db, e, ids.other);
  assert.equal((await accept(db, replacement, ids.admin2)).status, 'Pending payment');
  assert.equal((await db.query('select capacity from public.event_slots where id=1')).rows[0].capacity, 6);
});

test('exclusive amendments retain the original, allow own size increases, and release only on checked decisions', async t => {
  const db = await setup(t), first = await event(db), second = await event(db, 'Second session');
  let a = await accept(db, await request(db, first));
  const change = async (b, target, size = 12, kind = 'Amendment') => asUser(db, ids.owner, () => rpc(db, 'corporate_request_change', [b.id, b.version, kind, target?.id ?? null, target?.version ?? null, size, 'Please change.', randomUUID()]));
  const decide = async b => admin(db, 'corporate_review_change', [b.id, b.version, b.pending_change.id, true, 'Agreed externally.', null, null]);
  a = await change(a, first);
  a = await decide(a); assert.equal(a.group_size, 12); assert.equal((await fresh(db, a)).event.remaining, 0);
  a = await change(a, second);
  assert.equal((await fresh(db, a)).event.id, first.id);
  let b = await accept(db, await request(db, second, ids.other));
  a = await fresh(db, a); assert.equal(a.pending_change, null);
  await assert.rejects(change(a, second), /already reserved|unavailable/);
  await admin(db, 'corporate_reject_booking', [b.id, b.version, 'Cancelled by agreement.']);
  a = await change(a, second); a = await decide(a);
  assert.equal(a.event.id, second.id); assert.equal((await request(db, first, ids.other)).status, 'Requested');
  a = await change(a, null, null, 'Cancellation'); a = await decide(a);
  assert.equal(a.status, 'Cancelled'); assert.equal(a.event.state, 'Available');
  const notices = (await db.query('select message from public.corporate_account_notifications where target_id=$1', [a.id])).rows;
  assert.ok(notices.some(n => /Wait for admin review/.test(n.message)));
  assert.ok(notices.some(n => /Do not attend/.test(n.message)));
});

test('completed sessions retain exclusivity, event-hour reports and checked SQL permissions', async t => {
  const db = await setup(t), e = await event(db);
  let a = await accept(db, await request(db, e, ids.owner, 12));
  a = await admin(db, 'corporate_record_payment', [a.id, a.version, randomUUID(), 'Receipt', '2026-10-22', 'Verified.']);
  await db.query("update public.corporate_events set starts_at='2020-11-15T09:00:00+02',ends_at='2020-11-15T11:00:00+02' where id=$1", [e.id]);
  a = await admin(db, 'corporate_record_event_attendance', [a.id, a.version, randomUUID(), 12, 2, 'Completed.']);
  assert.equal(a.attendance.event_hours, 2);
  const report = await asUser(db, ids.owner, () => rpc(db, 'corporate_event_outcome_report', ['', 'Completed', null, null, 0, 10]));
  assert.equal(report.summary.event_hours, 2); assert.equal(report.summary.attendance_instances, 12);
  assert.equal((await db.query("select count(*)::int n from public.corporate_reservations where event_id=$1 and status in ('Pending payment','Pending additional payment','Confirmed','Completed')", [e.id])).rows[0].n, 1);
  await assert.rejects(asUser(db, ids.other, () => db.query("update public.corporate_reservations set status='Confirmed'")), /permission denied/);
  await assert.rejects(asUser(db, null, () => rpc(db, 'corporate_booking_settings'), 'anon'), /permission denied/);
  assert.equal((await db.query("select indisunique from pg_index where indexrelid='public.corporate_one_reserved_session'::regclass")).rows[0].indisunique, true);
  assert.ok((await db.query('select message from public.corporate_account_notifications where target_id=$1', [a.id])).rows.some(n => /review the attendance and event hours/.test(n.message)));
});

test('the unique index prevents a second holder independently of the checked workflow', async t => {
  const db = await setup(t), e = await event(db);
  const a = await request(db, e), b = await request(db, e, ids.other);
  // Local test only: bypass the friendly guard and automatic competitor decision to test
  // PostgreSQL's final invariant directly, not just the application pre-check.
  await db.exec('alter table public.corporate_reservations disable trigger corporate_exclusive_guard; alter table public.corporate_reservations disable trigger corporate_resolve_exclusive_requests;');
  await accept(db, a);
  await assert.rejects(accept(db, b, ids.admin2), /corporate_one_reserved_session|duplicate key/);
  assert.equal((await fresh(db, b)).status, 'Requested');
  assert.equal((await fresh(db, a)).event.reserved_places, 4); // Failed second counter update rolled back too.
});

test('migration refuses conflicting historical shared sessions without discarding either booking', async t => {
  const db = await fixture(t, { outcomes: true }); await db.exec(duration); await openRegistration(db);
  for (const who of [ids.owner, ids.other]) {
    const account = await register(db, who, details);
    await admin(db, 'corporate_review_account', [account.id, 'approve', 'Reviewed.']);
  }
  await admin(db, 'corporate_configure_bookings', [true, 'booking@example.invalid', '+27215551234']);
  const e = await event(db);
  await accept(db, await request(db, e)); await accept(db, await request(db, e, ids.other));
  await assert.rejects(db.exec(exclusive), /Resolve existing shared corporate reservations/); await db.exec('rollback');
  assert.equal((await db.query("select count(*)::int n from public.corporate_reservations where status='Pending payment'")).rows[0].n, 2);
  assert.equal((await db.query("select to_regclass('public.corporate_one_reserved_session') idx")).rows[0].idx, null);
});
