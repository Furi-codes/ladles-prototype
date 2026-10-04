import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const pagingUrl = url(compile(readFileSync(new URL('../lib/data-pagination.ts', import.meta.url), 'utf8')));
const { fetchAllPages, fetchRowsByIds } = await import(pagingUrl);

test('shared paging follows actual page lengths and rejects changing/missing counts and page failures', async () => {
  const rows = [1, 2, 3, 4, 5]; const offsets = [];
  const result = await fetchAllPages(async from => { offsets.push(from); return { data: rows.slice(from, from + 2), count: 5, error: null }; });
  assert.deepEqual(result.data, rows); assert.deepEqual(offsets, [0, 2, 4]);
  assert.equal((await fetchAllPages(async () => ({ data: [1], count: null, error: null }))).data, null);
  assert.equal((await fetchAllPages(async () => ({ data: [], count: 5, error: null }))).data, null);
  assert.equal((await fetchAllPages(async from => ({ data: [1], count: from ? 4 : 5, error: null }))).data, null);
  const error = { message: 'Unavailable' };
  assert.equal((await fetchAllPages(async from => from ? { data: null, error, count: null } : { data: [1], count: 2, error: null })).error, error);
  assert.deepEqual((await fetchAllPages(async () => ({ data: [], count: 0, error: null }))).data, []);
});

test('IN batching deduplicates IDs, skips empty scopes and keeps every batch at 100 IDs', async () => {
  const ids = Array.from({ length: 205 }, (_, i) => i); const batches = [];
  const result = await fetchRowsByIds([...ids, 0], async (batch, from) => {
    batches.push(batch); return { data: batch.slice(from, from + 2), count: batch.length, error: null };
  });
  assert.deepEqual(result.data, ids); assert.ok(batches.every(batch => batch.length <= 100));
  assert.deepEqual((await fetchRowsByIds([], () => assert.fail('Unexpected request'))).data, []);
});

test('all six admin loaders paginate with an exact count and unique ordering', async () => {
  const requests = []; const key = '__admin_pages';
  const chain = table => {
    const operations = []; const q = {};
    for (const method of ['select', 'order', 'range']) q[method] = (...args) => { operations.push([method, ...args]); return q; };
    q.then = (resolve, reject) => {
      requests.push({ table, operations });
      const from = operations.find(op => op[0] === 'range')[1];
      return Promise.resolve({ data: [0, 1, 2, 3, 4].slice(from, from + 2).map(id => ({ id, booking_id: id })), count: 5, error: null }).then(resolve, reject);
    };
    return q;
  };
  globalThis[key] = { from: chain, rpc: (name, args, options) => { assert.equal(options.count, 'exact'); return chain(name); } };
  const source = compile(readFileSync(new URL('../lib/actions/admin.ts', import.meta.url), 'utf8'))
    .replace(/import \{ supabase \} from [^;]+;/, `const supabase = globalThis.${key};`)
    .replace(/['"]@\/lib\/data-pagination['"]/, JSON.stringify(pagingUrl));
  try {
    const actions = await import(url(source));
    for (const name of ['fetchAdminEvents', 'fetchAdminBookings', 'fetchAdminEventSlots', 'fetchVolunteers', 'fetchAdminAttendanceCheckpoints', 'fetchAdminAttendanceRecords']) {
      const result = await actions[name](); assert.equal(result.data.length, 5); assert.equal(result.error, null);
    }
    assert.equal(requests.length, 18);
    assert.ok(requests.every(r => r.operations.some(op => op[0] === 'order' && ['id', 'booking_id'].includes(op[1]))));
    assert.ok(requests.filter(r => r.table !== 'get_attendance_records').every(r => r.operations.some(op => op[0] === 'select' && op[2].count === 'exact')));
  } finally { delete globalThis[key]; }
});

async function refreshHarness() {
  const state = []; const batches = []; let cursor = 0; let current; const ref = { current: 0 };
  const makeDeferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
  const key = '__admin_refresh_' + Math.random().toString(36).slice(2);
  const hooks = {
    createContext: () => ({ Provider: 'provider' }), useContext: () => null, useEffect: () => {}, useRef: () => ref,
    useCallback: fn => fn,
    useState: initial => { const index = cursor++; state[index] = initial; return [initial, value => { state[index] = value; }]; },
  };
  const actions = {
    markMissedBookingsNoShow: async () => ({ error: null }),
    fetchAdminEvents: () => { current = makeDeferred(); batches.push(current); return current.promise; },
  };
  for (const name of ['fetchAdminBookings', 'fetchAdminEventSlots', 'fetchVolunteers', 'fetchAdminAttendanceCheckpoints', 'fetchAdminAttendanceRecords']) actions[name] = () => current.promise;
  globalThis[key] = { hooks, actions };
  let source = compile(readFileSync(new URL('../app/admin/components/AdminProvider.tsx', import.meta.url), 'utf8'));
  source = source
    .replace(/import [^;]+ from "react\/jsx-runtime";/, 'const _jsx = (type, props) => props;')
    .replace(/import ([^;]+) from "react";/, `const $1 = globalThis[${JSON.stringify(key)}].hooks;`)
    .replace(/import [^;]+ from "next\/navigation";/, 'const useRouter = () => ({});')
    .replace(/import [^;]+ from "@\/lib\/supabase";/, 'const supabase = {}; const getCurrentUser = () => null;')
    .replace(/import [^;]+ from "@\/lib\/actions\/profile";/, 'const fetchUserRole = () => null;')
    .replace(/import ([^;]+) from "@\/lib\/actions\/admin";/, `const $1 = globalThis[${JSON.stringify(key)}].actions;`);
  try {
    const { AdminProvider } = await import(url(source));
    const { value } = AdminProvider({ children: null });
    return { state, batches, refresh: value.fetchData, cleanup: () => { delete globalThis[key]; } };
  } catch (error) { delete globalThis[key]; throw error; }
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('older refresh success cannot overwrite newer data or clear its loading state', async () => {
  const h = await refreshHarness();
  try {
    const old = h.refresh(); await tick(); const latest = h.refresh(); await tick();
    h.batches[0].resolve({ data: ['old'], error: null }); await old;
    assert.deepEqual(h.state[0], []); assert.equal(h.state[7], true);
    h.batches[1].resolve({ data: ['new'], error: null }); await latest;
    assert.deepEqual(h.state[0], ['new']); assert.equal(h.state[7], false);
  } finally { h.cleanup(); }
});

test('older refresh failure cannot replace the latest successful state with an error', async () => {
  const h = await refreshHarness();
  try {
    const old = h.refresh(); await tick(); const latest = h.refresh(); await tick();
    h.batches[1].resolve({ data: ['new'], error: null }); await latest;
    h.batches[0].resolve({ data: null, error: { message: 'Old error' } }); await old;
    assert.deepEqual(h.state[0], ['new']); assert.equal(h.state[9], null); assert.equal(h.state[7], false);
  } finally { h.cleanup(); }
});
