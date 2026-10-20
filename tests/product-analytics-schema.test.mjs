import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { PRODUCT_BODY_SHAPES, PRODUCT_ACCESSORIES, PRODUCT_EYE_STATES, PRODUCT_SECTIONS, botCombination, eyeSemanticState, sanitizeProductEvent, sanitizeSiteSection } from '../playground/product-analytics-schema.js';
import { createBotPreviewTracker } from '../playground/bot-preview-analytics.js';
import { prepareBotUsage } from '../playground/site-product-usage.js';
import { mountSiteAnalytics } from '../playground/site-analytics.js';
import { guideIds } from '../playground/guide-navigation.js';
const eye = (smile = 0, blink = 0) => ({ weights: { smile, blink } });
const design = (shape = 'square', accessories = []) => ({ version: 7, body: { shape, color: '#ffcc37' }, eyes: { color: '#24242c', left: eye(), right: eye() }, accessories });
const accessory = (preset, slot, id = 'PRIVATE-ID') => ({ id, preset, slot, color: '#abcdef' });
const props = (d = design()) => ({ site_page: 'studio', site_section: 'appearance', ...botCombination(d) });

test('site schema catalogs match the actual library catalogs and allowlisted sections', () => {
  const shapesSource = readFileSync(new URL('../src/core/shapes.ts', import.meta.url), 'utf8');
  const names = JSON.parse(shapesSource.match(/MATERIAL_SHAPE_NAMES = Object.freeze\((\[[^\n]+\]) as const\)/)[1]);
  assert.deepEqual(PRODUCT_BODY_SHAPES, names);
  const source = readFileSync(new URL('../src/core/design.ts', import.meta.url), 'utf8');
  const presets = source.match(/ACCESSORY_PRESETS:[^\n]+Object.freeze\(\[([^\]]+)\]/)[1].match(/'[^']+'/g).map(s => s.slice(1, -1));
  assert.deepEqual([...new Set(Object.values(PRODUCT_ACCESSORIES).flat().filter(s => s !== 'none'))], presets);
  for (const id of guideIds) { assert.equal(sanitizeSiteSection('guide', id), id); assert.equal(sanitizeSiteSection('api', id), id); }
  assert.deepEqual(PRODUCT_SECTIONS.studio, ['appearance', 'animation', 'orientation', 'scene', 'json']);
  for (const value of ['private-user-text', '', '__proto__', null, {}, 3]) assert.equal(sanitizeSiteSection('api', value), null);
  assert.equal(sanitizeSiteSection({ toString() { throw new Error('do not read'); } }, 'appearance'), null);
});

test('eye weights become four semantic states; invalid weights never enter events', () => {
  assert.equal(eyeSemanticState(eye()), 'neutral');
  assert.equal(eyeSemanticState(eye(1, 0)), 'smile');
  assert.equal(eyeSemanticState(eye(0, 1)), 'blink');
  for (const weights of [eye(.01, 0), eye(.83, .39), eye(1, 1)]) assert.equal(eyeSemanticState(weights), 'custom');
  for (const value of [null, {}, eye(NaN), eye(Infinity), eye(-1), eye(1.1), { weights: { smile: 'private', blink: 0 } }]) assert.equal(eyeSemanticState(value), null);
});

test('full combination is ordered, stable, compact, independent of colors/IDs/order, and preserves both ear slots', () => {
  const d = design('ghostish', [accessory('beret', 'head'), accessory('glasses', 'eyes'), accessory('moustache', 'mouth'), accessory('bowTie', 'neck'), accessory('earring', 'leftEar'), accessory('starEarring', 'rightEar')]);
  d.eyes.left = eye(1); d.eyes.right = eye(0, 1);
  const result = botCombination(d);
  assert.deepEqual(result, { schema_version: 1, body_shape: 'ghostish', eye_left: 'smile', eye_right: 'blink', accessory_head: 'beret', accessory_eyes: 'glasses', accessory_mouth: 'moustache', accessory_neck: 'bowTie', accessory_left_ear: 'earring', accessory_right_ear: 'starEarring', combination_key: 'v1.l.1.2.1.1.1.1.1.2' });
  assert.ok(result.combination_key.length < 100);
  const changed = structuredClone(d); changed.body.color = '#010203'; changed.eyes.color = '#030405'; changed.accessories.reverse().forEach(item => { item.id = 'OTHER PRIVATE'; item.color = '#000000'; });
  assert.deepEqual(botCombination(changed), result);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|#|weights|color/);
  [changed.accessories.find(a => a.slot === 'leftEar').preset, changed.accessories.find(a => a.slot === 'rightEar').preset] = ['starEarring', 'earring'];
  assert.notEqual(botCombination(changed).combination_key, result.combination_key);
});

