import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createScene } from '../src/core/scene.ts';
import { createAccessory } from '../src/core/design.ts';
import { SIDEKICK_ATTRIBUTES, resolveSidekickAttributes } from '../src/element/attributes.ts';
import { validateMoveOptions } from '../src/element/movement.ts';
import { ALL_STATE_FIELDS, STATE_IDS, STATE_FIELDS, FIELD_BY_KEY, READ_ONLY_STATE, validateStateValue, compileReferenceAttributes, referenceReactProps, referenceSource, attributeText } from '../playground/state-reference-schema.js';

const scene = createScene();
const resolved = edits => resolveSidekickAttributes(new Map(Object.entries(compileReferenceAttributes(scene, edits)).filter(([, v]) => v !== undefined).map(([k, v]) => [k, attributeText(v)])));

test('reference enumerates each public declarative attribute exactly once with its React alias', () => {
  assert.equal(STATE_IDS.length, 7);
  assert.equal(ALL_STATE_FIELDS.length, 59);
  assert.deepEqual(ALL_STATE_FIELDS.map(f => f.attribute).sort(), [...SIDEKICK_ATTRIBUTES].sort());
  for (const f of ALL_STATE_FIELDS) assert.equal(f.prop, f.attribute.replace(/-([a-z])/g, (_, x) => x.toUpperCase()));
  for (const key of READ_ONLY_STATE) assert.equal(FIELD_BY_KEY.has(key), false);
});

test('defaults keep fixed physical speed and distinguish degrees, seconds, and milliseconds', () => {
  assert.equal(FIELD_BY_KEY.get('move-max-speed').initial, validateMoveOptions().maxSpeed);
  assert.equal(FIELD_BY_KEY.get('move-max-speed').unit, 'px/s');
  assert.equal(FIELD_BY_KEY.get('time').unit, 's');
  assert.equal(FIELD_BY_KEY.get('motion-duration').unit, 'ms');
  assert.equal(FIELD_BY_KEY.get('body-yaw').unit, 'deg');
});

test('booleans stay explicit false in HTML and typed false in React', () => {
  assert.equal(resolved({ paused: false }).paused, false);
  assert.equal(referenceReactProps(compileReferenceAttributes(scene, { paused: false })).paused, false);
  assert.match(referenceSource(scene, { paused: false }), /paused="false"/);
  assert.match(referenceSource(scene, { paused: false }, 'react'), /"paused": false/);
  assert.throws(() => validateStateValue(FIELD_BY_KEY.get('paused'), 'false', scene));
  assert.throws(() => validateStateValue(FIELD_BY_KEY.get('zoom'), '1', scene));
});

test('explicit legacy tracking overrides inherited mode, explicit canonical mode wins', () => {
  assert.equal(resolved({ 'mouse-tracking': false }).trackingMode, 'off');
  assert.equal(resolved({ 'mouse-tracking': true }).trackingMode, 'eyes');
  assert.equal(resolved({ 'mouse-tracking': false, 'tracking-mode': 'eyes-and-body' }).trackingMode, 'eyes-and-body');
});

test('orientation presets override inherited angles while explicit axes retain precedence', () => {
  assert.notEqual(resolved({ 'body-orientation': 'side' }).bodyOrientation.yaw, 0);
  assert.equal(resolved({ 'body-orientation': 'side', 'body-yaw': 12 }).bodyOrientation.yaw, 12);
});

test('appearance overrides preserve Studio ownership and source caller objects', () => {
  const original = structuredClone(scene);
  const edits = { shape: 'heart', 'left-smile': .75, accessories: [createAccessory('glasses')] };
  const result = resolved(edits);
  assert.equal(result.design.body.shape, 'heart');
  assert.equal(result.design.eyes.left.weights.smile, .75);
  assert.deepEqual(scene, original);
  const attrs = compileReferenceAttributes(scene, edits);
  attrs.accessories[0].color = '#000000';
  assert.notEqual(edits.accessories[0].color, '#000000');
});

