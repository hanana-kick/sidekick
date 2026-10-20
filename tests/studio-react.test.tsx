import { setSiteLocale, getSiteLocale } from '../playground/site-i18n.js';
import { STUDIO_TEXT, STUDIO_SHAPES, STUDIO_ACCESSORIES, studioText, studioShapeLabel, studioAccessoryLabel, studioMessage } from '../playground/studio-locales.js';
import { STUDIO_SESSION_KEY, loadStudioSession, applyStudioSession } from '../playground/studio-session.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createElement, act, StrictMode } from 'react';
import { createAccessory, createDesign, migrateDesign, parseDesign, patchDesign, serializeDesign } from '../src/core/design.js';
import type { AvatarDesign, DesignPatch, Activity } from '../src/core/design.js';
import { BODY_ORIENTATION_PRESETS, createBodyOrientation } from '../src/core/body-orientation.js';
import type { BodyOrientation, BodyOrientationPreset } from '../src/core/body-orientation.js';
import { eyeExpressionWeights } from '../src/core/expressions.js';
import type { EyeExpression, EyeShapeWeights } from '../src/core/expressions.js';
import type { MaterialShapeName } from '../src/core/shapes.js';
import { createScene, parseScene, serializeScene, migrateScene, MAX_SCENE_BYTES } from '../src/core/scene.js';
import { sceneSnippets, escapeHTMLAttribute } from '../playground/studio-snippets.js';
import ts from 'typescript';
import { StudioController, STORAGE_KEY } from '../playground/studio-controller.js';

// Deliberately layout-free: real ReactDOM + Radix interactions against a mock
// renderer boundary. These tests do not claim CSS/WebGL/browser verification.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://studio.test/', pretendToBeVisual: true });
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLFormElement', 'HTMLSelectElement', 'HTMLButtonElement', 'ShadowRoot', 'NodeFilter', 'Element', 'Node', 'DocumentFragment', 'CustomEvent', 'Event', 'MouseEvent', 'KeyboardEvent', 'MutationObserver', 'getComputedStyle'] as const) {
  Object.defineProperty(globalThis, key, { value: key === 'getComputedStyle' ? dom.window.getComputedStyle.bind(dom.window) : dom.window[key], configurable: true, writable: true });
}
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window), ResizeObserver: class { observe() {} unobserve() {} disconnect() {} } });
HTMLElement.prototype.scrollIntoView = () => {};
HTMLElement.prototype.hasPointerCapture = () => false;
HTMLElement.prototype.setPointerCapture = () => {};
HTMLElement.prototype.releasePointerCapture = () => {};

