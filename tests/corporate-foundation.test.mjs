import assert from 'node:assert/strict';
import {test} from 'node:test';
import {fixture,asUser,rpc,ids,details,openRegistration,register} from './helpers/corporate-database.mjs';

test('additive migration starts off and preserves existing volunteer/WMS/CSR behaviour',async t=>{
  const db=await fixture(t);
  const settings=await asUser(db,ids.owner,()=>rpc(db,'corporate_get_rollout_settings'));
  assert.equal(settings.registration_enabled,false);assert.equal(settings.volunteer_phone_required,false);
  const publicStatus=await asUser(db,null,()=>rpc(db,'corporate_registration_status'), 'anon');
  assert.deepEqual(publicStatus,{schema_version:1,registration_enabled:false});
  await assert.rejects(register(db),/registration is not open/);
  await assert.rejects(db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[ids.signup,'new@example.invalid',JSON.stringify({registration_kind:'corporate',corporate_details:details})]),/registration is not open/);
  assert.equal((await db.query('select count(*)::int n from auth.users where id=$1',[ids.signup])).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int n from public.profiles where id=$1',[ids.signup])).rows[0].n,0);
  await db.query('insert into public.bookings(user_id) values($1)',[ids.owner]); // old app can still book without a phone
  assert.equal((await db.query('select count(*)::int n from public.bookings')).rows[0].n,1);
  assert.equal(await rpc(db,'book_event_slot',[1]),'legacy capacity implementation preserved');
  assert.equal((await db.query('select capacity from public.event_slots where id=1')).rows[0].capacity,6);
  assert.equal((await db.query('select team_size from public.corporate_bookings where id=1')).rows[0].team_size,2);
});

test('registration retries are idempotent, keep volunteer identity and cannot choose approval or ownership',async t=>{
  const db=await fixture(t);await openRegistration(db);
  const a=await register(db,ids.owner,{...details,status:'Approved',owner_user_id:ids.other});
  const again=await register(db);assert.equal(a.id,again.id);assert.equal(a.status,'Awaiting approval');assert.equal(a.owner_user_id,ids.owner);
  assert.equal((await db.query('select count(*)::int n from public.corporate_account_history')).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from public.corporate_account_notifications')).rows[0].n,1);
  const p=(await db.query('select role,volunteer_enabled from public.profiles where id=$1',[ids.owner])).rows[0];
  assert.deepEqual(p,{role:'volunteer',volunteer_enabled:true});
  await assert.rejects(register(db,ids.owner,{...details,company_name:'Different company'}),/already has a business account/);
  await assert.rejects(register(db,ids.unverified),/Verify your login email/);
  await assert.rejects(register(db,ids.other,{...details,contact_phone:'.......'}),/valid contact email and phone/);
});

test('new corporate signup creates a pending account, not a volunteer registration or an admin',async t=>{
  const db=await fixture(t);await openRegistration(db);
  await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[ids.signup,'new@example.invalid',JSON.stringify({registration_kind:'corporate',corporate_details:{...details,status:'Approved'},phone:details.contact_phone,role:'admin'})]);
  const p=(await db.query('select role,phone,volunteer_enabled from public.profiles where id=$1',[ids.signup])).rows[0];
  assert.deepEqual(p,{role:'volunteer',phone:details.contact_phone,volunteer_enabled:false});
  const account=(await db.query('select * from public.corporate_accounts where owner_user_id=$1',[ids.signup])).rows[0];
  assert.equal(account.status,'Awaiting approval');
  await assert.rejects(asUser(db,ids.admin,()=>rpc(db,'corporate_review_account',[account.id,'approve','Checked details'])),/verify their login email/);
  await db.query('update auth.users set email_confirmed_at=now() where id=$1',[ids.signup]);
  const approved=await asUser(db,ids.admin,()=>rpc(db,'corporate_review_account',[account.id,'approve','Checked details']));assert.equal(approved.status,'Approved');
  await assert.rejects(db.query('insert into public.bookings(user_id) values($1)',[ids.signup]),/Open a volunteer profile/);
});

test('RLS and checked functions deny anonymous/cross-company reads, writes and self-approval',async t=>{
  const db=await fixture(t);await openRegistration(db);const a=await register(db);const other=await register(db,ids.other,{...details,company_name:'Another company'});
  const visible=await asUser(db,ids.owner,()=>db.query('select id from public.corporate_accounts'));assert.deepEqual(visible.rows.map(r=>r.id),[a.id]);
  const history=await asUser(db,ids.other,()=>db.query('select distinct account_id from public.corporate_account_history'));assert.deepEqual(history.rows.map(r=>r.account_id),[other.id]);
  await assert.rejects(asUser(db,ids.owner,()=>rpc(db,'corporate_account_detail',[other.id])),/not available/);
  await assert.rejects(asUser(db,ids.owner,()=>rpc(db,'corporate_update_account',[other.id,JSON.stringify(details)])),/not available/);
  await assert.rejects(asUser(db,ids.owner,()=>rpc(db,'corporate_review_account',[a.id,'approve','Approve myself'])),/Administrator access/);
  await assert.rejects(asUser(db,ids.owner,()=>db.query("update public.corporate_accounts set status='Approved' where id=$1",[a.id])),/permission denied/);
  await assert.rejects(asUser(db,ids.owner,()=>db.exec('delete from public.corporate_account_history')),/permission denied/);
  await assert.rejects(asUser(db,null,()=>rpc(db,'corporate_search_accounts'), 'anon'),/permission denied/);
  await assert.rejects(asUser(db,null,()=>rpc(db,'corporate_register_account',[JSON.stringify(details)])),/sign in/);
  await assert.rejects(asUser(db,ids.owner,()=>db.query('select corporate_private.create_account($1,$2)',[ids.other,JSON.stringify(details)])),/permission denied/);
  for(const table of ['corporate_accounts','corporate_account_history','corporate_account_notifications','corporate_account_notification_reads','corporate_rollout_settings'])await assert.rejects(asUser(db,null,()=>db.exec('select * from public.'+table),'anon'),/permission denied/);
  await assert.rejects(asUser(db,null,()=>db.exec('select updated_by from public.corporate_rollout_settings'),'anon'),/permission denied/);
});

