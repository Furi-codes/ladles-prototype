/** Exercise the real event business rules with a fixed clock and fake persistence, without touching Supabase. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function load(path, dependencies = {}) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL('../' + path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`)(name => {
    assert.ok(name in dependencies, `Unexpected dependency ${name}`);
    return dependencies[name];
  }, loaded, loaded.exports);
  return loaded.exports;
}
const dates = load('business/shared/dates/calendar.ts');
const rules = load('business/admin/events.ts', { '@/business/shared/dates/calendar': dates });
const draft = () => ({ eventId: null, title: ' Community shift ', date: '2099-11-15', location: ' Warehouse ', category: 'Warehouse HQ', locationUrl: '', description: '', ranges: [{ start_time: '09:15', end_time: '10:15', capacity: 6 }] });

test('event rules reject past dates, invalid capacities, overlaps and unsafe map links', () => {
  const now = new Date('2099-11-15T06:00:00Z');
  assert.equal(rules.validateVolunteerEventDraft(draft(), now), null);
  assert.match(rules.validateVolunteerEventDraft({ ...draft(), date: '2099-11-14' }, now), /past/);
  assert.match(rules.validateVolunteerEventDraft({ ...draft(), locationUrl: 'javascript:alert(1)' }, now), /Map link/);
  for (const capacity of [0, -1, 1.5, NaN]) assert.match(rules.validateVolunteerEventDraft({ ...draft(), ranges: [{ ...draft().ranges[0], capacity }] }, now), /positive whole/);
  assert.match(rules.validateVolunteerEventDraft({ ...draft(), ranges: [...draft().ranges, { start_time: '10:00', end_time: '11:00', capacity: 2 }] }, now), /overlap/);
  assert.match(rules.validateVolunteerEventDraft(draft(), new Date('2099-11-15T07:15:00Z')), /start later/);
  assert.equal(rules.validateVolunteerEventDraft({ ...draft(), eventId: 1 }, new Date('2099-11-15T07:15:00Z')), null);
});

test('event save validates first, persists core then metadata and audit, and preserves partial-save information', async t => {
  const calls = [];
  let metadataError = null;
  const saved = { id: 8, title: 'Community shift', date: '2099-11-15', location: 'Warehouse' };
  const actions = load('business/admin/services/events.ts', {
    '@/business/admin/events': rules,
    '@/data/admin/management': {
      saveEventWithSlots: async (...args) => { calls.push(['core', ...args]); return { data: saved, error: null }; },
      updateEventMetadata: async (...args) => { calls.push(['metadata', ...args]); return { error: metadataError }; },
    },
    '@/data/admin/audit': { logAdminAction: async value => calls.push(['audit', value]) },
  });
  assert.deepEqual(await actions.saveVolunteerEvent(draft()), { savedEvent: saved, metadataError: null });
  assert.deepEqual(calls.map(item => item[0]), ['core', 'metadata', 'audit']);
  assert.equal(calls[0][2].title, 'Community shift');
  assert.equal(calls[2][1].action, 'EVENT_CREATED');
  calls.length = 0;
  await assert.rejects(actions.saveVolunteerEvent({ ...draft(), title: '' }), /Complete/);
  assert.equal(calls.length, 0);
  // The core event has already committed. Preserve its ID and expose the metadata error for honest feedback.
  metadataError = new Error('Metadata unavailable');
  t.mock.method(console, 'error', () => {});
  assert.deepEqual(await actions.saveVolunteerEvent(draft()), { savedEvent: saved, metadataError });
  assert.equal(calls[2][1].details.metadata_saved, false);
});

test('failed core persistence does not proceed to metadata or audit', async () => {
  const error = new Error('Write failed');
  const actions = load('business/admin/services/events.ts', {
    '@/business/admin/events': rules,
    '@/data/admin/management': {
      saveEventWithSlots: async () => ({ data: null, error }),
      updateEventMetadata: () => assert.fail('Metadata must not run'),
    },
    '@/data/admin/audit': { logAdminAction: () => assert.fail('Audit must not run') },
  });
  await assert.rejects(actions.saveVolunteerEvent(draft()), error);
});