class MockAvatar extends HTMLElement {
  current = createDesign();
  bodyOrientationValue = createBodyOrientation();
  zoomValue = 1;
  get zoom() { return this.zoomValue; }
  set zoom(value: number) { this.zoomValue = value; this.dispatchEvent(new CustomEvent('sidekick-zoom-change')); }
  paused = false;
  trackingMode: 'off' | 'eyes' | 'eyes-and-body' = 'eyes-and-body';
  get mouseTracking() { return this.trackingMode !== 'off'; }
  resetTracking() {}
  interaction: 'none' | 'box' = 'none';
  cancelCalls = 0;
  motionCalls: unknown[] = [];
  gaze = { x: 0, y: 0 };
  time = 0;
  activity: Activity = 'idle';
  connections = 0;
  disconnections = 0;
  assignments = 0;
  shapeCalls: { shape: string; before: string; options: unknown }[] = [];
  patchCalls: DesignPatch[] = [];
  eyeCalls: { side: string; weights: unknown }[] = [];
  morphing = false;
  motion = { cancel: () => { this.cancelCalls++; }, to: (target: unknown) => { this.motionCalls.push(target); return Promise.resolve({ finished: true }); } };
  connectedCallback() { this.connections++; }
  disconnectedCallback() { this.disconnections++; }
  get design() { return parseDesign(this.current); }
  set design(value: AvatarDesign) { this.assignments++; if (value.body.shape !== this.current.body.shape) this.morphing = false; this.current = parseDesign(value); }
  get bodyOrientation() { return { ...this.bodyOrientationValue }; }
  set bodyOrientation(value: BodyOrientation) { this.setBodyOrientation(value); }
  updateDesign(patch: DesignPatch) { this.patchCalls.push(patch); const next = patchDesign(this.current, patch); if (next.body.shape !== this.current.body.shape) this.morphing = false; this.current = next; return Promise.resolve(); }
  setShape(shape: MaterialShapeName, options: { duration?: number } = {}) { this.shapeCalls.push({ shape, before: this.current.body.shape, options }); this.current = patchDesign(this.current, { body: { shape } }); this.morphing = !!options.duration; return Promise.resolve({ finished: true }); }
  setEyeWeights(side: 'left' | 'right', weights: Partial<EyeShapeWeights>) { this.eyeCalls.push({ side, weights }); this.current = patchDesign(this.current, { eyes: { [side]: { weights } } }); return Promise.resolve({ finished: true }); }
  setExpression(side: 'left' | 'right', expression: EyeExpression) { return this.setEyeWeights(side, eyeExpressionWeights(expression)); }
  setBodyOrientation(value: Partial<BodyOrientation>) { this.bodyOrientationValue = { ...this.bodyOrientationValue, ...value }; this.dispatchEvent(new CustomEvent('sidekick-body-orientation-change')); }
  setBodyOrientationPreset(preset: BodyOrientationPreset) { this.setBodyOrientation(BODY_ORIENTATION_PRESETS[preset]); }
  resetBodyOrientation() { this.setBodyOrientation(createBodyOrientation()); }
  setActivity(activity: Activity) { this.activity = activity; }
  lookAt(target: { x: number; y: number }) { this.gaze = { x: target.x, y: target.y }; }
  seek(time: number) { this.time = time; }
  snapshot() { return Promise.resolve(new Blob(['mock'], { type: 'image/png' })); }
}
dom.window.customElements.define('sidekick-avatar', MockAvatar);
const { createRoot } = await import('react-dom/client');
const { StudioApp } = await import('../playground/studio-app');
function store(saved: Record<string, string> = {}, failBackup = false) {
  const values = new Map(Object.entries(saved)), writes: string[] = [];
  return { values, writes, getItem: (key: string) => values.get(key) ?? null, setItem(key: string, value: string) { writes.push(key); if (failBackup && key.endsWith('.recovery')) throw new Error('quota'); values.set(key, value); } };
}
async function fixture(t: { after: (fn: () => Promise<void>) => void }, saved: Record<string, string> = {}, failBackup = false, strict = false) {
  setSiteLocale('ko');
  const storage = store(saved, failBackup), controller = new StudioController(storage), container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  await act(async () => { const app = createElement(StudioApp, { controller }); root.render(strict ? createElement(StrictMode, {}, app) : app); });
  let mounted = true;
  const unmount = async () => { if (mounted) { await act(async () => root.unmount()); container.remove(); mounted = false; } };
  t.after(unmount);
  const node = <T extends HTMLElement = HTMLElement>(id: string): T => { const element = container.querySelector<T>(`#${id}`); assert.ok(element, `Missing ${id}`); return element; };
  const avatar = node<MockAvatar>('flat');
  const click = async (element: HTMLElement) => act(async () => { element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })); element.click(); });
  const input = async (id: string, value: string) => act(async () => { const element = node<HTMLInputElement | HTMLTextAreaElement>(id); const prototype = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })); });
  const equipment = (slot: string, preset: string) => click(container.querySelector<HTMLElement>(`[data-equipment="${slot}"][data-accessory="${preset}"]`)!);
  const shape = (name: string) => click(container.querySelector<HTMLElement>(`[data-shape="${name}"]`)!);
  const key = async (id: string, key: string) => act(async () => { const element = node(id); element.focus(); element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    // Radix roving focus queues focusFirst with setTimeout; selection changes in onFocus.
    // Drain that already queued timer before act flushes the resulting React update.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  });
  return { container, root, controller, avatar, storage, node, click, input, equipment, shape, key, unmount };
}
function assertMinimal(design: AvatarDesign) {
  assert.equal(design.version, 7); assert.deepEqual(Object.keys(design.body).sort(), ['color', 'shape']);
  assert.deepEqual(Object.keys(design.eyes).sort(), ['color', 'left', 'right']);
  for (const side of ['left', 'right'] as const) assert.deepEqual(Object.keys(design.eyes[side]), ['weights']);
  for (const item of design.accessories) assert.deepEqual(Object.keys(item).sort(), ['color', 'id', 'preset', 'slot']);
}

test('Studio exposes its active destination and the API playground in the top-level header', async t => {
  const f = await fixture(t);
  const navigation = f.container.querySelector('.app-header nav[aria-label="Sidekick 메뉴"]');
  assert.ok(navigation);
  assert.equal(navigation.querySelector('[aria-current="page"]')?.textContent, '스튜디오');
  const api = f.node<HTMLAnchorElement>('api-playground-link');
  assert.equal(api.textContent, 'API 체험');
  assert.equal(new URL(api.href).pathname, '/api-playground.html');
});

test('React uses genuine shadcn controls, correct tab relationships and named slider thumbs', async t => {
  const f = await fixture(t);
  assert.ok(f.container.querySelector('[data-slot="button"]')); assert.ok(f.container.querySelector('[data-slot="toggle-group"]'));
  assert.equal(f.container.querySelectorAll('sidekick-avatar:not(.brand-avatar)').length, 1);
  for (const tab of f.container.querySelectorAll('[role="tab"]')) {
    const panel = f.node(tab.getAttribute('aria-controls')!);
    assert.equal(panel.getAttribute('aria-labelledby'), tab.id);
  }
  for (const slider of f.container.querySelectorAll('[role="slider"]')) {
    const label = f.node(slider.getAttribute('aria-labelledby')!);
    assert.ok(label.textContent?.length); assert.ok(slider.getAttribute('aria-valuetext'));
  }
  const appearance = f.node('appearance-panel');
  assert.equal(appearance.querySelectorAll('[role="slider"]').length, 0);
  assert.equal(appearance.querySelectorAll('[data-shape]').length, 35);
  assert.equal(f.node('eyes-panel').querySelectorAll('input').length, 1);
  assert.equal(f.node('eye-color').getAttribute('type'), 'color');
  assert.deepEqual(f.avatar.design.accessories.map(item => item.preset), ['beret']);
  assertMinimal(f.avatar.design);
});

test('keyboard tabs/sliders and shape focus update through React without remounting the avatar', async t => {
  const f = await fixture(t), avatar = f.avatar;
  await act(async () => { avatar.setBodyOrientation({ yaw: 42, pitch: 11, roll: 7 }); });
  const assignments = avatar.assignments;
  const heart = f.container.querySelector<HTMLElement>('[data-shape="heart"]')!;
  heart.focus(); await f.shape('heart');
  assert.equal(document.activeElement, heart); assert.equal(avatar.shapeCalls[0]!.before, 'square');
  assert.equal(avatar.shapeCalls[0]!.shape, 'heart'); assert.equal(avatar.morphing, true);
  await f.input('body-color', '#a4b8c9'); await f.equipment('neck', 'scarf');
  assert.equal(avatar.shapeCalls.length, 1); assert.equal(avatar.morphing, true);
  await f.key('appearance-tab', 'ArrowRight');
  assert.equal(document.activeElement, f.node('animation-tab'));
  assert.equal(f.node('animation-tab').getAttribute('aria-selected'), 'true');
  await f.key('left-smile-weight', 'ArrowRight');
  assert.equal(avatar.design.eyes.left.weights.smile, .01);
  await f.click(f.node('body-orientation-tab')); await f.key('body-yaw', 'ArrowRight');
  assert.equal(avatar.bodyOrientation.yaw, 43);
  await f.click(f.node('json-tab')); await f.input('design-json', '{ invalid draft');
  await f.click(f.node('appearance-tab')); await f.input('eye-color', '#121212');
  assert.equal(f.node('flat'), avatar); assert.equal(avatar.connections, 1); assert.equal(avatar.disconnections, 0);
  assert.equal(avatar.assignments, assignments); assert.equal(avatar.morphing, true);
  assert.deepEqual(avatar.bodyOrientation, { yaw: 43, pitch: 11, roll: 7 });
  assert.equal(f.container.querySelector('[data-shape="heart"]'), heart);
});

test('tracking mode choices survive UI edits, round-trip in scenes and reset without a remount', async t => {
  const f = await fixture(t), avatar = f.avatar, assignments = avatar.assignments;
  const stored = f.storage.values.get(STORAGE_KEY), writes = f.storage.writes.length;
  await f.click(f.node('animation-tab'));
  const eyes = f.node('mouse-tracking'), body = f.node('tracking-eyes-and-body'), off = f.node('tracking-off');
  assert.equal(eyes.getAttribute('data-slot'), 'toggle-group-item');
  assert.equal(body.getAttribute('aria-checked'), 'true'); assert.equal(avatar.trackingMode, 'eyes-and-body');
  await f.click(eyes);
  assert.equal(avatar.trackingMode, 'eyes'); assert.equal(f.controller.getSnapshot().trackingMode, 'eyes');
  await f.click(body);
  assert.equal(avatar.trackingMode, 'eyes-and-body'); assert.equal(f.controller.exportScene().trackingMode, 'eyes-and-body');
  assert.equal(f.storage.values.get(STORAGE_KEY), stored); assert.ok(f.storage.writes.length > writes);
  assert.equal(loadStudioSession(f.storage).scene.trackingMode, 'eyes-and-body');
  await f.click(f.node('body-orientation-tab')); await f.key('body-yaw', 'ArrowRight');
  await f.shape('heart'); await f.input('body-color', '#aabbcc');
  assert.equal(avatar.trackingMode, 'eyes-and-body'); assert.equal(avatar.morphing, true);
  assert.equal(f.node('flat'), avatar); assert.equal(avatar.assignments, assignments);
  await f.click(f.node('animation-tab')); await f.click(off);
  assert.equal(avatar.trackingMode, 'off'); assert.equal(off.getAttribute('aria-checked'), 'true');
  await f.click(body); await f.click(f.node('reset'));
  assert.equal(avatar.trackingMode, 'eyes-and-body'); assert.equal(f.controller.getSnapshot().trackingMode, 'eyes-and-body');
  assert.equal(body.getAttribute('aria-checked'), 'true'); assert.equal(avatar.connections, 1);
  assert.equal('trackingMode' in JSON.parse(f.storage.values.get(STORAGE_KEY)!), false);
});

test('live HTML and React examples reflect the complete scene and copy exact current values', async t => {
  const f = await fixture(t), copied: string[] = [];
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => { copied.push(value); } } });
  await act(async () => { f.controller.setMouseTracking(true); f.controller.setBodyOrientation({ yaw: 42, pitch: -8, roll: 5 }); f.controller.setWeight('left', 'smile', .72); f.controller.look(.6); });
  await f.equipment('head', 'crown'); await f.input('accessory-color-head', '#aabbcc');
  await f.click(f.node('json-tab'));
  const scene = f.controller.exportScene(), snippets = sceneSnippets(scene);
  assert.equal(f.node('api-example').textContent, snippets.html);
  assert.equal(f.node('react-example').textContent, snippets.react);
  assert.match(snippets.html, /@hanana-kick\/sidekick\/auto/);
  assert.match(snippets.html, /tracking-mode="eyes"/); assert.match(snippets.html, /body-yaw="42"/);
  const markup = document.createElement('template'); markup.innerHTML = snippets.html;
  const element = markup.content.querySelector('sidekick-avatar')!;
  assert.deepEqual(JSON.parse(element.getAttribute('design')!), scene.design);
  assert.deepEqual(JSON.parse(element.getAttribute('motion')!), scene.motion);
  assert.equal(element.getAttribute('gaze-x'), '.6'.replace(/^\./, '0.'));
  const compiled = ts.transpileModule(snippets.react, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext }, reportDiagnostics: true });
  assert.deepEqual(compiled.diagnostics, []); assert.match(compiled.outputText, /SidekickAvatar/);
  await f.click(f.node('copy-html')); await f.click(f.node('copy-react'));
  assert.deepEqual(copied, [snippets.html, snippets.react]);
  assert.equal(f.node('usage-guide').getAttribute('href'), 'https://github.com/hanana-kick/sidekick#readme');
  assert.equal(f.container.querySelectorAll('.usage-example[open]').length, 1);
  assert.equal(f.node('import-scene-file').getAttribute('accept'), '.json,application/json');
  assert.equal(f.container.querySelectorAll('[data-equipment="head"] img').length, 3);
});

