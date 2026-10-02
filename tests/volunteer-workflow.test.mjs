import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

async function loadUtility(name) {
  const source = readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}
const dates = await loadUtility('date-utils');
const attendance = await loadUtility('attendance-utils');

test('shift countdown uses days above 24 hours and hours/minutes at or below 24 hours', () => {
  assert.equal(attendance.formatShiftCountdown(1049 * 60 + 16), '44 days');
  assert.equal(attendance.formatShiftCountdown(2880), '2 days');
  assert.equal(attendance.formatShiftCountdown(1441), '2 days');
  assert.equal(attendance.formatShiftCountdown(1440), '24 hrs');
  assert.equal(attendance.formatShiftCountdown(1439), '23 hr 59 min');
  assert.equal(attendance.formatShiftCountdown(60), '1 hr');
  assert.equal(attendance.formatShiftCountdown(15), '15 min');
  assert.equal(attendance.formatShiftCountdown(0), '0 min');
  assert.equal(attendance.formatWorkedTime(2880), '48 hrs');
});

test('event and slot expiry use Johannesburg time, including the UTC date boundary', () => {
  const event = { id: 1, date: '2026-10-02' };
  const slots = [{ event_id: 1, end_time: '00:30:00' }, { event_id: 1, end_time: '01:00:00' }];
  assert.equal(dates.hasEventFinished(event, slots, new Date('2026-10-01T22:45:00Z')), false);
  assert.equal(dates.hasSlotEnded(event, slots[0], new Date('2026-10-01T22:45:00Z')), true);
  assert.equal(dates.hasEventFinished(event, slots, new Date('2026-10-01T23:00:00Z')), true);
  assert.equal(dates.hasEventFinished(event, [], new Date('2026-10-01T23:00:00Z')), false);
  assert.equal(dates.hasEventFinished(event, [], new Date('2026-10-02T22:00:00Z')), true);
});

test('certificate totals count only the current volunteer’s finalised completed shifts', () => {
  const bookings = Array.from({ length: 8 }, (_, index) => ({ id: index + 1, user_id: index === 7 ? 'other' : 'me', status: index === 6 ? 'Present' : 'Completed' }));
  const valid = { clocked_in_at: '2026-10-01T07:00:00Z', clocked_out_at: '2026-10-01T08:00:00Z', worked_minutes: 60 };
  const records = [
    { booking_id: 1, ...valid },
    { booking_id: 2, ...valid, clocked_out_at: null },
    { booking_id: 3, ...valid, worked_minutes: null },
    { booking_id: 4, ...valid, worked_minutes: -1 },
    { booking_id: 5, ...valid, clocked_in_at: 'invalid' },
    { booking_id: 6, ...valid, clocked_out_at: '2026-10-01T06:00:00Z' },
    { booking_id: 7, ...valid }, { booking_id: 8, ...valid },
  ];
  const summary = attendance.getVerifiedContribution(bookings, records, 'me');
  assert.equal(summary.totalMinutes, 60);
  assert.deepEqual(summary.completed.map(booking => booking.id), [1]);
  assert.equal(attendance.getVerifiedContribution(bookings, records).totalMinutes, 0);
});

test('attendance display uses South African time and safely handles missing/invalid timestamps', () => {
  assert.equal(attendance.formatAttendanceTime('2026-10-01T07:00:00Z'), '09:00');
  assert.equal(attendance.formatAttendanceTime('invalid'), '—');
  assert.equal(attendance.formatAttendanceTime(null), '—');
});

test('live hours stop at the shift end and do not replace final recorded minutes', () => {
  const record = { clocked_in_at: '2026-10-01T07:00:00Z', clocked_out_at: null, worked_minutes: null };
  assert.equal(attendance.getAttendanceMinutes(record, Date.parse('2026-10-01T12:00:00Z'), '2026-10-01T10:00:00Z'), 180);
  assert.equal(attendance.getAttendanceMinutes({ ...record, worked_minutes: 42 }, Date.now()), 42);
});
