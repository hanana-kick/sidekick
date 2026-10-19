import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { LifecycleController, validateSidekickPresence, validateSidekickTask, validateSidekickHome } from '../src/element/lifecycle.ts';

const flush = async () => { for (let index = 0; index < 16; index++) await Promise.resolve(); };
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const home = (placement = 'bottom-right') => ({ positioning: { target: 'viewport', placement }, rest: { activity: 'idle', emotion: 'neutral' } });
const task = (id = 'job', status = 'pending') => ({ id, status, behavior: { type: 'idle', duration: 1 } });
function fixture(t, options = {}) {
  const dom = new JSDOM('<body><div id="target"></div><div id="other"></div></body>');
  const calls = [], changes = [], errors = [], behaviors = [], reactions = [], positions = [], presences = [];
  let connected = true, baseline = { activity: 'still', emotion: 'curious' }, presentation = { ...baseline };
  const host = {
    document: dom.window.document,
    connected: () => connected,
    cancel(reason, current) {
      calls.push({ kind: 'cancel', reason });
      if (options.cleanupAfterCallback) { options.onCancel?.(current); if (current()) presentation = { ...baseline }; }
      else { presentation = { ...baseline }; options.onCancel?.(current); }
    },
    presence(value, current) { const operation = { value, current, ...deferred() }; presences.push(operation); calls.push({ kind: 'presence', value }); if (!options.manualPresence) operation.resolve(); return operation.promise; },
    perform(value, current) { const operation = { value, current, ...deferred() }; behaviors.push(operation); calls.push({ kind: 'perform', value }); return operation.promise; },
    reactTo(value, current) { const operation = { value, current, ...deferred() }; reactions.push(operation); calls.push({ kind: 'react', value }); return operation.promise; },
    position(value, current) { const operation = { value, current, ...deferred() }; positions.push(operation); calls.push({ kind: 'position', value }); if (!options.manualPosition) operation.resolve({ finished: true, position: { x: 10, y: 20 } }); return operation.promise; },
    rest(value, current) { calls.push({ kind: 'rest', value }); if (current()) presentation = { ...baseline, ...value }; options.onRest?.(current); },
    change(value) { changes.push(value); options.onChange?.(value); },
    error(value) { errors.push(value); options.onError?.(value); },
  };
  const controller = new LifecycleController(host);
  t.after(() => { controller.dispose(); dom.window.close(); });
  return { dom, host, controller, calls, changes, errors, behaviors, reactions, positions, presences,
    connected: value => { connected = value; }, baseline: value => { baseline = value; }, presentation: () => presentation,
    doneBehavior(index = behaviors.length - 1, status = 'completed', reason) { behaviors[index].resolve({ id: index + 1, type: behaviors[index].value.type, status, completedItems: 0, ...(reason ? { reason } : {}) }); },
    doneReaction(index = reactions.length - 1) { reactions[index].resolve({ finished: true, emotion: reactions[index].value.emotion, reason: 'completed' }); },
  };
}