test('scene parser round-trips public runtime state, rejects hidden geometry and never evaluates accessors', () => {
  const scene = createScene({ design: createDesign({ body: { shape: 'heart' }, accessories: [createAccessory('crown', 'crown')] }),
    bodyOrientation: { yaw: 34 }, gaze: { x: .4 }, mouseTracking: true, activity: 'thinking', paused: true, interaction: 'box',
    time: 12, shapeDuration: 800, motionDuration: 250, motion: { face: { uv: [.2, -.1] }, accessories: { crown: { rotation: [0, .2, 0] } } } });
  assert.deepEqual(parseScene(serializeScene(scene)), scene);
  assert.deepEqual(migrateScene(serializeScene(scene)), { scene, warnings: [], legacyDesign: false });
  assert.equal(migrateScene(serializeDesign(scene.design)).legacyDesign, true);
  for (const patch of [{ sceneVersion: 2 }, { bodyOrientation: { yaw: 500, pitch: 0, roll: 0 } }, { gaze: { x: 5, y: 0 } }, { time: Infinity }, { shapeDuration: undefined }, { motionDuration: -1 }, { paused: 'false' }, { extra: 1 }, { motion: { accessories: { missing: { rotation: [0, 0, 0] } } } }]) {
    assert.throws(() => parseScene({ ...scene, ...patch }));
  }
  assert.throws(() => createScene({ motion: { body: { rotation: [0, 0, 10] } } }));
  assert.throws(() => parseScene({ ...scene, design: { ...scene.design, body: { ...scene.design.body, depth: .3 } } }));
  let reads = 0;
  const getter = { get x() { reads++; return 0; } };
  assert.throws(() => createScene({ gaze: getter }));
  assert.throws(() => createScene({ bodyOrientation: { get yaw() { reads++; return 0; } } }));
  assert.equal(reads, 0);
  assert.throws(() => parseScene(' '.repeat(MAX_SCENE_BYTES + 1)));
  assert.throws(() => parseScene('가'.repeat(MAX_SCENE_BYTES / 2)));
  const hostile = '&"<>\' </script><img src=x onerror=alert(1)>';
  const template = document.createElement('template'); template.innerHTML = `<div data-value="${escapeHTMLAttribute(hostile)}"></div>`;
  assert.equal(template.content.querySelector('div')!.getAttribute('data-value'), hostile);
  assert.equal(template.content.querySelectorAll('img,script').length, 0);
});

test('file import is validated atomically, preserves clocks on errors, and restores scene settings', async t => {
  const f = await fixture(t);
  await f.shape('heart');
  await act(async () => { f.controller.setMouseTracking(true); f.controller.setBodyOrientation({ yaw: 32 }); });
  const before = f.controller.exportScene(), writes = [...f.storage.writes], assignments = f.avatar.assignments, cancels = f.avatar.cancelCalls;
  const motions = f.avatar.motionCalls.length, shapes = f.avatar.shapeCalls.length;
  const invalid = [
    '{broken', JSON.stringify({ ...before, sceneVersion: 99 }), JSON.stringify({ ...before, bodyOrientation: { yaw: 500, pitch: 0, roll: 0 } }),
    JSON.stringify({ ...before, motion: { accessories: { absent: { rotation: [0, 0, 0] } } } }),
  ];
  for (const raw of invalid) {
    await act(async () => { assert.equal(await f.controller.importFile({ size: raw.length, text: async () => raw }), false); });
    assert.deepEqual(f.controller.exportScene(), before); assert.deepEqual(f.storage.writes, writes);
    assert.equal(f.avatar.assignments, assignments); assert.equal(f.avatar.cancelCalls, cancels); assert.equal(f.avatar.motionCalls.length, motions); assert.equal(f.avatar.shapeCalls.length, shapes);
    assert.equal(f.avatar.morphing, true); assert.ok(f.controller.getSnapshot().jsonError);
  }
  let reads = 0;
  await act(async () => { assert.equal(await f.controller.importFile({ size: MAX_SCENE_BYTES + 1, text: async () => { reads++; return ''; } }), false); });
  assert.equal(reads, 0);
  const next = createScene({ design: createDesign({ body: { shape: 'boom' }, accessories: [createAccessory('necklace')] }), bodyOrientation: { yaw: 75, pitch: -12, roll: 8 },
    mouseTracking: true, interaction: 'box', paused: true, activity: 'thinking', gaze: { x: -.7, y: .3 }, time: 17, shapeDuration: 900, shapeEasing: 'linear', motionDuration: 250,
    motion: { face: { uv: [.2, .1] } } });
  const raw = serializeScene(next);
  await act(async () => { assert.equal(await f.controller.importFile({ size: raw.length, text: async () => raw }), true); });
  assert.deepEqual(f.controller.exportScene(), next); assert.deepEqual(JSON.parse(f.controller.exportJSON()), next);
  assert.deepEqual(f.avatar.design, next.design); assert.deepEqual(f.avatar.bodyOrientation, next.bodyOrientation); assert.deepEqual(f.avatar.gaze, next.gaze);
  assert.equal(f.avatar.time, 17); assert.equal(f.avatar.paused, true); assert.equal(f.avatar.mouseTracking, true);
  assert.equal(f.controller.getSnapshot().jsonError, ''); assert.deepEqual(f.avatar.motionCalls.at(-1), next.motion);
  await act(async () => { f.controller.setWeight('left', 'smile', .2); });
  assert.equal(f.controller.exportScene().design.eyes.left.weights.smile, .2);
});

