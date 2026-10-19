import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import { createPackageConsumer } from './package-fixture.mjs';

let consumer, React, SidekickAvatar, createRoot, renderToString, dom;
const lifecycleNames = ['home', 'presence', 'task'];

function inspectData(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || value instanceof Element) return;
  if (seen.has(value)) throw new TypeError('cyclic lifecycle declaration');
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!Object.hasOwn(descriptor, 'value')) throw new TypeError('lifecycle declarations require ordinary data properties');
    inspectData(descriptor.value, seen);
  }
  seen.delete(value);
}

before(async () => {
  consumer = createPackageConsumer({ react: true });
  const imported = file => import(pathToFileURL(join(consumer.directory, 'node_modules', file)).href);
  React = await imported('react/index.js');
  ({ SidekickAvatar } = await import(pathToFileURL(join(consumer.packagePath, 'dist/library/react.js')).href));
  ({ renderToString } = await imported('react-dom/server.node.js'));
  assert.equal(typeof HTMLElement, 'undefined');
  assert.equal(renderToString(React.createElement(SidekickAvatar, {
    presence: { visible: true, entrance: { source: 'viewport', edge: 'left' } },
    home: { positioning: { target: 'viewport' } },
    task: { id: 'request-1', status: 'pending', behavior: { type: 'wait', target: '#work' } },
    onLifecycleChange() {},
  })), '<sidekick-avatar></sidekick-avatar>');
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lifecycle-react.test/' });
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'CustomEvent', 'Event']) {
    Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true, writable: true });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  class MockAvatar extends HTMLElement {
    ready = false;
    writes = { home: [], presence: [], task: [] };
    writeOrder = [];
    listeners = new Map();
    addEventListener(name, listener, options) {
      const listeners = this.listeners.get(name) ?? new Set();
      listeners.add(listener); this.listeners.set(name, listeners);
      super.addEventListener(name, listener, options);
    }
    removeEventListener(name, listener, options) {
      this.listeners.get(name)?.delete(listener); super.removeEventListener(name, listener, options);
    }
    connectedCallback() { this.ready = true; this.dispatchEvent(new CustomEvent('sidekick-ready', { detail: {} })); }
    setDesign() {}
    write(name, value) {
      assert.equal(this.isConnected, true, 'declarations are assigned only after insertion and upgrade');
      inspectData(value);
      if (value !== null && (!value || typeof value !== 'object' || value.invalid)) throw new TypeError(`invalid ${name}`);
      this.writes[name].push(value); this.writeOrder.push(name);
      this.dispatchEvent(new CustomEvent('sidekick-lifecycle-change', {
        detail: { phase: 'working', taskId: this.task?.id ?? null, taskStatus: this.task?.status ?? null },
      }));
    }
    get presence() { return this.writes.presence.at(-1) ?? null; }
    set presence(value) { this.write('presence', value); }
    get task() { return this.writes.task.at(-1) ?? null; }
    set task(value) { this.write('task', value); }
    get home() { return this.writes.home.at(-1) ?? null; }
    set home(value) { this.write('home', value); }
  }
  dom.window.customElements.define('sidekick-avatar', MockAvatar);
  ({ createRoot } = await imported('react-dom/client.js'));
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
  const unmount = async () => {
    if (live) { await React.act(async () => root.unmount()); live = false; container.remove(); }
  };
  t.after(unmount);
  return { avatar: container.querySelector('sidekick-avatar'), render, unmount };
}

function targets(t) {
  const first = document.createElement('section'), second = document.createElement('section');
  document.body.append(first, second); t.after(() => { first.remove(); second.remove(); });
  return [first, second];
}

