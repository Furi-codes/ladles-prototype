/**
 * Checks booking changes, cancellations, retries and their effect on the held session.
 * These checks use an isolated local database, so test writes cannot alter the hosted app. They
 * do not prove a live deployment or email delivery.
 */

import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {fixture,asUser,rpc,ids,details,openRegistration,register} from './helpers/corporate-database.mjs';

const eventInput={title:'Corporate-only session',description:'Fictional admin-authored activity.',location:'Example venue',starts_at:'2099-11-15T09:15:00+02:00',ends_at:'2099-11-15T10:15:00+02:00',capacity:10,min_group_size:1,max_group_size:10,is_published:true};
const deadline='2099-11-14T17:00:00+02:00';
async function setup(t){
  const db=await fixture(t,{changes:true});await openRegistration(db);
  for(const user of [ids.owner,ids.other]){const company=await register(db,user,details);await asUser(db,ids.admin,()=>rpc(db,'corporate_review_account',[company.id,'approve','Verified.']));}
  await asUser(db,ids.admin,()=>rpc(db,'corporate_configure_bookings',[true,'booking@example.invalid','+27215551234']));
  await asUser(db,ids.admin,()=>rpc(db,'corporate_configure_changes',[true]));return db;
}
const createEvent=(db,input=eventInput)=>asUser(db,ids.admin,()=>rpc(db,'corporate_save_event',[null,null,JSON.stringify(input),randomUUID(),'Publish.']));
const request=(db,e,size=7,user=ids.owner)=>asUser(db,user,()=>rpc(db,'corporate_request_booking',[e.id,e.version,size,'',randomUUID()]));
const accept=(db,b)=>asUser(db,ids.admin,()=>rpc(db,'corporate_booking_deadline',[b.id,b.version,deadline,'External payment details discussed.']));
const pay=(db,b)=>asUser(db,ids.admin,()=>rpc(db,'corporate_record_payment',[b.id,b.version,randomUUID(),'REF',new Date().toISOString().slice(0,10),'Verified.']));
const detail=(db,id,user=ids.owner)=>asUser(db,user,()=>rpc(db,'corporate_booking_detail',[id]));
const change=(db,b,e,size=5,key=randomUUID(),kind='Amendment',user=ids.owner)=>asUser(db,user,()=>rpc(db,'corporate_request_change',[b.id,b.version,kind,e?.id??null,e?.version??null,kind==='Cancellation'?null:size,'Please review.',key]));
const review=(db,b,approve=true,amount=null,due=null)=>asUser(db,ids.admin,()=>rpc(db,'corporate_review_change',[b.id,b.version,b.pending_change.id,approve,'Discussed externally.',amount,due]));
const event=(db,id)=>db.query('select * from public.corporate_events where id=$1',[id]).then(r=>r.rows[0]);
const cancel=(db,e)=>asUser(db,ids.admin,()=>rpc(db,'corporate_cancel_event',[e.id,e.version,'Venue unavailable. Refund follow-up external.']));

test('third migration starts closed, enforces permissions and preserves legacy capacity',async t=>{
  const db=await fixture(t,{changes:true});
  const settings=await asUser(db,ids.owner,()=>rpc(db,'corporate_booking_settings'));assert.equal(settings.changes_enabled,false);assert.equal(settings.changes_schema_version,1);
  await assert.rejects(asUser(db,ids.owner,()=>rpc(db,'corporate_configure_changes',[true])),/Administrator/);
  for(const table of ['corporate_booking_changes']){
    await assert.rejects(asUser(db,ids.owner,()=>db.exec('delete from public.'+table)),/permission denied/);
    await assert.rejects(asUser(db,null,()=>db.exec('select * from public.'+table),'anon'),/permission denied/);
  }
  await assert.rejects(asUser(db,ids.owner,()=>db.exec('select corporate_private.lock_workflow()')),/permission denied/);
  assert.equal(await rpc(db,'book_event_slot',[1]),'legacy capacity implementation preserved');assert.equal((await db.query('select capacity from public.event_slots where id=1')).rows[0].capacity,6);
});