test('declaration validation is strict, atomic, and never invokes accessors', async t => {
  const f = fixture(t); f.controller.update({ task: task() }); await flush();
  const before = f.controller.task, calls = f.calls.length;
  let reads = 0;
  const accessor = Object.defineProperty({ visible: true }, 'entrance', { enumerable: true, get() { reads++; return {}; } });
  const target = Object.defineProperty({}, 'nodeType', { get() { reads++; return 1; } });
  const hostileArray = Object.defineProperty([], '0', { enumerable: true, get() { reads++; return 'success'; } });
  const iterator = ['success']; iterator[Symbol.iterator] = () => { reads++; return [][Symbol.iterator](); };
  const invalid = [
    { presence: accessor }, { presence: { visible: true, entrance: { source: 'element', target, direction: 'left' } } },
    { presence: { visible: 'yes' } }, { presence: { visible: true, exit: { to: 'nowhere' } } },
    { task: { id: {}, status: 'pending' } }, { task: { id: '', status: 'pending' } }, { task: { id: Infinity, status: 'pending' } },
    { task: { id: 'job', status: 'complete' } }, { task: { ...task(), reaction: { emotion: 'unknown' } } },
    { task: { ...task(), reaction: { emotion: 'happy', duration: -1 } } },
    { home: { ...home(), returnOn: hostileArray } }, { home: { ...home(), returnOn: iterator } },
    { home: { ...home(), returnOn: new Array(1) } }, { home: { ...home(), returnOn: ['pending'] } },
    { home: { ...home(), rest: { behavior: { type: 'follow', target: '#target' } } } },
    { home: { ...home(), rest: { gaze: { target: '#target', x: 0 } } } },
    { home: { ...home(), rest: { bodyOrientation: { yaw: 900 } } } },
    { home: { ...home(), rest: { gaze: { x: 2, y: 0 } } } },
    { home: { ...home(), rest: { gaze: { target: '[' } } } },
    { task: task('replacement'), home: { positioning: { target: '[' } } },
    { unsupported: true }, Object.defineProperty({}, 'task', { enumerable: true, get() { reads++; return task(); } }),
  ];
  for (const value of invalid) assert.throws(() => f.controller.update(value));
  await flush(); assert.equal(reads, 0); assert.equal(f.calls.length, calls); assert.deepEqual(f.controller.task, before);
});

test('validated declarations and getter snapshots copy nested data while retaining Element identity', async t => {
  const f = fixture(t), element = f.host.document.querySelector('#target');
  const input = { positioning: { target: element, offset: { x: 4 } }, rest: { gaze: { target: element }, bodyOrientation: { yaw: 25 } }, returnOn: ['cancelled', 'success'] };
  f.controller.update({ home: input, task: { id: 0, status: 'pending', behavior: { type: 'review', targets: [element] } } });
  input.positioning.offset.x = 100; input.rest.bodyOrientation.yaw = 90; input.returnOn.length = 0;
  const snapshot = f.controller.home; snapshot.positioning.offset.x = 500; snapshot.rest.bodyOrientation.yaw = 180; snapshot.returnOn.length = 0;
  const behavior = f.controller.task.behavior; behavior.targets.length = 0;
  assert.equal(f.controller.home.positioning.offset.x, 4); assert.equal(f.controller.home.rest.bodyOrientation.yaw, 25);
  assert.deepEqual(f.controller.home.returnOn, ['success', 'cancelled']); assert.equal(f.controller.home.positioning.target, element); assert.equal(f.controller.home.rest.gaze.target, element);
  assert.deepEqual(f.controller.task.behavior.targets, [element]);
  const validated = validateSidekickHome(input, f.host.document); assert.equal(Object.isFrozen(validated), true); assert.equal(Object.isFrozen(validated.positioning.offset), true);
  assert.equal(Object.isFrozen(validateSidekickTask(task(), f.host.document)), true);
  assert.equal(Object.isFrozen(validateSidekickPresence({ visible: true }, f.host.document)), true);
  const foreign = new JSDOM('<div></div>');
  try { for (const value of [{ positioning: { target: foreign.window.document.querySelector('div') } }, { ...home(), rest: { gaze: { target: foreign.window.document.querySelector('div') } } }]) assert.throws(() => validateSidekickHome(value, f.host.document)); }
  finally { foreign.window.close(); }
});

test('same-turn declarations coalesce and pending behavior completion never invents task success', async t => {
  const f = fixture(t); f.controller.update({ home: home() }); f.controller.update({ presence: { visible: true } }); f.controller.update({ task: task() });
  assert.equal(f.controller.task.status, 'pending'); assert.equal(f.calls.length, 0);
  await flush(); assert.equal(f.behaviors.length, 1); assert.equal(f.positions.length, 0); assert.equal(f.controller.state.phase, 'working');
  f.doneBehavior(); await flush(); assert.equal(f.controller.state.phase, 'pending'); assert.equal(f.controller.task.status, 'pending'); assert.equal(f.reactions.length, 0); assert.equal(f.positions.length, 0);
  f.controller.update({ task: task() }); await flush(); assert.equal(f.behaviors.length, 1);
  f.controller.update({ task: task('next') }); await flush(); assert.equal(f.behaviors.length, 2);
});

