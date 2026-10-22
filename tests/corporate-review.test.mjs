import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url),p=require('../design-preview/corporate-review.inspect.cjs');
async function rpc(name,args={}){const result=await p.supabase.rpc(name,args);if(result.error)throw Error(result.error.message);return result.data;}
const detail=id=>rpc('corporate_booking_detail',{p_booking_id:id});
const deadline=()=>new Date(Date.now()+86400000).toISOString();

test('actual corporate routes render through an offline-only adapter without an SDK or credentials',()=>{
  p.resetReview();for(const route of p.routes)assert.ok(p.renderScreen(route).length>100,route);
  const html=readFileSync(new URL('../design-preview/corporate-review.html',import.meta.url),'utf8'),bundle=readFileSync(new URL('../design-preview/corporate-review.bundle.js',import.meta.url),'utf8');
  assert.match(html,/connect-src 'none'/);assert.match(html,/form-action 'none'/);
  assert.doesNotMatch(bundle,/NEXT_PUBLIC_SUPABASE_URL|supabase\.co|service_role|@supabase\/supabase-js\/dist/);
  assert.match(bundle,/Network requests are disabled/);
  assert.match(p.renderScreen('/'),/Business registration/);assert.match(p.renderScreen('/admin/corporate-bookings'),/Corporate reports/);
});

test('demo booking requests, acceptance, changes, cancellation and receipts use independent corporate records',async()=>{
  p.resetReview();p.reviewAs('corporate');const event=p.reviewData().events[2];
  const requested=await rpc('corporate_request_booking',{p_event_id:event.id,p_event_version:event.version,p_group_size:8,p_notes:'Fictional request.',p_request_key:randomUUID()});
  assert.equal(requested.status,'Requested');assert.equal(requested.event.reserved_places,0);
  p.reviewAs('admin');const accepted=await rpc('corporate_booking_deadline',{p_booking_id:requested.id,p_version:requested.version,p_deadline:deadline(),p_note:'Discussed externally.'});
  assert.equal(accepted.event.reserved_places,8);
  const paid=await rpc('corporate_record_payment',{p_booking_id:accepted.id,p_version:accepted.version,p_request_key:randomUUID(),p_reference:'DEMO',p_received_on:new Date().toISOString().slice(0,10),p_note:'Receipt verified.'});
  p.reviewAs('corporate');const change=await rpc('corporate_request_change',{p_booking_id:paid.id,p_version:paid.version,p_kind:'Amendment',p_target_id:event.id,p_target_version:event.version,p_size:6,p_reason:'Smaller group.',p_request_key:randomUUID()});
  assert.equal(change.group_size,8);assert.equal(change.event.reserved_places,8);
  p.reviewAs('admin');const moved=await rpc('corporate_review_change',{p_booking_id:change.id,p_version:change.version,p_change_id:change.pending_change.id,p_approve:true,p_note:'Agreed externally.',p_amount:null,p_deadline:null});assert.equal(moved.event.reserved_places,6);
  p.reviewAs('corporate');const cancel=await rpc('corporate_request_change',{p_booking_id:moved.id,p_version:moved.version,p_kind:'Cancellation',p_target_id:null,p_target_version:null,p_size:null,p_reason:'Cannot attend.',p_request_key:randomUUID()});assert.equal(cancel.event.reserved_places,6);
  p.reviewAs('admin');const cancelled=await rpc('corporate_review_change',{p_booking_id:cancel.id,p_version:cancel.version,p_change_id:cancel.pending_change.id,p_approve:true,p_note:'Refund follow-up external.',p_amount:null,p_deadline:null});assert.equal(cancelled.status,'Cancelled');assert.equal(cancelled.event.reserved_places,0);assert.equal((await detail(cancel.id)).payments.length,1);
  assert.ok(p.reviewData().notices.some(n=>n.booking_id===cancel.id&&n.title==='Cancellation approved'));p.resetReview();
});

