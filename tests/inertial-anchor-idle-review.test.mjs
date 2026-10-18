import test from 'node:test';
import assert from 'node:assert/strict';
import { AvatarMovement } from '../src/element/movement.ts';
import { observeElementAnchor } from '../src/element/element-anchor.ts';

function movementFixture() {
  let now = 0, id = 0;
  const frames = new Map(), events = [];
  const movement = new AvatarMovement({
    now: () => now, immediate: () => false, constrain: point => ({ ...point }),
    render() {}, complete: result => { events.push(result); },
    requestFrame: callback => { frames.set(++id, callback); return id; },
    cancelFrame: handle => frames.delete(handle),
  });
  return { movement, frames, events, clock: time => { now = time; },
    frame(time) { now = time; for (const [handle, callback] of [...frames]) { if (frames.delete(handle)) callback(now); } },
  };
}

test('plain anchored motion retains progress across a long visibility suspension', async () => {
  const f = movementFixture();
  const result = f.movement.to({ x: 100, y: 0 }, { travel: 'none', duration: 100, easing: 'linear' });
  f.frame(40);
  f.movement.suspend(true);
  assert.equal(f.frames.size, 0);
  f.clock(10040); f.movement.suspend(false); f.frame(10040);
  assert.equal(f.movement.position.x, 40, 'restoration must not rewind the displayed position');
  f.frame(10100);
  assert.equal((await result).finished, true);
  assert.equal(f.events.length, 1); assert.equal(f.frames.size, 0);
});

function schedulerFixture() {
  let id = 0, now = 0;
  const frames = new Map(), timers = new Map(), listeners = new Map();
  const add = (name, callback) => { const values = listeners.get(name) ?? new Set(); values.add(callback); listeners.set(name, values); };
  const remove = (name, callback) => listeners.get(name)?.delete(callback);
  const window = {
    requestAnimationFrame: callback => { frames.set(++id, callback); return id; },
    cancelAnimationFrame: handle => frames.delete(handle),
    setTimeout: (callback, delay) => { timers.set(++id, { callback, due: now + delay }); return id; },
    clearTimeout: handle => timers.delete(handle), addEventListener: add, removeEventListener: remove,
    performance: { now: () => now },
  };
  const document = { hidden: false, defaultView: window, addEventListener: add, removeEventListener: remove };
  return { document, frames, timers, listeners,
    frame(time) { now = time; for (const [handle, callback] of [...frames]) { if (frames.delete(handle)) callback(now); } },
    fire(name) { for (const callback of listeners.get(name) ?? []) callback(); },
  };
}

test('shared idle anchor scheduler has one timer, immediate scroll wake, and no residual work after last detach', () => {
  const f = schedulerFixture(); let reads = 0;
  const detach1 = observeElementAnchor(f.document, () => { reads++; }, () => true);
  const detach2 = observeElementAnchor(f.document, () => { reads++; }, () => true);
  assert.equal(f.frames.size, 1); f.frame(0);
  assert.equal(reads, 2); assert.equal(f.frames.size, 0); assert.equal(f.timers.size, 1);
  f.fire('scroll'); assert.equal(f.timers.size, 0); assert.equal(f.frames.size, 1);
  f.frame(16); assert.equal(reads, 4); assert.equal(f.timers.size, 1);
  detach1(); assert.equal(f.timers.size, 1);
  detach2(); assert.equal(f.timers.size, 0); assert.equal(f.frames.size, 0);
  for (const values of f.listeners.values()) assert.equal(values.size, 0);
});

test('a visible companion does not make an offscreen binding poll geometry every frame', () => {
  const f = schedulerFixture(); let sleepingReads = 0;
  const detach1 = observeElementAnchor(f.document, () => {}, () => false);
  const detach2 = observeElementAnchor(f.document, () => { sleepingReads++; }, () => true);
  try {
    for (let time = 0; time <= 240; time += 16) f.frame(time);
    assert.equal(sleepingReads, 1, 'a sleeping binding should only poll once per 250 ms');
    f.fire('resize'); f.frame(241);
    assert.equal(sleepingReads, 2, 'resize immediately refreshes sleeping geometry');
  } finally { detach1(); detach2(); }
});