test('home alone enters resting and equivalent defaulted declarations do not replay', async t => {
  const f = fixture(t); f.controller.update({ home: home() }); await flush();
  assert.equal(f.controller.state.phase, 'resting'); assert.equal(f.positions.length, 1);
  f.controller.update({ home: { ...home(), positioning: { target: 'viewport', placement: 'bottom-right', gap: 16, offset: { x: 0, y: 0 }, follow: true }, returnOn: ['cancelled', 'success'] } });
  await flush(); assert.equal(f.positions.length, 1);
});

test('success reacts once before returning home and home edits do not interrupt the reaction', async t => {
  const f = fixture(t); f.controller.update({ home: home(), task: task() }); await flush();
  f.controller.update({ task: task('job', 'success') }); await flush();
  assert.equal(f.reactions.length, 1); assert.deepEqual(f.reactions[0].value, { emotion: 'happy', duration: 1000, intensity: 1 }); assert.equal(f.positions.length, 0);
  const cancels = f.calls.filter(call => call.kind === 'cancel').length;
  f.controller.update({ home: home('top-left') }); await flush(); assert.equal(f.calls.filter(call => call.kind === 'cancel').length, cancels);
  f.doneReaction(); await flush(); assert.equal(f.positions.length, 1); assert.equal(f.positions[0].value.placement, 'top-left'); assert.equal(f.controller.state.phase, 'resting');
  f.controller.update({ task: task('job', 'success') }); await flush(); assert.equal(f.reactions.length, 1);
  f.controller.update({ task: task('next', 'success') }); await flush(); assert.equal(f.reactions.length, 2);
});

test('error stays by default, configurable errors return, and cancellation returns without a default reaction', async t => {
  const f = fixture(t); f.controller.update({ home: home(), task: task('job', 'error') }); await flush();
  assert.equal(f.reactions[0].value.emotion, 'sad'); f.doneReaction(); await flush(); assert.equal(f.controller.state.phase, 'settled'); assert.equal(f.positions.length, 0);
  f.controller.update({ home: { ...home(), returnOn: ['error'] } }); await flush(); assert.equal(f.positions.length, 1); assert.equal(f.reactions.length, 1);
  f.controller.update({ task: task('cancelled', 'cancelled'), home: home() }); await flush(); assert.equal(f.positions.length, 2); assert.equal(f.reactions.length, 1); assert.equal(f.controller.state.phase, 'resting');
});

test('pending home edits preserve work, and explicit terminal reactions override defaults', async t => {
  const f = fixture(t); f.controller.update({ home: home(), task: task() }); await flush();
  f.controller.update({ home: home('top-left') }); await flush(); assert.equal(f.behaviors.length, 1); assert.equal(f.calls.some(call => call.kind === 'cancel'), false);
  f.controller.update({ task: { ...task('job', 'cancelled'), reaction: { emotion: 'concerned', duration: 12, intensity: .4 } } }); await flush();
  assert.deepEqual(f.reactions[0].value, { emotion: 'concerned', duration: 12, intensity: .4 }); f.doneReaction(); await flush(); assert.equal(f.positions[0].value.placement, 'top-left');
});

test('hidden presence dominates tasks and home; showing resumes without replaying a seen terminal reaction', async t => {
  const f = fixture(t); f.controller.update({ home: home(), presence: { visible: false }, task: task() }); await flush();
  assert.equal(f.controller.state.phase, 'hidden'); assert.equal(f.behaviors.length, 0); assert.equal(f.positions.length, 0);
  f.controller.update({ presence: { visible: true } }); await flush(); assert.equal(f.behaviors.length, 1);
  f.controller.update({ task: task('job', 'success') }); await flush(); assert.equal(f.reactions.length, 1);
  f.controller.update({ presence: { visible: false } }); await flush(); f.doneReaction(); await flush(); assert.equal(f.positions.length, 0);
  f.controller.update({ presence: { visible: true } }); await flush(); assert.equal(f.reactions.length, 1); assert.equal(f.positions.length, 1); assert.equal(f.controller.state.phase, 'resting');
});

