import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fixture, asUser, rpc, ids, details, openRegistration } from './helpers/corporate-database.mjs';

const migration = new URL('../supabase/migrations/20261023155702_portal_contacts.sql', import.meta.url);
const email = { kind:'email',label:'Bookings',value:'bookings@example.invalid',is_primary:true };
const phone = { kind:'phone',label:'Bookings',value:'+27 21 555 1234',is_primary:true };
const extra = { kind:'phone',label:'Payment enquiries',value:'+27 21 555 5678',is_primary:false };

test('portal contacts migrate existing details, enforce access, validate lists and preserve compatibility atomically', async t => {
  const db = await fixture(t, { separation:true }); await openRegistration(db);
  await asUser(db,ids.admin,()=>rpc(db,'corporate_configure_bookings',[true,email.value,phone.value]));
  await db.exec(readFileSync(migration,'utf8'));
  const read = (portal,user=ids.admin) => asUser(db,user,()=>rpc(db,'get_portal_contacts',[portal]));
  const save = (portal,version,contacts,user=ids.admin) => asUser(db,user,()=>rpc(db,'save_portal_contacts',[portal,version,JSON.stringify(contacts)]));
  assert.deepEqual((await read('corporate')).contacts.map(c=>c.value).sort(),[email.value,phone.value].sort());
  assert.deepEqual((await read('volunteer')).contacts,[]);
  await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)',[ids.signup,'business@example.invalid',JSON.stringify({registration_kind:'corporate',corporate_details:details})]);
  assert.equal((await read('corporate',ids.signup)).contacts.length,2);
  assert.deepEqual((await read('volunteer',ids.owner)).contacts,[]);
  await assert.rejects(read('volunteer',ids.signup),/cannot access/);
  await assert.rejects(read('corporate',ids.owner),/cannot access/);
  await assert.rejects(read('corporate',null),/sign|auth|required/i);
  await assert.rejects(asUser(db,null,()=>rpc(db,'get_portal_contacts',['corporate']),'anon'),/permission denied/);
  await assert.rejects(save('corporate',1,[email,phone],ids.signup),/Administrator/);
  await assert.rejects(asUser(db,ids.owner,()=>db.query("update public.portal_contact_settings set contacts='[]'")),/permission denied/);
  assert.equal((await asUser(db,ids.owner,()=>db.query('select * from public.portal_contact_settings'))).rows.length,0);
  const updated = await save('corporate',1,[email,phone,extra]); assert.equal(updated.version,2);
  await assert.rejects(save('corporate',1,[email,phone]),/contacts changed/);
  assert.equal((await read('corporate')).contacts.length,3);
  await assert.rejects(save('corporate',2,[]),/requests are open/);
  for (const invalid of [
    [{...email,is_primary:false},phone], [email,{...email,label:'Other'},phone], [{...phone,value:'bad'}],
    [{...email,value:'invalid'}], [{...phone,value:'123'}], [{...phone,is_primary:'true'}], Array(13).fill(email),
  ]) await assert.rejects(save('volunteer',1,invalid),/primary|duplicate|valid|Complete|12/);
  const volunteer=await save('volunteer',1,[{...email,label:'Volunteer support',value:'volunteers@example.invalid'}]);
  assert.equal(volunteer.version,2); assert.equal((await read('corporate')).version,2);
  assert.equal((await read('volunteer',ids.owner)).contacts[0].value,'volunteers@example.invalid');
  const newEmail={...email,value:'new@example.invalid'};
  await save('corporate',2,[newEmail,phone,extra]);
  assert.equal((await asUser(db,ids.admin,()=>rpc(db,'corporate_booking_settings'))).booking_contact_email,newEmail.value);
  await asUser(db,ids.admin,()=>rpc(db,'set_corporate_booking_availability',[false]));
  const before=(await read('corporate')).version;
  await save('corporate',before,[]);
  await assert.rejects(asUser(db,ids.admin,()=>rpc(db,'set_corporate_booking_availability',[true])),/Portal contacts/);
  // A previous app version still updates the same list, including its version.
  await asUser(db,ids.admin,()=>rpc(db,'corporate_configure_bookings',[true,email.value,phone.value]));
  assert.equal((await read('corporate')).contacts.length,2);
  await save('corporate',(await read('corporate')).version,[email,phone,extra]);
  await asUser(db,ids.admin,()=>rpc(db,'corporate_configure_bookings',[true,'legacy@example.invalid',phone.value]));
  assert.equal((await read('corporate')).contacts.length,3);
  assert.ok((await read('corporate')).contacts.some(c=>c.value===extra.value));
  const history=(await db.query("select actor_user_id,after_values from public.corporate_workflow_history where action='Portal contacts updated'")).rows;
  assert.ok(history.length>=4); assert.ok(history.every(row=>row.actor_user_id===ids.admin));
  for(const name of ['get_portal_contacts','save_portal_contacts','set_corporate_booking_availability']) {
    assert.equal((await db.query('select prosecdef from pg_proc where oid=$1::regproc',['public.'+name])).rows[0].prosecdef,false);
  }
});
