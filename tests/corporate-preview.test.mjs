import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

function fixture() {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { innerHTML: '', textContent: '', hidden: true, open: false, showModal() { this.open = true; }, close() { this.open = false; } });
    return elements.get(id);
  };
  const context = vm.createContext({ document: { getElementById: element, body: { classList: { toggle() {} } } }, window: { scrollTo() {} }, setTimeout: () => 1, clearTimeout() {}, FormData });
  vm.runInContext(readFileSync(new URL('../design-preview/corporate-workflow.js', import.meta.url), 'utf8'), context);
  return { run: source => vm.runInContext(source, context), element, submit(id, fields) {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    element(id).onsubmit({ preventDefault() {}, currentTarget: data });
  }, data(fields) {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    context.testData = data;
  } };
}

// Exercise the same form callbacks used by the preview, without a live browser or network.
function submitForm(f,id,values) {
  f.data(values);f.run('FormData = function(){return testData};');
  f.element(id).onsubmit({preventDefault(){},currentTarget:{}});
}

function editedEvent(overrides={}) {
  return {title:'Updated corporate session',location:'New sample venue',description:'Updated event description',date:'2026-11-06',start:'10:15',end:'11:15',capacity:'50',min:'1',max:'50',reason:'Venue and date changed; contact us if unsuitable.',...overrides};
}

// These are blueprint regression tests, not proof of production database permissions or locking.
test('payment deadlines must be future times strictly before the current or proposed event start',()=>{
  const f=fixture();f.run("demoLogin('corporate');submitRequest();demoLogin('admin');paymentDeadlineDialog(106)");
  for(const deadline of ['2026-11-12T09:15','2026-11-13T10:00','2026-10-15T09:00']){
    submitForm(f,'deadline-form',{deadline,note:'External payment follow-up.'});
    assert.equal(f.run('booking(106).status'),'Requested');
    assert.match(f.element('form-error').textContent,/before the event starts/);
  }
  submitForm(f,'deadline-form',{deadline:'2026-11-12T09:14',note:'Agreed deadline.'});
  assert.equal(f.run('booking(106).status'),'Pending payment');
  f.run('paymentDeadlineDialog(106)');
  submitForm(f,'deadline-form',{deadline:'2026-11-12T10:00',note:'Invalid extension.'});
  assert.equal(f.run('booking(106).deadline'),'2026-11-12T09:14:00+02:00');
  f.run("booking(104).amendment={slotId:2,size:21,reason:'Move date'}");
  assert.equal(f.run("decideAmendment(104,true,{amount:10,deadline:'2026-11-12T09:15:00+02:00',note:'Extra fee'})"),false);
  assert.equal(f.run('booking(104).slotId'),1);
  assert.equal(f.run("decideAmendment(104,true,{amount:10,deadline:'2026-11-11T09:15:00+02:00',note:'Extra fee'})"),true);
});

