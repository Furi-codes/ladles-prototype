/**
 * Exercises the shared portal animation lifecycle with a small fake browser.
 * These checks cover cleanup, reduced motion, focus and printing without
 * opening a browser, changing records or depending on animation timing.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../presentation/components/experience/portal-motion.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { installPortalMotion } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

function listeners() {
  const events = new Map();
  return {
    events,
    addEventListener(type, handler) { if (!events.has(type)) events.set(type, new Set()); events.get(type).add(handler); },
    removeEventListener(type, handler) { events.get(type)?.delete(handler); },
    emit(type, event = {}) { for (const handler of events.get(type) || []) handler(event); },
    count() { return [...events.values()].reduce((total, handlers) => total + handlers.size, 0); },
  };
}

function browser({ reduced = false } = {}) {
  const frames = new Map(), intersections = [], mutations = [], values = new Map(), targets = [];
  const preference = Object.assign(listeners(), { matches: reduced });
  let nextFrame = 0, queries = 0;
  const view = Object.assign(listeners(), {
    scrollY: 500,
    matchMedia: () => preference,
    requestAnimationFrame(callback) { const id = ++nextFrame; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    IntersectionObserver: class {
      observed = new Set(); disconnected = false;
      constructor(callback) { this.callback = callback; intersections.push(this); }
      observe(target) { this.observed.add(target); }
      unobserve(target) { this.observed.delete(target); }
      disconnect() { this.disconnected = true; this.observed.clear(); }
      show(...elements) { this.callback(elements.map(target => ({ target, isIntersecting: true }))); }
    },
    MutationObserver: class {
      disconnected = false;
      constructor(callback) { this.callback = callback; mutations.push(this); }
      observe() {}
      disconnect() { this.disconnected = true; }
    },
  });
  const content = { querySelectorAll: () => { queries++; return targets; }, contains: target => targets.includes(target) };
  const document = { defaultView: view, activeElement: null, documentElement: { scrollHeight: 1800, clientHeight: 800 } };
  const root = Object.assign(listeners(), {
    ownerDocument: document,
    querySelector: () => content,
    querySelectorAll: () => [],
    style: { setProperty(key, value) { values.set(key, value); }, removeProperty(key) { values.delete(key); } },
  });
  function element(options = {}) {
    const node = {
      animations: [], parentElement: null, hidden: false,
      closest() { return this.hidden ? this : null; },
      contains(target) { return target === this; },
      animate(keyframes, timing) {
        const animation = { keyframes, timing, cancelled: false, cancel() { this.cancelled = true; this.oncancel?.(); } };
        this.animations.push(animation); return animation;
      },
      ...options,
    };
    targets.push(node); return node;
  }
  function flush() {
    const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback());
  }
  function reduce(value) { preference.matches = value; preference.emit('change'); }
  return { root, content, view, document, preference, frames, intersections, mutations, values, targets, element, flush, reduce, get queries() { return queries; } };
}

test('portal entrances are one-time, bounded and staggered; nested/hidden content stays untouched', () => {
  const f = browser(), first = f.element(), second = f.element();
  const nested = f.element({ parentElement: { closest: () => first } }), hidden = f.element({ hidden: true });
  const cleanup = installPortalMotion(f.root, '.surface');
  const observer = f.intersections[0];
  assert.deepEqual([...observer.observed], [first, second]);
  assert.equal(first.animations.length, 0, 'content has no opacity override while waiting for observation');
  observer.show(first, second);
  assert.deepEqual([first, second].map(node => node.animations[0].timing.delay), [0, 40]);
  assert.equal(first.animations[0].keyframes.at(-1).filter, 'none');
  assert.ok(first.animations[0].keyframes.every(frame => !('transform' in frame) && !('translate' in frame) && !('scale' in frame)), 'Entrances must not move or resize the surface');
  observer.show(first); assert.equal(first.animations.length, 1);
  assert.equal(nested.animations.length, 0); assert.equal(hidden.animations.length, 0);
  first.animations[0].onfinish(); assert.equal(first.animations[0].cancelled, true, 'finished effects release the blur filter');
  f.flush(); assert.equal(f.values.get('--portal-scroll-progress'), '0.5');
  cleanup();
  assert.equal(second.animations[0].cancelled, true);
  assert.equal(f.root.count() + f.view.count() + f.preference.count(), 0);
  assert.equal(f.frames.size, 0); assert.equal(f.values.size, 0);
});

test('reduced motion prevents observation and immediately cancels active effects when enabled', () => {
  const f = browser({ reduced: true }), card = f.element();
  const cleanup = installPortalMotion(f.root, '.surface');
  assert.equal(f.intersections.length, 0); assert.equal(card.animations.length, 0);
  f.reduce(false); f.intersections.at(-1).show(card);
  const animation = card.animations[0]; assert.ok(animation);
  f.reduce(true);
  assert.equal(animation.cancelled, true); assert.equal(f.intersections.at(-1).disconnected, true);
  cleanup(); assert.equal(f.preference.count(), 0);
});

test('interaction clears the visual effect immediately and printing releases every active animation', () => {
  const f = browser(), form = f.element(), report = f.element();
  const cleanup = installPortalMotion(f.root, '.surface');
  f.intersections[0].show(form, report);
  f.root.emit('focusin', { target: form });
  assert.equal(form.animations[0].cancelled, true);
  assert.equal(report.animations[0].cancelled, false);
  f.view.emit('beforeprint');
  assert.equal(report.animations[0].cancelled, true);
  assert.equal(f.intersections[0].disconnected, true);
  const duringPrint = f.element(); f.intersections[0].show(duringPrint);
  assert.equal(duringPrint.animations.length, 0);
  f.view.emit('afterprint');
  f.intersections.at(-1).show(duringPrint); assert.equal(duringPrint.animations.length, 1);
  cleanup();
});

test('new panels are observed through one scheduled frame; late callbacks cannot animate after cleanup', () => {
  const f = browser(), initial = f.element();
  const cleanup = installPortalMotion(f.root, '.surface');
  f.flush(); f.intersections[0].show(initial);
  const queryCount = f.queries;
  for (let i = 0; i < 20; i++) f.view.emit('scroll');
  f.flush(); assert.equal(f.queries, queryCount, 'scrolling does not repeatedly rescan all page content');
  const added = f.element();
  for (let i = 0; i < 20; i++) f.mutations[0].callback([{ type: 'childList', addedNodes: [{ nodeType: 1 }] }]);
  assert.equal(f.frames.size, 1, 'mutations are coalesced instead of querying the DOM twenty times');
  f.flush(); assert.ok(f.intersections[0].observed.has(added));
  f.mutations[0].callback([{ type: 'childList', addedNodes: [{ nodeType: 3 }] }]);
  assert.equal(f.frames.size, 0, 'a clock text update does not rescan the workspace');
  cleanup(); f.intersections[0].show(added);
  assert.equal(added.animations.length, 0);
  assert.equal(f.mutations[0].disconnected, true);
});

test('unavailable animation APIs and a focused form never block ordinary content', () => {
  const f = browser(), focused = f.element(), unsupported = f.element({ animate: undefined });
  f.document.activeElement = focused;
  const cleanup = installPortalMotion(f.root, '.surface');
  assert.doesNotThrow(() => f.intersections[0].show(focused, unsupported));
  assert.equal(focused.animations.length, 0); assert.equal(unsupported.animations.length, 0);
  cleanup();
  const withoutWindow = { ownerDocument: { defaultView: null } };
  assert.doesNotThrow(() => installPortalMotion(withoutWindow, '.surface')());
});
