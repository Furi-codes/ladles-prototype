import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { fixture, asUser, rpc, ids, details, openRegistration, register } from './helpers/corporate-database.mjs';

const migration=new URL('../supabase/migrations/20261025091621_corporate_attendance_followup.sql',import.meta.url);
async function setup(t) {
  const db=await fixture(t,{outcomes:true});
  for(const name of ['20261022203830_corporate_event_duration','20261023070518_corporate_exclusive_sessions','20261023073159_admin_corporate_polish']) await db.exec(readFileSync(new URL('../supabase/migrations/'+name+'.sql',import.meta.url),'utf8'));
  await openRegistration(db);const account=await register(db,ids.owner,details);
  await asUser(db,ids.admin,()=>rpc(db,'corporate_review_account',[account.id,'approve','Reviewed']));
  await asUser(db,ids.admin,()=>rpc(db,'corporate_configure_bookings',[true,'bookings@example.invalid','+27215551234']));
  await asUser(db,ids.admin,()=>rpc(db,'corporate_configure_changes',[true]));
  async function booking(status='Confirmed',past=true,blocked=false) {
    const e=await asUser(db,ids.admin,()=>rpc(db,'corporate_save_event',[null,null,JSON.stringify({title:'Attendance test '+randomUUID(),description:'Offline attendance test',location:'Test venue',starts_at:'2099-11-15T09:00:00+02:00',ends_at:'2099-11-15T11:00:00+02:00',capacity:30,min_group_size:1,max_group_size:30,is_published:true}),randomUUID(),'Created']));
    let b=await asUser(db,ids.owner,()=>rpc(db,'corporate_request_booking',[e.id,e.version,5,'',randomUUID()]));
    if(!['Requested','Rejected'].includes(status)) b=await asUser(db,ids.admin,()=>rpc(db,'corporate_booking_deadline',[b.id,b.version,'2099-11-14T17:00:00+02:00','Payment follow-up']));
    if(['Confirmed','Completed','Cancelled'].includes(status)) b=await asUser(db,ids.admin,()=>rpc(db,'corporate_record_payment',[b.id,b.version,randomUUID(),'Receipt','2026-10-25','Verified']));
    if(status==='Rejected') b=await asUser(db,ids.admin,()=>rpc(db,'corporate_reject_booking',[b.id,b.version,'Not approved']));
    if(blocked) await asUser(db,ids.owner,()=>rpc(db,'corporate_request_change',[b.id,b.version,'Cancellation',null,null,null,'Please cancel',randomUUID()]));
    if(past) await db.query("update public.corporate_events set starts_at='2020-11-15T09:00:00+02',ends_at='2020-11-15T11:00:00+02' where id=$1",[e.id]);
    if(status==='Completed') b=await asUser(db,ids.admin,()=>rpc(db,'corporate_record_event_attendance',[b.id,b.version,randomUUID(),5,2,'Attendance recorded']));
    if(status==='Cancelled') await db.query("update public.corporate_events set cancelled_at=now(),cancellation_reason='Cancelled' where id=$1",[e.id]);
    return b;
  }
  return {db,booking};
}

test('ended corporate sessions enter an admin-only queue and get one actionable reminder per session end',async t=>{
  const {db,booking}=await setup(t);
  const due=await booking(),blocked=await booking('Confirmed',true,true),moved=await booking();
  for(const [status,past] of [['Requested',true],['Pending payment',true],['Rejected',true],['Cancelled',true],['Completed',true],['Confirmed',false]]) await booking(status,past);
  await db.exec(readFileSync(migration,'utf8'));
  const queue=(user=ids.admin,query='')=>asUser(db,user,()=>rpc(db,'corporate_search_bookings',[query,'Attendance to record',null,null,0,100]));
  const inbox=(user=ids.admin)=>asUser(db,user,()=>rpc(db,'corporate_admin_notices',['',false,0,100]));
  const reminders=async user=>(await inbox(user)).rows.filter(n=>n.attendance_due);
  assert.deepEqual((await queue()).rows.map(b=>b.id).sort(),[due.id,blocked.id,moved.id].sort());
  assert.equal((await queue(ids.admin2)).total,3);
  await assert.rejects(queue(ids.owner),/Administrator/);
  await assert.rejects(asUser(db,ids.owner,()=>db.query('select corporate_private.enqueue_attendance_notices()')),/permission denied/);
  await assert.rejects(asUser(db,null,()=>rpc(db,'corporate_admin_notices'),'anon'),/permission denied/);
  assert.equal((await db.query('select corporate_private.enqueue_attendance_notices() n')).rows[0].n,0);
  assert.equal((await reminders(ids.admin)).length,3);
  assert.equal((await reminders(ids.admin)).find(n=>n.target_id===blocked.id).attendance_blocked,true);
  assert.equal((await reminders(ids.admin)).find(n=>n.target_id===due.id).attendance_blocked,false);
  const reminder=(await reminders(ids.admin)).find(n=>n.target_id===due.id);
  await asUser(db,ids.admin,()=>rpc(db,'corporate_read_account_notice',[reminder.id]));
  assert.equal((await reminders(ids.admin)).find(n=>n.id===reminder.id).is_read,true);
  assert.equal((await reminders(ids.admin2)).find(n=>n.id===reminder.id).is_read,false);
  assert.equal((await queue(ids.admin,due.id)).total,1);
  const ownerNotices=await asUser(db,ids.owner,()=>rpc(db,'corporate_workflow_notices',[0,100]));
  assert.ok(ownerNotices.rows.every(n=>n.title!=='Attendance to record'));
  // Recording, not elapsed time, completes the booking and resolves every admin's work item.
  assert.equal((await db.query('select status from public.corporate_reservations where id=$1',[due.id])).rows[0].status,'Confirmed');
  await asUser(db,ids.admin,()=>rpc(db,'corporate_record_event_attendance',[due.id,due.version,randomUUID(),4,2,'Four people attended']));
  assert.equal((await queue()).total,2);
  assert.equal((await reminders(ids.admin2)).some(n=>n.target_id===due.id),false);
  assert.equal((await db.query('select count(*)::int n from public.corporate_account_notifications where target_id=$1 and attendance_event_end is not null',[due.id])).rows[0].n,1,'Resolved history is retained');
  // A future reschedule hides an old reminder. Its new session can generate one new reminder later.
  await db.query("update public.corporate_events set starts_at='2099-11-15T09:00:00+02',ends_at='2099-11-15T11:00:00+02' where id=$1",[moved.event_id]);
  assert.equal((await queue()).total,1);assert.equal((await reminders(ids.admin)).some(n=>n.target_id===moved.id),false);
  await db.query("update public.corporate_events set starts_at='2020-11-16T09:00:00+02',ends_at='2020-11-16T11:00:00+02' where id=$1",[moved.event_id]);
  assert.equal((await db.query('select corporate_private.enqueue_attendance_notices() n')).rows[0].n,1);
  assert.equal((await db.query('select corporate_private.enqueue_attendance_notices() n')).rows[0].n,0);
  assert.equal((await reminders(ids.admin)).filter(n=>n.target_id===moved.id).length,1);
  const visible=await reminders(ids.admin);
  assert.ok(visible.every(n=>n.target_kind==='booking'&&!n.message.includes(n.target_id)));
  assert.match(readFileSync(migration,'utf8'),/cron\.schedule\('vms-corporate-attendance-followup','\*\/5 \* \* \* \*'/);
});
