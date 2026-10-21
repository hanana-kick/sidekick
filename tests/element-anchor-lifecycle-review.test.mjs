import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

let dom, frames, nextFrame = 0;
const originals = new Map();
before(async () => {
  dom = new JSDOM('<body></body>', { pretendToBeVisual: true });
  frames = new Map();
  const request = callback => { frames.set(++nextFrame, callback); return nextFrame; };
  const cancel = id => frames.delete(id);
  for (const [key, value] of Object.entries({ HTMLElement: dom.window.HTMLElement, CustomEvent: dom.window.CustomEvent, requestAnimationFrame: request, cancelAnimationFrame: cancel })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  dom.window.requestAnimationFrame = request; dom.window.cancelAnimationFrame = cancel;
  const { SidekickAvatar } = await import('../dist/src/element/avatar.js');
  // Exercise actual movement/presence/anchor code without starting a GPU renderer.
  class LifecycleAvatar extends SidekickAvatar {
    connectedCallback() { this.connected = true; }
    disconnectedCallback() { this.connected = false; this.detachAnchor(); this.movement.disconnect(); }
  }
  dom.window.customElements.define('anchor-review-avatar', LifecycleAvatar);
});
after(() => {
  dom.window.close();
  for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
});
function fixture(t) {
  const avatar = dom.window.document.createElement('anchor-review-avatar');
  const target = dom.window.document.createElement('div');
  const layout = { x: 100, y: 150, originX: 30, originY: 40, displayed: true };
  dom.window.document.body.append(avatar, target);
  avatar.paused = true; // These geometry/lifecycle cases intentionally opt out of animation.
  avatar.getBoundingClientRect = () => !layout.displayed ? ({ left: 0, top: 0, width: 0, height: 0 }) : ({ left: layout.originX + avatar.position.x, top: layout.originY + avatar.position.y, width: 20, height: 20 });
  avatar.getClientRects = () => layout.displayed ? [avatar.getBoundingClientRect()] : [];
  target.getClientRects = () => [target.getBoundingClientRect()];
  target.getBoundingClientRect = () => ({ left: layout.x, top: layout.y, width: 20, height: 20 });
  t.after(() => { avatar.remove(); target.remove(); assert.equal(frames.size, 0); });
  return { avatar, target, layout };
}
function frame() { for (const [id, callback] of [...frames]) { if (!frames.delete(id)) continue; callback(performance.now()); } }

test('anchor captures validated options before synchronous progress callbacks mutate the caller object', async t => {
  const { avatar, target } = fixture(t);
  const options = { anchor: true, x: 3, y: 7, duration: 0 };
  avatar.addEventListener('sidekick-move-progress', () => { options.anchor = false; options.x = Infinity; options.alignX = 'invalid'; }, { once: true });
  await avatar.moveToElement(target, options);
  assert.deepEqual(avatar.elementAnchor, { target, x: 3, y: 7, alignX: 'left', alignY: 'top' });
  frame(); assert.deepEqual(avatar.position, { x: 73, y: 117 });
});

test('synchronous cancel prevents the older move from reattaching its anchor', async t => {
  const { avatar, target } = fixture(t);
  avatar.addEventListener('sidekick-move-progress', () => avatar.cancelMove(), { once: true });
  await avatar.moveToElement(target, { anchor: true, duration: 0 });
  assert.equal(avatar.elementAnchor, null); assert.equal(frames.size, 0);
});

test('reentrant anchored replacement retains its own target and options', async t => {
  const { avatar, target } = fixture(t);
  const replacement = dom.window.document.createElement('div'); dom.window.document.body.append(replacement);
  replacement.getBoundingClientRect = () => ({ left: 300, top: 250, width: 20, height: 20 });
  t.after(() => replacement.remove());
  let pending;
  avatar.addEventListener('sidekick-move-progress', () => { pending = avatar.moveToElement(replacement, { anchor: true, x: 9, duration: 0 }); }, { once: true });
  await avatar.moveToElement(target, { anchor: true, duration: 0 }); await pending;
  assert.equal(avatar.elementAnchor.target, replacement); assert.equal(avatar.elementAnchor.x, 9);
  frame(); assert.deepEqual(avatar.position, { x: 279, y: 210 });
});

test('idle anchoring compensates changing inline origin without drift and getter mutation cannot alter the binding', async t => {
  const { avatar, target, layout } = fixture(t);
  await avatar.moveToElement(target, { anchor: true, duration: 0 });
  const snapshot = avatar.elementAnchor; snapshot.x = 900; snapshot.target = avatar;
  layout.originX = 55; layout.originY = 65; layout.x = 220; layout.y = 330;
  for (let i = 0; i < 10; i++) frame();
  assert.deepEqual(avatar.position, { x: 165, y: 265 }); assert.equal(avatar.elementAnchor.target, target);
  avatar.detachAnchor(); layout.x = 999; frame(); assert.deepEqual(avatar.position, { x: 165, y: 265 });
});

test('invalid options preserve an existing anchor atomically', async t => {
  const { avatar, target } = fixture(t);
  await avatar.moveToElement(target, { anchor: true, duration: 0 });
  const original = avatar.elementAnchor;
  for (const options of [{ anchor: null }, { anchor: true, duration: -1 }, { anchor: true, alignX: 'invalid' }, { anchor: true, get x() { throw Error('must not run'); } }]) {
    assert.throws(() => avatar.moveToElement(target, options)); assert.deepEqual(avatar.elementAnchor, original);
  }
});


test('document visibility suspends frames and resumes from current target geometry', async t => {
  const { avatar, target, layout } = fixture(t);
  const document = dom.window.document;
  await avatar.moveToElement(target, { anchor: true, duration: 0 });
  const before = avatar.position;
  Object.defineProperty(document, 'hidden', { value: true, configurable: true });
  document.dispatchEvent(new dom.window.Event('visibilitychange'));
  assert.equal(frames.size, 0); layout.x += 100; frame(); assert.deepEqual(avatar.position, before);
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  document.dispatchEvent(new dom.window.Event('visibilitychange'));
  assert.equal(frames.size, 1); frame(); assert.deepEqual(avatar.position, { x: 170, y: 110 });
});

test('display:none avatar retains its binding without accumulating positional drift', async t => {
  const { avatar, target, layout } = fixture(t);
  await avatar.moveToElement(target, { anchor: true, duration: 0 });
  const before = avatar.position; layout.displayed = false;
  for (let i = 0; i < 5; i++) frame();
  assert.deepEqual(avatar.position, before); assert.equal(avatar.elementAnchor.target, target);
  layout.displayed = true; layout.x += 100; dom.window.dispatchEvent(new dom.window.Event('resize')); frame();
  assert.deepEqual(avatar.position, { x: 170, y: 110 });
});

test('anchor destination keeps viewport bounds while recovering from an exit', async t => {
  const { avatar, target, layout } = fixture(t);
  Object.defineProperty(dom.window, 'innerWidth', { value: 900, configurable: true });
  avatar.paused = false; avatar.placementState = 'viewport'; avatar.movementBox = { width: 200, height: 200 };
  layout.originX = 0; layout.originY = 0; layout.x = 1500;
  await avatar.exit({ duration: 0 });
  const pending = avatar.moveToElement(target, { anchor: true });
  assert.equal(avatar.movement.track.to.x, 700, 'initial destination is constrained');
  frame();
  assert.equal(avatar.movement.track.to.x, 700, 'persistent refresh must not bypass bounds during presence recovery');
  avatar.remove(); assert.equal((await pending).finished, false);
});

test('hidden target reparented into the avatar detaches before geometry becomes available', async t => {
  const { avatar, target } = fixture(t);
  await avatar.moveToElement(target, { anchor: true, duration: 0 });
  target.getClientRects = () => [];
  avatar.attachShadow({ mode: 'open' }).append(target);
  frame(); assert.equal(avatar.elementAnchor, null); assert.equal(frames.size, 0);
});

test('removed live target cancels initial plain request instead of reporting stale arrival', async t => {
 const {avatar,target}=fixture(t);avatar.paused=false;
 const result=avatar.moveToElement(target,{anchor:true,duration:1000,travel:'none'});
 target.remove();frame();
 assert.equal((await result).finished,false);assert.equal(avatar.elementAnchor,null);
});

test('movement RAF before anchor RAF cannot resolve against a last-frame stale target',async t=>{
 const {avatar,target,layout}=fixture(t);avatar.paused=false;
 let settled=false;const promise=avatar.moveToElement(target,{anchor:true,duration:100,travel:'none'}).then(r=>{settled=true;return r;});
 layout.x=300;const start=performance.now();
 const runAt=time=>{for(const [id,callback] of [...frames]){if(frames.delete(id))callback(time);}};
 runAt(start+101);await Promise.resolve();assert.equal(settled,false,'old endpoint must not resolve before the anchor RAF');
 for(let time=start+117;time<start+8000&&avatar.movementState.phase!=='idle';time+=16)runAt(time);
 const result=await promise;assert.equal(result.finished,true);assert.equal(result.position.x,270);assert.equal(result.position.y,110);
});

for (const reduced of [true, false]) test(`settled visible anchor samples layout-only changes on the next frame (${reduced ? 'reduced' : 'normal'} motion)`, async t => {
  const { avatar, target, layout } = fixture(t);
  avatar.paused = false; avatar.reduced = reduced;
  await avatar.moveToElement(target, { anchor: true, duration: 0 });
  frame(); // Consume initial forced read before changing layout, with no scroll/resize event.
  assert.equal(avatar.movementState.phase, 'idle');
  layout.x += 70;
  frame();
  if (reduced) {
    assert.equal(avatar.position.x, 140, 'reduced motion follows the current geometry immediately');
    layout.x += 117; layout.originY += 30; frame();
    assert.deepEqual(avatar.position, { x: 257, y: 80 }, 'successive reflow/transform changes must not wait for the idle timer');
  } else {
    assert.equal(avatar.movement.track?.to.x, 140, 'normal motion must start pursuing the fresh destination without a 250ms dead gap');
    assert.notEqual(avatar.movementState.phase, 'idle');
  }
});
