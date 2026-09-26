import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../lib/reporting.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { reportAnalytics, dateRangeFilter, performanceRows } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const filter = {from:'2026-07-01',to:'2026-09-30',location:'',event:''};
const data = {
  events: [{id:1,date:'2026-07-01',status:'Scheduled'}, {id:2,date:'2026-09-30',status:'Scheduled'}, {id:3,date:'2026-09-01',status:'Cancelled'}, {id:4,date:'2026-10-01',status:'Scheduled'}],
  slots: [],
  bookings: [{id:1,event_id:1,user_id:'a',status:'Completed'}, {id:2,event_id:2,user_id:'a',status:'Present'}, {id:3,event_id:2,user_id:'b',status:'No show'}, {id:4,event_id:3,user_id:'c',status:'Completed'}],
  attendance: [{booking_id:1,clocked_in_at:'in',clocked_out_at:'out',worked_minutes:90}, {booking_id:2,clocked_in_at:'in',clocked_out_at:null,worked_minutes:100}, {booking_id:4,clocked_in_at:'in',clocked_out_at:'out',worked_minutes:999}],
  corporate: [
    {id:1,event_id:1,company_id:1,status:'Completed',team_size:4,attendance_count:3,volunteer_hours:6},
    {id:2,event_id:2,company_id:2,status:'Completed',team_size:2,attendance_count:2,volunteer_hours:8},
    {id:3,event_id:2,company_id:1,status:'Pending',team_size:3},
    {id:4,event_id:2,company_id:1,status:'Confirmed',team_size:2},
    {id:5,event_id:2,company_id:1,status:'Cancelled',team_size:50,attendance_count:50,volunteer_hours:999},
    {id:6,event_id:3,company_id:1,status:'Cancelled',team_size:50},
    {id:7,event_id:3,company_id:1,status:'Completed',team_size:2,attendance_count:2,volunteer_hours:999},
    {id:8,event_id:4,company_id:1,status:'Completed',team_size:2,attendance_count:2,volunteer_hours:999},
  ], companies: [{id:1,name:'First'}, {id:2,name:'Second'}],
};
test('summary and monthly charts reconcile actual attendance; reservations never become hours', () => {
  const r = reportAnalytics(data,filter);
  assert.equal(r.hours,15.5);
  assert.equal(r.activeVolunteers,1);
  assert.equal(r.completedEvents,2);
  assert.equal(r.attendanceRate,50); // 7 attendees / 14 places
  assert.deepEqual(r.monthly,[{month:'2026-07',hours:7.5,booked:5,attended:4},{month:'2026-08',hours:0,booked:0,attended:0},{month:'2026-09',hours:8,booked:9,attended:3}]);
  assert.deepEqual(r.companies,[{id:2,name:'Second',hours:8},{id:1,name:'First',hours:6}]);
});
test('cancelled event attendance is excluded even with stale completed records; donut retains statuses', () => {
  const r = reportAnalytics(data,filter);
  assert.deepEqual(r.statuses,[{status:'Pending',count:1},{status:'Confirmed',count:1},{status:'Completed',count:3},{status:'Cancelled',count:2}]);
  const cancelled = performanceRows(data.events,[],data.bookings,data.attendance,data.corporate,{...filter,event:'3'})[0];
  assert.equal(cancelled.individualHours,0); assert.equal(cancelled.corporateHours,0);
  assert.equal(cancelled.bookings,0); assert.equal(cancelled.attendance,0);
});
test('inclusive date boundaries, company and participation filters share chart/CSV scope', () => {
  const r = reportAnalytics(data,{...filter,from:'2026-09-30'},true,'2');
  assert.equal(r.hours,8); assert.equal(r.activeVolunteers,null); assert.equal(r.completedEvents,1);
  assert.equal(r.attendanceRate,100); assert.equal(r.rows.length,1);
  assert.equal(r.statuses.reduce((n,s)=>n+s.count,0),1);
  const empty = reportAnalytics(data,{...filter,to:'2026-06-01'});
  assert.equal(empty.hours,0); assert.deepEqual(empty.monthly,[]); assert.equal(empty.attendanceRate,null);
});
test('empty data produces zero recorded activity and an undefined attendance rate', () => {
  const r = reportAnalytics({events:[],slots:[],bookings:[],attendance:[],corporate:[],companies:[]},filter);
  assert.equal(r.hours,0); assert.equal(r.activeVolunteers,0); assert.equal(r.completedEvents,0);
  assert.equal(r.attendanceRate,null); assert.equal(r.monthly.length,3);
  assert.deepEqual(r.companies,[]); assert.ok(r.statuses.every(s=>s.count===0));
});
test('Johannesburg presets handle midnight, year rollover, leap years and month-end clamping', () => {
  assert.deepEqual(dateRangeFilter('Last 30 days',new Date('2026-09-30T23:00:00Z')),{from:'2026-09-02',to:'2026-10-01',event:'',location:''});
  assert.equal(dateRangeFilter('Last 3 months',new Date('2026-05-31T12:00:00Z')).from,'2026-02-28');
  assert.equal(dateRangeFilter('Last 6 months',new Date('2024-08-31T12:00:00Z')).from,'2024-02-29');
  assert.equal(dateRangeFilter('Last 12 months',new Date('2024-02-29T12:00:00Z')).from,'2023-02-28');
});
