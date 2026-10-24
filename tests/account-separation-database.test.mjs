import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { fixture, asUser, rpc, ids, details, openRegistration, register } from './helpers/corporate-database.mjs';

const migration = new URL('../supabase/migrations/20261022162335_separate_corporate_accounts.sql', import.meta.url);
async function business(db, id = ids.signup, email = 'business@example.invalid') {
  await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [id, email, JSON.stringify({ registration_kind: 'corporate', corporate_details: details, role: 'admin' })]);
  return (await db.query('select * from public.corporate_accounts where owner_user_id=$1', [id])).rows[0];
}

test('strict signup creates a pending business-only account; existing volunteers/admins cannot add company membership', async t => {
  const db = await fixture(t, { separation: true }); await openRegistration(db);
  for (const user of [ids.owner, ids.admin]) await assert.rejects(register(db, user), /accounts are separate/);
  assert.equal((await db.query('select count(*)::int n from public.corporate_accounts')).rows[0].n, 0);
  const account = await business(db);
  assert.equal(account.status, 'Awaiting approval');
  assert.deepEqual((await db.query('select role,volunteer_enabled from public.profiles where id=$1', [ids.signup])).rows[0], { role: 'volunteer', volunteer_enabled: false });
  await assert.rejects(asUser(db, ids.admin, () => rpc(db, 'corporate_review_account', [account.id, 'approve', 'Review'])), /verify their login email/);
  await db.query('update auth.users set email_confirmed_at=now() where id=$1', [ids.signup]);
  // Safe retries of this business registration return its own record, not another membership.
  assert.equal((await register(db, ids.signup)).id, account.id);
  assert.equal((await db.query('select count(*)::int n from public.corporate_account_history')).rows[0].n, 1);
  await assert.rejects(db.query('insert into public.bookings(user_id) values($1)', [ids.signup]), /Open a volunteer profile/);
  await db.query('insert into public.bookings(user_id) values($1)', [ids.owner]);
  const directory = await asUser(db, ids.admin, () => rpc(db, 'corporate_volunteer_directory', ['', '', 0, 100]));
  assert.ok(directory.rows.some(row => row.id === ids.owner)); assert.ok(!directory.rows.some(row => row.id === ids.signup));
});

test('separation is enforced on direct writes, profile flags and metadata edits, not just registration buttons', async t => {
  const db = await fixture(t, { separation: true }); await openRegistration(db); const account = await business(db);
  await assert.rejects(db.query('update public.corporate_accounts set owner_user_id=$1 where id=$2', [ids.owner, account.id]), /separate business-only login/);
  await assert.rejects(db.query('update public.profiles set volunteer_enabled=true where id=$1', [ids.signup]), /cannot also be a volunteer/);
  await assert.rejects(db.query("update public.profiles set role='admin' where id=$1", [ids.signup]), /cannot also be a volunteer or administrator/);
  await assert.rejects(asUser(db, ids.signup, () => db.query('update public.profiles set volunteer_enabled=true where id=$1', [ids.signup])), /membership cannot be changed/);
  await assert.rejects(asUser(db, ids.owner, () => db.query('update public.profiles set volunteer_enabled=false where id=$1', [ids.owner])), /membership cannot be changed/);
  await db.query('update auth.users set raw_user_meta_data=$1 where id=$2', [JSON.stringify({ registration_kind: 'corporate', corporate_details: details }), ids.owner]);
  await assert.rejects(register(db, ids.owner), /accounts are separate/);
  await db.query("update public.profiles set full_name='Updated contact' where id=$1", [ids.signup]);
  assert.equal((await db.query('select owner_user_id from public.corporate_accounts where id=$1', [account.id])).rows[0].owner_user_id, ids.signup);
  for (const name of ['check_business_owner', 'keep_business_profile_separate']) await assert.rejects(asUser(db, ids.owner, () => db.exec('select corporate_private.' + name + '()')), /permission denied/);
});

