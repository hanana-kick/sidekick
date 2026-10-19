import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { BehaviorController, validateBehavior } from '../dist/src/element/behavior.js';

const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture(t, { manualMoves = false } = {}) {
  const dom = new JSDOM('<body><div id="one" class="item"></div><div id="two" class="item"></div><div id="three" class="item"></div></body>');
  const document = dom.window.document;
  const authored = { activity: 'still', expression: 'authored-expression', tracking: 'pointer' };
  let current = { ...authored }, connected = true;
  const calls = [], changes = [], ends = [], moves = [], watchers = new Set();
  const host = {
    document,
    connected: () => connected,
    capture() {
      const saved = { ...current };
      calls.push({ type: 'capture', saved });
      return () => { current = { ...saved }; calls.push({ type: 'restore', saved }); };
    },
    prepare(activity, expression) { current = { activity, expression, tracking: 'off' }; calls.push({ type: 'prepare', activity, expression }); },
    move(target, side, gap) {
      const task = deferred();
      const move = { target, side, gap, ...task };
      moves.push(move); calls.push({ type: 'move', target: target.id, side, gap });
      if (!manualMoves) task.resolve({ finished: true, position: { x: 0, y: 0 } });
      return task.promise;
    },
    watch(target, lost) {
      const watcher = { target, lost, disposed: false };
      watchers.add(watcher);
      return () => {
        assert.equal(watcher.disposed, false, 'Every watcher must be disposed exactly once');
        watcher.disposed = true; watchers.delete(watcher);
      };
    },
    stop() { calls.push({ type: 'stop' }); for (const move of moves) move.resolve({ finished: false, position: { x: 0, y: 0 } }); },
    change(state) { changes.push({ ...state }); },
    end(result) { ends.push({ ...result }); },
  };
  const controller = new BehaviorController(host);
  t.after(() => { controller.cancel(); dom.window.close(); });
  return {
    dom, document, controller, host, calls, changes, ends, moves, watchers, authored,
    state: () => ({ ...current }), disconnect: () => { connected = false; },
    lose(target) { target.remove(); for (const watcher of [...watchers]) if (watcher.target === target) watcher.lost(); },
  };
}
const resultsFor = (f, id) => f.ends.filter(result => result.id === id);

test('validation is strict and an invalid replacement leaves the running behavior untouched', async t => {
  const f = fixture(t);
  const pending = f.controller.perform({ type: 'idle' });
  const before = f.controller.state, calls = f.calls.length;
  let getterReads = 0;
  const accessor = { type: 'idle', get duration() { getterReads++; return 0; } };
  const symbol = { type: 'idle', [Symbol('secret')]: 1 };
  const nonenumerable = Object.defineProperty({ type: 'idle' }, 'duration', { value: 0 });
  const invalid = [
    null, [], 'idle', {}, { type: 'unknown' }, { type: 'idle', target: '#one' },
    { type: 'wait' }, { type: 'wait', target: '' }, { type: 'wait', target: '[' },
    { type: 'wait', target: '#one', side: 'middle' }, { type: 'wait', target: '#one', gap: -1 },
    { type: 'wait', target: '#one', timeout: Infinity }, { type: 'idle', duration: NaN },
    { type: 'idle', duration: -1 }, { type: 'review', targets: ['#one'] },
    { type: 'review', targets: '.item', duration: 1 }, accessor, symbol, nonenumerable,
    Object.assign(Object.create({ inherited: true }), { type: 'idle' }),
  ];
  for (const declaration of invalid) assert.throws(() => f.controller.perform(declaration));
  for (const options of [null, [], { unsupported: true }, { signal: {} }]) assert.throws(() => f.controller.perform({ type: 'idle' }, options));
  assert.equal(getterReads, 0, 'Validation must never execute user-provided accessors');
  assert.equal(f.calls.length, calls);
  assert.deepEqual(f.controller.state, before);
  assert.deepEqual(f.ends, []);
  f.controller.cancel();
  assert.equal((await pending).status, 'cancelled');
});