test('an unseen terminal reaction waits while hidden and runs on the next visible declaration', async t => {
  const f = fixture(t); f.controller.update({ presence: { visible: false }, home: home(), task: task() }); await flush();
  f.controller.update({ task: task('job', 'success') }); await flush(); assert.equal(f.reactions.length, 0);
  f.controller.update({ presence: { visible: true } }); await flush(); assert.equal(f.reactions.length, 1); f.doneReaction(); await flush(); assert.equal(f.positions.length, 1);
});

test('replacing work invalidates all stale behavior, reaction, and home continuations', async t => {
  const f = fixture(t, { manualPosition: true }); f.controller.update({ home: home(), task: task('old') }); await flush();
  f.controller.update({ task: task('old', 'success') }); await flush(); f.doneBehavior(0); await flush(); assert.equal(f.controller.state.phase, 'reacting');
  f.controller.update({ task: task('new') }); f.doneReaction(0); await flush(); assert.equal(f.positions.length, 0); assert.equal(f.behaviors.length, 2);
  f.controller.update({ task: task('new', 'cancelled') }); await flush(); assert.equal(f.positions.length, 1);
  f.controller.update({ task: task('newer') }); f.positions[0].resolve({ finished: true, position: { x: 0, y: 0 } }); await flush();
  assert.equal(f.calls.filter(call => call.kind === 'rest').length, 0); assert.equal(f.controller.state.taskId, 'newer'); assert.equal(f.controller.state.phase, 'working');
});

test('home position failure or interruption never applies resting state or moves to an invented origin', async t => {
  const f = fixture(t, { manualPosition: true }); f.controller.update({ home: home() }); await flush();
  f.positions[0].reject(new Error('Home target removed')); await flush(); assert.equal(f.controller.state.phase, 'error'); assert.equal(f.errors[0].message, 'Home target removed'); assert.equal(f.calls.filter(call => call.kind === 'rest').length, 0);
  f.controller.update({ home: home('top-left') }); await flush(); f.positions[1].resolve({ finished: false, position: { x: 123, y: 456 } }); await flush(); assert.equal(f.controller.state.phase, 'settled'); assert.equal(f.calls.filter(call => call.kind === 'rest').length, 0);
});

test('behavior failure reports lifecycle error but preserves the app-authored pending status', async t => {
  const f = fixture(t); f.controller.update({ home: home(), task: task() }); await flush();
  f.doneBehavior(0, 'error', 'Missing behavior target'); await flush(); assert.equal(f.controller.state.phase, 'error'); assert.equal(f.controller.state.taskStatus, 'pending'); assert.equal(f.controller.task.status, 'pending'); assert.equal(f.reactions.length, 0); assert.equal(f.positions.length, 0);
});

test('suspend releases ownership, restores the latest baseline, and equivalent updates stay suspended', async t => {
  const f = fixture(t); f.controller.suspend(); assert.equal(f.calls.length, 0); assert.equal(f.changes.length, 0);
  f.controller.update({ home: home() }); await flush(); f.baseline({ activity: 'listening', emotion: 'happy' }); f.controller.suspend();
  assert.deepEqual(f.presentation(), { activity: 'listening', emotion: 'happy' }); assert.equal(f.controller.state.phase, 'suspended'); const count = f.calls.length;
  f.controller.suspend(); f.controller.update({ home: home() }); await flush(); assert.equal(f.calls.length, count);
  f.controller.update({ home: home('top-left') }); await flush(); assert.equal(f.controller.state.phase, 'resting'); assert.equal(f.positions.length, 2);
});

test('disconnect and reconnect preserve declarations and do not repeat completed terminal reactions', async t => {
  const f = fixture(t); f.connected(false); f.controller.update({ task: task('job', 'success'), home: home() }); await flush(); assert.equal(f.calls.length, 0);
  f.connected(true); f.controller.reconcile(); await flush(); assert.equal(f.reactions.length, 1); f.doneReaction(); await flush();
  f.connected(false); f.controller.suspend('disconnected'); f.connected(true); f.controller.reconcile(); await flush(); assert.equal(f.reactions.length, 1); assert.equal(f.positions.length, 2);
});

