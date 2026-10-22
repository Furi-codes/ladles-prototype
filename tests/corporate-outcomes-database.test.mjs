import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { fixture, asUser, rpc, ids, details, openRegistration, register } from './helpers/corporate-database.mjs';

const deadline='2099-11-14T17:00:00+02:00';
const input={title:'Corporate totals test',description:'Isolated fictional session.',location:'Example venue',starts_at:'2099-11-15T09:15:00+02:00',ends_at:'2099-11-15T10:15:00+02:00',capacity:30,min_group_size:1,max_group_size:30,is_published:true};
async function setup(t) {
  const db=await fixture(t,{outcomes:true}); await openRegistration(db);
  for(const user of [ids.owner,ids.other]) { const account=await register(db,user,details); await asUser(db,ids.admin,()=>rpc(db,'corporate_review_account',[account.id,'approve','Verified.'])); }
  await asUser(db,ids.admin,()=>rpc(db,'corporate_configure_bookings',[true,'booking@example.invalid','+27215551234']));
  await asUser(db,ids.admin,()=>rpc(db,'corporate_configure_changes',[true]));
  const event=await asUser(db,ids.admin,()=>rpc(db,'corporate_save_event',[null,null,JSON.stringify(input),randomUUID(),'Publish.']));
  return {db,event};
}
const request=(db,event,user=ids.owner)=>asUser(db,user,()=>rpc(db,'corporate_request_booking',[event.id,event.version,5,'',randomUUID()]));
const accept=(db,b)=>asUser(db,ids.admin,()=>rpc(db,'corporate_booking_deadline',[b.id,b.version,deadline,'Payment details discussed externally.']));
const pay=(db,b)=>asUser(db,ids.admin,()=>rpc(db,'corporate_record_payment',[b.id,b.version,randomUUID(),'Receipt',new Date().toISOString().slice(0,10),'Verified.']));
const attendance=(db,b,count=3,hours=null,note='Actual headcount checked.',key=randomUUID(),user=ids.admin)=>asUser(db,user,()=>rpc(db,'corporate_record_attendance',[b.id,b.version,key,count,hours,note]));
const report=(db,user=ids.admin,query='',status='',from=null,to=null,offset=0,limit=10)=>asUser(db,user,()=>rpc(db,'corporate_outcome_report',[query,status,from,to,offset,limit]));
// Fixtures may move the event into the past after booking/payment. Production UI cannot bypass time rules.
const endEvent=(db,event)=>db.query("update public.corporate_events set starts_at='2020-11-15T09:15:00+02',ends_at='2020-11-15T10:15:00+02' where id=$1",[event.id]);

test('attendance completes a group once, keeps places/payments, and corrections retain previous totals and notices',async t=>{
  const {db,event}=await setup(t), b=await pay(db,await accept(db,await request(db,event))); await endEvent(db,event);
  const key=randomUUID(), saved=await attendance(db,b,3,null,'Count checked.',key);
  assert.equal(saved.status,'Completed'); assert.equal(saved.attendance.attendance_count,3); assert.equal(saved.attendance.group_hours,null);
  assert.equal(saved.version,b.version+1); assert.equal(saved.event.reserved_places,5);
  const retried=await attendance(db,b,3,null,'Count checked.',key); assert.equal(retried.version,saved.version);
  await assert.rejects(attendance(db,b,4,null,'Count checked.',key),/different attendance/);
  const corrected=await attendance(db,saved,0,0,'Nobody attended; corrected after organiser review.');
  assert.equal(corrected.attendance.group_hours,0); assert.equal(corrected.attendance.attendance_count,0);
  const history=(await db.query("select * from public.corporate_workflow_history where booking_id=$1 and action like 'Group attendance%' order by created_at,id",[b.id])).rows;
  assert.equal(history.length,2); const correction=history.find(row=>row.action==='Group attendance corrected');
  assert.equal(correction.before_values.attendance.attendance_count,3); assert.equal(correction.after_values.attendance.attendance_count,0);
  assert.equal((await db.query('select count(*)::int n from public.corporate_payment_records where booking_id=$1',[b.id])).rows[0].n,1);
  assert.equal((await db.query("select count(*)::int n from public.corporate_account_notifications where target_id=$1 and title='Group attendance updated'",[b.id])).rows[0].n,2);
});

test('attendance validates ended/paid state, real counts, optional hours and stale versions on the server',async t=>{
  const {db,event}=await setup(t), requested=await request(db,event);
  await assert.rejects(attendance(db,requested),/Only ended/);
  const pending=await accept(db,requested); await assert.rejects(attendance(db,pending),/Only ended/);
  const b=await pay(db,pending); await assert.rejects(attendance(db,b),/Only ended/); await endEvent(db,event);
  for(const [count,hours,note] of [[6,null,'Count'],[-1,null,'Count'],[0,1,'Count'],[3,-1,'Count'],[3,1.123,'Count'],[3,'NaN','Count'],[3,'Infinity','Count'],[3,null,' ']]) await assert.rejects(attendance(db,b,count,hours,note));
  const saved=await attendance(db,b); await assert.rejects(attendance(db,b),/changed/);
  const zero=await attendance(db,saved,0,null); assert.equal(zero.attendance.group_hours,null);
});

