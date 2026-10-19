import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { API_LOCALES, API_MESSAGES, apiText, applyApiLocale, apiError } from '../playground/api-locales.js';
import { getSiteLocale, setSiteLocale } from '../playground/site-i18n.js';
import { codeForAction, executeAction } from '../playground/playground-actions.js';

const html = await readFile(new URL('../api-playground.html', import.meta.url), 'utf8');
const source = (await readFile(new URL('../playground/api-playground.js', import.meta.url), 'utf8')).replace(/^import[^\n]+\n/gm, '');
const shapesSource = await readFile(new URL('../src/core/shapes.ts', import.meta.url), 'utf8');
const shapeNames = JSON.parse(shapesSource.match(/MATERIAL_SHAPE_NAMES = Object.freeze\((\[.*?\])/)[1]);
const accessories = ['beret', 'halo', 'crown', 'glasses', 'sunglasses', 'bowTie', 'scarf', 'necklace'];
const phrases = key => API_LOCALES.map(locale => API_MESSAGES[locale][key]);

test('API dictionaries explicitly cover every locale, shape, accessory, and runtime phase', () => {
  const keys = Object.keys(API_MESSAGES.ko).sort();
  assert.ok(keys.length >= 190);
  for (const locale of API_LOCALES) {
    assert.deepEqual(Object.keys(API_MESSAGES[locale]).sort(), keys);
    for (const key of keys) assert.ok(typeof API_MESSAGES[locale][key] === 'string' && API_MESSAGES[locale][key].trim(), `${locale}.${key}`);
    for (const shape of shapeNames) assert.ok(API_MESSAGES[locale][`shape.${shape}`], `${locale}: ${shape}`);
    for (const accessory of accessories) assert.ok(API_MESSAGES[locale][`accessory.${accessory}`], `${locale}: ${accessory}`);
    for (const phase of ['idle', 'takeoff', 'flight', 'landing', 'braking', 'settling', 'hidden']) assert.ok(API_MESSAGES[locale][`phase.${phase}`]);
  }
  for (const key of ['intro', 'anchorHelp', 'timingNatural', 'orientationHelp', 'installationHelp', 'copiedPrevious', 'invalidNumber']) {
    assert.equal(new Set(phrases(key)).size, 4, `${key} is independently translated in all four languages`);
  }
  assert.throws(() => apiText('missing-key'), /Missing API translation/);
});

test('declared HTML translations are complete leaf labels and do not match arbitrary text', () => {
  const dom = new JSDOM(html); const d = dom.window.document;
  try {
    const nodes = [...d.querySelectorAll('[data-api-i18n]')];
    assert.ok(nodes.length >= 120);
    for (const node of nodes) assert.equal(node.childElementCount, 0, `${node.dataset.apiI18n} must be a leaf`);
    const unmarked = d.createElement('p'); unmarked.textContent = '코드 복사'; d.body.append(unmarked);
    const values = [...d.querySelectorAll('select')].map(select => [select.id, [...select.options].map(option => option.value)]);
    for (const locale of API_LOCALES) {
      applyApiLocale(d, locale);
      for (const node of nodes) assert.equal(node.textContent, API_MESSAGES[locale][node.dataset.apiI18n]);
      for (const node of d.querySelectorAll('[data-api-i18n-aria-label]')) assert.equal(node.getAttribute('aria-label'), API_MESSAGES[locale][node.dataset.apiI18nAriaLabel]);
      assert.deepEqual([...d.querySelectorAll('select')].map(select => [select.id, [...select.options].map(option => option.value)]), values);
      assert.equal(unmarked.textContent, '코드 복사');
      assert.equal(d.getElementById('target-selector').placeholder, '#my-element');
    }
  } finally { dom.window.close(); }
});

async function fixture(t, initialLocale = 'ko') {
  let locale = initialLocale;
  const listeners = new Set();
  const dom = new JSDOM(html, { url: `https://sidekick.test/api-playground.html?lang=${locale}`, runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const w = dom.window, $ = id => w.document.getElementById(id);
  const changeLocale = value => { locale = value; for (const callback of listeners) callback(); };
  Object.assign(w, {
    structuredClone, codeForAction, executeAction, apiError, apiText,
    getSiteLocale: () => locale, subscribeSiteLocale: callback => { listeners.add(callback); return () => listeners.delete(callback); },
    applyApiLocale: root => applyApiLocale(root, locale),
    createAccessory: preset => ({ preset }), MATERIAL_SHAPE_LABELS: Object.fromEntries(shapeNames.map(name => [name, name])),
    mountSiteHeader() {}, loadStudioSession: () => ({ get message() { return apiText('ready', {}, locale); }, scene: { design: {}, trackingMode: 'eyes-and-body', bodyOrientation: { yaw: 0, pitch: 0, roll: 0 }, zoom: 1 } }), applyStudioSession: async () => {},
  });
  const preference = { matches: false, addEventListener() {} }; w.matchMedia = () => preference;
  class Avatar extends w.HTMLElement {
    ready = true; calls = []; activity = 'thinking'; trackingMode = 'eyes-and-body'; zoom = 1; point = { x: 0, y: 0 };
    get position() { return this.point; } get offsetWidth() { return 180; } get offsetHeight() { return 180; }
    movementState = { phase: 'flight', progress: 0.5, velocity: { x: 30, y: 40 }, acceleration: { x: 0, y: 0 }, speed: 50 };
    moveTo(...args) { this.calls.push({ method: 'moveTo', args }); this.point = args[0]; return Promise.resolve({ finished: true }); }
  }
  for (const method of ['moveBy', 'setExpression', 'setActivity', 'play', 'stop', 'setBodyOrientation', 'transitionTo', 'cancelMove', 'cancelTransition', 'enter', 'exit', 'detachAnchor', 'moveToElement']) Avatar.prototype[method] = function (...args) { this.calls.push({ method, args }); return Promise.resolve({ finished: true }); };
  w.customElements.define('sidekick-avatar', Avatar); w.eval(source); await new Promise(resolve => setImmediate(resolve));
  const bot = $('bot'); bot.calls.length = 0;
  const input = (id, value) => { $(id).value = String(value); $(id).dispatchEvent(new w.Event('input', { bubbles: true })); };
  return { w, $, bot, input, changeLocale, preference };
}

const controlsSnapshot = d => [...d.querySelectorAll('input,select')].map(node => [node.id, node.value, node.checked, node.disabled]);

test('locale switching preserves draft, all controls, code, selected text, focus, expanded panels, and the live bot', async t => {
  const f = await fixture(t);
  f.input('move-method', 'moveToElement'); f.input('target-x', -37); f.input('target-y', 81);
  f.$('element-anchor').checked = true;
  f.input('action-kind', 'assets'); f.input('shape', 'pixelTriangle'); f.input('head-accessory', 'crown'); f.input('neck-accessory', 'bowTie');
  f.$('execute').click(); await new Promise(resolve => setImmediate(resolve));
  f.$('code-format').value = 'react'; f.$('code-format').dispatchEvent(new f.w.Event('change'));
  f.$('install-guide').open = true; f.$('diagnostics').open = true;
  f.$('target-selector').focus(); f.$('target-selector').setSelectionRange(1, 5);
  const code = f.$('invocation').textContent, lastCode = f.$('last-invocation').textContent, installCode = f.$('install-code').textContent;
  const node = f.$('invocation').firstChild, range = f.w.document.createRange(); range.setStart(node, 7); range.setEnd(node, 23); f.w.getSelection().addRange(range);
  f.$('target-selector').focus();
  const focusedElement = f.w.document.activeElement;
  const selected = f.w.getSelection().toString(), controls = controlsSnapshot(f.w.document), callCount = f.bot.calls.length, point = f.bot.position;
  for (const locale of ['en', 'zh-CN', 'ja', 'ko', 'en']) {
    f.changeLocale(locale);
    assert.deepEqual(controlsSnapshot(f.w.document), controls);
    assert.equal(f.$('invocation').textContent, code); assert.equal(f.$('last-invocation').textContent, lastCode); assert.equal(f.$('install-code').textContent, installCode);
    assert.equal(f.$('invocation').firstChild, node); assert.equal(f.w.getSelection().toString(), selected);
    assert.equal(f.w.document.activeElement, focusedElement); assert.equal(f.$('target-selector').selectionStart, 1); assert.equal(f.$('target-selector').selectionEnd, 5);
    assert.equal(f.$('install-guide').open, true); assert.equal(f.$('diagnostics').open, true);
    assert.equal(f.$('bot'), f.bot); assert.equal(f.bot.calls.length, callCount); assert.equal(f.bot.position, point);
    assert.equal(f.$('status').textContent, API_MESSAGES[locale].applied);
    assert.equal(f.$('phase').textContent, API_MESSAGES[locale]['phase.flight']);
    assert.equal(f.$('activity-state').textContent, API_MESSAGES[locale]['activity.thinking']);
    assert.equal(f.$('shape').selectedOptions[0].textContent, API_MESSAGES[locale]['shape.pixelTriangle']);
    assert.equal(f.$('head-accessory').selectedOptions[0].textContent, API_MESSAGES[locale]['accessory.crown']);
    assert.equal(f.$('studio-session-status').textContent, API_MESSAGES[locale].ready);
  }
});

test('localized selects continue to emit exact API enum values in every language', async t => {
  const f = await fixture(t);
  for (const locale of API_LOCALES) {
    f.changeLocale(locale);
    f.input('action-kind', 'activity'); f.input('activity', 'celebrating'); f.input('activity-operation', 'play'); f.$('execute').click();
    assert.equal(f.bot.calls.at(-1).args[0], 'celebrating');
    f.input('action-kind', 'assets'); f.input('shape', 'heart'); f.input('head-accessory', 'halo'); f.input('eyes-accessory', 'sunglasses'); f.input('neck-accessory', 'bowTie'); f.$('execute').click();
    const action = f.bot.calls.at(-1); assert.equal(action.method, 'transitionTo'); assert.equal(action.args[0].shape, 'heart');
    assert.deepEqual([...action.args[0].accessories].map(item => item.preset), ['halo', 'sunglasses', 'bowTie']);
    assert.match(f.$('invocation').textContent, /shape: 'heart'/); assert.match(f.$('invocation').textContent, /createAccessory\('bowTie'\)/);
    assert.doesNotMatch(f.$('invocation').textContent, /庆祝|ハート|나비넥타이/);
  }
});

test('validation, missing and invalid selectors, copy notices, and motion settings retranslate immediately', async t => {
  const f = await fixture(t);
  f.input('duration', -1);
  for (const locale of API_LOCALES) {
    f.changeLocale(locale);
    assert.equal(f.$('execute').disabled, true);
    assert.equal(f.$('invocation').textContent, `// ${apiText('invalidNumber', { field: API_MESSAGES[locale].durationNatural }, locale)}`);
  }
  f.input('duration', 1200); f.input('move-method', 'moveToElement'); f.input('target-selector', '#missing');
  for (const locale of API_LOCALES) { f.changeLocale(locale); assert.equal(f.$('invocation').textContent, `// ${API_MESSAGES[locale].targetMissing}`); }
  f.input('target-selector', '[');
  for (const locale of API_LOCALES) { f.changeLocale(locale); assert.equal(f.$('invocation').textContent, `// ${API_MESSAGES[locale].selectorInvalid}`); }
  f.input('target-selector', '#action-panel');
  Object.defineProperty(f.w.navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } });
  f.$('copy').click(); await new Promise(resolve => setImmediate(resolve));
  for (const locale of API_LOCALES) {
    f.changeLocale(locale); assert.equal(f.$('copy-status').textContent, API_MESSAGES[locale].copied);
    assert.equal(f.$('motion-preference').textContent, API_MESSAGES[locale].motionPreference);
  }
  f.preference.matches = true;
  Object.defineProperty(f.w.navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('clipboard unavailable'); } } });
  f.$('copy').click(); await new Promise(resolve => setImmediate(resolve));
  for (const locale of API_LOCALES) {
    f.changeLocale(locale); assert.equal(f.$('copy-status').textContent, API_MESSAGES[locale].copyManually);
    assert.equal(f.$('motion-preference').textContent, API_MESSAGES[locale].reducedMotion);
  }
});