test('absent undefined values are omitted identically in both source forms', () => {
  assert.doesNotMatch(referenceSource(scene, { emotion: undefined }), /emotion="undefined"/);
  assert.equal(Object.hasOwn(referenceReactProps({ emotion: undefined }), 'emotion'), false);
});

test('design JSON requires a structured design rather than a double-encoded string', () => {
  assert.throws(() => validateStateValue(FIELD_BY_KEY.get('design'), JSON.stringify(scene.design), scene));
  assert.throws(() => validateStateValue(FIELD_BY_KEY.get('design'), null, scene));
  assert.deepEqual(validateStateValue(FIELD_BY_KEY.get('design'), scene.design, scene), scene.design);
});

test('behavior selector text cannot break out of source markup or script boundaries', () => {
  const payload = '</script><script>globalThis.pwned=true</script><img src=x onerror=alert(1)>"&';
  const edits = { behavior: { type: 'wait', target: payload } };
  const html = referenceSource(scene, edits);
  const dom = new JSDOM(html);
  assert.equal(dom.window.document.querySelectorAll('script').length, 1);
  assert.equal(dom.window.document.querySelectorAll('img').length, 0);
  assert.deepEqual(JSON.parse(dom.window.document.querySelector('sidekick-avatar').getAttribute('behavior')), edits.behavior);
  const react = referenceSource(scene, edits, 'react');
  assert.doesNotMatch(react, /<script>globalThis/);
  assert.match(react, /\\u003c\/script>/);
  dom.window.close();
});

test('JSON validation rejects malformed motion, unknown accessory IDs, and invalid slot data', () => {
  for (const [key, value] of [['motion', { body: { rotation: [0, 0, 99] } }], ['accessories', {}], ['design', { ...scene.design, extraneous: 1 }]]) {
    assert.throws(() => validateStateValue(FIELD_BY_KEY.get(key), value, scene), key);
  }
});


test('combined validation rejects missing motion accessories and duplicate slot-generated IDs atomically', () => {
  assert.throws(() => compileReferenceAttributes(scene, { motion: { accessories: { absent: { rotation: [0, 0, 0] } } } }));
  const edits = { accessories: [createAccessory('glasses', { id: 'beret' })], 'head-accessory': 'beret' };
  const snapshot = structuredClone(edits);
  assert.throws(() => compileReferenceAttributes(scene, edits));
  assert.deepEqual(edits, snapshot);
});


test('URL context parser accepts only bounded typed state fields and rejects cross-page payloads', () => {
  // Evaluate only the repository's parser, without loading browser UI/CSS modules.
  const source = readFileSync(new URL('../playground/state-reference.js', import.meta.url), 'utf8');
  const declaration = source.slice(source.indexOf('export function readStateReferenceContext'), source.indexOf('export function mountStateReference')).replace('export function', 'function');
  const parse = new Function('STATE_IDS', 'STATE_FIELDS', 'validateStateValue', 'compileReferenceAttributes', 'MAX_CONTEXT', declaration + ';return readStateReferenceContext;')(STATE_IDS, STATE_FIELDS, validateStateValue, compileReferenceAttributes, 16384);
  const url = data => 'https://example.test/guide.html?state=' + encodeURIComponent(JSON.stringify(data));
  const valid = { id: 'state-execution', values: { paused: false, time: 2 } };
  assert.deepEqual(parse(url(valid), scene), valid);
  for (const payload of [
    { id: 'state-execution', values: { paused: 'false' } },
    { id: 'state-execution', values: { shape: 'heart' } },
    { id: 'state-execution', values: { time: -1 } },
    { id: 'state-execution', values: {}, extra: true },
    { id: 'unknown', values: {} },
    { id: 'state-facing', values: { 'camera-yaw': 10 } },
    { id: 'state-appearance', values: { design: 'x'.repeat(17000) } },
  ]) assert.equal(parse(url(payload), scene), null);
  assert.equal(parse('https://example.test/?state=%7Binvalid', scene), null);
});
