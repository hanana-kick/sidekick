import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

let dom, now = 0, nextHandle = 0;
const frames = new Map(), timers = new Map(), originals = new Map();
const drain = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

before(async () => {
  dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true, url: 'https://lifecycle.test/' });
  const request = callback => { const id = ++nextHandle; frames.set(id, callback); return id; };
  const schedule = (callback, delay = 0, ...args) => { const id = ++nextHandle; timers.set(id, { due: now + delay, callback: () => callback(...args) }); return id; };
  for (const [key, value] of Object.entries({
    HTMLElement: dom.window.HTMLElement, CustomEvent: dom.window.CustomEvent,
    requestAnimationFrame: request, cancelAnimationFrame: id => frames.delete(id),
    setTimeout: schedule, clearTimeout: id => timers.delete(id), performance: { now: () => now },
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  Object.assign(dom.window, { requestAnimationFrame: request, cancelAnimationFrame: id => frames.delete(id), setTimeout: schedule, clearTimeout: id => timers.delete(id) });
  Object.defineProperty(dom.window.performance, 'now', { value: () => now, configurable: true });
  const { SidekickAvatar } = await import('../src/element/avatar.ts');
  // Only renderer startup is omitted. Declarations, lifecycle orchestration,
  // emotion/behavior controllers, geometry, movement, observers and teardown are real.
  class LifecycleTestAvatar extends SidekickAvatar {
    connectedCallback() {
      this.connected = true;
      this.readyState = true;
      this.lifecycleController.reconcile();
    }
  }
  dom.window.customElements.define('lifecycle-test-avatar', LifecycleTestAvatar);
});

after(() => {
  dom.window.document.body.replaceChildren();
  dom.window.close();
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
});

async function advance(milliseconds) {
  const end = now + milliseconds;
  do {
    now = Math.min(end, now + 1000 / 60);
    for (const [id, callback] of [...frames]) if (frames.delete(id)) callback(now);
    for (const [id, timer] of [...timers]) if (timer.due <= now && timers.delete(id)) timer.callback();
    await drain();
  } while (now < end);
}

async function until(predicate, description, timeout = 12000) {
  for (let elapsed = 0; elapsed <= timeout; elapsed += 1000 / 60) {
    await drain();
    if (predicate()) return;
    await advance(1000 / 60);
  }
  assert.fail(`Timed out waiting for ${description}`);
}

function fixture(t, { immediate = true, connect = true } = {}) {
  const document = dom.window.document;
  const avatar = document.createElement('lifecycle-test-avatar');
  avatar.canvas = document.createElement('canvas');
  avatar.attachShadow({ mode: 'open' }).append(avatar.canvas);
  avatar.placementState = 'viewport';
  avatar.movementBox = { width: 80, height: 80 };
  avatar.pausedState = immediate;
  const rectangle = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height, x: left, y: top, width, height });
  avatar.getBoundingClientRect = () => rectangle(avatar.position.x, avatar.position.y, 80, 80);
  avatar.getClientRects = () => [avatar.getBoundingClientRect()];
  const homeTarget = document.createElement('div'), workTarget = document.createElement('div');
  homeTarget.id = 'home'; workTarget.id = 'work';
  const homeBox = { x: 100, y: 550, width: 160, height: 80 };
  const workBox = { x: 650, y: 180, width: 180, height: 100 };
  for (const [target, box] of [[homeTarget, homeBox], [workTarget, workBox]]) {
    target.getBoundingClientRect = () => rectangle(box.x, box.y, box.width, box.height);
    target.getClientRects = () => target.isConnected ? [target.getBoundingClientRect()] : [];
  }
  document.body.append(homeTarget, workTarget);
  const events = [], errors = [], reactions = [];
  avatar.addEventListener('sidekick-lifecycle-change', event => events.push(event.detail));
  avatar.addEventListener('sidekick-error', event => errors.push(event.detail));
  avatar.addEventListener('sidekick-reaction-end', event => reactions.push(event.detail));
  if (connect) document.body.append(avatar);
  t.after(async () => {
    avatar.remove(); homeTarget.remove(); workTarget.remove();
    await drain();
    assert.equal(frames.size, 0, 'disconnect releases every frame');
    assert.equal(timers.size, 0, 'disconnect releases reaction, behavior and anchor timers');
  });
  const home = () => ({ positioning: { target: homeTarget, placement: 'top-center', gap: 20 }, rest: { behavior: { type: 'idle' }, emotion: 'curious', emotionIntensity: .4, trackingMode: 'eyes' } });
  const task = id => ({ id, status: 'pending', behavior: { type: 'wait', target: workTarget, side: 'left', gap: 20 } });
  return { avatar, homeTarget, workTarget, homeBox, workBox, events, errors, reactions, home, task };
}

async function startWork(f, id = 'request-1') {
  f.avatar.home = f.home();
  await until(() => f.avatar.lifecycleState.phase === 'resting', 'initial home rest');
  f.avatar.task = f.task(id);
  await until(() => f.avatar.behaviorState.status === 'acting', 'working at target');
}