test('target validation rejects cross-document elements and clones a review array without mutating it', t => {
  const f = fixture(t), foreign = new JSDOM('<div></div>');
  try {
    assert.throws(() => validateBehavior({ type: 'follow', target: foreign.window.document.querySelector('div') }, f.document));
    const first = f.document.querySelector('#one'), second = f.document.querySelector('#two');
    const targets = [first, second];
    const declaration = validateBehavior({ type: 'review', targets, dwell: 0 }, f.document);
    targets.reverse();
    assert.deepEqual(declaration.targets, [first, second]);
    assert.equal(Object.isFrozen(declaration), true);
    assert.equal(Object.isFrozen(declaration.targets), true);
    assert.notEqual(declaration.targets, targets);
    assert.equal(validateBehavior(Object.assign(Object.create(null), { type: 'idle', duration: 0 }), f.document).type, 'idle');
  } finally { foreign.window.close(); }
});

test('hostile review arrays reject atomically without evaluating custom getters or iterators', async t => {
  const f = fixture(t), target = f.document.querySelector('#one');
  const pending = f.controller.perform({ type: 'idle' });
  const state = f.controller.state, calls = f.calls.length;
  let evaluations = 0;
  const accessor = Object.defineProperty([], '0', { enumerable: true, get() { evaluations++; return target; } });
  const iterator = [target]; iterator[Symbol.iterator] = () => { evaluations++; return [target][Symbol.iterator](); };
  const extra = [target]; Object.defineProperty(extra, 'secret', { get() { evaluations++; return target; } });
  const sparse = new Array(1);
  const nonenumerable = Object.defineProperty([target], '0', { value: target, enumerable: false });
  class CustomArray extends Array {}
  for (const targets of [accessor, iterator, extra, sparse, nonenumerable, new CustomArray(target)]) {
    assert.throws(() => f.controller.perform({ type: 'review', targets }));
  }
  assert.equal(evaluations, 0); assert.deepEqual(f.controller.state, state); assert.equal(f.calls.length, calls);
  f.controller.cancel(); await pending;
});

test('finite behavior restores authored state and emits one terminal result after its full interval', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(t);
  const pending = f.controller.perform({ type: 'celebrate', duration: 40 });
  const id = f.controller.state.id;
  assert.deepEqual(f.state(), { activity: 'celebrating', expression: 'smile', tracking: 'off' });
  assert.equal(f.controller.state.status, 'acting');
  t.mock.timers.tick(39); await flush(); assert.deepEqual(f.ends, []);
  t.mock.timers.tick(1); await flush();
  const result = await pending;
  assert.deepEqual(result, { id, type: 'celebrate', status: 'completed', completedItems: 0 });
  assert.deepEqual(f.state(), f.authored);
  assert.equal(f.controller.declaration, null);
  assert.equal(f.controller.state.status, 'completed');
  f.controller.cancel(); t.mock.timers.tick(100); await flush();
  assert.equal(resultsFor(f, id).length, 1);
  assert.equal(f.calls.filter(call => call.type === 'restore').length, 1);
});

test('replacement and repeated stop settle each request exactly once and retain the authored baseline', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(t);
  const first = f.controller.perform({ type: 'celebrate', duration: 500 });
  const firstId = f.controller.state.id;
  const second = f.controller.perform({ type: 'error', duration: 100 });
  const secondId = f.controller.state.id;
  assert.equal((await first).reason, 'replaced');
  assert.equal(f.controller.declaration.type, 'error');
  assert.deepEqual(f.calls.filter(call => call.type === 'capture').map(call => call.saved), [f.authored, f.authored]);
  f.controller.cancel(); f.controller.cancel();
  assert.equal((await second).reason, 'stopped');
  t.mock.timers.tick(1000); await flush();
  assert.equal(resultsFor(f, firstId).length, 1);
  assert.equal(resultsFor(f, secondId).length, 1);
  assert.deepEqual(f.state(), f.authored);
});

test('selector resolution waits for a late target and forwards declared placement options', async t => {
  const f = fixture(t);
  const pending = f.controller.perform({ type: 'guide', target: '#late', side: 'above', gap: 23, timeout: 500, duration: 0 });
  await flush();
  assert.equal(f.controller.state.status, 'resolving'); assert.equal(f.moves.length, 0);
  const target = f.document.createElement('div'); target.id = 'late'; f.document.body.append(target);
  await flush();
  const result = await pending;
  assert.equal(result.status, 'completed'); assert.equal(result.completedItems, 1);
  assert.equal(f.moves[0].target, target); assert.equal(f.moves[0].side, 'above'); assert.equal(f.moves[0].gap, 23);
  assert.equal(f.watchers.size, 0); assert.deepEqual(f.state(), f.authored);
});

