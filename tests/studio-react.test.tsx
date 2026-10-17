import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createElement, act, StrictMode } from 'react';
import { createAccessory, createDesign, migrateDesign, parseDesign, patchDesign, serializeDesign } from '../src/core/design.js';
import type { AvatarDesign, DesignPatch, Activity } from '../src/core/design.js';
import { CAMERA_PRESETS } from '../src/core/camera.js';
import type { CameraAngles, CameraPreset } from '../src/core/camera.js';
import { eyeExpressionWeights } from '../src/core/expressions.js';
import type { EyeExpression, EyeShapeWeights } from '../src/core/expressions.js';
import type { MaterialShapeName } from '../src/core/shapes.js';
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
  cameraValue = { ...CAMERA_PRESETS.front };
  paused = false;
  activity: Activity = 'idle';
  connections = 0;
  disconnections = 0;
  assignments = 0;
  shapeCalls: { shape: string; before: string; options: unknown }[] = [];
  patchCalls: DesignPatch[] = [];
  eyeCalls: { side: string; weights: unknown }[] = [];
  morphing = false;
  motion = { cancel() {}, to: () => Promise.resolve({ finished: true }) };
  connectedCallback() { this.connections++; }
  disconnectedCallback() { this.disconnections++; }
  get design() { return parseDesign(this.current); }
  set design(value: AvatarDesign) { this.assignments++; if (value.body.shape !== this.current.body.shape) this.morphing = false; this.current = parseDesign(value); }
  get camera() { return { ...this.cameraValue }; }
  set camera(value: CameraAngles) { this.setCamera(value); }
  updateDesign(patch: DesignPatch) { this.patchCalls.push(patch); const next = patchDesign(this.current, patch); if (next.body.shape !== this.current.body.shape) this.morphing = false; this.current = next; return Promise.resolve(); }
  setShape(shape: MaterialShapeName, options: { duration?: number } = {}) { this.shapeCalls.push({ shape, before: this.current.body.shape, options }); this.current = patchDesign(this.current, { body: { shape } }); this.morphing = !!options.duration; return Promise.resolve({ finished: true }); }
  setEyeWeights(side: 'left' | 'right', weights: Partial<EyeShapeWeights>) { this.eyeCalls.push({ side, weights }); this.current = patchDesign(this.current, { eyes: { [side]: { weights } } }); return Promise.resolve({ finished: true }); }
  setExpression(side: 'left' | 'right', expression: EyeExpression) { return this.setEyeWeights(side, eyeExpressionWeights(expression)); }
  setCamera(value: Partial<CameraAngles>) { this.cameraValue = { ...this.cameraValue, ...value }; this.dispatchEvent(new CustomEvent('sidekick-camera-change')); }
  setCameraPreset(preset: CameraPreset) { this.setCamera(CAMERA_PRESETS[preset]); }
  resetCamera() { this.setCamera(CAMERA_PRESETS.front); }
  setActivity(activity: Activity) { this.activity = activity; }
  lookAt() {}
  seek() {}
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
  const key = async (id: string, key: string) => act(async () => { const element = node(id); element.focus(); element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); });
  return { container, root, controller, avatar, storage, node, click, input, equipment, shape, key, unmount };
}
function assertMinimal(design: AvatarDesign) {
  assert.equal(design.version, 7); assert.deepEqual(Object.keys(design.body).sort(), ['color', 'shape']);
  assert.deepEqual(Object.keys(design.eyes).sort(), ['color', 'left', 'right']);
  for (const side of ['left', 'right'] as const) assert.deepEqual(Object.keys(design.eyes[side]), ['weights']);
  for (const item of design.accessories) assert.deepEqual(Object.keys(item).sort(), ['color', 'id', 'preset', 'slot']);
}

test('React uses genuine shadcn controls, correct tab relationships and named slider thumbs', async t => {
  const f = await fixture(t);
  assert.ok(f.container.querySelector('[data-slot="button"]')); assert.ok(f.container.querySelector('[data-slot="toggle-group"]'));
  assert.equal(f.container.querySelectorAll('sidekick-avatar').length, 1);
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
  await act(async () => { avatar.setCamera({ yaw: 42, pitch: 11, roll: 7 }); });
  const assignments = avatar.assignments;
  const heart = f.container.querySelector<HTMLElement>('[data-shape="heart"]')!;
  heart.focus(); await f.shape('heart');
  assert.equal(document.activeElement, heart); assert.equal(avatar.shapeCalls[0]!.before, 'square');
  assert.equal(avatar.shapeCalls[0]!.shape, 'heart'); assert.equal(avatar.morphing, true);
  await f.input('body-color', '#a4b8c9'); await f.equipment('neck', 'scarf');
  assert.equal(avatar.shapeCalls.length, 1); assert.equal(avatar.morphing, true);
  await f.key('appearance-tab', 'ArrowRight');
  assert.equal(f.node('animation-tab').getAttribute('aria-selected'), 'true');
  await f.key('left-smile-weight', 'ArrowRight');
  assert.equal(avatar.design.eyes.left.weights.smile, .01);
  await f.click(f.node('camera-tab')); await f.key('view-yaw', 'ArrowRight');
  assert.equal(avatar.camera.yaw, 43);
  await f.click(f.node('json-tab')); await f.input('design-json', '{ invalid draft');
  await f.click(f.node('appearance-tab')); await f.input('eye-color', '#121212');
  assert.equal(f.node('flat'), avatar); assert.equal(avatar.connections, 1); assert.equal(avatar.disconnections, 0);
  assert.equal(avatar.assignments, assignments); assert.equal(avatar.morphing, true);
  assert.deepEqual(avatar.camera, { yaw: 43, pitch: 11, roll: 7 });
  assert.equal(f.container.querySelector('[data-shape="heart"]'), heart);
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
  assert.equal(f.avatar.assignments, 1);
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
  assert.deepEqual(f.avatar.camera, CAMERA_PRESETS.front); assert.equal(f.controller.getSnapshot().duration, 450); assert.equal(f.controller.getSnapshot().easing, 'smooth');
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
  assert.deepEqual(f.storage.writes, [`${STORAGE_KEY}.recovery`, STORAGE_KEY]);
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
  assert.equal(f.avatar.assignments, 1); assert.equal(f.avatar.connections, 1); assert.equal(f.avatar.disconnections, 0);
  await act(async () => f.avatar.setCamera({ yaw: 23 }));
  assert.equal(f.controller.getSnapshot().camera.yaw, 23);
  await f.shape('heart'); await f.input('body-color', '#aabbcc');
  assert.equal(f.avatar.assignments, 1); assert.equal(f.avatar.connections, 1);
  const before = f.controller.getSnapshot();
  await f.unmount();
  assert.equal(f.avatar.disconnections, 1);
  f.avatar.setCamera({ yaw: 90 });
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