test('home wait → explicit app success → default reaction → return restores home rest', async t => {
  const f = fixture(t), { avatar } = f;
  await startWork(f);
  const workPosition = avatar.position;
  assert.equal(avatar.task.status, 'pending');
  assert.equal(avatar.lifecycleState.taskId, 'request-1');
  await advance(2500);
  assert.equal(avatar.task.status, 'pending', 'a waiting animation cannot complete an application task');
  assert.deepEqual(avatar.position, workPosition);
  avatar.task = { ...f.task('request-1'), status: 'success' };
  await until(() => avatar.lifecycleState.phase === 'reacting', 'success reaction');
  assert.equal(avatar.emotionState.emotion, 'happy');
  assert.equal(avatar.emotionState.reacting, true);
  await advance(999);
  assert.equal(avatar.lifecycleState.phase, 'reacting', 'default success reaction lasts 1000 ms');
  await advance(2);
  await until(() => avatar.lifecycleState.phase === 'resting', 'return and rest');
  assert.deepEqual(avatar.position, { x: 140, y: 450 });
  assert.equal(avatar.behavior.type, 'idle');
  assert.equal(avatar.emotion, 'curious');
  assert.equal(avatar.emotionIntensity, .4);
  assert.equal(avatar.trackingMode, 'eyes');
  assert.deepEqual(f.reactions.map(result => [result.emotion, result.finished]), [['happy', true]]);
  assert.equal(avatar.task.status, 'success');
  assert.deepEqual(f.errors, []);
});

test('finite behavior completion remains pending until the application supplies a terminal status', async t => {
  const f = fixture(t), { avatar } = f;
  avatar.home = f.home(); await until(() => avatar.lifecycleState.phase === 'resting', 'home');
  avatar.task = { id: 1, status: 'pending', behavior: { type: 'guide', target: f.workTarget, duration: 20 } };
  await advance(21); await until(() => avatar.lifecycleState.phase === 'pending', 'behavior completion');
  const before = avatar.position;
  await advance(5000);
  assert.equal(avatar.lifecycleState.phase, 'pending');
  assert.equal(avatar.task.status, 'pending');
  assert.deepEqual(avatar.position, before);
  assert.equal(f.events.some(state => state.taskStatus === 'success'), false);
});

test('equal and mutated declarations are copied, idempotent, and task identity can replay work', async t => {
  const f = fixture(t), { avatar } = f;
  await startWork(f);
  const before = avatar.behaviorState.id, count = f.events.length;
  avatar.task = { behavior: { gap: 20, side: 'left', target: f.workTarget, type: 'wait' }, status: 'pending', id: 'request-1' };
  avatar.home = f.home();
  await drain();
  assert.equal(avatar.behaviorState.id, before);
  assert.equal(f.events.length, count);
  const snapshot = avatar.task; snapshot.behavior.gap = 900; snapshot.status = 'success';
  const homeSnapshot = avatar.home; homeSnapshot.rest.emotion = 'sad'; homeSnapshot.positioning.gap = 100;
  assert.equal(avatar.task.status, 'pending'); assert.equal(avatar.task.behavior.gap, 20);
  assert.equal(avatar.home.rest.emotion, 'curious'); assert.equal(avatar.home.positioning.gap, 20);
  avatar.task = { ...f.task('request-2') };
  await until(() => avatar.behaviorState.status === 'acting', 'replacement task');
  assert.ok(avatar.behaviorState.id > before);
  assert.equal(avatar.lifecycleState.taskId, 'request-2');
});

test('error stays at the task by default; cancelled returns without a reaction', async t => {
  const f = fixture(t), { avatar } = f;
  await startWork(f);
  const work = avatar.position;
  avatar.task = { ...f.task('request-1'), status: 'error' };
  await until(() => avatar.lifecycleState.phase === 'reacting', 'error reaction');
  assert.equal(avatar.emotionState.emotion, 'sad');
  await advance(1001); await until(() => avatar.lifecycleState.phase === 'settled', 'error settlement');
  assert.deepEqual(avatar.position, work);
  assert.equal(avatar.lifecycleState.taskStatus, 'error');
  avatar.task = f.task('cancelled-2'); await until(() => avatar.behaviorState.status === 'acting', 'next task');
  const reactions = f.reactions.length;
  avatar.task = { ...f.task('cancelled-2'), status: 'cancelled' };
  await until(() => avatar.lifecycleState.phase === 'resting', 'cancelled return');
  assert.equal(f.reactions.length, reactions);
  assert.deepEqual(avatar.position, { x: 140, y: 450 });
});

test('returnOn explicitly enables error return with a custom reaction', async t => {
  const f = fixture(t), { avatar } = f;
  avatar.home = { ...f.home(), returnOn: ['error'] };
  await until(() => avatar.lifecycleState.phase === 'resting', 'home');
  avatar.task = f.task('retry'); await until(() => avatar.behaviorState.status === 'acting', 'work');
  avatar.task = { ...f.task('retry'), status: 'error', reaction: { emotion: 'concerned', duration: 50, intensity: .7 } };
  await until(() => avatar.lifecycleState.phase === 'reacting', 'custom reaction');
  assert.equal(avatar.emotionState.emotion, 'concerned'); assert.equal(avatar.emotionState.intensity, .7);
  await advance(51); await until(() => avatar.lifecycleState.phase === 'resting', 'configured error return');
  assert.equal(avatar.lifecycleState.taskStatus, 'error');
});

