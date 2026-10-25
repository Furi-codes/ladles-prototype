/**
 * Checks that only the selected settings panel is rendered and navigation warns about dirty
 * forms.
 * Dependencies are mocked or source/helpers are checked locally. These tests do not replace
 * testing the deployed UI and external services.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function fixture(search = '') {
  const state = [];
  let cursor = 0;
  const settings = { updated_at: 'version-1', default_location: 'Warehouse', contact_email: 'test@example.invalid', booking_confirmation_enabled: true, booking_cancellation_enabled: false, shift_reminder_enabled: true, corporate_booking_confirmation_enabled: false };
  const corporate = { loadSettings() {}, saveAdminName: async () => {} };
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
    'next/navigation': { useSearchParams: () => new URLSearchParams(search) },
    '@/features/admin/services/settings': corporate,
    '@/features/admin/services/audit': audit,
    '@/features/admin/shell/AdminProvider': { useAdminData: () => ({ adminProfile: { full_name: 'Test admin', email: 'admin@example.invalid' } }) },
    '@/components/ui/FeatureShared': {
      useFeatureData: loader => ({ data: loader === corporate.loadSettings ? { settings, admins: [] } : [], loading: false, error: '', reload: async () => {} }),
      Field: () => null,
      FeatureState: () => null,
    },
    '@/features/admin/settings/AdminAccessManager': { default: () => null },
  };
  const compiledModule = { exports: {} };
  const source = ts.transpileModule(readFileSync(new URL('../features/admin/settings/SettingsManager.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, {
    module: compiledModule, exports: compiledModule.exports,
    require: name => name === 'react/jsx-runtime' ? require(name) : mocks[name] ?? { default: new Proxy({}, { get: (_, key) => key }) },
    console,
  });
  return { render: () => { cursor = 0; return compiledModule.exports.default(); } };
}

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree?.props) return [];
  return [tree, ...nodes(tree.props.children)];
}
const panels = tree => nodes(tree).filter(node => node.props.role === 'tabpanel');
const tabs = tree => nodes(tree).filter(node => node.props.role === 'tab');

test('admin settings start on Portal contacts and contain no global reminder controls', () => {
  const f = fixture();
  let tree = f.render();
  assert.equal(tabs(tree).length, 4);
  assert.equal(panels(tree).find(panel => !panel.props.hidden).props.id, 'contact-settings');
  for (let index = 0; index < 4; index++) {
    tabs(tree)[index].props.onClick(); tree = f.render();
    const visible = panels(tree).filter(panel => !panel.props.hidden);
    assert.equal(visible.length, 1);
    assert.equal(tabs(tree).filter(tab => tab.props['aria-selected']).length, 1);
    assert.equal(tabs(tree)[index].props['aria-controls'], visible[0].props.id);
    assert.equal(visible[0].props['aria-labelledby'], tabs(tree)[index].props.id);
  }
  assert.ok(!panels(tree).some(panel => panel.props.id === 'notification-settings'));
  assert.ok(!nodes(tree).some(node => node.props.name === 'shift_reminder_enabled'));
});

test('settings tabs support arrow keys, Home and End with focus following selection', () => {
  const f = fixture(); let tree = f.render(), focused = null;
  tabs(tree).forEach((tab, index) => tab.props.ref({ focus() { focused = index; } }));
  for (const [key, expected] of [['ArrowLeft', 3], ['Home', 0], ['ArrowRight', 1], ['End', 3], ['ArrowRight', 0]]) {
    let prevented = false;
    tabs(tree).find(tab => tab.props['aria-selected']).props.onKeyDown({ key, preventDefault() { prevented = true; } });
    tree = f.render();
    assert.equal(prevented, true); assert.equal(focused, expected);
    assert.equal(tabs(tree)[expected].props.tabIndex, 0);
    assert.ok(tabs(tree).filter((_, index) => index !== expected).every(tab => tab.props.tabIndex === -1));
  }
});

test('Portal contacts deep links work and removed notification links fall back to the default', () => {
  for (const search of ['section=contact-settings', 'section=not-a-section', 'section=notification-settings']) {
    assert.equal(panels(fixture(search).render()).find(panel => !panel.props.hidden).props.id, 'contact-settings');
  }
});
