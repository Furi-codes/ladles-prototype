import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const preview=require('../design-preview/system-preview.inspect.cjs');

test('the full UI snapshot renders every current portal route without contacting a database',()=>{
  for(const path of preview.routes){const markup=preview.renderScreen(path);assert.ok(markup.length>100,path);assert.ok(!markup.includes('Preview could not render this screen'),path);}
  assert.match(preview.renderScreen('/admin/events'),/New event/);
  assert.match(preview.renderScreen('/admin/reports'),/Analytics/);
  assert.match(preview.renderScreen('/volunteer/impact'),/My impact/);
  assert.match(preview.renderScreen('/volunteer/attendance'),/Camera preview/);
  assert.match(preview.renderScreen('/proposal'),/corporate-workflow.html/);
  assert.match(preview.renderScreen('/'),/Corporate sign up/);
  assert.match(preview.renderScreen('/proposal/business'),/corporate-workflow.html\?access=business/);
  const directory=preview.renderScreen('/admin/directory');
  assert.match(directory,/Volunteer directory/);
  assert.match(directory,/mailto:volunteer@example.invalid/);
  assert.match(directory,/tel:\+27000000001/);
  assert.match(directory,/Jordan Sample/);
  assert.match(directory,/Taylor Example/);
  assert.match(directory,/Number needed/);
});

test('demo event and booking CRUD change only the in-memory preview records',async()=>{
  preview.resetPreview();
  const result=await preview.action('saveEventWithSlots',null,{title:'Preview-only test',date:'2099-11-15',location:'Fictional location'},[{start_time:'09:15',end_time:'10:15',capacity:3}]);
  assert.equal(result.error,null);const event=result.data;
  const slot=preview.getData().eventSlots.find(s=>s.event_id===event.id);
  const booked=await preview.action('bookEventSlot',slot.id);assert.equal(booked.data.event_id,event.id);
  assert.match((await preview.action('bookEventSlot',slot.id)).error.message,/already/);
  await preview.action('cancelUserBooking',booked.data.id,'demo-volunteer');
  await preview.action('deleteEvent',event.id);assert.ok(!preview.getData().events.some(e=>e.id===event.id));
  preview.resetPreview();
});

test('preview generates report/CSR/settings records and fails unsupported writes explicitly',async()=>{
  const report=await preview.action('loadReportData',{});assert.ok(report.attendance.length);assert.ok(report.slots.length);
  const csr=await preview.action('loadCorporateData');assert.ok(csr.companies.length);assert.equal(csr.bookings[0].team_size,5);
  const settings=await preview.action('loadSettings');assert.equal(settings.settings.timezone,'Africa/Johannesburg');
  await assert.rejects(preview.action('unsupportedLiveOperation'),/not simulated/);
});

test('new corporate workflow is separate from read-only legacy CSR and Google login fails safely offline',async()=>{
  preview.resetPreview();
  assert.match(preview.renderScreen('/proposal/admin'),/corporate-workflow.html\?access=admin/);
  const legacy=preview.renderScreen('/admin/csr');
  assert.match(legacy,/Legacy CSR history/);assert.match(legacy,/<fieldset disabled=""/);
  assert.match(preview.renderScreen('/admin'),/Corporate bookings/);
  const before=JSON.stringify(preview.getData().corporate);
  await assert.rejects(preview.action('saveCorporateBooking',null,{}),/read-only/);
  assert.equal(JSON.stringify(preview.getData().corporate),before);
  const result=await preview.supabase.auth.signInWithOAuth({provider:'google'});
  assert.equal(result.data,null);assert.match(result.error.message,/offline preview/);
});

test('browser preview is self-contained and forbids live connections',()=>{
  const html=readFileSync(new URL('../design-preview/system.html',import.meta.url),'utf8');
  assert.match(html,/connect-src 'none'/);assert.match(html,/form-action 'none'/);
  const bundle=readFileSync(new URL('../design-preview/system-preview.bundle.js',import.meta.url),'utf8');
  assert.doesNotMatch(bundle,/supabase\.co|service_role|NEXT_PUBLIC_SUPABASE_URL|@supabase\/supabase-js\/dist/);
  assert.match(bundle,/Network requests disabled in preview/);
});

test('frozen UI source is separate from production and retains corresponding component/style paths',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../design-preview/system-source-manifest.json',import.meta.url),'utf8'));
  for(const file of ['app/admin/components/EventsManager.tsx','app/admin/admin.module.css','app/volunteer/components/VolunteerDashboard.tsx','app/volunteer/volunteer.module.css'])assert.ok(manifest.files.some(row=>row.file===file),file);
  assert.ok(manifest.files.every(row=>!row.file.endsWith('.env.local')&&!row.file.startsWith('app/api/')));
});