test('new task interrupts an inertial return without resetting position or velocity', async t => {
  const f = fixture(t), { avatar } = f;
  await startWork(f);
  avatar.pausedState = false;
  avatar.task = { ...f.task('request-1'), status: 'cancelled' };
  await until(() => avatar.lifecycleState.phase === 'returning', 'inertial return');
  await advance(160);
  const before = avatar.movementState;
  assert.ok(before.speed > 0);
  avatar.task = f.task('interrupt-return');
  await drain();
  const after = avatar.movementState;
  assert.deepEqual(after.position, before.position, 'replacement starts at the current physical point');
  assert.deepEqual(after.velocity, before.velocity, 'replacement inherits current velocity');
  await until(() => avatar.behaviorState.status === 'acting', 'replacement destination');
  assert.equal(avatar.lifecycleState.taskId, 'interrupt-return');
  assert.equal(avatar.task.status, 'pending');
  assert.equal(avatar.emotionState.reacting, false);
});

test('hidden presence wins over pending work and reveals only the latest task', async t => {
  const f = fixture(t), { avatar } = f;
  await startWork(f);
  avatar.presence = { visible: false, exit: { to: 'left', duration: 0 } };
  await until(() => avatar.lifecycleState.phase === 'hidden', 'declarative exit');
  assert.equal(avatar.presenceState, 'hidden');
  assert.equal(avatar.style.getPropertyValue('--sidekick-visibility'), 'hidden');
  avatar.task = f.task('queued-while-hidden');
  await advance(1500);
  assert.equal(avatar.lifecycleState.phase, 'hidden');
  assert.notEqual(avatar.behaviorState.status, 'acting');
  avatar.presence = { visible: true };
  await until(() => avatar.behaviorState.status === 'acting', 'latest task after reveal');
  assert.equal(avatar.lifecycleState.taskId, 'queued-while-hidden');
  assert.equal(avatar.presenceState, 'visible');
});

test('home follows a moving anchor and target removal reports once without teleporting', async t => {
  const f = fixture(t), { avatar } = f;
  avatar.home = f.home(); await until(() => avatar.lifecycleState.phase === 'resting', 'home');
  f.homeBox.x += 80; dom.window.document.dispatchEvent(new dom.window.Event('scroll'));
  await advance(32);
  assert.deepEqual(avatar.position, { x: 220, y: 450 });
  const safePosition = avatar.position;
  f.homeTarget.remove(); dom.window.document.dispatchEvent(new dom.window.Event('scroll'));
  await advance(300);
  assert.deepEqual(avatar.position, safePosition);
  assert.equal(f.errors.length, 1);
  assert.equal(avatar.lifecycleState.phase, 'error');
  assert.match(f.errors[0].message, /target|disconnect|removed/i);
  await advance(1000); assert.equal(f.errors.length, 1);
});

test('invalid lifecycle assignment is atomic and cannot cancel current behavior', async t => {
  const f = fixture(t), { avatar } = f;
  await startWork(f);
  const before = avatar.behaviorState.id;
  let getterCalls = 0;
  for (const assign of [
    () => { avatar.task = { id: 'x', status: 'done' }; },
    () => { avatar.task = { status: 'pending' }; },
    () => { avatar.task = { id: 'x', status: 'success', reaction: { emotion: 'happy', duration: -1 } }; },
    () => { avatar.presence = { visible: 'false' }; },
    () => { avatar.home = { positioning: { target: f.homeTarget }, rest: { behavior: { type: 'wait', target: f.workTarget } } }; },
    () => { avatar.home = { positioning: { target: f.homeTarget }, returnOn: ['pending'] }; },
    () => { avatar.task = { id: 'x', get status() { getterCalls++; return 'pending'; } }; },
  ]) assert.throws(assign);
  assert.equal(getterCalls, 0);
  assert.equal(avatar.behaviorState.id, before);
  assert.equal(avatar.task.id, 'request-1');
  assert.equal(avatar.behaviorState.status, 'acting');
});

test('manual authored updates survive future task/rest ownership and clearing declarations', async t => {
  const f = fixture(t), { avatar } = f;
  avatar.setActivity('still'); avatar.trackingMode = 'eyes-and-body';
  avatar.setEmotion('neutral', { intensity: .6 }); avatar.bodyOrientation = { yaw: 5, pitch: 2, roll: -3 };
  await startWork(f);
  avatar.setActivity('speaking');
  avatar.trackingMode = 'off';
  avatar.setEmotion('excited', { intensity: .8 });
  avatar.bodyOrientation = { yaw: 12, pitch: 4, roll: -5 };
  avatar.lookAt({ space: 'view', x: .2, y: -.3 });
  avatar.task = f.task('latest-baseline'); await until(() => avatar.behaviorState.status === 'acting', 'new work');
  avatar.task = { ...f.task('latest-baseline'), status: 'cancelled' };
  await until(() => avatar.lifecycleState.phase === 'resting', 'new rest');
  avatar.home = null; avatar.task = null; avatar.presence = null;
  await drain();
  assert.equal(avatar.activity, 'speaking'); assert.equal(avatar.trackingMode, 'off');
  assert.equal(avatar.emotion, 'excited'); assert.equal(avatar.emotionIntensity, .8);
  assert.deepEqual(avatar.bodyOrientation, { yaw: 12, pitch: 4, roll: -5 });
  assert.deepEqual(avatar.manualGaze, [.2, -.3]);
});