test('attendance UI supports blank versus zero hours, actual counts, correction reasons and retained history',async()=>{
  p.resetReview();p.reviewAs('admin');const initial=(await detail('booking-attendance')).booking;
  assert.match(p.renderAttendanceForm(initial),/Actual attendees/);assert.match(p.renderAttendanceForm(initial),/Leave blank if not recorded/);
  const key=randomUUID(),args={p_booking_id:initial.id,p_version:initial.version,p_request_key:key,p_count:11,p_hours:null,p_note:'Actual attendees counted.'};
  const completed=await rpc('corporate_record_attendance',args);await rpc('corporate_record_attendance',args);assert.equal(completed.status,'Completed');assert.equal(completed.attendance.group_hours,null);
  const corrected=await rpc('corporate_record_attendance',{...args,p_version:completed.version,p_request_key:randomUUID(),p_count:0,p_hours:0,p_note:'Correction: group did not attend.'});
  assert.equal(corrected.attendance.attendance_count,0);assert.equal(corrected.attendance.group_hours,0);
  const loaded=await detail(initial.id);assert.equal(loaded.payments.length,1);assert.equal(loaded.history.length,2);assert.equal(loaded.history[0].before_values.attendance.attendance_count,11);
  assert.match(p.renderAttendanceForm(corrected),/Correction reason/);assert.match(p.renderOutcomeTable([corrected]),/0\.00/);
  assert.throws(()=>p.cleanCorporateAttendance(15,'0','1','Note'),/zero attendees/);
  assert.throws(()=>p.cleanCorporateAttendance(15,'16','','Note'),/within the booked/);
  assert.throws(()=>p.cleanCorporateAttendance(15,'1','-1','Note'),/non-negative/);p.resetReview();
});

test('company reports are owned, totals include the full scope, and CSV excludes contact/payment notes',async()=>{
  p.resetReview();p.reviewAs('admin');const all=await rpc('corporate_outcome_report');assert.equal(all.summary.completed_groups,2);assert.equal(all.summary.attendance_instances,15);assert.equal(all.summary.group_hours,20);assert.equal(all.summary.groups_without_hours,1);
  const csv=p.corporateOutcomesCsv(all.rows);assert.doesNotMatch(csv,/mpc@example.invalid|12 Fictional Street|DEMO-RECEIPT|Fictional review booking/);
  p.selectCompany('company-2');const mine=await rpc('corporate_outcome_report');assert.equal(mine.total,1);assert.ok(mine.rows.every(row=>row.account_id==='company-2'));await assert.rejects(detail('booking-attendance'),/cannot open/);
  await assert.rejects(rpc('corporate_record_attendance',{p_booking_id:'booking-second-company'}),/administrator/);
  const table=p.renderOutcomeTable(mine.rows);assert.match(table,/Not recorded/);assert.doesNotMatch(table,/Example Business/);
  p.reviewAs('admin');const event=p.reviewData().events[2];p.reviewAs('corporate');for(let i=0;i<12;i++)await rpc('corporate_request_booking',{p_event_id:event.id,p_event_version:event.version,p_group_size:1,p_notes:'Paging test.',p_request_key:randomUUID()});
  p.reviewAs('admin');const report=await rpc('corporate_outcome_report',{p_query:event.title,p_limit:10,p_offset:0});assert.equal(report.rows.length,10);assert.equal(report.total,13);assert.equal(report.summary.bookings,13);
  const exported=await p.loadAllCorporateOutcomeRows({query:event.title,from:'',to:'',status:''});assert.equal(exported.length,13);assert.equal(new Set(exported.map(row=>row.id)).size,13);
  const formula={...exported[0],contact_snapshot:{company_name:' =HYPERLINK("unsafe")'}};assert.match(p.corporateOutcomesCsv([formula]),/' =HYPERLINK/);p.resetReview();
});

test('demo errors, empty states and reset do not create records or send credentials',async()=>{
  p.resetReview();p.reviewAs('admin');const before=p.reviewData().bookings.length;p.setReviewState('error');await assert.rejects(rpc('corporate_search_bookings'),/Simulated loading error/);assert.equal(p.reviewData().bookings.length,before);
  p.setReviewState('empty');assert.equal((await rpc('corporate_search_bookings')).total,0);p.resetReview();
  const result=await p.supabase.auth.signUp({email:'new@example.invalid',password:'not-stored',options:{data:{registration_kind:'corporate',corporate_details:{company_name:'Fictional New Co',contact_name:'Test Contact',contact_email:'new@example.invalid',contact_phone:'+27000000000',billing_address:'Fictional address'}}}});assert.equal(result.error,null);
  const created=p.reviewData().accounts.find(row=>row.contact_email==='new@example.invalid');assert.equal(created.status,'Awaiting approval');assert.equal(created.email_verified,false);assert.ok(!JSON.stringify(p.reviewData()).includes('not-stored'));
  p.resetReview();assert.ok(!p.reviewData().accounts.some(row=>row.id===created.id));
});
