import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { createPackageConsumer } from './package-fixture.mjs';

let consumer, React, SidekickAvatar, createRoot, hydrateRoot, renderToString, dom;
const ready = [];
before(async () => {
  consumer = createPackageConsumer({ react: true });
  const imported = file => import(pathToFileURL(join(consumer.directory, 'node_modules', file)).href);
  React = await imported('react/index.js');
  ({ SidekickAvatar } = await import(pathToFileURL(join(consumer.packagePath, 'dist/library/react.js')).href));
  ({ renderToString } = await imported('react-dom/server.node.js'));
  // The wrapper has already been imported and rendered without HTMLElement.
  assert.equal(typeof HTMLElement, 'undefined');
  assert.equal(renderToString(React.createElement(SidekickAvatar, { shape: 'heart' })), '<sidekick-avatar></sidekick-avatar>');
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://consumer.test/' });
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'CustomEvent', 'Event', 'MouseEvent', 'MutationObserver']) {
    Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true, writable: true });
  }
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  class MockAvatar extends HTMLElement {
    static observedAttributes = ['design', 'shape', 'body-color', 'eye-color', 'paused', 'interaction', 'mouse-tracking', 'tracking-mode', 'camera-yaw', 'camera-pitch', 'camera-roll', 'accessories', 'motion', 'left-smile', 'right-blink', 'head-accessory'];
    ready = false;
    mutations = [];
    listeners = new Map();
    addEventListener(name, listener, options) {
      if (name.startsWith('sidekick-')) { const listeners = this.listeners.get(name) ?? new Set(); listeners.add(listener); this.listeners.set(name, listeners); }
      super.addEventListener(name, listener, options);
    }
    removeEventListener(name, listener, options) { this.listeners.get(name)?.delete(listener); super.removeEventListener(name, listener, options); }
    connectedCallback() {
      if (this.hasAttribute('data-fail')) { this.dispatchEvent(new CustomEvent('sidekick-error', { detail: { message: 'WebGL unavailable' } })); return; }
      this.ready = true; this.dispatchEvent(new CustomEvent('sidekick-ready', { detail: {} })); }
    disconnectedCallback() { this.ready = false; }
    attributeChangedCallback(name, oldValue, value) { this.mutations.push({ name, oldValue, value }); queueMicrotask(() => { this.appliedShape = this.getAttribute('shape'); }); }
    get activity() { return 'still'; }
    set design(_value) { throw new Error('React must not assign the design property'); }
    set camera(_value) { throw new Error('React must not assign the camera property'); }
    setDesign() {}
    setShape(shape) { this.imperativeShape = shape; }
  }
  dom.window.customElements.define('sidekick-avatar', MockAvatar);
  ({ createRoot, hydrateRoot } = await imported('react-dom/client.js'));
});
after(() => { dom?.window.close(); consumer?.cleanup(); });

async function fixture(t, props = {}, strict = false) {
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  const render = async next => React.act(async () => {
    const tree = React.createElement(SidekickAvatar, next);
    root.render(strict ? React.createElement(React.StrictMode, null, tree) : tree);
  });
  await render(props);
  let live = true;
  const unmount = async () => { if (live) { await React.act(async () => root.unmount()); live = false; container.remove(); } };
  t.after(unmount);
  return { root, container, avatar: container.querySelector('sidekick-avatar'), render, unmount };
}

