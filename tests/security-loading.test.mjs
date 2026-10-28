/**
 * Checks server-route authorization, complete loading, business-time boundaries and account
 * settings.
 * Dependencies are mocked or source/helpers are checked locally. These tests do not replace
 * testing the deployed UI and external services.
 */

import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import { NextRequest } from 'next/server.js';

const require = createRequire(import.meta.url), root = fileURLToPath(new URL('../', import.meta.url));
function modules(mocks = {}) {
  const cache = new Map();
  function load(file) {
    const full = resolve(root, file); if (cache.has(full)) return cache.get(full).exports;
    const compiledModule = { exports: {} }; cache.set(full, compiledModule);
    const code = ts.transpileModule(readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    function dependency(name) {
      if (name in mocks) return mocks[name];
      if (name === 'server-only') return {};
      if (name.startsWith('@/') || name.startsWith('.')) {
        const base = name.startsWith('@/') ? resolve(root, name.slice(2)) : resolve(dirname(full), name);
        for (const suffix of ['', '.ts', '.tsx']) if (existsSync(base + suffix)) return load(base + suffix);
      }
      return require(name);
    }
    vm.runInThisContext(`(function(require,module,exports){${code}\n})`)(dependency, compiledModule, compiledModule.exports);
    return compiledModule.exports;
  }
  return { load };
}

test('location API checks authenticated profile roles before any external request or cached response', async t => {
  const originalFetch = globalThis.fetch; t.after(() => { globalThis.fetch = originalFetch; });
  let allowed = false, calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json([{display_name:'Cape Town',lat:'-33.9',lon:'18.4'}]); };
  const { GET } = modules({'@/data/server/admin-auth':{requireAdminRequest:async()=>allowed?null:Response.json({error:'Unauthorized'},{status:401})}}).load('app/api/location-search/route.ts');
  const request = () => new NextRequest('https://example.invalid/api/location-search?q=Cape%20Town');
  assert.equal((await GET(request())).status,401);assert.equal(calls,0);
  allowed=true;const response=await GET(request());assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(calls,1);
  await GET(request());assert.equal(calls,1);
  allowed=false;assert.equal((await GET(request())).status,401);assert.equal(calls,1);
});

test('server admin check rejects missing tokens, forged metadata roles, failed lookups and invalid sessions', async t => {
  const originalUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,originalKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.invalid';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='public-test-key';
  t.after(()=>{if(originalUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=originalUrl;if(originalKey===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY=originalKey;});
  let clients=0,role='volunteer',failed=false,invalid=false;
  const check=modules({'@supabase/supabase-js':{createClient:(_url,_key,options)=>{
    clients++;assert.equal(options.auth.persistSession,false);assert.equal(options.global.headers.Authorization,'Bearer test-token');
    const query={select:()=>query,eq:(_key,id)=>{assert.equal(id,'person');return query;},maybeSingle:async()=>({data:{role},error:failed?new Error('Unavailable'):null})};
    return {auth:{getUser:async token=>{assert.equal(token,'test-token');return {data:{user:invalid?null:{id:'person',user_metadata:{role:'admin'}}},error:null};}},from:()=>query};
  }}}).load('data/server/admin-auth.ts').requireAdminRequest;
  assert.equal((await check(new Request('https://example.invalid'))).status,401);assert.equal(clients,0);
  const request=()=>new Request('https://example.invalid',{headers:{Authorization:'Bearer test-token'}});
  assert.equal((await check(request())).status,403);role='admin';assert.equal(await check(request()),null);
  failed=true;assert.equal((await check(request())).status,503);invalid=true;assert.equal((await check(request())).status,401);
});

test('volunteer loaders fetch every page with unique ordering and attach complete slot availability', async () => {
  const requests=[];
  const chain=table=>{
    const operations=[],q={};for(const method of ['select','order','range'])q[method]=(...args)=>{operations.push([method,...args]);return q;};
    q.then=(resolve,reject)=>{requests.push({table,operations});const from=operations.find(op=>op[0]==='range')[1];return Promise.resolve({data:[1,2,3,4,5].slice(from,from+2).map(id=>({id,booking_id:id})),count:5,error:null}).then(resolve,reject);};return q;
  };
  const actions=modules({'@/data/supabase/client':{supabase:{from:chain,rpc:(name,_args,options)=>{if(name==='get_slot_availability')return Promise.resolve({data:[1,2,3,4,5].map(id=>({event_slot_id:id,remaining:id})),error:null});assert.equal(options.count,'exact');return chain(name);}}}}).load('data/volunteer/volunteer.ts');
  for(const name of ['fetchEventsForVolunteer','fetchBookingsForVolunteer','fetchEventSlotsForVolunteer','fetchVolunteerAttendanceRecords'])assert.equal((await actions[name]()).data.length,5);
  assert.equal((await actions.fetchEventSlotsForVolunteer()).data[4].remaining,5);
  assert.ok(requests.every(({operations})=>operations.some(op=>op[0]==='order'&&['id','booking_id'].includes(op[1]))));
});

test('admin event date and time helpers use South African time across the UTC date boundary', () => {
  const date=modules().load('business/shared/dates/calendar.ts'),instant=new Date('2026-10-25T22:15:00Z');
  assert.equal(date.getLocalDateString(instant),'2026-10-26');assert.equal(date.getLocalTimeString(instant),'00:15');
});

test('admin settings load the complete administrator list without depending on unused organisation settings', async () => {
  const tables=[],offsets=[];
  const actions=modules({'@/data/supabase/client':{supabase:{from:table=>{
    tables.push(table);const q={select:(_columns,options)=>{assert.equal(options.count,'exact');return q;},eq:(column,value)=>{assert.equal(column,'role');assert.equal(value,'admin');return q;},order:()=>q,range:from=>{offsets.push(from);return Promise.resolve({data:[{id:1},{id:2},{id:3}].slice(from,from+2),count:3,error:null});}};return q;
  }}}}).load('data/admin/settings.ts');
  assert.equal((await actions.loadSettings()).admins.length,3);assert.deepEqual(offsets,[0,2]);assert.ok(tables.every(table=>table==='profiles'));
});