test('lifecycle props are upgraded properties with listeners installed before ref and ready', async t => {
  const [target] = targets(t), changes = [], refs = [], ready = [];
  const presence = { visible: true, entrance: { source: 'element', target, direction: 'right' } };
  const home = { positioning: { target, offset: { x: 2, y: 4 } }, rest: { behavior: { type: 'idle' }, gaze: { x: 0, y: 0 } } };
  const task = { id: 'work', status: 'pending', behavior: { type: 'wait', target } };
  const f = await fixture(t, {
    presence, home, task,
    onLifecycleChange: event => changes.push(event),
    ref: node => {
      if (node) { assert.equal(node.home, home); assert.equal(node.presence, presence); assert.equal(node.task, task); refs.push(node); }
    },
    onReady: event => { assert.equal(refs.at(-1).task, task); ready.push(event); },
  });
  assert.deepEqual(f.avatar.writeOrder, ['home', 'presence', 'task']);
  assert.equal(f.avatar.home.positioning.target, target);
  assert.equal(f.avatar.presence.entrance.target, target);
  assert.equal(f.avatar.task.behavior.target, target);
  assert.equal(changes.length, 3, 'initial synchronous native events are observed');
  assert.equal(refs.length, 1); assert.equal(ready.length, 1);
  for (const name of lifecycleNames) assert.equal(f.avatar.hasAttribute(name), false);
});

test('nested inline lifecycle props are semantic and StrictMode idempotent', async t => {
  const [first, second] = targets(t);
  const values = () => ({
    presence: { visible: true, entrance: { source: 'element', target: first, direction: 'right' }, exit: { to: 'left', duration: 200 } },
    home: { positioning: { target: first, offset: { x: 3, y: 5 } }, rest: { bodyOrientation: { yaw: 10 }, gaze: { x: .2, y: .3 } }, returnOn: ['success', 'error'] },
    task: { id: 1, status: 'pending', behavior: { type: 'review', targets: [first, second], dwell: 100 } },
  });
  const f = await fixture(t, values(), true);
  await f.render(values());
  const reordered = values();
  reordered.task = { behavior: { dwell: 100, targets: [first, second], type: 'review' }, status: 'pending', id: 1 };
  await f.render(reordered);
  for (const name of lifecycleNames) assert.equal(f.avatar.writes[name].length, 1, `${name} does not restart`);
  const mutable = values();
  await f.render(mutable);
  mutable.task.behavior.targets.reverse(); await f.render(mutable);
  assert.equal(f.avatar.writes.task.length, 2, 'ordered Element arrays are copied');
  mutable.task.behavior.targets[0] = first; await f.render(mutable);
  assert.equal(f.avatar.writes.task.length, 3, 'nested target identity is preserved');
  mutable.task.status = 'success'; mutable.task.reaction = { emotion: 'happy', intensity: .6 }; await f.render(mutable);
  assert.equal(f.avatar.writes.task.length, 4);
  mutable.task.reaction.intensity = .8; await f.render(mutable);
  assert.equal(f.avatar.writes.task.length, 5, 'nested reaction mutation is detected');
  mutable.presence.exit.duration = 300; await f.render(mutable);
  assert.equal(f.avatar.writes.presence.length, 2, 'nested exit mutation is detected');
  mutable.presence.entrance.target = second; await f.render(mutable);
  assert.equal(f.avatar.writes.presence.length, 3, 'entrance target identity is significant');
  mutable.home.positioning.offset.x = 4; await f.render(mutable);
  mutable.home.rest.bodyOrientation.yaw = 20; await f.render(mutable);
  mutable.home.rest.gaze.y = -.2; await f.render(mutable);
  mutable.home.returnOn.push('cancelled'); await f.render(mutable);
  assert.equal(f.avatar.writes.home.length, 5, 'home nested values and returnOn are copied');
  mutable.home.rest.gaze = { target: first }; await f.render(mutable);
  mutable.home.rest.gaze.target = second; await f.render(mutable);
  assert.equal(f.avatar.writes.home.length, 7, 'rest gaze targets retain identity in nested snapshots');
});