test('synchronous lifecycle listeners can replace a returning task without stale restoration', async t => {
  const f = fixture(t), { avatar } = f;
  await startWork(f);
  let replaced = false;
  avatar.addEventListener('sidekick-lifecycle-change', event => {
    if (event.detail.phase === 'returning' && !replaced) {
      replaced = true;
      avatar.task = f.task('from-listener');
    }
  });
  avatar.task = { ...f.task('request-1'), status: 'cancelled' };
  await until(() => avatar.lifecycleState.taskId === 'from-listener' && avatar.behaviorState.status === 'acting', 'reentrant replacement');
  await advance(2000);
  assert.equal(avatar.lifecycleState.taskId, 'from-listener');
  assert.equal(avatar.task.status, 'pending');
  assert.deepEqual(avatar.position, { x: 550, y: 190 });
});

test('disconnect during a reaction cancels timers and stale completion cannot restart movement', async t => {
  const f = fixture(t), { avatar } = f;
  await startWork(f);
  avatar.task = { ...f.task('request-1'), status: 'success' };
  await until(() => avatar.emotionState.reacting, 'reaction');
  avatar.remove(); await drain();
  const point = avatar.position, count = f.events.length;
  assert.equal(avatar.lifecycleState.phase, 'suspended');
  assert.equal(avatar.emotionState.reacting, false);
  assert.equal(frames.size, 0); assert.equal(timers.size, 0);
  await advance(3000);
  assert.deepEqual(avatar.position, point);
  assert.equal(f.events.length, count);
  assert.equal(f.reactions.length, 1); assert.equal(f.reactions[0].finished, false);
});

test('declarations staged before connection apply together and hidden presence prevents a startup excursion', async t => {
  const f = fixture(t, { connect: false }), { avatar } = f;
  avatar.home = f.home(); avatar.task = f.task('preconnected'); avatar.presence = { visible: false };
  await drain();
  assert.deepEqual(avatar.position, { x: 0, y: 0 });
  assert.equal(avatar.style.getPropertyValue('--sidekick-visibility'), 'hidden');
  assert.notEqual(avatar.behaviorState.status, 'acting');
  dom.window.document.body.append(avatar);
  await until(() => avatar.lifecycleState.phase === 'hidden', 'hidden startup');
  assert.equal(avatar.task.id, 'preconnected');
  assert.equal(f.events.some(state => state.phase === 'working' || state.phase === 'returning'), false);
  avatar.presence = { visible: true, entrance: { source: 'viewport', edge: 'left' } };
  await until(() => avatar.behaviorState.status === 'acting', 'staged task after entrance');
  assert.equal(avatar.lifecycleState.taskId, 'preconnected');
  assert.deepEqual(f.errors, []);
});

test('removing a working target preserves its safe position and reports an error without changing app status', async t => {
  const f = fixture(t), { avatar } = f;
  await startWork(f);
  const point = avatar.position;
  f.workTarget.remove(); dom.window.document.dispatchEvent(new dom.window.Event('scroll'));
  await until(() => avatar.lifecycleState.phase === 'error', 'lost work target');
  assert.equal(avatar.task.status, 'pending', 'runtime failure must not invent an application status');
  assert.deepEqual(avatar.position, point);
  assert.equal(f.errors.length, 1); assert.match(f.errors[0].message, /target.*removed/i);
  assert.equal(avatar.elementAnchor, null);
  await advance(3000); assert.equal(f.errors.length, 1); assert.deepEqual(avatar.position, point);
});

test('home target selectors do not silently bind a replacement element with the same id', async t => {
  const f = fixture(t), { avatar } = f;
  avatar.home = { ...f.home(), positioning: { target: '#home', placement: 'top-center', gap: 20 } };
  await until(() => avatar.lifecycleState.phase === 'resting', 'selector home');
  const point = avatar.position;
  const replacement = dom.window.document.createElement('div'); replacement.id = 'home';
  replacement.getBoundingClientRect = () => ({ left: 700, top: 400, width: 160, height: 80 });
  replacement.getClientRects = () => [replacement.getBoundingClientRect()];
  f.homeTarget.replaceWith(replacement); t.after(() => replacement.remove());
  dom.window.document.dispatchEvent(new dom.window.Event('scroll'));
  await advance(400);
  assert.deepEqual(avatar.position, point);
  assert.equal(f.errors.length, 1); assert.equal(avatar.positioning, null);
  assert.equal(avatar.lifecycleState.phase, 'error');
});

