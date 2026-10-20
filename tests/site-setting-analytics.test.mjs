import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { PRODUCT_SETTINGS, PRODUCT_COLOR_FAMILIES, colorFamily, settingValueCategory, settingObservations, sanitizeProductEvent } from '../playground/product-analytics-schema.js';
import { recordSettingChange, cancelSettingChange } from '../playground/site-setting-analytics.js';
import { prepareBotUsage } from '../playground/site-product-usage.js';
import { mountSiteAnalytics } from '../playground/site-analytics.js';
const properties = (key, category, more = {}) => ({ site_page: 'studio', site_section: 'animation', setting_key: key, value_category: category, change_source: 'control', ...more });
const design = { body: { shape: 'square', color: '#ffcc37', extra: 'PRIVATE' }, eyes: { color: '#24242c', left: { weights: { smile: 0, blink: 0 } }, right: { weights: { smile: 0, blink: 0 } } }, accessories: [] };
const runtime = { activity: 'idle', trackingMode: 'eyes-and-body', zoom: 1, paused: false, bodyOrientation: { yaw: 0, pitch: 0, roll: 0 }, shapeDuration: 450, shapeEasing: 'smooth', jsonDraft: 'PRIVATE RAW JSON', motion: { unknown: 'PRIVATE' }, time: 123.456 };

test('numeric settings are projected into fixed categories with explicit bounds, never raw values', () => {
  for (const [key, cases] of Object.entries({
    size: [[0, null], [1, 'tiny'], [72, 'tiny'], [144, 'small'], [240, 'medium'], [480, 'large'], [2048, 'xlarge'], [2049, null]],
    zoom: [[.4, null], [.5, 'reduced'], [1, 'normal'], [1.5, 'enlarged'], [2, 'large'], [3, 'xlarge'], [4, null]],
    emotion_intensity: [[-1, null], [0, 'off'], [.33, 'low'], [.66, 'medium'], [.99, 'high'], [1, 'full'], [1.1, null]],
    shape_duration: [[-1, null], [0, 'zero'], [250, 'short'], [1000, 'medium'], [3000, 'long'], [60000, 'extended'], [60001, null]],
    positioning_gap: [[-10001, null], [-1, 'negative'], [0, 'zero'], [8, 'small'], [24, 'medium'], [64, 'large'], [10000, 'xlarge'], [10001, null]],
    behavior_gap: [[-1, null], [16, 'medium']], entrance_distance: [[-1, null], [24, 'medium']],
    body_yaw: [[-361, null], [-180, 'far_negative'], [-1, 'negative'], [0, 'zero'], [90, 'positive'], [180, 'far_positive']],
    move_max_speed: [[0, null], [300, 'slow'], [1350, 'medium'], [5000, 'fast'], [100000, 'very_fast'], [100001, null]],
  })) for (const [value, expected] of cases) assert.equal(settingValueCategory(key, value), expected, `${key}:${value}`);
  for (const value of [NaN, Infinity, '1', {}, null]) assert.equal(settingValueCategory('zoom', value), null);
  assert.equal(settingValueCategory('paused', false), 'false'); assert.equal(settingValueCategory('paused', 'false'), null);
  assert.equal(settingValueCategory('render_style', '3d'), 'flat');
  assert.equal(settingValueCategory('body_shape', 'heart'), 'heart'); assert.equal(settingValueCategory('body_shape', 'PRIVATE'), null);
  assert.equal(settingValueCategory('target_selector', '#private'), null);
});