test('failed business signup rolls back and separation migration refuses old mixed accounts without reassigning records', async t => {
  const db = await fixture(t, { separation: true });
  await assert.rejects(business(db), /registration is not open/);
  assert.equal((await db.query('select count(*)::int n from auth.users where id=$1', [ids.signup])).rows[0].n, 0);
  await openRegistration(db);
  await assert.rejects(db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [ids.signup, 'business@example.invalid', JSON.stringify({ registration_kind: 'corporate', corporate_details: { ...details, contact_phone: 'bad' } })]), /valid contact email/);
  assert.equal((await db.query('select count(*)::int n from public.profiles where id=$1', [ids.signup])).rows[0].n, 0);
  const legacy = await fixture(t, { outcomes: true }); await openRegistration(legacy); const original = await register(legacy);
  await legacy.query('insert into public.bookings(user_id) values($1)', [ids.owner]);
  await assert.rejects(legacy.exec(readFileSync(migration, 'utf8')), /Mixed volunteer\/business accounts require review/); await legacy.exec('rollback');
  assert.equal((await legacy.query('select owner_user_id from public.corporate_accounts where id=$1', [original.id])).rows[0].owner_user_id, ids.owner);
  assert.equal((await legacy.query('select volunteer_enabled from public.profiles where id=$1', [ids.owner])).rows[0].volunteer_enabled, true);
  assert.equal((await legacy.query('select count(*)::int n from public.bookings')).rows[0].n, 1);
});

test('strict business accounts complete approval, bookings, payment and reporting while volunteer/WMS capacity stays unchanged', async t => {
  const db = await fixture(t, { separation: true }); await openRegistration(db); const account = await business(db);
  await db.query('update auth.users set email_confirmed_at=now() where id=$1', [ids.signup]);
  await asUser(db, ids.admin, () => rpc(db, 'corporate_review_account', [account.id, 'approve', 'Checked business registration.']));
  await asUser(db, ids.admin, () => rpc(db, 'corporate_configure_bookings', [true, 'booking@example.invalid', '+27215551234']));
  const input = { title: 'Separate corporate session', description: 'Fictional test activity.', location: 'Example venue', starts_at: '2099-11-15T09:15:00+02:00', ends_at: '2099-11-15T10:15:00+02:00', capacity: 6, min_group_size: 1, max_group_size: 6, is_published: true };
  const event = await asUser(db, ids.admin, () => rpc(db, 'corporate_save_event', [null, null, JSON.stringify(input), randomUUID(), 'Publish.']));
  const requested = await asUser(db, ids.signup, () => rpc(db, 'corporate_request_booking', [event.id, event.version, 5, '', randomUUID()]));
  assert.equal((await db.query('select reserved_places from public.corporate_events where id=$1', [event.id])).rows[0].reserved_places, 0);
  const accepted = await asUser(db, ids.admin, () => rpc(db, 'corporate_booking_deadline', [requested.id, requested.version, '2099-11-14T10:00:00+02:00', 'Payment discussed externally.']));
  const paid = await asUser(db, ids.admin, () => rpc(db, 'corporate_record_payment', [accepted.id, accepted.version, randomUUID(), 'TEST RECEIPT', new Date().toISOString().slice(0, 10), 'Payment checked.']));
  await assert.rejects(asUser(db, ids.owner, () => rpc(db, 'corporate_booking_detail', [paid.id])), /not available/);
  await db.query("update public.corporate_events set starts_at='2020-11-15T09:15:00+02',ends_at='2020-11-15T10:15:00+02' where id=$1", [event.id]);
  const completed = await asUser(db, ids.admin, () => rpc(db, 'corporate_record_attendance', [paid.id, paid.version, randomUUID(), 4, 4, 'Actual group attendance.']));
  assert.equal(completed.status, 'Completed');
  const report = await asUser(db, ids.signup, () => rpc(db, 'corporate_outcome_report'));
  assert.equal(report.total, 1); assert.equal(report.summary.attendance_instances, 4);
  assert.equal((await asUser(db, ids.owner, () => rpc(db, 'corporate_outcome_report'))).total, 0);
  assert.equal((await db.query('select capacity from public.event_slots where id=1')).rows[0].capacity, 6);
  assert.equal((await db.query('select team_size from public.corporate_bookings where id=1')).rows[0].team_size, 2);
  assert.equal(await rpc(db, 'book_event_slot', [1]), 'legacy capacity implementation preserved');
});