test('React 19 maps props before notifying readiness on an already registered host', async t => {
  const ref = React.createRef();
  const f = await fixture(t, { ref, id: 'friend', className: 'avatar', 'aria-label': 'Companion', 'data-consumer': 'typed', style: { width: 240 }, shape: 'heart', bodyColor: '#abcdef', paused: false, mouseTracking: true, activity: 'still', interaction: 'box', camera: { yaw: 12, pitch: 4 }, leftSmile: 0.2, rightBlink: 0.5, headAccessory: 'beret', onReady: event => { assert.equal(ref.current.getAttribute('shape'), 'heart'); assert.equal(ref.current.getAttribute('camera-yaw'), '12'); assert.equal(ref.current.getAttribute('left-smile'), '0.2'); ready.push(event); } });
  assert.equal(ref.current, f.avatar);
  assert.equal(ready.length, 1);
  assert.ok(ready[0] instanceof CustomEvent);
  assert.equal(ready[0].type, 'sidekick-ready');
  assert.equal(f.avatar.getAttribute('paused'), 'false');
  assert.equal(f.avatar.getAttribute('mouse-tracking'), 'true');
  assert.equal(f.avatar.getAttribute('activity'), 'still');
  assert.equal(f.avatar.getAttribute('camera-yaw'), '12');
  assert.equal(f.avatar.getAttribute('camera-pitch'), '4');
  assert.equal(f.avatar.getAttribute('left-smile'), '0.2');
  assert.equal(f.avatar.className, 'avatar');
  assert.equal(f.avatar.style.width, '240px');
  assert.equal(f.avatar.getAttribute('data-consumer'), 'typed');
  assert.equal(f.avatar.hasAttribute('bodyColor'), false);
  await f.unmount(); assert.equal(ref.current, null);
});

test('pre-registered insertion failures reach onError exactly once and release every listener', async t => {
  const events = [], readyEvents = [], ref = React.createRef();
  const props = { ref, 'data-fail': 'yes', shape: 'heart', camera: { yaw: 12 }, leftSmile: 0.4, onReady: event => readyEvents.push(event), onError: event => {
    assert.equal(event.target.getAttribute('shape'), 'heart');
    assert.equal(event.target.appliedShape, 'heart', 'error callback waits for attribute application');
    assert.equal(event.target.getAttribute('camera-yaw'), '12');
    assert.equal(event.target.getAttribute('left-smile'), '0.4');
    events.push(['first', event]);
  } };
  const f = await fixture(t, props, true);
  assert.equal(events.length, 1);
  assert.equal(events[0][1].detail.message, 'WebGL unavailable');
  assert.equal(ref.current, f.avatar);
  assert.deepEqual(readyEvents, []);
  await f.render({ ...props, onError: event => events.push(['replacement', event]) });
  const subsequent = new CustomEvent('sidekick-error', { detail: { message: 'Later failure' } });
  await React.act(async () => { f.avatar.dispatchEvent(subsequent); });
  assert.deepEqual(events.map(([name]) => name), ['first', 'replacement']);
  assert.equal(events[1][1], subsequent);
  assert.equal(f.avatar.listeners.get('sidekick-error').size, 1);
  await f.unmount();
  assert.equal(ref.current, null);
  assert.ok([...f.avatar.listeners.values()].every(listeners => listeners.size === 0));
  f.avatar.dispatchEvent(new CustomEvent('sidekick-error', { detail: { message: 'Detached failure' } }));
  await Promise.resolve();
  assert.equal(events.length, 2);
});

test('stable semantic props do not restart motions; replacement handlers and prop removal work', async t => {
  const calls = [];
  const first = event => calls.push(['first', event.detail.design]);
  const second = event => calls.push(['second', event.detail.design]);
  const props = { design: { body: { color: '#123456', shape: 'heart' } }, motion: { body: { rotation: [0, 1, 0] } }, camera: { yaw: 12 }, paused: true, onDesignChange: first };
  const f = await fixture(t, props);
  const count = f.avatar.mutations.length;
  f.avatar.setShape('puffy');
  await f.render({ ...props, design: { body: { shape: 'heart', color: '#123456' } }, motion: { body: { rotation: [0, 1, 0] } }, onDesignChange: second });
  assert.equal(f.avatar.mutations.length, count);
  assert.equal(f.avatar.imperativeShape, 'puffy');
  f.avatar.dispatchEvent(new CustomEvent('sidekick-design-change', { detail: { design: 'changed' } }));
  assert.deepEqual(calls, [['second', 'changed']]);
  await f.render({ shape: 'circle', onDesignChange: second });
  assert.equal(f.avatar.hasAttribute('design'), false);
  assert.equal(f.avatar.hasAttribute('motion'), false);
  assert.equal(f.avatar.hasAttribute('paused'), false);
  assert.equal(f.avatar.hasAttribute('camera-yaw'), false);
  assert.equal(f.avatar.getAttribute('shape'), 'circle');
});