test('setting event schema rejects unknown keys, cross-key categories, sources and arbitrary properties', () => {
  for (const [setting_key, values] of Object.entries(PRODUCT_SETTINGS)) for (const value_category of values) {
    const event = sanitizeProductEvent('setting_change', properties(setting_key, value_category, { raw: 'PRIVATE', input: '{JSON}', target: '#PRIVATE' }));
    assert.deepEqual(event, properties(setting_key, value_category));
    const observed = sanitizeProductEvent('setting_observation', { ...properties(setting_key, value_category), observation_source: 'export' });
    assert.equal(observed.observation_source, 'export'); assert.equal('change_source' in observed, false);
  }
  for (const patch of [{ setting_key: 'private-user-setting' }, { value_category: 'PRIVATE' }, { setting_key: 'zoom', value_category: 1.5 }, { change_source: 'automatic' }, { site_section: 'private-url' }]) assert.equal(sanitizeProductEvent('setting_change', { ...properties('paused', 'false'), ...patch }), null);
  assert.equal(sanitizeProductEvent('setting_observation', { ...properties('paused', 'false'), observation_source: 'page_load' }), null);
});

test('successful handoff projection includes supported defaults but excludes arbitrary scene fields and data', () => {
  const observations = settingObservations(design, runtime), values = Object.fromEntries(observations.map(item => [item.setting_key, item.value_category]));
  assert.equal(observations.length, 18);
  assert.equal(values.body_shape, 'square'); assert.equal(values.accessory_head, 'none'); assert.equal(values.left_expression, 'neutral');
  assert.equal(values.zoom, 'normal'); assert.equal(values.paused, 'false'); assert.equal(values.activity, 'idle'); assert.equal(values.body_orientation, 'front');
  assert.equal(values.body_color_family, 'yellow'); assert.equal(values.eye_color_family, 'gray');
  assert.equal(values.tracking_mode, 'eyes-and-body'); assert.equal(values.shape_duration, 'medium');
  assert.doesNotMatch(JSON.stringify(observations), /PRIVATE|123\.456|weights|jsonDraft|motion|#/);
  assert.deepEqual(settingObservations(null, runtime), []);
});

function fixture(t) {
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://sidekick.hananakick.cc/' }); t.after(() => dom.window.close());
  const win = dom.window, analytics = mountSiteAnalytics(win.document, 'studio', { production: true, enabled: 'true', measurementId: 'G-TESTONLY01' });
  let now = 0, seq = 0; const timers = new Map();
  win.setTimeout = (callback, delay) => { const id = ++seq; timers.set(id, { callback, at: now + delay }); return id; };
  win.clearTimeout = id => timers.delete(id);
  const events = name => (win.dataLayer ?? []).map(args => [...args]).filter(args => args[0] === 'event' && args[1] === name).map(args => args[2]);
  return { win, analytics, timers, events, grant() { analytics.setConsent('granted'); win.document.querySelector('script')?.dispatchEvent(new win.Event('load')); }, advance(ms) { now += ms; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); } } };
}

test('settings require explicit calls, dedupe values, settle sliders, and never replay pre-consent/old-epoch input', t => {
  const f = fixture(t);
  recordSettingChange(f.win, properties('zoom', 'enlarged'), { debounce: true }); f.grant(); f.advance(1000);
  assert.equal(f.events('setting_change').length, 0);
  recordSettingChange(f.win, properties('zoom', 'enlarged'), { debounce: true }); f.advance(500);
  recordSettingChange(f.win, properties('zoom', 'large'), { debounce: true }); f.advance(599); assert.equal(f.events('setting_change').length, 0);
  f.advance(1); assert.equal(f.events('setting_change').length, 1); assert.equal(f.events('setting_change')[0].value_category, 'large');
  recordSettingChange(f.win, properties('zoom', 'large'), { debounce: true }); f.advance(1000); assert.equal(f.events('setting_change').length, 1);
  recordSettingChange(f.win, properties('zoom', 'normal'), { debounce: true }); f.analytics.setConsent('denied'); f.grant(); f.advance(1000); assert.equal(f.events('setting_change').length, 1);
  recordSettingChange(f.win, properties('zoom', 'large')); assert.equal(f.events('setting_change').length, 2);
  recordSettingChange(f.win, properties('paused', 'true')); assert.equal(f.events('setting_change').length, 3);
  recordSettingChange(f.win, properties('zoom', 'normal'), { debounce: true });
  cancelSettingChange(f.win, { site_page: 'studio', site_section: 'animation', setting_key: 'zoom' });
  f.advance(1000); assert.equal(f.events('setting_change').length, 3);
});