test('resize during suspension does not consume a plain anchor movement remaining duration', async () => {
  const f = movementFixture();
  const result = f.movement.to({ x: 100, y: 0 }, { travel: 'none', duration: 100, easing: 'linear' });
  f.frame(40); f.movement.suspend(true); f.clock(10040);
  f.movement.resize();
  assert.equal(f.movement.position.x, 40);
  f.movement.suspend(false); f.frame(10040);
  assert.equal(f.movement.position.x, 40, 'a suspended resize must use the frozen animation clock');
  f.frame(10100); assert.equal((await result).finished, true);
});

test('a newer movement started by silent-follow detach progress retains ownership', async () => {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<body></body>', { pretendToBeVisual: true });
  const originals = new Map(); let id = 0;
  const frames = new Map();
  for (const [key, value] of Object.entries({ HTMLElement: dom.window.HTMLElement, CustomEvent: dom.window.CustomEvent,
    requestAnimationFrame: callback => { frames.set(++id, callback); return id; }, cancelAnimationFrame: handle => frames.delete(handle) })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  let avatar;
  try {
    const { SidekickAvatar } = await import('../src/element/avatar.ts');
    class ReviewAvatar extends SidekickAvatar {
      connectedCallback() { this.connected = true; }
      disconnectedCallback() { this.connected = false; this.detachAnchor(); this.movement.disconnect(); }
    }
    dom.window.customElements.define('idle-review-avatar', ReviewAvatar);
    avatar = dom.window.document.createElement('idle-review-avatar'); dom.window.document.body.append(avatar);
    await avatar.moveTo({ x: 100, y: 0 }, { duration: 0 });
    avatar.movement.followTarget({ x: 900, y: 0 });
    let newer;
    avatar.addEventListener('sidekick-move-progress', () => { newer = avatar.moveTo({ x: 700, y: 0 }, { duration: 0 }); }, { once: true });
    const older = avatar.moveTo({ x: 300, y: 0 }, { duration: 0 });
    await newer;
    assert.equal(avatar.position.x, 700, 'outer request must not overwrite a newer request from detach progress');
    assert.equal((await older).finished, false);
  } finally {
    avatar?.remove(); dom.window.close();
    for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});

test('detaching during the initial journey preserves its velocity and original completion', async () => {
  const f = movementFixture();
  const pending = f.movement.to({ x: 200, y: 0 });
  for (let time = 0; time <= 200; time += 10) f.frame(time);
  const before = f.movement.state;
  f.movement.stopFollowing();
  assert.deepEqual(f.movement.state, before);
  for (let time = 210; time <= 10000 && f.frames.size; time += 10) f.frame(time);
  assert.equal((await pending).finished, true);
  assert.equal(f.events.length, 1); assert.equal(f.frames.size, 0);
  assert.deepEqual(f.movement.position, { x: 200, y: 0 });
});

test('document hiding removes the shared idle timer and visibility restoration refreshes once', () => {
  const f = schedulerFixture(); let reads = 0;
  const detach = observeElementAnchor(f.document, () => { reads++; }, () => true);
  try {
    f.frame(0); assert.equal(f.timers.size, 1);
    f.document.hidden = true; f.fire('visibilitychange');
    assert.equal(f.frames.size, 0); assert.equal(f.timers.size, 0);
    f.document.hidden = false; f.fire('visibilitychange');
    assert.equal(f.frames.size, 1); f.frame(20); assert.equal(reads, 2);
  } finally { detach(); }
  assert.equal(f.frames.size, 0); assert.equal(f.timers.size, 0);
});
