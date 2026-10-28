/**
 * Checks readable history details, safe errors and the absence of raw diagnostic dumps in UI
 * code.
 * Dependencies are mocked or source/helpers are checked locally. These tests do not replace
 * testing the deployed UI and external services.
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url)), require = createRequire(import.meta.url);
function load(file) {
  const full = resolve(root, file), compiledModule = { exports: {} };
  const js = ts.transpileModule(readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const dependency = name => name.endsWith('.css') ? { default: new Proxy({}, { get: (_, key) => String(key) }) }
    : name.startsWith('@/') ? load(name.slice(2) + '.ts')
      : name.startsWith('.') ? load(resolve(dirname(full), name + '.ts')) : require(name);
  vm.runInThisContext(`(function(require,module,exports){${js}\n})`, { filename: full })(dependency, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const { userFacingError } = load('business/shared/errors/user-facing.ts');
const { activityDetails, activityAction } = load('business/admin/utils/activity.ts');

test('technical errors never become user messages, while business validation remains useful', () => {
  const fallback = 'Your booking could not be saved. Please try again.';
  for (const message of [
    'permission denied for table corporate_bookings', 'column profiles.phone does not exist',
    'operator does not exist: uuid = text', 'relation "public.notifications" does not exist',
    'duplicate key value violates unique constraint "booking_key"',
    'Could not find the function public.foo in the schema cache',
    'SQLSTATE 22023: SELECT * FROM auth.users', 'Error: {"code":"42P01","details":"query"}',
    'SELECT 1;', 'ON CONFLICT DO UPDATE command cannot affect row a second time',
    'The DBA must apply a migration and refresh the API schema cache.',
    'Failure\n    at query (app.ts:14:9)', 'Invalid request https://project.supabase.co/rest/v1/secret',
  ]) assert.equal(userFacingError(new Error(message), fallback), fallback, message);
  for (const message of ['This session is full. Choose another date.', 'Please verify your email before signing in.', 'Use a password between 8 and 128 characters.', 'This record changed. Refresh and try again.']) assert.equal(userFacingError(new Error(message), fallback), message);
  assert.equal(userFacingError(null), ''); assert.equal(userFacingError(''), '');
});

test('activity details show readable dates, capacity changes and ranges without internal fields or raw payloads', () => {
  const details = {
    date: '2026-10-12', category: 'Dignity Kitchen', location: 'Dignity Kitchen', slot_count: 1, metadata_saved: true,
    capacity_before: 5, capacity_after: 6, rows: 0,
    external_event_id: 'hidden-event-id', request_key: 'secret-request-key', sql: 'SELECT * FROM profiles',
    before: { table: 'internal' }, unknown: 'Not for the UI',
    timeslots: [{ external_timeslot_id: 'hidden-slot-id', start_time: '09:15:00', end_time: '10:15:00', capacity: 6 }],
  };
  const rows = activityDetails(details);
  assert.deepEqual(rows.find(row => row.label === 'Bookable ranges'), { label: 'Bookable ranges', value: '1' });
  assert.equal(rows.find(row => row.label === 'Event date').value, '12 Oct 2026');
  assert.equal(rows.find(row => row.label === 'Previous capacity').value, '5');
  assert.equal(rows.find(row => row.label === 'New capacity').value, '6');
  assert.equal(rows.find(row => row.label === 'Rows exported').value, '0');
  assert.equal(rows.find(row => row.label === 'Bookable range 1').value, '09:15–10:15 · 6 places');
  const Component = load('presentation/admin/settings/ActivityDetails.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Component, { details }));
  assert.match(html, /View details|<dt>Location<\/dt>/); assert.doesNotMatch(html, /<pre|metadata_saved|request_key|SELECT|hidden-event|hidden-slot|Not for the UI/);
  assert.equal(activityAction('WMS_CAPACITY_UPDATED'), 'Capacity updated by WMS');
  assert.equal(activityAction('SELECT * FROM private'), 'Action recorded');
  assert.equal(renderToStaticMarkup(React.createElement(Component, { details: { metadata_saved: true, request_key: 'private' } })), '');
  assert.deepEqual(activityDetails({ location: 'SELECT * FROM auth.users', capacity: { query: 'secret' } }), []);
});

test('approved volunteer hours have readable audit details instead of a raw snapshot', () => {
  assert.equal(activityAction('VOLUNTEER_HOURS_APPROVED'),'Volunteer hours approved');
  const rows=activityDetails({previous_worked_minutes:30,worked_minutes:60,approval_reason:'Verified volunteer email',clock_in:'2020-01-02T07:15:00Z',clock_out:'2020-01-02T08:15:00Z'});
  assert.ok(rows.some(row=>row.label==='Previously recorded minutes'&&row.value==='30'));
  assert.ok(rows.some(row=>row.label==='Approved minutes'&&row.value==='60'));
  assert.ok(rows.some(row=>row.label==='Reason'&&row.value==='Verified volunteer email'));
});

test('production pages have no raw code dumps or JSON serialization used directly as visible JSX', () => {
  const files = [];
  function visitDirectory(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = resolve(directory, entry.name);
      if (entry.isDirectory()) visitDirectory(file); else if (file.endsWith('.tsx')) files.push(file);
    }
  }
  for (const directory of ['app','presentation']) visitDirectory(resolve(root, directory));
  for (const file of files) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) assert.ok(!['pre', 'code'].includes(node.tagName.getText(source)), file + ' must use readable fields instead of a raw code block');
      if (ts.isJsxExpression(node) && node.expression && ts.isCallExpression(node.expression) && node.expression.expression.getText(source) === 'JSON.stringify') {
        assert.ok(ts.isJsxAttribute(node.parent) && node.parent.name.getText(source) === 'key', file + ' must not display JSON payloads');
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
});
