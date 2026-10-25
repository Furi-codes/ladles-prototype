import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { test } from 'node:test';
import React from 'react';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url)), require = createRequire(import.meta.url);
const tick = () => new Promise(resolve => setImmediate(resolve));
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree?.props ? [tree, ...nodes(tree.props.children)] : [];
const textContent = tree => typeof tree === 'string' ? tree : Array.isArray(tree) ? tree.map(textContent).join(' ') : tree?.props ? textContent(tree.props.children) : '';

// Run actual component handlers with fake Auth and hooks. These tests never send email or change a password.
function fixture(auth = {}, extra = {}) {
  const state = [], effects = [], cache = new Map(), routes = [];
  let cursor = 0;
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; },
    useRef(initial) { const i = cursor++; if (!(i in state)) state[i] = { current: initial }; return state[i]; },
    useId() { const i = cursor++; if (!(i in state)) state[i] = 'fixture-id-' + i; return state[i]; },
    useMemo(calculate, deps) { const i = cursor++; if (!state[i] || deps.some((value, n) => value !== state[i].deps[n])) state[i] = { deps, value: calculate() }; return state[i].value; },
    useCallback(callback, deps) { const i = cursor++; if (!state[i] || deps.some((value, n) => value !== state[i].deps[n])) state[i] = { deps, callback }; return state[i].callback; },
    useEffect(effect, deps) { const i = cursor++; if (!state[i] || deps.some((value, n) => value !== state[i].deps[n])) { state[i]?.cleanup?.(); state[i] = { deps }; effects.push(() => { state[i].cleanup = effect(); }); } },
  };
  const router = { replace: path => routes.push(path), push: path => routes.push(path) };
  function load(path) {
    const full = resolve(root, path); if (cache.has(full)) return cache.get(full).exports;
    const compiledModule = { exports: {} }; cache.set(full, compiledModule);
    const code = ts.transpileModule(readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const dependency = name => {
      if (name in extra) return extra[name];
      if (name === 'react') return { ...React, ...hooks };
      if (name === 'next/navigation') return { useRouter: () => router, useSearchParams: () => new URLSearchParams(globalThis.window?.location.search || ''), usePathname: () => globalThis.window?.location.pathname || '/corporate' };
      if (name === '@/lib/supabase') return { supabase: { auth, from() { throw new Error('Unexpected profile query'); } } };
      if (name === '@/lib/feature-flags') return { corporateRolloutEnabled: false };
      if (name === '@/lib/actions/account-routing') return { accountLandingPath: async () => '/volunteer' };
      if (name === 'next/link' || name === 'next/image' || name.endsWith('/ThemeToggle') || name === './ThemeToggle') return { __esModule: true, default: () => null };
      if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      if (name.startsWith('@/') || name.startsWith('.')) {
        const base = name.startsWith('@/') ? resolve(root, name.slice(2)) : resolve(dirname(full), name);
        for (const suffix of ['', '.ts', '.tsx']) if (existsSync(base + suffix)) return load(base + suffix);
      }
      return require(name);
    };
    vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: full })(dependency, compiledModule, compiledModule.exports);
    return compiledModule.exports;
  }
  return {
    load, routes,
    render(component, props) { cursor = 0; return component(props); },
    async effects() { effects.splice(0).forEach(run => run()); await tick(); },
    unmount() { state.forEach(slot => slot?.cleanup?.()); },
  };
}
function browser(t, search = '', hash = '') {
  const previous = globalThis.window;
  const events = new EventTarget();
  globalThis.window = { location: { search, hash, origin: 'https://portal.example.invalid' }, addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events), dispatchEvent: events.dispatchEvent.bind(events) };
  t.after(() => { globalThis.window = previous; });
}
function input(tree, id, value) { nodes(tree).find(node => node.props.id === id).props.onChange({ target: { value } }); }
const submit = tree => nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });

test('admin navigation groups volunteer and corporate destinations, keeps Settings last and closes the mobile menu on selection', t => {
  browser(t); window.location.pathname = '/admin/corporate-reports';
  for (const enabled of [true, false]) {
    const f = fixture({}, { '@/lib/feature-flags': { corporateRolloutEnabled: enabled, corporateBookingsEnabled: enabled, corporateOutcomesEnabled: enabled } });
    let closed = 0;
    const sidebar = f.load('app/admin/components/Sidebar.tsx').default;
    const tree = f.render(sidebar, { isOpen: true, onClose: () => { closed++; } });
    assert.equal(tree.props.role, 'dialog');
    const groups = nodes(tree).filter(n => n.props.role === 'group');
    assert.deepEqual(groups.map(n => n.props['aria-labelledby']), enabled ? ['volunteer-navigation-title', 'corporate-navigation-title'] : ['volunteer-navigation-title']);
    const volunteerLinks = nodes(groups[0]).filter(n => n.props.href);
    assert.deepEqual(volunteerLinks.map(n => n.props.href), ['/admin', '/admin/events', '/admin/volunteers', ...(enabled ? ['/admin/directory'] : []), '/admin/reports']);
    assert.equal(nodes(tree).filter(n => n.props.href).at(-1).props.href, '/admin/settings');
    assert.doesNotMatch(textContent(tree), /Admin workspace|Insights & organisation/);
    if (enabled) {
      const links = nodes(groups[1]).filter(n => n.props.href);
      assert.deepEqual(links.map(n => n.props.href), ['/admin/corporate-bookings', '/admin/corporate-accounts', '/admin/corporate-reports']);
      assert.equal(links[2].props['aria-current'], 'page'); links[2].props.onClick(); assert.equal(closed, 1);
    }
  }
});

test('roster picker searches without changing the roster and supports keyboard selection, dismissal and result scrolling', async t => {
  const previous=globalThis.document,events=new EventTarget(),scrolled=[];
  globalThis.document={addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),getElementById:id=>({scrollIntoView:options=>scrolled.push([id,options])})};
  t.after(()=>{globalThis.document=previous;});
  const selected=[],f=fixture(),picker=f.load('app/admin/components/RosterEventPicker.tsx').default;
  const props={events:[{id:1,title:'Kitchen event',date:'2020-10-01',location:'Kitchen'},{id:2,title:'Warehouse event',date:'2020-10-02',location:'Warehouse'},{id:3,title:'A third event',date:'2020-10-03',location:'Warehouse'}],value:'1',onChange:id=>selected.push(id)};
  let tree=f.render(picker,props),combo=nodes(tree).find(n=>n.props.role==='combobox');
  assert.equal(combo.props.value,'Kitchen event');assert.equal(combo.props['aria-expanded'],false);
  combo.props.onFocus();tree=f.render(picker,props);await f.effects();
  assert.equal(nodes(tree).filter(n=>n.props.role==='option').length,3);assert.equal(scrolled.at(-1)[1].block,'nearest');
  combo=nodes(tree).find(n=>n.props.role==='combobox');combo.props.onChange({target:{value:'Warehouse'}});tree=f.render(picker,props);
  assert.equal(nodes(tree).filter(n=>n.props.role==='option').length,2);assert.deepEqual(selected,[]);
  let prevented=0;const key=key=>({key,preventDefault(){prevented++;},stopPropagation(){}});
  nodes(tree).find(n=>n.props.role==='combobox').props.onKeyDown(key('ArrowDown'));tree=f.render(picker,props);
  const active=nodes(tree).find(n=>n.props.role==='combobox').props['aria-activedescendant'];
  assert.equal(nodes(tree).find(n=>n.props.id===active).props.children[0].props.children[0].props.children,'A third event');
  nodes(tree).find(n=>n.props.role==='combobox').props.onKeyDown(key('Enter'));props.value=selected.at(-1);tree=f.render(picker,props);
  assert.deepEqual(selected,['3']);assert.equal(nodes(tree).find(n=>n.props.role==='combobox').props['aria-expanded'],false);assert.equal(prevented,2);
  nodes(tree).find(n=>n.props.role==='combobox').props.onFocus();tree=f.render(picker,props);
  nodes(tree).find(n=>n.props.role==='combobox').props.onChange({target:{value:'No such event'}});tree=f.render(picker,props);
  assert.match(textContent(tree),/No matching events/);assert.equal(nodes(tree).find(n=>n.props.role==='combobox').props['aria-activedescendant'],undefined);
  nodes(tree).find(n=>n.props.role==='combobox').props.onKeyDown(key('Enter'));assert.deepEqual(selected,['3']);
  nodes(tree).find(n=>n.props.role==='combobox').props.onKeyDown(key('Escape'));tree=f.render(picker,props);
  assert.equal(nodes(tree).find(n=>n.props.role==='combobox').props.value,'A third event');
  nodes(tree).find(n=>n.props.role==='combobox').props.onFocus();tree=f.render(picker,props);await f.effects();events.dispatchEvent(new Event('pointerdown'));tree=f.render(picker,props);
  assert.equal(nodes(tree).find(n=>n.props.role==='combobox').props['aria-expanded'],false);f.unmount();
});

test('roster programme and inclusive date filters keep the selected roster accurate and clear old volunteer filters', () => {
  const f=fixture(),component=f.load('app/admin/components/VolunteerAttendance.tsx').default;
  const events=[{id:1,title:'October warehouse',date:'2020-10-02',location:'Warehouse',category:'Warehouse HQ',status:'Scheduled'},{id:2,title:'October kitchen',date:'2020-10-16',location:'Kitchen',category:'Dignity Kitchen',status:'Scheduled'},{id:3,title:'November kitchen',date:'2020-11-01',location:'Kitchen',category:'Dignity Kitchen',status:'Scheduled'},{id:4,title:'Future event',date:'2099-10-01',location:'Warehouse',status:'Scheduled'},{id:5,title:'Cancelled event',date:'2020-10-20',location:'Warehouse',status:'Cancelled'}];
  const props={events,eventSlots:[],attendanceRecords:[],bookings:[{id:1,event_id:1,status:'Confirmed',volunteer_name:'Alice',selected_slot:'09:00-10:00'},{id:2,event_id:2,status:'Completed',volunteer_name:'Bob',selected_slot:'09:00-10:00'}]};
  let tree=f.render(component,props);
  nodes(tree).find(n=>n.props.role==='tab'&&textContent(n).startsWith('Past events')).props.onClick();tree=f.render(component,props);
  const getPicker=tree=>nodes(tree).find(n=>n.type?.name==='RosterEventPicker');
  assert.deepEqual(getPicker(tree).props.events.map(e=>e.id),[3,2,1]);
  nodes(tree).find(n=>n.type==='input'&&n.props.placeholder==='Name or email…').props.onChange({target:{value:'Nobody'}});tree=f.render(component,props);
  getPicker(tree).props.onChange('2');tree=f.render(component,props);assert.match(textContent(tree),/Bob/);assert.doesNotMatch(textContent(tree),/Alice/);
  nodes(tree).find(n=>n.type==='select'&&n.props.children[0].props.children==='All programmes').props.onChange({target:{value:'Dignity Kitchen'}});tree=f.render(component,props);
  assert.deepEqual(getPicker(tree).props.events.map(e=>e.id),[3,2]);
  nodes(tree).filter(n=>n.type==='input'&&n.props.type==='date')[0].props.onChange({target:{value:'2020-10-16'}});tree=f.render(component,props);
  nodes(tree).filter(n=>n.type==='input'&&n.props.type==='date')[1].props.onChange({target:{value:'2020-10-16'}});tree=f.render(component,props);
  assert.deepEqual(getPicker(tree).props.events.map(e=>e.id),[2]);assert.equal(getPicker(tree).props.value,'2');assert.match(textContent(tree),/Bob/);
  nodes(tree).filter(n=>n.type==='input'&&n.props.type==='date')[0].props.onChange({target:{value:'2020-10-20'}});tree=f.render(component,props);
  assert.match(textContent(tree),/From date must be on or before To date/);assert.equal(getPicker(tree).props.events.length,0);assert.doesNotMatch(textContent(tree),/Bob/);
  nodes(tree).find(n=>n.props.children==='Clear event filters').props.onClick();tree=f.render(component,props);assert.equal(getPicker(tree).props.events.length,3);
  nodes(tree).find(n=>n.props.role==='tab'&&textContent(n).startsWith('Cancelled events')).props.onClick();tree=f.render(component,props);assert.deepEqual(getPicker(tree).props.events.map(e=>e.id),[5]);
});

test('business registration controls do not expose or change volunteer requirements', async t => {
  browser(t); const confirmations=[];window.confirm=message=>{confirmations.push(message);return true;};
  for(const phoneRequired of [false,true]) {
    const writes=[],dirty=[];let refreshes=0;
    const f=fixture({}, {'@/lib/actions/corporate-accounts':{setCorporateRolloutSettings:async(...values)=>writes.push(values)}});
    const form=f.load('app/admin/components/BusinessRegistrationForm.tsx').default;
    const props={initial:{registration_enabled:true,volunteer_phone_required:phoneRequired},saved:async()=>{refreshes++;},dirtyChanged:value=>dirty.push(value)};
    let tree=f.render(form,props);
    assert.equal(nodes(tree).filter(n=>n.type==='input').length,1);
    assert.doesNotMatch(textContent(tree),/volunteer|Supabase|rollout|redirect URL/i);
    nodes(tree).find(n=>n.type==='input').props.onChange({target:{checked:false}});
    assert.equal(dirty.at(-1),true);tree=f.render(form,props);await submit(tree);
    assert.deepEqual(writes,[[false,phoneRequired]]);assert.equal(dirty.at(-1),false);assert.equal(refreshes,1);
    assert.match(textContent(f.render(form,props)),/Business registration settings saved/);
  }
  assert.ok(confirmations.every(message=>message.includes('Close registration')&&!/volunteer|phone/i.test(message)));
});

test('corporate analytics has its own report route and old report-tab links lead there', async t => {
  browser(t, '?tab=reports');
  const f = fixture({}, { '@/lib/feature-flags': { corporateBookingsEnabled: true, corporateOutcomesEnabled: true } });
  const page = f.load('app/admin/corporate-reports/page.tsx').default;
  const report = f.render(page);
  assert.equal(report.type.name, 'CorporateOutcomeReports'); assert.equal(report.props.admin, true);
  const bookings = f.load('app/admin/corporate-bookings/page.tsx').default;
  const route = nodes(f.render(bookings)).find(n => n.type?.name === 'CorporateBookingRoute');
  const shortcut = f.render(route.type, route.props);
  f.render(shortcut.type, shortcut.props); await f.effects();
  assert.deepEqual(f.routes, ['/admin/corporate-reports']);
});

test('sign-in, admin loaders, volunteer attendance and corporate forms hide technical backend failures', async t => {
  browser(t, '?checkpoint=test-checkpoint'); window.confirm = () => true;
  const technical = 'permission denied for table corporate_bookings; SELECT * FROM public.profiles';
  const auth = fixture({ getSession: async () => ({ data: { session: null }, error: null }), signInWithPassword: async () => ({ data: { user: null }, error: new Error(technical) }) });
  const login = auth.load('app/components/LoginForm.tsx').default;
  let tree = auth.render(login); await auth.effects();
  input(tree, 'auth-email', 'person@example.invalid'); tree = auth.render(login); input(tree, 'auth-password', 'test-password'); tree = auth.render(login);
  await submit(tree); tree = auth.render(login);
  assert.doesNotMatch(textContent(tree), /permission denied|SELECT|public\.profiles/);
  assert.match(textContent(tree), /could not be completed|request failed/);

  const admin = fixture(), loader = async () => { throw new Error(technical); };
  const useData = admin.load('app/admin/components/FeatureShared.tsx').useFeatureData;
  admin.render(useData, loader); await admin.effects(); const result = admin.render(useData, loader);
  assert.equal(result.data, null); assert.match(result.error, /Unable to load data/); assert.doesNotMatch(result.error, /table|SELECT/);

  const volunteer = fixture({}, {
    '@/lib/actions/volunteer': { recordEventAttendance: async () => ({ data: null, error: { message: technical } }) },
    '../components/VolunteerProvider': { useVolunteerData: () => ({ refreshData: async () => {} }) },
  });
  const attendance = volunteer.load('app/volunteer/attendance/page.tsx').default;
  tree = volunteer.render(attendance); nodes(tree).find(n => n.type === 'button' && n.props.children === 'Confirm attendance').props.onClick(); await tick(); tree = volunteer.render(attendance);
  assert.match(textContent(tree), /Attendance could not be confirmed/); assert.doesNotMatch(textContent(tree), /SELECT|corporate_bookings/);

  const corporate = fixture({}, {
    '@/app/components/useUnsavedChanges': { useUnsavedChanges() {} },
    '@/lib/actions/portal-contacts': { setCorporateBookingAvailability: async () => { throw new Error(technical); } },
  });
  const controls = corporate.load('app/corporate/components/CorporateBookingControls.tsx').default;
  const props = { initial: { booking_enabled: true }, saved() {}, dirtyChanged() {} };
  tree = corporate.render(controls, props); await nodes(tree).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} }); tree = corporate.render(controls, props);
  assert.match(textContent(tree), /Booking availability could not be saved/); assert.doesNotMatch(textContent(tree), /SELECT|permission denied/);
});

test('personal reminder controls save each timing independently, block duplicate writes and refresh the inbox', async t => {
  browser(t);
  for (const portal of ['volunteer', 'corporate']) {
    let data = { portal, reminder_24h: true, reminder_2h: true }, reloads = 0, finish, fail = false;
    const writes = [], events = [];
    const eventName = portal === 'corporate' ? 'corporate-booking-notices-changed' : 'volunteer-reminder-preferences-changed';
    const onChanged = () => events.push(eventName); window.addEventListener(eventName, onChanged);
    const f = fixture({}, {
      '@/app/admin/components/FeatureShared': { useFeatureData: () => ({ data, loading: false, error: '', reload: async () => { reloads++; } }) },
      '@/lib/corporate-notifications': { corporateNoticesChanged: 'corporate-booking-notices-changed' },
      '@/lib/actions/reminder-preferences': { getReminderPreferences() {}, saveReminderPreferences: async (...args) => {
        writes.push(args); if (fail) throw Error('Connection lost. Please retry.');
        await new Promise(resolve => { finish = resolve; }); data = { portal, reminder_24h: args[1], reminder_2h: args[2] }; return data;
      } },
    });
    const component = f.load('app/components/PersonalReminderPreferences.tsx').default;
    const render = () => f.render(component, { portal });
    let tree = render(); await f.effects();
    const switch24 = nodes(tree).find(n => n.props['aria-label'] === '24-hour reminders');
    const first = switch24.props.onChange({ target: { checked: false } });
    switch24.props.onChange({ target: { checked: false } });
    assert.deepEqual(writes, [[portal, false, true]]);
    assert.ok(nodes(render()).filter(n => n.type === 'input').every(n => n.props.disabled));
    finish(); await first; await tick(); tree = render();
    assert.deepEqual(nodes(tree).filter(n => n.type === 'input').map(n => n.props.checked), [false, true]);
    assert.equal(reloads, 1); assert.equal(events.length, 1);
    fail = true; await nodes(tree).find(n => n.props['aria-label'] === '2-hour reminders').props.onChange({ target: { checked: false } });
    await tick(); tree = render(); assert.match(textContent(tree), /Connection lost/);
    assert.deepEqual(nodes(tree).filter(n => n.type === 'input').map(n => n.props.checked), [false, true], 'A failed save does not pretend the preference changed');
    assert.ok(nodes(tree).filter(n => n.type === 'input').every(n => !n.props.disabled));
    f.unmount(); window.removeEventListener(eventName, onChanged);
  }
});

test('reminder API never sends a user ID and rejects missing, mismatched or unconfirmed preference results', async () => {
  const calls = []; let response = { data: { portal: 'corporate', reminder_24h: false, reminder_2h: true }, error: null };
  const f = fixture({}, { '@/lib/supabase': { supabase: { rpc: async (...args) => { calls.push(args); return response; } } } });
  const api = f.load('lib/actions/reminder-preferences.ts');
  await api.saveReminderPreferences('corporate', false, true);
  assert.deepEqual(calls[0], ['set_personal_reminder_preferences', { p_portal: 'corporate', p_24h: false, p_2h: true }]);
  await api.getReminderPreferences('corporate');
  assert.deepEqual(calls[1], ['get_personal_reminder_preferences', { p_portal: 'corporate' }]);
  response = { data: null, error: null }; await assert.rejects(api.getReminderPreferences('corporate'), /confirmed/);
  response = { data: { portal: 'volunteer', reminder_24h: false, reminder_2h: true }, error: null }; await assert.rejects(api.getReminderPreferences('corporate'), /confirmed/);
  response.data.portal = 'corporate'; response.data.reminder_24h = true; await assert.rejects(api.saveReminderPreferences('corporate', false, true), /confirmed/);
  const before = calls.length; await assert.rejects(api.saveReminderPreferences('invalid', false, true), /valid portal/); assert.equal(calls.length, before);
  response = { data: null, error: { message: 'Internal database details' } }; await assert.rejects(api.getReminderPreferences('corporate'), /could not be loaded/);
});