test('corporate changes and cancellations close at the start, including forms opened before the cutoff',()=>{
  const f=fixture();f.run("demoLogin('corporate');amendmentDialog(104);setDemoTime('2026-11-05T09:15:00+02:00')");
  submitForm(f,'amendment-form',{slot:'2',size:'21',reason:'Too late'});
  assert.equal(f.run('booking(104).amendment'),null);
  f.run("$('dialog').close();openBooking(104)");
  assert.match(f.element('dialog').innerHTML,/Online changes and cancellation requests are closed/);
  assert.doesNotMatch(f.element('dialog').innerHTML,/onclick="(?:amendmentDialog|requestCancellationDialog)/);
  f.run("$('dialog').close();requestCancellationDialog(104);amendmentDialog(104)");
  assert.equal(f.element('dialog').open,false);
  const g=fixture();g.run("demoLogin('corporate');requestCancellationDialog(104);setDemoTime('2026-11-05T09:15:00+02:00')");
  submitForm(g,'cancellation-form',{reason:'Late cancellation'});
  assert.equal(g.run('booking(104).cancellation'),undefined);
});

test('past event details cannot be moved by an old edit or an outstanding amendment approval',()=>{
  const f=fixture();f.run("demoLogin('admin');editCorporateEvent(1);booking(104).amendment={slotId:2,size:21,reason:'Move'};setDemoTime('2026-11-05T09:15:00+02:00')");
  submitForm(f,'event-edit',editedEvent());assert.equal(f.run('slot(1).date'),'2026-11-05');
  assert.equal(f.run('decideAmendment(104,true)'),false);
  assert.equal(f.run('booking(104).slotId'),1);
  assert.equal(f.run('decideAmendment(104,false)'),true);
  f.run("$('dialog').close();editCorporateEvent(1)");assert.equal(f.element('dialog').open,false);
});

test('moving a pending booking or event cannot leave its payment deadline after the new start',()=>{
  const f=fixture();f.run("demoLogin('admin');booking(105).deadline='2026-11-18T10:00:00+02:00';booking(105).amendment={slotId:2,size:15,reason:'Earlier date'}");
  assert.equal(f.run('decideAmendment(105,true)'),false);assert.equal(f.run('booking(105).slotId'),4);
  f.run('editCorporateEvent(4)');submitForm(f,'event-edit',editedEvent({date:'2026-11-17'}));
  assert.equal(f.run('slot(4).date'),'2026-11-19');assert.match(f.element('form-error').textContent,/payment deadline/);
});

test('event, month and time selection all respect declined unsaved-change prompts',()=>{
  const f=fixture();f.run("demoLogin('corporate');navigate('book');dirtyForm=true;window.confirm=()=>false");
  const markup=f.element('app').innerHTML;
  f.run('selectActivity(1);changeMonth(1);selectSlot(3)');
  assert.equal(f.run('draft.activity'),0);assert.equal(f.run('draft.slotId'),2);
  assert.equal(f.run('calendarMonth'),'2026-11');assert.equal(f.run('dirtyForm'),true);
  assert.equal(f.element('app').innerHTML,markup);
  assert.equal(f.run("(()=>{const control={value:'3'};selectSlot(3,control);return control.value;})()"),'2');
  f.run('window.confirm=()=>true;selectSlot(3)');assert.equal(f.run('draft.slotId'),3);
});

test('only an admin can reject or reconsider an account, including a previously opened form callback',()=>{
  const f=fixture();f.run("demoLogin('corporate');rejectCompanyDialog(2)");assert.equal(f.element('dialog').open,false);
  f.run("demoLogin('admin');rejectCompanyDialog(2);session={role:'corporate',companyId:1}");
  submitForm(f,'reject-account',{reason:'Must not save'});assert.equal(f.run('company(2).status'),'Awaiting approval');
  f.run("demoLogin('admin');rejectCompanyDialog(2)");submitForm(f,'reject-account',{reason:' '});
  assert.equal(f.run('company(2).status'),'Awaiting approval');
  submitForm(f,'reject-account',{reason:'Need more company information.'});assert.equal(f.run('company(2).status'),'Rejected');
  f.run('openCompany(2)');assert.match(f.element('dialog').innerHTML,/Reconsider existing account/);
  f.run('reconsiderCompanyDialog(2)');submitForm(f,'reconsider-account',{reason:'Additional details received externally.'});
  assert.equal(f.run('company(2).status'),'Awaiting approval');assert.equal(f.run('state.companies.length'),2);
  f.run('approveCompany(2)');assert.equal(f.run('company(2).status'),'Approved');
  assert.equal(f.run("state.audit.filter(a=>a.action==='Corporate account reopened').length"),1);
});

test('booking contact and billing snapshots survive company profile changes; future requests use new details',()=>{
  const f=fixture();f.run("demoLogin('corporate');submitRequest()");
  const before=f.run('JSON.stringify(booking(106).contactSnapshot)');
  f.data({name:'Renamed company',contact:'New contact',email:'new@example.invalid',phone:'+27 00 000 0022',address:'New billing address'});
  f.run('saveBusinessProfile(testData)');
  assert.equal(f.run('JSON.stringify(booking(106).contactSnapshot)'),before);
  assert.equal(f.run('booking(104).contactSnapshot.contact'),'Alex Morgan');
  f.run("draft.requestKey='new-intent';submitRequest()");
  assert.equal(f.run('booking(107).contactSnapshot.address'),'New billing address');
  f.run('openBooking(106)');assert.match(f.element('dialog').innerHTML,/Contact &amp; billing|Contact & billing details at submission/);
  assert.match(f.element('dialog').innerHTML,/Alex Morgan/);
});

test('existing volunteers add corporate membership after signing in without losing their volunteer identity',()=>{
  const f=fixture(),registration={company:'Existing identity Ltd',contact:'Taylor Sample',email:'taylor@example.invalid',phone:'+27 00 000 0022',street:'Sample street',city:'Cape Town',postcode:'8000'};
  f.run("authMode='business'");f.data(registration);f.run('handleAuth(testData)');
  assert.equal(f.run('state.companies.length'),2);assert.match(f.element('form-error').textContent,/Sign in to your existing volunteer account/);
  f.run('demoVolunteer()');const before=f.run('JSON.stringify(state.volunteers)');
  f.run('startBusinessRegistration()');assert.equal(f.run('businessIdentity.id'),3);
  assert.match(f.element('app').innerHTML,/Using your signed-in demo identity/);
  f.data(registration);f.run('handleAuth(testData)');
  assert.equal(f.run('company().ownerVolunteerId'),3);
  assert.equal(f.run('company().emailVerified'),false);assert.equal(f.run('company().status'),'Awaiting approval');
  assert.equal(f.run('JSON.stringify(state.volunteers)'),before);
  f.run('switchToVolunteer()');assert.equal(f.run('session.volunteerId'),3);
  f.run('startBusinessRegistration()');assert.equal(f.run('session.companyId'),3);
  assert.equal(f.run('state.companies.length'),3);
});

test('new corporate accounts need email verification separately from admin approval',()=>{
  const f=fixture();f.run("authMode='business'");
  f.data({company:'Verification Co',contact:'Example contact',email:'verify@example.invalid',phone:'+27 00 000 0012',street:'Sample road',city:'Cape Town',postcode:'8000'});
  f.run('handleAuth(testData)');assert.equal(f.run('company().emailVerified'),false);
  f.run("demoLogin('admin');approveCompany(3)");assert.equal(f.run('company(3).status'),'Awaiting approval');
  f.run("demoLogin('corporate');submitRequest()");assert.equal(f.run('state.bookings.length'),2);
  f.run('verifyDemoEmail()');assert.equal(f.run('company().emailVerified'),true);
  f.run('submitRequest()');assert.equal(f.run('state.bookings.length'),2);
  f.run("demoLogin('admin');approveCompany(3);demoLogin('corporate');submitRequest()");assert.equal(f.run('booking(106).companyId'),3);
});

test('password recovery has neutral response, expired-link path and demo-only matching password success',()=>{
  const f=fixture();f.run('startRecovery()');submitForm(f,'recovery-request',{email:'unknown@example.invalid'});
  assert.match(f.element('app').innerHTML,/If an account exists/);
  assert.match(f.element('app').innerHTML,/no passwords stored or changed/);
  f.run('openDemoReset(true)');assert.match(f.element('app').innerHTML,/invalid, expired or already used/);
  f.run('openDemoReset(false)');submitForm(f,'recovery-password',{password:'fictional123',confirm:'different'});
  assert.equal(f.run('resetPreviewStage'),'valid');
  submitForm(f,'recovery-password',{password:'fictional123',confirm:'fictional123'});
  assert.equal(f.run('resetPreviewStage'),'done');assert.match(f.element('app').innerHTML,/No actual password was changed/);
  assert.equal(f.run("JSON.stringify(state).includes('fictional123')"),false);
});

test('repeated submit of the same request key returns the prior receipt without duplicate notifications or bookings',()=>{
  const f=fixture();f.run("demoLogin('corporate');submitRequest()");
  const notices=f.run('state.notifications.length'),audit=f.run('state.audit.length');
  f.run('submitRequest();submitRequest()');assert.equal(f.run('state.bookings.length'),3);
  assert.equal(f.run('state.notifications.length'),notices);assert.equal(f.run('state.audit.length'),audit);
  assert.match(f.element('toast').textContent,/No duplicate created/);
  f.run('draft.size=12;submitRequest()');assert.equal(f.run('state.bookings.length'),4);
});

test('search, filters, date ranges and pagination operate on matching records and reset the page',()=>{
  const f=fixture();f.run("demoLogin('admin');navigate('availability')");
  assert.match(f.element('app').innerHTML,/Page 1 of 3/);
  f.run("changeListPage('events',1)");assert.equal(f.run('listState.events.page'),2);
  f.run("setListFilter('events','status','Unavailable')");assert.equal(f.run('listState.events.page'),1);
  assert.match(f.element('app').innerHTML,/1 results/);
  f.run("clearListFilter('events');setListFilter('events','from','2026-11-20');setListFilter('events','to','2026-11-20')");
  assert.match(f.element('app').innerHTML,/1 results/);
  f.run("navigate('corporate');switchCorporateTab('accounts');setListFilter('accounts','query','Example Retail')");
  assert.match(f.element('app').innerHTML,/Example Retail/);assert.doesNotMatch(f.element('app').innerHTML,/alex@example.invalid/);
  f.run("switchCorporateTab('requests');setListFilter('bookings','status','Confirmed')");assert.match(f.element('app').innerHTML,/1 results/);
});

test('a different corporate company cannot open another company booking, payment, notifications or admin screens',()=>{
  const f=fixture();f.run("demoLogin('admin');secondCompanyDemo()");
  assert.doesNotMatch(f.element('app').innerHTML,/DEMO-REF-104|Alex Morgan/);
  f.run("openBooking(104);openCompany(1);navigate('implementation')");
  assert.equal(f.element('dialog').open,false);assert.equal(f.run('page'),'dashboard');
  assert.equal(f.run('visibleNotices().length'),0);
  assert.doesNotMatch(f.run('bookingTable(state.bookings)'),/GR-104|openBooking\(104\)/);
});

test('unsaved changes can block navigation/dialog closing and important decisions require confirmation',()=>{
  const f=fixture();f.run("demoLogin('admin');navigate('contact');dirtyForm=true;window.confirm=()=>false;navigate('availability')");
  assert.equal(f.run('page'),'contact');assert.equal(f.run('dirtyForm'),true);
  f.run("window.confirm=()=>true;navigate('availability');editCorporateEvent(1);dirtyForm=true;window.confirm=()=>false;closePreviewDialog()");
  assert.equal(f.element('dialog').open,true);
  f.run("window.confirm=()=>true;dirtyForm=false;paymentDeadlineDialog(105);window.confirm=()=>false");
  submitForm(f,'deadline-form',{deadline:'2026-10-20T17:00',note:'Do not save this decision.'});
  assert.equal(f.run('booking(105).deadline'),'2026-10-04T17:00:00+02:00');
});

test('backend checklist stays explicit about pending auth, atomic capacity, permissions and release testing',()=>{
  const f=fixture();f.run("demoLogin('admin');navigate('implementation');simulateCapacityReview()");
  assert.match(f.element('app').innerHTML,/No database schema, policies, authentication configuration or live APIs have been changed/);
  for(const requirement of ['idempotency','row locking','Company-level permissions','Release testing','mobile','WMS'])assert.match(f.element('app').innerHTML,new RegExp(requirement));
  assert.match(f.element('capacity-demo').textContent,/Request 2: declined/);
  assert.match(f.element('capacity-demo').textContent,/sequential example/);
  f.run("demoLogin('corporate');submitRequest();openBooking(106)");
  assert.match(f.element('dialog').innerHTML,/Booking status &amp; action history|Booking status & action history/);
  assert.match(f.element('dialog').innerHTML,/Alex Morgan \(corporate\)/);
  assert.equal(f.run('state.audit[0].status'),'Requested');
});

test('editing a corporate date preserves bookings and payments, notifies companies and does not alter other dates',()=>{
  const f=fixture();f.run("demoLogin('admin');editCorporateEvent(1)");
  submitForm(f,'event-edit',editedEvent());
  assert.equal(f.run('slot(1).date'),'2026-11-06');assert.equal(f.run('booking(104).status'),'Confirmed');
  assert.equal(f.run('booking(104).payment.reference'),'DEMO-REF-104');
  assert.equal(f.run('activities[slot(2).activity].name'),'Example corporate event');
  assert.equal(f.run('activities[slot(1).activity].name'),'Updated corporate session');
  assert.ok(f.run("state.audit.some(a=>a.action==='Corporate event updated'&&a.detail.includes('2026-11-05'))"));
  f.run("demoLogin('corporate');goToNotice(state.notifications.find(n=>n.title==='Corporate event updated').id)");
  assert.match(f.element('dialog').innerHTML,/New sample venue/);
  assert.match(f.element('dialog').innerHTML,/10:15/);
});

test('event editing rejects invalid times and reductions below accepted reservations or group limits',()=>{
  const f=fixture();f.run("demoLogin('admin');editCorporateEvent(1)");
  submitForm(f,'event-edit',editedEvent({capacity:'19',max:'19'}));
  assert.equal(f.run('slot(1).capacity'),50);assert.match(f.element('form-error').textContent,/conflict/);
  submitForm(f,'event-edit',editedEvent({min:'21'}));assert.equal(f.run('slot(1).min'),1);
  submitForm(f,'event-edit',editedEvent({start:'25:15'}));assert.equal(f.run('slot(1).start'),'09:15');
  f.run("demoLogin('corporate');editCorporateEvent(1)");
  assert.equal(f.run('slot(1).date'),'2026-11-05');
});

test('cancelling an event cancels its requests and paid reservations, retains history and cannot be republished',()=>{
  const f=fixture();f.run("demoLogin('corporate');draft.slotId=1;draft.size=10;submitRequest();demoLogin('admin');cancelCorporateEvent(1)");
  submitForm(f,'event-cancel',{reason:'Venue unavailable; contact team about external refund.'});
  assert.equal(f.run('slot(1).cancelled'),true);assert.equal(f.run('booking(104).status'),'Cancelled');
  assert.equal(f.run('booking(106).status'),'Cancelled');assert.equal(f.run('remaining(1)'),50);
  assert.equal(f.run('booking(104).payment.reference'),'DEMO-REF-104');
  assert.equal(f.run('booking(105).status'),'Pending payment');
  assert.equal(f.run("state.notifications.filter(n=>n.title==='Corporate event cancelled').length"),2);
  f.run('toggleSlot(1)');assert.equal(f.run('slot(1).active'),false);assert.equal(f.run('reservable(slot(1))'),false);
});

test('cancelling an amendment target preserves the original booking and tells the company',()=>{
  const f=fixture();f.run("demoLogin('corporate');amendmentDialog(104)");
  submitForm(f,'amendment-form',{slot:'3',size:'15',reason:'Afternoon requested.'});
  f.run("demoLogin('admin');cancelCorporateEvent(3)");submitForm(f,'event-cancel',{reason:'Target session unavailable.'});
  assert.equal(f.run('booking(104).slotId'),1);assert.equal(f.run('booking(104).status'),'Confirmed');
  assert.equal(f.run('booking(104).amendment'),null);assert.equal(f.run('remaining(1)'),30);
  assert.ok(f.run("state.notifications.some(n=>n.title==='Booking change declined'&&n.message.includes('Original booking unchanged'))"));
});

test('completion requires an ended confirmed booking and records actual attendance and optional group hours',()=>{
  const f=fixture();f.run("demoLogin('admin');completeBookingDialog(104)");
  assert.equal(f.element('completion-form').onsubmit,undefined);
  f.run('finishDemoEvent(104);completeBookingDialog(104)');
  submitForm(f,'completion-form',{attended:'21',hours:'',note:'Too many.'});assert.equal(f.run('booking(104).status'),'Confirmed');
  submitForm(f,'completion-form',{attended:'',hours:'',note:'Missing count.'});assert.equal(f.run('booking(104).status'),'Confirmed');
  submitForm(f,'completion-form',{attended:'17',hours:'',note:'17 people attended; no hours recorded.'});
  assert.equal(f.run('booking(104).status'),'Completed');assert.equal(f.run('booking(104).completion.attended'),17);
  assert.equal(f.run('booking(104).completion.hours'),null);assert.equal(f.run('remaining(1)'),30);
  assert.equal(f.run('booking(104).payment.reference'),'DEMO-REF-104');
  f.run("demoLogin('corporate');goToNotice(state.notifications.find(n=>n.title==='Group booking completed').id)");
  assert.match(f.element('dialog').innerHTML,/17 of 20/);assert.doesNotMatch(f.element('dialog').innerHTML,/Request cancellation|Request booking change/);
});

test('attendance corrections preserve earlier records and zero attendance cannot create positive hours',()=>{
  const f=fixture();f.run("demoLogin('admin');finishDemoEvent(104);completeBookingDialog(104)");
  submitForm(f,'completion-form',{attended:'0',hours:'3',note:'Invalid hours for no attendees.'});
  assert.equal(f.run('booking(104).status'),'Confirmed');
  submitForm(f,'completion-form',{attended:'0',hours:'0',note:'Nobody attended.'});
  f.run('completeBookingDialog(104)');submitForm(f,'completion-form',{attended:'2',hours:'2.5',note:'Corrected against organiser register.'});
  assert.equal(f.run('booking(104).completion.attended'),2);assert.equal(f.run('booking(104).completion.hours'),2.5);
  assert.equal(f.run('booking(104).completionHistory[0].attended'),0);
  assert.ok(f.run("state.audit.some(a=>a.action==='Corporate attendance corrected')"));
  f.run('rejectBookingDialog(104);paymentDeadlineDialog(104);cancelCorporateEvent(1)');
  assert.equal(f.run('booking(104).status'),'Completed');assert.equal(f.run('slot(1).cancelled'),undefined);
});

test('pending payment and unresolved changes block completion; corporate cannot record attendance',()=>{
  const f=fixture();f.run("demoLogin('admin');state.now='2026-11-20T12:00:00+02:00';completeBookingDialog(105)");
  assert.equal(f.element('completion-form').onsubmit,undefined);
  f.run("booking(104).amendment={slotId:3,size:15,reason:'Open change'};completeBookingDialog(104)");
  assert.equal(f.element('completion-form').onsubmit,undefined);
  f.run("booking(104).amendment=null;demoLogin('corporate');completeBookingDialog(104)");
  assert.equal(f.element('completion-form').onsubmit,undefined);assert.equal(f.run('booking(104).status'),'Confirmed');
});

test('requests do not hold capacity; acceptance rechecks capacity against competing requests', () => {
  const f=fixture();
  f.run("demoLogin('corporate');draft.size=35;submitRequest();draft.requestKey='second-intent';submitRequest()");
  assert.equal(f.run('remaining(2)'),50);
  f.run("demoLogin('admin');paymentDeadlineDialog(106)");
  submitForm(f,'deadline-form',{deadline:'2026-10-20T17:00',note:'Accepted after review.'});
  assert.equal(f.run('remaining(2)'),15);
  f.run('paymentDeadlineDialog(107)');
  submitForm(f,'deadline-form',{deadline:'2026-10-20T17:00',note:'Second competing request.'});
  assert.equal(f.run('booking(107).status'),'Requested');
  assert.match(f.element('form-error').textContent,/Cannot accept/);
  assert.equal(f.run('remaining(2)'),15);
  // Even a stray individual count cannot affect corporate capacity.
  f.run('slot(2).individuals=999');assert.equal(f.run('remaining(2)'),15);
});

test('closed events cannot be accepted and corporate cannot perform admin acceptance', () => {
  const f=fixture();f.run("demoLogin('corporate');submitRequest();paymentDeadlineDialog(106)");
  assert.equal(f.element('deadline-form').onsubmit,undefined);
  f.run("demoLogin('admin');paymentDeadlineDialog(106);toggleSlot(2)");
  submitForm(f,'deadline-form',{deadline:'2026-10-20T17:00',note:'Attempt closed event.'});
  assert.equal(f.run('booking(106).status'),'Requested');
});

test('paid amendments retain the original until reviewed, then reserve new places pending additional payment', () => {
  const f=fixture();f.run("demoLogin('corporate');amendmentDialog(104)");
  submitForm(f,'amendment-form',{slot:'3',size:'15',reason:'Move paid booking.'});
  assert.equal(f.run('remaining(1)'),30);assert.equal(f.run('remaining(3)'),40);
  f.run("demoLogin('admin');additionalPaymentDialog(104)");
  submitForm(f,'additional-payment',{amount:'125.50',deadline:'2026-10-16T17:00',note:'Extra payment agreed externally.'});
  assert.equal(f.run('booking(104).status'),'Pending additional payment');
  assert.equal(f.run('remaining(1)'),50);assert.equal(f.run('remaining(3)'),25);
  assert.equal(f.run('booking(104).payment.reference'),'DEMO-REF-104');
  f.run('advanceClock();advanceClock()');assert.equal(f.run('isOverdue(booking(104))'),true);
  assert.equal(f.run('remaining(3)'),25);
  f.run('recordPaymentDialog(104)');
  submitForm(f,'payment-form',{reference:'EXTRA-104',received:'2026-10-17',note:'Extra payment verified.'});
  assert.equal(f.run('booking(104).status'),'Confirmed');
  assert.equal(f.run('booking(104).paymentHistory[0].reference'),'DEMO-REF-104');
  assert.equal(f.run('booking(104).payment.reference'),'EXTRA-104');
});

test('cancellation requires admin review, keeps paid history and only releases places on approval', () => {
  const f=fixture();f.run("demoLogin('corporate');requestCancellationDialog(104)");
  submitForm(f,'cancellation-form',{reason:'Cannot attend.'});assert.equal(f.run('remaining(1)'),30);
  f.run("demoLogin('admin');decideCancellation(104,false)");
  assert.equal(f.run('booking(104).status'),'Confirmed');assert.equal(f.run('remaining(1)'),30);
  f.run("demoLogin('corporate');requestCancellationDialog(104)");submitForm(f,'cancellation-form',{reason:'Please reconsider.'});
  f.run("demoLogin('admin');decideCancellation(104,true)");
  submitForm(f,'cancel-review',{note:'Agreed; refund discussed externally.'});
  assert.equal(f.run('booking(104).status'),'Cancelled');assert.equal(f.run('remaining(1)'),50);
  assert.equal(f.run('booking(104).payment.reference'),'DEMO-REF-104');
  assert.equal(f.run('company(1).status'),'Approved');
  assert.ok(f.run("state.notifications.some(n=>n.title==='Booking cancelled')"));
});

test('business profile editing preserves approval and login email and notifies admin with navigation', () => {
  const f=fixture();f.run("demoLogin('corporate');navigate('account')");
  submitForm(f,'corporate-profile',{name:'Updated Foods',contact:'New Contact',email:'contact@example.invalid',phone:'+27 00 000 0044',address:'New sample address'});
  assert.equal(f.run('company().status'),'Approved');assert.equal(f.run('company().loginEmail'),'alex@example.invalid');
  assert.ok(f.run("state.audit.some(a=>a.action==='Corporate profile updated'&&a.detail.includes('New Contact'))"));
  f.run("logout();authMode='signin'");f.data({email:'alex@example.invalid'});f.run('handleAuth(testData)');
  assert.equal(f.run('session.companyId'),1);
  f.run("demoLogin('admin');goToNotice(state.notifications.find(n=>n.title==='Corporate profile updated').id)");
  assert.match(f.element('dialog').innerHTML,/Updated Foods/);
});

test('contact settings start blank and volunteer missing-phone gate permits profile correction', () => {
  const f=fixture();f.run("demoLogin('corporate');showContact()");
  assert.match(f.element('dialog').innerHTML,/Contact details not yet provided/);
  assert.doesNotMatch(f.element('dialog').innerHTML,/mailto:|tel:/);
  f.run("demoLogin('admin');navigate('contact')");submitForm(f,'contact-form',{email:'approved@example.invalid',phone:''});
  f.run("demoLogin('corporate');showContact()");assert.match(f.element('dialog').innerHTML,/mailto:approved@example.invalid/);
  f.run('demoVolunteer();simulateVolunteerBooking()');assert.equal(f.run('page'),'account');
  submitForm(f,'volunteer-phone',{name:'Taylor Sample',email:'taylor@example.invalid',phone:'+27 00 000 0099'});
  f.run('simulateVolunteerBooking()');assert.match(f.element('toast').textContent,/check passed/);
  assert.equal(f.run('state.bookings.length'),2);
});

test('admin-defined events enforce group limits and escape authored display text', () => {
  const f=fixture();f.run("demoLogin('admin');addSlotDialog()");
  submitForm(f,'slot-form',{title:'<img src=x onerror=alert(1)>',location:'Sample location',description:'Group session',date:'2026-11-22',start:'09:15',end:'10:15',capacity:'12',min:'5',max:'8'});
  assert.equal(f.run('slot(9).max'),8);assert.equal(f.run('fits(slot(9),4)'),false);assert.equal(f.run('fits(slot(9),9)'),false);
  f.run("demoLogin('corporate');draft.activity=3;draft.slotId=9");
  assert.match(f.run('bookingScreen()'),/&lt;img/);assert.doesNotMatch(f.run('bookingScreen()'),/<img src=x/);
  f.run('draft.size=9;submitRequest()');assert.equal(f.run('state.bookings.length'),2);
  f.run('draft.size=8;submitRequest()');assert.equal(f.run('remaining(9)'),12);
  assert.match(f.run('bookingTable(state.bookings)'),/&lt;img/);
});

test('preview registers a corporate MPC, requires approval, then creates a booking without real authentication', () => {
  const f = fixture();
  assert.match(f.element('app').innerHTML, /Business registration/);
  f.run("authMode='business'");
  f.data({ company: 'Test Company', contact: 'Test Contact', email: 'test@example.invalid', phone: '+27 00 000 0022', street: '12 Demo Street', city: 'Cape Town', postcode: '8000' });
  f.run('handleAuth(testData)');
  assert.equal(f.run('company().status'), 'Awaiting approval');
  assert.match(f.run('bookingScreen()'), /Verify your business email/);
  f.run('verifyDemoEmail()');
  assert.match(f.run('bookingScreen()'), /awaiting review/);
  f.run("demoLogin('admin');approveCompany(3);demoLogin('corporate');draft.slotId=2;draft.size=20;submitRequest()");
  assert.equal(f.run('booking(106).companyId'), 3);
  assert.equal(f.run('booking(106).status'), 'Requested');
  assert.equal(f.run('remaining(2)'), 50);
  assert.ok(f.run("state.notifications.some(n=>n.role==='admin'&&n.title==='New booking request')"));
});

test('payment deadlines flag overdue without releasing places, can be extended, and payment is recorded before confirmation', () => {
  const f = fixture();
  f.run("demoLogin('corporate');submitRequest();demoLogin('admin');paymentDeadlineDialog(106)");
  f.data({ deadline: '2026-10-16T11:00', note: 'External instructions discussed.' });
  // Bind uses FormData(form), so replace its constructor in the VM for handler tests.
  f.run('FormData = function(){return testData};');
  f.element('deadline-form').onsubmit({ preventDefault() {}, currentTarget: {} });
  assert.equal(f.run('booking(106).status'), 'Pending payment');
  f.run('advanceClock();advanceClock()');
  assert.equal(f.run('isOverdue(booking(106))'), true);
  assert.equal(f.run('remaining(2)'), 30);
  f.run('paymentDeadlineDialog(106)');
  f.data({ deadline: '2026-10-20T17:00', note: 'Called MPC; agreed to wait.' });
  f.element('deadline-form').onsubmit({ preventDefault() {}, currentTarget: {} });
  assert.equal(f.run('isOverdue(booking(106))'), false);
  f.run('recordPaymentDialog(106)');
  f.data({ reference: 'DEMO-106', received: '2026-10-17', note: 'Receipt verified externally.' });
  f.element('payment-form').onsubmit({ preventDefault() {}, currentTarget: {} });
  assert.equal(f.run('booking(106).status'), 'Confirmed');
  assert.equal(f.run('booking(106).payment.reference'), 'DEMO-106');
  assert.equal(f.run('booking(106).payment.admin'), 'Demo administrator');
  assert.ok(f.run("state.audit.some(a=>a.action==='Payment deadline set'&&a.detail.includes('agreed to wait'))"));
});

test('amendments preserve original bookings until admin approval; rejection releases capacity without revoking corporate access', () => {
  const f = fixture();
  f.run("demoLogin('corporate');submitRequest();amendmentDialog(106)");
  f.data({ slot: '3', size: '15', reason: 'Team needs an afternoon shift.' });
  f.run('FormData = function(){return testData};');
  f.element('amendment-form').onsubmit({ preventDefault() {}, currentTarget: {} });
  assert.equal(f.run('booking(106).slotId'), 2);
  assert.equal(f.run('remaining(3)'), 40);
  assert.ok(f.run("state.notifications.some(n=>n.role==='admin'&&n.title==='Booking change requested')"));
  f.run("demoLogin('admin');decideAmendment(106,true)");
  assert.equal(f.run('booking(106).slotId'), 3);
  assert.equal(f.run('remaining(2)'), 50);
  // An amended request is still only a request. Accept it before any capacity is held.
  assert.equal(f.run('remaining(3)'), 40);
  f.run('paymentDeadlineDialog(106)');
  f.data({ deadline:'2026-10-20T17:00', note:'Request accepted after reviewing capacity.' });
  f.element('deadline-form').onsubmit({ preventDefault() {}, currentTarget:{} });
  assert.equal(f.run('remaining(3)'), 25);
  f.run('rejectBookingDialog(106)');
  f.data({ reason: 'Unable to accommodate; external follow-up completed.' });
  f.element('reject-booking').onsubmit({ preventDefault() {}, currentTarget: {} });
  assert.equal(f.run('remaining(3)'), 40);
  assert.equal(f.run('company(1).status'), 'Approved');
  assert.ok(f.run("state.notifications.some(n=>n.title==='Booking rejected')"));
});

test('notifications navigate to the exact account or booking and mark it read', () => {
  const f = fixture();
  f.run("authMode='business'");
  f.data({ company: 'Navigation Company', contact: 'Contact', email: 'navigation@example.invalid', phone: '+27 00 000 0033', street: 'Test Street', city: 'Cape Town', postcode: '8000' });
  f.run("handleAuth(testData);verifyDemoEmail();demoLogin('admin');navigate('notifications')");
  assert.match(f.element('app').innerHTML, /Go to account/);
  f.run("goToNotice(state.notifications.find(n=>n.title==='Corporate account awaiting approval').id)");
  assert.equal(f.run('page'), 'corporate');
  assert.equal(f.run('corporateTab'), 'accounts');
  assert.match(f.element('dialog').innerHTML, /Navigation Company/);
  assert.equal(f.run("state.notifications.find(n=>n.title==='Corporate account awaiting approval').read"), true);
  f.run("approveCompany(3);demoLogin('corporate');goToNotice(state.notifications.find(n=>n.title==='Business account approved').id)");
  assert.equal(f.run('page'), 'book');
  f.run("submitRequest();demoLogin('admin');navigate('notifications')");
  assert.match(f.element('app').innerHTML, /Go to booking/);
  f.run("goToNotice(state.notifications.find(n=>n.title==='New booking request').id)");
  assert.equal(f.run('corporateTab'), 'requests');
  assert.match(f.element('dialog').innerHTML, /GR-106/);
  assert.equal(f.run("state.notifications.find(n=>n.title==='New booking request').read"), true);
});

test('notification links respect the active recipient and handle missing records safely', () => {
  const f = fixture();
  f.run("demoLogin('corporate');addNotice('admin',null,'Admin only','Private',{kind:'booking',id:104});goToNotice(2)");
  assert.equal(f.run('state.notifications[1].read'), false);
  f.run("goToNotice(1)");
  assert.match(f.element('dialog').innerHTML, /GR-105/);
  f.run("addNotice('corporate',1,'Missing booking','Gone',{kind:'booking',id:999});goToNotice(3)");
  assert.equal(f.run('state.notifications[2].read'), false);
  assert.match(f.element('toast').textContent, /no longer available/);
  f.run("addNotice('corporate',1,'Other company','Not yours',{kind:'booking',id:104});session={role:'corporate',companyId:2};goToNotice(4)");
  assert.equal(f.run('state.notifications[3].read'), false);
});

test('admin publishes availability; directory search and missing cellphone flags are simulated', () => {
  const f = fixture();
  f.run("demoLogin('admin');addSlotDialog()");
  f.data({ title:'Corporate event authored by admin', location:'Example venue', description:'Sample description', date: '2026-11-13', start: '09:15', end: '10:15', capacity: '25', min:'1', max:'' });
  f.run('FormData = function(){return testData};');
  f.element('slot-form').onsubmit({ preventDefault() {}, currentTarget: {} });
  assert.equal(f.run('slot(9).active'), true);
  assert.equal(f.run('remaining(9)'), 25);
  f.run("demoLogin('corporate');draft.activity=3;draft.slotId=9");
  assert.match(f.run('calendar()'), /selectSlot\(9\)/);
  f.run("demoLogin('admin');volunteerSearch='Jordan'");
  assert.equal(f.run('volunteerRows().length'), 1);
  f.run("volunteerSearch=''");
  assert.match(f.run('volunteerTable()'), /Number needed/);
  f.run('resetDemo()');
  assert.equal(f.run('session'), null);
  assert.equal(f.run('state.slots.length'), 8);
});
