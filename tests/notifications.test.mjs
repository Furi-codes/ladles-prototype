import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../lib/notification-utils.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { inboxItems, unreadNotifications, notificationLabel, notificationDate } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const items = [
  {id:1,is_read:false,created_at:'2026-10-01T08:00:00Z'},
  {id:2,is_read:true,created_at:'2026-10-01T10:00:00Z'},
  {id:3,is_read:false,created_at:'2026-10-01T10:00:00Z'},
];
test('unread count and filter preserve the read history and do not mutate source', () => {
  assert.equal(unreadNotifications(items),2);
  assert.deepEqual(inboxItems(items,true).map(item=>item.id),[3,1]);
  assert.deepEqual(inboxItems(items,false).map(item=>item.id),[3,2,1]);
  assert.deepEqual(items.map(item=>item.id),[1,2,3]);
  assert.equal(unreadNotifications([]),0);
});
test('notification types have clear labels', () => {
  assert.equal(notificationLabel('event_cancelled'),'Event update');
  assert.equal(notificationLabel('shift_reminder_24h'),'Upcoming shift');
  assert.equal(notificationLabel('shift_reminder_2h'),'Starting soon');
});
test('timestamps use Johannesburg time, with an invalid-date fallback', () => {
  assert.match(notificationDate('2026-10-01T08:00:00Z'),/10:00/);
  assert.equal(notificationDate('bad'),'Date unavailable');
});
