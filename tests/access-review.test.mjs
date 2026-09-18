import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const sql = readFileSync(new URL('../supabase/migrations/20260918130248_admin_access_fixed_identity_review.sql', import.meta.url),'utf8');
const body = name => sql.match(new RegExp(`create function public\\.${name}\\([\\s\\S]*?\\$\\$;`, 'i'))?.[0];
// These are SQL contract checks, not executed PostgreSQL/RLS tests.
test('role RPC source rejects unauthenticated/non-admin callers, invalid targets and roles, self and final revocation', () => {
  const rpc = body('set_profile_admin_access');
  for (const fragment of ['v_caller is null', 'if not public.is_admin()', "p_role is null or p_role not in ('admin', 'volunteer')", 'if not found', "p_target_id = v_caller and p_role = 'volunteer'", "where role = 'admin') <= 1", 'update public.profiles set role = p_role where id = p_target_id']) assert.ok(rpc.includes(fragment),fragment);
  assert.equal((rpc.match(/if not public.is_admin\(\)/g) ?? []).length,2);
  assert.ok(rpc.indexOf('lock table') < rpc.lastIndexOf('if not public.is_admin()'));
  assert.ok(rpc.includes('share row exclusive mode'));
  assert.ok(rpc.includes("using errcode = '25000'"));
});
test('direct role-update bypass is closed; existing profile policies and is_admin are not replaced', () => {
  assert.ok(body('guard_profile_role_changes').includes('security invoker'));
  assert.ok(body('guard_profile_role_changes').includes("new.role is distinct from old.role and current_user <> 'postgres'"));
  assert.doesNotMatch(sql,/create (or replace )?function public\.is_admin|(?:create|alter|drop) policy|disable row level security|drop (table|function|trigger)/i);
  assert.match(sql,/before update on public\.profiles/);
});
test('only intended RPCs have authenticated execution; functions have safe search paths', () => {
  for (const [name,args] of [['guard_profile_role_changes',''],['set_profile_admin_access','uuid,text'],['search_admin_access_profiles','text'],['guard_organisation_identity','']]) {
    assert.ok(body(name).includes("set search_path = ''"));
    assert.ok(sql.includes(`revoke all on function public.${name}(${args}) from public, anon, authenticated;`));
  }
  const granted = [...sql.matchAll(/grant execute on function public\.([a-z_]+)/g)].map(m=>m[1]).sort();
  assert.deepEqual(granted,['search_admin_access_profiles','set_profile_admin_access']);
});
test('profile search is admin-only, literal, bounded and returns no results for blank search', () => {
  const rpc = body('search_admin_access_profiles');
  for (const fragment of ['auth.uid() is null or not public.is_admin()', 'length(v_query) < 2 then return', 'limit 10', 'pg_catalog.strpos']) assert.ok(rpc.includes(fragment));
});
test('organisation identity guard enforces exact name on all settings writes', () => {
  assert.ok(body('guard_organisation_identity').includes("new.organisation_name is distinct from 'Ladles of Love'"));
  assert.match(sql,/before insert or update on public.organisation_settings/);
  assert.doesNotMatch(sql,/drop column|truncate/i);
});
async function mockedActions(path, client) {
  const source = readFileSync(new URL(path, import.meta.url),'utf8');
  const key = '__access_' + Math.random().toString(36).slice(2);
  globalThis[key] = client;
  const js = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/import \{ supabase \} from ['"]@\/lib\/supabase['"];?/,`const supabase = globalThis[${JSON.stringify(key)}];`);
  try { return await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`); } finally { delete globalThis[key]; }
}
test('access actions use RPC only and explain the new unapplied migration', async () => {
  const calls = [];
  const actions = await mockedActions('../lib/actions/access.ts',{rpc:async (...args)=>{calls.push(args);return {error:null,data:[]};}});
  await actions.changeAdminAccess('target','admin');
  await actions.changeAdminAccess('target','volunteer');
  await actions.searchAccessProfiles('  Alice ');
  assert.deepEqual(calls,[['set_profile_admin_access',{p_target_id:'target',p_role:'admin'}],['set_profile_admin_access',{p_target_id:'target',p_role:'volunteer'}],['search_admin_access_profiles',{p_query:'Alice'}]]);
  const missing = await mockedActions('../lib/actions/access.ts',{rpc:async()=>({error:{code:'PGRST202',message:'missing'}})});
  await assert.rejects(()=>missing.searchAccessProfiles(''),/new admin access \/ fixed identity migration/);
});
test('saving allowed settings never forwards organisation_name even if injected at runtime', async () => {
  let payload;
  const actions = await mockedActions('../lib/actions/corporate.ts',{from:()=>({update:data=>{payload=data;return {eq:()=>({select:()=>({single:async()=>({error:null})})})};}})});
  await actions.saveSettings({organisation_name:'Changed',default_location:'Cape Town',contact_email:'contact@example.test',timezone:'Africa/Johannesburg',booking_confirmation_enabled:true,booking_cancellation_enabled:false,shift_reminder_enabled:true,corporate_booking_confirmation_enabled:false});
  assert.equal('organisation_name' in payload,false);
  assert.equal(payload.default_location,'Cape Town');
  assert.equal(payload.booking_confirmation_enabled,true);
  assert.equal(Object.keys(payload).length,7);
});