test('null clears once and omission only releases declarations previously owned by React', async t => {
  const f = await fixture(t, {}, true);
  for (const name of lifecycleNames) assert.equal(f.avatar.writes[name].length, 0);
  const native = { positioning: { target: 'viewport' } };
  f.avatar.home = native;
  await f.render({ className: 'unrelated' });
  assert.equal(f.avatar.home, native); assert.equal(f.avatar.writes.home.length, 1);
  await f.render({ home: { positioning: { target: '#home' } }, presence: { visible: true }, task: { id: 'a', status: 'pending' } });
  await f.render({ home: null, presence: null, task: null });
  await f.render({});
  assert.equal(f.avatar.writes.home.length, 3);
  assert.equal(f.avatar.writes.presence.length, 2); assert.equal(f.avatar.writes.task.length, 2);
  await f.render({ presence: { visible: false }, task: { id: 'b', status: 'pending' } });
  await f.render({}); await f.render({});
  assert.equal(f.avatar.writes.presence.length, 4); assert.equal(f.avatar.writes.task.length, 4);
  for (const name of lifecycleNames) assert.equal(f.avatar[name], null);
});

test('invalid lifecycle props report once, preserve native values, and never invoke accessors', async t => {
  const errors = [], onError = event => errors.push(event.detail);
  const f = await fixture(t, { home: { positioning: { target: 'viewport' } }, presence: { visible: true }, task: { id: 'a', status: 'pending' }, onError });
  const previous = Object.fromEntries(lifecycleNames.map(name => [name, f.avatar[name]]));
  const invalid = { home: { invalid: true }, presence: { invalid: true }, task: { invalid: true }, onError };
  await f.render(invalid); await f.render({ ...invalid, task: { invalid: true } });
  assert.equal(errors.length, 3);
  assert.deepEqual(errors.map(error => error.attribute), ['home', 'presence', 'task']);
  for (const name of lifecycleNames) assert.equal(f.avatar[name], previous[name]);
  let getterCalls = 0;
  const target = { get target() { getterCalls++; throw new Error('must not read accessor'); } };
  const task = { id: 'a', status: 'pending', behavior: target };
  const presence = { visible: true, entrance: target };
  const home = { positioning: target };
  await f.render({ home, presence, task, onError }); await f.render({ home, presence, task, onError });
  assert.equal(getterCalls, 0); assert.equal(errors.length, 6);
  const array = [];
  Object.defineProperty(array, '0', { enumerable: true, get() { getterCalls++; throw new Error('must not read array accessor'); } });
  const badArray = { id: 'a', status: 'pending', behavior: { type: 'review', targets: array } };
  await f.render({ task: badArray, onError }); await f.render({ task: badArray, onError });
  assert.equal(getterCalls, 0); assert.equal(errors.length, 7);
  const cyclic = { id: 'a', status: 'pending' }; cyclic.self = cyclic;
  await f.render({ task: cyclic, onError }); await f.render({ task: cyclic, onError });
  assert.equal(errors.length, 8, 'cyclic invalid declarations do not overflow wrapper snapshotting');
});

test('lifecycle events retain original identity, use current callbacks, and are cleaned up', async t => {
  const calls = [], f = await fixture(t, { onLifecycleChange: event => calls.push(['first', event]) }, true);
  const event = new CustomEvent('sidekick-lifecycle-change', { detail: { phase: 'resting', taskId: 'a', taskStatus: 'success' } });
  f.avatar.dispatchEvent(event);
  await f.render({ onLifecycleChange: event => calls.push(['second', event]) });
  f.avatar.dispatchEvent(event);
  assert.deepEqual(calls, [['first', event], ['second', event]]);
  assert.equal(f.avatar.listeners.get('sidekick-lifecycle-change').size, 1);
  await f.unmount(); f.avatar.dispatchEvent(event);
  assert.equal(calls.length, 2); assert.equal(f.avatar.listeners.get('sidekick-lifecycle-change').size, 0);
});

function typecheck(source, name) {
  const file = join(consumer.directory, `${name}.tsx`);
  const options = { strict: true, noEmit: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext, jsx: ts.JsxEmit.ReactJSX,
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'] };
  const host = ts.createCompilerHost(options), original = host.getSourceFile.bind(host);
  host.getSourceFile = (path, languageVersion, ...rest) => path === file
    ? ts.createSourceFile(path, source, languageVersion, true, ts.ScriptKind.TSX) : original(path, languageVersion, ...rest);
  const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([file], options, host));
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: path => path, getCurrentDirectory: () => consumer.directory, getNewLine: () => '\n',
  }));
}

