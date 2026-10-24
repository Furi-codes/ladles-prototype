import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { fixture, asUser, rpc, ids, details, openRegistration } from './helpers/corporate-database.mjs';

test('mark all covers every page/type while preserving other admins, other companies and notice history', async t => {
  const db=await fixture(t,{separation:true});
  const bulkMigration=readdirSync(new URL('../supabase/migrations/',import.meta.url)).find(name=>name.endsWith('_mark_all_notifications_read.sql'));
  assert.ok(bulkMigration);
  for(const name of ['20261022203830_corporate_event_duration.sql','20261023070518_corporate_exclusive_sessions.sql','20261023073159_admin_corporate_polish.sql',bulkMigration]) await db.exec(readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  await openRegistration(db);
  const first=ids.signup, second=randomUUID(), companies=[];
  for(const user of [first,second]) {
    await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)',[user,user+'@example.invalid',JSON.stringify({registration_kind:'corporate',corporate_details:details})]);
    companies.push((await db.query('select id from public.corporate_accounts where owner_user_id=$1',[user])).rows[0].id);
  }
  for(const company of companies) for(const audience of ['admin','corporate']) {
    await db.query("insert into public.corporate_account_notifications(account_id,audience,title,message,target_kind) select $1,$2,'Test notice','Retained history',case when n%2=0 then 'account' else 'booking' end from generate_series(1,25) n",[company,audience]);
  }
  const mark=user=>asUser(db,user,()=>rpc(db,'corporate_read_all_notices'));
  const unread=async user=>Number((await db.query("select count(*)::int n from public.corporate_account_notifications n where ((n.audience='admin' and $1::uuid in ($2,$3)) or (n.audience='corporate' and exists(select 1 from public.corporate_accounts a where a.id=n.account_id and a.owner_user_id=$1))) and not exists(select 1 from public.corporate_account_notification_reads r where r.notification_id=n.id and r.user_id=$1)",[user,ids.admin,ids.admin2])).rows[0].n);
  const total=(await db.query('select count(*)::int n from public.corporate_account_notifications')).rows[0].n;
  const adminUnread=await unread(ids.admin), companyUnread=await unread(first), otherUnread=await unread(second);
  assert.ok(adminUnread>25);assert.equal(companyUnread,25);
  assert.equal(await mark(ids.admin),adminUnread);assert.equal(await unread(ids.admin),0);
  assert.equal(await unread(ids.admin2),adminUnread);assert.equal(await unread(first),companyUnread);
  assert.equal(await mark(ids.admin),0);
  assert.equal(await mark(first),companyUnread);assert.equal(await unread(first),0);assert.equal(await unread(second),otherUnread);
  assert.equal((await db.query('select count(*)::int n from public.corporate_account_notifications')).rows[0].n,total);
  assert.equal(await mark(ids.owner),0); // no company membership; cannot clear admin/company updates
  await assert.rejects(asUser(db,null,()=>rpc(db,'corporate_read_all_notices'),'anon'),/permission denied/);
  await assert.rejects(asUser(db,first,()=>db.query('insert into public.corporate_account_notification_reads(notification_id,user_id) select id,$1 from public.corporate_account_notifications limit 1',[second])),/permission denied/);
  // Arrivals after the bulk statement remain unread, rather than being hidden by a stored 'read all' flag.
  await db.query("insert into public.corporate_account_notifications(account_id,audience,title,message) values($1,'corporate','New arrival','Keep unread until another action')",[companies[0]]);
  assert.equal(await unread(first),1);assert.equal(await mark(first),1);assert.equal(await unread(first),0);
  assert.equal(await unread(second),otherUnread);
  const permissions=(await db.query("select prosecdef,proconfig from pg_proc where oid='public.corporate_read_all_notices()'::regprocedure")).rows[0];
  assert.equal(permissions.prosecdef,false);assert.ok(permissions.proconfig.includes('search_path=""'));
});
