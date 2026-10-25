/**
 * Checks personal reminder choices, eligibility, deduplication and role separation.
 * These checks use an isolated local database, so test writes cannot alter the hosted app. They
 * do not prove a live deployment or email delivery.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { fixture, asUser, rpc, ids, details, openRegistration, register } from './helpers/corporate-database.mjs';

const migration = new URL('../supabase/migrations/20261025095512_personal_session_reminders.sql', import.meta.url);
const now = '2030-03-01T06:00:00Z';
async function setup(t) {
  const db = await fixture(t, { outcomes: true });
  // Reproduce the existing notification baseline, which predates the corporate migration history.
  await db.exec(`
    create schema notification_private;
    create table public.volunteer_notification_preferences(user_id uuid primary key references auth.users(id),reminders_enabled boolean not null default true);
    create table public.notifications(id bigint generated always as identity primary key,user_id uuid references auth.users(id),event_id bigint references public.events(id),type text,title text,message text,is_read boolean default false,scheduled_for timestamptz,created_at timestamptz default now(),unique(event_id,user_id,type));
    create table public.organisation_settings(id integer primary key,shift_reminder_enabled boolean);
    insert into public.organisation_settings values(1,false);
    alter table public.events add column date date,add column location text,add column status text default 'Scheduled';
    alter table public.event_slots add column start_time time,add column end_time time;
    alter table public.bookings add column event_id bigint,add column event_slot_id bigint,add column status text default 'Confirmed';
    insert into auth.users(id,email,email_confirmed_at) values('${ids.signup}','volunteer@example.invalid',now());
    insert into public.volunteer_notification_preferences values('${ids.signup}',false);
  `);
  await openRegistration(db);
  const company = await register(db, ids.owner);
  const other = await register(db, ids.other, { ...details, company_name: 'Other company' });
  await db.query('update public.profiles set volunteer_enabled=false where id in ($1,$2)', [ids.owner, ids.other]);
  await db.exec(readFileSync(new URL('../supabase/migrations/20261022162335_separate_corporate_accounts.sql', import.meta.url), 'utf8'));
  for (const account of [company, other]) await asUser(db, ids.admin, () => rpc(db, 'corporate_review_account', [account.id, 'approve', 'Reviewed']));
  await asUser(db, ids.admin, () => rpc(db, 'corporate_configure_bookings', [true, 'bookings@example.invalid', '+27215551234']));
  await db.exec(readFileSync(migration, 'utf8'));
  const preferences = (user, portal, hours24, hours2) => asUser(db, user, () => rpc(db, 'set_personal_reminder_preferences', [portal, hours24, hours2]));
  const get = (user, portal) => asUser(db, user, () => rpc(db, 'get_personal_reminder_preferences', [portal]));
  return { db, company, other, preferences, get };
}
async function volunteerShift(db, id, starts, user = ids.signup, status = 'Confirmed') {
  await db.query('insert into public.events(id,title,date,location,status) values($1,$2,$3,\'Cape Town\',\'Scheduled\')', [id, 'Shift ' + id, starts.slice(0, 10)]);
  await db.query('insert into public.event_slots(id,event_id,capacity,start_time,end_time) values($1,$1,10,$2,$3)', [id, starts.slice(11, 16), starts.slice(11, 16)]);
  await db.query('insert into public.bookings(user_id,event_id,event_slot_id,status) values($1,$2,$2,$3)', [user, id, status]);
}
async function corporateBooking(db, owner, starts, status = 'Confirmed') {
  const event = await asUser(db, ids.admin, () => rpc(db, 'corporate_save_event', [null, null, JSON.stringify({ title: 'Session ' + randomUUID(), description: 'A corporate session', location: 'Cape Town', starts_at: '2099-11-15T09:00:00+02:00', ends_at: '2099-11-15T11:00:00+02:00', capacity: 20, min_group_size: 1, max_group_size: 20, is_published: true }), randomUUID(), 'Created']));
  let booking = await asUser(db, owner, () => rpc(db, 'corporate_request_booking', [event.id, event.version, 5, '', randomUUID()]));
  if (status !== 'Requested') booking = await asUser(db, ids.admin, () => rpc(db, 'corporate_booking_deadline', [booking.id, booking.version, '2099-11-14T17:00:00+02', 'Payment deadline']));
  if (status === 'Confirmed') booking = await asUser(db, ids.admin, () => rpc(db, 'corporate_record_payment', [booking.id, booking.version, randomUUID(), 'Receipt', '2020-01-01', 'Verified']));
  await db.query("update public.corporate_events set starts_at=$1,ends_at=$1::timestamptz+interval '2 hours' where id=$2", [starts, event.id]);
  return booking;
}
const generateVolunteer = (db, at = now) => db.query('select notification_private.generate_shift_reminders($1) n', [at]).then(r => r.rows[0].n);
const generateCorporate = (db, at = now) => db.query('select notification_private.generate_corporate_reminders($1) n', [at]).then(r => r.rows[0].n);

test('personal reminder preferences preserve legacy opt-outs, reject other-portal writes and remain private', async t => {
  const { db, get, preferences } = await setup(t);
  assert.deepEqual(await get(ids.signup, 'volunteer'), { portal: 'volunteer', reminder_24h: false, reminder_2h: false });
  assert.deepEqual(await get(ids.owner, 'corporate'), { portal: 'corporate', reminder_24h: true, reminder_2h: true });
  assert.equal((await preferences(ids.signup, 'volunteer', true, false)).reminder_2h, false);
  assert.equal((await preferences(ids.owner, 'corporate', false, true)).reminder_24h, false);
  assert.equal((await get(ids.other, 'corporate')).reminder_24h, true);
  const rows = await asUser(db, ids.other, () => db.query('select * from public.personal_reminder_preferences'));
  assert.equal(rows.rows.length, 0);
  await assert.rejects(asUser(db, ids.other, () => db.query('update public.personal_reminder_preferences set reminder_24h=false')), /permission denied/);
  await assert.rejects(get(ids.owner, 'volunteer'), /cannot manage/);
  await assert.rejects(get(ids.signup, 'corporate'), /cannot manage/);
  await assert.rejects(get(ids.owner, 'invalid'), /valid portal/);
  await assert.rejects(preferences(ids.owner, 'corporate', null, true), /Choose both/);
  await assert.rejects(asUser(db, null, () => rpc(db, 'get_personal_reminder_preferences', ['corporate']), 'anon'), /permission denied/);
  for (const name of ['generate_corporate_reminders', 'generate_shift_reminders', 'reminder_user']) {
    await assert.rejects(asUser(db, ids.owner, () => db.query(`select notification_private.${name}(${name === 'reminder_user' ? "'corporate'" : ''})`)), /permission denied/);
  }
  await asUser(db, ids.signup, () => rpc(db, 'set_volunteer_reminder_preference', [false]));
  assert.deepEqual(await get(ids.signup, 'volunteer'), { portal: 'volunteer', reminder_24h: false, reminder_2h: false });
  await asUser(db, ids.signup, () => rpc(db, 'set_volunteer_reminder_preference', [true]));
  assert.equal((await get(ids.signup, 'volunteer')).reminder_2h, true);
});

test('volunteer generation honours separate windows and opt-outs without the old organisation override', async t => {
  const { db, preferences } = await setup(t);
  await volunteerShift(db, 101, '2030-03-02T08:00:00'); // Exactly 24 hours after now, in SA time.
  await volunteerShift(db, 102, '2030-03-01T10:00:00'); // Exactly two hours.
  await volunteerShift(db, 103, '2030-03-01T08:00:00'); // Started.
  await volunteerShift(db, 104, '2030-03-02T09:00:00'); // Not due yet.
  await volunteerShift(db, 105, '2030-03-01T09:00:00', ids.signup, 'Cancelled');
  assert.equal(await generateVolunteer(db), 0, 'A previous opt-out stays off');
  await preferences(ids.signup, 'volunteer', true, false);
  assert.equal(await generateVolunteer(db), 1);
  assert.equal(await generateVolunteer(db), 0, 'Repeated scheduler runs are idempotent');
  await preferences(ids.signup, 'volunteer', false, true);
  assert.equal(await generateVolunteer(db), 1);
  let notices = (await db.query('select * from public.notifications order by event_id')).rows;
  assert.deepEqual(notices.map(n => [n.event_id, n.type, n.is_read]), [[101, 'shift_reminder_24h', true], [102, 'shift_reminder_2h', false]]);
  assert.match(notices[1].message, /01 Mar 2030 "?at"? 10:00/);
  await db.query("insert into public.notifications(user_id,event_id,type,title) values($1,101,'event_cancelled','Important event update')", [ids.signup]);
  await preferences(ids.signup, 'volunteer', false, false);
  notices = (await db.query('select * from public.notifications')).rows;
  assert.ok(notices.filter(n => n.type !== 'event_cancelled').every(n => n.is_read));
  assert.equal(notices.find(n => n.type === 'event_cancelled').is_read, false);
  assert.equal(await generateVolunteer(db), 0);
});

test('corporate reminders require confirmed future sessions and keep booking updates when reminders are off', async t => {
  const { db, company, preferences } = await setup(t);
  const tomorrow = await corporateBooking(db, ids.owner, '2030-03-02T06:00:00Z');
  const soon = await corporateBooking(db, ids.owner, '2030-03-01T08:00:00Z');
  await corporateBooking(db, ids.owner, '2030-03-01T05:00:00Z');
  await corporateBooking(db, ids.owner, '2030-03-02T07:00:00Z');
  await corporateBooking(db, ids.owner, '2030-03-01T07:00:00Z', 'Requested');
  await corporateBooking(db, ids.owner, '2030-03-01T07:00:00Z', 'Pending payment');
  assert.equal(await generateCorporate(db), 2);
  assert.equal(await generateCorporate(db), 0);
  const notices = (await db.query('select * from public.corporate_account_notifications where reminder_hours is not null order by reminder_hours')).rows;
  assert.deepEqual(notices.map(n => n.reminder_hours), [2, 24]);
  assert.match(notices[0].message, /01 Mar 2030 10:00 \(SA time\)/);
  assert.ok(notices.every(n => n.account_id === company.id));
  await preferences(ids.owner, 'corporate', false, true);
  const reads = (await db.query('select notification_id from public.corporate_account_notification_reads where user_id=$1', [ids.owner])).rows.map(r => r.notification_id);
  assert.ok(reads.includes(notices.find(n => n.reminder_hours === 24).id));
  assert.ok(!reads.includes(notices.find(n => n.reminder_hours === 2).id));
  const mandatory = (await db.query("select id from public.corporate_account_notifications where audience='corporate' and reminder_hours is null limit 1")).rows[0].id;
  await preferences(ids.owner, 'corporate', false, false);
  assert.equal((await db.query('select count(*)::integer n from public.corporate_account_notification_reads where notification_id=$1', [mandatory])).rows[0].n, 0);
  assert.equal(await generateCorporate(db), 0);
  await preferences(ids.owner, 'corporate', true, true);
  // A cancelled booking's stale reminder becomes read. No reminder record is deleted.
  await db.query("update public.corporate_events set cancelled_at=now(),cancellation_reason='Cancelled' where id=$1", [soon.event_id]);
  assert.equal(await generateCorporate(db), 0);
  const oldCount = (await db.query('select count(*)::integer n from public.corporate_account_notifications where reminder_hours is not null')).rows[0].n;
  await db.query("update public.corporate_events set starts_at='2030-03-02T05:00:00Z',ends_at='2030-03-02T07:00:00Z' where id=$1", [tomorrow.event_id]);
  assert.equal(await generateCorporate(db), 1, 'A rescheduled confirmed session has its own reminder');
  assert.equal((await db.query('select count(*)::integer n from public.corporate_account_notifications where reminder_hours is not null')).rows[0].n, oldCount + 1);
  const inbox = await asUser(db, ids.other, () => rpc(db, 'corporate_workflow_notices', [0, 100]));
  assert.equal(inbox.rows.some(n => n.booking_id === tomorrow.id), false, 'Other companies cannot see reminder contents');
});

test('corporate timing choices skip missed windows, honour each company and deliver the later enabled threshold', async t => {
  const { db, preferences } = await setup(t);
  await preferences(ids.owner, 'corporate', false, false);
  await preferences(ids.other, 'corporate', true, false);
  await corporateBooking(db, ids.owner, '2030-03-02T06:00:00Z');
  const later = await corporateBooking(db, ids.other, '2030-03-02T06:00:00Z');
  const late = await corporateBooking(db, ids.other, '2030-03-01T07:00:00Z');
  assert.equal(await generateCorporate(db), 1);
  let rows = (await db.query('select target_id,reminder_hours from public.corporate_account_notifications where reminder_hours is not null')).rows;
  assert.deepEqual(rows, [{ target_id: later.id, reminder_hours: 24 }]);
  assert.equal(rows.some(n => n.target_id === late.id), false, 'Do not send a missed 24-hour reminder an hour before the session');
  assert.equal(await generateCorporate(db, '2030-03-02T04:00:00Z'), 0, 'The two-hour reminder is disabled');
  await preferences(ids.other, 'corporate', true, true);
  assert.equal(await generateCorporate(db, '2030-03-02T04:00:00Z'), 1);
  rows = (await db.query('select reminder_hours from public.corporate_account_notifications where target_id=$1 and reminder_hours is not null order by reminder_hours', [later.id])).rows;
  assert.deepEqual(rows.map(n => n.reminder_hours), [2, 24]);
  assert.equal(await generateCorporate(db, '2030-03-02T06:00:00Z'), 0, 'Started sessions never generate a new reminder');
});