test('keys distinguish every categorical field without including arbitrary data', () => {
  const seen = new Set([props().combination_key]);
  const base = props();
  const dimensions = { body_shape: PRODUCT_BODY_SHAPES, eye_left: PRODUCT_EYE_STATES, eye_right: PRODUCT_EYE_STATES, ...Object.fromEntries(Object.entries(PRODUCT_ACCESSORIES).map(([slot, values]) => [`accessory_${slot === 'leftEar' ? 'left_ear' : slot === 'rightEar' ? 'right_ear' : slot}`, values])) };
  for (const [key, values] of Object.entries(dimensions)) for (const value of values) {
    if (base[key] === value) continue;
    const event = sanitizeProductEvent('bot_preview', { ...base, [key]: value });
    assert.ok(event); assert.equal(seen.has(event.combination_key), false, `${key}=${value}`); seen.add(event.combination_key);
  }
  const d = design(); d.eyes.left = eye(.1, .2); const a = botCombination(d); d.eyes.left = eye(.7, .9);
  assert.deepEqual(botCombination(d), a);
});

test('malformed designs and illegal slot/preset combinations fail closed', () => {
  for (const d of [null, {}, design('PRIVATE-SHAPE'), design('square', [accessory('PRIVATE', 'head')]), design('square', [accessory('earring', 'head')]), design('square', [accessory('glasses', 'eyes'), accessory('sunglasses', 'eyes')]), design('square', [accessory('beret', 'private-slot')]), design('square', Array(7).fill(accessory('beret', 'head')))]) assert.equal(botCombination(d), null);
  let reads = 0; const d = design(); Object.defineProperty(d.body, 'shape', { get() { reads++; return 'square'; } });
  assert.equal(botCombination(d), null); assert.equal(reads, 0);
});

test('every supported event is rebuilt from enums and unknown properties are discarded', () => {
  const unsafe = { ...props(), combination_key: 'PRIVATE-KEY', arbitrary: 'PRIVATE', context: 'SECRET', source: 'SOURCE', state: '{RAW}', format: 'json', apply_kind: 'json', preset: 'default' };
  for (const name of ['bot_preview', 'bot_apply', 'preset_apply', 'bot_copy', 'bot_export']) {
    const safe = sanitizeProductEvent(name, unsafe); assert.ok(safe);
    assert.equal(safe.combination_key, props().combination_key);
    assert.doesNotMatch(JSON.stringify(safe), /PRIVATE|SECRET|SOURCE|RAW/);
    assert.equal('format' in safe, ['bot_copy', 'bot_export'].includes(name));
    assert.equal('apply_kind' in safe, name === 'bot_apply'); assert.equal('preset' in safe, name === 'preset_apply');
  }
  for (const [name, extra] of [['unknown', {}], ['bot_copy', { format: 'PRIVATE' }], ['bot_export', { format: 'html' }], ['bot_apply', { apply_kind: 'UNKNOWN' }], ['preset_apply', { preset: 'user saved name' }], ['bot_preview', { accessory_head: 'glasses' }], ['bot_preview', { site_page: 'https://secret' }], ['bot_preview', { site_section: 'SECRET' }]]) assert.equal(sanitizeProductEvent(name, { ...unsafe, ...extra }), null);
  const inherited = Object.create(props()); assert.equal(sanitizeProductEvent('bot_preview', inherited), null);
});

test('section events reject freeform paths, invalid durations and reasons', () => {
  const context = { site_page: 'api', site_section: 'assets' };
  assert.deepEqual(sanitizeProductEvent('section_view', { ...context, arbitrary: 'PRIVATE' }), context);
  assert.deepEqual(sanitizeProductEvent('section_engagement', { ...context, active_duration_ms: 30000, end_reason: 'heartbeat', private: 'SECRET' }), { ...context, active_duration_ms: 30000, end_reason: 'heartbeat' });
  for (const ms of [0, -1, 30001, 1.5, NaN, Infinity, '100']) assert.equal(sanitizeProductEvent('section_engagement', { ...context, active_duration_ms: ms, end_reason: 'idle' }), null);
  assert.equal(sanitizeProductEvent('section_engagement', { ...context, active_duration_ms: 10, end_reason: 'private' }), null);
});

function trackerFixture(initial = design()) {
  let granted = true, version = 0, now = 0, sequence = 0;
  const timers = new Map(), events = [];
  const tracker = createBotPreviewTracker({ hasConsent: () => granted, consentVersion: () => version, record: (name, properties) => events.push({ name, properties }), schedule: (callback, delay) => { const id = ++sequence; timers.set(id, { callback, at: now + delay }); return id; }, cancel: id => timers.delete(id) }, initial);
  return { tracker, events, timers, consent(value) { granted = value; version++; }, advance(ms) { now += ms; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); } } };
}

