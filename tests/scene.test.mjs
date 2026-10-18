import test from 'node:test';
import assert from 'node:assert/strict';
import { createScene, parseScene, migrateScene, serializeScene, MAX_SCENE_BYTES } from '../dist/src/core/scene.js';
import { createDesign, createAccessory, serializeDesign } from '../dist/src/core/design.js';

test('scene envelope round-trips design, all runtime controls and target poses', () => {
  const scene = createScene({ design: createDesign({ body: { shape: 'heart' }, accessories: [createAccessory('crown', 'crown')] }),
    bodyOrientation: { yaw: 34, pitch: -9, roll: 8 }, gaze: { x: .4, y: -.2 }, mouseTracking: true, activity: 'thinking', paused: true, interaction: 'box',
    time: 12, shapeDuration: 800, shapeEasing: 'linear', motionDuration: 250, motionEasing: 'linear', motion: { face: { uv: [.2, -.1] }, accessories: { crown: { rotation: [0, .2, 0] } } } });
  assert.deepEqual(parseScene(serializeScene(scene)), scene);
  assert.deepEqual(migrateScene(serializeScene(scene)), { scene, warnings: [], legacyDesign: false });
  const legacy = migrateScene(serializeDesign(scene.design));
  assert.equal(legacy.legacyDesign, true); assert.deepEqual(legacy.scene.design, scene.design);
  assert.deepEqual(legacy.scene.bodyOrientation, { yaw: 0, pitch: 0, roll: 0 }); assert.equal(legacy.scene.trackingMode, 'eyes-and-body');
  scene.design.body.color = '#aabbcc'; assert.notEqual(legacy.scene.design.body.color, scene.design.body.color);
});

test('invalid scene versions, fields, ranges, motion references and geometry fail before application', () => {
  const scene = createScene();
  for (const patch of [{ sceneVersion: 2 }, { bodyOrientation: { yaw: 500, pitch: 0, roll: 0 } }, { bodyOrientation: {} }, { gaze: { x: 5, y: 0 } },
    { time: Infinity }, { shapeDuration: undefined }, { motionDuration: -1 }, { motionEasing: 'bounce' }, { paused: 'false' }, { extra: 1 },
    { motion: { accessories: { missing: { rotation: [0, 0, 0] } } } }, { motion: { body: { rotation: [0, 0, 10] } } },
    { design: { ...scene.design, body: { ...scene.design.body, depth: .3 } } }]) assert.throws(() => parseScene({ ...scene, ...patch }));
  assert.throws(() => parseScene('{broken'));
  assert.throws(() => parseScene(' '.repeat(MAX_SCENE_BYTES + 1)));
  assert.throws(() => parseScene('가'.repeat(MAX_SCENE_BYTES / 2)));
  assert.throws(() => migrateScene('{"sceneVersion":2}'));
});

test('scene validation rejects getters and malformed arrays without invoking caller code', () => {
  let reads = 0;
  assert.throws(() => createScene({ gaze: { get x() { reads++; return 0; } } }));
  assert.throws(() => createScene({ bodyOrientation: { get yaw() { reads++; return 0; } } }));
  assert.throws(() => parseScene({ ...createScene(), motion: { get body() { reads++; return {}; } } }));
  const rotation = [0, 0, 0]; Object.defineProperty(rotation, '0', { get() { reads++; return 0; }, enumerable: true });
  assert.throws(() => createScene({ motion: { body: { rotation } } }));
  assert.throws(() => createScene({ motion: { body: { rotation: new Array(3) } } }));
  assert.equal(reads, 0);
});

test('scene version 3 stores independent zoom and rejects removed camera/view keys',()=>{
 const scene=createScene({bodyOrientation:{yaw:20},zoom:2.2});
 assert.equal(parseScene(serializeScene(scene)).zoom,2.2);assert.equal(scene.sceneVersion,3);
 const missing={...scene};delete missing.zoom;assert.throws(()=>parseScene(missing));
 for(const version of [1,2])assert.throws(()=>parseScene({...scene,sceneVersion:version}));
 for(const key of ['camera','view']) {assert.throws(()=>parseScene({...scene,[key]:{yaw:20}}),/폐기/);assert.throws(()=>createScene({[key]:{yaw:20}}));}
 for(const zoom of [0,4,NaN,null,undefined,'2'])assert.throws(()=>parseScene({...scene,zoom}));
 assert.throws(()=>createScene({bodyOrientation:{zoom:2}}));
});

test('new and partially specified scenes use FFCC37 and explicit saved colors survive roundtrip', () => {
  assert.equal(createScene().design.body.color, '#ffcc37');
  assert.equal(createDesign({ body: { shape: 'heart' } }).body.color, '#ffcc37');
  const scene = createScene({ design: createDesign({ body: { color: '#123456' } }) });
  assert.equal(parseScene(serializeScene(scene)).design.body.color, '#123456');
});