test('approval/rejection/reconsideration is a guarded state machine with durable history and notices',async t=>{
  const db=await fixture(t);await openRegistration(db);const a=await register(db);
  await assert.rejects(asUser(db,ids.admin,()=>rpc(db,'corporate_review_account',[a.id,'reject',' '])),/Record a reason/);
  const reject=await asUser(db,ids.admin,()=>rpc(db,'corporate_review_account',[a.id,'reject','More information needed']));assert.equal(reject.status,'Rejected');
  await assert.rejects(asUser(db,ids.admin,()=>rpc(db,'corporate_review_account',[a.id,'approve','Skip reconsideration'])),/status has changed/);
  const reopened=await asUser(db,ids.admin,()=>rpc(db,'corporate_review_account',[a.id,'reconsider','Contact supplied the missing details']));assert.equal(reopened.id,a.id);assert.equal(reopened.status,'Awaiting approval');
  await asUser(db,ids.admin,()=>rpc(db,'corporate_review_account',[a.id,'approve','Verified company details']));
  await assert.rejects(asUser(db,ids.admin2,()=>rpc(db,'corporate_review_account',[a.id,'reject','Stale review screen'])),/status has changed/);
  await asUser(db,ids.owner,()=>rpc(db,'corporate_update_account',[a.id,JSON.stringify({...details,billing_address:'Updated billing address'})]));
  const detail=await asUser(db,ids.owner,()=>rpc(db,'corporate_account_detail',[a.id]));
  assert.equal(detail.account.status,'Approved');assert.equal(detail.email_verified,true);assert.equal(detail.history.length,5);
  assert.ok(detail.history.some(h=>h.before_values?.billing_address===details.billing_address&&h.after_values.billing_address==='Updated billing address'));
  const notice=await asUser(db,ids.owner,()=>rpc(db,'corporate_account_notices'));assert.equal(notice.total,3);
  assert.equal((await db.query('select count(*)::int n from public.corporate_accounts')).rows[0].n,1);
});

test('notification receipts are per person and cannot mark another audience/company notice',async t=>{
  const db=await fixture(t);await openRegistration(db);const a=await register(db);
  const inbox=await asUser(db,ids.admin,()=>rpc(db,'corporate_account_notices'));assert.equal(inbox.rows.length,1);
  const id=inbox.rows[0].id;await asUser(db,ids.admin,()=>rpc(db,'corporate_read_account_notice',[id]));
  assert.equal((await asUser(db,ids.admin,()=>rpc(db,'corporate_account_notices'))).rows[0].is_read,true);
  assert.equal((await asUser(db,ids.admin2,()=>rpc(db,'corporate_account_notices'))).rows[0].is_read,false);
  await assert.rejects(asUser(db,ids.owner,()=>rpc(db,'corporate_read_account_notice',[id])),/not available/);
  await asUser(db,ids.admin,()=>rpc(db,'corporate_review_account',[a.id,'approve','Verified']));
  const own=await asUser(db,ids.owner,()=>rpc(db,'corporate_account_notices'));
  await assert.rejects(asUser(db,ids.other,()=>rpc(db,'corporate_read_account_notice',[own.rows[0].id])),/not available/);
});

test('phone gate applies only to new bookings and directory includes zero-booking volunteers, not corporate-only users',async t=>{
  const db=await fixture(t);await openRegistration(db);await register(db);
  await db.query('insert into public.bookings(user_id) values($1)',[ids.owner]);
  await asUser(db,ids.admin,()=>rpc(db,'corporate_set_rollout_settings',[true,true]));
  await assert.rejects(db.query('insert into public.bookings(user_id) values($1)',[ids.owner]),/Add your cellphone/);
  await db.query('delete from public.bookings where user_id=$1',[ids.owner]); // cancellation remains available
  await asUser(db,ids.owner,()=>db.query('update public.profiles set phone=$1 where id=$2',[details.contact_phone,ids.owner]));
  await db.query('insert into public.bookings(user_id) values($1)',[ids.owner]);
  const directory=await asUser(db,ids.admin,()=>rpc(db,'corporate_volunteer_directory',['','',0,1]));
  assert.equal(directory.total,3);assert.equal(directory.rows.length,1);
  const missing=await asUser(db,ids.admin,()=>rpc(db,'corporate_volunteer_directory',['other@example.invalid','missing',0,10]));
  assert.equal(missing.total,1);assert.equal(missing.rows[0].booking_count,0);
  await assert.rejects(asUser(db,ids.owner,()=>rpc(db,'corporate_volunteer_directory')),/Administrator access/);
  await assert.rejects(asUser(db,ids.owner,()=>rpc(db,'corporate_set_rollout_settings',[false,false])),/Administrator access/);
  await assert.rejects(asUser(db,ids.admin,()=>rpc(db,'corporate_volunteer_directory',['','',0,null])),/Invalid directory search/);
  await assert.rejects(asUser(db,ids.admin,()=>rpc(db,'corporate_search_accounts',['','',0,null])),/Invalid search parameters/);
});
