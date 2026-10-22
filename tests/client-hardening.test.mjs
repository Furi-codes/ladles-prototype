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
      if (name === 'next/navigation') return { useRouter: () => router, useSearchParams: () => new URLSearchParams(globalThis.window?.location.search || '') };
      if (name === '@/lib/supabase') return { supabase: { auth, from() { throw new Error('Unexpected profile query'); } } };
      if (name === '@/lib/feature-flags') return { corporateRolloutEnabled: false };
      if (name === '@/lib/actions/account-routing') return { accountLandingPath: async () => '/volunteer', workspaceChoicePath: '/?workspace=choose' };
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
  globalThis.window = { location: { search, hash, origin: 'https://portal.example.invalid' } };
  t.after(() => { globalThis.window = previous; });
}
function input(tree, id, value) { nodes(tree).find(node => node.props.id === id).props.onChange({ target: { value } }); }
const submit = tree => nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });

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

test('password and existing-session sign-in offer a workspace choice only after account routing returns both memberships', async t => {
  browser(t);
  for (const existing of [false, true]) {
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
        from: () => ({ select(columns) { assert.match(columns, /volunteer_enabled/); return this; }, eq() { return this; }, single: async () => ({ data: { role: 'volunteer', volunteer_enabled: true }, error: null }) }),
      } },
      '@/lib/actions/account-routing': { workspaceChoicePath: '/?workspace=choose', accountLandingPath: async (...args) => { calls.push(args); return '/?workspace=choose'; } },
    });
    const component = f.load('app/components/LoginForm.tsx').default;
    let tree = f.render(component); await f.effects();
    if (!existing) await submit(f.render(component));
    tree = f.render(component);
    assert.match(textContent(tree), /Choose your workspace/); assert.deepEqual(calls, [['volunteer', false, true]]); assert.deepEqual(f.routes, []);
    const choice = nodes(tree).find(node => node.type?.name === 'WorkspaceChoice');
    const choiceFixture = fixture(), choiceComponent = choiceFixture.load('app/components/LoginForm.tsx').WorkspaceChoice;
    const choiceTree = choiceFixture.render(choiceComponent, choice.props);
    for (const label of ['Volunteer workspace', 'Business workspace']) assert.ok(nodes(choiceTree).some(node => node.type === 'strong' && node.props.children === label));
    nodes(choiceTree).find(node => node.type === 'button' && textContent(node).includes('Volunteer workspace')).props.onClick();
    assert.deepEqual(f.routes, ['/volunteer']);
  }
});

test('Google sign-in returns to the shared entry flow rather than directly to the volunteer portal', async t => {
  browser(t); const requests = [];
  const f = fixture({ signInWithOAuth: async input => { requests.push(input); return { error: null }; } });
  const component = f.load('app/components/LoginForm.tsx').default;
  await nodes(f.render(component)).find(node => node.type === 'button' && textContent(node).includes('Continue with Google')).props.onClick();
  assert.deepEqual(requests, [{ provider: 'google', options: { redirectTo: 'https://portal.example.invalid/' } }]);
});

test('business registration reuses an authenticated volunteer login without requesting another password or signup', async t => {
  browser(t); const registrations = [], user = { id: 'volunteer', email: 'member@example.invalid', user_metadata: { full_name: 'Main Contact' } };
  const f = fixture({ getUser: async () => ({ data: { user }, error: null }), signUp: async () => assert.fail('Must not create a second Auth user') }, {
    '@/lib/actions/corporate-accounts': { getMyCorporateAccount: async () => null, cleanCorporateAccount: value => value, registerCorporateAccount: async details => registrations.push(details) },
  });
  const component = f.load('app/components/BusinessRegistration.tsx').default, props = { onSignIn() {}, onDirtyChange() {}, onBusyChange() {} };
  f.render(component, props); await f.effects(); const tree = f.render(component, props);
  const form = nodes(tree).find(node => node.type?.name === 'CorporateAccountForm');
  assert.equal(form.props.appearance, 'auth'); assert.equal(form.props.children, null); assert.equal(form.props.initial.contact_email, user.email);
  await form.props.submit({ company_name: 'Example company' }, '');
  assert.deepEqual(registrations, [{ company_name: 'Example company' }]); assert.deepEqual(f.routes, ['/corporate']);
});

