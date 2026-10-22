/* Standalone in-memory blueprint. Never calls the live application or any API. */
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Event descriptions are admin-authored, not a fixed or sponsor-approved activity menu.
let activities = [];
let state, session = null, page = 'dashboard', authMode = 'signin', corporateTab = 'requests';
let draft, volunteerSearch = '', calendarMonth = '2026-11', toastTimer;
// All safeguards here demonstrate UI behaviour only. The implementation checklist describes the real backend work.
let dirtyForm=false, resetPreviewEmail='', resetPreviewStage='', submitSequence=1;
let listState={}, businessIdentity=null;
const requestReceipts=new Map();
function seed() {
  requestReceipts.clear();listState={};businessIdentity=null;dirtyForm=false;resetPreviewStage='';resetPreviewEmail='';submitSequence=1;
  activities = [
    {name:'Example corporate event',icon:'▦',venue:'Example corporate venue',description:'Fictional admin-created opportunity. Replace with an actual offering.'},
    {name:'Example team session',icon:'♡',venue:'Example meeting venue',description:'Another fictional corporate-only opportunity, not a preset activity.'},
    {name:'Example group opportunity',icon:'▦',venue:'Example venue',description:'Sample event for reviewing this blueprint.'},
  ];
  state = {
    now:'2026-10-15T10:00:00+02:00', nextBooking:106, nextSlot:9, nextCompany:3,
    bookingContact:{email:'',phone:''},
    companies:[
      {id:1,name:'Example Foods',contact:'Alex Morgan',email:'alex@example.invalid',phone:'+27 00 000 0001',address:'12 Example Street, Cape Town, 8000',status:'Approved',emailVerified:true},
      {id:2,name:'Example Retail',contact:'Sam Jacobs',email:'sam@example.invalid',phone:'+27 00 000 0002',address:'24 Sample Road, Cape Town, 8001',status:'Awaiting approval',emailVerified:true},
    ],
    slots:[
      {id:1,activity:0,date:'2026-11-05',start:'09:15',end:'10:15',capacity:50,min:1,max:50,active:true},
      {id:2,activity:0,date:'2026-11-12',start:'09:15',end:'10:15',capacity:50,min:1,max:50,active:true},
      {id:3,activity:0,date:'2026-11-12',start:'13:00',end:'14:30',capacity:40,min:1,max:40,active:true},
      {id:4,activity:0,date:'2026-11-19',start:'09:15',end:'10:15',capacity:30,min:1,max:30,active:true},
      {id:5,activity:1,date:'2026-11-12',start:'09:00',end:'12:00',capacity:40,min:1,max:40,active:true},
      {id:6,activity:1,date:'2026-11-19',start:'09:00',end:'12:00',capacity:40,min:1,max:40,active:true},
      {id:7,activity:2,date:'2026-11-20',start:'10:00',end:'12:00',capacity:40,min:1,max:40,active:true},
      {id:8,activity:0,date:'2026-11-26',start:'09:15',end:'10:15',capacity:50,min:1,max:50,active:false},
    ],
    bookings:[
      {id:104,companyId:1,slotId:1,size:20,status:'Confirmed',notes:'Please share arrival instructions.',payment:{reference:'DEMO-REF-104',received:'2026-10-02',recordedAt:'2026-10-02T12:00:00+02:00',admin:'Demo administrator'},amendment:null},
      {id:105,companyId:1,slotId:4,size:15,status:'Pending payment',deadline:'2026-10-04T17:00:00+02:00',notes:'Payment is handled externally.',payment:null,amendment:null},
    ],
    volunteers:[
      {id:1,name:'Alex Volunteer',email:'volunteer@example.invalid',phone:'+27 00 000 0011',dob:'1998-04-12',joined:'2026-09-01',bookings:3,hours:6},
      {id:2,name:'Jordan Example',email:'jordan@example.invalid',phone:'+27 00 000 0012',dob:'1996-07-08',joined:'2026-09-12',bookings:2,hours:3},
      {id:3,name:'Taylor Sample',email:'taylor@example.invalid',phone:'',dob:'2000-01-21',joined:'2026-09-16',bookings:1,hours:0},
    ],
    notifications:[{id:1,role:'corporate',companyId:1,title:'Payment is overdue',message:'GR-105 is awaiting payment. Contact Ladles to discuss the next step.',read:false,target:{kind:'booking',id:105}}],
    audit:[],
  };
  state.bookings.forEach(b=>{b.contactSnapshot=contactSnapshot(company(b.companyId));});
  draft={activity:0,slotId:2,size:20,notes:'',requestKey:'request-'+submitSequence++};
}
function company(id=session?.companyId) {return state.companies.find(c=>c.id===id);}
function slot(id) {return state.slots.find(s=>s.id===Number(id));}
function booking(id) {return state.bookings.find(b=>b.id===Number(id));}
function localInput(value=state.now) {return new Date(new Date(value).getTime()+7200000).toISOString().slice(0,16);}
function saTime(value) {return value ? new Date(value).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg',dateStyle:'medium',timeStyle:'short'}) : 'Not set';}
function dateLabel(value) {return new Date(value+'T12:00:00+02:00').toLocaleDateString('en-ZA',{timeZone:'Africa/Johannesburg',day:'numeric',month:'short',year:'numeric'});}
const heldStatuses = ['Pending payment','Pending additional payment','Confirmed','Completed'];
function isOverdue(b) {return ['Pending payment','Pending additional payment'].includes(b.status) && new Date(b.deadline)<=new Date(state.now);}
// Corporate reservations never include individual volunteers. Requests do not hold places.
function remaining(slotId,excludeId=null) {const s=slot(slotId);return s?Math.max(0,s.capacity-state.bookings.filter(b=>b.slotId===s.id&&b.id!==excludeId&&heldStatuses.includes(b.status)).reduce((sum,b)=>sum+b.size,0)):0;}
function fits(s,size,excludeId=null) {return s&&reservable(s)&&Number.isInteger(size)&&size>=s.min&&size<=s.max&&size<=remaining(s.id,excludeId);}
function canManage(b) {return b&&session?.role==='admin';}
function ownsBooking(b) {return b&&session?.role==='corporate'&&company()?.status==='Approved'&&company()?.emailVerified===true&&b.companyId===session.companyId;}
function isOpen(b) {return b&&!['Rejected','Cancelled','Completed'].includes(b.status);}
function eventStarted(s) {return !s||Date.parse(s.date+'T'+s.start+':00+02:00')<=Date.parse(state.now);}
function eventEnded(s) {return Date.parse(s.date+'T'+s.end+':00+02:00')<=Date.parse(state.now);}
function reservable(s) {return s.active&&!s.cancelled&&new Date(s.date+'T'+s.start+':00+02:00')>new Date(state.now);}
function canCorporateChange(b) {return ownsBooking(b)&&isOpen(b)&&!eventStarted(slot(b.slotId))&&!b.amendment&&!b.cancellation;}
// Keep the submitted billing/contact record; profile edits only affect future requests.
function contactSnapshot(c) {return Object.fromEntries(['name','contact','email','phone','address'].map(key=>[key,c[key]]));}
function validDeadline(deadline,s) {return !!s&&Number.isFinite(Date.parse(deadline))&&Date.parse(deadline)>Date.parse(state.now)&&Date.parse(deadline)<Date.parse(s.date+'T'+s.start+':00+02:00');}
function notify(message) {clearTimeout(toastTimer);$('toast').textContent=message;toastTimer=setTimeout(()=>$('toast').textContent='',5500);}
function addNotice(role,companyId,title,message,target) {state.notifications.push({id:state.notifications.length+1,role,companyId,title,message,read:false,target});}
function log(action,record,detail) {const row=/^GR-\d+$/.test(record)?booking(Number(record.slice(3))):null;state.audit.unshift({when:state.now,actor:session?.role==='admin'?'Demo administrator':company()?.contact||'Demo user',actorRole:session?.role||'guest',companyId:row?.companyId||session?.companyId||null,status:row?.status||'',action,record,detail});}
function badge(b) {const status=typeof b==='string'?b:b.status;return `<span class="badge ${status.startsWith('Pending')?'payment':status==='Requested'||status==='Awaiting approval'?'pending':status==='Rejected'||status==='Cancelled'?'declined':status==='Confirmed'||status==='Approved'?'':'neutral'}">${esc(status)}</span>${typeof b==='object'&&isOverdue(b)?' <span class="badge overdue">Overdue</span>':''}${b.amendment?' <span class="badge change">Change requested</span>':''}${b.cancellation?' <span class="badge change">Cancellation requested</span>':''}`;}
function fields(items) {return items.map(([label,name,type,value,required=true])=>`<label>${label}<input name="${name}" type="${type}" value="${esc(value||'')}" ${required?'required':''} ${type==='tel'?'pattern="[+0-9() .-]{7,25}" title="Enter a cellphone number, including country code where possible"':''} ${type==='password'?'minlength="8" autocomplete="new-password"':'maxlength="180"'}></label>`).join('');}
function options(rows,current) {return rows.map(([value,label])=>`<option value="${esc(value)}" ${String(value)===String(current)?'selected':''}>${esc(label)}</option>`).join('');}
function head(title,description,action='') {return `<div class="pagehead row between"><div><h1>${title}</h1><p class="muted">${description}</p></div>${action}</div>`;}
function stat(title,value,caption) {return `<section class="card stat"><small>${title}</small><div class="big-number">${value}</div><small>${caption}</small></section>`;}
function detail(label,value) {return `<div class="detail"><span>${label}</span><strong>${value}</strong></div>`;}
function form(id,body,submit='Save') {return `<form id="${id}"><div class="fields">${body}</div><div id="form-error" class="alert error" hidden role="alert"></div><button class="btn primary section-gap" type="submit">${submit}</button></form>`;}
function error(message) {dirtyForm=true;$('form-error').hidden=false;$('form-error').textContent=message;}
function bind(id,handler) {if($(id))$(id).onsubmit=e=>{
  e.preventDefault();const data=new FormData(e.currentTarget);
  const important=['deadline-form','payment-form','reject-booking','reject-account','reconsider-account','event-edit','event-cancel','cancel-review','additional-payment','completion-form'];
  if(important.includes(id)&&!ask('Confirm this decision? It will update the simulated record, notifications and action history.'))return;
  dirtyForm=false;handler(data);
};}
function ask(message) {return typeof window.confirm==='function'?window.confirm(message):true;}
function discardChanges() {if(dirtyForm&&!ask('You have unsaved changes. Discard them and continue?'))return false;dirtyForm=false;return true;}
function closePreviewDialog() {if(discardChanges())$('dialog').close();}
function showDialog(title,body) {if(!discardChanges())return;$('dialog').innerHTML=`<div class="cardhead"><h2 id="dialog-title">${title}</h2><button class="btn close" aria-label="Close dialog" onclick="closePreviewDialog()">×</button></div><div class="body">${body}</div>`;if(!$('dialog').open)$('dialog').showModal();}
function closeRefresh(message) {dirtyForm=false;$('dialog').close();render();notify(message);}
function emailLink(email,label='Email contact') {return `<a class="info-link" href="mailto:${esc(email)}">${label}</a>`;}
function phoneLink(phone) {return `<a class="info-link" href="tel:${esc(phone.replace(/[^+0-9]/g,''))}">Call contact</a>`;}
function contactCard(c) {return `<div class="contactblock">${detail('Main point of contact',esc(c.contact))}${detail('Email',esc(c.email))}${detail('Phone',esc(c.phone))}${detail('Billing address',esc(c.address))}<div class="row section-gap">${emailLink(c.email)}${phoneLink(c.phone)}</div><p class="muted section-gap">External email / phone links. These are fictional details; no message is sent by the preview.</p></div>`;}
function showContact() {const c=state.bookingContact;showDialog('Contact Ladles',`${detail('Email',c.email?esc(c.email):'Contact details not yet provided')}${detail('Phone',c.phone?esc(c.phone):'Contact details not yet provided')}<div class="row section-gap">${c.email?emailLink(c.email,'Email booking team'):''}${c.phone?phoneLink(c.phone):''}</div><div class="note">Payment communication happens externally. Admin must configure approved contact details before opening real corporate bookings. No message is sent by this preview.</div>`);}
function setAuth(mode) {if(!discardChanges())return;businessIdentity=null;authMode=mode;resetPreviewStage='';render();}
function startBusinessRegistration() {
  if(session?.role!=='volunteer'||!discardChanges())return;
  const v=state.volunteers.find(v=>v.id===session.volunteerId),membership=state.companies.find(c=>c.ownerVolunteerId===v.id);
  if(membership){session={role:'corporate',companyId:membership.id};page='dashboard';render();return;}
  businessIdentity={id:v.id,email:v.email};session=null;authMode='business';render();
}
function switchToVolunteer() {const c=company();if(session?.role!=='corporate'||!c?.ownerVolunteerId||!discardChanges())return;session={role:'volunteer',volunteerId:c.ownerVolunteerId};page='dashboard';render();}
function loginScreen() {
  if(resetPreviewStage)return recoveryScreen();
  const signup=authMode==='signup',business=authMode==='business';
  return `<section class="auth"><div class="brand"><img src="../public/Ladles-logo.png" alt="Ladles of Love"><div><strong>LADLES OF LOVE</strong><div class="eyebrow">VOLUNTEER PORTAL</div></div></div><div class="auth-tabs" aria-label="Account access">${[['signin','Sign in'],['signup','Create account'],['business','Business registration']].map(([m,l])=>`<button aria-pressed="${m===authMode}" class="${m===authMode?'active':''}" onclick="setAuth('${m}')">${l}</button>`).join('')}</div><span class="eyebrow">${business?'Company & group volunteering':signup?'Join the community':'Your next act of kindness starts here'}</span><h1>${business?'Register your organisation':signup?'Start making a difference':'Welcome back'}</h1><p class="muted" style="margin-bottom:24px">${business?'One main contact. Your account is reviewed before you can request a team build.':signup?'Create your volunteer account. A cellphone number is required.':'Manage your shifts and view your impact.'}</p>${form('auth-form',
    business?fields([['Company / organisation','company','text',''],['Main point of contact','contact','text',''],['Email address','email','email',businessIdentity?.email||''],['Phone number','phone','tel',''],['Billing street address','street','text',''],['City','city','text',''],['Postal code','postcode','text',''],...(businessIdentity?[]:[['Password (demo only)','password','password','']])])+`<div class="note full">${businessIdentity?'Using your signed-in demo identity. Keep the same login email; your volunteer profile and bookings stay unchanged.':'Already a volunteer? Sign in first, then choose Register / open business account on your dashboard. One login can access separate volunteer and corporate workspaces.'}</div>`:
    signup?fields([['Full name','name','text',''],['Date of birth','dob','date',''],['Cellphone number','phone','tel',''],['Email address','email','email',''],['Password (demo only)','password','password','']]):
    fields([['Email address','email','email','alex@example.invalid'],['Password (demo only)','password','password','DemoOnly123']]),business?'Register business →':signup?'Create account →':'Sign in →')}
    ${authMode==='signin'?'<button class="btn section-gap" onclick="startRecovery()">Forgot password?</button><div class="note">Demo sign-in: alex@example.invalid opens the approved corporate account; admin@example.invalid opens administration; volunteer@example.invalid opens the volunteer preview. Newly registered corporate emails also work. Any 8+ character demo password is accepted.</div>':'<div class="note">Simulation only. No account or password is stored outside this page. Use fictional contact details.</div>'}<p class="smallprint">Your time matters. Thank you for choosing to give it.</p></section>`;
}
function handleAuth(data) {
  const email=String(data.get('email')).trim().toLowerCase();
  if(authMode==='business') {
    if(state.companies.some(c=>(c.loginEmail||c.email).toLowerCase()===email)){error('This demo email already has an account. Sign in instead.');return;}
    const existing=state.volunteers.find(v=>v.email.toLowerCase()===email);
    if(businessIdentity&&email!==businessIdentity.email.toLowerCase()){error('Keep your existing login email when adding business access.');return;}
    if(existing&&businessIdentity?.id!==existing.id){error('Sign in to your existing volunteer account first, then choose Register / open business account. No second login is created.');return;}
    const c={id:state.nextCompany++,name:String(data.get('company')).trim(),contact:String(data.get('contact')).trim(),email,phone:String(data.get('phone')).trim(),address:[data.get('street'),data.get('city'),data.get('postcode')].join(', '),status:'Awaiting approval',emailVerified:false,ownerVolunteerId:existing?.id||null};
    businessIdentity=null;
    state.companies.push(c);session={role:'corporate',companyId:c.id};page='dashboard';log('Corporate account requested',c.name,'Main contact, phone and billing address submitted.');addNotice('admin',null,'Corporate account awaiting approval',c.name+' has registered. Review its contact and billing details.',{kind:'company',id:c.id});render();return;
  }
  if(authMode==='signup') {
    if(state.volunteers.some(v=>v.email===email)){error('This demo email already exists.');return;}
    if(String(data.get('dob'))>localInput().slice(0,10)){error('Date of birth cannot be in the future.');return;}
    const v={id:state.volunteers.length+1,name:String(data.get('name')).trim(),email,phone:String(data.get('phone')).trim(),dob:String(data.get('dob')),joined:state.now.slice(0,10),bookings:0,hours:0};state.volunteers.push(v);session={role:'volunteer',volunteerId:v.id};page='dashboard';render();return;
  }
  if(email==='admin@example.invalid'){demoLogin('admin');return;}
  const c=state.companies.find(c=>(c.loginEmail||c.email).toLowerCase()===email);if(c){session={role:'corporate',companyId:c.id};page='dashboard';render();return;}
  const v=state.volunteers.find(v=>v.email.toLowerCase()===email);if(v){session={role:'volunteer',volunteerId:v.id};page='dashboard';render();return;}
  error('Use one of the listed demo emails, or register a demo account.');
}
function demoLogin(role) {if(!discardChanges())return;session=role==='admin'?{role:'admin'}:{role:'corporate',companyId:state.companies[state.companies.length-1].id};if(role==='corporate'&&state.companies.length===2)session.companyId=1;page='dashboard';$('dialog').close();render();}
function logout() {if(!discardChanges())return;session=null;authMode='signin';resetPreviewStage='';$('dialog').close();render();}
function navigate(next) {if(!discardChanges())return;const adminPages=['corporate','availability','contact','directory','activity','implementation'];if(session?.role!=='admin'&&adminPages.includes(next)){notify('Admin-only screen. No company records opened.');return;}if(session?.role==='corporate'&&next==='book'&&(!company().emailVerified||company().status!=='Approved'))next='dashboard';if(next==='book')draft.requestKey='request-'+submitSequence++;page=next;render();window.scrollTo({top:0,behavior:'instant'});}
function startRecovery() {if(!discardChanges())return;session=null;resetPreviewStage='request';render();}
function recoveryScreen() {
  const intro='<div class="note">Mock flow only: no emails sent, no secure tokens generated, and no passwords stored or changed. Backend authentication configuration is still required. Use fictional values.</div>';
  let body='';
  if(resetPreviewStage==='request')body=form('recovery-request',fields([['Corporate login email','email','email',resetPreviewEmail]]),'Request reset link');
  if(resetPreviewStage==='sent')body='<div class="note success">If an account exists for that email, a password reset link will be sent.</div><div class="row"><button class="btn primary" onclick="openDemoReset(false)">Simulate valid reset link</button><button class="btn" onclick="openDemoReset(true)">Simulate expired link</button></div>';
  if(resetPreviewStage==='expired')body='<div class="alert error">Reset link is invalid, expired or already used. Request a new link.</div><button class="btn" onclick="startRecovery()">Request another link</button>';
  if(resetPreviewStage==='valid')body=form('recovery-password',fields([['New password (fictional demo value)','password','password',''],['Confirm password','confirm','password','']]),'Simulate saving password');
  if(resetPreviewStage==='done')body='<div class="note success">Password-reset success screen (simulation). No actual password was changed. Sign in using the demo access instructions.</div>';
  return '<section class="auth"><h1>Password recovery</h1>'+intro+body+'<button class="btn section-gap" onclick="setAuth(\'signin\')">Back to sign in</button></section>';
}
function openDemoReset(expired) {if(!discardChanges())return;resetPreviewStage=expired?'expired':'valid';render();}
function requestDemoReset(data) {const email=String(data.get('email')||'').trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){error('Enter a valid email address.');return;}resetPreviewEmail=email;resetPreviewStage='sent';render();}
function saveDemoPassword(data) {const password=String(data.get('password')||'');if(resetPreviewStage!=='valid')return;if(password.length<8||password!==String(data.get('confirm'))){error('Use matching fictional passwords of at least eight characters.');return;}resetPreviewStage='done';render();}
function verificationScreen() {return head('Verify your business email','Email verification and admin approval are separate requirements.')+`<section class="card"><div class="body"><h2>Check your inbox</h2><p class="muted">Corporate login email: ${esc(company().loginEmail||company().email)}</p><div class="note">No real message is sent. A production verification link must be issued and checked by the authentication service. An admin cannot verify an email on your behalf.</div><div class="row"><button class="btn" onclick="resendDemoVerification()">Resend verification email (demo)</button><button class="btn primary" onclick="verifyDemoEmail()">Simulate valid verification link</button><button class="btn" onclick="notify('Verification link expired or invalid. Please resend it.')">Simulate expired link</button></div></div></section>`;}
function resendDemoVerification() {if(session?.role==='corporate')notify('Demo: verification email would be resent with rate limiting. No real email sent.');}
function verifyDemoEmail() {if(session?.role!=='corporate'||company().emailVerified)return;company().emailVerified=true;log('Corporate email verified',company().name,'Simulated verification link, not proof of real email ownership.');addNotice('admin',null,'Corporate email verified',company().name+' can now be reviewed for approval.',{kind:'company',id:company().id});render();notify('Demo email verified. Admin approval is still required.');}
function visibleNotices() {return state.notifications.filter(n=>n.role===session.role&&(session.role!=='corporate'||n.companyId===session.companyId));}
function shell(content) {
  const admin=session.role==='admin',corporate=session.role==='corporate';
  const links=admin?[['dashboard','▦','Dashboard'],['directory','♙','Volunteer directory'],['corporate','▥','Corporate bookings'],['availability','▣','Corporate events'],['contact','✉','Booking contact'],['notifications','♧','Notifications'],['activity','↗','Recent activity'],['implementation','☑','Backend checklist']]:corporate?[['dashboard','▦','My dashboard'],['book','▣','Browse corporate events'],['notifications','♧','Notifications'],['account','♙','Business profile']]:[['dashboard','▦','Home'],['account','♙','My profile']];
  const identity=admin?{name:'Demo administrator',email:'admin@example.invalid'}:corporate?{name:company().contact,email:company().email}:state.volunteers.find(v=>v.id===session.volunteerId);
  return `<div class="shell"><aside><div class="brand"><img src="../public/Ladles-logo.png" alt="Ladles of Love"><div><strong>LADLES OF LOVE</strong><div class="eyebrow">${admin?'ADMINISTRATION':corporate?'CORPORATE PORTAL':'VOLUNTEER PORTAL'}</div></div></div><div class="nav-label">${admin?'ADMIN WORKSPACE':'MY WORKSPACE'}</div><nav class="nav">${links.map(([id,icon,label])=>`<button onclick="navigate('${id}')" class="${page===id?'active':''}" ${page===id?'aria-current="page"':''}><span aria-hidden="true">${icon}</span> ${label}${id==='notifications'?' · '+visibleNotices().filter(n=>!n.read).length:''}</button>`).join('')}</nav><div class="aside-note">Small actions.<br><strong>Lasting community impact.</strong><div class="note blueprint">Only new workflow screens are simulated here. Existing events, analytics and attendance remain unchanged in the actual application.</div></div></aside><div class="workspace"><header><span>${admin?'Workspace':corporate?'Corporate portal':'Volunteer portal'} / ${links.find(l=>l[0]===page)?.[2]||'Preview'}</span><div class="row"><button class="btn" onclick="document.body.classList.toggle('dark')">☼ Theme</button><span class="avatar">${admin?'DA':'AM'}</span><div><strong>${esc(identity.name)}</strong><p class="muted">${esc(identity.email)}</p></div><button class="btn" onclick="logout()">Sign out</button></div></header><main>${content}</main></div></div>`;
}
function dashboard() {
  if(session.role==='admin')return head('Dashboard','Corporate decisions and volunteer contact details.')+
    `<div class="grid stats four">${stat('Accounts awaiting approval',state.companies.filter(c=>c.status==='Awaiting approval').length,'Review registrations')}${stat('Booking requests',state.bookings.filter(b=>b.status==='Requested').length,'No places held yet')}${stat('Overdue payments',state.bookings.filter(isOverdue).length,'Contact, extend or reject')}${stat('Registered volunteers',state.volunteers.length,'Search contact details')}</div>
    ${!state.bookingContact.email&&!state.bookingContact.phone?'<div class="alert">Corporate booking contact is not configured. <button class="btn" onclick="navigate(\'contact\')">Configure contact</button></div>':''}
    <div class="grid split"><section class="card"><div class="cardhead"><h2>Requests & follow-ups</h2><button class="btn" onclick="navigate('corporate')">View all</button></div>${bookingTable(state.bookings.filter(b=>isOpen(b)&&(b.status!=='Confirmed'||b.amendment||b.cancellation)))}</section>
    <section class="card"><div class="body"><h2>Corporate booking workflow</h2><div class="timeline"><p><strong>Approve the business account</strong><br><small>Review contact and billing details.</small></p><p><strong>Publish a corporate-only event</strong><br><small>Define its details, limits and capacity. No WMS link.</small></p><p><strong>Accept a request</strong><br><small>Recheck capacity, reserve places and set a payment deadline.</small></p><p><strong>Record payment and confirm</strong><br><small>Review changes and cancellations; keep external follow-up notes.</small></p></div><button class="btn primary section-gap" onclick="corporateTab='accounts';navigate('corporate')">Review corporate accounts</button></div></section></div>`;
  if(session.role==='volunteer'){const v=state.volunteers.find(v=>v.id===session.volunteerId);return head('Welcome back','Individual volunteering stays separate from corporate events.',`<button class="btn" onclick="startBusinessRegistration()">Register / open business account</button>`)+`<section class="card"><div class="body"><h2>Your contact details</h2><p class="muted">${v.phone?'Your cellphone is saved.':'Add a cellphone before your next new booking. Existing bookings, attendance and cancellation remain accessible.'}</p><div class="row section-gap"><button class="btn primary" onclick="simulateVolunteerBooking()">Try new booking (demo)</button><button class="btn" onclick="navigate('account')">View my profile</button></div><div class="note">This is a contact-policy demonstration, not a replacement volunteer booking system. No corporate capacity or WMS data changes.</div></div></section>`;}
  if(!company().emailVerified)return verificationScreen();
  const c=company(),rows=state.bookings.filter(b=>b.companyId===c.id);
  if(c.status!=='Approved')return head('Business account','Your organisation’s access to group booking.')+`<section class="card"><div class="body">${badge(c.status)}<h2 class="section-gap">${c.status==='Rejected'?'Your account was not approved':'Your account is awaiting review'}</h2><p class="muted">${c.status==='Rejected'?esc(c.reason):'Ladles will review your main contact details and billing address. Booking is available only after approval.'}</p><div class="row section-gap"><button class="btn" onclick="navigate('account')">View submitted details</button><button class="btn" onclick="showContact()">Contact Ladles</button></div><div class="note">For review: use “Demo admin” above, open Corporate bookings → Account approvals, approve this company, then use “Demo corporate” to return.</div></div></section>`;
  return head('Your corporate dashboard','Corporate-only events, payment deadlines and booking updates.',`<button class="btn primary" onclick="navigate('book')">Browse corporate events →</button>`)+`<div class="grid stats">${stat('Booking requests',rows.filter(b=>b.status==='Requested').length,'Not reserved until accepted')}${stat('Pending payment',rows.filter(b=>b.status.startsWith('Pending')).length,'Includes additional payment')}${stat('Confirmed bookings',rows.filter(b=>b.status==='Confirmed').length,'Admin has recorded payment')}</div>${rows.some(isOverdue)?'<div class="alert error">You have an overdue payment. Your places remain held; the booking is not automatically cancelled.</div>':''}<section class="card"><div class="cardhead"><h2>My group bookings</h2><button class="btn" onclick="showContact()">Contact Ladles</button></div>${bookingTable(rows)}</section>`;
}
function bookingTable(rows,filtered=true) {
  rows=rows.filter(b=>session?.role==='admin'||session?.role==='corporate'&&b.companyId===session.companyId&&company()?.emailVerified);
  if(filtered)return listView('bookings',rows,b=>[b.id,company(b.companyId)?.name,company(b.companyId)?.contact,activities[slot(b.slotId)?.activity]?.name,b.status].join(' '),b=>b.status,items=>bookingTable(items,false),b=>slot(b.slotId).date);
  if(!rows.length)return '<div class="blank">No bookings in this view yet.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>Company / MPC</th><th>Corporate event</th><th>Group</th><th>Status</th><th>Payment deadline</th><th></th></tr></thead><tbody>${rows.map(b=>{const c=company(b.companyId),s=slot(b.slotId);return `<tr><td><strong>${esc(c.name)}</strong><small>${esc(c.contact)}</small></td><td>${esc(activities[s.activity].name)}<br><small>${dateLabel(s.date)} · ${s.start}–${s.end}</small></td><td>${b.size}</td><td>${badge(b)}</td><td>${b.status.startsWith('Pending')?saTime(b.deadline):'—'}</td><td><button class="btn" onclick="openBooking(${b.id})">${session.role==='admin'?'Review':'Details'}</button></td></tr>`;}).join('')}</tbody></table></div>`;
}
function adminBookingCalendar() {
  const [year,month]=calendarMonth.split('-').map(Number),offset=(new Date(Date.UTC(year,month-1,1)).getUTCDay()+6)%7,days=new Date(Date.UTC(year,month,0)).getUTCDate();
  let cells=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>`<div class="weekday">${d}</div>`).join('')+'<div></div>'.repeat(offset);
  for(let day=1;day<=days;day++){const date=calendarMonth+'-'+String(day).padStart(2,'0');cells+=`<div class="day admin-day"><strong>${day}</strong>${state.bookings.filter(b=>isOpen(b)&&slot(b.slotId).date===date).map(b=>`<button onclick="openBooking(${b.id})">${esc(company(b.companyId).name)}<br>${slot(b.slotId).start} · ${b.size} people<br>${esc(b.status)}${isOverdue(b)?' · Overdue':''}</button>`).join('')}</div>`;}
  return `<section class="card"><div class="cardhead"><h2>Corporate booking calendar</h2><div class="row"><button class="btn" aria-label="Previous month" onclick="changeMonth(-1)">‹</button><strong>${new Date(calendarMonth+'-01T12:00:00+02:00').toLocaleDateString('en-ZA',{month:'long',year:'numeric',timeZone:'Africa/Johannesburg'})}</strong><button class="btn" aria-label="Next month" onclick="changeMonth(1)">›</button></div></div><div class="body"><div class="calendar">${cells}</div><p class="muted section-gap">Select a booking to review its company, MPC, group size and status. Rejected requests remain in the table below.</p></div></section>`;
}
function corporateScreen() {
  if(session?.role!=='admin')return '<p class="blank">Admin-only screen.</p>';
  const count=state.companies.filter(c=>c.status==='Awaiting approval').length;
  return head('Corporate bookings','Review verified business accounts, requests and external payments.')+`<div class="tabs"><button class="${corporateTab==='requests'?'active':''}" onclick="switchCorporateTab('requests')">Booking requests</button><button class="${corporateTab==='accounts'?'active':''}" onclick="switchCorporateTab('accounts')">Account approvals · ${count}</button></div>`+(corporateTab==='requests'?adminBookingCalendar()+'<section class="card section-gap"><div class="cardhead"><h2>All group bookings</h2><span class="muted">History retained</span></div>'+bookingTable(state.bookings)+'</section>':listView('accounts',state.companies,c=>[c.name,c.contact,c.email,c.phone].join(' '),c=>c.status,rows=>'<section class="card"><div class="table-wrap"><table><thead><tr><th>Organisation</th><th>Main contact</th><th>Email verification</th><th>Status</th><th></th></tr></thead><tbody>'+rows.map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.contact)}<br>${esc(c.email)}</td><td>${c.emailVerified?'Verified (demo)':'Not verified'}</td><td>${badge(c.status)}</td><td><button class="btn" onclick="openCompany(${c.id})">Review account</button></td></tr>`).join('')+'</tbody></table></div></section>'));
}
function switchCorporateTab(tab) {if(session?.role!=='admin'||!discardChanges())return;corporateTab=tab;render();}
function filteredList(key,rows,text,status,date=null) {
  const q=listState[key]||={query:'',status:'',from:'',to:'',page:1,size:3};
  const statuses=[...new Set(rows.map(status))];
  const selected=rows.filter(row=>text(row).toLowerCase().includes(q.query.toLowerCase())&&(!q.status||status(row)===q.status)&&(!date||(!q.from||date(row)>=q.from)&&(!q.to||date(row)<=q.to)));
  const pages=Math.max(1,Math.ceil(selected.length/q.size));q.page=Math.min(pages,Math.max(1,q.page));
  const tools=`<div class="toolbar list-tools"><label>Search ${key}<input type="search" value="${esc(q.query)}" placeholder="Search ${key}…" onchange="setListFilter('${key}','query',this.value)"></label><label>Status<select onchange="setListFilter('${key}','status',this.value)">${options([['','All statuses'],...statuses.map(s=>[s,s])],q.status)}</select></label>${date?`<label>From date<input type="date" value="${esc(q.from)}" onchange="setListFilter('${key}','from',this.value)"></label><label>To date<input type="date" value="${esc(q.to)}" onchange="setListFilter('${key}','to',this.value)"></label>`:''}<label>Per page<select onchange="setListFilter('${key}','size',this.value)">${options([[3,'3'],[10,'10'],[25,'25']],q.size)}</select></label><button class="btn" onclick="clearListFilter('${key}')">Clear filters</button></div>`;
  const footer=`<div class="row between list-footer"><span class="muted" role="status">${selected.length} results · Page ${q.page} of ${pages}</span><div class="row"><button class="btn" ${q.page===1?'disabled':''} onclick="changeListPage('${key}',-1)">Previous</button><button class="btn" ${q.page===pages?'disabled':''} onclick="changeListPage('${key}',1)">Next</button></div></div>`;
  return {rows:selected.slice((q.page-1)*q.size,q.page*q.size),tools,footer,total:selected.length};
}
function listView(key,rows,text,status,body,date=null) {const view=filteredList(key,rows,text,status,date);return view.tools+(view.total?body(view.rows):'<p class="blank">No matching results.</p>')+view.footer;}
function setListFilter(key,field,value) {if(!listState[key]||!discardChanges())return;if(!['query','status','from','to','size'].includes(field))return;listState[key][field]=field==='size'?([3,10,25].includes(Number(value))?Number(value):3):String(value);listState[key].page=1;refreshListScreen();}
function clearListFilter(key) {if(!discardChanges())return;delete listState[key];refreshListScreen();}
function changeListPage(key,delta) {if(!listState[key]||!discardChanges())return;listState[key].page+=delta;refreshListScreen();}
function refreshListScreen() {if($('dialog').open&&$('dialog').innerHTML.includes('Group booking'))$('dialog').close();render();}
function openCompany(id) {
  if(session?.role!=='admin')return;
  const c=company(id);if(!c)return;showDialog('Corporate account · '+esc(c.name),`${badge(c.status)}<div class="note">Email verification: ${c.emailVerified?'Verified (demo)':'Not verified — approval blocked'}</div>${contactCard(c)}${c.status==='Awaiting approval'?`<div class="row section-gap"><button class="btn primary" ${c.emailVerified?'':'disabled'} onclick="approveCompany(${id})">Approve corporate account</button><button class="btn" onclick="rejectCompanyDialog(${id})">Reject account</button></div>`:`${c.status==='Rejected'?`<button class="btn section-gap" onclick="reconsiderCompanyDialog(${id})">Reconsider existing account</button>`:''}<div class="note">Account review is complete. Booking rejection does not revoke an approved account. Rejected applicants can contact Ladles externally for reconsideration using the same account.</div>`}`);
}
function approveCompany(id) {if(session?.role!=='admin')return;const c=company(id);if(!c||c.status!=='Awaiting approval')return;if(!c.emailVerified){notify('Corporate contact must verify their email first.');return;}if(!ask('Approve this corporate account and enable booking requests?'))return;c.status='Approved';log('Corporate account approved',c.name,'Awaiting approval → Approved. Email verified; group booking access enabled.');addNotice('corporate',id,'Business account approved','You can now choose an available date and request a team build.',{kind:'page',page:'book'});closeRefresh('Corporate account approved.');}
function rejectCompanyDialog(id) {
  const c=company(id);if(session?.role!=='admin'||c?.status!=='Awaiting approval')return;
  showDialog('Reject corporate account',form('reject-account',`<label class="full">Reason<textarea name="reason" required maxlength="800"></textarea></label>`,'Reject account'));
  bind('reject-account',data=>{if(session?.role!=='admin'||c.status!=='Awaiting approval')return;const reason=String(data.get('reason')||'').trim();if(!reason){error('Enter a reason.');return;}c.status='Rejected';c.reason=reason;log('Corporate account rejected',c.name,c.reason);addNotice('corporate',id,'Account not approved',c.reason+' Contact Ladles externally to request reconsideration; keep this account.',{kind:'page',page:'account'});closeRefresh('Account rejected; applicant notified in the demo.');});
}
function reconsiderCompanyDialog(id) {
  const c=company(id);if(session?.role!=='admin'||c?.status!=='Rejected')return;
  showDialog('Reconsider existing corporate account',form('reconsider-account','<label class="full">External discussion / reason for reconsideration<textarea name="reason" required maxlength="800"></textarea></label>','Return to account review'));
  bind('reconsider-account',data=>{if(session?.role!=='admin'||c.status!=='Rejected')return;const reason=String(data.get('reason')||'').trim();if(!reason){error('Enter a reason.');return;}c.status='Awaiting approval';log('Corporate account reopened',c.name,'Rejected → Awaiting approval. '+reason);addNotice('corporate',id,'Account review reopened','Your existing account is being reconsidered. Approval is still required.',{kind:'page',page:'account'});closeRefresh('Existing account returned to review; no duplicate registration.');});
}
function calendar() {
  const [year,month]=calendarMonth.split('-').map(Number),offset=(new Date(Date.UTC(year,month-1,1)).getUTCDay()+6)%7,days=new Date(Date.UTC(year,month,0)).getUTCDate();
  let html=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>`<div class="weekday">${d}</div>`).join('')+'<div></div>'.repeat(offset);
  const chosen=slot(draft.slotId);for(let d=1;d<=days;d++){const date=calendarMonth+'-'+String(d).padStart(2,'0'),candidates=state.slots.filter(s=>s.activity===draft.activity&&s.date===date&&reservable(s)&&remaining(s.id)>=s.min),selected=chosen?.date===date&&chosen.activity===draft.activity;html+=`<button class="day ${selected?'selected':''}" ${!candidates.length?'disabled':''} aria-pressed="${selected}" onclick="selectSlot(${candidates[0]?.id||0})"><strong>${d}</strong><small>${candidates.length?'Available':'Unavailable'}</small></button>`;}return `<div class="calendar">${html}</div>`;
}
function changeMonth(delta) {if(!discardChanges())return;const [year,month]=calendarMonth.split('-').map(Number);calendarMonth=new Date(Date.UTC(year,month-1+delta,1)).toISOString().slice(0,7);draft.slotId=state.slots.find(s=>s.activity===draft.activity&&s.date.startsWith(calendarMonth)&&reservable(s)&&remaining(s.id)>=s.min)?.id||0;render();}
function selectActivity(index) {if(!activities[index]||!discardChanges())return;draft.activity=index;draft.slotId=state.slots.find(s=>s.activity===index&&reservable(s)&&remaining(s.id)>=s.min)?.id||0;if(slot(draft.slotId))calendarMonth=slot(draft.slotId).date.slice(0,7);render();}
function selectSlot(id,control=null) {const s=slot(id);if(!s||s.activity!==draft.activity||!reservable(s)||!discardChanges()){if(control)control.value=String(draft.slotId);return;}draft.slotId=s.id;render();}
function bookingScreen() {
  if(session?.role!=='corporate')return '<p class="blank">Corporate-only screen.</p>';
  if(!company().emailVerified)return verificationScreen();
  if(company().status!=='Approved')return dashboard();
  const s=slot(draft.slotId),sameDate=s?state.slots.filter(t=>t.activity===draft.activity&&t.date===s.date&&reservable(t)&&remaining(t.id)>=t.min):[];
  const published=activities.map((a,i)=>({a,i})).filter(({i})=>state.slots.some(t=>t.activity===i&&reservable(t)));
  return head('Find a corporate opportunity','Admin-published events only. Separate from individual volunteering and WMS.')+
    `<h2>1. Choose a corporate event</h2><div class="grid activities section-gap">${published.map(({a,i})=>`<button class="activity ${draft.activity===i?'selected':''}" onclick="selectActivity(${i})" aria-pressed="${draft.activity===i}"><span class="symbol">${a.icon}</span><strong>${esc(a.name)}</strong><small>${esc(a.description)}<br>${esc(a.venue)}</small></button>`).join('')||'<p>No published corporate events yet.</p>'}</div>
    <div class="grid split"><div class="grid"><section class="card"><div class="cardhead"><h2>2. Choose a date and time</h2><div class="row"><button class="btn" onclick="changeMonth(-1)" aria-label="Previous month">‹</button><strong>${esc(calendarMonth)}</strong><button class="btn" onclick="changeMonth(1)" aria-label="Next month">›</button></div></div><div class="body">${calendar()}${s?`<label class="section-gap">Available time<select onchange="selectSlot(Number(this.value),this)">${options(sameDate.map(t=>[t.id,t.start+'–'+t.end+' · '+remaining(t.id)+' available']),s.id)}</select></label>`:'<div class="note">No available dates for the selected event.</div>'}<p class="muted section-gap">South African time. Availability may change before admin accepts.</p></div></section>
    <section class="card"><div class="cardhead"><h2>3. Group details</h2></div><div class="body">${form('request-form',fields([['Group size','size','number',draft.size]])+`<label class="full">Notes (optional)<textarea name="notes" maxlength="800">${esc(draft.notes)}</textarea></label>`,'Review request →')}</div></section></div>
    <section class="card summary"><div class="body"><div class="eyebrow">Request summary</div><h2 class="section-gap">${esc(activities[draft.activity]?.name||'Choose an event')}</h2>${detail('Company',esc(company().name))}${s?detail('Date',dateLabel(s.date))+detail('Time',s.start+'–'+s.end)+detail('Group limits',s.min+'–'+s.max)+detail('Places currently available',remaining(s.id)):''}<div class="note">Contact and billing information comes from your business profile.</div><p class="muted">Request → Admin accepts and reserves places → Pending payment → Confirmed</p><div class="note blueprint">Submitting a request does not reserve places. Overdue accepted bookings retain their places until admin rejects or approves cancellation. Corporate capacity is entirely separate from volunteer events.</div></div></section></div>`;
}
function reviewRequest(data) {
  draft.size=Number(data.get('size'));draft.notes=String(data.get('notes'));const s=slot(draft.slotId);
  if(!fits(s,draft.size)){error('Choose an available corporate event and a whole-number group size within its limits and current capacity.');return;}
  showDialog('Review your booking request',`${detail('Company',esc(company().name))}${detail('Corporate event',esc(activities[s.activity].name))}${detail('Date / time',dateLabel(s.date)+' · '+s.start+'–'+s.end)}${detail('Group size',draft.size)}<div class="note">Submitting reserves no places. Availability is not guaranteed until admin accepts. Payment instructions are discussed externally.</div><button class="btn primary" onclick="submitRequest()">Submit demo request</button>`);
}
function submitRequest() {
  const c=company(),s=slot(draft.slotId);if(session?.role!=='corporate'||!c||!c.emailVerified||c.status!=='Approved'){notify('Verify your email and obtain account approval first.');return;}
  const fingerprint=JSON.stringify([s?.id,draft.size,draft.notes]),key=c.id+':'+draft.requestKey,receipt=requestReceipts.get(key);
  if(receipt){if(receipt.fingerprint===fingerprint){notify('Already submitted as GR-'+receipt.id+'. No duplicate created.');return;}draft.requestKey='request-'+submitSequence++;}
  if(!fits(s,draft.size)){notify('Request cannot be submitted. Check event limits and capacity.');return;}
  if(!ask('Submit this request for admin review? Places are not reserved until acceptance.'))return;
  const b={id:state.nextBooking++,companyId:c.id,contactSnapshot:contactSnapshot(c),slotId:s.id,size:draft.size,notes:draft.notes,status:'Requested',payment:null,amendment:null,requestKey:draft.requestKey};
  requestReceipts.set(c.id+':'+draft.requestKey,{fingerprint,id:b.id});state.bookings.push(b);log('Booking requested','GR-'+b.id,c.name+' · '+b.size+' people · Requested (no places held)');addNotice('admin',null,'New booking request','GR-'+b.id+' · '+c.name+' · '+b.size+' people',{kind:'booking',id:b.id});addNotice('corporate',c.id,'Booking request received','GR-'+b.id+' is under admin review.',{kind:'booking',id:b.id});page='dashboard';closeRefresh('Booking request submitted once. Backend idempotency is still required.');
}
function deadlineText(b) {if(isOverdue(b))return 'Overdue—contact Ladles. Your booking has not been automatically cancelled.';const minutes=Math.ceil((new Date(b.deadline)-new Date(state.now))/60000);return minutes>1440?Math.floor(minutes/1440)+' days '+Math.floor(minutes%1440/60)+' hours remaining':Math.floor(minutes/60)+' hours '+minutes%60+' minutes remaining';}
function openBooking(id) {
  const b=booking(id);if(!canManage(b)&&!ownsBooking(b))return;
  const s=slot(b.slotId),c=company(b.companyId),admin=session.role==='admin';
  const pending=b.status.startsWith('Pending');
  showDialog('Group booking · GR-'+id,`${badge(b)}<h2 class="section-gap">${esc(c.name)}</h2>${detail('Corporate event',esc(activities[s.activity].name))}${detail('Location',esc(activities[s.activity].venue))}${detail('Date / time',dateLabel(s.date)+' · '+s.start+'–'+s.end)}${detail('Group size',b.size+' people')}<div class="note">${esc(b.notes||'No additional notes.')}</div>
    ${b.status==='Requested'?'<div class="note">No places reserved yet. Admin rechecks capacity when accepting. Payment deadlines must be before the event starts.</div>':''}
    ${pending?`<div class="alert ${isOverdue(b)?'error':''}"><strong>${esc(b.status)} · due ${saTime(b.deadline)}</strong><br>${deadlineText(b)}<br>Places remain held. External payment only.${b.additionalAmount?'<br>Additional amount: R '+Number(b.additionalAmount).toFixed(2):''}</div>`:''}
    ${[...(b.paymentHistory||[]),...(b.payment?[b.payment]:[])].map(p=>`<div class="note success"><strong>External payment recorded</strong><br>Reference: ${esc(p.reference)} · Received: ${esc(p.received)}<br>${esc(p.admin)} · ${saTime(p.recordedAt)}<br>${esc(p.note||'')}<br>No financial transaction processed here.</div>`).join('')}
    ${b.reason?`<div class="note">${esc(b.status)}: ${esc(b.reason)}</div>`:''}
    ${b.followup?`<div class="note">Communication / follow-up: ${esc(b.followup)}</div>`:''}
    ${bookingHistory(b)}
    ${s.cancelled?`<div class="alert error">Corporate event cancelled: ${esc(s.cancellationReason)}</div>`:''}
    ${b.completion?`<div class="note success"><strong>Completed · group attendance</strong>${detail('Actual attendees',b.completion.attended+' of '+b.size)}${detail('Total group volunteer hours',b.completion.hours===null?'Not recorded':b.completion.hours)}${detail('Recorded by',esc(b.completion.admin))}${detail('Recorded at',saTime(b.completion.recordedAt))}<p>${esc(b.completion.note)}</p></div>`:''}
    ${b.amendment?amendmentPanel(b):''}
    ${b.cancellation?`<div class="alert"><strong>Cancellation requested</strong><p>${esc(b.cancellation.reason)}</p><p>Original booking and places remain unchanged until approved.</p>${admin?`<div class="row section-gap"><button class="btn primary" onclick="decideCancellation(${id},true)">Approve cancellation</button><button class="btn" onclick="decideCancellation(${id},false)">Decline cancellation</button></div>`:''}</div>`:''}
    <h2 class="section-gap">Contact & billing details at submission</h2>${contactCard(b.contactSnapshot||c)}<p class="muted">Saved with this request. Profile edits do not rewrite this record.</p>
    ${admin?'<h2 class="section-gap">Current company contact</h2>'+contactCard(c):'<button class="btn" onclick="showContact()">Contact Ladles about this booking</button>'}
    ${!admin&&isOpen(b)&&eventStarted(s)?'<div class="note">This event has started. Online changes and cancellation requests are closed; contact Ladles for any operational follow-up.</div>':''}
    <div class="row section-gap">${admin&&b.status==='Requested'&&!eventStarted(s)?`<button class="btn primary" onclick="paymentDeadlineDialog(${id})">Accept request & set deadline</button>`:''}
    ${admin&&pending?`<button class="btn primary" onclick="recordPaymentDialog(${id})">Record payment & confirm</button>${!eventStarted(s)?`<button class="btn" onclick="paymentDeadlineDialog(${id})">Wait / extend deadline</button>`:''}`:''}
    ${admin&&isOpen(b)?`<button class="btn" onclick="rejectBookingDialog(${id})">Reject booking</button>`:''}
    ${admin&&b.status==='Confirmed'&&!s.cancelled&&!b.amendment&&!b.cancellation?eventEnded(s)?`<button class="btn primary" onclick="completeBookingDialog(${id})">Record attendance & complete</button>`:`<button class="btn" onclick="finishDemoEvent(${id})">Demo: advance to after this event</button>`:''}
    ${admin&&b.status==='Completed'?`<button class="btn" onclick="completeBookingDialog(${id})">Correct attendance record</button>`:''}
    ${!admin&&canCorporateChange(b)?`<button class="btn primary" onclick="amendmentDialog(${id})">Request booking change</button><button class="btn" onclick="requestCancellationDialog(${id})">Request cancellation</button>`:''}</div>`);
}
function paymentDeadlineDialog(id) {
  const b=booking(id);if(!canManage(b)||!['Requested','Pending payment','Pending additional payment'].includes(b.status))return;
  if(eventStarted(slot(b.slotId))){notify('Event has started. Record received payment or reject with a reason; deadlines can no longer be extended.');return;}
  showDialog(b.status==='Requested'?'Accept request & reserve places':'Extend payment deadline',form('deadline-form',fields([['Payment due (South African date & time)','deadline','datetime-local',localInput(b.deadline||new Date(new Date(state.now).getTime()+7*86400000))]])+`<label class="full">Follow-up / communication note<textarea name="note" required maxlength="800"></textarea></label><p class="muted full">Deadline must be strictly before the event starts. Acceptance reserves places only if capacity still permits. Contact details must be configured before real bookings open.</p>`,'Save deadline'));
  bind('deadline-form',data=>{
    if(!canManage(b)||!['Requested','Pending payment','Pending additional payment'].includes(b.status))return;
    const deadline=String(data.get('deadline'))+':00+02:00';
    if(!validDeadline(deadline,slot(b.slotId))||!String(data.get('note')||'').trim()){error('Choose a future deadline strictly before the event starts and enter a communication note. After the start, record received payment or reject with a reason; do not extend the deadline.');return;}
    if(b.status==='Requested'&&!fits(slot(b.slotId),b.size,b.id)){error('Cannot accept: the event is closed, its limits changed, or capacity is no longer sufficient.');return;}
    b.deadline=deadline;if(b.status==='Requested')b.status='Pending payment';b.followup=String(data.get('note'));
    log('Payment deadline set','GR-'+id,saTime(deadline)+' · '+b.followup);addNotice('corporate',b.companyId,'Payment deadline set','GR-'+id+' · Due '+saTime(deadline)+'. Places are reserved; payment communication is external.',{kind:'booking',id});closeRefresh('Deadline saved. Accepted booking places remain reserved.');
  });
}
function recordPaymentDialog(id) {
  const b=booking(id);if(!canManage(b)||!b.status.startsWith('Pending'))return;
  showDialog('Record external payment & confirm booking',form('payment-form',fields([['Payment reference / receipt identifier','reference','text',''],['Date payment received','received','date',localInput().slice(0,10)]])+`<label class="full">Verification notes (optional)<textarea name="note" maxlength="800"></textarea></label>`,'Record payment & confirm'));
  bind('payment-form',data=>{
    if(!canManage(b)||!b.status.startsWith('Pending'))return;
    const received=String(data.get('received')||''),reference=String(data.get('reference')||'').trim();
    if(!reference||!/^\d{4}-\d{2}-\d{2}$/.test(received)||received>localInput().slice(0,10)){error('Enter a reference and a valid payment date no later than today.');return;}
    if(b.payment)(b.paymentHistory||=[]).push(b.payment);
    b.payment={reference,received,recordedAt:state.now,admin:'Demo administrator',note:String(data.get('note')||'')};b.status='Confirmed';b.additionalAmount=null;
    log('Payment verified / booking confirmed','GR-'+id,reference+' · Received '+received);addNotice('corporate',b.companyId,'Booking confirmed','GR-'+id+' · Admin has verified payment.',{kind:'booking',id});closeRefresh('Payment recorded and booking confirmed.');
  });
}
function rejectBookingDialog(id) {const b=booking(id);if(!canManage(b)||!isOpen(b))return;showDialog('Reject booking · GR-'+id,form('reject-booking',`<label class="full">Reason / message to main contact<textarea name="reason" required maxlength="800"></textarea></label><p class="muted full">Reserved places will be released. Account approval is unchanged; refunds happen externally.</p>`,'Reject booking'));bind('reject-booking',data=>{if(!canManage(b)||!isOpen(b))return;const reason=String(data.get('reason')||'').trim();if(!reason){error('Enter a reason.');return;}b.status='Rejected';b.reason=reason;b.amendment=null;b.cancellation=null;log('Booking rejected','GR-'+id,b.reason);addNotice('corporate',b.companyId,'Booking rejected','GR-'+id+' · '+b.reason,{kind:'booking',id});closeRefresh('Booking rejected. Reserved places released.');});}
function amendmentPanel(b) {const s=slot(b.amendment.slotId);return `<div class="alert"><strong>Change awaiting admin approval</strong><br>Proposed: ${esc(activities[s.activity].name)} · ${dateLabel(s.date)} · ${s.start}–${s.end} · ${b.amendment.size} people<br>Reason: ${esc(b.amendment.reason)}<br>Original booking remains unchanged.${session.role==='admin'?`<div class="row section-gap"><button class="btn primary" onclick="decideAmendment(${b.id},true)">Approve · no additional payment</button>${b.status==='Confirmed'?`<button class="btn" onclick="additionalPaymentDialog(${b.id})">Approve · additional payment</button>`:''}<button class="btn" onclick="decideAmendment(${b.id},false)">Decline change</button></div>`:''}</div>`;}
function amendmentDialog(id) {
  const b=booking(id);if(!canCorporateChange(b))return;
  const available=state.slots.filter(s=>reservable(s)&&remaining(s.id,b.id)>=s.min);
  showDialog('Request a booking amendment',form('amendment-form',`<label class="full">Corporate event / date / time<select name="slot">${options(available.map(s=>[s.id,activities[s.activity].name+' · '+dateLabel(s.date)+' · '+s.start+'–'+s.end+' · '+remaining(s.id,b.id)+' available']),b.slotId)}</select></label>`+fields([['Proposed group size','size','number',b.size]])+`<label class="full">Reason<textarea name="reason" required maxlength="800"></textarea></label><p class="muted full">Existing accepted places remain held; proposed places are not reserved. For an unaccepted request, neither set of places is held. Admin reviews any extra payment or refund externally.</p>`,'Send change request'));
  bind('amendment-form',data=>{
    if(!canCorporateChange(b))return;
    const s=slot(data.get('slot')),size=Number(data.get('size')),reason=String(data.get('reason')||'').trim();
    if(!fits(s,size,b.id)||!reason){error('Enter a reason and group size within the target event limits and capacity.');return;}
    if(s.id===b.slotId&&size===b.size){error('Change the event or group size first.');return;}
    b.amendment={slotId:s.id,size,reason,requestedAt:state.now};log('Booking change requested','GR-'+id,'Original booking retained pending review.');addNotice('admin',null,'Booking change requested','GR-'+id+' · '+company(b.companyId).name,{kind:'booking',id});closeRefresh('Change requested; original booking unchanged.');
  });
}
// This synchronous preview transfers an accepted reservation only after rechecking the target.
function decideAmendment(id,approve,extra=null) {
  const b=booking(id),a=b?.amendment;if(!canManage(b)||!a||!isOpen(b)||b.cancellation)return false;
  if(!extra&&!ask(approve?'Approve this booking change? Capacity will be checked again before moving places.':'Decline this change and keep the original booking?'))return false;
  if(approve){
    if(eventStarted(slot(b.slotId))){notify('Original event has started. Decline this change and handle any operational correction externally; past event details are retained.');return false;}
    if(!fits(slot(a.slotId),a.size,b.id)){notify('Cannot approve: target unavailable or insufficient capacity.');return false;}
    if(extra&&(b.status!=='Confirmed'||!Number.isFinite(extra.amount)||extra.amount<=0||!validDeadline(extra.deadline,slot(a.slotId))||!extra.note.trim()))return false;
    if(!extra&&b.status.startsWith('Pending')&&Date.parse(b.deadline)>=Date.parse(slot(a.slotId).date+'T'+slot(a.slotId).start+':00+02:00')){notify('Set a payment deadline before the proposed event starts before approving this move.');return false;}
    const before=b.slotId+'/'+b.size;b.slotId=a.slotId;b.size=a.size;
    if(extra){b.status='Pending additional payment';b.additionalAmount=extra.amount;b.deadline=extra.deadline;b.followup=extra.note;}
    log('Booking amendment approved','GR-'+id,before+' → '+b.slotId+'/'+b.size+' · '+(extra?'Additional payment R '+extra.amount.toFixed(2):'No additional payment required; any refund handled externally.'));
  }else log('Booking amendment declined','GR-'+id,a.reason);
  b.amendment=null;addNotice('corporate',b.companyId,approve?'Booking change approved':'Booking change declined','GR-'+id+' · '+(extra?'Additional payment required by '+saTime(extra.deadline):approve?'View updated details.':'Original booking retained.'),{kind:'booking',id});render();openBooking(id);notify(approve?'Change approved. Accepted reservations transferred; unaccepted requests remain unreserved.':'Original booking retained.');return true;
}
function additionalPaymentDialog(id) {
  const b=booking(id);if(!canManage(b)||!b.amendment||b.status!=='Confirmed')return;
  showDialog('Approve change · additional payment',form('additional-payment',fields([['Additional amount (ZAR)','amount','number',''],['Payment deadline (South African time)','deadline','datetime-local','']])+`<label class="full">External payment / adjustment note<textarea name="note" required maxlength="800"></textarea></label><p class="muted full">On approval, places move to the new event and remain held while extra payment is pending. Prior payment records remain visible. No automatic pricing or refund.</p>`,'Approve change & request payment'));
  const amountInput=$('additional-payment').querySelector?.('[name="amount"]');if(amountInput)amountInput.step='0.01';
  bind('additional-payment',data=>{const extra={amount:Number(data.get('amount')),deadline:String(data.get('deadline'))+':00+02:00',note:String(data.get('note')||'')};if(!decideAmendment(id,true,extra))error('Enter a positive amount, a future deadline before the target event starts, and a note; the original must not have started and the target must still fit.');});
}
function requestCancellationDialog(id) {
  const b=booking(id);if(!canCorporateChange(b))return;
  showDialog('Request cancellation',form('cancellation-form',`<label class="full">Reason<textarea name="reason" required maxlength="800"></textarea></label><p class="muted full">Nothing changes until admin approves. Any paid refund is discussed externally.</p>`,'Send cancellation request'));
  bind('cancellation-form',data=>{if(!canCorporateChange(b))return;const reason=String(data.get('reason')||'').trim();if(!reason){error('Enter a reason.');return;}b.cancellation={reason,requestedAt:state.now};log('Cancellation requested','GR-'+id,reason);addNotice('admin',null,'Cancellation requested','GR-'+id+' · '+company(b.companyId).name,{kind:'booking',id});closeRefresh('Cancellation requested. Existing reservation is unchanged.');});
}
function decideCancellation(id,approve) {
  const b=booking(id);if(!canManage(b)||!b.cancellation||!isOpen(b))return;
  if(!approve&&!ask('Decline this cancellation request and keep the original booking?'))return;
  if(!approve){log('Cancellation declined','GR-'+id,b.cancellation.reason);b.cancellation=null;addNotice('corporate',b.companyId,'Cancellation declined','GR-'+id+' remains unchanged. Contact Ladles to discuss.',{kind:'booking',id});render();openBooking(id);return;}
  showDialog('Approve cancellation',form('cancel-review',`<label class="full">Decision / external refund note<textarea name="note" required maxlength="800"></textarea></label><p class="muted full">Release reserved places and retain this record and its payment history. Refunds are not processed here.</p>`,'Approve cancellation & release places'));
  bind('cancel-review',data=>{const note=String(data.get('note')||'').trim();if(!canManage(b)||!b.cancellation||!isOpen(b))return;if(!note){error('Record the decision and any external refund follow-up.');return;}b.status='Cancelled';b.reason=note;b.cancellation=null;b.amendment=null;log('Cancellation approved','GR-'+id,note);addNotice('corporate',b.companyId,'Booking cancelled','GR-'+id+' · '+note,{kind:'booking',id});closeRefresh('Cancelled. Places released; history retained.');});
}
function availabilityScreen() {
  if(session?.role!=='admin')return '<p class="blank">Admin-only screen.</p>';
  const view=filteredList('events',state.slots,s=>[activities[s.activity].name,activities[s.activity].venue,s.date].join(' '),s=>s.cancelled?'Cancelled':eventEnded(s)?'Ended':s.active?'Published':'Unavailable',s=>s.date);
  return head('Corporate events','Manage corporate-only opportunities and notify affected companies.',`<button class="btn primary" onclick="addSlotDialog()">+ Create corporate event</button>`)+
    view.tools+`<section class="card"><div class="table-wrap"><table><thead><tr><th>Event / location</th><th>Date / time</th><th>Total / available</th><th>Group limits</th><th>Status</th><th>Actions</th></tr></thead><tbody>${view.rows.map(s=>`<tr><td><strong>${esc(activities[s.activity].name)}</strong><small>${esc(activities[s.activity].venue)}</small>${s.cancelled?'<p>'+esc(s.cancellationReason)+'</p>':''}</td><td>${dateLabel(s.date)}<br>${s.start}–${s.end}</td><td>${s.capacity} / ${s.cancelled?'Not bookable':remaining(s.id)}</td><td>${s.min}–${s.max}</td><td>${badge(s.cancelled?'Cancelled':eventEnded(s)?'Ended':s.active?'Published':'Unavailable')}</td><td><div class="row">${!s.cancelled&&!eventEnded(s)?`${!eventStarted(s)?`<button class="btn" onclick="editCorporateEvent(${s.id})">Edit event</button>`:''}<button class="btn" onclick="toggleSlot(${s.id})">${s.active?'Close requests':'Publish'}</button><button class="btn" onclick="cancelCorporateEvent(${s.id})">Cancel event</button>`:''}<button class="btn" onclick="eventBookings(${s.id})">Bookings / attendance</button></div></td></tr>`).join('')||'<tr><td colspan="6">No matching events.</td></tr>'}</tbody></table></div></section>`+view.footer+`<div class="note blueprint">Closing requests is reversible. Cancelling releases reservations and notifies companies; history remains. Complete confirmed groups after the event. No WMS or individual volunteer records are changed.</div>`;
}
function toggleSlot(id) {if(session?.role!=='admin')return;const s=slot(id);if(!s||s.cancelled||eventEnded(s))return;s.active=!s.active;log('Corporate availability changed',activities[s.activity].name,s.date+' · '+(s.active?'Published':'Closed'));render();}
function eventBookings(id) {
  const s=slot(id);if(session?.role!=='admin'||!s)return;
  showDialog('Bookings · '+esc(activities[s.activity].name),`<p class="muted">${dateLabel(s.date)} · ${s.start}–${s.end}. Open a confirmed booking to record attendance after the event ends.</p>${bookingTable(state.bookings.filter(b=>b.slotId===s.id),false)}`);
}
function eventSnapshot(s) {
  const a=activities[s.activity];return {title:a.name,location:a.venue,description:a.description,date:s.date,start:s.start,end:s.end,capacity:s.capacity,min:s.min,max:s.max};
}
function editCorporateEvent(id) {
  const s=slot(id);if(session?.role!=='admin'||!s||s.cancelled||eventStarted(s))return;
  const a=activities[s.activity];
  showDialog('Edit corporate event · selected date only',form('event-edit',fields([['Event title','title','text',a.name],['Location','location','text',a.venue],['Date','date','date',s.date],['Start time','start','time',s.start],['End time','end','time',s.end],['Total capacity','capacity','number',s.capacity],['Minimum group size','min','number',s.min],['Maximum per booking','max','number',s.max]])+`<label class="full">Description<textarea name="description" required maxlength="800">${esc(a.description)}</textarea></label><label class="full">Reason / message to affected companies<textarea name="reason" required maxlength="800"></textarea></label><p class="muted full">This changes this date only. Existing bookings retain their status and payment history. Companies with active bookings or proposed moves here are notified. Resolve incompatible accepted groups before reducing limits.</p>`,'Save event & notify companies'));
  bind('event-edit',data=>{
    if(session?.role!=='admin'||s.cancelled||eventStarted(s))return;
    const next={};for(const key of ['title','location','description','date','start','end'])next[key]=String(data.get(key)||'').trim();
    for(const key of ['capacity','min','max'])next[key]=Number(data.get(key));
    const reason=String(data.get('reason')||'').trim(),start=Date.parse(next.date+'T'+next.start+':00+02:00');
    if(!next.title||!next.location||!next.description||!reason||!/^\d{4}-\d{2}-\d{2}$/.test(next.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(next.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(next.end)||!Number.isFinite(start)||start<=Date.parse(state.now)||next.end<=next.start||![next.capacity,next.min,next.max].every(Number.isInteger)||next.min<1||next.max<next.min||next.max>next.capacity){error('Enter complete details, a reason, valid future times, and limits within capacity.');return;}
    const held=state.bookings.filter(b=>b.slotId===s.id&&heldStatuses.includes(b.status));
    if(held.some(b=>b.status.startsWith('Pending')&&Date.parse(b.deadline)>=start)){error('An existing payment deadline is not before the proposed start. Resolve that booking deadline before moving the event.');return;}
    if(held.some(b=>b.size<next.min||b.size>next.max)||held.reduce((n,b)=>n+b.size,0)>next.capacity){error('New capacity or group limits conflict with accepted bookings. Resolve those bookings first.');return;}
    const before=eventSnapshot(s);
    if(JSON.stringify(before)===JSON.stringify(next)){error('Change an event detail before saving.');return;}
    // A seeded activity may appear on multiple dates. Clone its description to avoid silently editing other dates.
    s.activity=activities.push({name:next.title,venue:next.location,description:next.description,icon:'▦'})-1;
    Object.assign(s,{date:next.date,start:next.start,end:next.end,capacity:next.capacity,min:next.min,max:next.max});
    log('Corporate event updated',next.title,JSON.stringify({before,after:eventSnapshot(s),reason}));
    const message='Event updated: '+next.title+' · '+dateLabel(s.date)+' '+s.start+'–'+s.end+' · '+next.location+' · '+reason+'. Existing booking/payment status retained. Contact Ladles if you need a change or cancellation.';
    state.bookings.filter(b=>isOpen(b)&&(b.slotId===s.id||b.amendment?.slotId===s.id)).forEach(b=>addNotice('corporate',b.companyId,'Corporate event updated','GR-'+b.id+' · '+message,{kind:'booking',id:b.id}));
    closeRefresh('Event updated. Affected companies notified; other dates unchanged.');
  });
}
function cancelCorporateEvent(id) {
  const s=slot(id);if(session?.role!=='admin'||!s||s.cancelled||eventEnded(s))return;
  showDialog('Cancel corporate event',form('event-cancel',`<p class="full"><strong>${esc(activities[s.activity].name)}</strong> · ${dateLabel(s.date)} ${s.start}–${s.end}</p><label class="full">Reason and external payment / refund follow-up<textarea name="reason" required maxlength="800"></textarea></label><p class="muted full">All active requests and bookings on this date will be cancelled and notified. Reservations are released; payment and audit history remain. Refunds are handled externally. This is not the reversible Close requests action.</p>`,'Cancel event & notify companies'));
  bind('event-cancel',data=>{
    if(session?.role!=='admin'||s.cancelled||eventEnded(s))return;
    const reason=String(data.get('reason')||'').trim();if(!reason){error('Enter a cancellation reason and any external payment follow-up.');return;}
    if(state.bookings.some(b=>b.slotId===s.id&&b.status==='Completed')){error('Cannot cancel an event with completed attendance.');return;}
    s.cancelled=true;s.active=false;s.cancellationReason=reason;s.cancelledAt=state.now;
    state.bookings.forEach(b=>{
      if(isOpen(b)&&b.slotId===s.id){b.status='Cancelled';b.reason='Event cancelled: '+reason;b.amendment=null;b.cancellation=null;log('Booking cancelled with event','GR-'+b.id,reason);addNotice('corporate',b.companyId,'Corporate event cancelled','GR-'+b.id+' · '+reason+' · Any refund is handled externally.',{kind:'booking',id:b.id});}
      else if(isOpen(b)&&b.amendment?.slotId===s.id){b.amendment=null;log('Booking amendment declined','GR-'+b.id,'Proposed target event cancelled. Original booking retained.');addNotice('corporate',b.companyId,'Booking change declined','GR-'+b.id+' · Proposed event cancelled. Original booking unchanged.',{kind:'booking',id:b.id});}
    });
    log('Corporate event cancelled',activities[s.activity].name,reason);closeRefresh('Event cancelled; affected companies notified and reservations released.');
  });
}
function completeBookingDialog(id) {
  const b=booking(id),s=b&&slot(b.slotId);
  if(!canManage(b)||!['Confirmed','Completed'].includes(b.status)||s.cancelled||!eventEnded(s)||b.amendment||b.cancellation)return;
  const previous=b.completion;
  showDialog(previous?'Correct group attendance':'Record group attendance & complete',form('completion-form',fields([['Actual attendees (zero allowed)','attended','number',previous?String(previous.attended):''],['Total group volunteer hours (optional)','hours','number',previous?.hours===null||!previous?'':String(previous.hours),false]])+`<label class="full">${previous?'Correction reason':'Attendance notes'}<textarea name="note" required maxlength="800"></textarea></label><p class="muted full">Record 0–${b.size} actual attendees. Hours mean the combined hours for the entire group, not the session duration. Leave blank if not recorded; no hours are inferred. Previous payment and attendance correction history are retained.</p>`,'Save attendance & mark completed'));
  const input=$('completion-form').querySelector?.('[name="hours"]');if(input)input.step='0.01';
  bind('completion-form',data=>{
    if(!canManage(b)||!['Confirmed','Completed'].includes(b.status)||s.cancelled||!eventEnded(s)||b.amendment||b.cancellation)return;
    const text=String(data.get('attended')??'').trim(),attended=Number(text),hoursText=String(data.get('hours')||'').trim(),hours=hoursText===''?null:Number(hoursText),note=String(data.get('note')||'').trim();
    if(!text||!Number.isInteger(attended)||attended<0||attended>b.size||!note||hours!==null&&(!Number.isFinite(hours)||hours<0||attended===0&&hours>0)){error('Enter whole-number attendance within the booked group size, notes, and valid non-negative group hours (zero or blank for no attendees).');return;}
    const before=b.completion||null;
    if(before)(b.completionHistory||=[]).push(before);
    b.completion={attended,hours,note,admin:'Demo administrator',recordedAt:state.now};b.status='Completed';
    log(before?'Corporate attendance corrected':'Corporate booking completed','GR-'+id,JSON.stringify({before,after:b.completion}));
    addNotice('corporate',b.companyId,before?'Group attendance corrected':'Group booking completed','GR-'+id+' · '+attended+' attendees · '+(hours===null?'Hours not recorded':hours+' total group hours'),{kind:'booking',id});
    render();openBooking(id);notify('Attendance saved. Completed booking and payment history retained.');
  });
}
function addSlotDialog() {
  if(session?.role!=='admin')return;
  showDialog('Create corporate event',form('slot-form',fields([['Event title','title','text',''],['Location','location','text',''],['Date','date','date','2026-11-13'],['Start time','start','time','09:15'],['End time','end','time','10:15'],['Total capacity','capacity','number',40],['Minimum group size','min','number',1],['Maximum per booking (blank = capacity)','max','number','',false]])+`<label class="full">Description<textarea name="description" required maxlength="800"></textarea></label>`,'Publish corporate event'));
  bind('slot-form',data=>{
    if(session?.role!=='admin')return;
    const start=String(data.get('start')),end=String(data.get('end')),date=String(data.get('date')),capacity=Number(data.get('capacity')),min=Number(data.get('min')),max=Number(data.get('max')||capacity),title=String(data.get('title')||'').trim(),venue=String(data.get('location')||'').trim(),description=String(data.get('description')||'').trim();
    const begins=Date.parse(date+'T'+start+':00+02:00');
    if(!title||!venue||!description||!Number.isFinite(begins)||!/^\d{2}:\d{2}$/.test(end)||end<=start||end>'23:59'||begins<=Date.parse(state.now)||![capacity,min,max].every(Number.isInteger)||min<1||max<min||max>capacity){error('Complete the event details, choose future valid times and limits: 1 ≤ minimum ≤ maximum ≤ capacity.');return;}
    const activity=activities.push({name:title,venue,description,icon:'▦'})-1;
    state.slots.push({id:state.nextSlot++,activity,date,start,end,capacity,min,max,active:true});log('Corporate event published',title,date+' · '+start+'–'+end);closeRefresh('Corporate-only event published.');
  });
}
function contactSettingsScreen() {const c=state.bookingContact;return head('Corporate booking contact','Configure approved details for external payment communication.')+`<section class="card"><div class="body">${!c.email&&!c.phone?'<div class="alert">Contact details not yet provided. Configure these before real corporate bookings open.</div>':''}${form('contact-form',fields([['Booking email','email','email',c.email,false],['Booking phone','phone','tel',c.phone,false]]),'Save contact details')}<div class="note">Blank fields stay unavailable; no invented contact is shown. This mockup can still be explored without real details.</div></div></section>`;}
function saveContact(data) {
  if(session?.role!=='admin')return;
  const email=String(data.get('email')||'').trim(),phone=String(data.get('phone')||'').trim();
  if(!email&&!phone){error('Provide at least one approved contact method.');return;}
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||phone&&!/^[+0-9() .-]{7,25}$/.test(phone)){error('Enter a valid email or phone.');return;}
  state.bookingContact={email,phone};log('Corporate contact updated','Booking contact','External communication details changed.');render();notify('Demo contact saved.');
}
function volunteerRows() {return state.volunteers.filter(v=>[v.name,v.email,v.phone].join(' ').toLowerCase().includes(volunteerSearch.toLowerCase()));}
function volunteerTable() {const rows=volunteerRows();return rows.length?`<div class="table-wrap"><table><thead><tr><th>Volunteer</th><th>Email</th><th>Cellphone</th><th>Recorded hours</th><th></th></tr></thead><tbody>${rows.map(v=>`<tr><td>${esc(v.name)}</td><td>${esc(v.email)}</td><td>${v.phone?esc(v.phone):'<span class="badge overdue">Number needed</span>'}</td><td>${v.hours} h</td><td><button class="btn" onclick="openVolunteer(${v.id})">View details</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="blank">No matching volunteers.</p>';}
function directoryScreen() {return head('Volunteer directory','Search registered volunteers and open their details.')+`<div class="toolbar"><input id="volunteer-search" aria-label="Search volunteers" placeholder="Search name, email or cellphone…" value="${esc(volunteerSearch)}"></div><section class="card" id="volunteer-results">${volunteerTable()}</section><div class="note">New volunteer registration requires a cellphone. Existing missing numbers are flagged, not invented. Demo personal details are fictional; the live directory must be admin-only.</div>`;}
function openVolunteer(id) {const v=state.volunteers.find(v=>v.id===id);showDialog('Volunteer details',`<h2>${esc(v.name)}</h2>${detail('Email',esc(v.email))}${detail('Cellphone',v.phone?esc(v.phone):'Not provided—profile update needed')}${detail('Date of birth',dateLabel(v.dob))}${detail('Registered',dateLabel(v.joined))}${detail('Booking records',v.bookings)}${detail('Verified hours (sample)',v.hours+' h')}<div class="row section-gap">${emailLink(v.email)}${v.phone?phoneLink(v.phone):''}</div>`);}
function noticeActionLabel(n) {return n.target?.kind==='booking'?'Go to booking':n.target?.kind==='company'?'Go to account':n.target?.page==='book'?'Go to booking page':'Go to profile';}
function notificationsScreen() {return head('Notifications','Open the relevant account or booking directly. In-app updates only; payment communication happens externally.')+`<section class="card">${visibleNotices().slice().reverse().map(n=>`<article class="listitem notice ${n.read?'':'unread'}"><div class="row between"><h3>${esc(n.title)}</h3><div class="row">${n.target?`<button class="btn primary" onclick="goToNotice(${n.id})">${noticeActionLabel(n)} →</button>`:''}<button class="btn" ${n.read?'disabled':''} onclick="markNotice(${n.id})">${n.read?'Read':'Mark read'}</button></div></div><p class="muted">${esc(n.message)}</p></article>`).join('')||'<div class="blank">No notifications yet.</div>'}</section>`;}
function goToNotice(id) {
  if(!discardChanges())return;
  const n=visibleNotices().find(item=>item.id===id);
  if(!n?.target)return;
  const target=n.target;
  if(target.kind==='booking') {
    const b=booking(target.id);
    if(!b||(session.role!=='admin'&&(session.role!=='corporate'||b.companyId!==session.companyId))){notify('This booking is no longer available to this account.');return;}
    n.read=true;corporateTab='requests';navigate(session.role==='admin'?'corporate':'dashboard');openBooking(b.id);
  } else if(target.kind==='company') {
    if(session.role!=='admin'||!company(target.id)){notify('This account is no longer available.');return;}
    n.read=true;corporateTab='accounts';navigate('corporate');openCompany(target.id);
  } else if(target.kind==='page'&&session.role==='corporate'&&['book','account'].includes(target.page)) {
    n.read=true;navigate(target.page==='book'&&company().status!=='Approved'?'dashboard':target.page);
  }
}
function markNotice(id) {if(!discardChanges())return;const n=visibleNotices().find(n=>n.id===id);if(n)n.read=true;render();}
function bookingHistory(b) {const rows=state.audit.filter(a=>a.record==='GR-'+b.id);return '<section class="note"><h3>Booking status & action history</h3><p class="muted">Demo history resets on refresh. Production needs durable, server-written records.</p><div class="timeline">'+(rows.map(a=>`<p><strong>${esc(a.action)}</strong> · ${esc(a.status)}<br><small>${esc(a.actor)} (${esc(a.actorRole)}) · ${saTime(a.when)}</small><br>${esc(a.detail)}</p>`).join('')||'<p>No actions in this session. Seeded records predate this demo history.</p>')+'</div></section>';}
function activityScreen() {if(session?.role!=='admin')return '<p class="blank">Admin-only history.</p>';return head('Recent activity','Simulated account, booking and payment decisions; durable server-written history still required.')+`<section class="card"><div class="table-wrap"><table><thead><tr><th>When (SA)</th><th>Who / role</th><th>Action / record / status</th><th>Details</th></tr></thead><tbody>${state.audit.map(a=>`<tr><td>${saTime(a.when)}</td><td>${esc(a.actor)}<br>${esc(a.actorRole)}</td><td><strong>${esc(a.action)}</strong>${esc(a.record)} · ${esc(a.status)}</td><td>${esc(a.detail)}</td></tr>`).join('')||'<tr><td colspan="4">No demo actions yet.</td></tr>'}</tbody></table></div></section>`;}
function implementationScreen() {
  if(session?.role!=='admin')return '<p class="blank">Admin-only checklist.</p>';
  const tasks=[
    ['Settled booking rules','Deadlines are future South African times strictly before the event starts, including extensions and additional payments. Overdue bookings retain capacity. At the start, corporate self-service changes/cancellations close; pending changes cannot move a past event. Admin can review existing cancellation requests, record received payment, reject with a reason, or record/correct actual attendance after the end. No automatic rejection or refunds.'],
    ['Existing accounts & historical details','An existing volunteer signs in before adding company membership to the same authentication identity; never replace the volunteer role/profile or create a second login. Corporate email verification and admin approval remain required. A rejected business contacts admin externally; admin can reopen that same account with a reason. Save contact and billing snapshots at booking submission; future profile changes do not rewrite history.'],
    ['Separate notifications','Corporate account, booking, payment and event notices are in-app operational notices, not controlled by volunteer shift-reminder preferences. Authentication verification/recovery emails are separate. No operational email/SMS or internal chat is promised in this release.'],
    ['Separate corporate schema & legacy history','Create independent corporate events, slots and reservations, company membership/approval, payment and change records, and corporate notice targets. Do not put new corporate bookings into volunteer slots or WMS responses. Preserve old CSR records as legacy history; do not delete them or remove existing capacity safeguards without a verified migration. Corporate attendance permits unrecorded hours (null), distinct from zero.'],
    ['Safe database-first rollout','Prepare versioned, additive migrations plus the app implementation together; back up and test both in staging. Add nullable volunteer phone for existing accounts, gating only new bookings. Test row policies, allowed transitions, locking, idempotency, ownership and WMS regressions. In production apply backward-compatible database changes first, then deploy the app, verify and enable corporate access. Do not drop/rename legacy tables or switch the existing app onto an incompatible schema. Configure real booking contact details before enabling requests.'],
    ['Authentication configuration','Configure corporate email verification, allowed redirect URLs, rate-limited resend and password recovery with expiring single-use links. Never implement these using this demo’s buttons.'],
    ['Duplicate-request protection','Store company-scoped idempotency keys with a unique constraint. Retry the same request safely on the server; reject key reuse with a different payload. Disabling a button is not sufficient.'],
    ['Atomic capacity enforcement','Accept bookings and transfer reservations in a database transaction with row locking or an equivalent atomic operation. Recheck all accepted reservations before committing, including simultaneous admin requests.'],
    ['Company-level permissions','Enforce ownership/membership in database policies and privileged functions for corporate profiles, bookings, payment records, notifications and history. Never trust a supplied company ID or browser role.'],
    ['Durable history & notifications','Write actor, server timestamp, previous/new values, decisions and payment references durably. Protect audit records from client rewriting. Generate notifications and overdue flags safely without duplicates.'],
    ['Queries and search','Implement server-side search, status/date filters, stable pagination and appropriate indexes. This preview only filters arrays in memory.'],
    ['Workflow validation','Enforce allowed status transitions, event cancellation, amendments, payment history, attendance corrections, limits and cellphone requirements in the backend too.'],
    ['Release testing','Run real verification/reset journeys and full corporate workflows, double-submit retries, concurrent acceptance and cross-company access tests. Test mobile layout and keyboard use; rerun volunteer/WMS regressions and verify corporate data never enters WMS.'],
  ];
  return head('Database & backend work still required','These are pending implementation tasks—not protections already delivered.')+'<div class="alert error"><strong>Mockup only.</strong> No database schema, policies, authentication configuration or live APIs have been changed. Refresh clears all demo state.</div><div class="grid">'+tasks.map(([title,body])=>`<section class="card"><div class="body"><span class="badge pending">Pending backend / verification</span><h2 class="section-gap">${title}</h2><p class="muted">${body}</p></div></section>`).join('')+'</div><section class="card section-gap"><div class="body"><h2>Capacity & isolation examples</h2><p class="muted">Sequential UI simulations only. These do not prove database concurrency safety or authorization.</p><div class="row section-gap"><button class="btn" onclick="simulateCapacityReview()">Try two competing acceptances</button><button class="btn" onclick="secondCompanyDemo()">View as another demo company</button></div><div id="capacity-demo" class="note" role="status">Capacity example: 10 places, two requests for 7 each.</div></div></section>';
}
function simulateCapacityReview() {if(session?.role!=='admin')return;const capacity=10,requests=[7,7];let used=0;const result=requests.map((size,i)=>{if(used+size>capacity)return 'Request '+(i+1)+': declined — only '+(capacity-used)+' places remain.';used+=size;return 'Request '+(i+1)+': accepted — '+size+' places held.';});$('capacity-demo').textContent=result.join(' ')+' This is a sequential example; real concurrent safety still requires an atomic database transaction.';}
function secondCompanyDemo() {if(!discardChanges())return;let c=state.companies.find(c=>c.isIsolationDemo);if(!c){c={id:state.nextCompany++,name:'Second demo business',contact:'Other demo contact',email:'other@example.invalid',phone:'+27 00 000 0088',address:'Fictional billing address',status:'Approved',emailVerified:true,isIsolationDemo:true};state.companies.push(c);}session={role:'corporate',companyId:c.id};page='dashboard';$('dialog').close();render();notify('Different demo company: other companies’ bookings and notifications are hidden. Database policies are still required.');}
function accountScreen() {
  if(session.role==='corporate'){const c=company();return head('Business profile','Edit your main contact and billing details. Admin is notified; ordinary edits do not revoke approval.',c.ownerVolunteerId?'<button class="btn" onclick="switchToVolunteer()">Open volunteer workspace</button>':'Submit changes for future requests; historical booking details stay unchanged.')+`<section class="card"><div class="body">${badge(c.status)}${form('corporate-profile',fields([['Company / organisation','name','text',c.name],['Main point of contact','contact','text',c.contact],['Contact email (not login email)','email','email',c.email],['Phone','phone','tel',c.phone],['Billing address','address','text',c.address]]),'Save business profile')}<div class="note">Your login email stays unchanged. Updates are logged and admin receives a Go to account notification.</div></div></section>`;}
  const v=state.volunteers.find(v=>v.id===session.volunteerId);return head('My profile','Keep your cellphone number up to date.')+`<section class="card"><div class="body">${form('volunteer-phone',fields([['Full name','name','text',v.name],['Email','email','email',v.email],['Cellphone number','phone','tel',v.phone]]),'Save profile')}</div></section>`;
}
function saveBusinessProfile(data) {
  if(session?.role!=='corporate')return;
  const c=company(),updated={};
  for(const key of ['name','contact','email','phone','address'])updated[key]=String(data.get(key)||'').trim();
  if(Object.values(updated).some(v=>!v)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updated.email)||!/^[+0-9() .-]{7,25}$/.test(updated.phone)){error('Complete all fields with a valid email and phone.');return;}
  const changed=Object.keys(updated).filter(k=>c[k]!==updated[k]);
  if(!changed.length){notify('No changes to save.');return;}
  c.loginEmail||=c.email;
  const before=changed.map(k=>k+': '+c[k]+' → '+updated[k]).join('; ');
  Object.assign(c,updated);log('Corporate profile updated',c.name,before);addNotice('admin',null,'Corporate profile updated',c.name+' · Changed: '+changed.join(', '),{kind:'company',id:c.id});render();notify('Profile saved. Admin notified; account approval unchanged.');
}
function simulateVolunteerBooking() {
  if(session?.role!=='volunteer')return;
  const v=state.volunteers.find(v=>v.id===session.volunteerId);
  if(!v.phone){navigate('account');notify('Add your cellphone before a new booking. Existing bookings remain accessible.');return;}
  notify('Cellphone check passed. In the real app, continue to individual opportunities; this preview creates no volunteer booking.');
}
function demoVolunteer() {if(!discardChanges())return;session={role:'volunteer',volunteerId:3};page='dashboard';$('dialog').close();render();}
function setDemoTime(time) {
  const before=new Set(state.bookings.filter(isOverdue).map(b=>b.id));state.now=new Date(time).toISOString();
  state.bookings.filter(isOverdue).forEach(b=>{if(!before.has(b.id)){addNotice('admin',null,'Payment overdue','GR-'+b.id+' · Contact the main contact, extend the deadline or reject.',{kind:'booking',id:b.id});addNotice('corporate',b.companyId,'Payment overdue','GR-'+b.id+' · Contact Ladles. Your booking remains pending payment.',{kind:'booking',id:b.id});}});
}
function advanceClock() {if(!discardChanges())return;setDemoTime(Date.parse(state.now)+86400000);render();notify('Demo clock advanced one day. No booking was automatically rejected.');}
function finishDemoEvent(id) {
  const b=booking(id);if(!canManage(b)||b.status!=='Confirmed')return;const s=slot(b.slotId);if(s.cancelled)return;
  setDemoTime(Math.max(Date.parse(state.now),Date.parse(s.date+'T'+s.end+':00+02:00')+60000));
  render();openBooking(id);notify('Demo clock advanced past this event. You can now record actual group attendance.');
}
function render() {
  $('demo-clock').textContent='Demo clock: '+saTime(state.now)+' · State resets on refresh. Demo role switching is not production access control.';
  if(!session){$('app').innerHTML=loginScreen();bind('auth-form',handleAuth);bind('recovery-request',requestDemoReset);bind('recovery-password',saveDemoPassword);return;}
  const screens={dashboard,corporate:corporateScreen,book:bookingScreen,availability:availabilityScreen,contact:contactSettingsScreen,directory:directoryScreen,notifications:notificationsScreen,activity:activityScreen,account:accountScreen,implementation:implementationScreen};
  $('app').innerHTML=shell((screens[page]||dashboard)());
  bind('request-form',reviewRequest);bind('contact-form',saveContact);bind('corporate-profile',saveBusinessProfile);
  bind('volunteer-phone',data=>{if(session?.role!=='volunteer')return;const v=state.volunteers.find(v=>v.id===session.volunteerId),phone=String(data.get('phone')||'').trim();if(!/^[+0-9() .-]{7,25}$/.test(phone)){error('Enter a valid cellphone number.');return;}v.name=String(data.get('name'));v.phone=phone;render();notify('Demo profile updated. Cellphone is visible in the admin directory.');});
  if($('volunteer-search'))$('volunteer-search').oninput=e=>{volunteerSearch=e.target.value;$('volunteer-results').innerHTML=volunteerTable();};
}
function resetDemo() {if(!discardChanges())return;seed();session=null;page='dashboard';authMode='signin';corporateTab='requests';volunteerSearch='';calendarMonth='2026-11';$('dialog').close();render();notify('Demo reset. Live system unchanged.');}
// Browser leave/close warnings cannot protect a server write; these only prevent accidental form loss.
document.addEventListener?.('input',event=>{if(event.target?.closest?.('form'))dirtyForm=true;});
document.addEventListener?.('change',event=>{if(event.target?.closest?.('form'))dirtyForm=true;});
window.addEventListener?.('beforeunload',event=>{if(dirtyForm){event.preventDefault();event.returnValue='';}});
$('dialog').addEventListener?.('cancel',event=>{if(!discardChanges())event.preventDefault();});
// Explicit entry points referenced by inline handlers in this standalone HTML preview.
Object.assign(window, {showContact,setAuth,logout,navigate,openCompany,approveCompany,rejectCompanyDialog,reconsiderCompanyDialog,startBusinessRegistration,switchToVolunteer,selectActivity,selectSlot,changeMonth,submitRequest,paymentDeadlineDialog,recordPaymentDialog,rejectBookingDialog,amendmentDialog,decideAmendment,additionalPaymentDialog,requestCancellationDialog,decideCancellation,toggleSlot,addSlotDialog,editCorporateEvent,cancelCorporateEvent,eventBookings,completeBookingDialog,finishDemoEvent,openVolunteer,markNotice,goToNotice,advanceClock,resetDemo,simulateVolunteerBooking,demoVolunteer,closePreviewDialog,startRecovery,openDemoReset,verifyDemoEmail,resendDemoVerification,switchCorporateTab,setListFilter,clearListFilter,changeListPage,simulateCapacityReview,secondCompanyDemo});
seed();
// Full-system login can link directly into this registration form; no account is created by opening it.
if(/[?&]access=business(?:&|$)/.test(window.location?.search||''))authMode='business';
if(/[?&]access=admin(?:&|$)/.test(window.location?.search||'')){session={role:'admin'};page='corporate';}
render();