test('reentrant change listeners can replace or dispose without starting stale work', async t => {
  let f, replaced = false;
  f = fixture(t, { onChange(state) { if (state.phase === 'working' && !replaced) { replaced = true; f.controller.update({ task: task('replacement') }); } } });
  f.controller.update({ task: task('old') }); await flush(); assert.equal(f.behaviors.length, 1); assert.equal(f.controller.state.taskId, 'replacement');
  const g = fixture(t, { onChange(state) { if (state.phase === 'reacting') g.controller.dispose(); } });
  g.controller.update({ task: task('dispose', 'success'), home: home() }); await flush(); assert.equal(g.reactions.length, 0); assert.equal(g.positions.length, 0);
});

test('reentrant cancellation and rest callbacks cannot overwrite a newer declaration', async t => {
  let f, replace = false;
  f = fixture(t, { onCancel(current) { if (replace) { replace = false; f.controller.update({ task: task('newest') }); assert.equal(current(), false); } } });
  f.controller.update({ task: task('first') }); await flush(); replace = true; f.controller.update({ task: task('second') }); await flush(); assert.equal(f.controller.state.taskId, 'newest'); assert.equal(f.behaviors.length, 2);
  const g = fixture(t, { onRest() { g.controller.update({ task: task('interrupt-rest') }); } });
  g.controller.update({ home: home() }); await flush(); assert.equal(g.controller.state.phase, 'working'); assert.equal(g.changes.some(state => state.phase === 'resting'), false);
});

test('dispose before a queued update or during presence prevents every late operation', async t => {
  const f = fixture(t); f.controller.update({ task: task() }); f.controller.dispose(); await flush(); assert.equal(f.behaviors.length, 0);
  const g = fixture(t, { manualPresence: true }); g.controller.update({ presence: { visible: true }, task: task() }); await flush(); assert.equal(g.presences.length, 1);
  g.controller.dispose(); g.presences[0].resolve(); await flush(); assert.equal(g.behaviors.length, 0); g.controller.reconcile(); await flush(); assert.equal(g.presences.length, 1);
});

test('persistent host failures cancel temporary rest and keep task status authoritative', async t => {
  const f = fixture(t); f.controller.update({ home: home(), task: task('done', 'cancelled') }); await flush();
  f.baseline({ activity: 'speaking', emotion: 'happy' }); f.controller.reportError(new Error('Rest gaze target removed'));
  assert.equal(f.controller.state.phase, 'error'); assert.equal(f.controller.state.taskStatus, 'cancelled'); assert.deepEqual(f.presentation(), { activity: 'speaking', emotion: 'happy' });
  assert.equal(f.errors.length, 1); assert.equal(f.errors[0].phase, 'resting');
  f.controller.reportError('repeat'); assert.equal(f.errors.length, 1);
  f.controller.update({ task: task('next') }); await flush(); f.controller.suspend(); f.controller.reportError('stale callback'); assert.equal(f.errors.length, 1);
});

test('an error cancellation callback can replace work without publishing a stale error', async t => {
  let f, replace = false;
  f = fixture(t, { onCancel() { if (replace) { replace = false; f.controller.update({ task: task('replacement') }); } } });
  f.controller.update({ home: home() }); await flush(); replace = true; f.controller.reportError(new Error('Old target lost')); await flush();
  assert.equal(f.controller.state.phase, 'working'); assert.equal(f.controller.state.taskId, 'replacement'); assert.equal(f.errors.length, 0);
});

test('hidden task edits update metadata immediately without replaying presence or starting work', async t => {
  const f = fixture(t); f.controller.update({ presence: { visible: false }, task: task('old') }); await flush();
  f.controller.update({ task: task('new', 'success') }); await flush();
  assert.deepEqual(f.controller.state, { phase: 'hidden', taskId: 'new', taskStatus: 'success' }); assert.equal(f.presences.length, 1); assert.equal(f.behaviors.length, 0); assert.equal(f.reactions.length, 0);
});

