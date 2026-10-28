/** Check the layer boundaries so future changes cannot quietly put database access back into a screen. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = folder => readdirSync(resolve(root, folder), { withFileTypes: true }).flatMap(entry => {
  const path = folder + '/' + entry.name;
  return entry.isDirectory() ? files(path) : /\.(ts|tsx)$/.test(path) ? [path] : [];
});

test('imports respect presentation to business to data and every local import resolves', () => {
  const failures = [];
  for (const file of ['app', 'presentation', 'business', 'data'].flatMap(files)) {
    const source = ts.createSourceFile(file, readFileSync(resolve(root, file), 'utf8'), ts.ScriptTarget.Latest, true);
    for (const node of source.statements) {
      if (!(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) || !node.moduleSpecifier) continue;
      const name = node.moduleSpecifier.text;
      const typeOnly = node.isTypeOnly || node.importClause?.isTypeOnly ||
        (node.importClause?.namedBindings?.elements?.length && !node.importClause.name && node.importClause.namedBindings.elements.every(item => item.isTypeOnly));
      if (name.startsWith('@/') || name.startsWith('.')) {
        const target = name.startsWith('@/') ? resolve(root, name.slice(2)) : resolve(root, dirname(file), name);
        const local = relative(root, target).replaceAll('\\', '/');
        if (!['', '.ts', '.tsx', '/index.ts', '/index.tsx'].some(suffix => existsSync(target + suffix))) failures.push(`${file}: missing ${name}`);
        if (/^(presentation|app)\//.test(file) && local.startsWith('data/')) failures.push(`${file}: UI bypasses business: ${name}`);
        if (file.startsWith('business/') && local.startsWith('presentation/')) failures.push(`${file}: business depends on UI: ${name}`);
        if (file.startsWith('data/') && /^(presentation|business)\//.test(local) && !typeOnly) failures.push(`${file}: data has an upward runtime dependency: ${name}`);
      }
      if (/^(app|presentation|business)\//.test(file) && name === '@supabase/supabase-js' && !typeOnly) failures.push(`${file}: SDK runtime belongs in data`);
    }
    if (/^(presentation|business)\//.test(file)) {
      const visit = node => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && ['fetch', 'createClient'].includes(node.expression.text)) failures.push(`${file}: direct transport ${node.expression.text}`);
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
  }
  assert.deepEqual(failures, []);
});
