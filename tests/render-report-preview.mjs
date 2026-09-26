// Isolated, interactive visual fixture; never connects to Supabase.
// Render the actual dashboard and Reports page together for light/dark comparison.
// Run this file, then the esbuild command printed below.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const out = resolve('.exports/reports-verification');
mkdirSync(out, {recursive:true});
const reset = readFileSync(new URL('../node_modules/tailwindcss/preflight.css', import.meta.url), 'utf8');
const fixture = {
  events:[{id:1,title:'Visual fixture event',date:new Date().toISOString().slice(0,10),location:'Cape Town',status:'Scheduled',total_slots:20,time_slots:''}],
  slots:[{id:1,event_id:1,capacity:20,start_time:'09:00',end_time:'12:00'}],
  bookings:[], attendance:[],
  companies:[{id:1,name:'Visual fixture: A Very Long Company Name That Must Wrap Without Hiding Its Hours'}],
  corporate:['Pending','Confirmed','Completed','Cancelled'].map((status,i)=>({id:i+1,event_id:1,event_slot_id:1,company_id:1,status,team_size:4,attendance_count:status==='Completed'?3:null,volunteer_hours:status==='Completed'?6:null})),
};
writeFileSync(resolve(out,'actions.ts'), `export async function loadReportData() { return window.__REPORT_TEST_DATA__; }
export async function searchReportEvents() { return []; }
export async function searchReportLocations() { return []; }
`);
writeFileSync(resolve(out,'entry.tsx'), `import React from 'react';
import {createRoot} from 'react-dom/client';
import Dashboard from '../../app/admin/components/Dashboard';
import ReportsManager from '../../app/admin/components/ReportsManager';
import admin from '../../app/admin/admin.module.css';
const empty = new URLSearchParams(location.search).has('empty');
if (empty) window.__REPORT_TEST_DATA__ = {events:[],slots:[],bookings:[],attendance:[],companies:[],corporate:[]};
createRoot(document.getElementById('report-fixture')).render(<div className={admin.shell}><main className={admin.main}><div className={admin.content}>
<div className={admin.pageHeading}><div><h1 className={admin.pageTitle}>Dashboard</h1><p className={admin.pageDescription}>Visual fixture: existing Dashboard and new analytics, with isolated data.</p></div></div>
<Dashboard bookings={[]} events={[]} eventSlots={[]} volunteers={[]} isLoading={false} hasError={false}/>
<div className={admin.pageHeading} style={{marginTop:32}}><div><h1 className={admin.pageTitle}>Reports &amp; Analytics</h1><p className={admin.pageDescription}>Actual Reports controls and charts with the same admin theme.</p></div></div>
<ReportsManager/>
</div></main></div>);
`);
for (const theme of ['light','dark']) {
  writeFileSync(resolve(out,`${theme}.html`), `<!doctype html><html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin theme comparison - ${theme}</title><link rel="stylesheet" href="interactive.css"><style>${reset}</style></head><body><div id="report-fixture"></div><script>window.__REPORT_TEST_DATA__=${JSON.stringify(fixture)}</script><script src="interactive.js"></script></body></html>`);
}
console.log('Generated isolated theme fixtures. Bundle with:');
console.log("npx --yes esbuild .exports/reports-verification/entry.tsx --bundle --outfile=.exports/reports-verification/interactive.js --loader:.module.css=local-css '--define:process.env={}' --alias:@/lib/actions/corporate=./.exports/reports-verification/actions.ts");
