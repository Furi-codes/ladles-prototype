import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function fixture() {
  const state = [];
  let cursor = 0;
  const saved = [];
  const settings = { updated_at: 'version-1', default_location: 'Warehouse', contact_email: 'test@example.invalid', booking_confirmation_enabled: true, booking_cancellation_enabled: false, shift_reminder_enabled: true, corporate_booking_confirmation_enabled: false };
  const corporate = { loadSettings() {}, saveNotificationSettings: async input => { saved.push(input); }, saveAdminName: async () => {} };
  const audit = { loadAdminAuditLog() {}, logAdminAction: async () => {} };
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], next => { state[index] = next; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = { current: initial };
      return state[index];
    },
  };
  const mocks = {
    react,
    '@/lib/actions/corporate': corporate,
    '@/lib/actions/audit': audit,
    './AdminProvider': { useAdminData: () => ({ adminProfile: { full_name: 'Test admin', email: 'admin@example.invalid' } }) },
    './FeatureShared': {
      useFeatureData: loader => ({ data: loader === corporate.loadSettings ? { settings, admins: [] } : [], loading: false, error: '', reload: async () => {} }),
      Field: () => null,
      FeatureState: () => null,
    },
    './AdminAccessManager': { default: () => null },
  };
  const compiledModule = { exports: {} };
  const source = ts.transpileModule(readFileSync(new URL('../app/admin/components/SettingsManager.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, {
    module: compiledModule, exports: compiledModule.exports,
    require: name => name === 'react/jsx-runtime' ? require(name) : mocks[name] ?? { default: new Proxy({}, { get: (_, key) => key }) },
    console,
  });
  return { saved, render: () => { cursor = 0; return compiledModule.exports.default(); } };
}

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree?.props) return [];
  return [tree, ...nodes(tree.props.children)];
}
const panels = tree => nodes(tree).filter(node => node.props.role === 'tabpanel');
const tabs = tree => nodes(tree).filter(node => node.props.role === 'tab');

test('settings tabs default to notifications and preserve its form while switching sections', () => {
  const f = fixture();
  let tree = f.render();
  assert.equal(tabs(tree).length, 4);
  assert.equal(panels(tree).filter(panel => !panel.props.hidden)[0].props.id, 'notification-settings');
  assert.ok(!panels(tree).some(panel => panel.props.id === 'organisation-settings'));
  assert.ok(!nodes(tree).some(node => ['default_location', 'contact_email'].includes(node.props.name)));
  for (let index = 0; index < 4; index++) {
    tabs(tree)[index].props.onClick();
    tree = f.render();
    const visible = panels(tree).filter(panel => !panel.props.hidden);
    assert.equal(visible.length, 1);
    assert.equal(tabs(tree).filter(tab => tab.props['aria-selected']).length, 1);
    assert.equal(tabs(tree)[index].props['aria-controls'], visible[0].props.id);
    assert.equal(visible[0].props['aria-labelledby'], tabs(tree)[index].props.id);
    const form = nodes(tree).find(node => node.type === 'form' && node.key === 'version-1');
    assert.ok(form);
    assert.equal(form.props.hidden, index > 0);
    assert.equal(panels(form).length, 1);
    assert.equal(nodes(form).find(node => node.props.name === 'shift_reminder_enabled').props.defaultChecked, true);
  }
  assert.ok(!nodes(tree).some(node => node.type === 'a' && node.props.href?.endsWith('-settings')));
});

test('settings tabs support arrow keys, Home and End with focus following selection', () => {
  const f = fixture();
  let tree = f.render();
  let focused = null;
  tabs(tree).forEach((tab, index) => tab.props.ref({ focus() { focused = index; } }));
  for (const [key, expected] of [['ArrowLeft', 3], ['Home', 0], ['ArrowRight', 1], ['End', 3], ['ArrowRight', 0]]) {
    let prevented = false;
    const selected = tabs(tree).find(tab => tab.props['aria-selected']);
    selected.props.onKeyDown({ key, preventDefault() { prevented = true; } });
    tree = f.render();
    assert.equal(prevented, true);
    assert.equal(focused, expected);
    assert.equal(tabs(tree)[expected].props.tabIndex, 0);
    assert.ok(tabs(tree).filter((_, index) => index !== expected).every(tab => tab.props.tabIndex === -1));
  }
});

test('saving notification preferences does not submit organisation defaults', async () => {
  const f = fixture();
  const tree = f.render();
  const notifications = panels(tree).find(panel => panel.props.id === 'notification-settings');
  assert.ok(nodes(notifications).some(node => node.type === 'button' && !node.props.disabled));
  const form = nodes(tree).find(node => node.type === 'form' && node.key === 'version-1');
  const data = new FormData();
  data.set('default_location', 'Updated warehouse');
  data.set('contact_email', 'new@example.invalid');
  data.set('booking_confirmation_enabled', 'on');
  data.set('shift_reminder_enabled', 'on');
  await form.props.action(data);
  assert.equal(f.saved.length, 1);
  assert.equal(f.saved[0].default_location, undefined);
  assert.equal(f.saved[0].contact_email, undefined);
  assert.equal(f.saved[0].timezone, undefined);
  assert.equal(f.saved[0].shift_reminder_enabled, true);
  assert.equal(f.saved[0].booking_confirmation_enabled, true);
  assert.equal(f.saved[0].booking_cancellation_enabled, false);
  assert.equal(f.saved[0].corporate_booking_confirmation_enabled, false);
});

test('notification database updates allow only notification columns and report failures', async () => {
  const updates = [];
  const filters = [];
  let error = null;
  const query = {
    update(input) { updates.push(JSON.parse(JSON.stringify(input))); return this; },
    eq(column, value) { filters.push([column, value]); return this; },
    select() { return this; },
    single: async () => ({ error }),
  };
  const supabase = { from(table) { assert.equal(table, 'organisation_settings'); return query; } };
  const compiledModule = { exports: {} };
  const source = ts.transpileModule(readFileSync(new URL('../lib/actions/corporate.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    module: compiledModule, exports: compiledModule.exports,
    require: name => { assert.equal(name, '@/lib/supabase'); return { supabase }; }, console,
  });
  const preferences = { booking_confirmation_enabled: true, booking_cancellation_enabled: false, shift_reminder_enabled: true, corporate_booking_confirmation_enabled: false };
  await compiledModule.exports.saveNotificationSettings({ ...preferences, default_location: 'Ignore', contact_email: 'ignore@example.invalid', timezone: 'UTC' });
  assert.deepEqual(updates, [preferences]);
  assert.deepEqual(filters, [['id', 1]]);
  error = { message: 'Database unavailable' };
  await assert.rejects(compiledModule.exports.saveNotificationSettings(preferences), /Database unavailable/);
});
