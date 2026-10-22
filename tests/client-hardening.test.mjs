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

// Run actual component handlers with fake Auth and hooks. These tests never send email or change a password.
function fixture(auth = {}, extra = {}) {
  const state = [], effects = [], cache = new Map(), routes = [];
  let cursor = 0;
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; },
    useRef(initial) { const i = cursor++; if (!(i in state)) state[i] = { current: initial }; return state[i]; },
    useCallback(callback) { return callback; },
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
      if (name === 'next/navigation') return { useRouter: () => router };
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
  const workspace = f.render(portal, { mode: 'bookings' });
  f.render(workspace.type, workspace.props); await f.effects();
  const tree = f.render(workspace.type, workspace.props);
  assert.match(JSON.stringify(tree), /Auth connection unavailable/); assert.match(JSON.stringify(tree), /Retry/); assert.deepEqual(f.routes, []);
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