test('equivalent defaulted behavior updates and changed reaction options do not replay pending work', async t => {
  const f = fixture(t); f.controller.update({ task: { id: 'defaulted', status: 'pending', behavior: { type: 'wait', target: '#target' } } }); await flush();
  f.controller.update({ task: { id: 'defaulted', status: 'pending', behavior: { type: 'wait', target: '#target', side: 'right', gap: 16, timeout: 5000 }, reaction: { emotion: 'happy', duration: 200 } } });
  await flush(); assert.equal(f.behaviors.length, 1); assert.equal(f.calls.filter(call => call.kind === 'cancel').length, 0);
});

test('a queued hidden replacement batches later task updates without starting the intermediate task', async t => {
  const f = fixture(t); f.controller.update({ presence: { visible: true }, task: task('first') }); await flush();
  f.controller.update({ presence: { visible: false } }); f.controller.update({ task: task('second') }); await flush();
  assert.equal(f.controller.state.phase, 'hidden'); assert.equal(f.controller.state.taskId, 'second'); assert.equal(f.behaviors.length, 1);
});

test('manual commands in replacement cancellation callbacks invalidate stale home return', async t => {
  let f, interrupt = false, cancellations = 0;
  f = fixture(t, { onCancel(current) { cancellations++; if (interrupt) { interrupt = false; f.controller.suspend('manual-command'); assert.equal(current(), false); } } });
  f.controller.update({ task: task(), home: home() }); await flush(); interrupt = true;
  f.controller.update({ task: task('job', 'cancelled') }); await flush();
  assert.equal(f.controller.state.phase, 'suspended'); assert.equal(f.positions.length, 0); assert.equal(cancellations, 1);
  f.doneBehavior(); await flush(); assert.equal(f.positions.length, 0);
});

test('manual commands during error, suspend, and dispose cleanup stop stale cancellation without recursion', async t => {
  for (const action of ['error', 'suspend', 'dispose']) {
    let f, interrupt = false, cancellations = 0;
    f = fixture(t, { onCancel(current) { cancellations++; if (interrupt) { interrupt = false; f.controller.suspend('callback-manual-command'); assert.equal(current(), false); } } });
    f.controller.update({ home: home() }); await flush(); interrupt = true;
    if (action === 'error') f.controller.reportError(new Error('lost target'));
    if (action === 'suspend') f.controller.suspend('outer-manual-command');
    if (action === 'dispose') f.controller.dispose();
    await flush(); assert.equal(cancellations, 1); assert.equal(f.errors.length, 0); assert.equal(f.positions.length, 1);
  }
});

test('reconciliation inside cancellation waits for cleanup and remains interruptible', async t => {
  let f, reconcile = false, cancellations = 0;
  f = fixture(t, { onCancel(current) { cancellations++; if (reconcile) { reconcile = false; f.controller.reconcile(); assert.equal(current(), false); f.controller.suspend('manual-command'); } } });
  f.controller.update({ task: task(), home: home() }); await flush(); reconcile = true;
  f.controller.update({ task: task('job', 'cancelled') }); await flush();
  assert.equal(cancellations, 1); assert.equal(f.positions.length, 0); assert.equal(f.controller.state.phase, 'suspended');
});


test('partially interrupted cleanup is completed before a reentrant declaration starts', async t => {
  let f, replace = false;
  f = fixture(t, { cleanupAfterCallback: true, onCancel(current) {
    if (replace) { replace = false; f.controller.update({ task: task('newest') }); assert.equal(current(), false); }
  } });
  f.controller.update({ home: home() }); await flush();
  f.baseline({ activity: 'speaking', emotion: 'excited' }); replace = true;
  f.controller.update({ task: task('intermediate') }); await flush();
  assert.deepEqual(f.presentation(), { activity: 'speaking', emotion: 'excited' });
  assert.equal(f.controller.state.taskId, 'newest'); assert.equal(f.behaviors.length, 1);
  assert.equal(f.calls.filter(call => call.kind === 'cancel').length, 2);
});