test('pending changes/cancellation and cancelled events block completion without changing history or capacity',async t=>{
  const {db,event}=await setup(t), b=await pay(db,await accept(db,await request(db,event)));
  const change=await asUser(db,ids.owner,()=>rpc(db,'corporate_request_change',[b.id,b.version,'Cancellation',null,null,null,'Please cancel.',randomUUID()]));
  await endEvent(db,event); await assert.rejects(attendance(db,change),/Only ended/);
  assert.equal((await db.query('select count(*)::int n from public.corporate_group_attendance')).rows[0].n,0);
  await db.query("update public.corporate_booking_changes set status='Closed' where booking_id=$1",[b.id]);
  await db.query("update public.corporate_events set cancelled_at=now(),cancellation_reason='Fixture closure' where id=$1",[event.id]);
  await assert.rejects(attendance(db,change),/Only ended/);
});

test('company isolation and least privilege protect attendance, retry receipts and reports',async t=>{
  const {db,event}=await setup(t), b=await pay(db,await accept(db,await request(db,event))); await endEvent(db,event); await attendance(db,b);
  for(const user of [ids.owner,ids.other]) await assert.rejects(attendance(db,b,3,null,'Test',randomUUID(),user),/Administrator/);
  assert.equal((await asUser(db,ids.other,()=>db.query('select * from public.corporate_group_attendance'))).rows.length,0);
  assert.equal((await asUser(db,ids.owner,()=>db.query('select * from public.corporate_group_attendance'))).rows.length,1);
  await assert.rejects(asUser(db,ids.owner,()=>db.exec('delete from public.corporate_group_attendance')),/permission denied/);
  await assert.rejects(asUser(db,ids.owner,()=>db.exec('select * from corporate_private.attendance_requests')),/permission denied/);
  await assert.rejects(asUser(db,null,()=>rpc(db,'corporate_outcome_report'),'anon'),/permission denied/);
  assert.equal((await report(db,ids.other)).total,0); assert.equal((await report(db,ids.owner)).total,1);
  const permissions=(await db.query("select n.nspname,p.proname,has_function_privilege('anon',p.oid,'execute') allowed from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname in ('corporate_record_attendance','corporate_outcome_report','record_attendance','outcome_report')")).rows;
  assert.equal(permissions.length,4); assert.ok(permissions.every(row=>!row.allowed));
});

test('report pages share full-scope totals/revision and support literal search, SA dates and null versus zero hours',async t=>{
  const {db,event}=await setup(t), first=await pay(db,await accept(db,await request(db,event))), second=await pay(db,await accept(db,await request(db,event,ids.other)));
  await endEvent(db,event); const completed=await attendance(db,first,3,null); await attendance(db,second,2,0);
  const a=await report(db,ids.admin,'','',null,null,0,1),b=await report(db,ids.admin,'','',null,null,1,1);
  assert.equal(a.total,2); assert.equal(a.rows.length,1); assert.equal(a.snapshot,b.snapshot); assert.notEqual(a.rows[0].id,b.rows[0].id);
  assert.deepEqual(a.summary,{bookings:2,accepted_places:10,completed_groups:2,attendance_instances:5,group_hours:0,groups_without_hours:1,overdue_bookings:0});
  assert.equal((await report(db,ids.admin,'%')).total,0);
  assert.equal((await report(db,ids.admin,'','Completed','2020-11-15','2020-11-15')).total,2);
  assert.equal((await report(db,ids.admin,'','Completed','2020-11-16',null)).total,0);
  await assert.rejects(report(db,ids.admin,'','wrong status'),/Invalid report/);
  await assert.rejects(report(db,ids.admin,'','',null,null,0,101),/Invalid report/);
  await attendance(db,completed,3,6,'Hours verified.'); const corrected=await report(db);
  assert.notEqual(corrected.snapshot,a.snapshot); assert.equal(corrected.summary.group_hours,6);
  await db.query("update public.corporate_accounts set contact_name='Changed contact' where owner_user_id=$1",[ids.owner]);
  assert.notEqual((await report(db)).snapshot,corrected.snapshot);
});

test('corporate-only membership cannot be enabled through a client profile edit; legacy volunteers and WMS capacity remain unchanged',async t=>{
  const {db}=await setup(t);
  await db.query('update public.profiles set volunteer_enabled=false where id=$1',[ids.owner]);
  await assert.rejects(asUser(db,ids.owner,()=>db.query('update public.profiles set volunteer_enabled=true where id=$1',[ids.owner])),/cannot be changed/);
  await assert.rejects(asUser(db,ids.owner,()=>db.query('insert into public.bookings(user_id) values($1)',[ids.owner])),/permission denied/);
  assert.equal((await db.query('select volunteer_enabled from public.profiles where id=$1',[ids.other])).rows[0].volunteer_enabled,true);
  assert.equal(await rpc(db,'book_event_slot',[1]),'legacy capacity implementation preserved');
  assert.equal((await db.query('select capacity from public.event_slots where id=1')).rows[0].capacity,6);
  assert.equal((await asUser(db,ids.owner,()=>rpc(db,'corporate_booking_settings'))).outcomes_schema_version,1);
});
