import test, { before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

let dom, entranceClip, frames, nextFrame = 0;
const originals = new Map();

before(async () => {
  dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
  frames = new Map();
  const request = callback => { frames.set(++nextFrame, callback); return nextFrame; };
  const cancel = id => frames.delete(id);
  for (const [key, value] of Object.entries({
    HTMLElement: dom.window.HTMLElement,
    CustomEvent: dom.window.CustomEvent,
    requestAnimationFrame: request,
    cancelAnimationFrame: cancel,
  })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  dom.window.requestAnimationFrame = request;
  dom.window.cancelAnimationFrame = cancel;
  const { SidekickAvatar } = await import('../src/element/avatar.ts');
  ({ entranceClip } = await import('../src/element/entrance.ts'));
  // Keep the actual movement, presence, entrance and disconnect implementations.
  // Only renderer initialization is omitted from this deterministic DOM harness.
  class EntranceReviewAvatar extends SidekickAvatar {
    connectedCallback() { this.connected = true; }
  }
  dom.window.customElements.define('entrance-review-avatar', EntranceReviewAvatar);
});

async function drain() { for (let index = 0; index < 12; index++) await Promise.resolve(); }
function frame() {
  const timestamp = performance.now() + 100;
  for (const [id, callback] of [...frames]) if (frames.delete(id)) callback(timestamp);
}

afterEach(async () => {
  dom.window.document.body.replaceChildren();
  await drain();
  assert.equal(frames.size, 0, 'entrance teardown must release all scheduler and movement frames');
});

after(() => {
  dom.window.close();
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
});

function fixture() {
  const avatar = dom.window.document.createElement('entrance-review-avatar');
  const target = dom.window.document.createElement('section');
  const layout = { left: 200, top: 200, width: 100, height: 100 };
  avatar.canvas = dom.window.document.createElement('canvas');
  avatar.attachShadow({ mode: 'open' }).append(avatar.canvas);
  avatar.getBoundingClientRect = () => ({ left: avatar.position.x, top: avatar.position.y, width: 20, height: 20 });
  target.getBoundingClientRect = () => ({ ...layout });
  dom.window.document.body.append(avatar, target);
  avatar.placementState = 'viewport';
  avatar.readyState = true;
  avatar.movementBox = { width: 20, height: 20 };
  const errors = [], ends = [];
  avatar.addEventListener('sidekick-error', event => errors.push(event.detail));
  avatar.addEventListener('sidekick-enter-end', event => ends.push(event.detail));
  const declaration = { source: 'element', target, direction: 'right' };
  return { avatar, target, layout, declaration, errors, ends };
}

test('entry stages under a full mask and updates the mask in the same frame as physical movement', () => {
  const { avatar, target, declaration, errors } = fixture();
  avatar.entrance = declaration;
  assert.deepEqual(errors, []);
  assert.deepEqual(avatar.position, { x: 280, y: 240 });
  assert.equal(avatar.canvas.style.clipPath, entranceClip(avatar.getBoundingClientRect(), target.getBoundingClientRect()));
  frame();
  assert.ok(avatar.position.x > 280, 'the physical movement must have advanced');
  assert.equal(avatar.canvas.style.clipPath, entranceClip(avatar.getBoundingClientRect(), target.getBoundingClientRect()), 'the mask must not lag movement by one frame');
});

test('moving target updates both cutout and physical destination', () => {
  const { avatar, target, layout, declaration } = fixture();
  avatar.entrance = declaration;
  layout.left += 40; layout.top += 30;
  frame();
  assert.deepEqual(avatar.presence.operation.point, { x: 356, y: 270 });
  assert.equal(avatar.canvas.style.clipPath, entranceClip(avatar.getBoundingClientRect(), target.getBoundingClientRect()));
});

test('equal declarations retain the flight; removal cancels and readdition stages a fresh entrance', () => {
  const { avatar, declaration } = fixture();
  avatar.entrance = declaration;
  frame();
  const operation = avatar.presence.operation, position = avatar.position;
  avatar.entrance = { ...declaration, at: 0.5, gap: 16 };
  assert.equal(avatar.presence.operation, operation);
  assert.deepEqual(avatar.position, position);
  avatar.entrance = null;
  assert.equal(avatar.entrance, null);
  assert.equal(avatar.presenceState, 'visible');
  assert.equal(avatar.movementState.phase, 'idle');
  assert.equal(avatar.canvas.style.clipPath, '');
  assert.equal(frames.size, 0);
  avatar.entrance = declaration;
  assert.deepEqual(avatar.position, { x: 280, y: 240 });
  assert.equal(avatar.presenceState, 'entering');
});

test('synchronous progress cancellation cannot recreate the old entrance mask', async () => {
  const { avatar, declaration } = fixture();
  avatar.addEventListener('sidekick-move-progress', () => { avatar.entrance = null; }, { once: true });
  avatar.entrance = declaration;
  await drain();
  assert.equal(avatar.entrance, null);
  assert.equal(avatar.canvas.style.clipPath, '');
  assert.equal(avatar.entranceCleanup, undefined);
  assert.equal(frames.size, 0);
});

test('synchronous progress replacement keeps only the new target and mask', () => {
  const first = fixture(), second = fixture();
  second.layout.left = 500; second.layout.top = 400;
  const replacement = { source: 'element', target: second.target, direction: 'bottom' };
  first.avatar.addEventListener('sidekick-move-progress', () => { first.avatar.entrance = replacement; }, { once: true });
  first.avatar.entrance = first.declaration;
  assert.equal(first.avatar.entrance.target, second.target);
  assert.deepEqual(first.avatar.position, { x: 540, y: 480 });
  assert.equal(first.avatar.canvas.style.clipPath, entranceClip(first.avatar.getBoundingClientRect(), second.target.getBoundingClientRect()));
});

for (const action of ['clear declaration', 'remove target']) test(`${action} preserves a reentrant imperative entry and releases the previous mask`, async () => {
  const { avatar, target, declaration } = fixture();
  avatar.entrance = declaration;
  let replacement;
  avatar.addEventListener('sidekick-enter-end', event => {
    if (!event.detail.finished) replacement = avatar.enter({ x: 123, y: 234 });
  }, { once: true });
  if (action === 'clear declaration') avatar.entrance = null;
  else { target.remove(); frame(); }
  await drain();
  assert.ok(replacement, 'the cancellation listener must have created its entry');
  assert.equal(avatar.presenceState, 'entering');
  assert.notEqual(avatar.movementState.phase, 'braking');
  assert.notEqual(avatar.movementState.phase, 'idle');
  assert.equal(avatar.canvas.style.clipPath, '', 'the superseded declarative entry must not retain its mask');
  assert.equal(avatar.entranceCleanup, undefined);
  avatar.movement.finish();
  assert.equal((await replacement).finished, true);
  assert.deepEqual(avatar.position, { x: 123, y: 234 });
});

test('a queued scheduler write cannot restore another entrance cancelled by an earlier binding', async () => {
  const first = fixture(), second = fixture();
  first.avatar.entrance = first.declaration;
  second.avatar.entrance = second.declaration;
  first.avatar.addEventListener('sidekick-enter-end', () => { second.avatar.entrance = null; }, { once: true });
  first.target.remove();
  frame();
  await drain();
  assert.equal(second.avatar.entrance, null);
  assert.equal(second.avatar.canvas.style.clipPath, '');
  assert.equal(second.avatar.entranceCleanup, undefined);
});

test('disconnect cleans up the live mask and observers synchronously', () => {
  const { avatar, declaration } = fixture();
  avatar.entrance = declaration;
  avatar.remove();
  assert.equal(avatar.canvas.style.clipPath, '');
  assert.equal(avatar.entranceCleanup, undefined);
  assert.equal(avatar.refreshEntranceClip, undefined);
  assert.equal(frames.size, 0);
});

for (const [property, value] of [['transform', 'scale(0.5)'], ['rotate', '10deg'], ['scale', '0.5'], ['zoom', '2'], ['padding', '2px'], ['border', '1px solid red']]) test(`unsupported avatar ${property} is rejected before staging`, () => {
  const { avatar, declaration, errors } = fixture();
  avatar.style[property] = value;
  avatar.entrance = declaration;
  assert.equal(errors.length, 1);
  assert.equal(errors[0].attribute, 'entrance');
  assert.deepEqual(avatar.position, { x: 0, y: 0 });
  assert.equal(avatar.canvas.style.clipPath, '');
  assert.equal(frames.size, 0);
});

test('target rotation on a composed Shadow DOM ancestor is rejected', () => {
  const { avatar, target, declaration, errors } = fixture();
  const host = dom.window.document.createElement('div');
  host.style.rotate = '12deg';
  host.attachShadow({ mode: 'open' }).append(target);
  dom.window.document.body.append(host);
  avatar.entrance = declaration;
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /rotation|transformed/);
  assert.equal(avatar.canvas.style.clipPath, '');
  assert.equal(frames.size, 0);
});

test('a declarative behavior waits for entry completion and then starts once', async () => {
  const { avatar, declaration } = fixture();
  const changes = [];
  avatar.addEventListener('sidekick-behavior-change', event => changes.push(event.detail.status));
  avatar.entrance = declaration;
  avatar.behavior = { type: 'idle' };
  assert.deepEqual(avatar.behavior, { type: 'idle' });
  assert.equal(avatar.behaviorState.status, 'idle');
  assert.deepEqual(changes, []);
  avatar.movement.finish();
  await drain();
  assert.equal(avatar.presenceState, 'visible');
  assert.equal(avatar.behaviorState.status, 'acting');
  assert.deepEqual(changes, ['resolving', 'acting']);
  assert.equal(avatar.pendingBehavior, undefined);
  assert.equal(avatar.canvas.style.clipPath, '');
});

for (const action of ['clear declaration', 'remove target', 'invalid geometry']) test(`queued behavior resumes after ${action}`, async () => {
  const { avatar, target, layout, declaration, errors } = fixture();
  if (action === 'invalid geometry') avatar.readyState = false;
  avatar.entrance = declaration;
  avatar.behavior = { type: 'idle' };
  if (action === 'clear declaration') avatar.entrance = null;
  else if (action === 'remove target') { target.remove(); frame(); }
  else { layout.width = 10; avatar.readyState = true; avatar.startEntrance(); }
  await drain();
  assert.equal(avatar.behaviorState.status, 'acting');
  assert.equal(avatar.pendingBehavior, undefined);
  assert.equal(avatar.canvas.style.clipPath, '');
  if (action !== 'clear declaration') assert.equal(errors.length, 1);
});

for (const action of ['moveTo', 'cancelMove']) test(`explicit ${action} supersedes a queued declarative behavior`, async () => {
  const { avatar, declaration } = fixture();
  avatar.entrance = declaration;
  avatar.behavior = { type: 'idle' };
  if (action === 'moveTo') await avatar.moveTo({ x: 123, y: 234 }, { duration: 0 });
  else avatar.cancelMove();
  await drain();
  assert.equal(avatar.pendingBehavior, undefined);
  assert.equal(avatar.behavior, null);
  assert.equal(avatar.behaviorState.status, 'idle', 'the queued behavior must not restart after the newer manual command');
  assert.equal(avatar.canvas.style.clipPath, '');
  if (action === 'moveTo') assert.deepEqual(avatar.position, { x: 123, y: 234 });
});

test('HTML JSON null clears the entrance declaration without rejecting the attribute transaction', async () => {
  const { avatar, declaration, errors } = fixture();
  avatar.setAttribute('entrance', JSON.stringify({ ...declaration, target: '#entrance-review-target' }));
  // Use the fixture's direct Element declaration first: only JSON null is under test.
  avatar.removeAttribute('entrance');
  await drain();
  avatar.entrance = declaration;
  avatar.setAttribute('entrance', ' null ');
  await drain();
  assert.equal(avatar.entrance, null);
  assert.equal(avatar.presenceState, 'visible');
  assert.equal(avatar.canvas.style.clipPath, '');
  assert.deepEqual(errors, []);
});