test('same-design scene import resets transient eye channels using the real element timeline', async () => {
  const { SidekickAvatar } = await import('../src/element/avatar.js');
  dom.window.customElements.define('sidekick-scene-regression', class extends SidekickAvatar {});
  const avatar = document.createElement('sidekick-scene-regression') as InstanceType<typeof SidekickAvatar>;
  const controller = new StudioController(store()), unbind = controller.bindAvatar(avatar);
  try {
    const neutral = controller.exportJSON();
    await avatar.motion.to({ eyes: { left: { weights: { smile: 1, blink: .7 } }, right: { weights: { smile: .5, blink: .4 } } } }, { duration: 0 });
    assert.equal(avatar.pose.eyes.left.smile, 1); assert.ok(Math.abs(avatar.pose.eyes.left.openness - .3) < 1e-12);
    assert.deepEqual(avatar.design.eyes.left.weights, { smile: 0, blink: 0 });
    assert.equal(controller.importJSON(neutral), true);
    assert.deepEqual(avatar.pose.eyes, { left: { smile: 0, openness: 1 }, right: { smile: 0, openness: 1 } });
    const partial = createScene({ design: avatar.design, motion: { eyes: { left: { weights: { smile: .6 } } } } });
    await avatar.motion.to({ eyes: { left: { weights: { blink: .8 } }, right: { weights: { blink: 1 } } } }, { duration: 0 });
    assert.equal(controller.importJSON(serializeScene(partial)), true);
    assert.deepEqual(avatar.pose.eyes, { left: { smile: .6, openness: 1 }, right: { smile: 0, openness: 1 } });
  } finally { unbind(); }
});

test('latest file selection wins and reset, editor changes, and unmount cancel pending reads', async t => {
  const f = await fixture(t);
  const deferred = () => { let resolve!: (text: string) => void; const promise = new Promise<string>(done => { resolve = done; }); return { file: { size: 100, text: () => promise }, resolve }; };
  const one = deferred(), two = deferred();
  let first!: Promise<boolean>, second!: Promise<boolean>;
  await act(async () => { first = f.controller.importFile(one.file); second = f.controller.importFile(two.file); });
  const newest = createScene({ design: createDesign({ body: { shape: 'puffy' } }), mouseTracking: true });
  await act(async () => { two.resolve(serializeScene(newest)); assert.equal(await second, true); });
  await act(async () => { one.resolve('{broken'); assert.equal(await first, false); });
  assert.deepEqual(f.controller.exportScene(), newest); assert.equal(f.controller.getSnapshot().jsonError, '');
  for (const cancel of [() => f.controller.reset(), () => f.controller.editJSON('draft')]) {
    const pending = deferred(); let result!: Promise<boolean>;
    await act(async () => { result = f.controller.importFile(pending.file); cancel(); });
    const before = f.controller.getSnapshot();
    await act(async () => { pending.resolve(serializeScene(newest)); assert.equal(await result, false); });
    assert.equal(f.controller.getSnapshot(), before);
  }
  const pending = deferred(), result = f.controller.importFile(pending.file);
  await f.unmount(); const before = f.controller.getSnapshot(); pending.resolve(serializeScene(newest));
  assert.equal(await result, false); assert.equal(f.controller.getSnapshot(), before);
});