test('StrictMode supports callback-ref cleanup, changed refs, and no duplicate native callbacks', async t => {
  const assignments = [], cleaned = [], events = [];
  const ref = node => { assignments.push(node); return () => cleaned.push(node); };
  const f = await fixture(t, { ref, onActivate: event => events.push(event) }, true);
  assert.equal(assignments.at(-1), f.avatar);
  f.avatar.dispatchEvent(new CustomEvent('sidekick-activate', { detail: {} }));
  assert.equal(events.length, 1);
  const secondRef = React.createRef();
  await f.render({ ref: secondRef });
  assert.equal(secondRef.current, f.avatar);
  assert.equal(cleaned.length, assignments.length);
  await f.unmount(); assert.equal(secondRef.current, null);
  f.avatar.dispatchEvent(new CustomEvent('sidekick-activate', { detail: {} }));
  assert.equal(events.length, 1);
});

test('hydration preserves the host, emits no mismatch and notifies an already ready host once', async t => {
  const props = { id: 'hydrated', shape: 'heart', paused: true, 'aria-label': 'Friend' };
  const html = renderToString(React.createElement(SidekickAvatar, props));
  const container = document.createElement('div'); container.innerHTML = html; document.body.append(container);
  const host = container.firstElementChild;
  host.setShape('puffy');
  const events = [], errors = [], ref = React.createRef();
  let root;
  await React.act(async () => { root = hydrateRoot(container, React.createElement(React.StrictMode, null, React.createElement(SidekickAvatar, { ...props, ref, onReady: event => events.push(event) })), { onRecoverableError: error => errors.push(error.message) }); });
  t.after(async () => { await React.act(async () => root.unmount()); container.remove(); });
  assert.equal(container.firstElementChild, host);
  assert.equal(ref.current, host);
  assert.equal(host.imperativeShape, 'puffy');
  assert.deepEqual(errors, []);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'sidekick-ready');
});

