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

test('preview registers a corporate MPC, requires approval, then creates a booking without real authentication', () => {
  const f = fixture();
  assert.match(f.element('app').innerHTML, /Business registration/);
  f.run("authMode='business'");
  f.data({ company: 'Test Company', contact: 'Test Contact', email: 'test@example.invalid', phone: '+27 00 000 0022', street: '12 Demo Street', city: 'Cape Town', postcode: '8000' });
  f.run('handleAuth(testData)');
  assert.equal(f.run('company().status'), 'Awaiting approval');
  assert.match(f.run('bookingScreen()'), /awaiting review/);
  f.run("demoLogin('admin');approveCompany(3);demoLogin('corporate');draft.slotId=2;draft.size=20;submitRequest()");
  assert.equal(f.run('booking(106).companyId'), 3);
  assert.equal(f.run('booking(106).status'), 'Requested');
  assert.equal(f.run('remaining(2)'), 20);
  assert.ok(f.run("state.notifications.some(n=>n.role==='admin'&&n.title==='New booking request')"));
});

test('payment deadlines flag overdue without releasing places, can be extended, and payment is recorded before confirmation', () => {
  const f = fixture();
  f.run("demoLogin('corporate');submitRequest();demoLogin('admin');paymentDeadlineDialog(106)");
  f.data({ deadline: '2026-10-06T11:00', note: 'External instructions discussed.' });
  // Bind uses FormData(form), so replace its constructor in the VM for handler tests.
  f.run('FormData = function(){return testData};');
  f.element('deadline-form').onsubmit({ preventDefault() {}, currentTarget: {} });
  assert.equal(f.run('booking(106).status'), 'Pending payment');
  f.run('advanceClock();advanceClock()');
  assert.equal(f.run('isOverdue(booking(106))'), true);
  assert.equal(f.run('remaining(2)'), 20);
  f.run('paymentDeadlineDialog(106)');
  f.data({ deadline: '2026-10-10T17:00', note: 'Called MPC; agreed to wait.' });
  f.element('deadline-form').onsubmit({ preventDefault() {}, currentTarget: {} });
  assert.equal(f.run('isOverdue(booking(106))'), false);
  f.run('recordPaymentDialog(106)');
  f.data({ reference: 'DEMO-106', received: '2026-10-07', note: 'Receipt verified externally.' });
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
  assert.equal(f.run('remaining(3)'), 30);
  assert.ok(f.run("state.notifications.some(n=>n.role==='admin'&&n.title==='Booking change requested')"));
  f.run("demoLogin('admin');decideAmendment(106,true)");
  assert.equal(f.run('booking(106).slotId'), 3);
  assert.equal(f.run('remaining(2)'), 40);
  assert.equal(f.run('remaining(3)'), 15);
  f.run('rejectBookingDialog(106)');
  f.data({ reason: 'Unable to accommodate; external follow-up completed.' });
  f.element('reject-booking').onsubmit({ preventDefault() {}, currentTarget: {} });
  assert.equal(f.run('remaining(3)'), 30);
  assert.equal(f.run('company(1).status'), 'Approved');
  assert.ok(f.run("state.notifications.some(n=>n.title==='Booking rejected')"));
});

test('notifications navigate to the exact account or booking and mark it read', () => {
  const f = fixture();
  f.run("authMode='business'");
  f.data({ company: 'Navigation Company', contact: 'Contact', email: 'navigation@example.invalid', phone: '+27 00 000 0033', street: 'Test Street', city: 'Cape Town', postcode: '8000' });
  f.run("handleAuth(testData);demoLogin('admin');navigate('notifications')");
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
  f.data({ activity: '0', date: '2026-11-13', start: '09:15', end: '10:15', capacity: '25' });
  f.run('FormData = function(){return testData};');
  f.element('slot-form').onsubmit({ preventDefault() {}, currentTarget: {} });
  assert.equal(f.run('slot(9).active'), true);
  assert.equal(f.run('remaining(9)'), 25);
  f.run("demoLogin('corporate');draft.activity=0;draft.slotId=9");
  assert.match(f.run('calendar()'), /draft.slotId=9/);
  f.run("demoLogin('admin');volunteerSearch='Jordan'");
  assert.equal(f.run('volunteerRows().length'), 1);
  f.run("volunteerSearch=''");
  assert.match(f.run('volunteerTable()'), /Number needed/);
  f.run('resetDemo()');
  assert.equal(f.run('session'), null);
  assert.equal(f.run('state.slots.length'), 8);
});