test('Radix Select keyboard selection updates easing and expressions and restores trigger focus', async t => {
  const f = await fixture(t);
  await f.click(f.node('animation-tab'));
  async function choose(id: string, value: string) {
    await f.key(id, 'ArrowDown');
    const option = document.querySelector<HTMLElement>(`[role="option"][data-value="${value}"]`);
    assert.ok(option, `Missing open option ${value}`);
    await act(async () => { option.focus(); option.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    assert.equal(document.querySelector('[role="listbox"]'), null);
    assert.equal(document.activeElement, f.node(id));
  }
  await choose('shape-easing', 'linear');
  assert.equal(f.controller.getSnapshot().easing, 'linear');
  await choose('left-expression', 'smile');
  assert.deepEqual(f.avatar.design.eyes.left.weights, { smile: 1, blink: 0 });
  assert.deepEqual(f.avatar.design.eyes.right.weights, { smile: 0, blink: 0 });
  assert.equal(f.avatar.assignments, 2);
});

test('six equipment slots replace independently, keep per-item colors and preserve imported IDs', async t => {
  const f = await fixture(t);
  await f.equipment('eyes', 'glasses'); await f.input('accessory-color-eyes', '#556677');
  await f.equipment('mouth', 'moustache'); await f.equipment('neck', 'bowTie');
  await f.equipment('leftEar', 'earring'); await f.equipment('rightEar', 'earring');
  await f.input('accessory-color-leftEar', '#ffbb33'); await f.input('accessory-color-rightEar', '#aabbcc');
  assert.equal(f.avatar.design.accessories.length, 6);
  await f.equipment('head', 'halo'); await f.equipment('neck', 'scarf');
  const all = f.avatar.design.accessories;
  assert.equal(all.find(item => item.slot === 'head')!.preset, 'halo');
  assert.equal(all.find(item => item.slot === 'neck')!.preset, 'scarf');
  assert.equal(all.some(item => item.preset === 'bowTie'), false);
  assert.equal(all.find(item => item.slot === 'eyes')!.color, '#556677');
  assert.equal(all.find(item => item.slot === 'leftEar')!.color, '#ffbb33');
  assert.equal(all.find(item => item.slot === 'rightEar')!.color, '#aabbcc');
  await f.equipment('leftEar', 'earring'); assert.equal(f.avatar.design.accessories.some(item => item.slot === 'leftEar'), false);
  assert.equal(f.avatar.design.accessories.some(item => item.slot === 'rightEar'), true);
  const imported = createDesign({ accessories: [createAccessory('glasses', 'hat')] });
  await act(async () => { f.controller.editJSON(serializeDesign(imported)); f.controller.importJSON(); });
  await f.equipment('head', 'beret');
  assert.equal(f.avatar.design.accessories.find(item => item.slot === 'head')!.id, 'hat-2');
  assert.deepEqual(f.avatar.design.accessories.find(item => item.slot === 'eyes'), imported.accessories[0]);
  assertMinimal(f.avatar.design);
});

test('motion duration, independent expressions, pause/activity, full import and reset remain wired', async t => {
  const f = await fixture(t);
  await f.click(f.node('animation-tab')); await f.key('shape-duration', 'ArrowRight');
  assert.equal(f.controller.getSnapshot().duration, 500);
  await act(async () => { f.controller.setEasing('linear'); f.controller.setExpression('left', 'smile'); f.controller.setWeight('right', 'blink', .73); });
  await f.click(f.container.querySelector<HTMLElement>('[data-activity="thinking"]')!); await f.click(f.node('pause'));
  assert.equal(f.avatar.activity, 'thinking'); assert.equal(f.avatar.paused, true);
  await f.shape('puffy'); assert.deepEqual(f.avatar.shapeCalls.at(-1)!.options, { duration: 500, easing: 'linear' });
  assert.deepEqual(f.avatar.design.eyes.left.weights, { smile: 1, blink: 0 }); assert.deepEqual(f.avatar.design.eyes.right.weights, { smile: 0, blink: .73 });
  await f.click(f.node('json-tab'));
  const before = f.avatar.design;
  await f.input('design-json', '{"version":999}'); await f.click(f.node('import-json'));
  assert.deepEqual(f.avatar.design, before); assert.ok(f.node('json-error').textContent);
  await f.input('design-json', serializeDesign(before)); await f.click(f.node('import-json'));
  assert.deepEqual(f.avatar.shapeCalls.at(-1)!.options, { duration: 0 });
  await f.click(f.node('reset'));
  assert.equal(f.avatar.design.body.shape, 'square'); assert.equal(f.avatar.paused, false); assert.equal(f.avatar.activity, 'idle');
  assert.deepEqual(f.avatar.bodyOrientation, createBodyOrientation()); assert.equal(f.controller.getSnapshot().duration, 450); assert.equal(f.controller.getSnapshot().easing, 'smooth');
  assert.deepEqual(f.avatar.design.eyes.left.weights, { smile: 0, blink: 0 });
  assert.deepEqual(JSON.parse(f.storage.values.get(STORAGE_KEY)!), f.avatar.design);
});

test('v7 takes precedence; v6 face data migrates to eyes while preserving original storage', async t => {
  const current = createDesign({ body: { shape: 'heart' }, accessories: [createAccessory('glasses', 'old-frames')] });
  const v6 = { ...current, version: 6, accessories: current.accessories.map(item => ({ ...item, slot: 'face' })) };
  const raw = JSON.stringify(v6), expected = migrateDesign(raw);
  const f = await fixture(t, { 'sidekick.design.v6': raw });
  assert.deepEqual(f.avatar.design, expected.design); assert.equal(f.avatar.design.accessories[0]!.slot, 'eyes');
  assert.equal(f.storage.values.get('sidekick.design.v6'), raw); assert.deepEqual(JSON.parse(f.storage.values.get(STORAGE_KEY)!), expected.design);
  const preferred = new StudioController(store({ [STORAGE_KEY]: serializeDesign(current), 'sidekick.design.v6': '{broken' }));
  assert.deepEqual(preferred.getSnapshot().design, current); assert.equal(preferred.getSnapshot().recovery, undefined);
});

test('unreadable original stays intact; first explicit edit backs up before writing v7', async t => {
  const raw = '{"version":999,"original":"keep me"}';
  const f = await fixture(t, { [STORAGE_KEY]: raw });
  assert.equal(f.storage.values.get(STORAGE_KEY), raw); assert.deepEqual(f.storage.writes, []);
  assert.equal((f.node('design-json') as HTMLTextAreaElement).value, raw); assert.equal(f.node('json-tab').getAttribute('aria-selected'), 'true');
  await f.input('body-color', '#a4b8c9');
  assert.deepEqual(f.storage.writes, [`${STORAGE_KEY}.recovery`, STORAGE_KEY, STUDIO_SESSION_KEY]);
  assert.equal(f.storage.values.get(`${STORAGE_KEY}.recovery`), raw);
  assert.equal(JSON.parse(f.storage.values.get(STORAGE_KEY)!).body.color, '#a4b8c9');
});

test('backup failure prevents overwriting original; storage exceptions do not break editing', async t => {
  const raw = '{broken'; const f = await fixture(t, { [STORAGE_KEY]: raw }, true);
  await f.input('body-color', '#a4b8c9'); assert.equal(f.avatar.design.body.color, '#a4b8c9');
  assert.equal(f.storage.values.get(STORAGE_KEY), raw); assert.deepEqual(f.storage.writes, [`${STORAGE_KEY}.recovery`]);
  assert.match(f.node('status').textContent!, /원본을 보호/);
  const blocked = new StudioController({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } });
  blocked.patch({ body: { color: '#abcdef' } }); assert.equal(blocked.getSnapshot().design.body.color, '#abcdef'); assert.equal(blocked.getSnapshot().statusError, true);
});

test('StrictMode effect replay is idempotent and unmount removes stale avatar listeners', async t => {
  const f = await fixture(t, {}, false, true);
  assert.equal(f.avatar.assignments, 2); assert.equal(f.avatar.connections, 1); assert.equal(f.avatar.disconnections, 0);
  await act(async () => f.avatar.setBodyOrientation({ yaw: 23 }));
  assert.equal(f.controller.getSnapshot().bodyOrientation.yaw, 23);
  await f.shape('heart'); await f.input('body-color', '#aabbcc');
  assert.equal(f.avatar.assignments, 2); assert.equal(f.avatar.connections, 1);
  const before = f.controller.getSnapshot();
  await f.unmount();
  assert.equal(f.avatar.disconnections, 1);
  f.avatar.setBodyOrientation({ yaw: 90 });
  f.avatar.dispatchEvent(new CustomEvent('sidekick-error', { detail: { message: 'detached' } }));
  assert.equal(f.controller.getSnapshot(), before, 'Detached avatar events have no live subscriptions');
});

test('layout source confines scrolling to settings and config contains real Slate and pointer setup', () => {
  const css = readFileSync(new URL('../playground/style.css', import.meta.url), 'utf8');
  const config = JSON.parse(readFileSync(new URL('../components.json', import.meta.url), 'utf8'));
  assert.equal(config.style, 'radix-nova'); assert.equal(config.tailwind.baseColor, 'slate');
  assert.match(css, /height: 100dvh/); assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /\.settings-scroll\s*\{[^}]*overflow-y: auto/); assert.match(css, /\.studio-shell\s*\{[^}]*overflow: hidden/s);
  assert.match(css, /\.workspace\s*\{[^}]*grid-template-rows: minmax\(150px, 35%\) minmax\(0, 1fr\)/);
  assert.match(css, /button:not\(:disabled\)[\s\S]*?cursor: pointer/);
  assert.match(css, /\.shape-tile\[aria-pressed="true"\]/);
});