test('selector changes are observed and missing targets time out without any move', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(t);
  const pending = f.controller.perform({ type: 'follow', target: '.late-class', timeout: 40, duration: 0 });
  f.document.querySelector('#one').classList.add('late-class'); await flush();
  t.mock.timers.tick(0); await flush();
  assert.equal((await pending).status, 'completed');
  const count = f.moves.length;
  const missing = f.controller.perform({ type: 'wait', target: '#never', timeout: 40 });
  t.mock.timers.tick(39); await flush(); assert.equal(f.controller.state.status, 'resolving');
  t.mock.timers.tick(1); await flush();
  const result = await missing;
  assert.equal(result.status, 'error'); assert.match(result.reason, /timeout/i);
  assert.equal(f.moves.length, count); assert.equal(resultsFor(f, result.id).length, 1);
  const late = f.document.createElement('div'); late.id = 'never'; f.document.body.append(late); await flush();
  assert.equal(f.moves.length, count, 'A timed-out observer must not resume the old run');
  assert.deepEqual(f.state(), f.authored);
});

test('review snapshots document order once, ignores additions, and skips a removed later target', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(t, { manualMoves: true });
  const pending = f.controller.perform({ type: 'review', targets: '.item', dwell: 10 });
  await flush();
  assert.deepEqual(f.moves.map(move => move.target.id), ['one']);
  const first = f.document.querySelector('#one'), second = f.document.querySelector('#two'), third = f.document.querySelector('#three');
  f.document.body.prepend(third); second.remove();
  const extra = f.document.createElement('div'); extra.className = 'item'; extra.id = 'four'; f.document.body.append(extra);
  f.moves[0].resolve({ finished: true, position: { x: 0, y: 0 } }); await flush();
  t.mock.timers.tick(10); await flush();
  assert.deepEqual(f.moves.map(move => move.target.id), ['one', 'three']);
  assert.equal(f.controller.state.itemIndex, 2); assert.equal(f.controller.state.itemCount, 3);
  f.moves[1].resolve({ finished: true, position: { x: 0, y: 0 } }); await flush();
  t.mock.timers.tick(10); await flush();
  const result = await pending;
  assert.equal(result.status, 'completed'); assert.equal(result.completedItems, 2);
  assert.equal(f.moves[0].target, first); assert.equal(f.watchers.size, 0);
});

test('review input and public snapshots cannot mutate an active run', async t => {
  const f = fixture(t, { manualMoves: true });
  const one = f.document.querySelector('#one'), two = f.document.querySelector('#two');
  const targets = [one, two];
  const pending = f.controller.perform({ type: 'review', targets, dwell: 0 });
  targets.reverse();
  const declaration = f.controller.declaration; declaration.targets.reverse(); declaration.dwell = 1000;
  const state = f.controller.state; state.status = 'error'; state.id = -1;
  await flush();
  assert.equal(f.moves[0].target, one);
  assert.deepEqual(f.controller.declaration.targets, [one, two]);
  assert.equal(f.controller.declaration.dwell, 0); assert.equal(f.controller.state.status, 'moving');
  f.controller.cancel(); assert.equal((await pending).status, 'cancelled');
});

test('review continues after a removed in-flight item and does not count the lost item', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(t, { manualMoves: true });
  const pending = f.controller.perform({ type: 'review', targets: [f.document.querySelector('#one'), f.document.querySelector('#two')], dwell: 0 });
  await flush();
  f.lose(f.moves[0].target); f.moves[0].resolve({ finished: false, position: { x: 0, y: 0 } }); await flush();
  assert.deepEqual(f.moves.map(move => move.target.id), ['one', 'two']);
  f.moves[1].resolve({ finished: true, position: { x: 0, y: 0 } }); await flush();
  t.mock.timers.tick(0); await flush();
  const result = await pending;
  assert.equal(result.status, 'completed'); assert.equal(result.completedItems, 1); assert.equal(f.watchers.size, 0);
});

