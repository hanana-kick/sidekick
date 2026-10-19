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


test('manual command during old lifecycle behavior cancellation wins', async t => {
  const f = fixture(t), { avatar } = f;
  await startWork(f);
  let ran = false;
  avatar.addEventListener('sidekick-behavior-end', event => {
    if (!ran && event.detail.status === 'cancelled') {
      ran = true;
      void avatar.moveTo({ x: 400, y: 300 }, { duration: 0 });
    }
  });
  avatar.task = { ...f.task('request-1'), status: 'cancelled' };
  await drain();
  assert.equal(avatar.lifecycleState.phase, 'suspended');
  assert.deepEqual(avatar.position, { x: 400, y: 300 });
});

test('clearing pending hidden presence before readiness restores visibility', async t => {
  const f = fixture(t, { connect: false }), { avatar } = f;
  avatar.presence = { visible: false };
  avatar.presence = null;
  dom.window.document.body.append(avatar);
  await drain();
  assert.notEqual(avatar.style.getPropertyValue('--sidekick-visibility'), 'hidden');
});

test('partial authored changes during rest preserve untouched authored channels', async t => {
  const f = fixture(t), { avatar } = f;
  avatar.setEmotion('excited', { intensity: .8 });
  avatar.bodyOrientation = { yaw: 5, pitch: 2, roll: -3 };
  avatar.home = { positioning: f.home().positioning, rest: { emotion: 'curious', emotionIntensity: .4, bodyOrientation: { yaw: 60, pitch: 30, roll: 10 } } };
  await until(() => avatar.lifecycleState.phase === 'resting', 'rest');
  avatar.setBodyOrientation({ yaw: 12 });
  assert.deepEqual(avatar.bodyOrientation, { yaw: 12, pitch: 2, roll: -3 });
});

test('intensity-only authored change during rest does not adopt temporary rest emotion', async t => {
  const f = fixture(t), { avatar } = f;
  avatar.setEmotion('excited', { intensity: .8 });
  avatar.home = { positioning: f.home().positioning, rest: { emotion: 'curious', emotionIntensity: .4 } };
  await until(() => avatar.lifecycleState.phase === 'resting', 'rest');
  avatar.emotionIntensity = .7;
  assert.equal(avatar.emotion, 'excited');
  assert.equal(avatar.emotionIntensity, .7);
});

test('entrance target loss does not launch pending task at an interrupted location', async t => {
  const f = fixture(t, { immediate: false }), { avatar } = f;
  avatar.presence = { visible: true, entrance: { source: 'element', target: f.workTarget, direction: 'right' } };
  avatar.task = { id: 'after-entry', status: 'pending', behavior: { type: 'idle' } };
  await until(() => avatar.presenceState === 'entering', 'entrance');
  await advance(80);
  f.workTarget.remove(); dom.window.document.dispatchEvent(new dom.window.Event('scroll'));
  await advance(500);
  assert.equal(avatar.lifecycleState.phase, 'error');
  assert.notEqual(avatar.behaviorState.status, 'acting');
});

test('replacing task from rest cancellation restores old temporary baseline', async t => {
  const f = fixture(t), { avatar } = f;
  avatar.setEmotion('excited', { intensity: .8 });
  avatar.trackingMode = 'off';
  avatar.home = f.home();
  await until(() => avatar.lifecycleState.phase === 'resting', 'rest');
  let ran = false;
  avatar.addEventListener('sidekick-behavior-end', event => {
    if (!ran && event.detail.status === 'cancelled') {
      ran = true; avatar.task = f.task('reentrant-work');
    }
  });
  avatar.task = f.task('initial-work');
  await until(() => avatar.lifecycleState.taskId === 'reentrant-work' && avatar.behaviorState.status === 'acting', 'reentrant work');
  assert.equal(avatar.emotion, 'excited');
  assert.equal(avatar.emotionIntensity, .8);
});
