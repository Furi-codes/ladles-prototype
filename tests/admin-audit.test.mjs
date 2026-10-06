import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Execute application functions with an injected client. No network or database.
async function load(path, client) {
  const key = '__audit_' + Math.random().toString(36).slice(2);
  globalThis[key] = client;
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
    .replace(/import \{ supabase \} from ['"]@\/lib\/supabase['"];?/, `const supabase = globalThis[${JSON.stringify(key)}];`);
  try { return await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`); }
  finally { delete globalThis[key]; }
}
const reporting = await load('../lib/reporting.ts');
const all = {from:'',to:'',event:'',location:''};
const fixture = {
  events:[{id:1,title:' =HYPERLINK("bad")',date:'2026-01-31',location:'Cape Town',status:'Scheduled'},
    {id:2,title:'Future',date:'2026-03-01',location:'Johannesburg',status:'Scheduled'},
    {id:3,title:'Cancelled',date:'2026-02-10',location:'Cape Town',status:'Cancelled'}],
  slots:[], companies:[{id:1,name:'Company'}],
  bookings:[{id:1,event_id:1,user_id:'v1',status:'Completed'},{id:2,event_id:1,user_id:'v2',status:'No show'}],
  attendance:[{booking_id:1,clocked_in_at:'in',clocked_out_at:'out',worked_minutes:90}],
  corporate:[{id:1,company_id:1,event_id:1,team_size:4,status:'Completed',attendance_count:3,volunteer_hours:6},
    {id:2,company_id:1,event_id:2,team_size:2,status:'Pending',attendance_count:null,volunteer_hours:null},
    {id:3,company_id:1,event_id:3,team_size:9,status:'Cancelled',attendance_count:null,volunteer_hours:null}],
};

test('current five date options produce explicit rolling ranges across a year boundary', () => {
  const expected = [['2025-12-03','2026-01-01'],['2025-10-01','2026-01-01'],['2025-07-01','2026-01-01'],['2025-01-01','2026-01-01'],['2026-01-01','2026-01-01']];
  assert.equal(reporting.dateRanges.length,5);
  reporting.dateRanges.forEach((range,i) => {
    const result = reporting.dateRangeFilter(range,new Date('2025-12-31T22:30:00Z'));
    assert.deepEqual([result.from,result.to],expected[i]);
  });
});
test('open date bounds and intersecting event/location filters reconcile every report output', () => {
  const r = reporting.reportAnalytics(fixture,{...all,to:'2026-01-31',location:'Cape Town',event:'1'});
  assert.equal(r.hours,7.5); assert.equal(r.activeVolunteers,1); assert.equal(r.completedEvents,1);
  assert.equal(r.attendanceRate,4/6*100);
  assert.deepEqual(r.monthly,[{month:'2026-01',hours:7.5,booked:6,attended:4}]);
  assert.equal(r.statuses.reduce((n,s)=>n+s.count,0),1);
  assert.deepEqual(reporting.reportAnalytics(fixture,{...all,event:'1',location:'Johannesburg'}).rows,[]);
  assert.equal(reporting.reportAnalytics(fixture,{...all,from:'2026-03-01'}).hours,0);
});
test('future reservations lower attendance rate but never create completed participation', () => {
  const r = reporting.reportAnalytics(fixture,all);
  assert.equal(r.hours,7.5); assert.equal(r.attendanceRate,50); assert.equal(r.completedEvents,1);
  assert.deepEqual(r.monthly.map(m=>m.month),['2026-01','2026-02','2026-03']);
  assert.deepEqual(r.monthly[1],{month:'2026-02',hours:0,booked:0,attended:0});
});
test('cancelled-only and unknown-company reports retain correct status visibility without totals', () => {
  const cancelled = reporting.reportAnalytics(fixture,{...all,event:'3'});
  assert.equal(cancelled.hours,0); assert.equal(cancelled.attendanceRate,null);
  assert.equal(cancelled.completedEvents,0); assert.equal(cancelled.activeVolunteers,0);
  assert.deepEqual(cancelled.rows,[]); assert.equal(cancelled.statuses[3].count,1);
  const absent = reporting.reportAnalytics(fixture,all,true,'999');
  assert.equal(absent.activeVolunteers,null); assert.equal(absent.hours,0);
  assert.ok(absent.statuses.every(s=>s.count===0)); assert.equal(reporting.reportCsv(absent.rows),null);
});
test('missing recorded minutes do not imply completed hours or completed individual events', () => {
  const data = {...fixture,corporate:[],attendance:[{booking_id:1,clocked_in_at:'in',clocked_out_at:'out',worked_minutes:null}]};
  const r = reporting.reportAnalytics(data,all);
  assert.equal(r.hours,0); assert.equal(r.completedEvents,0); assert.equal(r.activeVolunteers,1);
});
test('CSV exports the exact selected report rows, escapes formulas and preserves numeric precision', () => {
  const r = reporting.reportAnalytics(fixture,{...all,event:'1'},true,'1');
  const csv = reporting.reportCsv(r.rows);
  assert.equal(csv.split('\r\n').length,2);
  assert.equal(csv.split('\r\n')[1], '"\' =HYPERLINK(""bad"")","2026-01-31","0","0","0","4","4","3","75.00","0.00","6.00","1","0"');
  assert.ok(csv.startsWith('\uFEFF')); assert.ok(!csv.includes('Future'));
  for (const value of ['=1','+1','-1','@SUM(A1)','\t=1','\r+1','\n-1']) assert.ok(reporting.csvCell(value).startsWith('"\''));
  assert.equal(reporting.csvCell(null),'""'); assert.equal(reporting.csvCell('Café'),'"Café"');
});
test('corporate action maps every field to its authoritative RPC and never writes tables directly', async () => {
  const calls=[]; const input={company_id:2,event_slot_id:4,team_size:6,status:'Completed',contact_name:'Name',contact_email:'fixture@example.test',notes:'note',attendance_count:5,volunteer_hours:7.5,event_id:999};
  const actions=await load('../lib/actions/corporate.ts',{rpc:(...args)=>{calls.push(args);return {single:async()=>({data:{id:8,...input},error:null})};},from:()=>{throw new Error('Direct write forbidden');}});
  for (const id of [null,8]) assert.equal((await actions.saveCorporateBooking(id,input)).id,8);
  assert.deepEqual(calls[1],['save_corporate_booking',{p_id:8,p_company_id:2,p_event_slot_id:4,p_team_size:6,p_status:'Completed',p_contact_name:'Name',p_contact_email:'fixture@example.test',p_notes:'note',p_attendance_count:5,p_volunteer_hours:7.5}]);
  assert.equal(calls[0][1].p_id,null);
});
test('corporate validation failures from the server are surfaced, not converted into success', async () => {
  for (const message of ['Team size must be a positive integer.','The team exceeds the remaining capacity of this time slot.','Attendance can only be completed for an ended, non-cancelled shift.']) {
    const actions=await load('../lib/actions/corporate.ts',{rpc:()=>({single:async()=>({data:null,error:{message}})})});
    await assert.rejects(()=>actions.saveCorporateBooking(null,{}),{message});
  }
});
test('availability distinguishes missing RPC compatibility from real query failures', async () => {
  const missing=await load('../lib/actions/corporate.ts',{rpc:async()=>({error:{code:'PGRST202',message:'missing'}})});
  assert.equal(await missing.fetchSlotAvailability(),null);
  const denied=await load('../lib/actions/corporate.ts',{rpc:async()=>({error:{code:'42501',message:'denied'}})});
  await assert.rejects(()=>denied.fetchSlotAvailability(),/denied/);
  const ready=await load('../lib/actions/corporate.ts',{rpc:async()=>({error:null,data:[{event_slot_id:4,remaining:2}]})});
  assert.deepEqual(await ready.fetchSlotAvailability(),[{event_slot_id:4,remaining:2}]);
});
test('administrator RPC permission and missing-migration failures reach the caller', async () => {
  for (const code of ['PGRST202','42883']) {
    const actions=await load('../lib/actions/access.ts',{rpc:async()=>({error:{code,message:'missing'}})});
    await assert.rejects(()=>actions.changeAdminAccess('fixture','admin'),/DBA must review/);
  }
  const denied=await load('../lib/actions/access.ts',{rpc:async()=>({error:{code:'42501',message:'Only administrators can manage access.'}})});
  await assert.rejects(()=>denied.changeAdminAccess('fixture','volunteer'),/Only administrators/);
  await assert.rejects(()=>denied.searchAccessProfiles('someone'),/Only administrators/);
});
test('access identity and account save reject unauthenticated sessions without profile writes', async () => {
  const client={auth:{getUser:async()=>({data:{user:null},error:null})},from:()=>{throw new Error('must not write');}};
  const access=await load('../lib/actions/access.ts',client);
  const settings=await load('../lib/actions/corporate.ts',client);
  await assert.rejects(()=>access.currentAccessUserId(),/sign in/i);
  await assert.rejects(()=>settings.saveAdminName('Name'),/sign in/i);
});
test('account name save trims the name and targets only the authenticated profile', async () => {
  const operations=[];
  const chain={update:v=>{operations.push(['update',v]);return chain;},eq:(...v)=>{operations.push(['eq',...v]);return chain;},select:()=>chain,single:async()=>({error:null})};
  const settings=await load('../lib/actions/corporate.ts',{auth:{getUser:async()=>({data:{user:{id:'signed-in'}},error:null})},from:table=>{operations.push(['from',table]);return chain;}});
  await settings.saveAdminName('  Admin Name  ');
  assert.deepEqual(operations,[['from','profiles'],['update',{full_name:'Admin Name'}],['eq','id','signed-in']]);
});

const sql=readFileSync(new URL('../supabase/migrations/20260916190557_csr_reports_settings_review.sql',import.meta.url),'utf8');
const body=name=>sql.match(new RegExp(`create function public\\.${name}\\([\\s\\S]*?\\$\\$;`,'i'))?.[0];
test('SQL source contract: corporate validation retains state, identity and completed-attendance safeguards', () => {
  const rpc=body('save_corporate_booking');
  for (const text of ['p_team_size is null or p_team_size <= 0',"p_status not in ('Pending','Confirmed','Completed','Cancelled')",'Company no longer exists.','Corporate booking no longer exists.',"elsif p_status not in ('Pending','Confirmed')",'This event slot no longer exists.',"v_old.status = 'Completed'",'p_company_id <> v_old.company_id','p_team_size <> v_old.team_size']) assert.ok(rpc.includes(text),text);
  assert.match(sql,/attendance_count between 0 and team_size/);
  assert.match(sql,/volunteer_hours <> 'NaN'::numeric/);
  assert.match(sql,/status <> 'Completed' and attendance_count is null and volunteer_hours is null/);
});
test('historical migration documents the superseded shared-capacity model', () => {
  assert.ok(body('save_corporate_booking').includes('v_count + public.csr_reserved_spaces(v_slot.id, p_id) + p_team_size > v_slot.capacity'));
});