test('every public entry exports the lifecycle contract and native/React events are typed', () => {
  for (const path of ['', '/auto', '/register', '/core', '/react']) {
    typecheck(`
      import type { SidekickPresence, SidekickTask, SidekickTaskStatus, SidekickTerminalStatus, SidekickReaction, SidekickHome, SidekickRest, SidekickLifecycleDeclaration, SidekickLifecyclePhase, SidekickLifecycleState } from '@hanana-kick/sidekick${path}';
      const presence: SidekickPresence = { visible: true, entrance: { source: 'element', target: document.body, direction: 'right' }, exit: { to: 'left', duration: 200 } };
      const task: SidekickTask = { id: 'request', status: 'success', behavior: { type: 'review', targets: [document.body] }, reaction: { emotion: 'happy', duration: 200, intensity: .5 } };
      const home: SidekickHome = { positioning: { target: document.body }, rest: { behavior: { type: 'idle' }, emotion: 'neutral', emotionIntensity: .5, trackingMode: 'off', gaze: { x: 0, y: 0 }, bodyOrientation: 'front' }, returnOn: ['success', 'error', 'cancelled'] };
      const state: SidekickLifecycleState = { phase: 'resting', taskId: task.id, taskStatus: task.status };
      const phase: SidekickLifecyclePhase = state.phase, status: SidekickTaskStatus = task.status, terminal: SidekickTerminalStatus = 'success';
      const reaction: SidekickReaction = { emotion: 'happy' }, rest: SidekickRest = { activity: 'idle', gaze: { target: document.body } };
      const declaration: SidekickLifecycleDeclaration = { presence, task, home };
      void presence; void task; void home; void state; void phase; void status; void terminal; void reaction; void rest; void declaration;
      // @ts-expect-error presence visibility is boolean
      const invalidPresence: SidekickPresence = { visible: 'true' };
      // @ts-expect-error task requires a stable id
      const invalidTask: SidekickTask = { status: 'pending' };
      // @ts-expect-error returnOn only accepts terminal statuses
      const invalidHome: SidekickHome = { positioning: { target: 'viewport' }, returnOn: ['pending'] };
      // @ts-expect-error resting behavior cannot target another element
      const movingHome: SidekickHome = { positioning: { target: 'viewport' }, rest: { behavior: { type: 'follow', target: document.body } } };
    `, `lifecycle-${path.replace('/', '') || 'index'}`);
  }
  typecheck(`
    import { SidekickAvatar } from '@hanana-kick/sidekick/react';
    import type { SidekickAvatarProps, SidekickAvatarRef, SidekickLifecycleState } from '@hanana-kick/sidekick/react';
    import type { SidekickAvatar as NativeAvatar, SidekickAttributes, SidekickEventMap } from '@hanana-kick/sidekick/register';
    declare const native: NativeAvatar; const ref: SidekickAvatarRef = native;
    native.presence = { visible: true }; native.task = { id: 1, status: 'pending' }; native.home = { positioning: { target: 'viewport' } };
    const state: SidekickLifecycleState = native.lifecycleState;
    native.addEventListener('sidekick-lifecycle-change', event => { const current: SidekickLifecycleState = event.detail; void current; });
    const attributes: SidekickAttributes = { presence: '{"visible":true}', task: '{"id":1,"status":"pending"}', home: '{"positioning":{"target":"viewport"}}' };
    const props: SidekickAvatarProps = { presence: null, task: null, home: null, onLifecycleChange(event) { const detail: SidekickLifecycleState = event.detail; void detail; } };
    const event: SidekickEventMap['sidekick-lifecycle-change'] = new CustomEvent('sidekick-lifecycle-change', { detail: state });
    const view = <SidekickAvatar {...props} />; void ref; void attributes; void view; void event;
    // @ts-expect-error task status is a finite union
    const invalid = <SidekickAvatar task={{ id: 1, status: 'complete' }} />;
  `, 'lifecycle-native-react');
});