test('narrow-phone source constrains the shell column and preserves the compact JSON action name', async t => {
  const f = await fixture(t);
  const css = readFileSync(new URL('../playground/style.css', import.meta.url), 'utf8');
  const shell = css.match(/\.studio-shell\s*\{([^}]+)\}/s)![1]!;
  assert.match(shell, /position: fixed; inset: 0/);
  assert.match(shell, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(shell, /width: 100%; max-width: 100%; min-width: 0/);
  assert.match(readFileSync(new URL('../playground/shared-header.css', import.meta.url), 'utf8'), /\.app-header\s*\{[^}]*min-width: 0/);
  assert.match(css, /\.workspace\s*\{[^}]*min-width: 0/);
  assert.match(css, /@media \(max-width: 359px\)[\s\S]*?#export-json\s*\{[^}]*width: 32px/);
  const compactName = css.match(/#export-json > span\s*\{([^}]+)\}/s)![1]!;
  assert.match(compactName, /position: absolute/);
  assert.match(compactName, /clip: rect\(0, 0, 0, 0\)/);
  assert.doesNotMatch(compactName, /display:\s*none|visibility:\s*hidden/);
  assert.equal(f.node('export-json').textContent, 'JSON 내보내기');
  assert.equal(f.node('export-json').querySelector('span')!.hasAttribute('aria-hidden'), false);
});


test('scene import and Studio reset clear transient tracking from the actual renderer input', async () => {
  const { SidekickAvatar } = await import('../src/element/avatar.js');
  const { RenderEngine } = await import('../src/runtime/render-engine.js');
  const { installRuntime } = await import('./helpers/render-runtime.mjs');
  dom.window.customElements.define('sidekick-tracking-scene', class extends SidekickAvatar {});
  const avatar = document.createElement('sidekick-tracking-scene') as InstanceType<typeof SidekickAvatar>;
  avatar.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200 }) as DOMRect;
  Reflect.set(avatar, 'connected', true);
  Reflect.set(avatar, 'canvas', document.createElement('canvas'));
  const runtime = installRuntime(avatar, RenderEngine);
  const controller = new StudioController(store()), unbind = controller.bindAvatar(avatar);
  const rendered = () => runtime.render().pose.rotation;
  const tilt = () => {
    runtime.tracking.follow([1, 1]);
    for (let i = 0; i < 100; i++) runtime.advanceTracking(.016);
    assert.ok(rendered()[1]! > .2);
  };
  try {
    tilt();
    const scene = createScene({ design: avatar.design, trackingMode: 'eyes-and-body', paused: true, motion: { body: { rotation: [.1, -.2, .3] } } });
    assert.equal(controller.importJSON(serializeScene(scene)), true);
    assert.deepEqual(rendered(), [.1, -.2, .3]); assert.equal(avatar.trackingMode, 'eyes-and-body');
    await avatar.motion.to({ body: { rotation: [0, 0, 0] } }, { duration: 0 });
    tilt(); controller.reset(); assert.deepEqual(rendered(), [0, 0, 0]); assert.equal(avatar.trackingMode, 'eyes-and-body');
  } finally { unbind(); avatar.disconnectedCallback(); }
});

test('Studio zoom slider, bodyOrientation events, reset, scene JSON and snippets stay synchronized', async t => {
  const f = await fixture(t); await f.click(f.node('body-orientation-tab'));
  await f.key('zoom', 'ArrowRight'); assert.equal(f.avatar.zoom, 1.01);
  await act(async () => { f.avatar.setBodyOrientation({ yaw: 28 }); f.avatar.zoom = 2.2; });
  assert.equal(f.node('zoom').getAttribute('aria-valuenow'), '2.2');
  assert.equal(f.controller.exportScene().zoom, 2.2);
  const snippets = sceneSnippets(f.controller.exportScene());
  assert.match(snippets.html, /zoom="2.2"/); assert.match(snippets.react, /zoom=\{2.2\}/);
  await f.click(f.container.querySelector<HTMLElement>('[data-body-orientation-preset="side"]')!); assert.equal(f.avatar.zoom, 2.2);
  await f.click(f.node('reset-body-orientation')); assert.deepEqual(f.avatar.bodyOrientation, createBodyOrientation());
  assert.equal(f.avatar.zoom, 2.2);
  await f.click(f.node('reset-zoom'));
  assert.equal(f.node('zoom').getAttribute('aria-valuenow'), '1');
});

test('scene editing has explicit OG preset and preserves stable character renderer', async t => {
  const f = await fixture(t), original = f.avatar;
  await f.click(f.node('scene-tab'));
  assert.equal(f.container.querySelector('.previews')?.getAttribute('data-scene-mode'), 'true');
  await f.input('scene-text', 'Custom card');
  assert.equal(f.node<HTMLTextAreaElement>('scene-text').value, 'Custom card');
  assert.equal(f.controller.getSnapshot().design.body.shape, 'square');
  await f.click(f.node('scene-og-preset'));
  assert.equal(f.controller.getSnapshot().design.body.shape, 'ghostish');
  assert.deepEqual(f.controller.getSnapshot().design.accessories.map(item => item.preset), ['glasses', 'beret', 'bowTie']);
  assert.equal(f.node<HTMLTextAreaElement>('scene-text').value, 'Sidekick');
  assert.equal(f.node('flat'), original);
  await f.click(f.node('appearance-tab'));
  assert.equal(f.container.querySelector('.previews')?.getAttribute('data-scene-mode'), 'true');
  assert.equal(f.node('flat'), original);
});

test('discarded camera scenes fail atomically and saved originals can be reset safely', async t => {
  const old = JSON.stringify({ sceneVersion: 2, camera: { yaw: 40, pitch: 0, roll: 0, zoom: 2 } });
  const f = await fixture(t, { [STORAGE_KEY]: old });
  assert.equal(f.controller.getSnapshot().recovery?.raw, old);
  assert.match(f.controller.getSnapshot().status, /초기화/);
  const before = f.controller.exportScene();
  await act(async () => { assert.equal(f.controller.importJSON(old), false); });
  assert.match(f.controller.getSnapshot().jsonError, /camera|버전/);
  assert.deepEqual(f.controller.exportScene(), before);
  await act(async () => f.controller.reset());
  assert.equal(f.storage.values.get(`${STORAGE_KEY}.recovery`), old);
  assert.equal(f.controller.exportScene().sceneVersion, 3);
  assert.deepEqual(f.avatar.bodyOrientation, createBodyOrientation());
  assert.equal(f.avatar.zoom, 1);
});