test('rest can watch another element without leaving home, including after finite rest behavior ends', async t => {
  const f = fixture(t), { avatar } = f;
  avatar.home = { positioning: f.home().positioning, rest: { behavior: { type: 'celebrate', duration: 30 }, trackingMode: 'eyes-and-body', gaze: { target: f.workTarget }, emotion: 'happy' } };
  await until(() => avatar.lifecycleState.phase === 'resting', 'watching rest');
  const point = avatar.position;
  await advance(50);
  assert.equal(avatar.behaviorState.status, 'completed');
  assert.equal(avatar.trackingMode, 'off', 'target gaze owns attention');
  assert.ok(avatar.bodyOrientation.yaw > 0);
  assert.deepEqual(avatar.position, point);
  f.homeBox.x += 50; dom.window.document.dispatchEvent(new dom.window.Event('scroll')); await advance(32);
  assert.deepEqual(avatar.position, { x: point.x + 50, y: point.y }, 'finite rest completion retains home follow');
  f.workBox.x = 10; dom.window.document.dispatchEvent(new dom.window.Event('scroll')); await advance(32);
  assert.ok(avatar.bodyOrientation.yaw < 0);
  assert.deepEqual(avatar.position, { x: point.x + 50, y: point.y });
});

test('edits to home during a terminal reaction take effect without replaying or shortening that reaction', async t => {
  const f = fixture(t), { avatar } = f;
  await startWork(f);
  avatar.task = { ...f.task('request-1'), status: 'success' };
  await until(() => avatar.lifecycleState.phase === 'reacting', 'reaction');
  await advance(500);
  avatar.home = { positioning: { target: 'viewport', placement: 'bottom-left', gap: 30 }, rest: { emotion: 'neutral', trackingMode: 'off' } };
  await drain();
  assert.equal(avatar.lifecycleState.phase, 'reacting');
  assert.equal(f.reactions.length, 0);
  await advance(501); await until(() => avatar.lifecycleState.phase === 'resting', 'updated home');
  assert.deepEqual(avatar.position, { x: 30, y: dom.window.innerHeight - 110 });
  assert.equal(avatar.emotion, 'neutral'); assert.equal(f.reactions.length, 1);
});

test('JSON lifecycle attributes validate as one transaction before replacing an active task', async t => {
  const f = fixture(t), { avatar } = f;
  await startWork(f);
  const before = avatar.behaviorState.id;
  avatar.setAttribute('task', JSON.stringify({ id: 'invalid-batch', status: 'done' }));
  avatar.setAttribute('home', JSON.stringify({ positioning: { target: 'viewport', placement: 'top-left' } }));
  await drain();
  assert.equal(avatar.task.id, 'request-1');
  assert.equal(avatar.home.positioning.target, f.homeTarget);
  assert.equal(avatar.behaviorState.id, before);
  assert.equal(f.errors.length, 1);
  avatar.setAttribute('task', JSON.stringify({ id: 'attribute-task', status: 'pending', behavior: { type: 'wait', target: '#work', side: 'left', gap: 20 } }));
  await until(() => avatar.lifecycleState.taskId === 'attribute-task' && avatar.behaviorState.status === 'acting', 'corrected attribute task');
  avatar.setAttribute('presence', JSON.stringify({ visible: false }));
  await until(() => avatar.lifecycleState.phase === 'hidden', 'attribute presence');
  avatar.setAttribute('presence', 'null'); avatar.setAttribute('task', 'null'); avatar.setAttribute('home', 'null');
  await drain();
  assert.equal(avatar.presence, null); assert.equal(avatar.task, null); assert.equal(avatar.home, null);
});

test('same-object task edits are captured and equal terminal declarations never replay reactions', async t => {
  const f = fixture(t), { avatar } = f;
  const task = f.task('mutable');
  avatar.home = f.home(); avatar.task = task;
  await until(() => avatar.behaviorState.status === 'acting', 'mutable task');
  task.status = 'success'; task.reaction = { emotion: 'excited', duration: 30 };
  assert.equal(avatar.task.status, 'pending', 'caller mutation alone cannot alter stored declarations');
  avatar.task = task;
  await until(() => avatar.lifecycleState.phase === 'reacting', 'mutated terminal task');
  await advance(31); await until(() => avatar.lifecycleState.phase === 'resting', 'first completion');
  const events = f.events.length;
  avatar.task = { ...task, reaction: { duration: 30, emotion: 'excited' } };
  await advance(2000);
  assert.equal(f.events.length, events); assert.equal(f.reactions.length, 1);
  avatar.task = { ...task, id: 'new-terminal' };
  await until(() => avatar.lifecycleState.phase === 'reacting', 'new task identity');
  await advance(31); await until(() => avatar.lifecycleState.phase === 'resting', 'new identity completion');
  assert.equal(f.reactions.length, 2);
});

test('valid manual motion suspends lifecycle while invalid motion preserves ownership', async t => {
  const f = fixture(t), { avatar } = f;
  await startWork(f);
  assert.throws(() => avatar.moveTo({ x: NaN, y: 0 }));
  assert.equal(avatar.lifecycleState.phase, 'working');
  assert.equal(avatar.behaviorState.status, 'acting');
  avatar.task = { ...f.task('request-1'), status: 'success' };
  await until(() => avatar.lifecycleState.phase === 'reacting', 'reaction to interrupt');
  await avatar.moveTo({ x: 40, y: 70 }, { duration: 0 });
  assert.equal(avatar.lifecycleState.phase, 'suspended');
  await advance(2000);
  assert.deepEqual(avatar.position, { x: 40, y: 70 });
  avatar.task = { ...f.task('request-1'), status: 'success' }; await drain();
  assert.equal(avatar.lifecycleState.phase, 'suspended', 'equal declarations do not reclaim imperative ownership');
  avatar.task = f.task('fresh-after-manual');
  await until(() => avatar.behaviorState.status === 'acting', 'new declared task');
  assert.equal(avatar.lifecycleState.taskId, 'fresh-after-manual');
});

