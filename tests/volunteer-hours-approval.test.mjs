/** Real Postgres tests for admin hour corrections, access control, stale saves and verified totals. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { asUser, ids } from './helpers/corporate-database.mjs';

// Keep an offline copy of the deployed function for these disposable database tests.
// This fixture never connects to Supabase or changes the hosted database.
const approvalSql = String.raw`
-- Admins can verify a missed clock-in/out from an email and approve the actual times.
-- Keep the write and audit entry in one transaction, using the same attendance rows as QR scans.
create schema if not exists attendance_private;

create or replace function attendance_private.approve_volunteer_hours(
  p_booking_id bigint,
  p_clock_in timestamptz,
  p_clock_out timestamptz,
  p_reason text,
  p_expected_status text,
  p_expected_attendance jsonb
) returns public.attendance_records
language plpgsql security definer set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_attendance public.attendance_records%rowtype;
  v_had_attendance boolean;
  v_date date;
  v_event_status text;
  v_title text;
  v_start time;
  v_end time;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_legacy text[];
  v_minutes integer;
  v_previous jsonb;
begin
  -- A hidden button is not authorisation. Recheck the stored admin role for every call.
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only administrators can approve volunteer hours.' using errcode = '42501';
  end if;
  if p_clock_in is null or p_clock_out is null or not isfinite(p_clock_in) or not isfinite(p_clock_out)
     or p_clock_out <= p_clock_in then
    raise exception 'Departure must be after arrival.';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 5 and 300 then
    raise exception 'Enter a reason between 5 and 300 characters.';
  end if;

  -- QR attendance also locks the booking first. Serialising here prevents competing approvals.
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'The booking no longer exists. Refresh the roster.'; end if;
  if v_booking.status is distinct from p_expected_status then
    raise exception 'This booking has changed. Refresh the roster before approving hours.';
  end if;
  if v_booking.status not in ('Confirmed', 'Present', 'Completed', 'No show') then
    raise exception 'This booking cannot have hours approved.';
  end if;

  select e.date, e.status, e.title into v_date, v_event_status, v_title
  from public.events e where e.id = v_booking.event_id for share;
  if not found then raise exception 'The event no longer exists.'; end if;
  if v_event_status = 'Cancelled' then raise exception 'Hours cannot be approved for a cancelled event.'; end if;
  if v_booking.event_slot_id is not null then
    select s.start_time, s.end_time into v_start, v_end from public.event_slots s
    where s.id = v_booking.event_slot_id and s.event_id = v_booking.event_id for share;
  else
    -- Historical bookings may predate slot IDs; only accept an explicit, valid stored range.
    v_legacy := regexp_match(btrim(v_booking.selected_slot), '^(\d{2}:\d{2})\s*[-â€“]\s*(\d{2}:\d{2})$');
    if v_legacy is not null then v_start := v_legacy[1]::time; v_end := v_legacy[2]::time; end if;
  end if;
  if v_start is null or v_end is null or v_end <= v_start then
    raise exception 'This booking has no valid time range.';
  end if;
  v_start_at := (v_date + v_start) at time zone 'Africa/Johannesburg';
  v_end_at := (v_date + v_end) at time zone 'Africa/Johannesburg';
  if v_end_at > now() then raise exception 'Hours can be approved after the booked shift ends.'; end if;
  if (p_clock_in at time zone 'Africa/Johannesburg')::date <> v_date
     or (p_clock_out at time zone 'Africa/Johannesburg')::date <> v_date
     or p_clock_in < v_start_at - interval '30 minutes' or p_clock_out > v_end_at then
    raise exception 'Use times within the booked shift, allowing arrival up to 30 minutes early.';
  end if;

  select * into v_attendance from public.attendance_records where booking_id = p_booking_id for update;
  v_had_attendance := found;
  -- Compare parsed timestamps, so equivalent UTC and +02:00 representations match.
  if v_had_attendance then
    if p_expected_attendance is null or jsonb_typeof(p_expected_attendance) <> 'object'
       or not (p_expected_attendance ?& array['clocked_in_at','clocked_out_at','worked_minutes']) then
      raise exception 'Attendance has changed. Refresh the roster before approving hours.';
    end if;
    if v_attendance.clocked_in_at is distinct from (p_expected_attendance->>'clocked_in_at')::timestamptz
       or v_attendance.clocked_out_at is distinct from (p_expected_attendance->>'clocked_out_at')::timestamptz
       or v_attendance.worked_minutes is distinct from (p_expected_attendance->>'worked_minutes')::integer then
      raise exception 'Attendance has changed. Refresh the roster before approving hours.';
    end if;
  elsif p_expected_attendance is not null then
    raise exception 'Attendance has changed. Refresh the roster before approving hours.';
  end if;

  v_minutes := floor(extract(epoch from (p_clock_out - p_clock_in)) / 60)::integer;
  v_previous := jsonb_build_object('previous_status', v_booking.status,
    'previous_clock_in', v_attendance.clocked_in_at, 'previous_clock_out', v_attendance.clocked_out_at,
    'previous_worked_minutes', v_attendance.worked_minutes);
  -- Reapproving unchanged values is a no-op, rather than creating a duplicate audit entry.
  if v_booking.status = 'Completed' and v_attendance.clocked_in_at = p_clock_in
     and v_attendance.clocked_out_at = p_clock_out and v_attendance.worked_minutes = v_minutes then
    return v_attendance;
  end if;

  insert into public.attendance_records (booking_id, clocked_in_at, clocked_out_at, worked_minutes)
  values (p_booking_id, p_clock_in, p_clock_out, v_minutes)
  on conflict (booking_id) do update set clocked_in_at = excluded.clocked_in_at,
    clocked_out_at = excluded.clocked_out_at, worked_minutes = excluded.worked_minutes
  returning * into v_attendance;
  update public.bookings set status = 'Completed' where id = p_booking_id;
  perform public.log_admin_action('VOLUNTEER_HOURS_APPROVED', 'BOOKING', p_booking_id::text,
    v_booking.volunteer_name || ' Â· ' || v_title,
    v_previous || jsonb_build_object('date', v_date, 'clock_in', p_clock_in, 'clock_out', p_clock_out,
      'worked_minutes', v_minutes, 'status', 'Completed', 'approval_reason', btrim(p_reason)));
  return v_attendance;
end;
$$;

-- Only this invoker wrapper is exposed as an API endpoint; privilege escalation stays private.
create or replace function public.admin_approve_volunteer_hours(
  p_booking_id bigint, p_clock_in timestamptz, p_clock_out timestamptz, p_reason text,
  p_expected_status text, p_expected_attendance jsonb
) returns public.attendance_records language sql security invoker set search_path = ''
as $$ select attendance_private.approve_volunteer_hours(p_booking_id, p_clock_in, p_clock_out,
  p_reason, p_expected_status, p_expected_attendance); $$;

revoke all on function attendance_private.approve_volunteer_hours(bigint,timestamptz,timestamptz,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.admin_approve_volunteer_hours(bigint,timestamptz,timestamptz,text,text,jsonb) from public, anon, authenticated;
grant usage on schema attendance_private to authenticated;
grant execute on function attendance_private.approve_volunteer_hours(bigint,timestamptz,timestamptz,text,text,jsonb) to authenticated;
grant execute on function public.admin_approve_volunteer_hours(bigint,timestamptz,timestamptz,text,text,jsonb) to authenticated;
`;
const load = async file => import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64')}`);
const { getVerifiedContribution } = await load('../business/shared/dates/attendance.ts');
const { rosterShiftTimes, validateApprovedTimes } = await load('../business/admin/hours.ts');
const start = '2020-01-02T09:15:00+02:00', end = '2020-01-02T10:15:00+02:00';

/** A small copy of the inspected live attendance schema; all writes run in disposable Postgres. */
async function fixture(t) {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon;
    create table profiles(id uuid primary key,role text);
    insert into profiles values('${ids.admin}','admin'),('${ids.admin2}','admin'),('${ids.owner}','volunteer');
    create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin')$$;
    create table events(id bigint primary key,date date,status text,title text);
    create table event_slots(id bigint primary key,event_id bigint,start_time time,end_time time);
    create table bookings(id bigint primary key,event_id bigint,event_slot_id bigint,user_id uuid,volunteer_name text,selected_slot text,status text,wms_booking_id text);
    create table attendance_records(id bigint generated always as identity primary key,booking_id bigint unique references bookings(id),clocked_in_at timestamptz,clocked_out_at timestamptz,worked_minutes integer check(worked_minutes>=0),wms_attendance_id text,wms_last_synced_at timestamptz);
    create table admin_audit_log(id bigint generated always as identity,admin_id uuid,action text,entity_label text,details jsonb);
    create function public.log_admin_action(p_action text,p_entity_type text,p_entity_id text,p_entity_label text,p_details jsonb) returns void language plpgsql security definer set search_path='' as $$begin
      if not public.is_admin() then raise exception 'Admin required'; end if;
      insert into public.admin_audit_log(admin_id,action,entity_label,details) values(auth.uid(),p_action,p_entity_label,p_details);
    end$$;
    insert into events values(1,'2020-01-02','Scheduled','Quarter hour shift'),(2,'2099-01-02','Scheduled','Future shift'),(3,'2020-01-02','Cancelled','Cancelled event');
    insert into event_slots values(1,1,'09:15','10:15'),(2,2,'09:15','10:15'),(3,3,'09:15','10:15');
    insert into bookings values(1,1,1,'${ids.owner}','Test Volunteer','09:15-10:15','No show','wms-booking'),(2,2,2,'${ids.owner}','Test Volunteer','09:15-10:15','Confirmed',null),(3,3,3,'${ids.owner}','Test Volunteer','09:15-10:15','Confirmed',null);
    alter table attendance_records enable row level security;
    grant select on attendance_records,bookings to authenticated;
    create policy attendance_read on attendance_records for select to authenticated using(public.is_admin() or exists(select 1 from bookings b where b.id=booking_id and b.user_id=auth.uid()));
  `);
  await db.exec(approvalSql);
  return db;
}
async function approve(db, { user = ids.admin, role = 'authenticated', id = 1, arrival = start, departure = end, reason = 'Verified volunteer email', status = 'No show', expected = null } = {}) {
  return asUser(db,user,async () => (await db.query('select to_jsonb(public.admin_approve_volunteer_hours($1,$2,$3,$4,$5,$6)) as result', [id,arrival,departure,reason,status,expected === null ? null : JSON.stringify(expected)])).rows[0].result,role);
}
async function record(db) {
  return (await db.query('select booking_id,clocked_in_at,clocked_out_at,worked_minutes from attendance_records where booking_id=1')).rows[0];
}

test('admin approves a missed check-in: one completed booking, verified certificate hours and audit reason', async t => {
  const db = await fixture(t);
  const result = await approve(db);
  assert.equal(result.worked_minutes,60);
  const booking = (await db.query('select * from bookings where id=1')).rows[0];
  assert.equal(booking.status,'Completed'); assert.equal(booking.wms_booking_id,'wms-booking');
  assert.equal(getVerifiedContribution([booking],[result],ids.owner).totalMinutes,60);
  const log = (await db.query('select * from admin_audit_log')).rows[0];
  assert.equal(log.admin_id,ids.admin); assert.equal(log.action,'VOLUNTEER_HOURS_APPROVED');
  assert.equal(log.details.approval_reason,'Verified volunteer email');
  assert.equal(log.details.previous_status,'No show');
  assert.equal(log.details.worked_minutes,60);
  // The volunteer reads the same finalised row; privileged write access is still unavailable.
  const own = await asUser(db,ids.owner,() => db.query('select * from attendance_records'));
  assert.equal(own.rows[0].worked_minutes,60);
  await assert.rejects(asUser(db,ids.owner,() => db.query('update attendance_records set worked_minutes=999')), /permission denied/);
});

test('missed check-out and later correction keep a single record and preserve WMS identifiers', async t => {
  const db = await fixture(t);
  await db.query("update bookings set status='Present' where id=1");
  await db.query('insert into attendance_records(booking_id,clocked_in_at,wms_attendance_id) values(1,$1,$2)',[start,'wms-attendance']);
  const original = await record(db);
  const result = await approve(db,{status:'Present',expected:original});
  assert.equal(result.worked_minutes,60); assert.equal(result.wms_attendance_id,'wms-attendance');
  const corrected = await approve(db,{departure:'2020-01-02T10:00:00+02:00',status:'Completed',expected:result});
  assert.equal(corrected.worked_minutes,45);
  assert.equal((await db.query('select count(*)::int as n from attendance_records')).rows[0].n,1);
  assert.equal((await db.query('select details from admin_audit_log order by id desc limit 1')).rows[0].details.previous_worked_minutes,60);
});

test('volunteers, anonymous callers and logged-out requests cannot approve hours', async t => {
  const db = await fixture(t);
  await assert.rejects(approve(db,{user:ids.owner}),/Only administrators/);
  await assert.rejects(approve(db,{user:null}),/Only administrators/);
  await assert.rejects(approve(db,{user:null,role:'anon'}),/permission denied/);
  assert.equal((await db.query('select count(*)::int as n from attendance_records')).rows[0].n,0);
});

test('invalid times, future shifts, cancellation and missing reasons leave attendance unchanged', async t => {
  const db = await fixture(t);
  for (const [input,message] of [
    [{arrival:null},/Departure/], [{departure:start},/Departure/], [{arrival:'-infinity'},/Departure/],
    [{arrival:'2020-01-02T08:44:00+02:00'},/within the booked shift/],
    [{departure:'2020-01-02T10:16:00+02:00'},/within the booked shift/],
    [{arrival:'2020-01-01T09:15:00+02:00'},/within the booked shift/],
    [{id:2,status:'Confirmed'},/after the booked shift/], [{id:3,status:'Confirmed'},/cancelled/],
    [{id:999},/no longer exists/], [{reason:' '},/reason/], [{reason:'a'.repeat(301)},/reason/],
  ]) await assert.rejects(approve(db,input),message);
  assert.equal((await db.query('select count(*)::int as n from attendance_records')).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int as n from admin_audit_log')).rows[0].n,0);
});

test('stale admin snapshots and duplicate submissions cannot overwrite newer attendance', async t => {
  const db = await fixture(t);
  const first = await approve(db);
  await assert.rejects(approve(db,{user:ids.admin2}),/booking has changed/);
  await assert.rejects(approve(db,{status:'Completed',expected:null}),/Attendance has changed/);
  await assert.rejects(approve(db,{status:'Completed',expected:{...first,worked_minutes:40}}),/Attendance has changed/);
  const again = await approve(db,{status:'Completed',expected:first});
  assert.equal(again.worked_minutes,60);
  assert.equal((await db.query('select count(*)::int as n from admin_audit_log')).rows[0].n,1);
});

test('historical readable ranges work, and an audit failure rolls back both hours and status', async t => {
  const db = await fixture(t);
  await db.query('update bookings set event_slot_id=null where id=1');
  await db.exec("create or replace function public.log_admin_action(p_action text,p_entity_type text,p_entity_id text,p_entity_label text,p_details jsonb) returns void language plpgsql as $$begin raise exception 'Audit unavailable'; end$$");
  await assert.rejects(approve(db),/Audit unavailable/);
  assert.equal((await db.query('select status from bookings where id=1')).rows[0].status,'No show');
  assert.equal((await db.query('select count(*)::int as n from attendance_records')).rows[0].n,0);
  await db.query("update bookings set selected_slot='unreadable' where id=1");
  await assert.rejects(approve(db),/no valid time range/);
});

test('form preview uses South African quarter-hour boundaries and rejects impossible corrections', () => {
  const shift = rosterShiftTimes({date:'2020-01-02'},{selected_slot:'09:15–10:15'});
  assert.equal(validateApprovedTimes('2020-01-02',shift,'09:15','10:00').minutes,45);
  assert.equal(validateApprovedTimes('2020-01-02',shift,'08:45','10:15').minutes,90);
  assert.match(validateApprovedTimes('2020-01-02',shift,'10:15','09:15').error,/Departure/);
  assert.match(validateApprovedTimes('2020-01-02',shift,'08:44','10:15').error,/within the booked shift/);
  assert.match(validateApprovedTimes('2020-01-02',shift,'09:15','10:16').error,/within the booked shift/);
  assert.match(validateApprovedTimes('2020-01-02',shift,'09:15','10:15',Date.parse(start)).error,/after the booked shift/);
  assert.equal(rosterShiftTimes({date:'2020-01-02'},{selected_slot:'unknown'}),null);
});