test('full Studio scene transfers to Playground and reload without writing temporary commands back', async t => {
  const f = await fixture(t);
  const scene = createScene({ design: createDesign({ body: { shape: 'heart', color: '#123456' }, accessories: [createAccessory('crown', 'crown')], eyes: { color: '#654321', left: { weights: { smile: .8, blink: .2 } }, right: { weights: { smile: .3, blink: .1 } } } }), bodyOrientation: { yaw: 31, pitch: 12, roll: -8 }, zoom: 1.7, activity: 'thinking', trackingMode: 'off', paused: true, interaction: 'box', gaze: { x: .3, y: -.2 }, time: 1.2, motion: { face: { uv: [.1, .2] } } });
  await act(async () => { assert.equal(f.controller.importJSON(serializeScene(scene)), true); });
  const loaded = loadStudioSession(f.storage);
  assert.equal(loaded.source, 'saved'); assert.deepEqual(loaded.scene, scene);
  const fresh = new StudioController(f.storage), other = new MockAvatar();
  await act(async () => { fresh.bindAvatar(other); });
  assert.deepEqual(fresh.exportScene(), scene); assert.deepEqual(other.bodyOrientation, scene.bodyOrientation); assert.equal(other.zoom, scene.zoom);
  const saved = f.storage.values.get(STUDIO_SESSION_KEY);
  const playground = new MockAvatar();
  await applyStudioSession(playground, loaded.scene);
  assert.deepEqual(playground.design, scene.design); assert.equal(playground.activity, 'thinking'); assert.equal(playground.trackingMode, 'off');
  playground.setActivity('celebrating'); playground.design = createDesign();
  assert.equal(f.storage.values.get(STUDIO_SESSION_KEY), saved);
});

test('Studio bridge uses one default, rejects retired keys, and never overwrites invalid scene on load', () => {
  const empty = store(); assert.equal(loadStudioSession(empty).source, 'default'); assert.equal(loadStudioSession(empty).scene.design.body.shape, 'square');
  const raw = JSON.stringify({ sceneVersion: 2, camera: { yaw: 20 } });
  const broken = store({ [STUDIO_SESSION_KEY]: raw });
  const result = loadStudioSession(broken); assert.equal(result.source, 'invalid'); assert.match(result.message, /원본은 보존/);
  const controller = new StudioController(broken);
  assert.equal(controller.getSnapshot().recovery?.raw, raw); assert.equal(broken.values.get(STUDIO_SESSION_KEY), raw); assert.deepEqual(broken.writes, []);
  assert.equal(loadStudioSession({ getItem() { throw Error('blocked'); } }).source, 'unavailable');
});


test('four explicit Studio catalogs cover every shape, accessory and UI key', () => {
  for (const catalog of [STUDIO_TEXT, STUDIO_SHAPES, STUDIO_ACCESSORIES]) {
    for (const labels of Object.values(catalog)) {
      assert.equal(labels.length, 4);
      assert.ok(labels.every(label => typeof label === 'string' && label.length > 0));
    }
  }
  assert.equal(Object.keys(STUDIO_SHAPES).length, 35);
  assert.equal(Object.keys(STUDIO_ACCESSORIES).length, 12);
});

test('live locale switching translates controls, shapes, accessories, status and snippets without changing scene or focus', async t => {
  const f = await fixture(t);
  await f.shape('heart'); await f.equipment('eyes', 'glasses');
  const scene = f.controller.exportJSON(), avatar = f.avatar;
  const writes = f.storage.writes.length, assignments = avatar.assignments;
  const search = f.node<HTMLInputElement>('shape-search');
  const heart = f.container.querySelector<HTMLElement>('[data-shape="heart"]')!;
  search.value = 'heart'; search.dispatchEvent(new Event('input', { bubbles: true }));
  heart.focus();
  for (const locale of ['en', 'zh-CN', 'ja', 'ko'] as const) {
    await act(async () => setSiteLocale(locale));
    assert.equal(getSiteLocale(), locale);
    const apiHref = f.container.querySelector<HTMLAnchorElement>('.stage-header a')!.href;
    assert.equal(new URL(apiHref).searchParams.get('lang'), locale);
    assert.equal(f.container.querySelector('h1')?.textContent, studioText('나만의 작은 동료.', locale));
    assert.equal(f.node('appearance-tab').textContent, studioText('외형', locale));
    assert.equal(f.node('appearance-tab').getAttribute('aria-selected'), 'true');
    assert.equal(f.node('body-color').getAttribute('aria-label'), studioText('몸체 색상', locale));
    assert.equal(heart.querySelector('.shape-tile-label')?.textContent, studioShapeLabel('heart', locale));
    assert.equal(f.container.querySelector('[data-accessory="glasses"] span')?.textContent, studioAccessoryLabel('glasses', locale));
    assert.equal(f.node('status').textContent, studioText('디자인이 이 브라우저에 저장되었습니다.', locale));
    assert.ok(f.node('api-example').textContent?.includes(studioText('나의 도우미', locale)));
    assert.equal(search.value, 'heart'); assert.equal(document.activeElement === heart, true);
    assert.equal(f.node('flat') === avatar, true); assert.equal(avatar.assignments, assignments);
    assert.equal(f.controller.exportJSON(), scene); assert.equal(f.storage.writes.length, writes);
    const visibleCopy = f.container.cloneNode(true) as HTMLElement;
    visibleCopy.querySelectorAll('.site-header-brand, textarea, pre').forEach(node => node.remove());
    if (locale !== 'ko') assert.doesNotMatch(visibleCopy.textContent ?? '', /[가-힣]/);
  }
});

test('localized sessions and validation messages update on language change without rereading storage', async t => {
  const f = await fixture(t);
  let reads = 0;
  const session = loadStudioSession({ getItem() { reads++; return null; } });
  const originalReads = reads;
  await f.click(f.node('json-tab'));
  await act(async () => f.controller.importJSON('{"sceneVersion": 3}'));
  for (const locale of ['ko', 'en', 'zh-CN', 'ja'] as const) {
    await act(async () => setSiteLocale(locale));
    assert.equal(session.message, studioText('아직 저장된 Studio 설정이 없어 기본 봇을 표시합니다.', locale));
    assert.equal(reads, originalReads);
    assert.equal(f.node('json-tab').getAttribute('aria-selected'), 'true');
    assert.equal(f.node('json-error').textContent, studioMessage(f.controller.getSnapshot().jsonError, locale));
    const error = studioMessage('body.color: #RRGGBB 형식이 필요합니다.', locale);
    assert.ok(error.startsWith('body.color: '));
    if (locale !== 'ko') assert.doesNotMatch(error, /[가-힣]/);
    assert.equal(studioMessage('100 × 200 장면 PNG를 내보냈습니다.', locale).includes('100 × 200'), true);
    assert.equal(studioMessage('JSON copied.', locale), studioText('JSON을 복사했습니다.', locale));
  }
  await act(async () => setSiteLocale('ko'));
});

