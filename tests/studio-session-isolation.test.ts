import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createAccessory, createDesign } from '../src/core/design.js';
import { createScene } from '../src/core/scene.js';
import { STUDIO_SESSION_KEY, STUDIO_DESIGN_KEY, loadStudioSession, loadStudioPreviewSession, applyStudioSession, seedStudioSession } from '../playground/studio-session.js';

const design = createDesign({ body: { shape: 'heart', color: '#123456' }, eyes: { color: '#654321', left: { weights: { smile: .8 } }, right: { weights: { blink: .3 } } }, accessories: [createAccessory('crown', 'crown')] });
const extreme = createScene({ design, zoom: 3, bodyOrientation: { yaw: 170, pitch: 80, roll: 120 }, activity: 'thinking', paused: true, trackingMode: 'off', interaction: 'none', gaze: { x: 1, y: -1 }, time: 43200, motion: { body: { rotation: [3, 4, 5] }, face: { uv: [.4, -.4] } }, shapeDuration: 1234, motionDuration: 2345, shapeEasing: 'linear', motionEasing: 'linear' });
const storageFor = (value: unknown, key = STUDIO_SESSION_KEY) => {
  const raw = JSON.stringify(value), reads: string[] = [];
  return { raw, reads, getItem(candidate: string) { reads.push(candidate); return candidate === key ? raw : null; } };
};

test('cross-page loading projects every saved scene field away except validated design, without changing Studio storage', () => {
  const storage = storageFor(extreme);
  const session = loadStudioSession(storage);
  assert.equal(session.source, 'saved');
  assert.deepEqual(session.scene, createScene({ design, interaction: 'box' }));
  assert.deepEqual(loadStudioPreviewSession(storage).scene, extreme);
  assert.equal(storage.getItem(STUDIO_SESSION_KEY), storage.raw);
  session.scene.design.body.color = '#ffffff';
  assert.deepEqual(loadStudioSession(storage).scene.design, design, 'each page receives independent design data');
});

test('legacy preview fields do not block valid design projection or get replayed', () => {
  const storage = storageFor({ sceneVersion: 2, design, camera: { zoom: 999 }, size: 999, movement: { target: 'old-page' }, zoom: 'broken', paused: true });
  assert.deepEqual(loadStudioSession(storage).scene, createScene({ design, interaction: 'box' }));
  assert.equal(loadStudioPreviewSession(storage).source, 'invalid', 'Studio still validates its own full scene and preserves recovery');
  assert.equal(storage.getItem(STUDIO_SESSION_KEY), storage.raw);
  assert.deepEqual(loadStudioSession(storageFor(design, STUDIO_DESIGN_KEY)).scene.design, design);
  assert.equal(loadStudioSession(storageFor({ design: { body: { shape: 'invalid' } } })).source, 'invalid');
});

test('cross-page apply only assigns design and preserves all existing destination properties and running activity', async () => {
  const writes: PropertyKey[] = [];
  const local = { design: createDesign(), zoom: .75, size: 180, paused: false, trackingMode: 'eyes', activity: 'celebrating', bodyOrientation: { yaw: 8, pitch: 2, roll: 1 }, movement: { running: true }, scene: { local: true } };
  const before = structuredClone(local);
  const avatar = new Proxy(local, { set(target, key, value) { writes.push(key); return Reflect.set(target, key, value); } });
  await applyStudioSession(avatar, extreme);
  assert.deepEqual(writes, ['design']);
  assert.deepEqual(local, { ...before, design });
});

test('cross-page first-frame seed sets only design, retaining destination size, orientation and dynamics', () => {
  const dom = new JSDOM();
  try {
    const avatar = dom.window.document.createElement('sidekick-avatar');
    const own = { size: '180', zoom: '.75', 'body-yaw': '8', activity: 'celebrating', paused: 'false', 'tracking-mode': 'eyes', interaction: 'none', placement: 'viewport', 'movement-bounds': 'none' };
    for (const [key, value] of Object.entries(own)) avatar.setAttribute(key, value);
    seedStudioSession(avatar, extreme);
    assert.equal(avatar.isConnected, false);
    assert.deepEqual(JSON.parse(avatar.getAttribute('design')!), design);
    for (const [key, value] of Object.entries(own)) assert.equal(avatar.getAttribute(key), value, key);
    assert.equal(avatar.attributes.length, Object.keys(own).length + 1);
  } finally { dom.window.close(); }
});