test('proposals are idempotent and keep original places; decline leaves booking and receipts intact',async t=>{
  const db=await setup(t),e=await createEvent(db),target=await createEvent(db),b=await pay(db,await accept(db,await request(db,e))),key=randomUUID();
  const proposed=await change(db,b,target,5,key);
  assert.equal(proposed.event_id,e.id);assert.equal(proposed.group_size,7);assert.equal((await event(db,e.id)).reserved_places,7);assert.equal((await event(db,target.id)).reserved_places,0);
  assert.equal((await change(db,b,target,5,key)).pending_change.id,proposed.pending_change.id);
  await assert.rejects(change(db,b,target,6,key),/Change key/);
  await assert.rejects(change(db,proposed,target,6),/already awaiting/);
  const declined=await review(db,proposed,false);assert.equal(declined.pending_change,null);assert.equal(declined.event_id,e.id);
  const loaded=await detail(db,b.id);assert.equal(loaded.payments.length,1);assert.equal(loaded.changes[0].status,'Declined');
  const filtered=await asUser(db,ids.admin,()=>rpc(db,'corporate_search_bookings',['','Change requested',null,null,0,10]));assert.equal(filtered.total,0);
});

test('accepting an amendment atomically transfers held places and never silently confirms unaccepted requests',async t=>{
  const db=await setup(t),e=await createEvent(db),target=await createEvent(db),b=await accept(db,await request(db,e));
  const proposed=await change(db,b,target,5);const moved=await review(db,proposed);
  assert.equal(moved.event_id,target.id);assert.equal(moved.group_size,5);assert.equal(moved.status,'Pending payment');
  assert.equal((await event(db,e.id)).reserved_places,0);assert.equal((await event(db,target.id)).reserved_places,5);
  assert.equal(moved.event_snapshot.id,e.id);assert.equal(moved.contact_snapshot.billing_address,details.billing_address);
  const unaccepted=await request(db,e,2,ids.other),pending=await change(db,unaccepted,target,2,randomUUID(),'Amendment',ids.other);
  const result=await review(db,pending);assert.equal(result.status,'Requested');assert.equal((await event(db,target.id)).reserved_places,5);
});

test('capacity lost to another acceptance aborts the whole transfer, request decision, history and notices',async t=>{
  const db=await setup(t),e=await createEvent(db),target=await createEvent(db),b=await accept(db,await request(db,e));
  const proposed=await change(db,b,target,7);await accept(db,await request(db,target,7,ids.other));
  const before=(await db.query('select (select count(*) from public.corporate_workflow_history)::int h,(select count(*) from public.corporate_account_notifications)::int n')).rows[0];
  await assert.rejects(review(db,proposed),/Insufficient corporate capacity/);
  const after=await detail(db,b.id);assert.equal(after.booking.event_id,e.id);assert.equal(after.booking.pending_change.status,'Requested');
  assert.equal((await event(db,e.id)).reserved_places,7);assert.equal((await event(db,target.id)).reserved_places,7);
  assert.deepEqual((await db.query('select (select count(*) from public.corporate_workflow_history)::int h,(select count(*) from public.corporate_account_notifications)::int n')).rows[0],before);
});

test('same-event amendments credit existing held places, reduce/increase only by the difference',async t=>{
  const db=await setup(t),e=await createEvent(db),b=await accept(db,await request(db,e));
  const down=await review(db,await change(db,b,e,3));assert.equal((await event(db,e.id)).reserved_places,3);
  const up=await review(db,await change(db,down,e,10));assert.equal((await event(db,e.id)).reserved_places,10);
  assert.equal(up.group_size,10);
});

test('paid changes retain earlier receipts and can require a positive additional ZAR amount/deadline',async t=>{
  const db=await setup(t),e=await createEvent(db),target=await createEvent(db),b=await pay(db,await accept(db,await request(db,e)));
  const proposed=await change(db,b,target,5);
  for(const [amount,due] of [[0,deadline],[1.001,deadline],[-1,deadline],[100,target.starts_at],[100,'2020-01-01T00:00:00Z']])await assert.rejects(review(db,proposed,true,amount,due));
  const moved=await review(db,proposed,true,1250.50,deadline);assert.equal(moved.status,'Pending additional payment');assert.equal(Number(moved.additional_payment_amount),1250.5);
  assert.equal((await detail(db,b.id)).payments.length,1);assert.equal((await event(db,target.id)).reserved_places,5);
  const confirmed=await pay(db,moved);assert.equal(confirmed.status,'Confirmed');
  const payments=(await detail(db,b.id)).payments;assert.equal(payments.length,2);assert.equal(Number(payments[1].additional_amount_snapshot),1250.5);
});

