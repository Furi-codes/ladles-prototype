import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { fixture, asUser, rpc, ids, details, openRegistration } from './helpers/corporate-database.mjs';

// Use all eight migrations together, including business-only signup. Earlier
// stage tests intentionally keep their old schema to test each rollout boundary.
test('release workflow combines account separation, exclusive sessions, payment, changes, cancellation and event hours', async t => {
  const db = await fixture(t, { separation: true });
  for (const file of ['20261022203830_corporate_event_duration.sql', '20261023070518_corporate_exclusive_sessions.sql', '20261023073159_admin_corporate_polish.sql']) {
    await db.exec(readFileSync(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'));
  }
  const admin = (name, args = [], who = ids.admin) => asUser(db, who, () => rpc(db, name, args));
  const owner = ids.signup, other = randomUUID();
  await openRegistration(db);
  for (const [user, company] of [[owner, 'Company A'], [other, 'Company B']]) {
    await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)', [user, user + '@example.invalid', JSON.stringify({ registration_kind: 'corporate', corporate_details: { ...details, company_name: company } })]);
    const account = (await db.query('select id from public.corporate_accounts where owner_user_id=$1', [user])).rows[0];
    await admin('corporate_review_account', [account.id, 'approve', 'Verified business.']);
  }
  await admin('corporate_configure_bookings', [true, 'team@example.invalid', '+27215551234']);
  await admin('corporate_configure_changes', [true]);
  const input = { title: 'Release session', description: 'Isolated test session.', location: 'Test venue', starts_at: '2099-11-15T09:15:00+02:00', ends_at: '2099-11-15T11:15:00+02:00', capacity: 30, min_group_size: 1, max_group_size: 30, is_published: true };
  const event = () => admin('corporate_save_event', [null, null, JSON.stringify(input), randomUUID(), 'Published.']);
  const request = (e, user = owner, key = randomUUID()) => asUser(db, user, () => rpc(db, 'corporate_request_booking', [e.id, e.version, 12, '', key]));
  const detail = (id, user = owner) => asUser(db, user, () => rpc(db, 'corporate_booking_detail', [id]));
  const accept = (b, user = ids.admin) => admin('corporate_booking_deadline', [b.id, b.version, '2099-11-14T17:00:00+02:00', 'Payment arranged externally.'], user);
  const e = await event(), target = await event(), key = randomUUID();
  let a = await request(e, owner, key), b = await request(e, other);
  assert.equal((await request(e, owner, key)).id, a.id);
  assert.equal((await detail(a.id)).booking.event.state, 'Available');
  a = await accept(a);
  assert.equal((await detail(b.id, other)).booking.status, 'Rejected');
  await assert.rejects(accept(b, ids.admin2), /changed|open bookings|deadline/);
  await assert.rejects(detail(a.id, other), /not available/);

  // Simulate time passing in the isolated DB, then read through a fresh RPC.
  await db.query("update public.corporate_reservations set payment_due_at='2020-01-01' where id=$1", [a.id]);
  a = (await detail(a.id)).booking; assert.equal(a.event.state, 'Reserved');
  a = await accept(a);
  a = await admin('corporate_record_payment', [a.id, a.version, randomUUID(), 'TEST-RECEIPT', '2026-10-22', 'Payment checked.']);
  assert.equal(a.status, 'Confirmed');
  a = await asUser(db, owner, () => rpc(db, 'corporate_request_change', [a.id, a.version, 'Amendment', target.id, target.version, 12, 'Please move the session.', randomUUID()]));
  assert.equal((await detail(a.id)).booking.event.id, e.id);
  a = await admin('corporate_review_change', [a.id, a.version, a.pending_change.id, true, 'Agreed externally.', null, null]);
  assert.equal(a.event.id, target.id);
  b = await accept(await request(e, other));
  b = await asUser(db, other, () => rpc(db, 'corporate_request_change', [b.id, b.version, 'Cancellation', null, null, null, 'Cannot attend.', randomUUID()]));
  b = await admin('corporate_review_change', [b.id, b.version, b.pending_change.id, true, 'Cancellation agreed.', null, null]);
  assert.equal(b.status, 'Cancelled'); assert.equal(b.event.state, 'Available');

  await db.query("update public.corporate_events set starts_at='2020-11-15T09:15:00+02',ends_at='2020-11-15T11:15:00+02' where id=$1", [target.id]);
  a = await admin('corporate_record_event_attendance', [a.id, a.version, randomUUID(), 12, 2, 'Twelve people attended a two-hour event.']);
  assert.equal(a.attendance.event_hours, 2);
  a = await admin('corporate_record_event_attendance', [a.id, a.version, randomUUID(), 11, 3, 'Corrected attendance and duration.']);
  const report = await asUser(db, owner, () => rpc(db, 'corporate_event_outcome_report', ['', 'Completed']));
  assert.equal(report.summary.event_hours, 3); assert.equal(report.summary.attendance_instances, 11);
  assert.equal((await asUser(db, other, () => rpc(db, 'corporate_event_outcome_report', ['', 'Completed']))).total, 0);
  assert.ok((await asUser(db, other, () => rpc(db, 'corporate_event_outcome_report'))).rows.every(row => row.contact_snapshot.company_name === 'Company B'));
  assert.equal((await detail(a.id)).payments.length, 1);
  assert.ok((await detail(a.id)).history.some(row => row.action === 'Group attendance corrected'));
  const inbox = await admin('corporate_admin_notices');
  assert.ok(inbox.rows.length); assert.ok(inbox.unread_total > 0);
  await assert.rejects(asUser(db, other, () => rpc(db, 'corporate_admin_notices')), /Administrator/);
  await assert.rejects(request(target, other), /past|future|unavailable|already reserved/);

  // Corporate activity must not alter volunteer/WMS slots or old CSR records.
  assert.equal((await db.query('select capacity from public.event_slots where id=1')).rows[0].capacity, 6);
  assert.equal((await db.query('select team_size from public.corporate_bookings where id=1')).rows[0].team_size, 2);
  assert.equal(await rpc(db, 'book_event_slot', [1]), 'legacy capacity implementation preserved');
});