test('Studio analytics observes deliberate settled choices and successful copy/export/apply actions only', async t => {
  const { mountSiteAnalytics } = await import('../playground/site-analytics.js');
  const originalURL = dom.window.location.href;
  dom.reconfigure({ url: 'https://sidekick.hananakick.cc/' });
  const analytics = (mountSiteAnalytics as (...args: unknown[]) => { setConsent: (value: string) => void })(document, 'studio', { production: true, enabled: 'true', measurementId: 'G-TESTONLY01' });
  t.after(() => { analytics.setConsent('denied'); dom.reconfigure({ url: originalURL }); });
  const events = (name: string): Array<Record<string, unknown>> => ((window as unknown as { dataLayer?: IArguments[] }).dataLayer ?? []).map(args => [...args]).filter(args => args[0] === 'event' && args[1] === name).map(args => args[2] as Record<string, unknown>);
  const f = await fixture(t, {}, false, true);
  await f.shape('heart'); await new Promise(resolve => setTimeout(resolve, 650));
  assert.equal(events('bot_preview').length, 0);
  analytics.setConsent('granted'); document.querySelector('script[src*="googletagmanager"]')!.dispatchEvent(new Event('load'));
  await new Promise(resolve => setTimeout(resolve, 650)); assert.equal(events('bot_preview').length, 0);
  await f.equipment('eyes', 'glasses'); await new Promise(resolve => setTimeout(resolve, 650));
  assert.equal(events('bot_preview').length, 1); assert.equal(events('bot_preview')[0]!.body_shape, 'heart');
  assert.equal(events('setting_change').length, 1); assert.equal(events('setting_change')[0]!.setting_key, 'accessory_eyes');
  await act(async () => f.controller.patch({ body: { color: '#010203' } })); await new Promise(resolve => setTimeout(resolve, 650));
  assert.equal(events('bot_preview').length, 1); assert.equal(events('setting_change').length, 1);
  await f.input('body-color', '#ff0000'); await f.input('body-color', '#00ff00');
  assert.equal(events('setting_change').length, 1); await new Promise(resolve => setTimeout(resolve, 650));
  assert.equal(events('setting_change').at(-1)!.setting_key, 'body_color_family'); assert.equal(events('setting_change').at(-1)!.value_category, 'green');
  await f.input('eye-color', '#0000ff'); await new Promise(resolve => setTimeout(resolve, 650));
  assert.equal(events('setting_change').at(-1)!.setting_key, 'eye_color_family'); assert.equal(events('setting_change').at(-1)!.value_category, 'blue');
  await f.input('accessory-color-eyes', '#ff00ff'); await new Promise(resolve => setTimeout(resolve, 650));
  assert.equal(events('setting_change').at(-1)!.setting_key, 'accessory_eyes_color_family'); assert.equal(events('setting_change').at(-1)!.value_category, 'pink');
  assert.equal(events('bot_preview').length, 1); // Color families never change the categorical bot combination.
  assert.doesNotMatch(JSON.stringify(events('setting_change')), /#[0-9a-f]{6}|rgb|lightness|equipped/);
  await f.click(f.node('animation-tab')); await f.click(f.node('pause'));
  assert.equal(events('setting_change').at(-1)!.setting_key, 'paused');
  await f.click(f.node('body-orientation-tab')); assert.equal(events('section_view').at(-1)!.site_section, 'orientation');
  const zoomChanges = () => events('setting_change').filter(event => event.setting_key === 'zoom');
  await f.key('zoom', 'ArrowRight'); assert.equal(zoomChanges().length, 0);
  await new Promise(resolve => setTimeout(resolve, 650));
  assert.equal(zoomChanges().length, 1); assert.equal(zoomChanges()[0]!.value_category, 'enlarged');
  assert.equal(zoomChanges()[0]!.site_section, 'orientation'); assert.equal(zoomChanges()[0]!.change_source, 'control');
  await act(async () => { f.avatar.zoom = 2; }); await new Promise(resolve => setTimeout(resolve, 650));
  assert.equal(zoomChanges().length, 1); // Runtime-driven zoom must not masquerade as a control change.
  await f.click(f.node('json-tab'));
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  let copyFails = true;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { if (copyFails) throw new Error('denied'); } } });
  t.after(() => { if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor); else Reflect.deleteProperty(navigator, 'clipboard'); });
  await f.click(f.node('copy-html')); assert.equal(events('bot_copy').length, 0);
  copyFails = false; await f.click(f.node('copy-html')); assert.equal(events('bot_copy').length, 1); assert.equal(events('bot_copy')[0]!.format, 'html');
  const copiedScene = createScene({ design: createDesign({ body: { shape: 'circle' } }) });
  await f.input('design-json', serializeScene(copiedScene)); await f.click(f.node('copy-json'));
  assert.equal(events('bot_copy').at(-1)!.body_shape, 'circle'); assert.equal(f.controller.getSnapshot().design.body.shape, 'heart');
  await f.click(f.node('import-json')); assert.equal(events('bot_apply').length, 1); assert.equal(events('bot_apply')[0]!.body_shape, 'circle');
  await f.input('design-json', '{invalid private draft'); await f.click(f.node('import-json')); await f.click(f.node('copy-json'));
  assert.equal(events('bot_apply').length, 1); assert.equal(events('bot_copy').length, 2);
  const createURL = URL.createObjectURL, revokeURL = URL.revokeObjectURL;
  URL.createObjectURL = () => 'blob:offline-fixture'; URL.revokeObjectURL = () => {};
  t.after(() => { URL.createObjectURL = createURL; URL.revokeObjectURL = revokeURL; });
  t.mock.method(dom.window.HTMLAnchorElement.prototype, 'click', () => {});
  const snapshot = f.avatar.snapshot;
  f.avatar.snapshot = () => Promise.reject(new Error('snapshot failed'));
  await f.click(f.node('export-png')); assert.equal(events('bot_export').length, 0);
  f.avatar.snapshot = snapshot;
  await f.click(f.node('export-png')); await f.click(f.node('export-json'));
  assert.deepEqual(events('bot_export').map(event => event.format), ['png', 'json']);
  const observations = events('setting_observation').filter(event => event.observation_source === 'export');
  assert.equal(observations.length, 36);
  assert.ok(observations.some(event => event.setting_key === 'left_expression' && event.value_category === 'neutral'));
  assert.ok(observations.some(event => event.setting_key === 'zoom' && event.value_category === 'normal'));
  await f.click(f.node('reset')); assert.equal(events('preset_apply').length, 1); assert.equal(events('preset_apply')[0]!.preset, 'default');
  assert.doesNotMatch(JSON.stringify(['bot_preview', 'bot_copy', 'bot_apply', 'bot_export', 'preset_apply'].flatMap(events)), /private draft|#010203|jsonDraft|weights/);
});