test('target removal ends a persistent behavior and disposes its watcher once', async t => {
  const f = fixture(t);
  const target = f.document.querySelector('#one');
  const pending = f.controller.perform({ type: 'wait', target });
  await flush(); assert.equal(f.controller.state.status, 'acting');
  f.lose(target);
  const result = await pending;
  assert.equal(result.status, 'error'); assert.match(result.reason, /removed/i);
  assert.equal(f.watchers.size, 0); assert.equal(resultsFor(f, result.id).length, 1);
  assert.deepEqual(f.state(), f.authored);
});

test('AbortSignal cancels resolution and removes its listener without later resumption', async t => {
  const f = fixture(t), abort = new f.dom.window.AbortController();
  let removed = 0;
  const remove = abort.signal.removeEventListener.bind(abort.signal);
  abort.signal.removeEventListener = (...args) => { if (args[0] === 'abort') removed++; return remove(...args); };
  const pending = f.controller.perform({ type: 'guide', target: '#later', timeout: 500 }, { signal: abort.signal });
  abort.abort();
  const result = await pending;
  assert.equal(result.status, 'cancelled'); assert.equal(result.reason, 'aborted'); assert.equal(removed, 1);
  const later = f.document.createElement('div'); later.id = 'later'; f.document.body.append(later); await flush();
  assert.equal(f.moves.length, 0); assert.equal(f.watchers.size, 0); assert.equal(resultsFor(f, result.id).length, 1);
});

test('already-aborted and disconnected runs settle without preparing or moving', async t => {
  const f = fixture(t), abort = new f.dom.window.AbortController(); abort.abort();
  const aborted = await f.controller.perform({ type: 'wait', target: '#one' }, { signal: abort.signal });
  assert.equal(aborted.reason, 'aborted');
  f.disconnect();
  const disconnected = await f.controller.perform({ type: 'celebrate' });
  assert.equal(disconnected.status, 'error'); assert.match(disconnected.reason, /disconnected/i);
  assert.equal(f.calls.some(call => call.type === 'prepare' || call.type === 'move'), false);
  assert.deepEqual(f.state(), f.authored);
});

test('cancellation during movement ignores a stale completion and cannot advance the old review', async t => {
  const f = fixture(t, { manualMoves: true });
  const pending = f.controller.perform({ type: 'review', targets: '.item', dwell: 0 });
  await flush(); const id = f.controller.state.id;
  f.controller.cancel('disconnected');
  assert.equal((await pending).reason, 'disconnected');
  f.moves[0].resolve({ finished: true, position: { x: 0, y: 0 } }); await flush();
  assert.equal(f.moves.length, 1); assert.equal(f.watchers.size, 0); assert.equal(resultsFor(f, id).length, 1);
  assert.deepEqual(f.state(), f.authored);
});

test('interrupted and rejected movement restore state and produce one terminal result', async t => {
  const f = fixture(t, { manualMoves: true });
  const interrupted = f.controller.perform({ type: 'follow', target: '#one' }); await flush();
  f.moves[0].resolve({ finished: false, position: { x: 0, y: 0 } });
  const first = await interrupted;
  assert.equal(first.status, 'cancelled'); assert.match(first.reason, /interrupted/i);
  const rejected = f.controller.perform({ type: 'guide', target: '#two' }); await flush();
  f.moves[1].reject(new Error('geometry failed'));
  const second = await rejected;
  assert.equal(second.status, 'error'); assert.equal(second.reason, 'geometry failed');
  assert.equal(resultsFor(f, first.id).length, 1); assert.equal(resultsFor(f, second.id).length, 1);
  assert.equal(f.watchers.size, 0); assert.deepEqual(f.state(), f.authored);
});

test('a newer request created by an end listener wins over an outer replacement', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(t);
  const first = f.controller.perform({ type: 'idle' });
  let nested;
  const originalEnd = f.host.end;
  f.host.end = result => {
    originalEnd(result);
    f.host.end = originalEnd;
    nested = f.controller.perform({ type: 'celebrate', duration: 10 });
  };
  const outer = f.controller.perform({ type: 'error' });
  assert.equal((await first).status, 'cancelled'); assert.equal((await outer).status, 'cancelled');
  assert.equal(f.controller.declaration.type, 'celebrate');
  t.mock.timers.tick(10); await flush();
  assert.equal((await nested).status, 'completed'); assert.deepEqual(f.state(), f.authored);
  assert.equal(f.ends.length, 3); assert.equal(new Set(f.ends.map(result => result.id)).size, 3);
});