test('disconnect and reconnect reassert the latest declaration without replaying a cancelled reaction', async t => {
  const f = fixture(t), { avatar } = f;
  await startWork(f);
  avatar.task = { ...f.task('request-1'), status: 'success' };
  await until(() => avatar.lifecycleState.phase === 'reacting', 'reaction before detach');
  avatar.remove(); await drain();
  dom.window.document.body.append(avatar);
  await until(() => avatar.lifecycleState.phase === 'resting', 'reconnected home');
  assert.equal(avatar.task.status, 'success');
  assert.equal(f.reactions.length, 1); assert.equal(f.reactions[0].finished, false);
  assert.deepEqual(avatar.position, { x: 140, y: 450 });
});

test('removing a rest gaze target releases partial rest and reports one lifecycle error', async t => {
  const f = fixture(t), { avatar } = f;
  avatar.home = { positioning: f.home().positioning, rest: { behavior: { type: 'idle' }, gaze: { target: f.workTarget } } };
  await until(() => avatar.lifecycleState.phase === 'resting', 'target gaze rest');
  await advance(32);
  const point = avatar.position;
  f.workTarget.remove(); dom.window.document.dispatchEvent(new dom.window.Event('scroll'));
  await until(() => avatar.lifecycleState.phase === 'error', 'lost rest gaze target');
  assert.equal(f.errors.length, 1); assert.match(f.errors[0].message, /gaze target.*removed/i);
  assert.deepEqual(avatar.position, point); assert.notEqual(avatar.behaviorState.status, 'acting');
  await advance(1000); assert.equal(f.errors.length, 1);
});

test('declarative exit reversal preserves position, velocity, acceleration and travel pose', async t => {
  const { avatar } = fixture(t);
  await avatar.moveTo({ x: 300, y: 250 }, { duration: 0 });
  avatar.pausedState = false;
  avatar.presence = { visible: false, exit: { to: 'right' } };
  await drain(); await advance(160);
  const before = avatar.movementState, pose = structuredClone(avatar.travelPresentation);
  assert.ok(before.speed > 0);
  avatar.presence = { visible: true, entrance: { source: 'viewport', edge: 'left' } };
  await drain();
  const after = avatar.movementState;
  assert.deepEqual(after.position, before.position, 'reversal must not stage at the opposite edge');
  assert.deepEqual(after.velocity, before.velocity);
  assert.deepEqual(after.acceleration, before.acceleration);
  assert.deepEqual(avatar.travelPresentation, pose, 'reversal retains the airborne presentation');
  await until(() => avatar.presenceState === 'visible', 'reversed arrival');
});

test('show without entrance returns from a completed explicit exit to the last visible position', async t => {
  const { avatar } = fixture(t);
  const origin = { x: 300, y: 250 };
  await avatar.moveTo(origin, { duration: 0 });
  avatar.presence = { visible: false, exit: { to: 'right', duration: 0 } };
  await until(() => avatar.presenceState === 'hidden', 'completed exit');
  assert.ok(avatar.position.x > dom.window.innerWidth);
  avatar.presence = { visible: true };
  await until(() => avatar.presenceState === 'visible' && avatar.lifecycleState.phase === 'idle', 'unconfigured reentry');
  assert.deepEqual(avatar.position, origin, 'show must restore a usable onscreen position');
});

test('bare hide/show stays in place and repeated visibility remains idempotent', async t => {
  const { avatar } = fixture(t);
  const origin = { x: 300, y: 250 };
  await avatar.moveTo(origin, { duration: 0 });
  avatar.pausedState = false;
  avatar.presence = { visible: false };
  await until(() => avatar.presenceState === 'hidden', 'in-place hide');
  assert.deepEqual(avatar.position, origin);
  avatar.presence = { visible: true };
  await until(() => avatar.presenceState === 'visible' && avatar.lifecycleState.phase === 'idle', 'in-place reveal');
  const events = [];
  avatar.addEventListener('sidekick-enter-end', event => events.push(event.detail));
  avatar.presence = { visible: true };
  await advance(300);
  assert.deepEqual(avatar.position, origin);
  assert.equal(events.length, 0);
});

test('masked declarative reentry does not relocate a still-visible exiting avatar', async t => {
  const { avatar, workTarget } = fixture(t);
  await avatar.moveTo({ x: 300, y: 250 }, { duration: 0 });
  avatar.pausedState = false;
  avatar.presence = { visible: false, exit: { to: 'right' } };
  await drain(); await advance(160);
  const before = avatar.movementState;
  avatar.presence = { visible: true, entrance: { source: 'element', target: workTarget, direction: 'left' } };
  await drain();
  assert.deepEqual(avatar.position, before.position);
  assert.deepEqual(avatar.movementState.velocity, before.velocity);
  assert.notEqual(avatar.canvas.style.clipPath, 'inset(100%)', 'replacement must not flash a fully clipped frame');
  await until(() => avatar.presenceState === 'visible', 'masked reversal');
  assert.equal(avatar.canvas.style.clipPath, '');
});