test('new business registrations preserve verification, registration gates and corporate-only metadata in the shared layout', async t => {
  browser(t); const calls = [], details = { company_name: 'Example company', contact_name: 'Main Contact', contact_email: 'new@example.invalid', contact_phone: '+27215551234', billing_address: 'Example address' };
  let open = false;
  const f = fixture({ getUser: async () => ({ data: { user: null }, error: Object.assign(new Error('No session'), { name: 'AuthSessionMissingError' }) }), signUp: async payload => { calls.push(payload); return { data: { user: {} }, error: null }; } }, {
    '@/lib/actions/corporate-accounts': { cleanCorporateAccount: value => value, requireCorporateRegistrationOpen: async () => { if (!open) throw new Error('Business registration is not open yet.'); } },
  });
  const component = f.load('app/components/BusinessRegistration.tsx').default, props = { onSignIn() {}, onDirtyChange() {}, onBusyChange() {} };
  f.render(component, props); await f.effects();
  const form = nodes(f.render(component, props)).find(node => node.type?.name === 'CorporateAccountForm');
  await assert.rejects(form.props.submit(details, 'password-123'), /not open yet/); assert.equal(calls.length, 0);
  await assert.rejects(form.props.submit(details, 'short'), /eight/); assert.equal(calls.length, 0);
  open = true; await form.props.submit(details, 'password-123');
  assert.deepEqual(calls, [{ email: details.contact_email, password: 'password-123', options: { emailRedirectTo: 'https://portal.example.invalid/corporate', data: { full_name: details.contact_name, phone: details.contact_phone, registration_kind: 'corporate', corporate_details: details } } }]);
  assert.match(textContent(f.render(component, props)), /If this address can be registered/); assert.match(textContent(f.render(component, props)), /does not upgrade an existing account/);
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

test('existing business contacts signing in from registration resume the business flow without another login screen', async t => {
  browser(t); const routing = [];
  const auth = { signInWithPassword: async () => ({ data: { user: { id: 'volunteer' } }, error: null }) };
  const f = fixture(auth, {
    '@/lib/feature-flags': { corporateRolloutEnabled: true },
    '@/lib/supabase': { supabase: { auth, from: () => ({ select() { return this; }, eq() { return this; }, single: async () => ({ data: { role: 'volunteer', volunteer_enabled: true }, error: null }) }) } },
    '@/lib/actions/account-routing': { workspaceChoicePath: '/?workspace=choose', accountLandingPath: async (...args) => { routing.push(args); return '/corporate/register'; } },
  });
  const component = f.load('app/components/LoginForm.tsx').default;
  let tree = f.render(component, { initialMode: 'business' });
  nodes(tree).find(node => node.type?.name === 'BusinessRegistration').props.onSignIn('member@example.invalid');
  tree = f.render(component, { initialMode: 'business' });
  assert.equal(nodes(tree).find(node => node.props.id === 'auth-email').props.value, 'member@example.invalid');
  await submit(tree); assert.deepEqual(routing, [['volunteer', true, true]]); assert.deepEqual(f.routes, ['/corporate/register']);
});

test('workspace choice hides the previous email and choices after a cross-tab account change', async () => {
  let callback;
  const f = fixture({ onAuthStateChange: listener => { callback = listener; return { data: { subscription: { unsubscribe() {} } } }; } });
  const component = f.load('app/components/LoginForm.tsx').WorkspaceChoice;
  const props = { email: 'private@example.invalid', openDestination() {}, signOut: async () => {}, signingOut: false, error: '', returnToSignIn() {} };
  f.render(component, props); await f.effects(); callback('INITIAL_SESSION', { user: { id: 'first' } }); callback('SIGNED_OUT', null);
  const tree = f.render(component, props);
  assert.match(textContent(tree), /session has changed/); assert.doesNotMatch(textContent(tree), /private@example.invalid|Volunteer workspace|Business workspace/);
});

test('successful entry-screen sign-out clears its local chooser only after Auth succeeds', async t => {
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

test('password mismatch sends no write; repeated clicks send one write and saved passwords cannot resubmit', async t => {
  browser(t); let finish, calls = 0;
  const f = fixture({ getUser: async () => ({ data: { user: { id: 'user' } }, error: null }), updateUser: () => { calls++; return new Promise(resolve => { finish = resolve; }); } });
  const component = f.load('app/components/ResetPasswordForm.tsx').default;
  f.render(component); await f.effects(); let tree = f.render(component);
  input(tree, 'reset-password', 'example-password'); input(tree, 'reset-confirmation', 'different');
  await submit(f.render(component)); assert.equal(calls, 0);
  tree = f.render(component); assert.match(JSON.stringify(tree), /do not match/); input(tree, 'reset-confirmation', 'example-password');
  tree = f.render(component); const first = submit(tree); await submit(tree); assert.equal(calls, 1);
  finish({ data: { user: { id: 'user' } }, error: null }); await first; await submit(tree); assert.equal(calls, 1);
  tree = f.render(component); assert.match(JSON.stringify(tree), /password has been updated/); assert.equal(nodes(tree).some(node => node.type === 'input'), false);
});

test('failed password writes keep the form usable for retry', async t => {
  browser(t); let calls = 0;
  const f = fixture({ getUser: async () => ({ data: { user: { id: 'user' } }, error: null }), updateUser: async () => { calls++; if (calls === 1) throw new Error('Connection lost'); return { data: { user: { id: 'user' } }, error: null }; } });
  const component = f.load('app/components/ResetPasswordForm.tsx').default;
  f.render(component); await f.effects(); let tree = f.render(component);
  input(tree, 'reset-password', 'example-password'); input(tree, 'reset-confirmation', 'example-password');
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

test('corporate workspace auth network errors show Retry instead of redirecting to sign-in', async t => {
  browser(t);
  const f = fixture({ getUser: async () => ({ data: { user: null }, error: new Error('Auth connection unavailable') }) }, { '@/lib/feature-flags': { corporateRolloutEnabled: true, corporateBookingsEnabled: true } });
  const portal = f.load('app/corporate/components/CorporateWorkflowPortal.tsx').default;
  const boundary = f.render(portal, { mode: 'bookings' });
  const route = nodes(boundary).find(node => typeof node.type === 'function');
  const workspace = f.render(route.type, route.props);
  f.render(workspace.type, workspace.props); await f.effects();
  const tree = f.render(workspace.type, workspace.props);
  assert.match(JSON.stringify(tree), /Auth connection unavailable/); assert.match(JSON.stringify(tree), /Retry/); assert.deepEqual(f.routes, []);
});

// These checks exercise actual handlers and component state, not a copied preview implementation.
test('corporate booking links replace the selected record on query-only navigation and surface access errors', async t => {
  browser(t, '?booking=first');
  const lookups = [], account = { id: 'company', status: 'Approved' };
  const f = fixture({ getUser: async () => ({ data: { user: { id: 'contact', email_confirmed_at: '2026-10-22' } }, error: null }) }, {
    '@/lib/feature-flags': { corporateBookingsEnabled: true },
    '@/lib/actions/corporate-accounts': { getMyCorporateAccount: async () => account },
    '@/lib/actions/corporate-bookings': {
      getCorporateBookingSettings: async () => ({ booking_schema_version: 1 }),
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
  assert.notEqual(first.key, second.key, 'React must remount the workspace for a different booking');
  f.render(second.type, second.props); await f.effects();
  assert.match(JSON.stringify(f.render(second.type, second.props)), /"initialDetail":\{"booking":\{"id":"second"/);
  window.location.search = '?booking=not-owned';
  const denied = f.render(route.type, route.props);
  f.render(denied.type, denied.props); await f.effects();
  const tree = f.render(denied.type, denied.props);
  assert.match(JSON.stringify(tree), /Booking not available to this company/);
  assert.doesNotMatch(JSON.stringify(tree), /"initialDetail"/);
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
  await nodes(tree).find(node => node.type === 'button').props.onClick();
  assert.deepEqual(actions, ['open:booking-1']); assert.match(textContent(f.render(component, props)), /no longer accessible/);
  allowed = true; tree = f.render(component, props);
  await nodes(tree).find(node => node.type === 'button').props.onClick();
  assert.deepEqual(actions, ['open:booking-1', 'open:booking-1', 'read:notice-1', 'reload']);
});

test('corporate requests and payment forms block double clicks and reuse their key after a lost response', async t => {
  browser(t); window.confirm = () => true;
  const event = { id: 'event', version: 2, title: 'Group session', starts_at: '2099-11-15T09:15:00+02:00', ends_at: '2099-11-15T10:15:00+02:00', location: 'Venue', min_group_size: 2, max_group_size: 10, remaining: 10 };
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