test('lifecycle React entry keeps SSR safe, lazy runtime loading and six browser bundles', () => {
  const directory = join(consumer.packagePath, 'dist/browser');
  assert.deepEqual(readdirSync(directory).sort(), ['sidekick.js', 'sidekick.iife.js', 'sidekick-react.js', 'sidekick-element.js', 'sidekick-fallback.js', 'sidekick.worker.js'].sort());
  const source = ts.createSourceFile('react.js', readFileSync(join(directory, 'sidekick-react.js'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const staticImports = [], dynamicImports = [];
  const visit = node => {
    if (ts.isImportDeclaration(node)) staticImports.push(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) dynamicImports.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.deepEqual(staticImports, ['react']); assert.deepEqual(dynamicImports, ['./sidekick-element.js']);
});

for (const subpath of ['/react', '/browser/sidekick-react.js']) test(`SSR then delayed upgrade preserves nested lifecycle targets: ${subpath}`, () => {
  const jsdom = new URL('../node_modules/jsdom/lib/api.js', import.meta.url).href;
  const output = consumer.run(['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { JSDOM } from ${JSON.stringify(jsdom)};
    import React, { act } from 'react';
    import { renderToString } from 'react-dom/server';
    import { SidekickAvatar } from ${JSON.stringify('@hanana-kick/sidekick' + subpath)};
    const props = { id: 'companion', presence: { visible: false }, home: { positioning: { target: 'viewport' } }, task: { id: 'load', status: 'pending' } };
    const html = renderToString(React.createElement(SidekickAvatar, props));
    assert.equal(typeof HTMLElement, 'undefined');
    assert.equal(html, '<sidekick-avatar id="companion"></sidekick-avatar>');
    const dom = new JSDOM('<!doctype html><section id="target"></section><div id="root">' + html + '</div>', { url: 'https://test.invalid/' });
    for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'CustomEvent', 'Event', 'customElements', 'MutationObserver']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, devicePixelRatio: 1, matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }), ResizeObserver: class { observe() {} disconnect() {} }, IntersectionObserver: class { observe() {} disconnect() {} }, requestAnimationFrame: () => 0, cancelAnimationFrame() {} });
    dom.window.HTMLCanvasElement.prototype.getContext = () => null;
    const { hydrateRoot } = await import('react-dom/client');
    const original = document.querySelector('sidekick-avatar'), target = document.querySelector('#target');
    const errors = [], ref = React.createRef();
    const configuration = () => ({ ...props,
      presence: { visible: false, entrance: { source: 'element', target, direction: 'right' } },
      home: { positioning: { target, offset: { x: 3, y: 4 } }, rest: { gaze: { x: .2, y: .3 }, trackingMode: 'off' } },
      task: { id: 'load', status: 'pending', behavior: { type: 'review', targets: [target], dwell: 100 } },
    });
    let root;
    await act(async () => { root = hydrateRoot(document.querySelector('#root'), React.createElement(React.StrictMode, null, React.createElement(SidekickAvatar, { ...configuration(), ref, onError: event => errors.push(event) }))); await new Promise(resolve => setTimeout(resolve, 100)); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 100)); });
    assert.equal(ref.current, original);
    for (const name of ['presence', 'home', 'task']) {
      assert.equal(Object.hasOwn(original, name), false, 'React must never create a pre-upgrade property shadow');
      assert.equal(original.hasAttribute(name), false);
    }
    assert.equal(original.presence.entrance.target, target);
    assert.equal(original.home.positioning.target, target);
    assert.equal(original.task.behavior.targets[0], target);
    await act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(SidekickAvatar, { ...configuration(), ref }))));
    assert.equal(original.task.id, 'load');
    assert.equal(original.home.positioning.offset.x, 3);
    assert.ok(errors.some(event => /WebGL/.test(event.detail.message)), 'renderer failure still reaches onError during hydration');
    await act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(SidekickAvatar, { ref }))));
    assert.equal(original.presence, null); assert.equal(original.task, null); assert.equal(original.home, null);
    await act(async () => root.unmount()); assert.equal(ref.current, null);
    dom.window.close(); console.log('lifecycle delayed upgrade passed');
  `]);
  assert.match(output, /lifecycle delayed upgrade passed/);
});
