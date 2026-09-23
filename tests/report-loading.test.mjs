import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
async function mockedLoader(respond) {
  const requests = [];
  const key = '__report_' + Math.random().toString(36).slice(2);
  globalThis[key] = {from(table) {
    const request = {table,operations:[]};
    const chain = {};
    for (const method of ['select','order','limit','ilike','lte','gte','eq','in','range']) chain[method] = (...args) => {request.operations.push([method,...args]);return chain;};
    chain.then = (resolve,reject) => { requests.push(request); return Promise.resolve(respond(request)).then(resolve,reject); };
    return chain;
  }};
  const source = readFileSync(new URL('../lib/actions/corporate.ts',import.meta.url),'utf8');
  const js = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/import \{ supabase \} from ['"]@\/lib\/supabase['"];?/,`const supabase = globalThis[${JSON.stringify(key)}];`);
  try { return {actions:await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`),requests}; } finally { delete globalThis[key]; }
}
test('event options are bounded/recent by default; title search has no date restriction and escapes literal wildcards', async () => {
  const {actions,requests} = await mockedLoader(()=>({data:[{id:7,title:'Old kitchen',date:'2020-01-01'}],error:null}));
  await actions.searchReportEvents('');
  const results = await actions.searchReportEvents('Old');
  await actions.searchReportEvents('50%_');
  assert.ok(requests[0].operations.some(op=>op[0]==='lte' && op[1]==='date'));
  assert.ok(requests.every(r=>r.operations.some(op=>op[0]==='limit' && op[1]===8)));
  assert.ok(!requests[1].operations.some(op=>op[0]==='lte'));
  assert.deepEqual(requests[1].operations.find(op=>op[0]==='ilike'),['ilike','title','%Old%']);
  assert.deepEqual(requests[2].operations.find(op=>op[0]==='ilike'),['ilike','title','%50\\%\\_%']);
  assert.deepEqual(results,[{value:'7',label:'Old kitchen · 2020-01-01'}]);
});
test('location search is bounded, deduplicated and uses substring matching across history', async () => {
  const {actions,requests} = await mockedLoader(()=>({data:[{location:'Cape Town'},{location:'Cape Town'},{location:'Cape Point'}],error:null}));
  assert.deepEqual(await actions.searchReportLocations('Cape'),[{value:'Cape Point',label:'Cape Point'},{value:'Cape Town',label:'Cape Town'}]);
  assert.ok(requests[0].operations.some(op=>op[0]==='limit' && op[1]===50));
  assert.deepEqual(requests[0].operations.find(op=>op[0]==='ilike'),['ilike','location','%Cape%']);
});
test('reports query selected events and only their related rows; empty/invalid ranges do not load unrelated activity', async () => {
  const {actions,requests} = await mockedLoader(({table})=>({data:table==='events' ? [{id:9}] : table==='bookings' ? [{id:99}] : [],error:null,count:table==='events'||table==='bookings'?1:0}));
  const filter = {from:'2026-09-01',to:'2026-09-18',event:'9',location:'Cape Town'};
  await actions.loadReportData(filter);
  assert.deepEqual(requests.find(r=>r.table==='events').operations.filter(op=>['gte','lte','eq'].includes(op[0])),[['gte','date',filter.from],['lte','date',filter.to],['eq','id','9'],['eq','location','Cape Town']]);
  for (const table of ['event_slots','bookings','corporate_bookings']) assert.deepEqual(requests.find(r=>r.table===table).operations.find(op=>op[0]==='in'),['in','event_id',[9]]);
  assert.deepEqual(requests.find(r=>r.table==='attendance_records').operations.find(op=>op[0]==='in'),['in','booking_id',[99]]);
  const count = requests.length;
  await actions.loadReportData({...filter,from:'2026-10-01'});
  await actions.reportRelatedRows('bookings','event_id',[]);
  assert.equal(requests.length,count);
});
test('related activity pagination follows server counts even with reduced API page limits', async () => {
  const {actions,requests} = await mockedLoader(r=>{const offset=r.operations.find(op=>op[0]==='range')[1];return {data:[{id:offset+1}],count:3,error:null};});
  assert.deepEqual(await actions.reportRelatedRows('bookings','event_id',[1]),[{id:1},{id:2},{id:3}]);
  assert.deepEqual(requests.map(r=>r.operations.find(op=>op[0]==='range')[1]),[0,1,2]);
});
