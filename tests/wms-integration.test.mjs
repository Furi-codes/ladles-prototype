import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const paginationUrl = moduleUrl(compile(readFileSync(new URL('../lib/data-pagination.ts', import.meta.url), 'utf8')));
const timeOptions = await import(moduleUrl(compile(readFileSync(new URL('../lib/event-time-options.ts', import.meta.url), 'utf8'))));

async function fixture({ stale = false, reservations = 0, found = true, corporate = [], bookings = [], profiles = [], pageLimit = 500, missingCount = false, auditFailure = '', rpcError = false } = {}) {
  const key = '__wms_test_' + Math.random().toString(36).slice(2);
  const calls = [];
  const state = { capacity: 5 };
  const db = {
    from(table) {
      const operations = [];
      const q = {};
      for (const method of ['select', 'eq', 'neq', 'in', 'not', 'order', 'range']) q[method] = (...args) => { operations.push([method, ...args]); return q; };
      q.update = value => { operations.push(['update', value]); return q; };
      q.insert = value => { operations.push(['insert', value]); return q; };
      q.maybeSingle = async () => { calls.push({ table, operations }); return { data: found ? { id: 15, capacity: state.capacity, event_id: 15 } : null, error: null }; };
      q.single = async () => {
        calls.push({ table, operations });
        if (!stale) state.capacity = operations.find(op => op[0] === 'update')[1].capacity;
        return { data: { id: 15, capacity: state.capacity }, error: null };
      };
      q.then = (resolve, reject) => {
        calls.push({ table, operations });
        if (table === 'admin_audit_log') {
          if (auditFailure === 'throw') return Promise.reject(new Error('Audit connection unavailable')).then(resolve, reject);
          return Promise.resolve({ data: null, error: auditFailure ? { message: 'Audit service unavailable' } : null }).then(resolve, reject);
        }
        if (table === 'profiles') {
          const columns = operations.find(op => op[0] === 'select')?.[1].split(',').map(column => column.trim()) ?? [];
          const allowed = new Set(['id', 'full_name', 'email', 'role', 'date_of_birth', 'avatar_path']);
          const missing = columns.find(column => !allowed.has(column));
          if (missing) return Promise.resolve({ data: null, count: null, error: { code: '42703', message: `column profiles.${missing} does not exist` } }).then(resolve, reject);
        }
        let rows = table === 'event_slots' ? [{ id: 15, event_id: 15, external_timeslot_id: 'slot', capacity: state.capacity }] : table === 'corporate_bookings' ? corporate : table === 'bookings' ? bookings : table === 'profiles' ? profiles : [];
        for (const [method, column, value] of operations) {
          if (method === 'eq') rows = rows.filter(row => row[column] === value);
          if (method === 'neq') rows = rows.filter(row => row[column] !== value);
          if (method === 'in') rows = rows.filter(row => value.includes(row[column]));
        }
        const head = operations.some(op => op[0] === 'select' && op[2]?.head);
        const count = head ? reservations : rows.length;
        const range = operations.find(op => op[0] === 'range');
        if (range) rows = rows.slice(range[1], Math.min(range[2] + 1, range[1] + pageLimit));
        return Promise.resolve({ data: rows, count: missingCount && range ? null : count, error: null }).then(resolve, reject);
      };
      return q;
    },
    rpc(name, args) {
      calls.push({ rpc: name, args });
      return { single: async () => rpcError ? { data: null, error: { code: '23514', message: 'Mutation rejected' } } : { data: name === 'upsert_wms_event' ? { id: 43 } : { booking_id: args.p_booking_id, attendance_status: args.p_attendance_status, recorded_at: args.p_recorded_at }, error: null } };
    },
  };
  globalThis[key] = db;
  process.env.WMS_INTEGRATION_TOKEN = 'test-only-token';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.invalid';
  process.env.SUPABASE_SECRET_KEY = 'test-only-key';
  const helper = compile(readFileSync(new URL('../lib/server/wms-integration.ts', import.meta.url), 'utf8'))
    .replace('import "server-only";', '')
    .replace(/import \{ createClient \} from "@supabase\/supabase-js";/, `const createClient = () => globalThis[${JSON.stringify(key)}];`);
  const helperUrl = moduleUrl(helper);
  const helpers = await import(helperUrl);
  const route = async path => import(moduleUrl(compile(readFileSync(new URL(`../app/api/integrations/wms/v1/${path}/route.ts`, import.meta.url), 'utf8')).replace('"@/lib/server/wms-integration"', JSON.stringify(helperUrl)).replace('"@/lib/data-pagination"', JSON.stringify(paginationUrl))));
  return { calls, helpers, route, cleanup: () => { delete globalThis[key]; } };
}
const request = (method, body, token = 'test-only-token') => new Request('https://example.invalid', { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const slotContext = { params: Promise.resolve({ externalTimeslotId: 'slot' }) };
const payload = { externalEventId: 'event', title: 'Quarter-hour test', eventDate: '2026-11-15', locationName: 'Test', status: 'Scheduled', category: 'warehouse', timeslots: [{ externalTimeslotId: 'slot', startTime: '09:15', endTime: '10:15', capacity: 5 }] };

test('event choices include every quarter hour without removing existing half-hour times', () => {
  const options = timeOptions.EVENT_TIME_OPTIONS;
  assert.equal(options.length, 65);
  assert.equal(options[0], '06:00'); assert.equal(options.at(-1), '22:00');
  for (const time of ['09:00', '09:15', '09:30', '09:45', '10:15']) assert.ok(options.includes(time));
  assert.equal(new Set(options).size, options.length);
});

test('WMS publishing preserves :15/:45 times exactly and rejects invalid ranges and duplicate IDs', async () => {
  const f = await fixture();
  try {
    const route = await f.route('events/[externalEventId]');
    const response = await route.PUT(request('PUT', payload), { params: Promise.resolve({ externalEventId: 'event' }) });
    assert.equal(response.status, 200);
    assert.deepEqual(f.calls[0].args.p_timeslots, [{ external_timeslot_id: 'slot', start_time: '09:15', end_time: '10:15', capacity: 5 }]);
    assert.equal(f.helpers.parseWmsEventPayload({ ...payload, timeslots: [{ ...payload.timeslots[0], startTime: '09:45', endTime: '10:45' }] }, 'event').timeslots[0].startTime, '09:45');
    for (const timeslots of [[{ ...payload.timeslots[0], endTime: '09:00' }], [{ ...payload.timeslots[0], startTime: '24:15' }], [payload.timeslots[0], payload.timeslots[0]]]) assert.equal(typeof f.helpers.parseWmsEventPayload({ ...payload, timeslots }, 'event'), 'string');
  } finally { f.cleanup(); }
});

test('capacity PATCH persists 6 and bookings GET reads the same value', async () => {
  const f = await fixture();
  try {
    const patch = await f.route('timeslots/[externalTimeslotId]/capacity');
    const response = await patch.PATCH(request('PATCH', { capacity: 6 }), slotContext);
    assert.equal(response.status, 200); assert.equal((await response.json()).capacity, 6);
    const get = await f.route('events/[externalEventId]/bookings');
    const data = await (await get.GET(request('GET'), { params: Promise.resolve({ externalEventId: 'event' }) })).json();
    assert.equal(data.capacityTotal, 6); assert.equal(data.timeslots[0].capacity, 6);
    assert.ok(f.calls.some(call => call.operations?.some(op => op[0] === 'eq' && op[1] === 'external_timeslot_id' && op[2] === 'slot')));
  } finally { f.cleanup(); }
});

test('capacity PATCH refuses false success when a database returns the unchanged old value', async () => {
  const f = await fixture({ stale: true });
  try { const route = await f.route('timeslots/[externalTimeslotId]/capacity'); assert.equal((await route.PATCH(request('PATCH', { capacity: 6 }), slotContext)).status, 500); }
  finally { f.cleanup(); }
});

test('capacity validation/auth/reservation protection reject requests before writing', async () => {
  const f = await fixture({ reservations: 7 });
  try {
    const route = await f.route('timeslots/[externalTimeslotId]/capacity');
    assert.equal((await route.PATCH(request('PATCH', { capacity: 6 }, 'wrong'), slotContext)).status, 401);
    assert.equal((await route.PATCH(request('PATCH', { capacity: 0 }), slotContext)).status, 422);
    assert.equal((await route.PATCH(request('PATCH', { capacity: 6 }), slotContext)).status, 409);
    assert.ok(!f.calls.some(call => call.operations?.some(op => op[0] === 'update')));
  } finally { f.cleanup(); }
});

test('attendance route forwards the booking outcome and exact timestamp without manufacturing hours', async () => {
  const f = await fixture();
  try {
    const route = await f.route('attendance');
    const body = { vmsBookingId: 99, attendanceStatus: 'attended', source: 'wms', recordedAt: '2026-11-15T10:15:00+02:00' };
    assert.equal((await route.POST(request('POST', { ...body, source: 'portal' }))).status, 422);
    const response = await route.POST(request('POST', body));
    assert.equal(response.status, 200);
    assert.deepEqual(f.calls[0], { rpc: 'record_wms_attendance_outcome', args: { p_booking_id: 99, p_attendance_status: 'attended', p_source: 'wms', p_recorded_at: body.recordedAt } });
    assert.ok(!f.calls.some(call => call.table === 'attendance_records'));
  } finally { f.cleanup(); }
});

test('bookings availability includes completed, pending and confirmed corporate groups but excludes cancelled groups', async () => {
  const f = await fixture({ corporate: [
    { event_slot_id: 15, team_size: 2, status: 'Completed' },
    { event_slot_id: 15, team_size: 1, status: 'Pending' },
    { event_slot_id: 15, team_size: 1, status: 'Confirmed' },
    { event_slot_id: 15, team_size: 99, status: 'Cancelled' },
    { event_slot_id: 16, team_size: 99, status: 'Completed' },
  ] });
  try {
    const route = await f.route('events/[externalEventId]/bookings');
    const response = await route.GET(request('GET'), { params: Promise.resolve({ externalEventId: 'event' }) });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.timeslots[0].remaining, 1);
    const patch = await f.route('timeslots/[externalTimeslotId]/capacity');
    assert.equal((await patch.PATCH(request('PATCH', { capacity: 4 }), slotContext)).status, 200);
    assert.equal((await patch.PATCH(request('PATCH', { capacity: 3 }), slotContext)).status, 409);
  } finally { f.cleanup(); }
});

test('completed corporate groups prevent capacity reductions before any write', async () => {
  const f = await fixture({ corporate: [{ event_slot_id: 15, team_size: 7, status: 'Completed' }] });
  try {
    const route = await f.route('timeslots/[externalTimeslotId]/capacity');
    assert.equal((await route.PATCH(request('PATCH', { capacity: 6 }), slotContext)).status, 409);
    assert.ok(!f.calls.some(call => call.operations?.some(op => op[0] === 'update')));
  } finally { f.cleanup(); }
});

test('rendered dashboard uses current slot capacity, never the stale event summary', async () => {
  const require = createRequire(import.meta.url);
  let source = ts.transpileModule(readFileSync(new URL('../app/admin/components/Dashboard.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  source = source
    .replace('"react/jsx-runtime"', JSON.stringify(pathToFileURL(require.resolve('react/jsx-runtime')).href))
    .replace(/import \{ hasEventFinished \} from [^;]+;/, 'const hasEventFinished = () => false;')
    .replace(/import styles from [^;]+;/, 'const styles = new Proxy({}, { get: (_, key) => key });')
    .replace(/import Icon from [^;]+;/, 'const Icon = () => null;')
    .replace(/import DashboardAnalytics from [^;]+;/, 'const DashboardAnalytics = () => null;');
  const { default: Dashboard } = await import(moduleUrl(source));
  const props = { bookings: [], volunteers: [], isLoading: false, hasError: false,
    events: [{ id: 43, title: 'WMS capacity test', date: '2099-11-15', status: 'Scheduled', location: 'Test', total_slots: 999 }],
    eventSlots: [{ event_id: 43, capacity: 5 }, { event_id: 43, capacity: 2 }, { event_id: 44, capacity: 100 }],
  };
  assert.match(renderToStaticMarkup(createElement(Dashboard, props)), /0 \/ 7/);
  props.eventSlots[0].capacity = 6;
  assert.match(renderToStaticMarkup(createElement(Dashboard, props)), /0 \/ 8/);
  props.eventSlots = [];
  assert.match(renderToStaticMarkup(createElement(Dashboard, props)), /0 \/ 0/);
});

test('WMS booking snapshots page all records and batch volunteer lookups under reduced row limits', async () => {
  const bookings = Array.from({ length: 105 }, (_, id) => ({ id, event_slot_id: 15, user_id: `user-${id}`, status: 'Confirmed' }));
  const profiles = bookings.map(b => ({ id: b.user_id, full_name: `Volunteer ${b.id}` }));
  const f = await fixture({ bookings, profiles, pageLimit: 2 });
  try {
    const route = await f.route('events/[externalEventId]/bookings');
    const response = await route.GET(request('GET'), { params: Promise.resolve({ externalEventId: 'event' }) });
    assert.equal(response.status, 200); const data = await response.json();
    assert.equal(data.bookingCount, 105); assert.equal(data.bookings.length, 105);
    assert.equal(data.bookings[104].volunteer.name, 'Volunteer 104');
    assert.equal(data.timeslots[0].remaining, 0);
    assert.ok(f.calls.filter(c => c.table === 'profiles').every(c => c.operations.find(op => op[0] === 'in')[2].length <= 100));
  } finally { f.cleanup(); }
});

test('WMS rejects incomplete snapshots rather than returning misleading success', async () => {
  const f = await fixture({ missingCount: true });
  try {
    const route = await f.route('events/[externalEventId]/bookings');
    assert.equal((await route.GET(request('GET'), { params: Promise.resolve({ externalEventId: 'event' }) })).status, 500);
  } finally { f.cleanup(); }
});

test('bookings use existing profile columns and return null phone with booking fallbacks', async () => {
  const f = await fixture({
    bookings: [
      { id: 1, event_slot_id: 15, user_id: 'known', status: 'Confirmed', volunteer_name: 'Old name', volunteer_email: 'old@example.invalid' },
      { id: 2, event_slot_id: 15, user_id: 'missing', status: 'Confirmed', volunteer_name: 'Fallback name', volunteer_email: 'fallback@example.invalid' },
    ],
    profiles: [{ id: 'known', full_name: 'Current name', email: 'current@example.invalid' }],
  });
  try {
    const route = await f.route('events/[externalEventId]/bookings');
    const response = await route.GET(request('GET'), { params: Promise.resolve({ externalEventId: 'event' }) });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.bookingCount, 2);
    assert.deepEqual(data.bookings.map(b => b.volunteer), [
      { vmsVolunteerId: 'known', name: 'Current name', email: 'current@example.invalid', phone: null },
      { vmsVolunteerId: 'missing', name: 'Fallback name', email: 'fallback@example.invalid', phone: null },
    ]);
    assert.ok(f.calls.filter(c => c.table === 'profiles').every(c => c.operations.find(op => op[0] === 'select')[1] === 'id, full_name, email'));
  } finally { f.cleanup(); }
});

const auditRows = f => f.calls.filter(call => call.table === 'admin_audit_log').map(call => call.operations.find(op => op[0] === 'insert')[1]);

test('successful WMS publishing, cancellation, capacity and attendance record source-labelled activity', async () => {
  const f = await fixture();
  try {
    const events = await f.route('events/[externalEventId]');
    const context = { params: Promise.resolve({ externalEventId: 'event' }) };
    assert.equal((await events.PUT(request('PUT', payload), context)).status, 200);
    assert.equal((await events.PUT(request('PUT', { ...payload, status: 'Cancelled' }), context)).status, 200);
    const capacity = await f.route('timeslots/[externalTimeslotId]/capacity');
    assert.equal((await capacity.PATCH(request('PATCH', { capacity: 6 }), slotContext)).status, 200);
    const attendance = await f.route('attendance');
    assert.equal((await attendance.POST(request('POST', { vmsBookingId: 99, attendanceStatus: 'attended', source: 'wms', recordedAt: '2026-11-15T10:15:00+02:00' }))).status, 200);
    const rows = auditRows(f);
    assert.deepEqual(rows.map(row => row.action), ['WMS_EVENT_PUBLISHED', 'WMS_EVENT_CANCELLED', 'WMS_CAPACITY_UPDATED', 'WMS_ATTENDANCE_UPDATED']);
    assert.ok(rows.every(row => row.admin_id === null && row.admin_name === 'WMS integration' && row.details.source === 'wms'));
    assert.equal(rows[0].entity_id, '43');
    assert.equal(rows[0].entity_label, payload.title);
    assert.deepEqual(rows[0].details.timeslots, [{ external_timeslot_id: 'slot', start_time: '09:15', end_time: '10:15', capacity: 5 }]);
    assert.equal(rows[2].details.capacity_before, 5);
    assert.equal(rows[2].details.capacity_after, 6);
    assert.equal(rows[3].entity_id, '99');
    assert.equal(rows[3].details.attendance_status, 'attended');
    assert.doesNotMatch(JSON.stringify(rows), /test-only-token|test-only-key|volunteer_email|contact_email/);
  } finally { f.cleanup(); }
});

test('unauthorised, invalid, rejected and stale WMS writes never create successful activity entries', async () => {
  for (const options of [{}, { rpcError: true }, { stale: true }, { reservations: 7 }]) {
    const f = await fixture(options);
    try {
      const events = await f.route('events/[externalEventId]');
      const attendance = await f.route('attendance');
      const capacity = await f.route('timeslots/[externalTimeslotId]/capacity');
      assert.equal((await events.PUT(request('PUT', payload, 'wrong'), { params: Promise.resolve({ externalEventId: 'event' }) })).status, 401);
      assert.equal((await attendance.POST(request('POST', {}))).status, 422);
      assert.equal((await capacity.PATCH(request('PATCH', { capacity: 0 }), slotContext)).status, 422);
      if (options.rpcError) {
        assert.notEqual((await events.PUT(request('PUT', payload), { params: Promise.resolve({ externalEventId: 'event' }) })).status, 200);
        assert.notEqual((await attendance.POST(request('POST', { vmsBookingId: 99, attendanceStatus: 'attended', source: 'wms', recordedAt: '2026-11-15T10:15:00+02:00' }))).status, 200);
      }
      if (options.stale || options.reservations) assert.notEqual((await capacity.PATCH(request('PATCH', { capacity: 6 }), slotContext)).status, 200);
      assert.equal(auditRows(f).length, 0);
    } finally { f.cleanup(); }
  }
});

test('audit errors do not turn already-committed WMS writes into false failures', async () => {
  for (const auditFailure of ['error', 'throw']) {
    const f = await fixture({ auditFailure });
    try {
      const events = await f.route('events/[externalEventId]');
      assert.equal((await events.PUT(request('PUT', payload), { params: Promise.resolve({ externalEventId: 'event' }) })).status, 200);
      const capacity = await f.route('timeslots/[externalTimeslotId]/capacity');
      assert.equal((await capacity.PATCH(request('PATCH', { capacity: 6 }), slotContext)).status, 200);
      const attendance = await f.route('attendance');
      assert.equal((await attendance.POST(request('POST', { vmsBookingId: 99, attendanceStatus: 'attended', source: 'wms', recordedAt: '2026-11-15T10:15:00+02:00' }))).status, 200);
      assert.equal(auditRows(f).length, 3);
    } finally { f.cleanup(); }
  }
});

test('read-only WMS booking retrieval does not add activity entries', async () => {
  const f = await fixture();
  try {
    const route = await f.route('events/[externalEventId]/bookings');
    assert.equal((await route.GET(request('GET'), { params: Promise.resolve({ externalEventId: 'event' }) })).status, 200);
    assert.equal(auditRows(f).length, 0);
  } finally { f.cleanup(); }
});
