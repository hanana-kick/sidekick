import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import { createPackageConsumer } from './package-fixture.mjs';

let consumer, React, SidekickAvatar, createRoot, renderToString, dom;
before(async () => {
  consumer = createPackageConsumer({ react: true });
  const imported = file => import(pathToFileURL(join(consumer.directory, 'node_modules', file)).href);
  React = await imported('react/index.js');
  ({ SidekickAvatar } = await import(pathToFileURL(join(consumer.packagePath, 'dist/library/react.js')).href));
  ({ renderToString } = await imported('react-dom/server.node.js'));
  assert.equal(typeof HTMLElement, 'undefined');
  assert.equal(renderToString(React.createElement(SidekickAvatar, {
    behavior: { type: 'review', targets: '.item', dwell: 1000 }, onBehaviorChange() {}, onBehaviorEnd() {},
  })), '<sidekick-avatar></sidekick-avatar>');
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://behavior.test/' });
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'CustomEvent', 'Event']) {
    Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true, writable: true });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  class MockAvatar extends HTMLElement {
    ready = false;
    writes = [];
    listeners = new Map();
    addEventListener(name, listener, options) {
      const listeners = this.listeners.get(name) ?? new Set(); listeners.add(listener); this.listeners.set(name, listeners);
      super.addEventListener(name, listener, options);
    }
    removeEventListener(name, listener, options) { this.listeners.get(name)?.delete(listener); super.removeEventListener(name, listener, options); }
    connectedCallback() { this.ready = true; this.dispatchEvent(new CustomEvent('sidekick-ready', { detail: {} })); }
    setDesign() {}
    get behavior() { return this.writes.at(-1) ?? null; }
    set behavior(value) {
      assert.equal(this.isConnected, true, 'React must not assign behavior before insertion');
      if (value !== null && (!value || typeof value !== 'object' || value.type === 'unsupported')) throw new TypeError('Unknown behavior type');
      this.writes.push(value);
      this.dispatchEvent(new CustomEvent('sidekick-behavior-change', {
        detail: { id: this.writes.length, type: value?.type ?? null, status: value ? 'acting' : 'cancelled', itemIndex: -1, itemCount: 0, completedItems: 0 },
      }));
    }
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
  const unmount = async () => { if (live) { await React.act(async () => root.unmount()); live = false; container.remove(); } };
  t.after(unmount);
  return { container, avatar: container.querySelector('sidekick-avatar'), render, unmount };
}

test('React assigns behavior as a property after upgrade and listeners, before ref and readiness', async t => {
  const target = document.createElement('section'); document.body.append(target); t.after(() => target.remove());
  const behavior = { type: 'wait', target, side: 'left' };
  const changes = [], publications = [], readiness = [];
  const f = await fixture(t, {
    behavior,
    ref: node => { if (node) { assert.equal(node.behavior, behavior); publications.push(node); } },
    onBehaviorChange: event => changes.push(event),
    onReady: event => { assert.equal(publications.at(-1).behavior, behavior); readiness.push(event); },
  });
  assert.deepEqual(f.avatar.writes, [behavior]);
  assert.equal(f.avatar.behavior.target, target, 'Element identity must survive the wrapper');
  assert.equal(f.avatar.hasAttribute('behavior'), false);
  assert.equal(changes.length, 1, 'initial synchronous behavior event must not be lost');
  assert.equal(publications.length, 1);
  assert.equal(readiness.length, 1);
});

test('semantic equality preserves Element identities, ordered review snapshots, and changed same-object values', async t => {
  const first = document.createElement('section'), second = document.createElement('section');
  document.body.append(first, second); t.after(() => { first.remove(); second.remove(); });
  const f = await fixture(t, { behavior: { type: 'wait', target: first, gap: 16 } }, true);
  assert.equal(f.avatar.writes.length, 1, 'StrictMode must not restart the first declaration');
  await f.render({ behavior: { gap: 16, target: first, type: 'wait' } });
  assert.equal(f.avatar.writes.length, 1, 'key order and an inline object do not restart');
  await f.render({ behavior: { type: 'wait', target: second, gap: 16 } });
  assert.equal(f.avatar.writes.length, 2, 'different Elements are different targets');
  const behavior = { type: 'review', targets: [first, second], dwell: 1000 };
  await f.render({ behavior });
  await f.render({ behavior: { dwell: 1000, targets: [first, second], type: 'review' } });
  assert.equal(f.avatar.writes.length, 3, 'equal Element arrays do not restart review');
  behavior.targets.reverse();
  await f.render({ behavior });
  assert.equal(f.avatar.writes.length, 4, 'review order is meaningful');
  behavior.dwell = 200;
  await f.render({ behavior });
  assert.equal(f.avatar.writes.length, 5, 'mutating an already used declaration is detected');
  assert.equal(f.avatar.behavior.targets[0], second);
});

