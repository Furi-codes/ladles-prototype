/**
 * Checks that corporate hours describe the whole event, including validation and reports.
 * These checks use an isolated local database, so test writes cannot alter the hosted app. They
 * do not prove a live deployment or email delivery.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { fixture, asUser, rpc, ids, details, openRegistration, register } from './helpers/corporate-database.mjs';

const migration = readFileSync(new URL('../supabase/migrations/20261022203830_corporate_event_duration.sql', import.meta.url), 'utf8');
async function setup(t, migrate = true) {
  const db = await fixture(t, { outcomes: true });
  await openRegistration(db);
  const account = await register(db, ids.owner, details);
  await asUser(db, ids.admin, () => rpc(db, 'corporate_review_account', [account.id, 'approve', 'Reviewed.']));
  await asUser(db, ids.admin, () => rpc(db, 'corporate_configure_bookings', [true, 'booking@example.invalid', '+27215551234']));
  const event = await asUser(db, ids.admin, () => rpc(db, 'corporate_save_event', [null, null, JSON.stringify({ title: 'Two-hour event', description: 'Test duration.', location: 'Test venue', starts_at: '2099-11-15T09:15:00+02:00', ends_at: '2099-11-15T11:15:00+02:00', capacity: 30, min_group_size: 1, max_group_size: 30, is_published: true }), randomUUID(), 'Publish.']));
  let b = await asUser(db, ids.owner, () => rpc(db, 'corporate_request_booking', [event.id, event.version, 12, '', randomUUID()]));
  b = await asUser(db, ids.admin, () => rpc(db, 'corporate_booking_deadline', [b.id, b.version, '2099-11-14T17:00:00+02:00', 'Discussed payment.']));
  b = await asUser(db, ids.admin, () => rpc(db, 'corporate_record_payment', [b.id, b.version, randomUUID(), 'Receipt', '2026-10-22', 'Verified.']));
  await db.query("update public.corporate_events set starts_at='2020-11-15T09:15:00+02',ends_at='2020-11-15T11:15:00+02' where id=$1", [event.id]);
  if (migrate) await db.exec(migration);
  return { db, b };
}
const record = (db, b, count = 12, hours = 2, note = 'Two-hour event completed.', key = randomUUID(), user = ids.admin) => asUser(db, user, () => rpc(db, 'corporate_record_event_attendance', [b.id, b.version, key, count, hours, note]));
const report = (db, user = ids.admin) => asUser(db, user, () => rpc(db, 'corporate_event_outcome_report'));

test('twelve attendees at a two-hour event produce two event hours, including reports, retries and correction history', async t => {
  const { db, b } = await setup(t), key = randomUUID();
  const saved = await record(db, b, 12, 2, 'Two-hour event completed.', key);
  assert.equal(saved.status, 'Completed'); assert.equal(saved.attendance.event_hours, 2);
  assert.equal(saved.attendance.attendance_count, 12); assert.equal(saved.attendance.group_hours, null);
  assert.equal(saved.event.reserved_places, 12);
  assert.equal((await record(db, b, 12, 2, 'Two-hour event completed.', key)).version, saved.version);
  const totals = await report(db);
  assert.equal(totals.summary.event_hours, 2); assert.equal(totals.summary.attendance_instances, 12);
  assert.equal(totals.rows[0].attendance.event_hours, 2);
  await assert.rejects(record(db, b), /changed/);
  const corrected = await record(db, saved, 12, 3, 'Event ran for three hours.');
  assert.equal((await report(db)).summary.event_hours, 3);
  assert.notEqual((await report(db)).snapshot, totals.snapshot);
  const history = (await db.query("select before_values,after_values from public.corporate_workflow_history where booking_id=$1 and action='Group attendance corrected'", [b.id])).rows[0];
  assert.equal(history.before_values.attendance.event_hours, 2); assert.equal(history.after_values.attendance.event_hours, 3);
  assert.equal((await db.query('select count(*)::int n from public.corporate_payment_records where booking_id=$1', [b.id])).rows[0].n, 1);
  assert.equal((await asUser(db, ids.owner, () => rpc(db, 'corporate_booking_settings'))).event_hours_schema_version, 1);
  assert.equal(corrected.event.reserved_places, 12);
});

test('server enforces whole event hours, optional versus zero, admin access and company isolation', async t => {
  const { db, b } = await setup(t);
  for (const hours of [1.5, 2.01, -1, 25, 'NaN', 'Infinity']) await assert.rejects(record(db, b, 12, hours), /whole event hours/);
  await assert.rejects(record(db, b, 0, 2), /whole event hours/);
  await assert.rejects(record(db, b, 13, 2), /exceed/);
  await assert.rejects(record(db, b, 12, 2, ''), /required note/);
  for (const user of [ids.owner, ids.other]) await assert.rejects(record(db, b, 12, 2, 'Note', randomUUID(), user), /Administrator/);
  const blank = await record(db, b, 12, null);
  assert.equal(blank.attendance.event_hours, null); assert.equal((await report(db)).summary.groups_without_hours, 1);
  const zero = await record(db, blank, 0, 0);
  assert.equal(zero.attendance.event_hours, 0); assert.equal((await report(db)).summary.groups_without_hours, 0);
  assert.equal((await report(db, ids.owner)).total, 1); assert.equal((await report(db, ids.other)).total, 0);
  await assert.rejects(asUser(db, null, () => rpc(db, 'corporate_event_outcome_report'), 'anon'), /permission denied/);
  await assert.rejects(asUser(db, ids.owner, () => db.query('update public.corporate_group_attendance set event_hours=24')), /permission denied/);
  await assert.rejects(asUser(db, ids.admin, () => rpc(db, 'corporate_record_attendance', [b.id, b.version, randomUUID(), 12, 24, 'Old client.'])), /refresh or update/);
  assert.equal((await db.query('select capacity from public.event_slots where id=1')).rows[0].capacity, 6);
});

test('migration preserves legacy combined hours without treating them as event duration', async t => {
  const { db, b } = await setup(t, false);
  const legacy = await asUser(db, ids.admin, () => rpc(db, 'corporate_record_attendance', [b.id, b.version, randomUUID(), 12, 24, 'Legacy combined hours.']));
  await db.exec(migration);
  const totals = await report(db);
  assert.equal(totals.summary.event_hours, 0); assert.equal(totals.summary.groups_without_hours, 1);
  assert.equal(totals.rows[0].attendance.group_hours, 24); assert.equal(totals.rows[0].attendance.event_hours, null);
  const corrected = await record(db, legacy, 12, 2, 'Admin checked event duration.');
  assert.equal(corrected.attendance.event_hours, 2); assert.equal(corrected.attendance.group_hours, 24);
  const zero = await record(db, corrected, 0, 0, 'Correction: company did not attend.');
  assert.equal(zero.attendance.group_hours, 24); assert.equal((await report(db)).summary.event_hours, 0);
});