test('pending proposals block conflicting payment/deadline decisions and target edits invalidate approval',async t=>{
  const db=await setup(t),e=await createEvent(db),target=await createEvent(db),b=await accept(db,await request(db,e));
  const proposed=await change(db,b,target,5);
  await assert.rejects(pay(db,proposed),/outstanding change/);assert.equal((await detail(db,b.id)).payments.length,0);
  await assert.rejects(accept(db,proposed),/outstanding change/);
  await asUser(db,ids.admin,()=>rpc(db,'corporate_save_event',[target.id,target.version,JSON.stringify({...eventInput,location:'Changed venue'}),null,'Venue updated.']));
  await assert.rejects(review(db,proposed),/Booking changed/);
  const refreshed=(await detail(db,b.id)).booking;
  await assert.rejects(review(db,refreshed),/Proposed event changed/);
  const notices=await asUser(db,ids.owner,()=>rpc(db,'corporate_workflow_notices'));assert.ok(notices.rows.some(n=>n.title==='Proposed corporate event updated'&&n.booking_id===b.id));
  await review(db,refreshed,false);assert.equal((await event(db,e.id)).reserved_places,7);
});

test('cancellation requests retain places until approval, can be declined and cannot cross company boundaries',async t=>{
  const db=await setup(t),e=await createEvent(db),b=await pay(db,await accept(db,await request(db,e)));
  await assert.rejects(change(db,b,null,null,randomUUID(),'Cancellation',ids.other),/own booking/);
  const proposed=await change(db,b,null,null,randomUUID(),'Cancellation');assert.equal((await event(db,e.id)).reserved_places,7);
  const own=await asUser(db,ids.other,()=>db.query('select * from public.corporate_booking_changes'));assert.equal(own.rows.length,0);
  await assert.rejects(asUser(db,ids.owner,()=>rpc(db,'corporate_review_change',[b.id,proposed.version,proposed.pending_change.id,true,'Self approval',null,null])),/Administrator/);
  const declined=await review(db,proposed,false);assert.equal(declined.status,'Confirmed');
  const pending=await change(db,declined,null,null,randomUUID(),'Cancellation'),cancelled=await review(db,pending);
  assert.equal(cancelled.status,'Cancelled');assert.equal((await event(db,e.id)).reserved_places,0);assert.equal((await detail(db,b.id)).payments.length,1);
  await assert.rejects(review(db,pending),/Booking changed/);
});

test('event cancellation cancels owned bookings and declines incoming proposals without losing original reservations',async t=>{
  const db=await setup(t),e=await createEvent(db),target=await createEvent(db),b=await pay(db,await accept(db,await request(db,e)));
  const incoming=await change(db,b,target,5);const onTarget=await accept(db,await request(db,target,3,ids.other));
  const cancelled=await cancel(db,target);assert.equal(cancelled.state,'Cancelled');assert.equal(cancelled.reserved_places,0);
  assert.equal((await detail(db,onTarget.id,ids.other)).booking.status,'Cancelled');
  const original=await detail(db,b.id);assert.equal(original.booking.event_id,e.id);assert.equal(original.booking.status,'Confirmed');assert.equal(original.booking.pending_change,null);assert.equal(original.payments.length,1);assert.equal((await event(db,e.id)).reserved_places,7);
  await assert.rejects(review(db,incoming),/Booking changed/);
  await assert.rejects(asUser(db,ids.admin,()=>rpc(db,'corporate_save_event',[target.id,cancelled.version,JSON.stringify(eventInput),null,'Republish.'])),/cancelled corporate event/);
  const notices=await asUser(db,ids.other,()=>rpc(db,'corporate_workflow_notices'));assert.ok(notices.rows.some(n=>n.title==='Corporate event cancelled'&&n.booking_id===onTarget.id));
  await cancel(db,e);assert.equal((await detail(db,b.id)).payments.length,1);assert.equal((await event(db,e.id)).reserved_places,0);
});

