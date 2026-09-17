import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
async function loaderWith(range) {
  const source = readFileSync(new URL('../lib/actions/corporate.ts', import.meta.url),'utf8');
  const js = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const key = '__pagination_' + Math.random().toString(36).slice(2);
  globalThis[key] = { from: () => ({ select: () => ({ order: () => ({ range }) }) }) };
  try {
    const mocked = js.replace(/import \{ supabase \} from ['"]@\/lib\/supabase['"];?/, `const supabase = globalThis[${JSON.stringify(key)}];`);
    return (await import(`data:text/javascript;base64,${Buffer.from(mocked).toString('base64')}`)).allRows;
  } finally { delete globalThis[key]; }
}
test('pagination follows exact counts and actual page lengths when the server caps responses', async () => {
  const fixture = [1,2,3,4,5].map(id=>({id})); const offsets=[];
  const allRows = await loaderWith(async start => { offsets.push(start); return {data:fixture.slice(start,start+2),error:null,count:fixture.length}; });
  assert.deepEqual(await allRows('fixture'),fixture); assert.deepEqual(offsets,[0,2,4]);
});
test('pagination rejects incomplete data instead of silently reporting partial totals', async () => {
  const missingCount = await loaderWith(async () => ({data:[{id:1}],error:null,count:null}));
  await assert.rejects(()=>missingCount('fixture'),/complete row count/);
  const emptyPage = await loaderWith(async () => ({data:[],error:null,count:5}));
  await assert.rejects(()=>emptyPage('fixture'),/Data changed/);
});
