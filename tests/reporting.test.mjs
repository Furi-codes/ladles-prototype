import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
// Use the project's compiler without adding a test runtime dependency.
const source = readFileSync(new URL('../lib/reporting.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { performanceRows, corporateImpact, reportCsv, csvCell } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const events = [{id:1,title:'Kitchen',date:'2026-09-01',location:'Cape Town',total_slots:999},{id:2,title:'Other',date:'2026-10-01',location:'Elsewhere'}];
const slots = [{id:10,event_id:1,capacity:10},{id:11,event_id:1,capacity:5}];
const bookings = [{id:1,event_id:1,status:'Completed'},{id:2,event_id:1,status:'Present'},{id:3,event_id:1,status:'No show'}];
const attendance = [{booking_id:1,clocked_in_at:'x',worked_minutes:95},{booking_id:2,clocked_in_at:'x',worked_minutes:null}];
const corporate = [{id:1,event_id:1,company_id:4,status:'Completed',team_size:5,attendance_count:4,volunteer_hours:7.5},{id:2,event_id:1,company_id:4,status:'Pending',team_size:2,attendance_count:null,volunteer_hours:null},{id:3,event_id:1,company_id:4,status:'Cancelled',team_size:100,attendance_count:null,volunteer_hours:null}];
const filter = {from:'2026-09-01',to:'2026-09-30',location:'',event:''};
test('reports use actual minutes, slot capacity, recorded corporate attendance and exclude cancelled teams', () => {
  const rows = performanceRows(events,slots,bookings,attendance,corporate,filter);
  assert.equal(rows.length,1); assert.equal(rows[0].capacity,15); assert.equal(rows[0].bookings,10);
  assert.equal(rows[0].attendance,6); assert.equal(rows[0].rate,60); assert.equal(rows[0].individualHours,95/60);
  assert.equal(rows[0].corporateHours,7.5); assert.equal(rows[0].groups,2);
});
test('filters combine date, event and location; empty denominator is undefined', () => {
  assert.equal(performanceRows(events,slots,bookings,attendance,corporate,{...filter,location:'Elsewhere'}).length,0);
  assert.equal(performanceRows(events,slots,bookings,attendance,corporate,{...filter,event:'2'}).length,0);
  assert.equal(performanceRows(events,[],[],[],[],{from:'',to:'',location:'',event:'2'})[0].rate,null);
});
test('corporate impact counts participation instances and distinct events, not invented unique employees', () => {
  assert.deepEqual(corporateImpact(corporate,events,'4',filter),{participating:7,events:1,attendance:4,hours:7.5});
  assert.equal(corporateImpact(corporate,events,'99',filter).hours,0);
});
test('CSV quotes embedded delimiters, newlines and quotes, neutralizes formula text and refuses empty exports', () => {
  assert.equal(csvCell('a,"b"\nc'),'"a,""b""\nc"');
  assert.equal(csvCell('  =SUM(A1)'),'"\'  =SUM(A1)"');
  assert.equal(csvCell('@evil'),'"\'@evil"'); assert.equal(csvCell(-1),'"-1"');
  assert.equal(reportCsv([]),null);
  const csv = reportCsv(performanceRows(events,slots,bookings,attendance,corporate,filter));
  assert.ok(csv.startsWith('\uFEFF')); assert.ok(csv.includes('1.58')); assert.ok(csv.includes('7.50'));
});