test('synchronous change and prepare callbacks may stop a run without starting residual work', async t => {
  const f = fixture(t);
  const originalChange = f.host.change;
  f.host.change = state => { originalChange(state); if (state.status === 'resolving') f.controller.cancel(); };
  const first = await f.controller.perform({ type: 'wait', target: '#one' });
  assert.equal(first.status, 'cancelled'); assert.equal(f.moves.length, 0);
  f.host.change = originalChange;
  const originalPrepare = f.host.prepare;
  f.host.prepare = (...args) => { originalPrepare(...args); f.controller.cancel(); };
  const second = await f.controller.perform({ type: 'review', targets: '.item' });
  assert.equal(second.status, 'cancelled'); assert.equal(f.moves.length, 0);
  assert.equal(f.watchers.size, 0); assert.deepEqual(f.state(), f.authored);
});

test('empty and entirely disconnected explicit review snapshots finish without waiting for selectors', async t => {
  const f = fixture(t);
  const empty = await f.controller.perform({ type: 'review', targets: [] });
  const detached = f.document.createElement('div');
  const skipped = await f.controller.perform({ type: 'review', targets: [detached] });
  assert.equal(empty.status, 'completed'); assert.equal(empty.completedItems, 0);
  assert.equal(skipped.status, 'completed'); assert.equal(skipped.completedItems, 0);
  assert.equal(f.moves.length, 0); assert.deepEqual(f.state(), f.authored);
});

test('a behavior created by a synchronous stop callback keeps its state and authored restore baseline', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(t);
  const first = f.controller.perform({ type: 'idle' });
  let nested;
  const stop = f.host.stop;
  f.host.stop = () => {
    f.host.stop = stop;
    stop();
    nested = f.controller.perform({ type: 'celebrate', duration: 10 });
  };
  f.controller.cancel();
  assert.equal((await first).status, 'cancelled');
  assert.equal(f.controller.declaration.type, 'celebrate');
  assert.equal(f.controller.state.type, 'celebrate');
  assert.equal(f.controller.state.status, 'acting');
  assert.equal(f.state().activity, 'celebrating');
  t.mock.timers.tick(10); await flush();
  assert.equal((await nested).status, 'completed');
  assert.deepEqual(f.state(), f.authored);
});

test('capture reentrancy cannot attach a leaked abort listener to an already-cancelled run', async t => {
  const f = fixture(t), abort = new f.dom.window.AbortController();
  const listeners = new Set();
  const add = abort.signal.addEventListener.bind(abort.signal), remove = abort.signal.removeEventListener.bind(abort.signal);
  abort.signal.addEventListener = (type, listener, options) => { if (type === 'abort') listeners.add(listener); add(type, listener, options); };
  abort.signal.removeEventListener = (type, listener, options) => { if (type === 'abort') listeners.delete(listener); remove(type, listener, options); };
  const capture = f.host.capture;
  let nested;
  f.host.capture = () => {
    f.host.capture = capture;
    const restore = capture();
    nested = f.controller.perform({ type: 'idle' });
    return restore;
  };
  const outer = f.controller.perform({ type: 'guide', target: '#one' }, { signal: abort.signal });
  assert.equal((await outer).status, 'cancelled');
  assert.equal(listeners.size, 0);
  assert.equal(f.controller.declaration.type, 'idle'); assert.equal(f.moves.length, 0);
  f.controller.cancel(); await nested;
});

test('a watch callback that synchronously reports target loss cannot issue a stale move or leak cleanup', async t => {
  const f = fixture(t);
  let cleaned = 0;
  f.host.watch = (_target, lost) => { lost(); return () => { cleaned++; }; };
  const result = await f.controller.perform({ type: 'wait', target: '#one' });
  assert.equal(result.status, 'error');
  assert.equal(f.moves.length, 0);
  assert.equal(cleaned, 1);
  assert.deepEqual(f.state(), f.authored);
});