test('selector props, null, and omission cancel once without replaying an unchanged declaration', async t => {
  const f = await fixture(t, { id: 'uncontrolled' });
  assert.equal(f.avatar.writes.length, 0, 'omission does not claim imperative ownership');
  await f.render({ behavior: { type: 'guide', target: '#checkout' } });
  await f.render({ behavior: { target: '#checkout', type: 'guide' }, className: 'updated' });
  assert.equal(f.avatar.writes.length, 1);
  assert.equal(f.avatar.behavior.target, '#checkout');
  await f.render({ behavior: null });
  assert.equal(f.avatar.writes.length, 2);
  assert.equal(f.avatar.writes.at(-1), null);
  await f.render({});
  assert.equal(f.avatar.writes.length, 2);
  await f.render({ behavior: { type: 'idle' } });
  await f.render({});
  assert.equal(f.avatar.writes.length, 4);
  assert.equal(f.avatar.writes.at(-1), null);
});

test('invalid behavior props report onError once and preserve the previous native behavior', async t => {
  const errors = [];
  const f = await fixture(t, { behavior: { type: 'idle' } });
  const previous = f.avatar.behavior;
  const invalid = { type: 'unsupported' };
  await f.render({ behavior: invalid, onError: event => errors.push(event) });
  assert.equal(f.avatar.behavior, previous);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].detail.attribute, 'behavior');
  assert.match(errors[0].detail.message, /Unknown behavior/);
  await f.render({ behavior: { ...invalid }, onError: event => errors.push(event) });
  assert.equal(errors.length, 1, 'equivalent invalid declarations do not repeatedly report');
  await f.render({ behavior: 42, onError: event => errors.push(event) });
  assert.equal(errors.length, 2, 'invalid primitive input also reaches onError');
  await f.render({ behavior: 42, onError: event => errors.push(event) });
  assert.equal(errors.length, 2);
  await f.render({ behavior: { type: 'celebrate' }, onError: event => errors.push(event) });
  assert.equal(f.avatar.behavior.type, 'celebrate');
});

test('typed behavior callbacks receive original events, current handlers, and cleanup in StrictMode', async t => {
  const changes = [], endings = [];
  const f = await fixture(t, { onBehaviorChange: event => changes.push(['first', event]), onBehaviorEnd: event => endings.push(['first', event]) }, true);
  const change = new CustomEvent('sidekick-behavior-change', { detail: { id: 1, type: 'review', status: 'acting', itemIndex: 0, itemCount: 2, completedItems: 0 } });
  f.avatar.dispatchEvent(change);
  await f.render({ onBehaviorChange: event => changes.push(['next', event]), onBehaviorEnd: event => endings.push(['next', event]) });
  const end = new CustomEvent('sidekick-behavior-end', { detail: { id: 1, type: 'review', status: 'completed', completedItems: 2 } });
  f.avatar.dispatchEvent(change); f.avatar.dispatchEvent(end);
  assert.deepEqual(changes, [['first', change], ['next', change]]);
  assert.deepEqual(endings, [['next', end]]);
  assert.equal(f.avatar.listeners.get('sidekick-behavior-change').size, 1);
  await f.unmount();
  f.avatar.dispatchEvent(change); f.avatar.dispatchEvent(end);
  assert.equal(changes.length, 2); assert.equal(endings.length, 1);
  assert.equal(f.avatar.listeners.get('sidekick-behavior-change').size, 0);
  assert.equal(f.avatar.listeners.get('sidekick-behavior-end').size, 0);
});

