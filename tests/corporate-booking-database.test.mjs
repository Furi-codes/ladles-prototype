/**
 * Checks corporate request, acceptance, payment and reservation rules.
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
  const db=await fixture(t,{bookings:true});await openRegistration(db);
  const company=await register(db),other=await register(db,ids.other,{...details,company_name:'Other Company'});
  for(const account of [company,other])await asUser(db,ids.admin,()=>rpc(db,'corporate_review_account',[account.id,'approve','Details verified.']));
  await asUser(db,ids.admin,()=>rpc(db,'corporate_configure_bookings',[true,'booking@example.invalid','+27 21 555 1234']));
  return {db,company,other};
}
const createEvent=(db,input=eventInput,key=randomUUID())=>asUser(db,ids.admin,()=>rpc(db,'corporate_save_event',[null,null,JSON.stringify(input),key,'Publish corporate opportunity.']));
const request=(db,event,size=7,user=ids.owner,key=randomUUID(),notes='Arrival information please.')=>asUser(db,user,()=>rpc(db,'corporate_request_booking',[event.id,event.version,size,notes,key]));
const accept=(db,b,due=deadline)=>asUser(db,ids.admin,()=>rpc(db,'corporate_booking_deadline',[b.id,b.version,due,'Payment details discussed externally.']));
const getEvent=async(db,id)=>(await db.query('select * from public.corporate_events where id=$1',[id])).rows[0];

test('second migration is additive, defaults closed, requires real contacts and protects settings',async t=>{
  const db=await fixture(t,{bookings:true});
  const settings=await asUser(db,ids.owner,()=>rpc(db,'corporate_booking_settings'));assert.equal(settings.booking_enabled,false);assert.equal(settings.booking_contact_email,'');
  await assert.rejects(asUser(db,ids.admin,()=>rpc(db,'corporate_configure_bookings',[true,'',''])),/approved booking email and phone/);
  await assert.rejects(asUser(db,ids.owner,()=>rpc(db,'corporate_configure_bookings',[true,'a@example.invalid','+27215551234'])),/Administrator/);
  assert.equal(await rpc(db,'book_event_slot',[1]),'legacy capacity implementation preserved');
  assert.equal((await db.query('select capacity from public.event_slots where id=1')).rows[0].capacity,6);
});

test('event creation retries are idempotent and enforce future, same-day time and group/capacity rules',async t=>{
  const {db}=await setup(t);const key=randomUUID(),e=await createEvent(db,eventInput,key);
  assert.equal((await createEvent(db,eventInput,key)).id,e.id);
  assert.equal(Date.parse(e.starts_at),Date.parse('2099-11-15T07:15:00Z'));assert.equal(e.remaining,10);
  await assert.rejects(createEvent(db,{...eventInput,title:'Different'},key),/Creation key/);
  for(const input of [{...eventInput,capacity:0},{...eventInput,max_group_size:11},{...eventInput,starts_at:'2099-11-15T09:15'},{...eventInput,ends_at:'2099-11-16T10:15:00+02:00'},{...eventInput,starts_at:'2020-11-15T09:15:00+02:00',ends_at:'2020-11-15T10:15:00+02:00'}])await assert.rejects(createEvent(db,input));
  await assert.rejects(asUser(db,ids.owner,()=>rpc(db,'corporate_save_event',[null,null,JSON.stringify(eventInput),randomUUID(),'Not admin'])),/Administrator/);
});

test('requests reserve nothing, preserve submitted snapshots and retry once even if the event later closes',async t=>{
  const {db,company}=await setup(t),e=await createEvent(db),key=randomUUID();
  const a=await request(db,e,7,ids.owner,key);await request(db,e,7,ids.other);
  assert.equal((await getEvent(db,e.id)).reserved_places,0);assert.equal(a.status,'Requested');
  await asUser(db,ids.owner,()=>rpc(db,'corporate_update_account',[company.id,JSON.stringify({...details,billing_address:'New billing address'})]));
  const again=await request(db,e,7,ids.owner,key);assert.equal(again.id,a.id);assert.equal(again.contact_snapshot.billing_address,details.billing_address);
  assert.equal((await db.query('select count(*)::int n from public.corporate_workflow_history where booking_id=$1',[a.id])).rows[0].n,1);
  await assert.rejects(request(db,e,8,ids.owner,key),/Request key/);
  await db.query('update public.corporate_events set is_published=false where id=$1',[e.id]);
  assert.equal((await request(db,e,7,ids.owner,key)).id,a.id);
  await assert.rejects(request(db,e),/unavailable/);
});

test('competing acceptances cannot overbook and a failed acceptance rolls back status, audit and notices',async t=>{
  const {db}=await setup(t),e=await createEvent(db),a=await request(db,e),b=await request(db,e,7,ids.other);
  const accepted=await accept(db,a);assert.equal(accepted.status,'Pending payment');assert.equal((await getEvent(db,e.id)).reserved_places,7);
  const noticeCount=(await db.query('select count(*)::int n from public.corporate_account_notifications')).rows[0].n;
  await assert.rejects(accept(db,b),/Insufficient corporate capacity/);
  assert.equal((await db.query('select status from public.corporate_reservations where id=$1',[b.id])).rows[0].status,'Requested');
  assert.equal((await db.query('select count(*)::int n from public.corporate_account_notifications')).rows[0].n,noticeCount);
  assert.equal((await getEvent(db,e.id)).reserved_places,7);
  await asUser(db,ids.admin,()=>rpc(db,'corporate_reject_booking',[accepted.id,accepted.version,'No payment received; follow-up complete.']));
  assert.equal((await getEvent(db,e.id)).reserved_places,0);await accept(db,b);assert.equal((await getEvent(db,e.id)).reserved_places,7);
});

test('deadline validation, overdue flags and extensions never auto-release accepted places',async t=>{
  const {db}=await setup(t),e=await createEvent(db),b=await request(db,e);
  for(const due of [eventInput.starts_at,'2099-11-16T09:00:00+02:00','2020-01-01T10:00:00+02:00'])await assert.rejects(accept(db,b,due),/strictly before/);
  const accepted=await accept(db,b);
  await db.query("update public.corporate_reservations set payment_due_at=now()-interval '1 hour' where id=$1",[b.id]); // stand in for elapsed wall-clock time
  const overdue=await asUser(db,ids.owner,()=>rpc(db,'corporate_search_bookings',['','Overdue',null,null,0,10]));
  assert.equal(overdue.total,1);assert.equal(overdue.rows[0].is_overdue,true);assert.equal((await getEvent(db,e.id)).reserved_places,7);
  await accept(db,accepted);assert.equal((await getEvent(db,e.id)).reserved_places,7);
  const refreshed=await asUser(db,ids.owner,()=>rpc(db,'corporate_booking_detail',[b.id]));assert.equal(refreshed.booking.is_overdue,false);
});

test('stale decisions cannot overwrite acceptance, deadlines, event settings or another payment confirmation',async t=>{
  const {db}=await setup(t),e=await createEvent(db),b=await request(db,e),accepted=await accept(db,b);
  await assert.rejects(accept(db,b),/Booking changed/);
  await assert.rejects(asUser(db,ids.admin2,()=>rpc(db,'corporate_reject_booking',[b.id,b.version,'Stale tab'])),/Booking changed/);
  const edited=await asUser(db,ids.admin,()=>rpc(db,'corporate_save_event',[e.id,e.version,JSON.stringify({...eventInput,title:'Updated'}),null,'Name corrected.']));
  await assert.rejects(asUser(db,ids.admin2,()=>rpc(db,'corporate_save_event',[e.id,e.version,JSON.stringify(eventInput),null,'Stale edit.'])),/Event changed/);
  assert.equal(edited.version,2);assert.equal(accepted.status,'Pending payment');
  await assert.rejects(request(db,e,1),/Event changed/);
  await assert.rejects(accept(db,accepted),/Booking changed/); // event edits also invalidate the earlier booking review
});

test('payment is recorded once, preserves capacity and paid history survives rejection',async t=>{
  const {db}=await setup(t),e=await createEvent(db),b=await accept(db,await request(db,e)),key=randomUUID();
  const received=new Date().toISOString().slice(0,10);
  for(const [reference,date] of [['','2026-01-01'],['REF','2199-01-01']])await assert.rejects(asUser(db,ids.admin,()=>rpc(db,'corporate_record_payment',[b.id,b.version,randomUUID(),reference,date,''])),/received date/);
  assert.equal((await db.query('select count(*)::int n from public.corporate_payment_records')).rows[0].n,0);
  const pay=()=>asUser(db,ids.admin,()=>rpc(db,'corporate_record_payment',[b.id,b.version,key,'EXTERNAL-REF',received,'Verified external receipt.']));
  const confirmed=await pay();assert.equal(confirmed.status,'Confirmed');assert.equal((await pay()).id,b.id);
  assert.equal((await db.query('select count(*)::int n from public.corporate_payment_records')).rows[0].n,1);assert.equal((await getEvent(db,e.id)).reserved_places,7);
  await assert.rejects(asUser(db,ids.admin,()=>rpc(db,'corporate_record_payment',[b.id,b.version,key,'OTHER',received,'Verified external receipt.'])),/Payment key/);
  await assert.rejects(asUser(db,ids.admin2,()=>rpc(db,'corporate_record_payment',[b.id,b.version,randomUUID(),'OTHER',received,''])),/Booking changed/);
  await asUser(db,ids.admin,()=>rpc(db,'corporate_reject_booking',[b.id,confirmed.version,'Booking rejected; external refund follow-up required.']));
  const detail=await asUser(db,ids.owner,()=>rpc(db,'corporate_booking_detail',[b.id]));
  assert.equal(detail.payments.length,1);assert.equal(detail.booking.status,'Rejected');assert.equal((await getEvent(db,e.id)).reserved_places,0);
});

test('editing events rechecks held groups/deadlines and publishes exact booking-targeted notices',async t=>{
  const {db}=await setup(t),e=await createEvent(db),b=await accept(db,await request(db,e));
  for(const input of [{...eventInput,capacity:6,max_group_size:6},{...eventInput,min_group_size:8},{...eventInput,starts_at:'2099-11-14T10:00:00+02:00',ends_at:'2099-11-14T11:00:00+02:00'}])await assert.rejects(asUser(db,ids.admin,()=>rpc(db,'corporate_save_event',[e.id,e.version,JSON.stringify(input),null,'Invalid edit.'])),/conflict/);
  await asUser(db,ids.admin,()=>rpc(db,'corporate_save_event',[e.id,e.version,JSON.stringify({...eventInput,location:'Changed venue'}),null,'Please arrive at the new venue.']));
  const notices=await asUser(db,ids.owner,()=>rpc(db,'corporate_workflow_notices'));assert.ok(notices.rows.some(n=>n.title==='Corporate event updated'&&n.booking_id===b.id));
  const accountNotices=await asUser(db,ids.owner,()=>rpc(db,'corporate_account_notices'));assert.equal(accountNotices.total,1); // account approval only, no misrouted booking notices
});

test('company isolation and grants protect bookings, payments, history, settings and exact notification targets',async t=>{
  const {db}=await setup(t),e=await createEvent(db),a=await request(db,e),b=await request(db,e,2,ids.other);
  const mine=await asUser(db,ids.owner,()=>rpc(db,'corporate_search_bookings'));assert.deepEqual(mine.rows.map(r=>r.id),[a.id]);
  assert.deepEqual((await asUser(db,ids.owner,()=>db.query('select id from public.corporate_reservations'))).rows.map(row=>row.id),[a.id]);
  assert.deepEqual((await asUser(db,ids.owner,()=>db.query('select distinct account_id from public.corporate_workflow_history'))).rows.map(row=>row.account_id),[a.account_id]);
  await assert.rejects(asUser(db,ids.owner,()=>rpc(db,'corporate_booking_detail',[b.id])),/not available/);
  await assert.rejects(asUser(db,ids.owner,()=>rpc(db,'corporate_booking_deadline',[a.id,a.version,deadline,'I approve myself'])),/Administrator/);
  await assert.rejects(asUser(db,ids.owner,()=>rpc(db,'corporate_record_payment',[a.id,a.version,randomUUID(),'REF','2026-01-01',''])),/Administrator/);
  const notices=await asUser(db,ids.other,()=>rpc(db,'corporate_workflow_notices'));
  await assert.rejects(asUser(db,ids.owner,()=>rpc(db,'corporate_read_account_notice',[notices.rows[0].id])),/not available/);
  for(const table of ['corporate_events','corporate_reservations','corporate_payment_records','corporate_workflow_history']){
    await assert.rejects(asUser(db,null,()=>db.exec('select * from public.'+table),'anon'),/permission denied/);
    await assert.rejects(asUser(db,ids.owner,()=>db.exec('delete from public.'+table)),/permission denied/);
  }
  await assert.rejects(asUser(db,ids.owner,()=>db.query("update public.corporate_reservations set status='Confirmed' where id=$1",[a.id])),/permission denied/);
  await assert.rejects(asUser(db,ids.owner,()=>db.query('select corporate_private.require_bookings_open()')),/permission denied/);
  await assert.rejects(asUser(db,ids.owner,()=>rpc(db,'corporate_search_bookings',['','',null,null,0,null])),/Invalid booking filters/);
});

test('unapproved/unverified accounts cannot request and deadlines cannot be extended after event start',async t=>{
  const {db}=await setup(t),e=await createEvent(db);
  await assert.rejects(register(db,ids.unverified),/Verify your login email/);
  await assert.rejects(request(db,e,1,ids.unverified),/Verify your email/);
  await db.query('update auth.users set email_confirmed_at=now() where id=$1',[ids.unverified]);
  await register(db,ids.unverified);
  await assert.rejects(request(db,e,1,ids.unverified),/approval first/);
  await db.query('update auth.users set email_confirmed_at=null where id=$1',[ids.owner]);
  await assert.rejects(request(db,e,1),/Verify your email/);
  await db.query('update auth.users set email_confirmed_at=now() where id=$1',[ids.owner]);
  const accepted=await accept(db,await request(db,e));
  // Simulate passage of time, not an application edit (started events cannot be edited through its RPC).
  await db.query("update public.corporate_events set starts_at='2020-11-15T09:15:00+02:00',ends_at='2020-11-15T10:15:00+02:00' where id=$1",[e.id]);
  await assert.rejects(accept(db,accepted),/strictly before/);
  assert.equal((await getEvent(db,e.id)).reserved_places,7);
});