test('the real avatar API starts detached declarations, restores authored state, validates attributes atomically, and honors newer playback intent', async () => {
  const dom = new JSDOM('<body><div id="target"></div></body>', { pretendToBeVisual: true });
  const originals = new Map();
  class Observer { observe() {} unobserve() {} disconnect() {} }
  const globals = {
    HTMLElement: dom.window.HTMLElement, CustomEvent: dom.window.CustomEvent,
    requestAnimationFrame: callback => dom.window.requestAnimationFrame(callback), cancelAnimationFrame: handle => dom.window.cancelAnimationFrame(handle),
    ResizeObserver: Observer, IntersectionObserver: Observer,
    matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  };
  for (const [key, value] of Object.entries(globals)) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  let bot, html;
  try {
    const { SidekickAvatar } = await import('../dist/src/element/avatar.js');
    // Keep the actual lifecycle and public API. Only the unavailable GPU renderer is replaced.
    class RuntimeTestAvatar extends SidekickAvatar { initializeRenderer() {} }
    dom.window.customElements.define('behavior-runtime-avatar', RuntimeTestAvatar);
    const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top });
    const target = dom.window.document.getElementById('target');
    target.getBoundingClientRect = () => rect(400, 200, 180, 80);
    target.getClientRects = () => [target.getBoundingClientRect()];
    bot = dom.window.document.createElement('behavior-runtime-avatar');
    bot.getBoundingClientRect = () => rect(bot.position.x, bot.position.y, 120, 120);
    bot.getClientRects = () => [bot.getBoundingClientRect()];
    bot.placement = 'viewport'; bot.movementBounds = 'none';
    bot.setActivity('still'); bot.trackingMode = 'eyes'; bot.bodyOrientation = { yaw: 17, pitch: 8, roll: -5 };
    await bot.setExpression('both', 'smile', { duration: 0 });
    const authored = { activity: bot.activity, tracking: bot.trackingMode, orientation: bot.bodyOrientation, design: bot.design };
    const ends = [], errors = [];
    bot.addEventListener('sidekick-behavior-end', event => ends.push(event.detail));
    bot.addEventListener('sidekick-error', event => errors.push(event.detail));
    bot.behavior = { type: 'wait', target: '#target', side: 'left', gap: 24 };
    assert.equal(bot.behavior.target, '#target'); assert.equal(ends.length, 0);
    dom.window.document.body.append(bot); await flush();
    assert.equal(bot.behaviorState.status, 'acting'); assert.equal(bot.activity, 'thinking');
    assert.equal(bot.elementAnchor.target, target); assert.deepEqual(bot.position, { x: 256, y: 180 });
    const activeId = bot.behaviorState.id;
    bot.setAttribute('shape', 'heart'); bot.setAttribute('behavior', '{broken'); await flush();
    assert.equal(bot.behaviorState.id, activeId); assert.equal(bot.behaviorState.status, 'acting');
    assert.equal(bot.design.body.shape, authored.design.body.shape); assert.equal(errors.length, 1);
    bot.stopBehavior(); await flush();
    assert.deepEqual({ activity: bot.activity, tracking: bot.trackingMode, orientation: bot.bodyOrientation, design: bot.design }, authored);
    assert.equal(bot.elementAnchor, null); assert.equal(ends.length, 1);

    const playing = bot.play('thinking');
    let nested;
    bot.addEventListener('sidekick-play-end', () => { nested = bot.perform({ type: 'celebrate', duration: 10000 }); }, { once: true });
    const outer = bot.perform({ type: 'error', duration: 10000 });
    assert.equal((await outer).status, 'cancelled');
    assert.equal(bot.behavior.type, 'celebrate'); assert.equal(bot.behaviorState.status, 'acting'); assert.equal(bot.activity, 'celebrating');
    bot.stopBehavior(); assert.equal((await nested).status, 'cancelled'); assert.equal((await playing).finished, false);

    html = dom.window.document.createElement('behavior-runtime-avatar');
    html.setAttribute('behavior', JSON.stringify({ type: 'idle' })); await flush();
    assert.equal(html.behavior.type, 'idle');
    dom.window.document.body.append(html); await flush();
    assert.equal(html.behaviorState.status, 'acting');
    html.remove(); assert.equal(html.behaviorState.status, 'cancelled'); assert.equal(html.behavior, null);
  } finally {
    bot?.remove(); html?.remove(); await flush(); dom.window.close();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
