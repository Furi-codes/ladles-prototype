/* Full UI review entry. Imports point at frozen copies, never live app modules. */
import React,{Component,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ThemeProvider} from './system-source/app/components/ThemeProvider';
import AdminShell from './system-source/app/admin/components/AdminShell';
import VolunteerShell from './system-source/app/volunteer/components/VolunteerShell';
import LoginForm from './system-source/app/components/LoginForm';
import ResetPasswordForm from './system-source/app/components/ResetPasswordForm';
import AdminHome from './system-source/app/admin/page';
import Events from './system-source/app/admin/events/page';
import Rosters from './system-source/app/admin/volunteers/page';
import Directory from './system-source/app/admin/directory/page';
import CSR from './system-source/app/admin/csr/page';
import Reports from './system-source/app/admin/reports/page';
import Settings from './system-source/app/admin/settings/page';
import VolunteerHome from './system-source/app/volunteer/components/VolunteerDashboard';
import Impact from './system-source/app/volunteer/impact/page';
import Attendance from './system-source/app/volunteer/attendance/page';
import Profile from './system-source/app/volunteer/profile/page';
import Notifications from './system-source/app/volunteer/notifications/page';
import {currentRoute,go,usePathname,setPreviewState,resetPreview,installOfflineBoundary} from './system-runtime';
import './system-source/app/globals.css';
import './system-source/app/portal.css';
import './system-preview.css';

export const screens={'/':LoginForm,'/update-password':ResetPasswordForm,'/admin':AdminHome,'/admin/events':Events,'/admin/volunteers':Rosters,'/admin/directory':Directory,'/admin/csr':CSR,'/admin/reports':Reports,'/admin/settings':Settings,'/volunteer':VolunteerHome,'/volunteer/impact':Impact,'/volunteer/attendance':Attendance,'/volunteer/profile':Profile,'/volunteer/notifications':Notifications};
function LegacyCSR(){return <><section className="preview-guide"><h1>Legacy CSR history — read-only preview</h1><p>These existing CSR records use volunteer event slots. They are not the new corporate booking flow. Keep their history intact while implementing independent corporate events and reservations.</p><button onClick={()=>go('/proposal/admin')}>Open new corporate booking workflow</button></section><fieldset disabled className="legacy-csr-readonly"><legend>Existing CSR records — no new bookings here</legend><CSR/></fieldset></>;}
class PreviewBoundary extends Component {
  state={error:null};
  static getDerivedStateFromError(error){return {error};}
  render(){return this.state.error?<section className="preview-error" role="alert"><h1>Preview could not render this screen</h1><p>{this.state.error.message}</p><p>This does not affect your real app. Return to another preview page using the toolbar.</p></section>:this.props.children;}
}
export function CurrentScreen(){const route=usePathname();const Screen=screens[route]||LoginForm;if(route.startsWith('/proposal'))return <iframe key={route} className="proposal-frame" title="Proposed corporate workflow" src={route==='/proposal/business'?'corporate-workflow.html?access=business':route==='/proposal/admin'?'corporate-workflow.html?access=admin':'corporate-workflow.html'} sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-downloads"/>;const content=route==='/admin/csr'?<LegacyCSR/>:<Screen/>;return <PreviewBoundary key={route}>{route.startsWith('/admin')?<AdminShell>{content}</AdminShell>:route.startsWith('/volunteer')?<VolunteerShell>{content}</VolunteerShell>:content}</PreviewBoundary>;}
export function PreviewApp(){
  const route=usePathname();const [help,setHelp]=useState(false);
  return <ThemeProvider><div className="system-preview-toolbar"><div><strong>FULL SYSTEM UI COPY</strong><small>Fictional data · no live login, database, WMS or email</small></div><nav aria-label="Preview controls"><button onClick={()=>go('/')}>Login / sign up</button><button aria-pressed={route.startsWith('/admin')} onClick={()=>go('/admin')}>Admin</button><button aria-pressed={route.startsWith('/volunteer')} onClick={()=>go('/volunteer')}>Volunteer</button><button aria-pressed={route==='/proposal'} onClick={()=>go('/proposal')}>Corporate proposal</button><button onClick={()=>go('/update-password')}>Reset password</button><label>State<select defaultValue="normal" onChange={event=>setPreviewState(event.target.value)}><option value="normal">Normal</option><option value="empty">Empty</option><option value="loading">Loading</option><option value="error">Error</option></select></label><button onClick={()=>{resetPreview();go('/');}}>Reset demo data</button><button onClick={()=>setHelp(!help)}>About this copy</button></nav></div>
    {help&&<section className="preview-guide"><h2>How to review this duplicate</h2><p>Admin: Dashboard, Events, Volunteer rosters, Corporate bookings and read-only legacy CSR history, Analytics & reports, and Settings. Volunteer: Home/opportunities, booking details, My impact/certificate, Attendance, Profile and Notifications. Login/signup/reset use the current UI with simulated results. Corporate bookings opens the independent corporate workflow blueprint, not the old shared volunteer-slot booking flow.</p><p>Use fictional emails containing “admin” to enter administration, or use the toolbar. Credentials are never sent or saved. Forms modify demo records in memory; refreshing resets them. Cameras, real location search, email verification/delivery, background jobs and WMS sync are not run. QR images are for layout review, not real attendance.</p><p>UI source and styles are frozen under <code>design-preview/system-source/</code>. Edit those copies to try changes; rebuild with <code>node design-preview/build-system-preview.cjs</code>. Existing snapshot files are not overwritten by rebuilding. The original app is untouched. Review changes can later be transferred to corresponding original files. Do not edit the generated bundle.</p><p>This is a visual/workflow sandbox, not a second production backend. Corporate database/auth safeguards and real mobile/integration testing remain pending.</p></section>}
    <div id="system-root"><CurrentScreen/></div></ThemeProvider>;
}
if(typeof document!=='undefined'){
  installOfflineBoundary();
  const requested=window.location.hash.slice(1);if(requested)go(requested);
  window.addEventListener('hashchange',()=>go(window.location.hash.slice(1)||'/'));
  createRoot(document.getElementById('preview-root')).render(<PreviewApp/>);
}
export {go,currentRoute};