test('same-visible home edits during arrival retarget without restarting entrance', async t => {
  const f = fixture(t), { avatar } = f;
  avatar.pausedState = false;
  avatar.home = f.home();
  avatar.presence = { visible: true, entrance: { source: 'viewport', edge: 'left' } };
  await drain(); await advance(160);
  const before = avatar.movementState;
  avatar.home = { ...f.home(), positioning: { ...f.home().positioning, gap: 40 } };
  await drain();
  assert.deepEqual(avatar.position, before.position);
  assert.deepEqual(avatar.movementState.velocity, before.velocity);
  await until(() => avatar.lifecycleState.phase === 'resting', 'updated home');
  assert.deepEqual(avatar.position, { x: 140, y: 430 });
});

test('same-visible task replacement during entrance runs only the latest task', async t => {
  const f = fixture(t), { avatar } = f;
  avatar.pausedState = false;
  avatar.task = f.task('old-arrival-task');
  avatar.presence = { visible: true, entrance: { source: 'viewport', edge: 'left' } };
  await drain(); await advance(160);
  const before = avatar.movementState;
  avatar.task = { id: 'latest-arrival-task', status: 'pending', behavior: { type: 'wait', target: f.homeTarget, side: 'right', gap: 20 } };
  await drain();
  assert.deepEqual(avatar.position, before.position);
  assert.deepEqual(avatar.movementState.velocity, before.velocity);
  await until(() => avatar.behaviorState.status === 'acting', 'latest arrival task');
  assert.equal(avatar.lifecycleState.taskId, 'latest-arrival-task');
  assert.equal(avatar.behavior.target, f.homeTarget);
  assert.deepEqual(f.errors, []);
});

test('imperative movement reveals an avatar hidden by a visibility fade', async t => {
  const { avatar } = fixture(t);
  avatar.presence = { visible: false };
  await until(() => avatar.presenceState === 'hidden', 'faded hidden state');
  await avatar.moveTo({ x: 300, y: 250 }, { duration: 0 });
  await advance(300);
  assert.equal(avatar.presenceState, 'visible');
  assert.equal(Number(avatar.canvas.style.opacity || 1), 1, 'manual reveal must release opacity ownership');
});

test('explicit entrance reversing a partial fade retains alpha and position', async t => {
  const { avatar } = fixture(t);
  await avatar.moveTo({ x: 300, y: 250 }, { duration: 0 });
  avatar.pausedState = false;
  avatar.presence = { visible: false };
  await drain(); await advance(70);
  const alpha = Number(avatar.canvas.style.opacity), point = avatar.position;
  assert.ok(alpha > 0 && alpha < 1);
  avatar.presence = { visible: true, entrance: { source: 'viewport', edge: 'left' } };
  await drain();
  assert.deepEqual(avatar.position, point, 'partially visible body must not jump to an edge');
  assert.equal(Number(avatar.canvas.style.opacity || 1), alpha, 'reversal preserves alpha');
  await until(() => avatar.presenceState === 'visible' && avatar.lifecycleState.phase === 'idle', 'entrance after fade reversal');
  assert.equal(Number(avatar.canvas.style.opacity || 1), 1);
});

test('bare show after hiding a masked arrival clears the old entrance mask', async t => {
  const { avatar, workTarget } = fixture(t);
  avatar.pausedState = false;
  avatar.presence = { visible: true, entrance: { source: 'element', target: workTarget, direction: 'left' } };
  await drain(); await advance(160);
  avatar.presence = { visible: false };
  await drain(); await advance(60);
  avatar.presence = { visible: true };
  await until(() => avatar.lifecycleState.phase === 'idle', 'bare show after masked reversal');
  await advance(300);
  assert.equal(avatar.canvas.style.clipPath, '', 'old entrance cannot mask the now-visible avatar');
  assert.equal(Number(avatar.canvas.style.opacity || 1), 1);
});

test('manual move from interrupted entrance completion wins over an older hide fade', async t => {
  const { avatar } = fixture(t);
  avatar.pausedState = false;
  avatar.presence = { visible: true, entrance: { source: 'viewport', edge: 'left' } };
  await drain(); await advance(100);
  let replacement;
  avatar.addEventListener('sidekick-enter-end', event => {
    if (!event.detail.finished && !replacement) replacement = avatar.moveTo({ x: 300, y: 250 }, { duration: 0 });
  });
  avatar.presence = { visible: false };
  await drain();
  assert.ok(replacement);
  await replacement; await advance(500);
  assert.equal(avatar.lifecycleState.phase, 'suspended');
  assert.equal(avatar.presenceState, 'visible', 'stale fade must not hide a manual replacement');
  assert.deepEqual(avatar.position, { x: 300, y: 250 });
  assert.equal(Number(avatar.canvas.style.opacity || 1), 1);
});