test('original start closes new self-service requests and amendment approval, but existing cancellation can be reviewed',async t=>{
  const db=await setup(t),e=await createEvent(db),target=await createEvent(db),b=await accept(db,await request(db,e));
  const proposed=await change(db,b,target,5);
  await db.query("update public.corporate_events set starts_at='2020-11-15T09:15:00+02:00',ends_at='2020-11-15T10:15:00+02:00' where id=$1",[e.id]);
  await assert.rejects(review(db,proposed),/started, closed or cancelled/);
  const original=await review(db,proposed,false);await assert.rejects(change(db,original,null,null,randomUUID(),'Cancellation'),/original event starts/);
  const next=await createEvent(db),other=await accept(db,await request(db,next,2,ids.other)),pending=await change(db,other,null,null,randomUUID(),'Cancellation',ids.other);
  await db.query("update public.corporate_events set starts_at='2020-11-15T09:15:00+02:00',ends_at='2020-11-15T10:15:00+02:00' where id=$1",[next.id]);
  assert.equal((await review(db,pending)).status,'Cancelled');
});

test('pending payments moved earlier need a new valid deadline, and rejection closes the outstanding proposal',async t=>{
  const db=await setup(t),e=await createEvent(db),earlier=await createEvent(db,{...eventInput,starts_at:'2099-11-14T09:15:00+02:00',ends_at:'2099-11-14T10:15:00+02:00'});
  const b=await accept(db,await request(db,e)),proposed=await change(db,b,earlier,5);
  await assert.rejects(review(db,proposed),/payment deadline strictly before/);
  const moved=await review(db,proposed,true,null,'2099-11-13T17:00:00+02:00');assert.equal(moved.event_id,earlier.id);assert.equal((await event(db,e.id)).reserved_places,0);
  const cancellation=await change(db,moved,null,null,randomUUID(),'Cancellation');
  await asUser(db,ids.admin,()=>rpc(db,'corporate_reject_booking',[b.id,cancellation.version,'No payment received; external follow-up complete.']));
  const rejected=await detail(db,b.id);assert.equal(rejected.booking.pending_change,null);assert.equal(rejected.changes[0].status,'Closed');assert.equal((await event(db,earlier.id)).reserved_places,0);
});

test('closing changes prevents submissions/approval but retains reservations and permits existing cancellation review',async t=>{
  const db=await setup(t),e=await createEvent(db),target=await createEvent(db),b=await accept(db,await request(db,e)),proposal=await change(db,b,target,5);
  const other=await accept(db,await request(db,target,2,ids.other)),cancellation=await change(db,other,null,null,randomUUID(),'Cancellation',ids.other);
  await asUser(db,ids.admin,()=>rpc(db,'corporate_configure_changes',[false]));
  await assert.rejects(review(db,proposal),/Amendment approvals/);await review(db,proposal,false);
  const current=(await detail(db,b.id)).booking;await assert.rejects(change(db,current,target,5),/not open yet/);assert.equal((await event(db,e.id)).reserved_places,7);
  assert.equal((await review(db,cancellation)).status,'Cancelled');
});

test('cancelled event and proposal decisions preserve actor, before/after records and private routine grants',async t=>{
  const db=await setup(t),e=await createEvent(db),b=await accept(db,await request(db,e));await cancel(db,e);
  const history=(await detail(db,b.id)).history.find(row=>row.action==='Corporate event cancelled');
  assert.equal(history.actor_user_id,ids.admin);assert.equal(history.before_values.booking.status,'Pending payment');assert.equal(history.after_values.status,'Cancelled');
  const internal=await db.query("select has_function_privilege('authenticated','corporate_private.lock_workflow()','execute') allowed");assert.equal(internal.rows[0].allowed,false);
  const publicDefiners=await db.query("select proname from pg_proc join pg_namespace n on n.oid=pronamespace where n.nspname='public' and proname like 'corporate_%' and prosecdef");assert.equal(publicDefiners.rows.length,0);
});