test('in-flight completion, stale-copy notices, runtime errors and logs use the current language', async t => {
  const f = await fixture(t);
  let finish; f.bot.moveTo = () => new Promise(resolve => { finish = resolve; });
  f.$('execute').click(); f.changeLocale('ja'); assert.equal(f.$('status').textContent, API_MESSAGES.ja.running);
  finish({ finished: false }); await new Promise(resolve => setImmediate(resolve)); assert.equal(f.$('status').textContent, API_MESSAGES.ja.interrupted);
  let copied; Object.defineProperty(f.w.navigator, 'clipboard', { value: { writeText: () => new Promise(resolve => { copied = resolve; }) } });
  f.$('copy').click(); f.input('target-x', 77); f.changeLocale('zh-CN'); copied(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.$('copy-status').textContent, API_MESSAGES['zh-CN'].copiedPrevious);
  f.bot.moveTo = () => { throw apiError('targetNotFound', { selector: '#missing' }); };
  f.$('execute').click();
  for (const locale of API_LOCALES) {
    f.changeLocale(locale);
    assert.equal(f.$('status').textContent, apiText('targetNotFound', { selector: '#missing' }, locale));
    assert.equal(f.$('result-log').firstChild.querySelector('strong').textContent, API_MESSAGES[locale].error);
    assert.equal(f.$('result-log').firstChild.querySelector('pre').textContent, JSON.stringify(apiText('targetNotFound', { selector: '#missing' }, locale)));
  }
});

test('action-layer missing-target errors use stable localized keys without modifying identifiers', () => {
  const previous = getSiteLocale();
  try {
    for (const locale of API_LOCALES) {
      setSiteLocale(locale);
      assert.throws(() => executeAction({ ownerDocument: { querySelector: () => null } }, { method: 'moveToElement', args: ['#my-target', {}] }), error => error.message === apiText('targetNotFound', { selector: '#my-target' }) && error.apiMessage.key === 'targetNotFound');
    }
  } finally { setSiteLocale(previous); }
});
