/**
 * Checks admin corporate search, notices, permissions and workflow results.
 * These checks use an isolated local database, so test writes cannot alter the hosted app. They
 * do not prove a live deployment or email delivery.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { fixture, asUser, rpc, ids, details, openRegistration, register } from './helpers/corporate-database.mjs';

const migration = name => readFileSync(new URL('../supabase/migrations/'+name, import.meta.url), 'utf8');
const admin = (db, name, args = [], who = ids.admin) => asUser(db, who, () => rpc(db, name, args));
const notices = (db, args = [], who = ids.admin) => admin(db, 'corporate_admin_notices', args, who);
const eventInput = { title: 'Exclusive corporate event', description: 'Admin authored.', location: 'Test venue', starts_at: '2099-11-15T09:15:00+02:00', ends_at: '2099-11-15T11:15:00+02:00', capacity: 30, min_group_size: 1, max_group_size: 30, is_published: true };
async function setup(t) {
  const db = await fixture(t, { outcomes: true });
  for (const name of ['20261022203830_corporate_event_duration.sql','20261023070518_corporate_exclusive_sessions.sql','20261023073159_admin_corporate_polish.sql']) await db.exec(migration(name));
  await openRegistration(db); const account = await register(db, ids.owner, details);
  await admin(db, 'corporate_review_account', [account.id, 'approve', 'Reviewed.']);
  await admin(db, 'corporate_configure_bookings', [true, 'team@example.invalid', '+27215551234']);
  await admin(db, 'corporate_configure_changes', [true]);
  return { db, account };
}
const save = (db, e, input = eventInput, reason = '') => admin(db, 'corporate_save_event', [e?.id ?? null, e?.version ?? null, JSON.stringify(input), e ? null : randomUUID(), reason]);
const request = (db, e) => asUser(db, ids.owner, () => rpc(db, 'corporate_request_booking', [e.id, e.version, 12, '', randomUUID()]));

test('combined admin inbox pages both sources and counts unread across all pages per administrator', async t => {
  const { db, account } = await setup(t), e = await save(db);
  for (let n=0; n<15; n++) await request(db, e);
  const first = await notices(db), second = await notices(db, ['', false, 10, 10]);
  assert.equal(first.total, 16); assert.equal(first.unread_total, 16);
  assert.equal(first.rows.length, 10); assert.equal(second.rows.length, 6);
  assert.equal(new Set([...first.rows,...second.rows].map(n=>n.id)).size, 16);
  const accounts = await notices(db, ['account', false, 0, 10]), bookings = await notices(db, ['booking', false, 0, 10]);
  assert.equal(accounts.total, 1); assert.equal(bookings.total, 15);
  assert.equal(accounts.rows[0].target_id, account.id); assert.equal(accounts.rows[0].target_kind, 'account');
  assert.ok(bookings.rows.every(n=>n.target_kind==='booking' && n.target_id));
  await admin(db, 'corporate_read_account_notice', [accounts.rows[0].id]);
  assert.equal((await notices(db)).unread_total, 15);
  assert.equal((await notices(db, ['account', true, 0, 10])).total, 0);
  assert.equal((await notices(db, [], ids.admin2)).unread_total, 16);
  await assert.rejects(notices(db, [], ids.owner), /Administrator/);
  await assert.rejects(asUser(db, null, () => rpc(db, 'corporate_admin_notices'), 'anon'), /permission denied/);
  for (const args of [['bad', false, 0, 10], ['', true, -1, 10], ['', false, 0, 101]]) await assert.rejects(notices(db, args), /valid notification/);
});

test('draft/publish edits require a real change message only when open bookings are affected, including stale UI counts', async t => {
  const { db } = await setup(t);
  let e = await save(db, null, { ...eventInput, is_published: false });
  assert.equal(e.state, 'Closed'); assert.equal(e.affected_bookings, 0);
  assert.equal((await asUser(db, ids.owner, () => rpc(db, 'corporate_search_events', ['', null, null, 0, 10]))).rows.some(row => row.id === e.id), false, 'Corporate browsing hides draft sessions');
  assert.equal((await admin(db, 'corporate_search_events', ['', null, null, 0, 10])).rows.some(row => row.id === e.id), true, 'Admins can still manage drafts');
  e = await save(db, e); assert.equal(e.state, 'Available');
  const b = await request(db, e);
  // This e still says zero affected bookings: SQL must not trust the stale browser count.
  await assert.rejects(save(db, e, { ...eventInput, title: 'Moved title' }), /Explain this event change/);
  e = await save(db, e, { ...eventInput, title: 'Moved title' }, 'Programme name corrected; same time and location.');
  assert.equal(e.affected_bookings, 1);
  const companyEvents = await asUser(db, ids.owner, () => rpc(db, 'corporate_search_events', ['', null, null, 0, 10]));
  assert.equal('affected_bookings' in companyEvents.rows[0], false);
  const current = (await admin(db, 'corporate_booking_detail', [b.id])).booking;
  const accepted = await admin(db, 'corporate_booking_deadline', [b.id, current.version, '2099-11-14T17:00:00+02:00', 'Payment discussed.']);
  e = await save(db, e, { ...eventInput, is_published: false }, 'Closed to new requests; your booking is unchanged.');
  assert.equal(e.state, 'Reserved'); assert.equal(e.remaining, 0);
  assert.equal((await asUser(db, ids.owner, () => rpc(db, 'corporate_search_events', ['', null, null, 0, 10]))).rows.some(row => row.id === e.id), false, 'Unpublishing removes the session from corporate browsing');
  assert.equal((await asUser(db, ids.owner, () => rpc(db, 'corporate_booking_detail', [accepted.id]))).booking.id, accepted.id, 'The company keeps access to its own existing booking');
  assert.equal((await admin(db, 'corporate_booking_detail', [accepted.id])).booking.status, 'Pending payment');
  await assert.rejects(admin(db, 'corporate_cancel_event', [e.id, e.version, '']), /record a reason/);
  const cancelled = await admin(db, 'corporate_cancel_event', [e.id, e.version, 'Venue closed. Contact us externally for a refund.']);
  assert.equal(cancelled.state, 'Cancelled');
  assert.equal((await db.query('select count(*)::int n from public.corporate_bookings')).rows[0].n, 1);
});

test('directory searches literal names/emails and unformatted phone digits, with admin-only paging and missing filters', async t => {
  const { db } = await setup(t);
  await db.query("update public.profiles set full_name='Volunteer Alpha',email='alpha@example.invalid',phone='+27 21 555 1234' where id=$1", [ids.other]);
  await db.query("update public.profiles set full_name='Volunteer Beta',email='beta@example.invalid',phone=null where id=$1", [ids.unverified]);
  await db.query('update public.profiles set volunteer_enabled=false where id=$1', [ids.owner]);
  for (const query of ['alpha', 'ALPHA@EXAMPLE', '215551234', '+27 (21) 555-1234']) {
    const result = await admin(db, 'corporate_volunteer_directory', [query, '', 0, 10]);
    assert.equal(result.total, 1); assert.equal(result.rows[0].id, ids.other); assert.equal(result.rows[0].phone, '+27 21 555 1234');
  }
  assert.equal((await admin(db, 'corporate_volunteer_directory', ['%', '', 0, 10])).total, 0);
  assert.equal((await admin(db, 'corporate_volunteer_directory', ['', 'provided', 0, 10])).total, 1);
  const missing = await admin(db, 'corporate_volunteer_directory', ['', 'missing', 0, 1]);
  assert.equal(missing.total, 1); assert.equal(missing.rows[0].id, ids.unverified);
  assert.equal((await admin(db, 'corporate_volunteer_directory', ['', '', 1, 1])).rows.length, 1);
  await assert.rejects(asUser(db, ids.other, () => rpc(db, 'corporate_volunteer_directory', ['', '', 0, 10])), /Administrator/);
});