test('preview ignores initial/restored state, settles at 600 ms and deduplicates semantic choices', () => {
  const initial = design('heart'), f = trackerFixture(initial);
  f.tracker.observe(initial, 'appearance'); f.advance(2000); assert.equal(f.events.length, 0);
  f.tracker.observe(design('circle'), 'appearance'); f.advance(599); assert.equal(f.events.length, 0);
  f.tracker.observe(design('square'), 'appearance'); f.advance(599); assert.equal(f.events.length, 0); f.advance(1);
  assert.equal(f.events.length, 1); assert.equal(f.events[0].properties.body_shape, 'square');
  f.tracker.observe(design('square'), 'appearance'); f.advance(1000); assert.equal(f.events.length, 1);
  f.tracker.observe(design('circle'), 'appearance'); f.tracker.observe(design('square'), 'appearance'); f.advance(1000); assert.equal(f.events.length, 1);
});

test('repeated custom slider values reset the settling deadline without per-frame or raw-weight events', () => {
  const f = trackerFixture(), d = design(); d.eyes.left = eye(.1);
  f.tracker.observe(d, 'animation'); f.advance(500);
  const next = structuredClone(d); next.eyes.left = eye(.2); f.tracker.observe(next, 'animation'); f.advance(500); assert.equal(f.events.length, 0);
  // Reports/runtime events reuse the same design and must not continually postpone the choice.
  f.tracker.observe(next, 'animation'); f.advance(100); assert.equal(f.events.length, 1);
  assert.equal(f.events[0].properties.eye_left, 'custom'); assert.doesNotMatch(JSON.stringify(f.events), /0\.2|weights/);
});

test('pre-consent choices, revoke/regrant races and disposed previews never replay', () => {
  const f = trackerFixture(); f.consent(false); f.tracker.observe(design('heart'), 'appearance'); f.consent(true); f.advance(1000); assert.equal(f.events.length, 0);
  f.tracker.observe(design('circle'), 'appearance'); f.consent(false); f.consent(true); f.advance(1000); assert.equal(f.events.length, 0);
  f.tracker.observe(design('heart'), 'appearance'); f.advance(600); assert.equal(f.events.length, 1);
  f.tracker.observe(design('circle'), 'appearance'); f.tracker.dispose(); f.advance(1000); assert.equal(f.events.length, 1); assert.equal(f.timers.size, 0);
});

test('new consent epoch resets deduplication without replaying historical or pre-consent choices', () => {
  const f = trackerFixture();
  f.tracker.observe(design('heart'), 'appearance'); f.advance(600); assert.equal(f.events.length, 1);
  f.consent(false); f.tracker.observe(design('circle'), 'appearance'); f.advance(1000);
  f.consent(true); f.advance(1000); assert.equal(f.events.length, 1);
  // A genuine new choice may revisit a combination recorded under the old consent epoch.
  f.tracker.observe(design('heart'), 'appearance'); f.advance(600);
  assert.equal(f.events.length, 2); assert.equal(f.events[1].properties.body_shape, 'heart');
  f.consent(false); f.consent(true); f.tracker.observe(design('heart'), 'appearance'); f.advance(1000);
  assert.equal(f.events.length, 2);
});

test('explicit action completion is single-use, success-only, captures categories at start and enforces consent epoch', t => {
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://sidekick.hananakick.cc/' }); t.after(() => dom.window.close());
  const win = dom.window, analytics = mountSiteAnalytics(win.document, 'studio', { production: true, enabled: 'true', measurementId: 'G-TESTONLY01' });
  const events = () => (win.dataLayer ?? []).map(args => [...args]).filter(args => args[0] === 'event' && args[1] === 'bot_copy');
  const context = { site_page: 'studio', site_section: 'json', format: 'json' };
  const denied = prepareBotUsage(win, 'bot_copy', design(), context);
  analytics.setConsent('granted'); win.document.querySelector('script').dispatchEvent(new win.Event('load'));
  denied(); assert.equal(events().length, 0);
  const d = design('heart'), completed = prepareBotUsage(win, 'bot_copy', d, context); d.body.shape = 'circle';
  assert.equal(completed(), true); assert.equal(completed(), false); assert.equal(events().length, 1); assert.equal(events()[0][2].body_shape, 'heart');
  prepareBotUsage(win, 'bot_copy', design('circle'), context); // Failed operation: never call completion.
  assert.equal(events().length, 1);
  const stale = prepareBotUsage(win, 'bot_copy', design(), context); analytics.setConsent('denied'); analytics.setConsent('granted');
  assert.equal(stale(), false); assert.equal(events().length, 1);
});