test('explicit exit during fade-in remembers the visible return position', async t => {
  const { avatar } = fixture(t);
  const origin = { x: 300, y: 250 };
  await avatar.moveTo(origin, { duration: 0 });
  avatar.presence = { visible: false };
  await until(() => avatar.presenceState === 'hidden', 'initial hidden state');
  avatar.pausedState = false;
  avatar.presence = { visible: true };
  await drain(); await advance(70);
  avatar.presence = { visible: false, exit: { to: 'right' } };
  await until(() => avatar.presenceState === 'hidden', 'explicit exit during fade-in');
  avatar.presence = { visible: true };
  await until(() => avatar.lifecycleState.phase === 'idle' && avatar.presenceState === 'visible', 'return after fade-in exit');
  assert.deepEqual(avatar.position, origin);
  assert.equal(Number(avatar.canvas.style.opacity || 1), 1);
});

test('hiding an arrival before it reaches the viewport does not clamp its position', async t => {
  const { avatar } = fixture(t);
  avatar.pausedState = false;
  avatar.presence = { visible: true, entrance: { source: 'viewport', edge: 'left' } };
  await drain(); await advance(30);
  const before = avatar.position;
  assert.ok(before.x < -60);
  avatar.presence = { visible: false };
  await drain();
  assert.deepEqual(avatar.position, before);
  await advance(1000 / 60);
  assert.ok(Math.abs(avatar.position.x - before.x) < 10, 'visibility change cannot re-enable bounds during braking');
  await until(() => avatar.presenceState === 'hidden', 'hidden interrupted entrance');
});


test('clearing faded presence restores opacity when home takes ownership', async t => {
  const f = fixture(t), { avatar } = f;
  avatar.presence = { visible: false };
  await until(() => avatar.presenceState === 'hidden', 'hidden');
  avatar.presence = null; avatar.home = f.home();
  await until(() => avatar.lifecycleState.phase === 'resting', 'home without presence ownership');
  assert.equal(avatar.presenceState, 'visible');
  assert.equal(Number(avatar.canvas.style.opacity || 1), 1);
});

for (const type of ['wait', 'follow', 'guide', 'review']) for (const immediate of [true, false]) for (const nearEdge of [false, true]) test(`active ${type} behavior reanchors current size without restarting (${immediate ? 'immediate' : 'normal'} motion, ${nearEdge ? 'viewport clamp' : 'center'})`, async t => {
  const { avatar, workTarget, workBox } = fixture(t, { immediate });
  if (nearEdge) { workBox.x = dom.window.innerWidth - 60; workBox.y = dom.window.innerHeight - 60; }
  const rectangle = (x, y, width, height) => ({ x, y, left: x, top: y, width, height, right: x + width, bottom: y + height });
  avatar.getBoundingClientRect = () => rectangle(avatar.position.x, avatar.position.y, avatar.size, avatar.size);
  Object.defineProperty(avatar, 'offsetWidth', { get: () => Math.round(avatar.size) });
  Object.defineProperty(avatar, 'offsetHeight', { get: () => Math.round(avatar.size) });
  avatar.size = 72;
  for (const side of ['left', 'right', 'above', 'below']) {
    avatar.behavior = type === 'review' ? { type, targets: [workTarget], dwell: 100000, side, gap: 16 } : { type, target: workTarget, duration: 100000, side, gap: 16 };
    await until(() => avatar.behaviorState.status === 'acting', `${side} behavior started`);
    const id = avatar.behaviorState.id;
    for (const size of [48, 96, 160.5]) {
      avatar.size = size;
      const target = workTarget.getBoundingClientRect();
      let x = target.left + (target.width - size) / 2, y = target.top + (target.height - size) / 2;
      if (side === 'left') x = target.left - size - 16;
      if (side === 'right') x = target.right + 16;
      if (side === 'above') y = target.top - size - 16;
      if (side === 'below') y = target.bottom + 16;
      x = Math.max(0, Math.min(dom.window.innerWidth - size, x));
      y = Math.max(0, Math.min(dom.window.innerHeight - size, y));
      await until(() => Math.abs(avatar.position.x - x) < 1 && Math.abs(avatar.position.y - y) < 1, `${side} size ${size} anchor`);
      assert.equal(avatar.behaviorState.id, id); assert.equal(avatar.behaviorState.status, 'acting');
      assert.equal(avatar.elementAnchor.target, workTarget);
    }
  }
  avatar.stopBehavior();
});

test('ordinary pixel-offset anchors stay authored after size changes', async t => {
  const { avatar, workTarget } = fixture(t);
  avatar.getBoundingClientRect = () => ({ left: avatar.position.x, top: avatar.position.y, width: avatar.size, height: avatar.size });
  avatar.size = 72;
  await avatar.moveToElement(workTarget, { anchor: true, x: 5, y: 7 });
  for (const size of [48, 96, 160.5]) {
    avatar.size = size; await advance(50);
    assert.equal(avatar.elementAnchor.x, 5); assert.equal(avatar.elementAnchor.y, 7);
    assert.equal(avatar.position.x, workTarget.getBoundingClientRect().left + 5);
    assert.equal(avatar.position.y, workTarget.getBoundingClientRect().top + 7);
  }
});
