/* Review uses the actual app components; only the browser router and data adapter are simulated. */
import React,{Component} from 'react';
import {createRoot} from 'react-dom/client';
import {ThemeProvider} from '../app/components/ThemeProvider';
import LoginForm from '../app/components/LoginForm';
import ResetPasswordForm from '../app/components/ResetPasswordForm';
import AdminShell from '../app/admin/components/AdminShell';
import CorporateAdministration from '../app/admin/corporate-bookings/page';
import CorporateAccounts from '../app/admin/corporate-accounts/page';
import Directory from '../app/admin/directory/page';
import CorporateProfile from '../app/corporate/page';
import CorporateRegistration from '../app/corporate/register/page';
import CorporateWorkflowPortal from '../app/corporate/components/CorporateWorkflowPortal';
import CorporateBookingList from '../app/corporate/components/CorporateBookingList';
import CorporateOutcomeReports from '../app/corporate/components/CorporateOutcomeReports';
import {useReviewState,go,reviewAs,selectCompany,setReviewState,resetReview,verifyDemoEmail,reviewData,reviewAttendanceDetail,installOfflineBoundary} from './corporate-review-runtime';
import '../app/globals.css';
import '../app/portal.css';
import './corporate-review.css';

class ReviewBoundary extends Component{
  state={error:null};
  static getDerivedStateFromError(error){return {error};}
  render(){return this.state.error?<section className="corporate-review-guide" role="alert"><h1>Review screen error</h1><p>{this.state.error.message}</p><p>Use the toolbar to reset or open another review screen. No live data is affected.</p></section>:this.props.children;}
}
export function ReviewScreen(){
  const {path}=useReviewState(),route=path.split('?')[0];let content;
  if(route==='/')content=<LoginForm/>;
  else if(route==='/update-password')content=<ResetPasswordForm/>;
  else if(route==='/corporate/register')content=<CorporateRegistration/>;
  else if(route==='/corporate')content=<CorporateProfile/>;
  else if(route.startsWith('/corporate/'))content=<CorporateWorkflowPortal mode={route.endsWith('/events')?'events':route.endsWith('/updates')?'updates':route.endsWith('/reports')?'reports':'bookings'}/>;
  else if(route==='/admin/corporate-bookings')content=<CorporateAdministration/>;
  else if(route==='/admin/corporate-accounts')content=<CorporateAccounts/>;
  else if(route==='/admin/directory')content=<Directory/>;
  else if(route==='/admin/reports')content=<CorporateOutcomeReports admin/>;
  else if(route==='/admin/attendance-demo')content=<CorporateBookingList admin settings={reviewData().settings} initialDetail={reviewAttendanceDetail()}/>;
  else content=<section className="corporate-review-guide"><h1>Existing screen outside this review</h1><p>This review focuses on the new corporate workflow and volunteer directory. The older full-system UI copy is still available separately.</p><a href="system.html">Open full-system UI copy</a><button onClick={()=>go('/admin/corporate-bookings')}>Back to corporate bookings</button></section>;
  return <ReviewBoundary key={path}>{route.startsWith('/admin')?<AdminShell>{content}</AdminShell>:content}</ReviewBoundary>;
}
export function CorporateReviewApp(){
  const current=useReviewState();
  return <ThemeProvider><aside className="corporate-review-toolbar" aria-label="Offline review controls"><div><strong>CORPORATE UI REVIEW · NO DATABASE</strong><small>Actual app components · fictional data · no real login, email, payment or WMS</small></div><nav><button onClick={()=>{reviewAs(null);go('/');}}>Login / business signup</button><button onClick={()=>reviewAs('admin')}>Admin</button><button onClick={()=>selectCompany('company-1')}>Business 1</button><button onClick={()=>selectCompany('company-2')}>Business 2</button><button onClick={()=>{reviewAs('admin');go('/admin/attendance-demo');}}>Attendance demo</button><button onClick={()=>{reviewAs('admin');go('/admin/reports');}}>Corporate reports</button><button onClick={verifyDemoEmail}>Demo: verify selected email</button><button onClick={()=>{reviewAs('corporate');go('/update-password');}}>Password recovery UI</button><label>View<select value={current.view} onChange={event=>setReviewState(event.target.value)}><option value="normal">Normal</option><option value="empty">Empty</option><option value="error">Error</option><option value="loading">Loading</option></select></label><button onClick={()=>{if(window.confirm('Reset only fictional review records?'))resetReview();}}>Reset demo</button></nav></aside>
    <details className="corporate-review-help"><summary>How to review this UI</summary><p>Start with Business registration on the login screen, or use Admin/Business 1 above. Fictional logins: admin@example.invalid and mpc@example.invalid (any demo password). No password is stored or sent. Use “Demo: verify selected email” to simulate email verification; actual delivery/recovery remains a final staging check.</p><p>Admin → Corporate accounts approves a new business. Corporate bookings → Corporate events creates available dates. Business → Browse events submits a request. Admin reviews it, sets a payment deadline and records external payment. Business requests changes/cancellation; admin reviews them. Use Attendance demo for an ended, paid booking; record totals, correct them, then open Corporate reports to export/print all matching records.</p><p>Changes reset when the page reloads. Data isolation and transaction rules here are demonstrations, not a substitute for the real database safeguards/tests. The real attendance/reporting backend and production enablement remain deferred until after UI approval. You can still review the <a href="corporate-workflow.html">earlier mockup</a>.</p></details>
    <div id="corporate-review-root" key={current.accessRevision+':'+current.path}><ReviewScreen/></div>
  </ThemeProvider>;
}
if(typeof document!=='undefined'){
  installOfflineBoundary();const requested=window.location.hash.slice(1);if(requested){if(requested.startsWith('/admin'))reviewAs('admin');else if(requested.startsWith('/corporate')&&!requested.includes('/register'))reviewAs('corporate');go(requested);}
  window.addEventListener('hashchange',()=>go(window.location.hash.slice(1)||'/'));
  createRoot(document.getElementById('preview-root')).render(<CorporateReviewApp/>);
}