for (const subpath of ['/react', '/browser/sidekick-react.js']) test(`SSR then delayed native upgrade preserves property targets: ${subpath}`, () => {
  const jsdom = new URL('../node_modules/jsdom/lib/api.js', import.meta.url).href;
  const output = consumer.run(['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { JSDOM } from ${JSON.stringify(jsdom)};
    import React, { act } from 'react';
    import { renderToString } from 'react-dom/server';
    import { SidekickAvatar } from ${JSON.stringify('@hanana-kick/sidekick' + subpath)};
    const props = { id: 'companion', behavior: { type: 'idle' } };
    const html = renderToString(React.createElement(SidekickAvatar, props));
    assert.equal(typeof HTMLElement, 'undefined');
    assert.equal(html, '<sidekick-avatar id="companion"></sidekick-avatar>');
    const dom = new JSDOM('<!doctype html><section id="target"></section><div id="root">' + html + '</div>', { url: 'https://test.invalid/' });
    for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'CustomEvent', 'Event', 'customElements', 'MutationObserver']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, devicePixelRatio: 1, matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }), ResizeObserver: class { observe() {} disconnect() {} }, IntersectionObserver: class { observe() {} disconnect() {} }, requestAnimationFrame: () => 0, cancelAnimationFrame() {} });
    dom.window.HTMLCanvasElement.prototype.getContext = () => null;
    const { hydrateRoot } = await import('react-dom/client');
    const original = document.querySelector('sidekick-avatar'), target = document.querySelector('#target');
    const events = [], errors = [], ref = React.createRef(); let root;
    await act(async () => { root = hydrateRoot(document.querySelector('#root'), React.createElement(React.StrictMode, null, React.createElement(SidekickAvatar, { ...props, ref, onBehaviorChange: event => events.push(event), onError: event => errors.push(event) }))); await new Promise(resolve => setTimeout(resolve, 100)); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 100)); });
    assert.equal(ref.current, original);
    assert.equal(typeof original.perform, 'function');
    assert.equal(Object.hasOwn(original, 'behavior'), false, 'no pre-upgrade own property may shadow the native setter');
    assert.equal(original.behavior.type, 'idle');
    assert.equal(original.hasAttribute('behavior'), false);
    const id = original.behaviorState.id;
    await act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(SidekickAvatar, { ...props, ref, behavior: { type: 'idle' } }))));
    assert.equal(original.behaviorState.id, id, 'equivalent inline props do not restart the actual controller');
    await act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(SidekickAvatar, { ...props, ref, behavior: { type: 'follow', target } }))));
    assert.equal(original.behavior.target, target);
    await act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(SidekickAvatar, { ref }))));
    assert.equal(original.behavior, null);
    assert.equal(original.behaviorState.status, 'cancelled');
    assert.ok(events.length > 0, 'behavior events reach the React wrapper after delayed upgrade');
    assert.equal(errors.length, 1); assert.match(errors[0].detail.message, /WebGL/);
    await act(async () => root.unmount()); assert.equal(ref.current, null);
    dom.window.close(); console.log('behavior delayed upgrade passed');
  `]);
  assert.match(output, /behavior delayed upgrade passed/);
});

test('behavior support keeps six browser files and the React entry renderer-lazy', () => {
  const directory = join(consumer.packagePath, 'dist/browser');
  assert.deepEqual(readdirSync(directory).sort(), ['sidekick.js', 'sidekick.iife.js', 'sidekick-react.js', 'sidekick-element.js', 'sidekick-fallback.js', 'sidekick.worker.js'].sort());
  const code = readFileSync(join(directory, 'sidekick-react.js'), 'utf8');
  const source = ts.createSourceFile('react.js', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const staticImports = [], dynamicImports = [];
  const visit = node => {
    if (ts.isImportDeclaration(node)) staticImports.push(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) dynamicImports.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.deepEqual(staticImports, ['react']);
  assert.deepEqual(dynamicImports, ['./sidekick-element.js']);
});

function typecheck(source, name, extension = 'tsx') {
  const file = join(consumer.directory, `${name}.${extension}`);
  const options = {
    strict: true, noEmit: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
    jsx: ts.JsxEmit.ReactJSX, lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  };
  const host = ts.createCompilerHost(options), original = host.getSourceFile.bind(host);
  host.getSourceFile = (path, languageVersion, ...rest) => path === file
    ? ts.createSourceFile(path, source, languageVersion, true, extension === 'tsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    : original(path, languageVersion, ...rest);
  const program = ts.createProgram([file], options, host), diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: path => path, getCurrentDirectory: () => consumer.directory, getNewLine: () => '\n',
  }));
}

test('public declarations preserve the behavior union and typed native/React event details', () => {
  typecheck(`
    import { SidekickAvatar } from '@hanana-kick/sidekick/react';
    import type { SidekickAvatarProps, BotBehavior as ReactBehavior } from '@hanana-kick/sidekick/react';
    import type { BotBehavior, BehaviorTarget, BehaviorSide, BehaviorPhase, BehaviorState, BehaviorResult, PerformOptions, SidekickAvatar as NativeAvatar } from '@hanana-kick/sidekick/register';
    const target: BehaviorTarget = document.createElement('section');
    const side: BehaviorSide = 'left';
    const declaration: BotBehavior = { type: 'wait', target, side };
    const reactDeclaration: ReactBehavior = declaration;
    const props: SidekickAvatarProps = {
      behavior: reactDeclaration,
      onBehaviorChange(event) { const state: BehaviorState = event.detail; const phase: BehaviorPhase = state.status; void phase; },
      onBehaviorEnd(event) { const result: BehaviorResult = event.detail; void result; },
    };
    const view = <SidekickAvatar {...props} />; void view;
    declare const avatar: NativeAvatar;
    const options: PerformOptions = { signal: new AbortController().signal };
    const pending: Promise<BehaviorResult> = avatar.perform(declaration, options); void pending;
    avatar.behavior = { type: 'review', targets: [document.createElement('section')], dwell: 500 };
    avatar.behavior = null; avatar.stopBehavior();
    avatar.addEventListener('sidekick-behavior-change', event => { const state: BehaviorState = event.detail; void state; });
    avatar.addEventListener('sidekick-behavior-end', event => { const result: BehaviorResult = event.detail; void result; });
    // @ts-expect-error review uses targets, not target
    const wrongReview: BotBehavior = { type: 'review', target: '#item' };
    // @ts-expect-error unsupported behavior type
    const wrongType: BotBehavior = { type: 'thinking' };
    // @ts-expect-error selector arrays are not Element arrays
    const wrongTargets: BotBehavior = { type: 'review', targets: ['#one'] };
    // @ts-expect-error behavior end status is terminal only
    const wrongStatus: BehaviorResult['status'] = 'moving';
  `, 'behavior-types');
});

test('README loading, sequential review, and React status examples compile against the shipped API', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  for (const [heading, language, name, extension] of [
    ['## 선언형 행동 (behavior)', 'ts', 'behavior-api', 'mts'],
    ['### 실제 로딩이 끝날 때까지 기다리기', 'ts', 'behavior-loading', 'mts'],
    ['### 항목을 순서대로 검토하기', 'ts', 'behavior-review', 'mts'],
    ['### React: 앱 상태를 행동에 연결하기', 'tsx', 'behavior-status', 'tsx'],
  ]) {
    const start = readme.indexOf(heading); assert.notEqual(start, -1);
    const source = readme.slice(start).match(new RegExp('```' + language + '\\n([\\s\\S]*?)\\n```'))?.[1];
    assert.ok(source); typecheck(source, name, extension);
  }
});

test('React emotion attributes and listeners update without restarting the declared behavior', async t => {
  const behavior={type:'idle'},events=[];
  const f=await fixture(t,{behavior,emotion:'curious',emotionIntensity:.6,onEmotionChange:event=>events.push(event.detail)});
  assert.equal(f.avatar.getAttribute('emotion'),'curious');assert.equal(f.avatar.getAttribute('emotion-intensity'),'0.6');
  const before=f.avatar.writes.length;
  await f.render({behavior,emotion:'happy',emotionIntensity:.8,onEmotionChange:event=>events.push(event.detail)});
  assert.equal(f.avatar.writes.length,before);
  f.avatar.dispatchEvent(new CustomEvent('sidekick-emotion-change',{detail:{emotion:'happy'}}));assert.equal(events.length,1);
  await f.render({behavior});assert.equal(f.avatar.hasAttribute('emotion'),false);assert.equal(f.avatar.hasAttribute('emotion-intensity'),false);
  assert.equal(f.avatar.writes.length,before);
});

test('public emotion native/React contracts expose typed fields, results and events', () => {
  typecheck(`
    import { SidekickAvatar } from '@hanana-kick/sidekick/react';
    import type { Emotion, EmotionState, EmotionResult, SidekickAvatar as NativeAvatar } from '@hanana-kick/sidekick/register';
    declare const bot: NativeAvatar;
    const emotion: Emotion='curious'; bot.emotion=emotion; bot.emotionIntensity=.6;
    bot.setEmotion('sad',{intensity:.3});
    const reaction: Promise<EmotionResult>=bot.reactTo('happy',{duration:900,intensity:.9}); void reaction;
    bot.cancelReaction(); const state: EmotionState=bot.emotionState; void state;
    bot.addEventListener('sidekick-emotion-change',event=>{ const state:EmotionState=event.detail; void state; });
    const view=<SidekickAvatar emotion={emotion} emotionIntensity={.6} onReactionEnd={event=>{const result:EmotionResult=event.detail;void result;}}/>;void view;
    // @ts-expect-error unsupported emotion
    bot.setEmotion('angry');
    // @ts-expect-error duration is only available for transient reactions
    bot.setEmotion('happy',{duration:900});
    // @ts-expect-error emotion intensity is numeric
    const bad=<SidekickAvatar emotionIntensity="strong"/>;
  `,'emotion-types');
});