for (const subpath of ['/react', '/browser/sidekick-react.js']) test(`server import followed by actual delayed custom-element upgrade works in one process: ${subpath}`, () => {
  const jsdom = pathToFileURL(fileURLToPath(new URL('../node_modules/jsdom/lib/api.js', import.meta.url))).href;
  const output = consumer.run(['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { JSDOM } from ${JSON.stringify(jsdom)};
    import React, { act } from 'react';
    import { renderToString } from 'react-dom/server';
    import { SidekickAvatar } from ${JSON.stringify('@hanana-kick/sidekick' + subpath)};
    const props = { id: 'delayed', shape: 'heart', bodyColor: '#123456', paused: true };
    const html = renderToString(React.createElement(SidekickAvatar, props));
    assert.equal(typeof HTMLElement, 'undefined');
    const dom = new JSDOM('<!doctype html><div id="root">' + html + '</div>', { url: 'https://test.invalid' });
    for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'CustomEvent', 'Event', 'customElements']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, devicePixelRatio: 1, matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }), ResizeObserver: class { observe() {} disconnect() {} }, IntersectionObserver: class { observe() {} disconnect() {} }, requestAnimationFrame: () => 0, cancelAnimationFrame() {} });
    dom.window.HTMLCanvasElement.prototype.getContext = () => null;
    const { hydrateRoot, createRoot } = await import('react-dom/client');
    const { flushSync } = await import('react-dom');
    const canceledContainer = document.createElement('div'); document.body.append(canceledContainer);
    const canceled = createRoot(canceledContainer);
    await act(async () => { flushSync(() => canceled.render(React.createElement(SidekickAvatar))); flushSync(() => canceled.unmount()); await new Promise(resolve => setTimeout(resolve, 50)); });
    assert.equal(customElements.get('sidekick-avatar'), undefined, 'unmounted delayed import must not register');
    canceledContainer.remove();
    const original = document.querySelector('sidekick-avatar');
    const errors = [], ref = React.createRef(); let root;
    await act(async () => { root = hydrateRoot(document.querySelector('#root'), React.createElement(React.StrictMode, null, React.createElement(SidekickAvatar, { ...props, ref, onError: event => errors.push(event.detail.message) }))); await new Promise(resolve => setTimeout(resolve, 100)); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 100)); });
    assert.equal(ref.current, original);
    assert.equal(typeof original.setDesign, 'function');
    assert.equal(original.design.body.shape, 'heart');
    assert.equal(original.design.body.color, '#123456');
    assert.equal(errors.length, 1);
    assert.match(errors[0], /WebGL/);
    await act(async () => root.unmount()); assert.equal(ref.current, null);
    const registeredContainer = document.createElement('div'); document.body.append(registeredContainer);
    const registeredRoot = createRoot(registeredContainer), registeredErrors = [], registeredRef = React.createRef();
    await act(async () => { registeredRoot.render(React.createElement(React.StrictMode, null, React.createElement(SidekickAvatar, { shape: 'puffy', camera: { yaw: 15 }, leftSmile: 0.3, ref: registeredRef, onError: event => { assert.equal(event.target.design.body.shape, 'puffy'); assert.equal(event.target.camera.yaw, 15); assert.equal(event.target.design.eyes.left.weights.smile, 0.3); registeredErrors.push(event); } }))); });
    assert.equal(registeredErrors.length, 1, 'already registered WebGL failure is delivered exactly once');
    assert.equal(registeredRef.current, registeredContainer.firstElementChild);
    await act(async () => registeredRoot.unmount()); assert.equal(registeredRef.current, null);
    dom.window.close(); console.log('delayed hydration passed');
  `]);
  assert.match(output, /delayed hydration passed/);
});

test('React forwards canonical trackingMode independently from the legacy boolean and removes it cleanly', async t => {
  const f = await fixture(t, { trackingMode: 'eyes-and-body', mouseTracking: false });
  assert.equal(f.avatar.getAttribute('tracking-mode'), 'eyes-and-body'); assert.equal(f.avatar.getAttribute('mouse-tracking'), 'false');
  await f.render({ trackingMode: 'off', mouseTracking: true });
  assert.equal(f.avatar.getAttribute('tracking-mode'), 'off'); assert.equal(f.avatar.getAttribute('mouse-tracking'), 'true');
  await f.render({ mouseTracking: true });
  assert.equal(f.avatar.hasAttribute('tracking-mode'), false); assert.equal(f.avatar.getAttribute('mouse-tracking'), 'true');
});

test('React cameraZoom overrides object zoom and removal restores object/default declarations', async t => {
  const f = await fixture(t, { camera: { yaw: 12, zoom: 1.4 }, cameraZoom: 2 });
  assert.equal(f.avatar.getAttribute('camera-zoom'), '2');
  await f.render({ camera: { yaw: 12, zoom: 1.4 } }); assert.equal(f.avatar.getAttribute('camera-zoom'), '1.4');
  await f.render({ camera: { yaw: 12 } }); assert.equal(f.avatar.hasAttribute('camera-zoom'), false);
  assert.equal(f.avatar.getAttribute('camera-yaw'), '12');
});

test('React forwards placement coordinates and custom completion events without resetting an unchanged command', async t => {
  const moves = [], transitions = [], ref = React.createRef();
  const props = { ref, placement: 'viewport', positionX: 12, positionY: 30, moveDuration: 200, moveEasing: 'linear', movementBounds: 'none', onMoveEnd: e => moves.push(e.detail), onTransitionEnd: e => transitions.push(e.detail) };
  const f = await fixture(t, props);
  assert.equal(f.avatar.getAttribute('placement'), 'viewport'); assert.equal(f.avatar.getAttribute('position-x'), '12'); assert.equal(f.avatar.getAttribute('move-duration'), '200');
  assert.equal(f.avatar.getAttribute('body-color'), null, 'wrapper preserves canonical element default');
  f.avatar.dispatchEvent(new CustomEvent('sidekick-move-end', { detail: { finished: true, position: { x: 12, y: 30 } } }));
  f.avatar.dispatchEvent(new CustomEvent('sidekick-transition-end', { detail: { finished: false } }));
  assert.equal(moves.length, 1); assert.deepEqual(transitions, [{ finished: false }]);
  await f.render({ ...props, bodyColor: '#123456' }); assert.equal(f.avatar.getAttribute('body-color'), '#123456');
  await f.render(props); assert.equal(f.avatar.getAttribute('body-color'), null);
  await f.unmount(); assert.equal(ref.current, null);
});