test('corporate screens are available by default, with explicit emergency switches cascading to child stages', () => {
  const code=ts.transpileModule(readFileSync(resolve(root,'lib/feature-flags.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  const flags=env=>{const context={exports:{},process:{env}};vm.runInNewContext(code,context);return context.exports;};
  for(const value of Object.values(flags({}))) assert.equal(value,true);
  const off=flags({NEXT_PUBLIC_CORPORATE_ROLLOUT_ENABLED:'false'});for(const value of Object.values(off))assert.equal(value,false);
  const bookingsOff=flags({NEXT_PUBLIC_CORPORATE_BOOKINGS_ENABLED:'false'});assert.equal(bookingsOff.corporateRolloutEnabled,true);assert.equal(bookingsOff.corporateBookingsEnabled,false);assert.equal(bookingsOff.corporateChangesEnabled,false);assert.equal(bookingsOff.corporateOutcomesEnabled,false);
});

test('all entry modes share one layout and business registration switches forms without navigating away', async t => {
  browser(t);
  const f = fixture({ getSession: async () => ({ data: { session: null }, error: null }) }, { '@/lib/feature-flags': { corporateRolloutEnabled: true } });
  const component = f.load('app/components/LoginForm.tsx').default;
  let tree = f.render(component); await f.effects();
  const layout = tree.props.className;
  for (const label of ['Sign in', 'Volunteer registration', 'Business registration']) assert.ok(nodes(tree).some(node => node.type === 'button' && node.props.children === label));
  assert.doesNotMatch(textContent(tree), /Business sign in|BUSINESS PORTAL/);
  nodes(tree).find(node => node.type === 'button' && node.props.children === 'Business registration').props.onClick();
  tree = f.render(component);
  assert.equal(tree.props.className, layout); assert.match(textContent(tree), /Register your organisation/);
  assert.ok(nodes(tree).some(node => node.type?.name === 'BusinessRegistration')); assert.equal(nodes(tree).some(node => node.type === 'form'), false, 'Never nest a registration form in the sign-in form');
  assert.deepEqual(f.routes, []);
  nodes(tree).find(node => node.type === 'button' && node.props.children === 'Volunteer registration').props.onClick();
  tree = f.render(component); assert.match(textContent(tree), /First name/); assert.equal(tree.props.className, layout);
  const alias = f.load('app/corporate/register/page.tsx').default();
  assert.equal(alias.type, component); assert.equal(alias.props.initialMode, 'business');
});

test('business registration tab changes respect dirty forms and cannot interrupt a pending submission', t => {
  browser(t); let prompts = 0; window.confirm = () => { prompts++; return false; };
  const f = fixture({}, { '@/lib/feature-flags': { corporateRolloutEnabled: true } });
  const component = f.load('app/components/LoginForm.tsx').default;
  let tree = f.render(component, { initialMode: 'business' });
  const business = nodes(tree).find(node => node.type?.name === 'BusinessRegistration');
  business.props.onDirtyChange(true); tree = f.render(component, { initialMode: 'business' });
  nodes(tree).find(node => node.type === 'button' && node.props.children === 'Sign in').props.onClick();
  assert.equal(prompts, 1); assert.match(textContent(f.render(component, { initialMode: 'business' })), /Register your organisation/);
  business.props.onBusyChange(true); tree = f.render(component, { initialMode: 'business' });
  assert.ok(nodes(tree).filter(node => node.type === 'button').every(node => node.props.disabled));
  nodes(tree).find(node => node.type === 'button' && node.props.children === 'Sign in').props.onClick(); assert.equal(prompts, 1);
  business.props.onBusyChange(false); business.props.onDirtyChange(false);
  tree = f.render(component, { initialMode: 'business' });
  nodes(tree).find(node => node.type === 'button' && node.props.children === 'Sign in').props.onClick();
  assert.match(textContent(f.render(component, { initialMode: 'business' })), /Welcome back/);
});

test('password and existing-session sign-in route directly to the stored account portal without a chooser', async t => {
  browser(t);
  for (const existing of [false, true]) for (const destination of ['/volunteer', '/corporate', '/admin']) {
    const calls = [], user = { id: 'member', email: 'member@example.invalid' };
    const f = fixture({
      getSession: async () => ({ data: { session: existing ? { user } : null }, error: null }),
      signInWithPassword: async () => ({ data: { user }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    }, {
      '@/lib/feature-flags': { corporateRolloutEnabled: true },
      '@/lib/supabase': { supabase: {
        auth: {
          getSession: async () => ({ data: { session: existing ? { user } : null }, error: null }),
          signInWithPassword: async () => ({ data: { user }, error: null }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        },
        from: () => ({ select(columns) { assert.equal(columns, 'role'); return this; }, eq() { return this; }, single: async () => ({ data: { role: 'volunteer' }, error: null }) }),
      } },
      '@/lib/actions/account-routing': { accountLandingPath: async (...args) => { calls.push(args); return destination; } },
    });
    const component = f.load('app/components/LoginForm.tsx').default;
    let tree = f.render(component); await f.effects();
    if (!existing) await submit(f.render(component));
    tree = f.render(component);
    assert.doesNotMatch(textContent(tree), /Choose your workspace/); assert.deepEqual(calls, [['volunteer']]); assert.deepEqual(f.routes, [destination]);
  }
});

test('Google sign-in returns to the shared entry flow rather than directly to the volunteer portal', async t => {
  browser(t); const requests = [];
  const f = fixture({ signInWithOAuth: async input => { requests.push(input); return { error: null }; } });
  const component = f.load('app/components/LoginForm.tsx').default;
  await nodes(f.render(component)).find(node => node.type === 'button' && textContent(node).includes('Continue with Google')).props.onClick();
  assert.deepEqual(requests, [{ provider: 'google', options: { redirectTo: 'https://portal.example.invalid/' } }]);
});

test('business registration blocks adding membership to a signed-in volunteer and offers sign-out for a separate account', async t => {
  browser(t); const registrations = [], user = { id: 'volunteer', email: 'member@example.invalid', user_metadata: { full_name: 'Main Contact' } };
  const busy = []; let signOuts = 0;
  const f = fixture({ getUser: async () => ({ data: { user }, error: null }), signOut: async () => { signOuts++; return { error: null }; }, signUp: async () => assert.fail('Must not create a second Auth user while signed in') }, {
    '@/lib/actions/corporate-accounts': { getMyCorporateAccount: async () => null, cleanCorporateAccount: value => value, registerCorporateAccount: async details => registrations.push(details) },
  });
  const component = f.load('app/components/BusinessRegistration.tsx').default, props = { onSignIn() {}, onDirtyChange() {}, onBusyChange: value => busy.push(value) };
  f.render(component, props); await f.effects(); const tree = f.render(component, props);
  const form = nodes(tree).find(node => node.type?.name === 'CorporateAccountForm');
  assert.equal(form, undefined); assert.match(textContent(tree), /different email address/);
  await nodes(tree).find(node => node.type === 'button' && node.props.children === 'Sign out to register a business').props.onClick();
  assert.equal(signOuts, 1); assert.deepEqual(registrations, []); assert.deepEqual(f.routes, ['/corporate/register']); assert.deepEqual(busy, [true, false]);
});

test('new business registrations preserve verification, registration gates and corporate-only metadata in the shared layout', async t => {
  browser(t); const calls = [], details = { company_name: 'Example company', contact_name: 'Main Contact', contact_email: 'new@example.invalid', contact_phone: '+27215551234', billing_address: 'Example address' };
  let open = false;
  const f = fixture({ getUser: async () => ({ data: { user: null }, error: Object.assign(new Error('No session'), { name: 'AuthSessionMissingError' }) }), signUp: async payload => { calls.push(payload); return { data: { user: {} }, error: null }; } }, {
    '@/lib/actions/corporate-accounts': { cleanCorporateAccount: value => value, requireCorporateRegistrationOpen: async () => { if (!open) throw new Error('Business registration is not open yet.'); } },
  });
  const component = f.load('app/components/BusinessRegistration.tsx').default, props = { onSignIn() {}, onDirtyChange() {}, onBusyChange() {} };
  f.render(component, props); await f.effects();
  const registrationTree = f.render(component, props);
  assert.doesNotMatch(textContent(registrationTree), /Already have a volunteer or business login|contact email below becomes your login email/);
  assert.match(textContent(registrationTree), /Already registered\? Sign in/);
  const form = nodes(registrationTree).find(node => node.type?.name === 'CorporateAccountForm');
  await assert.rejects(form.props.submit(details, 'Example-123!'), /not open yet/); assert.equal(calls.length, 0);
  await assert.rejects(form.props.submit(details, 'short'), /8–128/); assert.equal(calls.length, 0);
  open = true; await form.props.submit(details, 'Example-123!');
  assert.deepEqual(calls, [{ email: details.contact_email, password: 'Example-123!', options: { emailRedirectTo: 'https://portal.example.invalid/corporate', data: { full_name: details.contact_name, phone: details.contact_phone, registration_kind: 'corporate', corporate_details: details } } }]);
  assert.match(textContent(f.render(component, props)), /If this address can be registered/); assert.match(textContent(f.render(component, props)), /volunteer email cannot be reused/);
  assert.deepEqual(f.routes, []);
});

test('business account checks fail with Retry instead of showing a new-account form against an unknown session', async t => {
  browser(t); let available = false;
  const f = fixture({ getUser: async () => { if (!available) throw new Error('Account connection unavailable'); return { data: { user: null }, error: null }; } });
  const component = f.load('app/components/BusinessRegistration.tsx').default, props = { onSignIn() {}, onDirtyChange() {}, onBusyChange() {} };
  f.render(component, props); await f.effects(); let tree = f.render(component, props);
  assert.match(textContent(tree), /Retry account check/); assert.equal(nodes(tree).some(node => node.type?.name === 'CorporateAccountForm'), false);
  available = true; nodes(tree).find(node => node.type === 'button').props.onClick();
  f.render(component, props); await f.effects(); tree = f.render(component, props);
  assert.ok(nodes(tree).some(node => node.type?.name === 'CorporateAccountForm'));
});

test('a sign-in link from business registration never upgrades a volunteer account or overrides its portal', async t => {
  browser(t); const routing = [];
  const auth = { signInWithPassword: async () => ({ data: { user: { id: 'volunteer' } }, error: null }) };
  const f = fixture(auth, {
    '@/lib/feature-flags': { corporateRolloutEnabled: true },
    '@/lib/supabase': { supabase: { auth, from: () => ({ select() { return this; }, eq() { return this; }, single: async () => ({ data: { role: 'volunteer', volunteer_enabled: true }, error: null }) }) } },
    '@/lib/actions/account-routing': { accountLandingPath: async (...args) => { routing.push(args); return '/volunteer'; } },
  });
  const component = f.load('app/components/LoginForm.tsx').default;
  let tree = f.render(component, { initialMode: 'business' });
  nodes(tree).find(node => node.type?.name === 'BusinessRegistration').props.onSignIn('member@example.invalid');
  tree = f.render(component, { initialMode: 'business' });
  assert.equal(nodes(tree).find(node => node.props.id === 'auth-email').props.value, 'member@example.invalid');
  await submit(tree); assert.deepEqual(routing, [['volunteer']]); assert.deepEqual(f.routes, ['/volunteer']);
});

test('a business signup opened while signed out is blocked if another tab signs in before submission', async t => {
  browser(t); let signedIn = false, signups = 0;
  const f = fixture({ getUser: async () => ({ data: { user: signedIn ? { id: 'volunteer' } : null }, error: null }), signUp: async () => { signups++; } }, {
    '@/lib/actions/corporate-accounts': { cleanCorporateAccount: value => value, requireCorporateRegistrationOpen: async () => {} },
  });
  const component = f.load('app/components/BusinessRegistration.tsx').default, props = { onSignIn() {}, onDirtyChange() {}, onBusyChange() {} };
  f.render(component, props); await f.effects(); const tree = f.render(component, props);
  const form = nodes(tree).find(node => node.type?.name === 'CorporateAccountForm'); signedIn = true;
  await assert.rejects(form.props.submit({}, 'Example-123!'), /Sign out before registering/); assert.equal(signups, 0);
});

test('sign-out callbacks clear local registration state only after Auth succeeds', async t => {
  browser(t); let complete, cleared = 0;
  const f = fixture({ signOut: () => new Promise(resolve => { complete = resolve; }) });
  const hook = f.load('app/components/useSignOut.ts').useSignOut;
  let value = f.render(hook, { onSignedOut: () => cleared++ });
  const failed = value.signOut(); complete({ error: new Error('Failed') }); await failed; assert.equal(cleared, 0); assert.deepEqual(f.routes, []);
  value = f.render(hook, { onSignedOut: () => cleared++ });
  const success = value.signOut(); complete({ error: null }); await success; assert.equal(cleared, 1); assert.deepEqual(f.routes, ['/']);
});

test('expired reset links show a recovery action without redirecting or revealing URL contents', async t => {
  browser(t, '', '#error_code=otp_expired&error_description=private-token');
  let calls = 0;
  const f = fixture({ getUser: async () => { calls++; } }), component = f.load('app/components/ResetPasswordForm.tsx').default;
  f.render(component); await f.effects(); const tree = f.render(component), content = JSON.stringify(tree);
  assert.match(content, /invalid or has expired/); assert.match(content, /Request a new reset link/);
  assert.doesNotMatch(content, /private-token/); assert.equal(calls, 0); assert.deepEqual(f.routes, []);
});

test('missing sessions and thrown reset-link checks leave a retryable screen, not an endless spinner', async t => {
  browser(t);
  for (const getUser of [async () => ({ data: { user: null }, error: Object.assign(new Error('Missing'), { name: 'AuthSessionMissingError' }) }), async () => { throw new Error('Network unavailable'); }]) {
    const f = fixture({ getUser }), component = f.load('app/components/ResetPasswordForm.tsx').default;
    f.render(component); await f.effects();
    assert.match(JSON.stringify(f.render(component)), /Retry link check/); assert.deepEqual(f.routes, []);
  }
});

test('reset-link check ignores a late response after unmount', async t => {
  browser(t); let finish;
  const f = fixture({ getUser: () => new Promise(resolve => { finish = resolve; }) }), component = f.load('app/components/ResetPasswordForm.tsx').default;
  f.render(component); await f.effects(); f.unmount(); finish({ data: { user: { id: 'user' } }, error: null }); await tick();
  assert.match(JSON.stringify(f.render(component)), /Verifying secure link/);
});

test('new password policy rejects missing character groups and length limits without trimming passwords', () => {
  const {passwordError}=fixture().load('lib/password-policy.ts');
  for(const value of ['short','lowercase123!','UPPERCASE123!','LettersOnly!','Letters1234','Letters1234 ','A1!'+ 'a'.repeat(126)]) assert.match(passwordError(value),/uppercase letter.*lowercase letter.*number.*symbol/);
  for(const value of ['Example-123!','A1!'+ 'a'.repeat(125),' A good passphrase 7! ']) assert.equal(passwordError(value),'');
});

test('password changes verify the current password and account identity before writing', async () => {
  const account={id:'person',email:'person@example.invalid'};
  for(const outcome of ['saved','wrong-current','changed-before','changed-after','unconfirmed','network']) {
    let reads=0;const writes=[],verified=[];
    const f=fixture({
      getUser:async()=>({data:{user:outcome==='changed-before'||(outcome==='changed-after'&&reads++>0)?{id:'other',email:'other@example.invalid'}:account},error:null}),
      signInWithPassword:async value=>{verified.push(value);if(outcome==='network')throw new Error('Connection lost');return {data:{user:account,weakPassword:{reasons:['length']}},error:outcome==='wrong-current'?{code:'invalid_credentials',message:'Invalid login credentials'}:null};},
      updateUser:async value=>{writes.push(value);return {data:{user:outcome==='unconfirmed'?null:account},error:null};},
    });
    const change=f.load('lib/actions/password.ts').changeAccountPassword;
    await assert.rejects(change(account.email,'old','weak','weak'),/uppercase letter/);assert.equal(verified.length,0);
    await assert.rejects(change(account.email,'old','Example-123!','different'),/do not match/);
    const result=change(account.email,'old-test-password','Example-123!','Example-123!');
    if(outcome==='saved')await result;else await assert.rejects(result,/incorrect|session changed|could not be confirmed|Connection lost/);
    assert.equal(writes.length,['saved','unconfirmed'].includes(outcome)?1:0);
    if(writes.length)assert.deepEqual(writes[0],{password:'Example-123!',current_password:'old-test-password'});
  }
});

test('change password form blocks duplicate submissions, clears secrets on success and permits retry after failure', async t => {
  browser(t);window.confirm=()=>true;
  let finish,calls=0;
  const f=fixture({}, {'@/lib/actions/password':{changeAccountPassword:()=>{calls++;return new Promise(resolve=>{finish=resolve;});}}});
  const form=f.load('app/components/ChangePasswordForm.tsx').default,props={email:'person@example.invalid'};
  let tree=f.render(form,props);nodes(tree).find(n=>n.type==='button'&&n.props.children==='Change password').props.onClick();tree=f.render(form,props);
  const fields=nodes(tree).filter(n=>n.type==='input'&&n.props.type==='password');
  ['old-test-password','Example-123!','Example-123!'].forEach((value,i)=>fields[i].props.onChange({target:{value}}));
  tree=f.render(form,props);const saving=submit(tree);await submit(tree);assert.equal(calls,1);
  finish();await saving;tree=f.render(form,props);assert.match(textContent(tree),/password has been updated/);assert.equal(nodes(tree).filter(n=>n.type==='input').length,0);
  nodes(tree).find(n=>n.type==='button').props.onClick();tree=f.render(form,props);assert.ok(nodes(tree).filter(n=>n.type==='input'&&n.props.type==='password').every(n=>n.props.value===''));f.unmount();
  let attempts=0;
  const g=fixture({}, {'@/lib/actions/password':{changeAccountPassword:async()=>{if(++attempts===1)throw new Error('Connection lost');}}});
  const component=g.load('app/components/ChangePasswordForm.tsx').default;
  tree=g.render(component,props);nodes(tree).find(n=>n.type==='button').props.onClick();tree=g.render(component,props);
  await submit(tree);tree=g.render(component,props);assert.match(textContent(tree),/Connection lost/);assert.equal(nodes(tree).find(n=>n.type==='fieldset').props.disabled,false);
  await submit(tree);assert.equal(attempts,2);assert.match(textContent(g.render(component,props)),/password has been updated/);g.unmount();
});

test('password mismatch sends no write; repeated clicks send one write and saved passwords cannot resubmit', async t => {
  browser(t); let finish, calls = 0;
  const f = fixture({ getUser: async () => ({ data: { user: { id: 'user' } }, error: null }), updateUser: () => { calls++; return new Promise(resolve => { finish = resolve; }); } });
  const component = f.load('app/components/ResetPasswordForm.tsx').default;
  f.render(component); await f.effects(); let tree = f.render(component);
  input(tree, 'reset-password', 'Example-456!'); input(tree, 'reset-confirmation', 'different');
  await submit(f.render(component)); assert.equal(calls, 0);
  tree = f.render(component); assert.match(JSON.stringify(tree), /do not match/); input(tree, 'reset-confirmation', 'Example-456!');
  tree = f.render(component); const first = submit(tree); await submit(tree); assert.equal(calls, 1);
  finish({ data: { user: { id: 'user' } }, error: null }); await first; await submit(tree); assert.equal(calls, 1);
  tree = f.render(component); assert.match(JSON.stringify(tree), /password has been updated/); assert.equal(nodes(tree).some(node => node.type === 'input'), false);
});

test('failed password writes keep the form usable for retry', async t => {
  browser(t); let calls = 0;
  const f = fixture({ getUser: async () => ({ data: { user: { id: 'user' } }, error: null }), updateUser: async () => { calls++; if (calls === 1) throw new Error('Connection lost'); return { data: { user: { id: 'user' } }, error: null }; } });
  const component = f.load('app/components/ResetPasswordForm.tsx').default;
  f.render(component); await f.effects(); let tree = f.render(component);
  input(tree, 'reset-password', 'Example-456!'); input(tree, 'reset-confirmation', 'Example-456!');
  await submit(f.render(component)); tree = f.render(component);
  assert.match(JSON.stringify(tree), /Connection lost/); assert.equal(nodes(tree).find(node => node.type === 'fieldset').props.disabled, false);
  await submit(tree); assert.equal(calls, 2); assert.match(JSON.stringify(f.render(component)), /password has been updated/);
});

test('requesting another recovery link bypasses automatic session routing and uses the current deployment', async t => {
  browser(t, '?recovery=1'); const requests = [];
  const f = fixture({ getSession: async () => { throw new Error('Must not redirect'); }, resetPasswordForEmail: async (...args) => { requests.push(args); return { error: null }; } });
  const component = f.load('app/components/LoginForm.tsx').default;
  f.render(component); await f.effects(); let tree = f.render(component);
  assert.match(JSON.stringify(tree), /Reset your password/); input(tree, 'auth-email', 'unknown@example.invalid'); await submit(f.render(component));
  assert.deepEqual(requests, [['unknown@example.invalid', { redirectTo: 'https://portal.example.invalid/update-password' }]]);
  assert.match(JSON.stringify(f.render(component)), /If an account exists/); assert.deepEqual(f.routes, []);
});

test('sign-in and recovery network failures unlock the form; double-clicked auth requests are ignored', async t => {
  browser(t); let finish, calls = 0;
  const f = fixture({ signInWithPassword: () => { calls++; return new Promise((_, reject) => { finish = reject; }); }, resetPasswordForEmail: async () => { throw new Error('Recovery connection lost'); } });
  const component = f.load('app/components/LoginForm.tsx').default;
  let tree = f.render(component); const first = submit(tree); await submit(tree); assert.equal(calls, 1);
  finish(new Error('Network unavailable')); await first; tree = f.render(component);
  assert.match(JSON.stringify(tree), /Network unavailable/); assert.equal(nodes(tree).find(node => node.type === 'fieldset').props.disabled, false);
  nodes(tree).find(node => node.type === 'button' && node.props.children === 'Forgot password?').props.onClick();
  tree = f.render(component); input(tree, 'auth-email', 'contact@example.invalid'); await submit(f.render(component));
  assert.match(JSON.stringify(f.render(component)), /Recovery connection lost/);
  assert.equal(nodes(f.render(component)).find(node => node.type === 'fieldset').props.disabled, false);
});

test('corporate session boundaries hide cached data after sign-out or identity changes, not token refreshes', async () => {
  for (const end of ['SIGNED_OUT', 'different-user']) {
    let callback, unsubscribed = false;
    const f = fixture({ onAuthStateChange: listener => { callback = listener; return { data: { subscription: { unsubscribe() { unsubscribed = true; } } } }; } });
    const hook = f.load('app/components/useSessionBoundary.ts').useSessionBoundary;
    assert.equal(f.render(hook, true), false); await f.effects();
    callback('INITIAL_SESSION', { user: { id: 'first-user' } });
    callback('TOKEN_REFRESHED', { user: { id: 'first-user' } }); assert.equal(f.render(hook, true), false);
    callback(end === 'SIGNED_OUT' ? 'SIGNED_OUT' : 'SIGNED_IN', end === 'SIGNED_OUT' ? null : { user: { id: 'second-user' } });
    assert.equal(f.render(hook, true), true); f.unmount(); assert.equal(unsubscribed, true);
  }
});

const workspaceData = () => ({
  userId: 'contact', signInEmail: 'signin@example.invalid', account: { id: 'company', owner_user_id: 'contact', company_name: 'Company', status: 'Approved' },
  emailVerified: true, settings: { booking_schema_version: 1 }, settingsError: '',
});
const workspaceContext = (extra = {}) => ({ data: workspaceData(), checking: false, refreshing: false, error: '', sessionEnded: false, refreshWorkspace: async () => {}, applyAccount() {}, ...extra });

test('only initial corporate entry uses full-screen loading; page transitions remain within one layout frame', () => {
  let context = workspaceContext({ checking: true, data: null });
  const f = fixture({}, {
    '@/lib/feature-flags': { corporateRolloutEnabled: true, corporateBookingsEnabled: true },
    './CorporateWorkspaceProvider': { CorporateWorkspaceProvider: function CorporateWorkspaceProvider() {}, useCorporateWorkspace: () => context },
    './components/CorporateWorkspaceProvider': { useCorporateWorkspace: () => context },
  });
  const loader = f.load('app/corporate/components/CorporateLoadingScreen.tsx').default;
  assert.equal(f.render(loader).type.name, 'PortalLoadingScreen');
  assert.equal(f.load('app/corporate/loading.tsx').default.name, 'CorporateContentLoading');
  const layout = f.load('app/corporate/layout.tsx').default;
  const shell = f.render(layout, { children: 'page' });
  assert.equal(shell.type.name, 'CorporateShell');
  const provider = f.render(shell.type, shell.props);
  const workspace = provider.props.children;
  assert.equal(f.render(workspace.type, workspace.props).type.name, 'CorporateLoadingScreen');
  context = workspaceContext();
  let frame = f.render(workspace.type, workspace.props);
  assert.equal(frame.type.name, 'CorporateFrame'); assert.equal(frame.props.children[2], 'page');
  context = workspaceContext({ refreshing: true });
  frame = f.render(workspace.type, { ...workspace.props, pathname: '/corporate/events' });
  assert.equal(frame.type.name, 'CorporateFrame'); assert.equal(frame.props.children[2], 'page');
  for (const mode of ['bookings', 'events', 'updates', 'reports']) {
    const portal = f.load('app/corporate/components/CorporateWorkflowPortal.tsx').default;
    const boundary = f.render(portal, { mode });
    assert.equal(boundary.props.fallback.type.name, 'CorporateContentLoading');
    assert.equal(nodes(boundary).some(node => node.type?.name === 'CorporateFrame'), false);
  }
  const profile = f.render(f.load('app/corporate/page.tsx').default);
  assert.ok(nodes(profile).some(node => node.type?.name === 'CorporateContentLoading'));
  assert.equal(nodes(profile).some(node => node.type?.name === 'CorporateFrame'), false);
});

test('corporate workspace auth failures offer retry without a false sign-in redirect or a second full-screen load', async () => {
  let fail = true;
  const f = fixture({
    getUser: async () => { if (fail) throw new Error('Auth connection unavailable'); return { data: { user: { id: 'contact', email_confirmed_at: '2026-10-22' } } }; },
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  }, {
    '@/lib/feature-flags': { corporateBookingsEnabled: true },
    '@/lib/actions/corporate-accounts': { getMyCorporateAccount: async () => workspaceData().account },
    '@/lib/actions/corporate-bookings': { getCorporateBookingSettings: async () => workspaceData().settings },
  });
  const provider = f.load('app/corporate/components/CorporateWorkspaceProvider.tsx').CorporateWorkspaceProvider;
  f.render(provider, { children: null }); await f.effects();
  let context = f.render(provider, { children: null }).props.value;
  assert.equal(context.checking, false); assert.match(context.error, /Auth connection unavailable/); assert.deepEqual(f.routes, []);
  fail = false; await context.refreshWorkspace(true); context = f.render(provider, { children: null }).props.value;
  assert.equal(context.error, ''); assert.equal(context.data.account.id, 'company'); assert.equal(context.checking, false);
  f.unmount();
});

test('workspace navigation reuses fresh checks, concurrent refreshes share one request, and focus updates settings in place', async t => {
  browser(t); let authCalls = 0, accountCalls = 0, configCalls = 0, enabled = true, fail = false;
  const f = fixture({
    getUser: async () => { authCalls++; if (fail) throw new Error('Connection lost'); return { data: { user: { id: 'contact', email_confirmed_at: 'verified' } } }; },
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  }, {
    '@/lib/feature-flags': { corporateBookingsEnabled: true },
    '@/lib/actions/corporate-accounts': { getMyCorporateAccount: async () => { accountCalls++; return workspaceData().account; } },
    '@/lib/actions/corporate-bookings': { getCorporateBookingSettings: async () => { configCalls++; return { booking_schema_version: 1, booking_enabled: enabled }; } },
  });
  const component = f.load('app/corporate/components/CorporateWorkspaceProvider.tsx').CorporateWorkspaceProvider;
  const context = () => f.render(component, { children: null }).props.value;
  context(); await f.effects();
  assert.equal(context().checking, false); assert.deepEqual([authCalls, accountCalls, configCalls], [1, 1, 1]);
  await Promise.all([context().refreshWorkspace(), context().refreshWorkspace(), context().refreshWorkspace()]);
  assert.equal(authCalls, 1, 'Switching pages inside the freshness window reuses the verified workspace');
  enabled = false;
  const first = context().refreshWorkspace(true), second = context().refreshWorkspace(true);
  assert.equal(first, second); assert.equal(context().checking, false); assert.equal(context().refreshing, true);
  await first; assert.equal(context().data.settings.booking_enabled, false); assert.equal(authCalls, 2);
  enabled = true; window.dispatchEvent(new Event('focus')); await tick();
  assert.equal(context().data.settings.booking_enabled, true); assert.equal(authCalls, 3);
  fail = true; await context().refreshWorkspace(true);
  assert.equal(context().checking, false); assert.equal(context().data.account.id, 'company'); assert.match(context().error, /Connection lost/);
  f.unmount(); window.dispatchEvent(new Event('focus')); await tick(); assert.equal(authCalls, 4, 'Focus listener is removed on exit');
});

test('sign-out, identity changes and unmount invalidate corporate refreshes before late results can restore private content', async () => {
  for (const action of ['sign-out', 'account-change', 'unmount']) {
    let callback, release, calls = 0;
    const f = fixture({
      getUser: async () => ({ data: { user: { id: 'contact', email_confirmed_at: 'verified' } } }),
      onAuthStateChange: cb => { callback = cb; return { data: { subscription: { unsubscribe() {} } } }; },
    }, {
      '@/lib/feature-flags': { corporateBookingsEnabled: true },
      '@/lib/actions/corporate-accounts': { getMyCorporateAccount: async () => ++calls === 1 ? workspaceData().account : new Promise(resolve => { release = resolve; }) },
      '@/lib/actions/corporate-bookings': { getCorporateBookingSettings: async () => workspaceData().settings },
    });
    const provider = f.load('app/corporate/components/CorporateWorkspaceProvider.tsx').CorporateWorkspaceProvider;
    const context = () => f.render(provider, { children: null }).props.value;
    context(); await f.effects(); const refresh = context().refreshWorkspace(true); await tick();
    if (action === 'unmount') f.unmount();
    else callback(action === 'sign-out' ? 'SIGNED_OUT' : 'SIGNED_IN', action === 'sign-out' ? null : { user: { id: 'another-user' } });
    release({ ...workspaceData().account, company_name: 'Late private response' }); await refresh;
    assert.notEqual(context().data?.account.company_name, 'Late private response');
    if (action !== 'unmount') { assert.equal(context().data, null); assert.equal(context().sessionEnded, true); f.unmount(); }
  }
});

test('profile updates cannot be overwritten by an older workspace request', async () => {
  let release, calls = 0;
  const f = fixture({ getUser: async () => ({ data: { user: { id: 'contact', email_confirmed_at: 'verified' } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) }, {
    '@/lib/feature-flags': { corporateBookingsEnabled: true },
    '@/lib/actions/corporate-accounts': { getMyCorporateAccount: async () => ++calls === 1 ? workspaceData().account : new Promise(resolve => { release = resolve; }) },
    '@/lib/actions/corporate-bookings': { getCorporateBookingSettings: async () => workspaceData().settings },
  });
  const provider = f.load('app/corporate/components/CorporateWorkspaceProvider.tsx').CorporateWorkspaceProvider;
  const context = () => f.render(provider, { children: null }).props.value;
  context(); await f.effects(); const refresh = context().refreshWorkspace(true); await tick();
  context().applyAccount({ ...workspaceData().account, company_name: 'Updated company' });
  release(workspaceData().account); await refresh;
  assert.equal(context().data.account.company_name, 'Updated company'); assert.equal(context().checking, false); f.unmount();
});

test('corporate registration bypasses the workspace, while workflow pages redirect unapproved or unverified accounts', async t => {
  browser(t); window.location.pathname = '/corporate/register';
  const f = fixture({}, { '@/lib/feature-flags': { corporateRolloutEnabled: true } });
  const shell = f.load('app/corporate/components/CorporateShell.tsx').default;
  const registration = f.render(shell, { children: 'registration' });
  assert.equal(registration.props.children, 'registration');
  assert.equal(nodes(registration).some(node => node.type?.name === 'CorporateWorkspaceProvider'), false);
  for (const data of [{ ...workspaceData(), emailVerified: false }, { ...workspaceData(), account: { ...workspaceData().account, status: 'Awaiting approval' } }]) {
    const g = fixture({}, { '@/lib/feature-flags': { corporateBookingsEnabled: true }, './CorporateWorkspaceProvider': { useCorporateWorkspace: () => workspaceContext({ data }) } });
    const boundary = g.render(g.load('app/corporate/components/CorporateWorkflowPortal.tsx').default, { mode: 'events' });
    const route = boundary.props.children, workspace = g.render(route.type, route.props);
    g.render(workspace.type, workspace.props); await g.effects();
    assert.deepEqual(g.routes, ['/corporate']);
  }
});

test('profile focus refresh pauses during editing so background checks cannot discard unsaved details', async t => {
  browser(t); let loads = 0;
  const f = fixture({}, {
    './components/CorporateWorkspaceProvider': { useCorporateWorkspace: () => workspaceContext() },
    '@/lib/actions/corporate-accounts': { getCorporateAccountDetail: async () => { loads++; return { account: workspaceData().account, email_verified: true, history: [] }; } },
  });
  const profile = f.load('app/corporate/page.tsx').default;
  f.render(profile); await f.effects(); let tree = f.render(profile);
  nodes(tree).find(node => node.type?.name === 'CorporateAccountForm').props.onDirtyChange(true);
  f.render(profile); await f.effects(); window.dispatchEvent(new Event('focus')); await tick();
  assert.equal(loads, 1);
  tree = f.render(profile); assert.ok(nodes(tree).some(node => node.type?.name === 'CorporateAccountForm'));
  nodes(tree).find(node => node.type?.name === 'CorporateAccountForm').props.onDirtyChange(false);
  f.render(profile); await f.effects(); window.dispatchEvent(new Event('focus')); await tick();
  assert.equal(loads, 2); f.unmount();
});

// These checks exercise actual handlers and component state, not a copied preview implementation.
test('corporate booking links replace only their content and surface access errors within the persistent frame', async t => {
  browser(t, '?booking=first');
  const lookups = [];
  const f = fixture({}, {
    '@/lib/feature-flags': { corporateBookingsEnabled: true },
    './CorporateWorkspaceProvider': { useCorporateWorkspace: () => workspaceContext() },
    '@/lib/actions/corporate-bookings': {
      getCorporateBookingDetail: async id => { lookups.push(id); if (id === 'not-owned') throw new Error('Booking not available to this company.'); return { booking: { id } }; },
    },
  });
  const portal = f.load('app/corporate/components/CorporateWorkflowPortal.tsx').default;
  const route = nodes(f.render(portal, { mode: 'bookings' })).find(node => typeof node.type === 'function');
  const first = f.render(route.type, route.props);
  f.render(first.type, first.props); await f.effects();
  assert.match(JSON.stringify(f.render(first.type, first.props)), /"initialDetail":\{"booking":\{"id":"first"/);
  window.location.search = '?booking=second';
  const second = f.render(route.type, route.props);
  assert.notEqual(first.key, second.key, 'Only the selected booking content is replaced');
  f.render(second.type, second.props); await f.effects();
  assert.match(JSON.stringify(f.render(second.type, second.props)), /"initialDetail":\{"booking":\{"id":"second"/);
  window.location.search = '?booking=not-owned';
  const denied = f.render(route.type, route.props);
  f.render(denied.type, denied.props); await f.effects();
  const tree = f.render(denied.type, denied.props);
  assert.equal(tree.type.name, 'FeatureState'); assert.match(tree.props.error, /Booking not available/);
  assert.deepEqual(lookups, ['first', 'second', 'not-owned']);
});

test('admin booking and company links use reactive query IDs rather than keeping a previous selection', t => {
  browser(t);
  const f = fixture({}, { '@/lib/feature-flags': { corporateRolloutEnabled: true, corporateBookingsEnabled: true } });
  for (const [path, parameter] of [['app/admin/corporate-bookings/page.tsx', 'booking'], ['app/admin/corporate-accounts/page.tsx', 'account']]) {
    const component = f.load(path).default;
    const route = nodes(f.render(component)).find(node => typeof node.type === 'function');
    window.location.search = '?' + parameter + '=first';
    const first = f.render(route.type, route.props);
    window.location.search = '?' + parameter + '=second';
    const second = f.render(route.type, route.props);
    assert.equal(first.props[parameter + 'Id'], 'first'); assert.equal(second.props[parameter + 'Id'], 'second');
    assert.notEqual(first.key, second.key);
  }
});

test('admin and volunteer shells hide cached page content after a cross-tab sign-out or account change', async () => {
  for (const [path, provider, getter] of [
    ['app/admin/components/AdminShell.tsx', './AdminProvider', 'useAdminData'],
    ['app/volunteer/components/VolunteerShell.tsx', './VolunteerProvider', 'useVolunteerData'],
  ]) {
    let callback;
    const f = fixture({ onAuthStateChange: listener => { callback = listener; return { data: { subscription: { unsubscribe() {} } } }; } }, {
      [provider]: { [getter]: () => ({ adminProfile: {}, profile: {}, isCheckingAccess: false, toasts: [] }) },
      '@/app/components/useNavigationDrawer': { useNavigationDrawer() {} },
    });
    const shell = f.load(path).default, props = { children: 'PRIVATE CACHED DATA' };
    assert.match(textContent(f.render(shell, props)), /PRIVATE CACHED DATA/); await f.effects();
    callback('INITIAL_SESSION', { user: { id: 'first' } }); callback('SIGNED_IN', { user: { id: 'second' } });
    const tree = JSON.stringify(f.render(shell, props));
    assert.match(tree, /Your session has changed/); assert.doesNotMatch(tree, /PRIVATE CACHED DATA/);
  }
});

test('replaced feature loaders ignore late failures and unmounted requests cannot restore old results', async () => {
  let failOld, finishNew, finishUnmounted;
  const oldLoader = () => new Promise((_, reject) => { failOld = reject; });
  const newLoader = () => new Promise(resolve => { finishNew = resolve; });
  const unmountedLoader = () => new Promise(resolve => { finishUnmounted = resolve; });
  const f = fixture(), hook = f.load('app/admin/components/FeatureShared.tsx').useFeatureData;
  f.render(hook, oldLoader); await f.effects();
  f.render(hook, newLoader); await f.effects(); finishNew({ id: 'latest' }); await tick();
  failOld(new Error('Old screen failed')); await tick();
  let result = f.render(hook, newLoader);
  assert.equal(result.data.id, 'latest'); assert.equal(result.error, ''); assert.equal(result.loading, false);
  f.render(hook, unmountedLoader); await f.effects(); f.unmount(); finishUnmounted({ id: 'unmounted' }); await tick();
  result = f.render(hook, unmountedLoader); assert.equal(result.data.id, 'latest');
});

test('admin access failures offer a retry without treating an unavailable role lookup as a volunteer', async () => {
  for (const authFails of [true, false]) {
    let recover = false;
    const f = fixture({ getUser: async () => {
      if (authFails && !recover) throw new Error('Connection unavailable');
      return { data: { user: { id: 'admin' } }, error: null };
    } }, { '@/lib/actions/profile': { fetchUserRole: async () => !authFails && !recover ? { data: null, error: new Error('Role lookup unavailable') } : { data: { role: 'admin', full_name: 'Administrator' }, error: null } } });
    const provider = f.load('app/admin/components/AdminProvider.tsx').AdminProvider;
    f.render(provider, { children: null }); await f.effects();
    let value = f.render(provider, { children: null }).props.value;
    assert.match(value.accessError, /could not be checked/); assert.equal(value.isCheckingAccess, true); assert.deepEqual(f.routes, []);
    recover = true; value.retryAccess();
    f.render(provider, { children: null }); await f.effects();
    value = f.render(provider, { children: null }).props.value;
    assert.equal(value.accessError, null); assert.equal(value.isCheckingAccess, false); assert.equal(value.adminProfile.full_name, 'Administrator');
    f.unmount();
  }
});

test('booking notification copy removes technical boilerplate but retains deadlines, notes and unknown formats', () => {
  const { corporateNoticeCopy: copy } = fixture().load('lib/corporate-notice-copy.ts');
  const booking_id = '5f66475e-b7e1-48b1-bc0b-68b25ddf5973';
  const notice = (title, body) => ({ booking_id, title, message: `Booking ${booking_id} — ${body}` });
  const requested = copy(notice('Booking request received', 'Requested — no places held. Admin rechecks capacity on acceptance. Submitting a request does not reserve the session. Wait for admin acceptance in My bookings before arranging payment or attendance.'));
  assert.equal(requested.title, 'Request received');
  assert.equal(requested.summary, 'Awaiting admin review. The session is not reserved yet.');
  assert.equal(requested.note, '');
  const payment = copy(notice('Request accepted — payment pending', 'Please use reference ACME-17. The whole session is held for your company. Open My bookings and arrange external payment with the booking team by 24 Oct 2026 08:59 (South African time). Admin confirms receipt. Overdue bookings remain held until admin decides otherwise.'));
  assert.equal(payment.summary, 'Session reserved. Arrange payment by 24 Oct 2026 08:59 (SA time).');
  assert.equal(payment.note, 'Please use reference ACME-17.');
  const confirmed = copy(notice('External payment recorded — booking confirmed', 'ACME-17 — payment processed externally Your booking is confirmed and the session is reserved for your company. Check the current date, time, location and group size in My bookings before attending.'));
  assert.equal(confirmed.title, 'Booking confirmed'); assert.equal(confirmed.noteLabel, 'Payment reference'); assert.equal(confirmed.note, 'ACME-17');
  assert.doesNotMatch(JSON.stringify(confirmed), /5f66475e|processed externally/);
  const rejected = copy(notice('Booking rejected', 'The group is too large. Please choose another session. This request is closed and does not hold a session. You may request another available session. Discuss any payment/refund with the booking team externally.'));
  assert.equal(rejected.note, 'The group is too large. Please choose another session.');
  assert.match(rejected.summary, /another available session/);
  const custom = 'Important update. Please call us about invoice 123.\nBring your reference.';
  assert.equal(copy({ booking_id, title: 'New update type', message: custom }).note, custom);
  assert.equal(copy(notice('New update type', custom)).note, custom);
  // Similar free text must not be mistaken for a generated prefix or suffix.
  assert.equal(copy({ booking_id, title: 'Update', message: `Booking ${booking_id}-extra needs review.` }).note, `Booking ${booking_id}-extra needs review.`);
});

test('booking notification screen uses short copy and a short reference instead of UUID paragraphs', () => {
  const booking_id = '5f66475e-b7e1-48b1-bc0b-68b25ddf5973';
  const rows = [{ id: 'notice', booking_id, title: 'Booking request received', message: `Booking ${booking_id} — Requested — no places held. Admin rechecks capacity on acceptance.`, created_at: '2026-10-23T10:00:00Z', is_read: false }];
  const f = fixture({}, { '@/app/admin/components/FeatureShared': { useFeatureData: () => ({ data: { rows, total: 1 }, loading: false, error: '', reload: async () => {} }), FeatureState: () => null } });
  const component = f.load('app/corporate/components/CorporateBookingUpdates.tsx').default;
  const text = textContent(f.render(component, { goToBooking: async () => {} }));
  assert.match(text, /Request received/); assert.match(text, /session is not reserved yet/);
  assert.match(text, /5F66475E/); assert.doesNotMatch(text, new RegExp(booking_id));
  assert.doesNotMatch(text, /Marking all as read includes|Admin rechecks capacity|Open a notification to view/);
  assert.match(text, /Booking emails are not sent/); assert.match(text, /Go to booking/);
});

test('booking notifications open their exact record and stay unread when the destination is denied', async () => {
  const notice = { id: 'notice-1', booking_id: 'booking-1', title: 'Booking changed', message: 'Review the updated booking.', is_read: false, created_at: '2026-10-22T10:00:00Z' };
  const actions = [];
  let allowed = false;
  const f = fixture({}, {
    '@/app/admin/components/FeatureShared': { useFeatureData: () => ({ data: { rows: [notice], total: 1 }, loading: false, error: '', reload: async () => actions.push('reload') }), FeatureState: () => null },
    '@/lib/actions/corporate-accounts': { readCorporateAccountNotice: async id => actions.push('read:' + id) },
  });
  const component = f.load('app/corporate/components/CorporateBookingUpdates.tsx').default;
  const props = { goToBooking: async id => { actions.push('open:' + id); if (!allowed) throw new Error('Booking no longer accessible.'); } };
  let tree = f.render(component, props);
  await nodes(tree).find(node => node.type === 'button' && node.props.children === 'Go to booking').props.onClick();
  assert.deepEqual(actions, ['open:booking-1']); assert.match(textContent(f.render(component, props)), /no longer accessible/);
  allowed = true; tree = f.render(component, props);
  await nodes(tree).find(node => node.type === 'button' && node.props.children === 'Go to booking').props.onClick();
  assert.deepEqual(actions, ['open:booking-1', 'open:booking-1', 'read:notice-1', 'reload']);
});

test('corporate requests and payment forms block double clicks and reuse their key after a lost response', async t => {
  browser(t); window.confirm = () => true;
  const event = { id: 'event', version: 2, title: 'Group session', starts_at: '2099-11-15T09:15:00+02:00', ends_at: '2099-11-15T10:15:00+02:00', location: 'Venue', state: 'Available', is_published: true, min_group_size: 2, max_group_size: 10, remaining: 10 };
  for (const payment of [false, true]) {
    const requests = [], committed = []; let fail;
    const request = (...args) => { requests.push(args); if (requests.length === 1) return new Promise((_, reject) => { fail = reject; }); return Promise.resolve({ id: 'saved' }); };
    const f = fixture({}, { '@/lib/actions/corporate-bookings': { requestCorporateBooking: request, recordCorporatePayment: request } });
    const component = payment ? f.load('app/corporate/components/CorporateBookingList.tsx').CorporateBookingDecisionForm : f.load('app/corporate/components/CorporateEventBrowser.tsx').CorporateRequestForm;
    const props = payment ? { mode: 'payment', booking: { id: 'booking', version: 3, event }, dirtyChanged() {}, committed: async result => committed.push(result.id) } : { event, account: { company_name: 'Company', contact_name: 'Main contact', contact_email: 'contact@example.invalid', contact_phone: '+27215551234', billing_address: 'Address' }, dirtyChanged() {}, committed: id => committed.push(id) };
    let tree = f.render(component, props);
    if (payment) {
      nodes(tree).find(node => node.type === 'input' && node.props.maxLength === 180).props.onChange({ target: { value: 'RECEIPT-1' } });
      tree = f.render(component, props);
    }
    const first = submit(tree); await submit(tree); assert.equal(requests.length, 1);
    fail(new Error('Response lost')); await first;
    tree = f.render(component, props);
    assert.match(textContent(tree), /Response lost/); assert.equal(nodes(tree).find(node => node.type === 'fieldset').props.disabled, false);
    await submit(tree); assert.equal(requests.length, 2);
    const keyIndex = payment ? 1 : 3;
    assert.equal(requests[0][keyIndex], requests[1][keyIndex]); assert.deepEqual(committed, ['saved']);
  }
});

test('volunteer registration accepts an omitted cellphone but validates one when supplied', async t => {
  browser(t);const calls=[];
  const f=fixture({signUp:async args=>{calls.push(args);return {error:null};}}, {'@/lib/feature-flags':{corporateRolloutEnabled:true}});
  const component=f.load('app/components/LoginForm.tsx').default, props={initialMode:'volunteer'};
  let tree=f.render(component,props);
  assert.equal(nodes(tree).find(n=>n.props.id==='signup-phone').props.required,undefined);
  for(const [id,value] of [['first-name','Test'],['last-name','Volunteer'],['birth-date','2000-01-01'],['auth-email','volunteer@example.invalid'],['auth-password','Example-123!'],['signup-phone','not-a-number']]) input(tree,id,value);
  tree=f.render(component,props);await submit(tree);assert.equal(calls.length,0);
  input(tree,'signup-phone','   ');tree=f.render(component,props);await submit(tree);
  assert.equal(calls.length,1);assert.equal(calls[0].options.data.phone,'');
});

test('volunteer profile can clear an optional number as NULL and rejects malformed nonblank input', async () => {
  const writes=[];const f=fixture({}, {'@/lib/feature-flags':{corporateRolloutEnabled:true},'@/lib/supabase':{supabase:{from:()=>({update(value){writes.push(value);return this;},eq(){return this;},select(){return this;},single:async()=>({data:{id:'volunteer'},error:null})})}}});
  const update=f.load('lib/actions/profile.ts').updateVolunteerProfile;
  const details={full_name:'Volunteer',date_of_birth:'2000-01-01'};
  assert.equal((await update('volunteer',{...details,phone:'   '})).error,null);assert.equal(writes[0].phone,null);
  assert.match((await update('volunteer',{...details,phone:'bad'})).error.message,/valid cellphone/);assert.equal(writes.length,1);
  assert.equal((await update('volunteer',{...details,phone:'+27 21 555 1234'})).error,null);assert.equal(writes[1].phone,'+27 21 555 1234');
  const g=fixture({}, {'@/lib/feature-flags':{corporateRolloutEnabled:true},'../components/VolunteerProvider':{useVolunteerData:()=>({profile:{phone:null},consent:null})},'../components/VolunteerAccountContext':{useVolunteerSignOut:()=>()=>{}}});
  const profile=g.render(g.load('app/volunteer/profile/page.tsx').default);
  assert.equal(nodes(profile).find(n=>n.props.id==='profile-phone').props.required,undefined);
  assert.doesNotMatch(readFileSync(resolve(root,'app/volunteer/components/VolunteerProvider.tsx'),'utf8'),/isValidPhone\(profile.phone/);
});

test('volunteer directory sends search, phone filters and pagination to the protected directory query', async () => {
  const calls = [], result = { rows: [], total: 25 };
  const f = fixture({}, {
    '@/lib/feature-flags': { corporateRolloutEnabled: true },
    '@/lib/actions/corporate-accounts': { searchVolunteerDirectory: async (...args) => { calls.push(args); return result; } },
  });
  const page = f.load('app/admin/directory/page.tsx').default;
  const workspace = f.render(page), component = workspace.type;
  f.render(component); await f.effects();
  let tree = f.render(component);
  nodes(tree).find(node => node.type === 'input' && node.props.type === 'search').props.onChange({ target: { value: 'Example volunteer' } });
  f.render(component); await f.effects(); tree = f.render(component);
  nodes(tree).find(node => node.type === 'select').props.onChange({ target: { value: 'missing' } });
  f.render(component); await f.effects(); tree = f.render(component);
  nodes(tree).find(node => node.type === 'button' && node.props.children === 'Next').props.onClick();
  f.render(component); await f.effects();
  assert.deepEqual(calls, [['', '', 1], ['Example volunteer', '', 1], ['Example volunteer', 'missing', 1], ['Example volunteer', 'missing', 2]]);
});

test('sign-out failures stay in the portal, duplicate clicks are ignored, and a successful retry redirects', async t => {
  browser(t); let finish, calls = 0;
  const f = fixture({ signOut: () => { calls++; return new Promise(resolve => { finish = resolve; }); } });
  const hook = f.load('app/components/useSignOut.ts').useSignOut;
  let value = f.render(hook); const first = value.signOut(); await value.signOut(); assert.equal(calls, 1);
  finish({ error: new Error('Failed') }); await first; value = f.render(hook);
  assert.match(value.error, /could not be completed/); assert.equal(value.busy, false); assert.deepEqual(f.routes, []);
  const retry = value.signOut(); finish({ error: null }); await retry; assert.deepEqual(f.routes, ['/']);
});

// Presentation checks use the real components with fake data; they never change a live company.
test('corporate navigation reuses volunteer styles and only links to company pages on desktop and mobile', () => {
  const css = new Proxy({}, { get: (_, key) => `volunteer-${String(key)}` });
  const f = fixture({}, {
    'next/navigation': { usePathname: () => '/corporate/events' },
    '@/lib/feature-flags': { corporateBookingsEnabled: true, corporateOutcomesEnabled: true },
    '@/app/volunteer/volunteer.module.css': { __esModule: true, default: css },
  });
  const navigation = f.load('app/corporate/components/CorporateNavigation.tsx').default;
  for (const mobile of [false, true]) {
    const tree = f.render(navigation, { mobile });
    assert.equal(tree.props.className, mobile ? 'volunteer-bottomNavigation' : 'volunteer-desktopNavigation');
    const links = nodes(tree).filter(node => node.props.href);
    assert.deepEqual(links.map(node => node.props.href), ['/corporate/bookings', '/corporate/events', '/corporate/reports']);
    assert.deepEqual(links.filter(node => node.props['aria-current'] === 'page').map(node => node.props.href), ['/corporate/events']);
    assert.ok(links.every(node => node.props.className === 'volunteer-portalNavLink'));
    if (mobile) assert.equal(tree.props.style.gridTemplateColumns, 'repeat(3, minmax(0, 1fr))');
  }
  const gated = fixture({}, {
    'next/navigation': { usePathname: () => '/corporate' },
    '@/lib/feature-flags': { corporateBookingsEnabled: true, corporateOutcomesEnabled: false },
  });
  const tree = gated.render(gated.load('app/corporate/components/CorporateNavigation.tsx').default, { mobile: true });
  assert.equal(nodes(tree).filter(node => node.props.href).length, 2);
  assert.equal(tree.props.style.gridTemplateColumns, 'repeat(2, minmax(0, 1fr))');
});

test('corporate mobile lists retain labelled cells, table semantics and the existing booking actions', async t => {
  browser(t);window.setInterval=()=>1;window.clearInterval=()=>{};window.confirm=()=>true;
  const event={id:'session',version:1,title:'A long corporate session title',description:'Session details',location:'Venue',starts_at:'2099-11-15T07:15:00Z',ends_at:'2099-11-15T09:15:00Z',state:'Available',is_published:true,min_group_size:1,max_group_size:30,remaining:30};
  const booking={id:'booking',version:1,status:'Confirmed',group_size:12,event,contact_snapshot:{company_name:'A long company name',contact_name:'Main contact'}};
  for(const kind of ['bookings','events','changes','reports']) {
    const calls=[], f=fixture({}, {'@/lib/actions/corporate-bookings':{emptyWorkflowFilters:{query:'',status:'',from:'',to:''},searchCorporateEvents:async()=>({rows:[event],total:1}),searchCorporateBookings:async()=>({rows:[booking],total:1}),getCorporateBookingDetail:async id=>{calls.push(id);return {booking,payments:[],history:[]};}}});
    const file=kind==='bookings'?'CorporateBookingList':kind==='events'?'CorporateEventBrowser':kind==='changes'?'CorporateChangeActions':'CorporateOutcomeReports';
    const loaded=f.load('app/corporate/components/'+file+'.tsx');
    const component=kind==='changes'?loaded.CorporateChangeRequestForm:kind==='reports'?loaded.OutcomeTable:loaded.default;
    const props=kind==='reports'?{rows:[booking]}:{admin:false,booking,kind:'Amendment',account:{company_name:'Company'},settings:{booking_enabled:true},dirtyChanged(){},committed(){}};
    let tree=f.render(component,props);await f.effects();tree=f.render(component,props);
    if(kind==='events'||kind==='bookings'){nodes(tree).find(n=>n.type==='button'&&n.props.children==='List').props.onClick();f.render(component,props);await f.effects();tree=f.render(component,props);}
    const table=nodes(tree).find(n=>n.type==='table');assert.ok(table,kind);assert.equal(table.props.role,'table');assert.ok(table.props['aria-label']);
    const cells=nodes(table).filter(n=>n.type==='td');assert.equal(cells.length,kind==='changes'?3:6);assert.ok(cells.every(n=>n.props['data-label']&&n.props.role==='cell'));
    assert.ok(nodes(table).filter(n=>n.type==='th').every(n=>n.props.scope==='col'));
    if(kind==='bookings'){await nodes(tree).find(n=>n.type==='button'&&n.props.children==='Details').props.onClick();assert.deepEqual(calls,['booking']);}
    if(kind==='events'){nodes(tree).find(n=>n.type==='button'&&n.props.children==='Request booking').props.onClick();assert.ok(nodes(f.render(component,props)).some(n=>n.type?.name==='CorporateRequestForm'));}
    f.unmount();
  }
});

test('corporate booking references are short in tables and details but lookups and CSV keep the complete ID', async t => {
  browser(t);window.setInterval=()=>1;window.clearInterval=()=>{};
  const id='5f66475e-b7e1-48b1-bc0b-68b25ddf5973',calls=[];
  const booking={id,version:1,status:'Confirmed',group_size:5,event:{title:'Test event',starts_at:'2099-11-15T07:00:00Z',ends_at:'2099-11-15T09:00:00Z',location:'Venue'},contact_snapshot:{company_name:'Test Inc.',contact_name:'Contact'}};
  const f=fixture({}, {'@/lib/actions/corporate-bookings':{emptyWorkflowFilters:{query:'',status:'',from:'',to:''},searchCorporateBookings:async()=>({rows:[booking],total:1}),getCorporateBookingDetail:async value=>{calls.push(value);return {booking,payments:[],history:[]};}}});
  const {corporateBookingReference}=f.load('lib/corporate-booking-utils.ts');assert.equal(corporateBookingReference(id),'Booking #5F66475E');
  const component=f.load('app/corporate/components/CorporateBookingList.tsx').default,props={admin:false,settings:{booking_enabled:true}};
  f.render(component,props);await f.effects();let tree=f.render(component,props);
  assert.equal(nodes(tree).find(n=>n.props.children==='Calendar').props['aria-pressed'],true);
  assert.ok(nodes(tree).some(n=>n.type?.name==='CorporateCalendar'));
  nodes(tree).find(n=>n.props.children==='List').props.onClick();f.render(component,props);await f.effects();tree=f.render(component,props);
  assert.equal(nodes(tree).find(n=>n.props.children==='List').props['aria-pressed'],true);
  assert.match(textContent(tree),/Booking #5F66475E/);assert.doesNotMatch(textContent(tree),new RegExp(id));
  await nodes(tree).find(n=>n.props.children==='Details').props.onClick();assert.deepEqual(calls,[id]);
  tree=f.render(component,props);nodes(tree).find(n=>n.props.children==='Calendar').props.onClick();tree=f.render(component,props);
  assert.ok(nodes(tree).some(n=>n.type?.name==='CorporateCalendar'));
  assert.equal(nodes(tree).find(n=>n.type?.name==='CorporateBookingPanel').props.detail.booking.id,id);
  const reports=fixture(),table=reports.load('app/corporate/components/CorporateOutcomeReports.tsx').OutcomeTable;
  const reportText=textContent(reports.render(table,{rows:[booking]}));assert.match(reportText,/Booking #5F66475E/);assert.doesNotMatch(reportText,new RegExp(id));
  const {corporateOutcomesCsv}=reports.load('lib/corporate-outcomes.ts');assert.match(corporateOutcomesCsv([booking]),new RegExp(id));
  const panelFixture=fixture(),panel=panelFixture.load('app/corporate/components/CorporateBookingList.tsx').CorporateBookingPanel;
  const panelText=textContent(panelFixture.render(panel,{detail:{booking,payments:[],history:[]},admin:false,settings:{booking_enabled:true},dirtyChanged(){},refresh(){},committed:async()=>{}}));
  assert.match(panelText,/Booking #5F66475E/);assert.doesNotMatch(panelText,new RegExp(id));f.unmount();
});

test('corporate responsive rules protect small-screen forms, navigation and calendar without changing print layouts', () => {
  // Source/handler checks are regression guards, not a substitute for real device rendering.
  const css=readFileSync(resolve(root,'app/corporate/corporate.module.css'),'utf8');
  const calendar=readFileSync(resolve(root,'app/corporate/components/corporate-calendar.module.css'),'utf8');
  const volunteer=readFileSync(resolve(root,'app/volunteer/volunteer.module.css'),'utf8');
  assert.match(css,/@media screen and \(max-width:640px\)/);
  assert.match(css,/content:attr\(data-label\)/);
  assert.match(css,/form fieldset\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(css,/min-height:44px/);assert.match(css,/font-size:16px/);
  assert.match(css,/@media screen and \(max-width:480px\)/);
  assert.match(css,/max-height:calc\(100dvh - 32px\)/);
  assert.match(calendar,/\.day \.dayCount\{display:block/);
  assert.match(calendar,/height:80px;min-height:80px/);
  assert.match(calendar,/\.agenda button\{width:100%;min-height:44px\}/);
  assert.match(volunteer,/padding-bottom:\s*calc\(100px \+ env\(safe-area-inset-bottom\)\)/);
});

test('corporate frame shares the volunteer header and sign-out dialog without loading volunteer data', async () => {
  let ended = false, signedOut = 0;
  const f = fixture({}, {
    '@/lib/feature-flags': { corporateBookingsEnabled: true },
    '@/app/components/useSignOut': { useSignOut: () => ({ signOut: async () => { signedOut++; }, busy: false, error: '' }) },
    '@/app/components/useSessionBoundary': { useSessionBoundary: () => ended },
  });
  const frame = f.load('app/corporate/components/CorporateFrame.tsx').default;
  const props = { signedIn: true, workflowAccess: true, account: { company_name: 'Example company', contact_email: 'example@example.invalid' }, children: 'Company records' };
  let tree = f.render(frame, props);
  assert.ok(nodes(tree).find(node => node.type === 'header').props.className.split(' ').includes('topbar'));
  assert.equal(nodes(tree).filter(node => node.type?.name === 'CorporateNavigation').length, 2);
  assert.equal(nodes(tree).filter(node => node.type?.name === 'CorporateNotificationBell').length, 1);
  assert.equal(nodes(tree).find(node => node.type === 'main').props.id, 'corporate-content');
  assert.equal(nodes(tree).some(node => /VolunteerProvider/.test(node.type?.name || '')), false);
  nodes(tree).find(node => node.type === 'button' && node.props.children === 'Sign out').props.onClick();
  tree = f.render(frame, props);
  const dialog = nodes(tree).find(node => node.type?.name === 'ConfirmDialog');
  assert.match(dialog.props.message, /corporate portal/); await dialog.props.onConfirm(); assert.equal(signedOut, 1);
  ended = true;
  tree = f.render(frame, props);
  assert.match(textContent(tree), /Your session has changed/); assert.doesNotMatch(textContent(tree), /Company records|Example company/);
});

test('corporate brand opens bookings for approved companies while the account icon still opens the profile', () => {
  for (const enabled of [true, false]) {
    const f = fixture({}, { '@/lib/feature-flags': { corporateBookingsEnabled: enabled }, '@/app/components/useSignOut': { useSignOut: () => ({ signOut() {}, busy: false, error: '' }) }, '@/app/components/useSessionBoundary': { useSessionBoundary: () => false } });
    const frame = f.load('app/corporate/components/CorporateFrame.tsx').default;
    for (const [signedIn, workflowAccess] of [[true, true], [true, false], [false, false]]) {
      const tree = f.render(frame, { signedIn, workflowAccess, account: signedIn ? { company_name: 'Company' } : null });
      const brand = nodes(tree).find(n => n.props['aria-label']?.startsWith('Ladles of Love'));
      assert.equal(brand.props.href, !signedIn ? '/' : workflowAccess && enabled ? '/corporate/bookings' : '/corporate');
      if (signedIn) assert.equal(nodes(tree).find(n => n.props['aria-label'] === 'Open business profile').props.href, '/corporate');
    }
  }
});

test('corporate header receives the saved company image and retains a mobile profile entry without a duplicate tab', () => {
  const f = fixture({}, { '@/app/components/useSignOut': { useSignOut: () => ({ signOut() {}, busy: false, error: '' }) }, '@/app/components/useSessionBoundary': { useSessionBoundary: () => false } });
  const frame = f.load('app/corporate/components/CorporateFrame.tsx').default;
  const tree = f.render(frame, { signedIn: true, account: { company_name: 'Company' }, avatarUrl: 'https://example.invalid/signed-image' });
  assert.equal(nodes(tree).find(n => n.type?.name === 'ProfileAvatar').props.src, 'https://example.invalid/signed-image');
  assert.equal(nodes(tree).find(n => n.props['aria-label'] === 'Open business profile').props.href, '/corporate');
  assert.match(readFileSync(resolve(root, 'app/corporate/corporate.module.css'), 'utf8'), /\.headerActions \.headerAccount\{display:inline-flex;min-width:44px;min-height:44px/);
});

test('corporate images persist in the own-user profile, survive failed saves and reject wrong-session writes', async t => {
  browser(t); let identity = 'business-user', path = 'business-user/original.webp', writes = 0, reads = 0, fail = false, finish;
  const f = fixture({ getUser: async () => ({ data: { user: { id: identity } }, error: null }) }, {
    '@/lib/actions/profile': { fetchProfileAvatar: async id => { reads++; assert.equal(id, 'business-user'); return path; }, saveProfileAvatar: async (id, blob) => { writes++; assert.equal(id, 'business-user'); if (fail) return { data: null, error: 'Upload failed' }; await new Promise(resolve => { finish = resolve; }); path = blob ? 'business-user/new.webp' : null; return { data: { avatar_path: path }, error: null }; } },
    '@/app/volunteer/components/useProfilePhotoUrl': { useProfilePhotoUrl: path => path ? `signed:${path}` : null },
  });
  const hook = f.load('app/corporate/components/useCorporatePhoto.ts').useCorporatePhoto;
  const render = () => f.render(hook, 'business-user');
  render(); await f.effects(); let state = render(); assert.equal(state.path, path); assert.equal(state.avatarUrl, `signed:${path}`);
  const blob = new Blob(['prepared'], { type: 'image/webp' });
  const pending = state.save(blob); await tick();
  assert.match(await state.save(blob), /already in progress/); assert.equal(writes, 1);
  await state.reload(); assert.equal(reads, 1, 'A focus refresh cannot replace an in-flight save');
  finish(); assert.equal(await pending, null); state = render(); await f.effects(); assert.equal(state.path, 'business-user/new.webp');
  fail = true; assert.equal(await state.save(blob), 'Upload failed'); assert.equal(render().path, 'business-user/new.webp');
  identity = 'other-user'; const previousWrites = writes;
  assert.match(await render().save(blob), /session changed/); assert.equal(writes, previousWrites);
  identity = 'business-user'; fail = false;
  const removal = render().save(null); await tick(); finish(); assert.equal(await removal, null); assert.equal(render().avatarUrl, null);
  f.unmount();
  const remount = fixture({}, { '@/lib/actions/profile': { fetchProfileAvatar: async () => 'business-user/new.webp' }, '@/app/volunteer/components/useProfilePhotoUrl': { useProfilePhotoUrl: path => path ? `signed:${path}` : null } });
  const reloadHook = remount.load('app/corporate/components/useCorporatePhoto.ts').useCorporatePhoto;
  remount.render(reloadHook, 'business-user'); await remount.effects(); assert.equal(remount.render(reloadHook, 'business-user').path, 'business-user/new.webp'); remount.unmount();
});

test('shared image storage updates only avatar_path, preserves the old image on failure and cleans up only own files', async () => {
  for (const failure of ['', 'upload', 'profile']) {
    let path = 'business-user/old.webp'; const operations = [];
    const photo = new Blob(['prepared'], { type: 'image/webp' });
    const storage = {
      upload: async (next, blob, options) => { operations.push(['upload', next, options]); assert.equal(blob, photo); return { error: failure === 'upload' ? new Error('Unavailable') : null }; },
      remove: async paths => { operations.push(['remove', ...paths]); return { error: null }; },
    };
    const f = fixture({}, { '@/lib/supabase': { supabase: {
      storage: { from: bucket => { assert.equal(bucket, 'volunteer-avatars'); return storage; } },
      from: table => {
        assert.equal(table, 'profiles'); let update;
        const query = { select: () => query, eq: (key, id) => { assert.equal(key, 'id'); assert.equal(id, 'business-user'); return query; }, update: input => { assert.deepEqual(Object.keys(input), ['avatar_path']); update = input; operations.push(['profile', input]); return query; }, single: async () => {
          if (update && failure === 'profile') return { data: null, error: new Error('Unavailable') };
          if (update) path = update.avatar_path;
          return { data: { id: 'business-user', avatar_path: path }, error: null };
        } }; return query;
      },
    } } });
    const { saveProfileAvatar } = f.load('lib/actions/profile.ts');
    const result = await saveProfileAvatar('business-user', photo);
    const upload = operations.find(op => op[0] === 'upload');
    assert.match(upload[1], /^business-user\/.+\.webp$/); assert.equal(upload[2].upsert, false);
    if (failure) {
      assert.ok(result.error); assert.equal(path, 'business-user/old.webp');
      assert.equal(operations.some(op => op[0] === 'remove' && op[1] === path), false);
      if (failure === 'profile') assert.ok(operations.some(op => op[0] === 'remove' && op[1] === upload[1]));
    } else {
      assert.equal(result.error, null); assert.equal(path, upload[1]);
      assert.ok(operations.some(op => op[0] === 'remove' && op[1] === 'business-user/old.webp'));
      operations.length = 0; assert.equal((await saveProfileAvatar('business-user', null)).error, null); assert.equal(path, null);
      assert.equal(operations.some(op => op[0] === 'upload'), false);
    }
  }
});

test('late company-image loads and saves cannot expose the previous account image after identity change', async t => {
  browser(t); let release, saveRelease;
  const f = fixture({ getUser: async () => ({ data: { user: { id: 'first' } }, error: null }) }, {
    '@/lib/actions/profile': { fetchProfileAvatar: async id => id === 'first' ? new Promise(resolve => { release = resolve; }) : 'second/photo.webp', saveProfileAvatar: async () => new Promise(resolve => { saveRelease = resolve; }) },
    '@/app/volunteer/components/useProfilePhotoUrl': { useProfilePhotoUrl: path => path ?? null },
  });
  const hook = f.load('app/corporate/components/useCorporatePhoto.ts').useCorporatePhoto;
  f.render(hook, 'first'); await f.effects();
  f.render(hook, 'second'); await f.effects(); release('first/private.webp'); await tick();
  assert.equal(f.render(hook, 'second').avatarUrl, 'second/photo.webp');
  f.render(hook, 'first'); await f.effects(); release(null); await tick();
  const pending = f.render(hook, 'first').save(new Blob(['image'], { type: 'image/webp' })); await tick();
  f.render(hook, undefined); await f.effects(); saveRelease({ data: { avatar_path: 'first/new.webp' }, error: null });
  assert.match(await pending, /session changed/); assert.equal(f.render(hook, undefined).avatarUrl, null); f.unmount();
});

test('corporate image editor previews, requires permission, saves once and confirms removal', async t => {
  browser(t); window.confirm = () => false; const saves = [], dirty = []; let finish;
  const photo = { path: 'business/existing.webp', avatarUrl: 'https://example.invalid/photo', loading: false, saving: false, error: '', reload: async () => {}, save: blob => { saves.push(blob); return new Promise(resolve => { finish = resolve; }); } };
  const blob = new Blob(['prepared'], { type: 'image/webp' });
  const f = fixture({}, { './CorporateWorkspaceProvider': { useCorporateWorkspace: () => ({ data: { account: { company_name: 'Company' } }, photo }) }, '@/lib/avatar': { prepareAvatar: async file => { if (file.invalid) throw new Error('Choose a JPG, PNG, or WebP image.'); return blob; } }, '@/app/components/useUnsavedChanges': { useUnsavedChanges: value => dirty.push(value) } });
  const component = f.load('app/corporate/components/CorporatePhotoEditor.tsx').default;
  const render = () => f.render(component);
  let tree = render(); assert.match(textContent(tree), /Company image/);
  nodes(tree).find(n => n.props.children === 'Remove image').props.onClick(); await tick(); assert.equal(saves.length, 0);
  nodes(tree).find(n => n.type === 'input' && n.props.type === 'file').props.onChange({ target: { files: [{}], value: 'selected' } }); await tick();
  tree = render(); assert.match(textContent(tree), /Preview before saving/); assert.equal(dirty.at(-1), true);
  assert.equal(nodes(tree).find(n => n.props.children === 'Save image').props.disabled, true);
  nodes(tree).find(n => n.type === 'input' && n.props.type === 'checkbox').props.onChange({ target: { checked: true } });
  tree = render(); const save = nodes(tree).find(n => n.props.children === 'Save image');
  save.props.onClick(); save.props.onClick(); assert.equal(saves.length, 1); assert.equal(saves[0], blob);
  finish(null); await tick(); tree = render(); assert.match(textContent(tree), /Company image updated/); assert.equal(dirty.at(-1), false);
  window.confirm = () => true; nodes(tree).find(n => n.props.children === 'Remove image').props.onClick(); assert.equal(saves.at(-1), null); finish(null); await tick();
  tree = render(); assert.match(textContent(tree), /Company image removed/);
  nodes(tree).find(n => n.type === 'input' && n.props.type === 'file').props.onChange({ target: { files: [{ invalid: true }], value: '' } }); await tick();
  assert.match(textContent(render()), /Choose a JPG/); f.unmount();
});

test('corporate notification bell keeps its style and badge while refreshing across persistent-header navigation', async t => {
  browser(t);
  let unread = 3, error = '', loading = false, pathname = '/corporate/updates', refreshes = 0;
  const reload = async () => { refreshes++; };
  const f = fixture({}, {
    'next/navigation': { usePathname: () => pathname },
    '@/app/admin/components/FeatureShared': { useFeatureData: () => ({ data: unread, error, loading, reload }) },
  });
  const bell = f.load('app/corporate/components/CorporateNotificationBell.tsx').default;
  let tree = f.render(bell);
  assert.equal(tree.props.href, '/corporate/updates'); assert.equal(tree.props.className, 'bell');
  assert.equal(tree.props['aria-current'], 'page'); assert.equal(tree.props['aria-label'], 'Notifications, 3 unread');
  assert.equal(nodes(tree).find(node => node.type === 'span').props.children, 3);
  unread = 100; tree = f.render(bell); assert.equal(nodes(tree).find(node => node.type === 'span').props.children, '99+');
  unread = 0; tree = f.render(bell); assert.equal(nodes(tree).filter(node => node.type === 'span').length, 0);
  error = 'Offline'; tree = f.render(bell); assert.match(tree.props['aria-label'], /unavailable/);
  assert.equal(nodes(tree).filter(node => node.type === 'span').length, 0);
  error = ''; loading = true; tree = f.render(bell); assert.match(tree.props['aria-label'], /checking/);
  await f.effects(); assert.equal(refreshes, 0, 'The underlying loader already handles initial entry');
  pathname = '/corporate/bookings'; f.render(bell); await f.effects(); assert.equal(refreshes, 1);
  f.render(bell); await f.effects(); assert.equal(refreshes, 1);
  window.dispatchEvent(new Event('focus')); await tick(); assert.equal(refreshes, 2);
  f.unmount(); window.dispatchEvent(new Event('focus')); await tick(); assert.equal(refreshes, 2);
});

test('corporate unread count includes later pages, caps the badge honestly and rejects incomplete results', async () => {
  let pages = [], calls = [];
  const rows = (start, count, read) => Array.from({ length: count }, (_, i) => ({ id: 'notice-' + (start + i), is_read: read }));
  const f = fixture({}, {
    './actions/corporate-bookings': { getCorporateBookingNotices: async page => { calls.push(page); const value = pages[page - 1]; if (value instanceof Error) throw value; return value; } },
  });
  const count = f.load('lib/corporate-notifications.ts').corporateUnreadBookingCount;
  pages = [{ rows: rows(0, 10, true), total: 12 }, { rows: rows(10, 2, false), total: 12 }];
  assert.equal(await count(), 2); assert.deepEqual(calls, [1, 2]);
  pages = [{ rows: [], total: 0 }]; assert.equal(await count(), 0);
  pages = Array.from({ length: 11 }, (_, i) => ({ rows: rows(i * 10, 10, false), total: 110 }));
  calls = []; assert.equal(await count(), 100); assert.equal(calls.length, 10);
  for (const invalid of [
    [{ rows: [], total: 1 }],
    [{ rows: rows(0, 5, false), total: 12 }],
    [{ rows: rows(0, 10, true), total: 12 }, { rows: rows(10, 2, false), total: 13 }],
    [{ rows: rows(0, 10, true), total: 12 }, { rows: rows(0, 2, false), total: 12 }],
    [{ rows: rows(0, 10, true), total: 12 }, new Error('Offline')],
  ]) { pages = invalid; await assert.rejects(count()); }
});

test('business profile uses Update profile and retains its existing save and unsaved-change handling', () => {
  const source = readFileSync(resolve(root, 'app/corporate/page.tsx'), 'utf8');
  assert.match(source, /label="Update profile"/);
  assert.doesNotMatch(source, /Save business profile/);
  assert.match(source, /await saveCorporateAccount\(detail.account.id, input\)/);
  assert.doesNotMatch(source, /AccountNotices|goToAccount|profileDirty|formVersion/);
  assert.match(source, /<AccountHistory rows=\{detail.history\}/);
  const form = readFileSync(resolve(root, 'app/corporate/components/CorporateAccountForm.tsx'), 'utf8');
  assert.match(form, /useUnsavedChanges\(dirty\)/);
  const admin = readFileSync(resolve(root, 'app/admin/corporate-accounts/page.tsx'), 'utf8');
  assert.doesNotMatch(admin, /AccountNotices|\['notifications','Notifications'\]/);
});

test('one grouped booking filter preserves search, dates and the protected server values', () => {
  const f = fixture({}, { '@/lib/feature-flags': { corporateChangesEnabled: true } });
  const filters = f.load('app/corporate/components/CorporateWorkflowShared.tsx').WorkflowFilters;
  let value = { query: 'Company', from: '2026-11-01', to: '2026-11-30', status: 'Confirmed' };
  const change = next => { value = next; };
  const render = (extra = {}) => f.render(filters, { value, change, statuses: true, ...extra });
  const selects = tree => nodes(tree).filter(node => node.type === 'select');
  let [status] = selects(render());
  assert.equal(selects(render()).length, 1);
  const groups = nodes(status).filter(node => node.type === 'optgroup');
  assert.deepEqual(groups.map(n => n.props.label), ['Booking status', 'Needs attention']);
  assert.deepEqual(nodes(groups[0]).filter(node => node.type === 'option').map(node => textContent(node)), ['Requested', 'Pending payment', 'Confirmed', 'Completed', 'Rejected', 'Cancelled']);
  assert.deepEqual(nodes(groups[1]).filter(node => node.type === 'option').map(node => textContent(node)), ['Payment overdue', 'Additional payment needed', 'Change requested', 'Cancellation requested']);
  for (const selected of ['Overdue', 'Pending additional payment', 'Change requested', 'Cancellation requested']) {
    status.props.onChange({ target: { value: selected } });
    [status] = selects(render());
    assert.equal(status.props.value, selected);
    assert.deepEqual(value, { query: 'Company', from: '2026-11-01', to: '2026-11-30', status: selected });
  }
  status.props.onChange({ target: { value: 'Requested' } });
  [status] = selects(render());
  assert.equal(status.props.value, 'Requested');
  assert.ok(selects(render({ disabled: true })).every(node => node.props.disabled));
  nodes(render()).find(node => node.type === 'button' && node.props.children === 'Clear filters').props.onClick();
  assert.deepEqual(value, { query: '', from: '', to: '', status: '' });
  assert.equal(selects(render({ statuses: false })).length, 0, 'Event browsing has no booking filters');
  const off = fixture({}, { '@/lib/feature-flags': { corporateChangesEnabled: false } });
  const offFilters = off.load('app/corporate/components/CorporateWorkflowShared.tsx').WorkflowFilters;
  const offTree = off.render(offFilters, { value, change, statuses: true });
  assert.doesNotMatch(textContent(offTree), /Change requested|Cancellation requested/);
});

test('calendar dates, month navigation and filter bounds use South African dates across leap years and UTC boundaries', () => {
  const c = fixture().load('lib/corporate-calendar.ts');
  assert.equal(c.calendarDate('2026-10-31T22:15:00Z'), '2026-11-01');
  assert.equal(c.calendarTime('2026-11-15T07:15:00Z'), '09:15');
  assert.equal(c.moveCalendarMonth('2026-12', 1), '2027-01');
  assert.equal(c.moveCalendarMonth('2027-01', -1), '2026-12');
  assert.equal(c.calendarMonthDays('2028-02').flat().filter(Boolean).length, 29);
  assert.equal(c.calendarMonthDays('2027-02').flat().filter(Boolean).length, 28);
  assert.deepEqual(c.calendarMonthDays('2026-11')[0], [null, null, null, null, null, null, '2026-11-01']);
  const filters = { query: 'Team', from: '2026-10-10', to: '2026-12-10', status: 'Overdue' };
  assert.deepEqual(c.calendarFilters('2026-11', filters), { ...filters, from: '2026-11-01', to: '2026-11-30' });
  assert.deepEqual(c.calendarFilters('2026-11', { ...filters, from: '2026-11-05', to: '2026-11-15' }), { ...filters, from: '2026-11-05', to: '2026-11-15' });
  assert.equal(c.calendarFilters('2026-09', filters), null);
  assert.throws(() => c.calendarFilters('2026-11', { ...filters, from: '2026-11-15', to: '2026-11-01' }), /From date/);
  for (const month of ['2026-13', 'invalid', '2026-00']) assert.throws(() => c.calendarMonthDays(month), /valid calendar/);
});

test('calendar follows the current South African date across midnight and months without overriding manual browsing', async () => {
  const calls = [];
  const f = fixture({}, { '@/lib/actions/corporate-bookings': { searchCorporateBookings: async filters => { calls.push(filters); return { rows: [], total: 0 }; } } });
  const calendar = f.load('app/corporate/components/CorporateCalendar.tsx').default;
  let props = { mode: 'bookings', admin: true, filters: { query: '', from: '', to: '', status: '' }, now: Date.parse('2026-10-31T21:59:00Z') };
  const render = () => f.render(calendar, props);
  render(); await f.effects(); let tree = render();
  const month = value => nodes(value).find(n => n.type === 'input' && n.props.type === 'month').props.value;
  assert.equal(month(tree), '2026-10');
  assert.equal(nodes(tree).find(n => n.props['aria-current'] === 'date').props['data-calendar-date'], '2026-10-31');
  assert.equal(nodes(tree).find(n => n.props['data-calendar-date'] === '2026-10-31').props['aria-pressed'], true);
  props = { ...props, now: Date.parse('2026-10-31T22:01:00Z') };
  tree = render(); assert.equal(month(tree), '2026-11'); await f.effects(); tree = render();
  assert.equal(calls.at(-1).from, '2026-11-01');
  assert.equal(nodes(tree).find(n => n.props['aria-current'] === 'date').props['data-calendar-date'], '2026-11-01');
  nodes(tree).find(n => n.props['aria-label'] === 'Previous month').props.onClick();
  tree = render(); assert.equal(month(tree), '2026-10');
  props = { ...props, now: Date.parse('2026-12-02T10:00:00Z') };
  tree = render(); assert.equal(month(tree), '2026-10', 'Do not jump away from a month the user is reviewing');
  nodes(tree).find(n => n.props.children === 'Today').props.onClick();
  tree = render(); assert.equal(month(tree), '2026-12');
  assert.equal(nodes(tree).find(n => n.props['data-calendar-date'] === '2026-12-02').props['aria-pressed'], true);
  const filtered = fixture();
  const filteredCalendar = filtered.load('app/corporate/components/CorporateCalendar.tsx').default;
  assert.equal(month(filtered.render(filteredCalendar, { ...props, filters: { ...props.filters, from: '2026-06-01' } })), '2026-06');
});

test('workflow clock catches up on focus and removes its timer/listener on unmount', async t => {
  browser(t); let timer, cleared = false, timestamp = 1000;
  const original = Date.now; Date.now = () => timestamp; t.after(() => { Date.now = original; });
  window.setInterval = callback => { timer = callback; return 7; };
  window.clearInterval = id => { assert.equal(id, 7); cleared = true; };
  const f = fixture(), clock = f.load('app/corporate/components/CorporateWorkflowShared.tsx').useWorkflowClock;
  assert.equal(f.render(clock), 1000); await f.effects();
  timestamp = 2000; timer(); assert.equal(f.render(clock), 2000);
  timestamp = 3000; window.dispatchEvent(new Event('focus')); assert.equal(f.render(clock), 3000);
  f.unmount(); assert.equal(cleared, true);
  timestamp = 4000; window.dispatchEvent(new Event('focus')); assert.equal(f.render(clock), 3000);
});

test('attendance queue pins its filter, opens the exact booking and starts the attendance form directly', async t => {
  browser(t);window.setInterval=()=>1;window.clearInterval=()=>{};
  const booking={id:'booking-due',version:3,status:'Confirmed',group_size:5,event:{title:'Ended session',starts_at:'2020-11-15T07:00:00Z',ends_at:'2020-11-15T09:00:00Z'},contact_snapshot:{company_name:'Test Company'}};
  const queries=[],opened=[];
  const f=fixture({}, {'@/lib/actions/corporate-bookings':{emptyWorkflowFilters:{query:'',from:'',to:'',status:''},searchCorporateBookings:async filters=>{queries.push(filters);return {rows:[booking],total:1};},getCorporateBookingDetail:async id=>{opened.push(id);return {booking,payments:[],history:[]};}}});
  const list=f.load('app/corporate/components/CorporateBookingList.tsx').default;
  const props={admin:true,attendanceOnly:true,settings:{booking_enabled:true},dirtyChanged(){}};
  f.render(list,props);await f.effects();let tree=f.render(list,props);
  assert.match(textContent(tree),/Attendance to record/);assert.equal(queries.at(-1).status,'Attendance to record');
  assert.equal(nodes(tree).some(n=>n.props.children==='Calendar'),false);
  const filters=nodes(tree).find(n=>n.type?.name==='WorkflowFilters');assert.equal(filters.props.statuses,false);
  filters.props.change({query:'Test',from:'',to:'',status:''});f.render(list,props);await f.effects();tree=f.render(list,props);
  assert.equal(queries.at(-1).status,'Attendance to record');assert.equal(queries.at(-1).query,'Test');
  await nodes(tree).find(n=>n.props.children==='Record attendance').props.onClick();tree=f.render(list,props);
  assert.deepEqual(opened,['booking-due']);const selected=nodes(tree).find(n=>n.type?.name==='CorporateBookingPanel');assert.equal(selected.props.attendanceFocus,true);
  const p=fixture({}, {'@/lib/feature-flags':{corporateOutcomesEnabled:true}}),panel=p.load('app/corporate/components/CorporateBookingList.tsx').CorporateBookingPanel;
  const panelTree=p.render(panel,selected.props),attendance=nodes(panelTree).find(n=>n.type?.name==='CorporateAttendance');assert.equal(attendance.props.initialOpen,true);
  const a=fixture({}, {'@/lib/feature-flags':{corporateOutcomesEnabled:true}}),component=a.load('app/corporate/components/CorporateAttendance.tsx').default;
  const attendanceTree=a.render(component,attendance.props);assert.ok(nodes(attendanceTree).some(n=>n.type?.name==='CorporateAttendanceForm'));
  const formFixture=fixture(),form=formFixture.load('app/corporate/components/CorporateAttendance.tsx').CorporateAttendanceForm;
  const formText=textContent(formFixture.render(form,{booking,dirtyChanged(){},committed:async()=>{}}));
  assert.match(formText,/Event hours/);assert.doesNotMatch(formText,/whole hours, optional/i);
  assert.equal(nodes(tree).find(n=>n.props.children==='Refresh queue').props.disabled,false);f.unmount();
});

test('attendance reminders navigate through access checks to the attendance queue, not the generic booking tab', async t => {
  browser(t);const calls=[];
  const f=fixture({}, {'./feature-flags':{corporateRolloutEnabled:true},'./unsaved-navigation':{confirmUnsavedNavigation:()=>true},'./actions/corporate-bookings':{getCorporateBookingDetail:async id=>calls.push(['check',id])},'./actions/corporate-accounts':{readCorporateAccountNotice:async id=>calls.push(['read',id])}});
  const {openAdminNotice}=f.load('lib/admin-notifications.ts');
  await openAdminNotice({id:'notice',target_kind:'booking',target_id:'booking-1',attendance_due:true},path=>calls.push(['navigate',path]));
  assert.deepEqual(calls,[['check','booking-1'],['read','notice'],['navigate','/admin/corporate-bookings?booking=booking-1&tab=attendance']]);
  window.location.search='?booking=booking-1&tab=attendance';
  const g=fixture({}, {'@/lib/feature-flags':{corporateBookingsEnabled:true,corporateOutcomesEnabled:true}});
  const root=g.render(g.load('app/admin/corporate-bookings/page.tsx').default),route=root.props.children;
  const workspace=g.render(route.type,route.props);assert.equal(workspace.props.initialTab,'attendance');assert.equal(workspace.props.bookingId,'booking-1');
});

test('corporate group attendance is an admin-only end-of-session action, not automatic confirmation', () => {
  const props = { booking: { status: 'Confirmed', group_size: 12, event: { starts_at: '2020-01-01T07:00:00Z', ends_at: '2020-01-01T09:00:00Z' } }, admin: true, dirtyChanged() {}, committed: async () => {} };
  const f = fixture({}, { '@/lib/feature-flags': { corporateOutcomesEnabled: true } });
  const attendance = f.load('app/corporate/components/CorporateAttendance.tsx').default;
  const hasRecordAction = tree => nodes(tree).some(n => n.type === 'button' && n.props.children === 'Record attendance & complete');
  assert.equal(hasRecordAction(f.render(attendance, props)), true);
  assert.equal(hasRecordAction(f.render(attendance, { ...props, admin: false })), false);
  assert.equal(hasRecordAction(f.render(attendance, { ...props, booking: { ...props.booking, event: { ...props.booking.event, ends_at: '2099-01-01T09:00:00Z' } } })), false);
  assert.equal(hasRecordAction(f.render(attendance, { ...props, booking: { ...props.booking, status: 'Pending payment' } })), false);
  const disabled=fixture({}, {'@/lib/feature-flags':{corporateOutcomesEnabled:false}});
  const disabledAttendance=disabled.load('app/corporate/components/CorporateAttendance.tsx').default;
  assert.equal(nodes(disabled.render(disabledAttendance,{...props,initialOpen:true})).some(n=>n.type?.name==='CorporateAttendanceForm'),false);
});

test('calendar loads every page and refuses incomplete, duplicate, changing or excessive results', async () => {
  const { loadCalendarRows } = fixture().load('lib/corporate-calendar.ts');
  const rows = Array.from({ length: 23 }, (_, i) => ({ id: 'event-' + i })), calls = [];
  assert.deepEqual(await loadCalendarRows(async page => { calls.push(page); return { rows: rows.slice((page - 1) * 10, page * 10), total: 23 }; }), rows);
  assert.deepEqual(calls, [1, 2, 3]);
  assert.deepEqual(await loadCalendarRows(async () => ({ rows: [], total: 0 })), []);
  await assert.rejects(loadCalendarRows(async () => ({ rows: rows.slice(0, 1), total: 23 })), /completely/);
  await assert.rejects(loadCalendarRows(async () => ({ rows: [rows[0], rows[0]], total: 2 })), /changed while/);
  await assert.rejects(loadCalendarRows(async page => ({ rows: page === 1 ? rows.slice(0, 10) : rows.slice(10, 20), total: page === 1 ? 23 : 24 })), /changed/);
  await assert.rejects(loadCalendarRows(async () => ({ rows: rows.slice(0, 10), total: 1001 })), /Narrow/);
  await assert.rejects(loadCalendarRows(async () => { throw new Error('Connection lost'); }), /Connection lost/);
});

test('business calendar shows multiple times, allows reserved-date inspection and respects closed requests and dirty forms', async () => {
  const events = [
    { id: 'morning', title: 'Morning group', starts_at: '2099-11-05T07:15:00Z', ends_at: '2099-11-05T08:15:00Z', state: 'Available', remaining: 20, min_group_size: 5, max_group_size: 20 },
    { id: 'afternoon', title: 'Afternoon group', starts_at: '2099-11-05T11:00:00Z', ends_at: '2099-11-05T12:00:00Z', state: 'Available', remaining: 10, min_group_size: 2, max_group_size: 10 },
    { id: 'full', title: 'Full event', starts_at: '2099-11-06T07:00:00Z', state: 'Full', remaining: 0, min_group_size: 2 },
  ];
  const calls = [], selected = [];
  const f = fixture({}, { '@/lib/actions/corporate-bookings': { searchCorporateEvents: async (...args) => { calls.push(args); return { rows: events, total: events.length }; } } });
  const component = f.load('app/corporate/components/CorporateCalendar.tsx').default;
  const props = { mode: 'events', filters: { query: 'group', from: '', to: '', status: '' }, admin: false, now: Date.parse('2099-11-01T10:00:00Z'), requestsOpen: true, onEvent: event => selected.push(event.id) };
  f.render(component, props); await f.effects(); let tree = f.render(component, props);
  assert.doesNotMatch(textContent(nodes(tree).find(n => n.props['aria-label'] === 'Session status legend')), /Unpublished/);
  const adminLegend = nodes(f.render(component, { ...props, admin: true })).find(n => n.props['aria-label'] === 'Session status legend');
  assert.match(textContent(adminLegend), /Unpublished/);
  assert.deepEqual(calls[0], [{ query: 'group', from: '2099-11-01', to: '2099-11-30', status: '' }, 1]);
  const reservedDate = nodes(tree).find(node => node.props['aria-label']?.includes('6 November'));
  assert.equal(reservedDate.props.disabled, false);
  reservedDate.props.onClick(); tree = f.render(component, props);
  assert.ok(nodes(tree).filter(node => node.props.children === 'Request booking').every(node => node.props.disabled));
  nodes(tree).find(node => node.props['aria-label']?.includes('2 available')).props.onClick();
  tree = f.render(component, props);
  assert.match(textContent(tree), /09:15/); assert.match(textContent(tree), /13:00/);
  const requests = nodes(tree).filter(node => node.type === 'button' && node.props.children === 'Request booking');
  assert.equal(requests.length, 2); requests[1].props.onClick(); assert.deepEqual(selected, ['afternoon']);
  tree = f.render(component, { ...props, requestsOpen: false });
  assert.ok(nodes(tree).filter(node => node.props.children === 'Request booking').every(node => node.props.disabled));
  tree = f.render(component, { ...props, disabled: true });
  assert.ok(nodes(tree).filter(node => node.type === 'button').every(node => node.props.disabled));
  tree = f.render(component, props);
  nodes(tree).find(node => node.props['aria-label'] === 'Next month').props.onClick();
  tree = f.render(component, props);
  assert.doesNotMatch(textContent(tree), /Morning group|Afternoon group/);
  assert.ok(nodes(tree).filter(node => typeof node.props['aria-pressed'] === 'boolean').every(node => node.props.disabled));
  await f.effects(); tree = f.render(component, props);
  assert.equal(calls.at(-1)[0].from, '2099-12-01');
});

test('admin booking calendar opens the exact group and retains overdue warnings', async () => {
  const booking = { id: 'booking-1', contact_snapshot: { company_name: 'Example Co' }, group_size: 12, status: 'Pending payment', payment_due_at: '2099-10-31T10:00:00Z', event: { title: 'Group event', starts_at: '2099-11-05T07:15:00Z', ends_at: '2099-11-05T08:15:00Z' } };
  const opened = [], f = fixture({}, { '@/lib/actions/corporate-bookings': { searchCorporateBookings: async () => ({ rows: [booking], total: 1 }) } });
  const calendar = f.load('app/corporate/components/CorporateCalendar.tsx').default;
  const props = { mode: 'bookings', filters: { query: '', from: '', to: '', status: '' }, admin: true, now: Date.parse('2099-11-01T10:00:00Z'), onBooking: id => opened.push(id) };
  f.render(calendar, props); await f.effects(); let tree = f.render(calendar, props);
  // Busy dates contain one compact date control, never an extra booking card.
  const table = nodes(tree).find(node => node.type === 'table');
  assert.equal(nodes(table).some(node => node.props['aria-label']?.startsWith('Review booking for')), false);
  assert.equal(nodes(table).some(node => node.props.children === 'Example Co'), false);
  assert.ok(nodes(table).filter(node => node.type === 'td').every(node => nodes(node).filter(child => child.type === 'button').length <= 1));
  nodes(tree).find(node => node.props['aria-label']?.includes('1 booking')).props.onClick();
  tree = f.render(calendar, props); assert.match(textContent(tree), /Example Co/); assert.match(textContent(tree), /Payment overdue/);
  nodes(tree).find(node => node.props.children === 'Review booking').props.onClick();
  assert.deepEqual(opened, ['booking-1']);
});

test('calendar selection opens existing request/edit flows and new events keep the selected date', () => {
  const empty = { query: '', from: '', to: '', status: '' }, event = { id: 'event-1', version: 2 };
  for (const admin of [false, true]) {
    const f = fixture({}, { '@/lib/actions/corporate-bookings': { emptyWorkflowFilters: empty } });
    const browser = f.load('app/corporate/components/CorporateEventBrowser.tsx').default;
    const props = { admin, account: { company_name: 'Company' }, settings: { booking_enabled: true } };
    let tree = f.render(browser, props), calendar = nodes(tree).find(node => node.type?.name === 'CorporateCalendar');
    calendar.props.onEvent(event); tree = f.render(browser, props);
    const form = nodes(tree).find(node => node.type?.name === (admin ? 'CorporateEventForm' : 'CorporateRequestForm'));
    assert.equal(admin ? form.props.current : form.props.event, event);
    if (admin) {
      calendar.props.onCreateDate('2099-11-12'); tree = f.render(browser, props);
      const create = nodes(tree).find(node => node.type?.name === 'CorporateEventForm');
      assert.equal(create.props.initialDate, '2099-11-12'); assert.equal(create.props.current, undefined);
      const g = fixture(), fields = nodes(g.render(g.load('app/corporate/components/CorporateEventBrowser.tsx').CorporateEventForm, create.props));
      assert.deepEqual(fields.filter(node => node.type === 'input' && node.props.type === 'datetime-local').map(node => node.props.value), ['2099-11-12T09:00', '2099-11-12T10:00']);
    } else assert.equal(calendar.props.onCreateDate, undefined);
  }
});

test('corporate event duration is a whole number independent of headcount in validation, display and CSV', () => {
  const f = fixture(), outcomes = f.load('lib/corporate-outcomes.ts');
  assert.deepEqual(outcomes.cleanCorporateAttendance(12, '12', '2', 'Event completed.'), { attendance_count: 12, event_hours: 2, note: 'Event completed.' });
  for (const hours of ['1.5', '24.1', '-1', 'NaN', '25']) assert.throws(() => outcomes.cleanCorporateAttendance(12, '12', hours, 'Note'), /whole number/);
  const row = { id: 'booking', status: 'Completed', group_size: 12, contact_snapshot: { company_name: 'Company' }, event: { title: 'Group event', starts_at: '2020-11-15T09:00:00+02:00', ends_at: '2020-11-15T11:00:00+02:00' }, attendance: { attendance_count: 12, event_hours: 2, group_hours: 24 } };
  const csv = outcomes.corporateOutcomesCsv([row]);
  assert.match(csv, /Event hours/); assert.ok(csv.endsWith('"12","2"')); assert.doesNotMatch(csv, /"24"|2\.00/);
  const table = f.load('app/corporate/components/CorporateOutcomeReports.tsx').OutcomeTable;
  const tree = f.render(table, { rows: [row] });
  assert.equal(nodes(tree).filter(node => node.type === 'td').at(-1).props.children, 2);
  const legacy = { ...row, attendance: { attendance_count: 12, group_hours: 24 } };
  assert.ok(outcomes.corporateOutcomesCsv([legacy]).endsWith('\"12\",\"\"'));
});

test('workflow pagination hides a single page but allows returning from a page emptied by updates', () => {
  const f = fixture(), pagination = f.load('app/corporate/components/CorporateWorkflowShared.tsx').WorkflowPagination;
  const changes = [], change = page => changes.push(page);
  for (const total of [0, 1, 10]) assert.equal(f.render(pagination, { page: 1, total, change }), null);
  let tree = f.render(pagination, { page: 1, total: 11, change });
  assert.equal(nodes(tree).find(node => node.props.children === 'Previous').props.disabled, true);
  nodes(tree).find(node => node.props.children === 'Next').props.onClick();
  assert.deepEqual(changes, [2]);
  tree = f.render(pagination, { page: 2, total: 0, change });
  assert.equal(nodes(tree).find(node => node.props.children === 'Previous').props.disabled, false);
  assert.equal(nodes(tree).find(node => node.props.children === 'Next').props.disabled, true);
  nodes(tree).find(node => node.props.children === 'Previous').props.onClick();
  assert.deepEqual(changes, [2, 1]);
  tree = f.render(pagination, { page: 2, total: 30, change, disabled: true });
  assert.ok(nodes(tree).filter(node => node.type === 'button').every(node => node.props.disabled));
});

test('header contact dialog keeps portal scopes separate, refreshes contacts and restores scrolling on close', async t => {
  browser(t); let data={portal:'corporate',version:1,contacts:[]}, reloads=0, error='';
  const previousDocument=globalThis.document;
  globalThis.document={body:{style:{overflow:'auto'}}};
  t.after(()=>{globalThis.document=previousDocument;});
  const reload=async()=>{reloads++;};
  const f=fixture({}, {
    '@/app/admin/components/FeatureShared':{useFeatureData:()=>({data,loading:false,error,reload})},
    './useDialogFocus':{useDialogFocus(){}},
    'react-dom':{createPortal:content=>content},
  });
  const button=f.load('app/components/PortalContactButton.tsx').default;
  assert.equal(f.render(button,{portal:'corporate'}),null);
  data={...data,contacts:[
    {kind:'phone',label:'Payment enquiries',value:'+27 21 555 5678',is_primary:false},
    {kind:'email',label:'Corporate bookings',value:'bookings@example.invalid',is_primary:true},
    {kind:'phone',label:'Bookings',value:'+27 21 555 1234',is_primary:true},
  ]};
  let tree=f.render(button,{portal:'corporate'});await f.effects();
  assert.equal(nodes(tree).some(n=>n.props.role==='dialog'),false,'Details stay closed until requested');
  const trigger=nodes(tree).find(n=>n.props['aria-haspopup']==='dialog');
  assert.equal(trigger.props['aria-label'],'Contact team');
  trigger.props.onClick();tree=f.render(button,{portal:'corporate'});await f.effects();
  assert.equal(document.body.style.overflow,'hidden');
  assert.equal(nodes(tree).find(n=>n.props.role==='dialog').props['aria-modal'],'true');
  assert.match(textContent(tree),/Payment enquiries/);
  const controls=nodes(tree).filter(n=>n.type?.name==='ContactOptions');assert.equal(controls.length,3);
  assert.ok(controls.every(n=>n.props.expanded));assert.equal(controls[0].props.email,'bookings@example.invalid');
  assert.equal(reloads,1,'Opening refreshes centrally configured details');
  window.dispatchEvent(new Event('focus'));await tick();assert.equal(reloads,2);
  window.dispatchEvent(new Event('portal-contacts-changed'));await tick();assert.equal(reloads,3);
  error='Offline';tree=f.render(button,{portal:'corporate'});assert.match(textContent(tree),/temporarily unavailable/);
  assert.equal(nodes(tree).some(n=>n.type?.name==='ContactOptions'),false,'Do not show stale contacts after a failed refresh');
  nodes(tree).find(n=>n.props['aria-label']==='Close contact details').props.onClick();
  tree=f.render(button,{portal:'corporate'});await f.effects();
  assert.equal(document.body.style.overflow,'auto');
  assert.equal(nodes(tree).some(n=>n.props.role==='dialog'),false);
  error='';assert.equal(f.render(button,{portal:'volunteer'}),null,'Never display cached contacts from another portal');
  f.unmount();window.dispatchEvent(new Event('focus'));await tick();assert.equal(reloads,3);
});

test('portal contact validation and API use checked portal scopes, versions and editable fields only', async () => {
  const calls=[];let response;
  const f=fixture({}, {'@/lib/supabase':{supabase:{rpc:async(name,args)=>{calls.push([name,args]);return response;}}}});
  const api=f.load('lib/actions/portal-contacts.ts'), {cleanPortalContacts:clean}=f.load('lib/portal-contacts.ts');
  const email={kind:'email',label:' Team ',value:' team@example.invalid ',is_primary:true};
  const phone={kind:'phone',label:' Support ',value:' +27 21 555 1234 ',is_primary:true};
  response={data:{portal:'volunteer',version:1,contacts:[]},error:null};assert.equal((await api.getPortalContacts('volunteer')).portal,'volunteer');
  response={data:{portal:'volunteer',version:2,contacts:clean([email,phone])},error:null};
  await api.savePortalContacts('volunteer',1,[{...email,owner:'malicious',portal:'corporate'},phone]);
  assert.deepEqual(calls.at(-1)[1],{p_portal:'volunteer',p_version:1,p_contacts:clean([email,phone])});
  assert.equal(calls.at(-1)[1].p_contacts[0].value,'team@example.invalid');
  for(const list of [[email,{...email,label:'Other'}],[{...email,is_primary:false}],[{...phone,value:'x'}],Array(13).fill(email)])assert.throws(()=>clean(list));
  const before=calls.length;await assert.rejects(api.savePortalContacts('corporate',0,[email]));await assert.rejects(api.getPortalContacts('invalid'));assert.equal(calls.length,before);
  response={data:{portal:'corporate',version:2,contacts:[]},error:null};await assert.rejects(api.getPortalContacts('volunteer'),/confirmed/);
  response={data:null,error:{code:'PGRST202',message:'missing'}};await assert.rejects(api.getPortalContacts('volunteer'),/temporarily unavailable/);
  response={data:{booking_enabled:true},error:null};await api.setCorporateBookingAvailability(true);assert.deepEqual(calls.at(-1),['set_corporate_booking_availability',{p_enabled:true}]);
  response={data:{booking_enabled:false},error:null};await assert.rejects(api.setCorporateBookingAvailability(true),/confirmed/);
});

test('admin contact form preserves draft methods, chooses one primary per kind and blocks repeated saves', async t => {
  browser(t);window.confirm=()=>false;
  const initial={portal:'corporate',version:3,contacts:[{kind:'email',label:'Bookings',value:'team@example.invalid',is_primary:true},{kind:'phone',label:'Bookings',value:'+27 21 555 1234',is_primary:true}]};
  const writes=[], saved=[],busy=[];let finish,reloads=0;
  const f=fixture({}, {'@/app/components/useUnsavedChanges':{useUnsavedChanges(){}},'@/lib/actions/portal-contacts':{savePortalContacts:async(...args)=>{writes.push(args);return new Promise(resolve=>{finish=resolve;});}}});
  const form=f.load('app/admin/components/PortalContactSettings.tsx').PortalContactForm,props={initial,saved:value=>saved.push(value),busyChanged:value=>busy.push(value),reload:async()=>{reloads++;}};
  const render=()=>f.render(form,props);let tree=render();
  nodes(tree).find(n=>n.props.children==='Add phone').props.onClick();tree=render();
  const inputs=nodes(tree).filter(n=>n.type==='input');
  inputs.find(n=>n.props.value==='').props.onChange({target:{value:'Payment enquiries'}});tree=render();
  nodes(tree).find(n=>n.type==='input'&&n.props.type==='tel'&&n.props.value==='').props.onChange({target:{value:'+27 21 555 5678'}});tree=render();
  const radios=nodes(tree).filter(n=>n.type==='input'&&n.props.type==='radio');radios.at(-1).props.onChange();
  tree=render();assert.deepEqual(nodes(tree).filter(n=>n.type==='input'&&n.props.name==='corporate-primary-phone').map(n=>n.props.checked),[false,true]);
  nodes(tree).find(n=>n.props.children==='Reload saved contacts').props.onClick();assert.equal(reloads,0);
  const submit=tree.props.onSubmit({preventDefault(){}});tree.props.onSubmit({preventDefault(){}});await tick();assert.equal(writes.length,1);assert.equal(writes[0][1],3);
  assert.equal(writes[0][2].at(-1).is_primary,true);assert.equal(render().props.children.props.disabled,true);
  finish({...initial,version:4,contacts:writes[0][2]});await submit;assert.equal(saved.length,1);assert.deepEqual(busy,[true,false]);
  tree=render();nodes(tree).find(n=>n.props['aria-label']==='Remove Payment enquiries').props.onClick();tree=render();
  assert.equal(nodes(tree).find(n=>n.type==='input'&&n.props.name==='corporate-primary-phone').props.checked,true);
  window.confirm=()=>true;nodes(tree).find(n=>n.props.children==='Reload saved contacts').props.onClick();assert.equal(reloads,1);
});

test('booking controls edit availability only and link to the central contact tab', async t => {
  browser(t);window.confirm=()=>true;const writes=[];
  const f=fixture({}, {'@/app/components/useUnsavedChanges':{useUnsavedChanges(){}},'@/lib/actions/portal-contacts':{setCorporateBookingAvailability:async enabled=>{writes.push(enabled);return {booking_enabled:enabled};}}});
  const controls=f.load('app/corporate/components/CorporateBookingControls.tsx').default;
  const props={initial:{booking_enabled:false},saved(){},dirtyChanged(){}};let tree=f.render(controls,props);
  assert.ok(nodes(tree).some(n=>n.props.href==='/admin/settings?section=contact-settings'));
  assert.deepEqual(nodes(tree).filter(n=>n.type==='input').map(n=>n.props.type),['checkbox']);
  nodes(tree).find(n=>n.type==='input').props.onChange({target:{checked:true}});tree=f.render(controls,props);
  await nodes(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.deepEqual(writes,[true]);
});

test('both portal headers use one contact shortcut and remove the repeated footer', () => {
  for(const [file,portal] of [['app/corporate/components/CorporateFrame.tsx','corporate'],['app/volunteer/components/VolunteerHeader.tsx','volunteer']]) {
    const source=readFileSync(resolve(root,file),'utf8');
    assert.ok(source.includes('<PortalContactButton portal="'+portal+'"'));
    assert.doesNotMatch(source,/PortalContactFooter/);
  }
  assert.doesNotMatch(readFileSync(resolve(root,'app/volunteer/components/VolunteerShell.tsx'),'utf8'),/PortalContactFooter/);
  const source=readFileSync(resolve(root,'app/corporate/components/CorporateBookingList.tsx'),'utf8');
  assert.doesNotMatch(source,/BookingContact/);
});

test('business account recovery uses the sign-in email, blocks duplicate clicks and refuses a changed identity', async t => {
  browser(t);
  for (const identity of ['signin@example.invalid', 'other@example.invalid']) {
    let calls = 0, finish;
    const f = fixture({
      getUser: async () => ({ data: { user: { email: identity } }, error: null }),
      resetPasswordForEmail: async (email, options) => {
        calls++; assert.equal(email, 'signin@example.invalid');
        assert.equal(options.redirectTo, 'https://portal.example.invalid/update-password');
        return new Promise(resolve => { finish = resolve; });
      },
    });
    const security = f.load('app/corporate/components/CorporateAccountSecurity.tsx').default;
    const render = () => f.render(security, { email: 'signin@example.invalid', verified: true });
    const tree = render(); assert.match(textContent(tree), /Sign-in email/);
    const button = nodes(tree).find(n => n.type === 'button');
    const first = button.props.onClick(); await tick();
    const second = button.props.onClick(); await tick();
    if (identity === 'signin@example.invalid') {
      assert.equal(calls, 1); finish({ error: null }); await first; await second;
      assert.equal(nodes(render()).find(n => n.type === 'button').props.disabled, true);
      assert.match(textContent(render()), /Check your inbox and spam/);
    } else { await first; await second; assert.equal(calls, 0); assert.match(textContent(render()), /session changed/); }
    f.unmount();
  }
});

test('business recovery failures remain retryable and missing sign-in emails disable sending', async t => {
  browser(t); let calls = 0;
  const f = fixture({ getUser: async () => ({ data: { user: { email: 'signin@example.invalid' } } }), resetPasswordForEmail: async () => { calls++; return { error: new Error('Email service unavailable') }; } });
  const security = f.load('app/corporate/components/CorporateAccountSecurity.tsx').default;
  const render = (email = 'signin@example.invalid') => f.render(security, { email, verified: true });
  await nodes(render()).find(n => n.type === 'button').props.onClick();
  assert.match(textContent(render()), /Email service unavailable/);
  assert.equal(nodes(render()).find(n => n.type === 'button').props.disabled, false);
  assert.equal(nodes(render('')).find(n => n.type === 'button').props.disabled, true); assert.equal(calls, 1);
});

test('group reports keep Completed scope after date changes and clearing, with the same CSV and print scope', async t => {
  browser(t); window.requestAnimationFrame = callback => { callback(); return 1; }; let printed = 0; window.print = () => { printed++; };
  const row = { id: 'booking', status: 'Completed', group_size: 12, contact_snapshot: { company_name: 'Company' }, event: { title: 'Two hours', starts_at: '2026-11-15T09:00:00+02:00', ends_at: '2026-11-15T11:00:00+02:00' }, attendance: { attendance_count: 12, event_hours: 2 } };
  const queries = [], outputs = [];
  const f = fixture({}, {
    '@/lib/feature-flags': { corporateOutcomesEnabled: true },
    '@/lib/actions/corporate-outcomes': {
      getCorporateOutcomeReport: async (filters, page) => { queries.push({ ...filters, page }); return { rows: [row], total: 1, summary: { completed_groups: 1, attendance_instances: 12, event_hours: 2, groups_without_hours: 0 } }; },
      loadAllCorporateOutcomeRows: async filters => { outputs.push({ ...filters }); return [row]; },
    },
  });
  const entry = f.render(f.load('app/corporate/components/CorporateOutcomeReports.tsx').default, {});
  const render = () => f.render(entry.type, entry.props);
  render(); await f.effects(); let tree = render();
  assert.equal(queries[0].status, 'Completed');
  assert.doesNotMatch(textContent(tree), /Accepted places|Overdue bookings|Needs attention/);
  const filters = () => nodes(render()).find(n => n.type?.name === 'WorkflowFilters');
  assert.equal(filters().props.statuses, undefined);
  filters().props.change({ query: 'Company', from: '2026-11-01', to: '2026-11-30', status: 'Overdue' });
  render(); await f.effects(); assert.equal(queries.at(-1).status, 'Completed');
  tree = render(); nodes(tree).find(n => n.type === 'button' && textContent(n) === 'Print filtered report').props.onClick(); await tick();
  assert.equal(printed, 1); assert.deepEqual(outputs.at(-1), { query: 'Company', from: '2026-11-01', to: '2026-11-30', status: 'Completed' });
  filters().props.change({ query: '', from: '', to: '', status: '' });
  render(); await f.effects(); assert.equal(queries.at(-1).status, 'Completed');
  assert.equal(queries.at(-1).from, '');
  const oldDocument = globalThis.document; t.after(() => { globalThis.document = oldDocument; });
  let downloaded = 0;
  globalThis.document = { createElement: () => ({ click() { downloaded++; }, remove() {} }), body: { appendChild() {} } };
  window.setTimeout = callback => { callback(); return 1; };
  nodes(render()).find(n => n.type === 'button' && textContent(n) === 'Export CSV').props.onClick(); await tick();
  assert.equal(downloaded, 1); assert.equal(outputs.at(-1).status, 'Completed'); assert.equal(outputs.at(-1).from, '');
  const source = readFileSync(resolve(root, 'app/corporate/components/CorporateOutcomeReports.tsx'), 'utf8');
  assert.match(source, /corporateOutcomesCsv\(rows\)/); // Both output modes use the same full-scope loader.
  f.unmount();
});

test('corporate booking next steps distinguish requests, held sessions, overdue and checked proposals', () => {
  const { corporateBookingNextStep: next } = fixture().load('lib/corporate-booking-utils.ts');
  assert.match(next({ status: 'Requested' }), /does not reserve/);
  assert.match(next({ status: 'Pending payment', payment_due_at: '2099-11-14T17:00:00+02:00' }), /whole session reserved/);
  assert.match(next({ status: 'Pending payment', payment_due_at: '2020-01-01' }), /extend the deadline or reject/);
  assert.match(next({ status: 'Confirmed' }), /before attending/);
  assert.match(next({ status: 'Confirmed', pending_change: { kind: 'Amendment' } }), /original booking is unchanged/);
  assert.match(next({ status: 'Cancelled' }), /Do not attend/);
  assert.match(next({ status: 'Rejected' }), /another available session/);
  assert.match(next({ status: 'Completed' }), /Group reports/);
});

test('admin inbox targets resolve exact accounts/bookings before marking read, and denied navigation keeps unread state', async t => {
  browser(t);
  const calls = []; let allow = true, deny = false;
  const f = fixture({}, {
    './feature-flags': { corporateRolloutEnabled: true },
    './unsaved-navigation': { confirmUnsavedNavigation: () => allow },
    './actions/corporate-accounts': { corporateAccountError: e => e.message, getCorporateAccountDetail: async id => { calls.push(['account',id]); if (deny) throw new Error('Denied'); }, readCorporateAccountNotice: async id => { calls.push(['read',id]); return true; } },
    './actions/corporate-bookings': { getCorporateBookingDetail: async id => { calls.push(['booking',id]); if (deny) throw new Error('Denied'); } },
  });
  const { openAdminNotice } = f.load('lib/admin-notifications.ts');
  const navigate = path => calls.push(['navigate',path]);
  for (const kind of ['account','booking']) {
    calls.length=0;
    const notice = { id:'notice',target_kind:kind,target_id:'record' };
    await openAdminNotice(notice,navigate);
    assert.deepEqual(calls, [[kind,'record'],['read','notice'],['navigate',kind==='account' ? '/admin/corporate-accounts?account=record' : '/admin/corporate-bookings?booking=record']]);
    calls.length=0; allow=false; await assert.rejects(openAdminNotice(notice,navigate),/cancelled/); assert.equal(calls.length,0);
    allow=true; deny=true; await assert.rejects(openAdminNotice(notice,navigate),/Denied/); assert.equal(calls.some(c=>c[0]==='read'||c[0]==='navigate'),false); deny=false;
  }
});

test('admin bell uses the full server unread count, caps only its label and refreshes on navigation, polling and reads', async t => {
  browser(t); window.location.pathname='/admin'; let calls=0, poll, cleared=false, unread=125;
  window.setInterval = callback => { poll=callback; return 23; }; window.clearInterval = id => { assert.equal(id,23); cleared=true; };
  const f = fixture({}, { '@/lib/admin-notifications': { adminNoticesChanged:'admin-test-updates', loadAdminNoticeBadge:async()=>{ calls++;return {unread_total:unread}; } } });
  const bell = f.load('app/admin/components/AdminNotificationBell.tsx').default;
  f.render(bell); await f.effects(); let tree=f.render(bell);
  assert.equal(tree.props.href,'/admin/notifications'); assert.match(tree.props['aria-label'],/125 unread/);
  assert.ok(nodes(tree).some(n=>n.props.children==='99+'));
  window.location.pathname='/admin/corporate-accounts'; f.render(bell); await f.effects(); assert.equal(calls,2);
  window.dispatchEvent(new Event('focus')); await tick(); assert.equal(calls,3);
  poll(); await tick(); assert.equal(calls,4);
  unread=0; window.dispatchEvent(new Event('admin-test-updates')); await tick(); tree=f.render(bell);
  assert.match(tree.props['aria-label'],/0 unread/); assert.equal(nodes(tree).some(n=>n.type==='span'),false);
  f.unmount(); const stopped=calls; assert.equal(cleared,true); window.dispatchEvent(new Event('admin-test-updates')); await tick(); assert.equal(calls,stopped);
});

test('admin inbox API validates pages and missing results instead of reporting false zero unread', async () => {
  let calls=0, response={ data:{rows:[],total:0,unread_total:105},error:null };
  const f=fixture({}, { './feature-flags':{corporateRolloutEnabled:true}, '@/lib/supabase':{supabase:{rpc:async(name,args)=>{calls++;assert.equal(name,'corporate_admin_notices');assert.equal(args.p_limit,1);return response;}}} });
  const api=f.load('lib/admin-notifications.ts');
  assert.equal((await api.loadAdminNoticeBadge()).unread_total,105);
  for(const args of [['',false,0],['bad',false,1],['',false,1.5]])await assert.rejects(api.loadAdminNotices(...args),/valid notification/);
  assert.equal(calls,1);
  response={data:null,error:null};await assert.rejects(api.loadAdminNoticeBadge(),/completely/);
  response={data:null,error:{message:'Denied'}};await assert.rejects(api.loadAdminNoticeBadge(),/Denied/);
});

test('admin cleanup removes only the legacy UI and duplicate notification tabs, keeping company contacts and separate reports', () => {
  assert.equal(existsSync(resolve(root,'app/admin/csr/page.tsx')),false);
  assert.equal(existsSync(resolve(root,'app/admin/components/LegacyCorporateHistory.tsx')),false);
  for(const path of ['app/admin/components/Sidebar.tsx','app/admin/components/TopHeader.tsx'])assert.doesNotMatch(readFileSync(resolve(root,path),'utf8'),/\/admin\/csr|Legacy CSR history/);
  const bookings=readFileSync(resolve(root,'app/admin/corporate-bookings/page.tsx'),'utf8');
  assert.doesNotMatch(bookings,/BookingContact|CorporateBookingUpdates|Booking updates|CorporateOutcomeReports admin/);
  assert.match(readFileSync(resolve(root,'app/admin/corporate-reports/page.tsx'),'utf8'),/CorporateOutcomeReports admin/);
  const accounts=readFileSync(resolve(root,'app/admin/corporate-accounts/page.tsx'),'utf8');assert.doesNotMatch(accounts,/AccountNotices/);assert.match(accounts,/ContactOptions/);
  const reports=readFileSync(resolve(root,'app/admin/components/ReportsManager.tsx'),'utf8'); assert.match(reports,/loadVolunteerReportData/);assert.doesNotMatch(reports,/corporateOnly|corporateHours|Corporate impact/);
  const dashboard=readFileSync(resolve(root,'app/admin/components/DashboardAnalytics.tsx'),'utf8');assert.match(dashboard,/loadVolunteerReportData/);assert.doesNotMatch(dashboard,/corporateHours/);
});

test('corporate event form sends explicit draft/publish intent with one group-size limit and checked change messages', async t => {
  browser(t); window.confirm=()=>true;
  for(const publication of ['draft','publish']) {
    const calls=[];
    const f=fixture({}, {'@/lib/actions/corporate-bookings':{saveCorporateEvent:async(...args)=>{calls.push(args);return {};}}});
    const form=f.load('app/corporate/components/CorporateEventBrowser.tsx').CorporateEventForm;
    const current={id:'session',version:2,title:'Event',description:'Description',location:'Venue',starts_at:'2099-11-15T09:15:00+02:00',ends_at:'2099-11-15T11:15:00+02:00',max_group_size:30,is_published:true,affected_bookings:0};
    const props={current,committed(){},dirtyChanged(){}};
    const tree=f.render(form,props), fields=nodes(tree);
    assert.equal(fields.filter(n=>n.type==='input'&&n.props.type==='number').length,1);
    assert.equal(fields.find(n=>n.type==='textarea'&&n.props.maxLength===800).props.required,false);
    await fields.find(n=>n.type==='form').props.onSubmit({preventDefault(){},nativeEvent:{submitter:{value:publication}}});
    assert.equal(calls[0][0].is_published,publication==='publish');assert.equal(calls[0][0].capacity,30);assert.equal(calls[0][0].min_group_size,1);assert.equal(calls[0][0].max_group_size,30);
  }
});

test('contact controls reveal details, offer explicit apps, and support copy failures without hiding the values', async t => {
  const old=globalThis.navigator;t.after(()=>Object.defineProperty(globalThis,'navigator',{configurable:true,value:old}));
  let copied=[];Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async text=>{copied.push(text);}}}});
  const f=fixture(), component=f.load('app/components/ContactOptions.tsx').default;
  const props={email:'person@example.invalid',phone:'+27 21 555 1234',phoneLabel:'Cellphone'};let tree=f.render(component,props);
  assert.equal(tree.type,'details');assert.match(textContent(tree),/person@example.invalid/);
  assert.ok(nodes(tree).some(n=>n.type==='a'&&n.props.children==='Open email app'));
  await nodes(tree).find(n=>n.type==='button'&&n.props.children==='Copy email').props.onClick();await tick();assert.deepEqual(copied,['person@example.invalid']);
  assert.match(textContent(f.render(component,props)),/Email copied/);
  navigator.clipboard.writeText=async()=>{throw new Error('No clipboard');};tree=f.render(component,props);
  nodes(tree).find(n=>n.type==='button'&&/Copy\s+cellphone/.test(textContent(n))).props.onClick();await tick();assert.match(textContent(f.render(component,props)),/copy.*manually/);
});

test('admin inbox exposes both Go to actions and prevents duplicate opening while retaining filters', async t => {
  browser(t);window.setInterval=()=>1;window.clearInterval=()=>{};
  const reads=[], opened=[], loads=[];let finish;
  const rows=[{id:'a',account_id:'company',target_id:'company',target_kind:'account',company_name:'Company',title:'Account updated',message:'Review account.',created_at:'2026-10-23T08:00:00Z',is_read:false},{id:'b',account_id:'company',target_id:'booking',target_kind:'booking',company_name:'Company',title:'Booking requested',message:'Review booking.',created_at:'2026-10-23T09:00:00Z',is_read:false}];
  const f=fixture({}, {
    '@/lib/feature-flags':{corporateRolloutEnabled:true},
    '@/lib/admin-notifications':{adminNoticesChanged:'admin-inbox-test',loadAdminNotices:async(...args)=>{loads.push(args);return {rows,total:2,unread_total:2};},openAdminNotice:async(notice,navigate)=>{opened.push(notice.id);await new Promise(resolve=>{finish=resolve;});navigate('/admin/corporate-bookings?booking='+notice.target_id);}},
    '@/lib/actions/corporate-accounts':{readCorporateAccountNotice:async id=>{reads.push(id);return true;}},
  });
  const entry=f.render(f.load('app/admin/notifications/page.tsx').default,{}), render=()=>f.render(entry.type,entry.props);
  render();await f.effects();let tree=render();
  assert.match(textContent(tree),/Go to account/);assert.match(textContent(tree),/Go to booking/);
  const button=nodes(tree).find(n=>n.type==='button'&&n.props.children==='Go to booking');button.props.onClick();button.props.onClick();await tick();assert.deepEqual(opened,['b']);finish();await tick();
  assert.deepEqual(f.routes,['/admin/corporate-bookings?booking=booking']);
  tree=render();nodes(tree).find(n=>n.type==='button'&&n.props.children==='Mark as read').props.onClick();await tick();assert.deepEqual(reads,['a']);
  tree=render();nodes(tree).find(n=>n.type==='select').props.onChange({target:{value:'booking'}});render();await f.effects();assert.deepEqual(loads.at(-1),['booking',false,1]);f.unmount();
});

test('admin and corporate bulk-read buttons cover the whole inbox, block repeated clicks and refresh their bells', async t => {
  browser(t);
  for(const admin of [false,true]) {
    let writes=0,reloads=0,finish,fail=false;
    const event=admin?'admin-corporate-notices-changed':'corporate-booking-notices-changed';let noticesChanged=0;
    const changed=()=>{noticesChanged++;};window.addEventListener(event,changed);
    const rows=[{id:'notice',account_id:'company',booking_id:'booking',target_id:'booking',target_kind:'booking',title:'Update',message:'Details',company_name:'Company',created_at:'2026-10-23T10:00:00Z',is_read:false}];
    const loaded={data:{rows,total:35,unread_total:35},loading:false,error:'',reload:async()=>{reloads++;}};
    const f=fixture({}, {'@/lib/feature-flags':{corporateRolloutEnabled:true},'../components/useAdminNoticeData':{useAdminNoticeData:()=>loaded},'./useCorporateFeatureData':{useCorporateFeatureData:()=>loaded},'@/lib/actions/corporate-accounts':{markAllCorporateNoticesRead:async()=>{writes++;if(fail)throw new Error('Update unavailable');await new Promise(resolve=>{finish=resolve;});return 35;}}});
    const entry=admin?f.render(f.load('app/admin/notifications/page.tsx').default):null;
    const component=admin?entry.type:f.load('app/corporate/components/CorporateBookingUpdates.tsx').default;
    const props=admin?entry.props:{goToBooking:async()=>{}};
    let tree=f.render(component,props), button=nodes(tree).find(n=>n.props.children==='Mark all as read');assert.equal(button.props.disabled,false);
    button.props.onClick();button.props.onClick();await tick();assert.equal(writes,1);
    tree=f.render(component,props);assert.equal(nodes(tree).find(n=>typeof n.props.children==='string'&&n.props.children.startsWith('Marking as read')).props.disabled,true);
    finish();await tick();assert.equal(reloads,1);assert.equal(noticesChanged,1);assert.match(textContent(f.render(component,props)),/All (?:existing )?notifications/);
    fail=true;tree=f.render(component,props);nodes(tree).find(n=>n.props.children==='Mark all as read').props.onClick();await tick();
    tree=f.render(component,props);assert.match(textContent(tree),/Update unavailable/);assert.equal(nodes(tree).find(n=>n.props.children==='Mark all as read').props.disabled,false);
    assert.equal(reloads,1);assert.equal(noticesChanged,1);
    loaded.loading=true;tree=f.render(component,props);assert.equal(nodes(tree).find(n=>n.props.children==='Mark all as read').props.disabled,true);
    window.removeEventListener(event,changed);f.unmount();
  }
});

test('volunteer inbox has the same bulk label and one write even when more than ten messages are unread', async () => {
  let writes=0,finish;
  const notifications=Array.from({length:25},(_,id)=>({id,type:'event_cancelled',title:'Event update',created_at:'2026-10-23T10:00:00Z',is_read:false}));
  const context={notifications,notificationsLoading:false,notificationError:null,refreshNotifications:async()=>{},dismissNotification:async()=>{},markAllNotificationsRead:()=>{writes++;return new Promise(resolve=>{finish=resolve;});},events:[],eventSlots:[],bookings:[],profile:{id:'volunteer'}};
  const f=fixture({}, {'./VolunteerProvider':{useVolunteerData:()=>context}}), component=f.load('app/volunteer/components/NotificationPanel.tsx').default;
  let tree=f.render(component,{});assert.equal(nodes(tree).filter(n=>n.type==='article').length,10);
  const button=nodes(tree).find(n=>n.props.children==='Mark all as read');button.props.onClick();button.props.onClick();await tick();assert.equal(writes,1);
  finish();await tick();context.notifications=notifications.map(n=>({...n,is_read:true}));tree=f.render(component,{});
  assert.equal(nodes(tree).find(n=>n.props.children==='Mark all as read').props.disabled,true);
});

test('bulk-read API accepts zero, never sends a user ID, and refuses unconfirmed responses', async () => {
  for(const value of [0,30,null,-1,'30']) {
    const calls=[], f=fixture({}, {'@/lib/feature-flags':{corporateRolloutEnabled:true},'@/lib/supabase':{supabase:{rpc:async(...args)=>{calls.push(args);return {data:value,error:null};}}}});
    const read=f.load('lib/actions/corporate-accounts.ts').markAllCorporateNoticesRead;
    if(typeof value==='number'&&value>=0)assert.equal(await read(),value);else await assert.rejects(read());
    assert.deepEqual(calls,[['corporate_read_all_notices',{}]]);
  }
});

test('booking activity shows readable changes without exposing raw audit JSON or internal identifiers', () => {
  const f=fixture(), history=f.load('app/corporate/components/CorporateWorkflowShared.tsx').WorkflowHistory;
  const row={id:'audit',action:'Payment confirmed',actor_name:'Administrator',created_at:'2026-10-23T10:00:00Z',reason:'Receipt verified externally.',before_values:{booking:{status:'Pending payment',group_size:12,request_key:'INTERNAL-KEY',account_id:'INTERNAL-ACCOUNT'}},after_values:{status:'Confirmed',group_size:12,request_key:'INTERNAL-KEY',account_id:'INTERNAL-ACCOUNT'}};
  const tree=f.render(history,{rows:[row]});
  assert.match(textContent(tree),/Payment confirmed/);assert.match(textContent(tree),/Pending payment/);assert.match(textContent(tree),/Confirmed/);assert.match(textContent(tree),/Administrator/);
  assert.equal(nodes(tree).filter(n=>n.type==='pre'||n.type==='details').length,0);
  assert.doesNotMatch(textContent(tree),/INTERNAL-|request_key|account_id|before_values|Recorded details/);
  const changes=f.load('lib/corporate-history.ts').corporateHistoryChanges;
  assert.deepEqual(changes({attendance:{attendance_count:12,event_hours:null}},{attendance:{attendance_count:11,event_hours:2}}),[{label:'Actual attendees',before:'12',after:'11'},{label:'Event hours',before:'Not recorded',after:'2'}]);
  assert.deepEqual(changes(null,{status:'Confirmed',secret:'private'}),[]);
  assert.match(textContent(f.render(history,{rows:[]})),/No booking activity recorded/);
});

test('booking detail keeps contacts, payment records and decision controls in distinct sections', () => {
  const f=fixture(), panel=f.load('app/corporate/components/CorporateBookingList.tsx').CorporateBookingPanel;
  const booking={id:'booking',account_id:'company',status:'Pending payment',group_size:12,event:{title:'Group event',starts_at:'2099-11-15T07:00:00Z',ends_at:'2099-11-15T09:00:00Z'},contact_snapshot:{company_name:'Company',contact_email:'company@example.invalid',contact_phone:'+27215551234'}};
  const props={detail:{booking,payments:[],history:[]},admin:true,settings:{booking_enabled:true},dirtyChanged(){},refresh(){},committed:async()=>{}};
  let tree=f.render(panel,props);
  assert.ok(nodes(tree).some(n=>n.props['aria-label']==='Company contact and billing'));
  const actions=nodes(tree).find(n=>n.props['aria-label']==='Booking decisions');
  assert.equal(nodes(actions).filter(n=>n.type==='button').length,3);
  nodes(actions).find(n=>n.props.children==='Record external payment & confirm').props.onClick();tree=f.render(panel,props);
  assert.ok(nodes(tree).some(n=>n.props['aria-label']==='Booking decision form'));
  const form=nodes(tree).find(n=>n.type?.name==='CorporateBookingDecisionForm');assert.equal(form.props.mode,'payment');
  nodes(tree).find(n=>n.props.children==='Close decision form').props.onClick();tree=f.render(panel,props);assert.ok(!nodes(tree).some(n=>n.props['aria-label']==='Booking decision form'));
  const g=fixture(), decision=g.load('app/corporate/components/CorporateBookingList.tsx').CorporateBookingDecisionForm;
  const formTree=g.render(decision,{mode:'payment',booking,dirtyChanged(){},committed(){}});
  const footer=nodes(formTree).find(n=>n.props.className==='formFooter');assert.ok(footer);assert.equal(nodes(footer).find(n=>n.type==='button').props.type,'submit');
});

test('volunteer report display and exports cannot mix legacy corporate attendance or person-hours', async t => {
  browser(t);
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const data={events:[{id:1,title:'Volunteer event',date,location:'Venue',status:'Scheduled'}],slots:[{event_id:1,capacity:30}],bookings:[{id:1,event_id:1,user_id:'person',status:'Completed'}],attendance:[{booking_id:1,clocked_in_at:date+'T07:00:00Z',worked_minutes:120}],corporate:[{id:50,event_id:1,status:'Completed',team_size:15,attendance_count:15,volunteer_hours:999}],companies:[]};
  const f=fixture({}, {'@/lib/actions/corporate':{loadVolunteerReportData:async()=>data}});
  const reports=f.load('app/admin/components/ReportsManager.tsx').default;
  f.render(reports);await f.effects();const tree=f.render(reports);
  const trend=nodes(tree).find(n=>n.type?.name==='ParticipationTrend');assert.deepEqual(trend.props.data.corporate,[]);
  const report=f.load('lib/reporting.ts'), rows=report.selectedReportRows(trend.props.data,{from:'',to:'',event:'',location:''});
  assert.equal(rows[0].attendance,1);assert.equal(rows[0].individualHours,2);
  const csv=report.volunteerReportCsv(rows);assert.match(csv,/Verified volunteer hours/);assert.doesNotMatch(csv,/corporate|999/i);
  assert.doesNotMatch(textContent(tree),/Corporate impact|Recorded corporate hours/);f.unmount();
});

test('session presentation distinguishes all five states and never permits requests for stale sessions', () => {
  const f=fixture(), {sessionPresentation,canRequestCorporateSession}=f.load('lib/corporate-calendar.ts');
  const now=Date.parse('2099-11-01T10:00:00Z'), event={starts_at:'2099-11-05T07:00:00Z',state:'Available',is_published:true,remaining:12,min_group_size:1};
  for(const [patch,state] of [[{},'available'],[{reserved_places:12},'reserved'],[{is_published:false},'unpublished'],[{cancelled_at:'2099-10-01'},'cancelled'],[{starts_at:'2099-10-01T07:00:00Z'},'past']]) {
    const session={...event,...patch};assert.equal(sessionPresentation(session,now).state,state);assert.equal(canRequestCorporateSession(session,now),state==='available');
  }
  assert.equal(sessionPresentation({...event,starts_at:'invalid'},now).state,'past');
  assert.equal(canRequestCorporateSession({...event,remaining:0},now),false);
});

test('amendments allow the company own held session but reject stale or other-company targets', async t => {
  browser(t);window.confirm=()=>true;
  const event={id:'event',version:1,state:'Available',is_published:true,title:'Future session',location:'Venue',starts_at:'2099-11-15T07:00:00Z',ends_at:'2099-11-15T09:00:00Z',min_group_size:1,max_group_size:30,remaining:30};
  const booking={id:'booking',version:1,event_id:'own-event',event,status:'Confirmed',group_size:12};
  let writes=0;
  const f=fixture({}, {'@/lib/actions/corporate-bookings':{emptyWorkflowFilters:{query:'',status:'',from:'',to:''},searchCorporateEvents:async()=>({rows:[event],total:1}),requestCorporateChange:async()=>{writes++;}}});
  const {canProposeCorporateSession}=f.load('lib/corporate-calendar.ts');
  const held={...event,id:'own-event',state:'Reserved',remaining:0,reserved_places:12};
  assert.equal(canProposeCorporateSession(held,booking),true);
  assert.equal(canProposeCorporateSession({...held,id:'another-event'},booking),false);
  for(const patch of [{is_published:false},{cancelled_at:'2026-10-23'},{starts_at:'2000-01-01T07:00:00Z'}]) assert.equal(canProposeCorporateSession({...held,...patch},booking),false);
  const component=f.load('app/corporate/components/CorporateChangeActions.tsx').CorporateChangeRequestForm;
  const props={booking,kind:'Amendment',dirtyChanged(){},committed(){}};
  f.render(component,props);await f.effects();let tree=f.render(component,props);
  nodes(tree).find(n=>n.type==='button'&&/Select\s+Future session/.test(textContent(n))).props.onClick();
  event.starts_at='2000-01-01T07:00:00Z';tree=f.render(component,props);await submit(tree);
  assert.equal(writes,0);assert.match(textContent(f.render(component,props)),/proposed session is past/);
  f.unmount();
});

test('report print styles preserve the admin ancestor chain and reset dark colours without affecting other pages', () => {
  const css=readFileSync(resolve(root,'app/corporate/components/corporate-outcomes.module.css'),'utf8');
  const admin=readFileSync(resolve(root,'app/admin/admin.module.css'),'utf8');
  const component=readFileSync(resolve(root,'app/corporate/components/CorporateOutcomeReports.tsx'),'utf8');
  assert.match(component, /section data-corporate-report/);
  assert.match(admin, /:not\(:has\(\[data-corporate-report\]\)\)/);
  assert.match(css, /body:has\(\[data-corporate-report\]\)/);
  assert.match(css, /color:black!important;background:white!important/);
  assert.match(css, /overflow:visible!important/);
});

test('calendar keyboard movement skips disabled dates and historical bookings remain available through the agenda', async () => {
  const booking={id:'old-booking',status:'Completed',group_size:12,contact_snapshot:{company_name:'Example Co'},event:{title:'Past event',starts_at:'2099-11-01T07:00:00Z',ends_at:'2099-11-01T09:00:00Z'}};
  const opened=[], f=fixture({}, {'@/lib/actions/corporate-bookings':{searchCorporateBookings:async()=>({rows:[booking],total:1})}});
  const component=f.load('app/corporate/components/CorporateCalendar.tsx').default;
  const props={mode:'bookings',admin:false,now:Date.parse('2099-11-10T10:00:00Z'),filters:{query:'',from:'',to:'',status:''},onBooking:id=>opened.push(id)};
  f.render(component,props);await f.effects();let tree=f.render(component,props);
  const day=nodes(tree).find(n=>n.props['data-calendar-date']==='2099-11-01');
  assert.equal(day.props.disabled,false);day.props.onClick();tree=f.render(component,props);
  const pastItem=nodes(tree).find(n=>n.type==='article'&&n.props['data-state']==='past');
  assert.ok(pastItem);nodes(pastItem).find(n=>n.props.children==='Details').props.onClick();assert.deepEqual(opened,['old-booking']);
  let focused='', prevented=0;
  const first={focus(){focused='first';}}, last={focus(){focused='last';}}, target={disabled:false,focus(){focused='2099-11-03';}};
  const table={querySelector:selector=>selector.includes('2099-11-02')?{disabled:true}:selector.includes('2099-11-03')?target:null};
  const row={querySelectorAll:()=>[first,last]};
  const currentTarget={closest:selector=>selector==='table'?table:row};
  const key=value=>day.props.onKeyDown({key:value,currentTarget,preventDefault(){prevented++;}});
  key('ArrowRight');assert.equal(focused,'2099-11-03');key('Home');assert.equal(focused,'first');key('End');assert.equal(focused,'last');assert.equal(prevented,3);
});

test('expired verification links stay on sign-in and resend uses the current origin with duplicate protection', async t => {
  browser(t,'','#error=access_denied&error_code=otp_expired&error_description=private-token');
  const calls=[];let finish;
  const f=fixture({getSession:async()=>{throw new Error('Must not auto-route an invalid link');},resend:args=>{calls.push(args);return new Promise(resolve=>{finish=resolve;});}});
  const component=f.load('app/components/LoginForm.tsx').default;
  f.render(component);await f.effects();let tree=f.render(component);
  assert.match(textContent(tree),/verification link is invalid or has expired/);assert.doesNotMatch(textContent(tree),/private-token/);assert.deepEqual(f.routes,[]);
  input(tree,'auth-email',' test@example.invalid ');tree=f.render(component);
  const resend=nodes(tree).find(n=>n.props.children==='Resend verification email');
  resend.props.onClick();resend.props.onClick();await tick();assert.equal(calls.length,1);
  assert.deepEqual(calls[0],{type:'signup',email:'test@example.invalid',options:{emailRedirectTo:'https://portal.example.invalid/'}});
  finish({error:null});await tick();tree=f.render(component);assert.match(textContent(tree),/new link has been requested/);
  assert.equal(nodes(tree).find(n=>n.props.children==='Verification requested').props.disabled,true);
  input(tree,'auth-email','other@example.invalid');tree=f.render(component);assert.equal(nodes(tree).find(n=>n.props.children==='Resend verification email').props.disabled,false);
});

test('verification resend validates addresses and unlocks after a provider failure', async t => {
  browser(t,'?verification=expired');let calls=0;
  const f=fixture({resend:async()=>{calls++;return {error:new Error('Provider unavailable')};}}), component=f.load('app/components/LoginForm.tsx').default;
  f.render(component);await f.effects();let tree=f.render(component);
  nodes(tree).find(n=>n.props.children==='Resend verification email').props.onClick();await tick();assert.equal(calls,0);
  input(tree,'auth-email','test@example.invalid');tree=f.render(component);
  nodes(tree).find(n=>n.props.children==='Resend verification email').props.onClick();await tick();tree=f.render(component);
  assert.match(textContent(tree),/Provider unavailable/);assert.equal(nodes(tree).find(n=>n.props.children==='Resend verification email').props.disabled,false);
});

test('confirmation focus traps Tab, respects busy Escape and restores its trigger', async t => {
  const before={document:globalThis.document,HTMLElement:globalThis.HTMLElement};
  const doc=new EventTarget();class Control {isConnected=true;getClientRects(){return [1];}focus(){doc.activeElement=this;}}
  const trigger=new Control(), first=new Control(), last=new Control(), panel=new Control();doc.activeElement=trigger;
  panel.querySelectorAll=()=>[first,last];panel.contains=node=>node===first||node===last||node===panel;
  Object.assign(globalThis,{document:doc,HTMLElement:Control});t.after(()=>Object.assign(globalThis,before));
  let cancelled=0;const ref={current:panel}, f=fixture(), hook=f.load('app/components/useDialogFocus.ts').useDialogFocus;
  const render=busy=>f.render(()=>hook(true,ref,()=>{cancelled++;},busy));
  const key=(value,shiftKey=false)=>{const event=new Event('keydown',{cancelable:true});Object.assign(event,{key:value,shiftKey});doc.dispatchEvent(event);return event;};
  render(false);await f.effects();assert.equal(doc.activeElement,first);
  assert.equal(key('Tab',true).defaultPrevented,true);assert.equal(doc.activeElement,last);
  key('Tab');assert.equal(doc.activeElement,first);
  key('Escape');assert.equal(cancelled,1);render(true);await f.effects();key('Escape');assert.equal(cancelled,1);
  f.unmount();assert.equal(doc.activeElement,trigger);key('Escape');assert.equal(cancelled,1);
});

// Minimal EventTargets exercise listener registration/cancellation; they are not visual browser tests.
test('dirty forms share one prompt; links, supported Back/Forward and unload are guarded and cleaned up', t => {
  const prior = { window: globalThis.window, document: globalThis.document, Element: globalThis.Element };
  const navigation = new EventTarget(), document = new EventTarget(), window = new EventTarget();
  let prompts = 0, allow = false;
  Object.assign(window, { navigation, location: new URL('https://portal.example.invalid/corporate/events'), confirm: () => { prompts++; return allow; } });
  class Link { constructor(href, target = '', download = false) { Object.assign(this, { href, target, download }); } closest() { return this; } getAttribute() { return this.href; } hasAttribute() { return this.download; } }
  Object.assign(globalThis, { window, document, Element: Link }); t.after(() => Object.assign(globalThis, prior));
  const f = fixture(), guard = f.load('lib/unsaved-navigation.ts');
  const stopParent = guard.registerUnsavedForm(), stopChild = guard.registerUnsavedForm();
  const click = (link, modifiers = {}) => { const event = new Event('click', { cancelable: true }); Object.defineProperty(event, 'target', { value: link }); Object.assign(event, { button: 0, ...modifiers }); document.dispatchEvent(event); return event; };
  assert.equal(click(new Link('/corporate/bookings')).defaultPrevented, true); assert.equal(prompts, 1);
  for (const link of [new Link('#content'), new Link('mailto:team@example.invalid'), new Link('/report.csv', '', true), new Link('/corporate/bookings', '_blank'), new Link('/corporate/events#content')]) assert.equal(click(link).defaultPrevented, false);
  click(new Link('/corporate/bookings'), { ctrlKey: true }); assert.equal(prompts, 1);
  const traverse = (cancelable, sameDocument = true, hashChange = false) => { const event = new Event('navigate', { cancelable }); Object.assign(event, { navigationType: 'traverse', destination: { sameDocument }, hashChange }); navigation.dispatchEvent(event); return event; };
  assert.equal(traverse(true).defaultPrevented, true); assert.equal(prompts, 2);
  traverse(false); traverse(true, false); traverse(true, true, true); assert.equal(prompts, 2);
  const exit = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(exit); assert.equal(exit.defaultPrevented, true);
  allow = true; assert.equal(traverse(true).defaultPrevented, false);
  stopParent(); assert.equal(guard.confirmUnsavedNavigation(), true); stopChild();
  const count = prompts; assert.equal(click(new Link('/corporate/bookings')).defaultPrevented, false); assert.equal(traverse(true).defaultPrevented, false); assert.equal(prompts, count);
});