test('supported setting observations emit only for successful actions and capture the starting snapshot', t => {
  const f = fixture(t); f.grant();
  const config = structuredClone(runtime), completion = prepareBotUsage(f.win, 'bot_export', design, { site_page: 'studio', site_section: 'json', format: 'json' }, config);
  config.zoom = 3;
  assert.equal(f.events('setting_observation').length, 0);
  completion(); completion();
  assert.equal(f.events('setting_observation').length, 18);
  assert.ok(f.events('setting_observation').every(event => event.observation_source === 'export'));
  assert.equal(f.events('setting_observation').find(event => event.setting_key === 'zoom').value_category, 'normal');
  const stale = prepareBotUsage(f.win, 'bot_copy', design, { site_page: 'studio', site_section: 'json', format: 'json' }, runtime);
  f.analytics.setConsent('denied'); f.grant(); stale(); assert.equal(f.events('setting_observation').length, 18);
});


test('color families are finite, case-insensitive and never contain hex/RGB/hue/lightness or custom values', () => {
  for (const [hex, family] of Object.entries({ '#000000': 'black', '#FFFFFF': 'white', '#808080': 'gray', '#ff0000': 'red', '#ff8000': 'orange', '#ffff00': 'yellow', '#ffcc37': 'yellow', '#00ff00': 'green', '#00ffff': 'cyan', '#0000ff': 'blue', '#8000ff': 'purple', '#ff00ff': 'pink', '#8b4513': 'brown' })) {
    assert.equal(colorFamily(hex), family); assert.equal(colorFamily(hex.toUpperCase()), family);
    assert.equal(settingValueCategory('body_color_family', hex), family);
    assert.equal(settingValueCategory('eye_color_family', hex), family);
    assert.equal(settingValueCategory('accessory_left_ear_color_family', hex), family);
    assert.ok(PRODUCT_COLOR_FAMILIES.includes(family));
    const safe = sanitizeProductEvent('setting_change', properties('body_color_family', family, { color: hex, rgb: [1, 2, 3], hue: 25, lightness: .5, id: 'PRIVATE-ID' }));
    assert.equal(safe.value_category, family); assert.doesNotMatch(JSON.stringify(safe), /#|rgb|hue|lightness|PRIVATE/);
    assert.equal(sanitizeProductEvent('setting_change', properties('body_color_family', hex)), null);
  }
  for (const value of ['red', '#fff', '#11223344', ' #112233', '#gggggg', 'rgb(1,2,3)', null, {}, 123]) assert.equal(colorFamily(value), null);
  const withAccessories = { ...design, accessories: [{ id: 'PRIVATE-ID', slot: 'head', preset: 'beret', color: '#ff0000' }] };
  assert.equal(settingObservations(withAccessories, runtime).length, 19);
  assert.deepEqual(settingObservations(withAccessories, runtime).find(item => item.setting_key === 'accessory_head_color_family'), { setting_key: 'accessory_head_color_family', value_category: 'red' });
  assert.equal(settingObservations(withAccessories, runtime).some(item => item.setting_key === 'accessory_eyes_color_family'), false);
  const allEquipped = { ...design, accessories: [['head', 'beret'], ['eyes', 'glasses'], ['mouth', 'moustache'], ['neck', 'scarf'], ['leftEar', 'earring'], ['rightEar', 'starEarring']].map(([slot, preset]) => ({ slot, preset, id: 'PRIVATE-' + slot, color: '#ff8000' })) };
  assert.equal(settingObservations(allEquipped, runtime).length, 24);
  assert.equal(settingObservations(allEquipped, runtime).filter(item => item.setting_key.startsWith('accessory_') && item.setting_key.endsWith('_color_family')).length, 6);
  assert.doesNotMatch(JSON.stringify(settingObservations(allEquipped, runtime)), /PRIVATE|#ff8000/);
});
