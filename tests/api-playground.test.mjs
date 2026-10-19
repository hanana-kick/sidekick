import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import { apiText, applyApiLocale, apiError } from '../playground/api-locales.js';
import { getSiteLocale, setSiteLocale, subscribeSiteLocale } from '../playground/site-i18n.js';
import { actionSource, executeAction, codeForAction } from '../playground/playground-actions.js';

test('Playground install and accessory snippets use the current released package version', async () => {
  const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  for (const file of ['api-playground.js', 'playground-actions.js']) {
    const source = await readFile(new URL(`../playground/${file}`, import.meta.url), 'utf8');
    const pins = [...source.matchAll(/(?:sidekick@|sidekick#)v(\d+\.\d+\.\d+)/g)].map(match => match[1]);
    assert.ok(pins.length > 0, `${file} includes an install or CDN pin`);
    assert.ok(pins.every(pin => pin === version), `${file} pins must match ${version}`);
  }
});

const actions = [
  { method: 'moveTo', args: [{ x: 300, y: 240 }, { duration: 850, travel: 'none', easing: 'linear' }] },
  { method: 'moveBy', args: [{ x: -40, y: 60 }, { duration: 1200, travel: 'natural', acceleration: 1800, deceleration: 2200 }] },
  { method: 'moveTo', args: [{ x: 400, y: 100 }, { travel: 'natural', maxSpeed: 240, acceleration: 700, deceleration: 1100 }] },
  { method: 'cancelMove', args: [] },
  { method: 'detachAnchor', args: [] },
  { method: 'setActivity', args: ['thinking'] },
  { method: 'play', args: ['celebrating', { duration: 1400 }] },
  { method: 'play', args: ['speaking'] },
  { method: 'stop', args: [] },
  ...['left', 'right', 'both'].map(side => ({ method: 'setExpression', args: [side, 'smile', { duration: 250 }] })),
  { property: 'trackingMode', value: 'eyes-only' },
  { property: 'trackingMode', value: 'eyes-and-body' },
  { property: 'trackingMode', value: 'off' },
  { property: 'zoom', value: 1.5 },
  { method: 'setBodyOrientation', args: [{ yaw: 15, pitch: -8, roll: 5 }] },
  { method: 'transitionTo', args: [{ shape: 'heart', accessories: ['halo', 'glasses', 'bowTie'] }, { duration: 700 }] },
  { method: 'transitionTo', args: [{ shape: 'ghostish', accessories: [] }, { duration: 0 }] },
  { method: 'cancelTransition', args: [] },
  { method: 'enter', args: [{ x: 200, y: 180 }, { from: 'left' }] },
  { method: 'exit', args: [{ to: 'right' }] },
];
const createAccessory = preset => ({ preset, created: true });
function recorder() {
  const calls = [];
  const avatar = new Proxy({}, {
    get: (_, method) => (...args) => { calls.push({ method, args }); return Promise.resolve({ finished: true }); },
    set: (_, property, value) => { calls.push({ property, value }); return true; },
  });
  return { avatar, calls };
}
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
function stripImports(source) { return source.replace(/^import\s.*?;\s*$/gm, ''); }

for (const action of actions) {
  test(`generated JavaScript executes the same descriptor: ${JSON.stringify(action)}`, async () => {
    const original = structuredClone(action);
    const expected = structuredClone(action);
    if (expected.method === 'transitionTo') expected.args[0].accessories = expected.args[0].accessories.map(createAccessory);
    const direct = recorder();
    await executeAction(direct.avatar, action, createAccessory);
    assert.deepEqual(direct.calls, [expected]);
    const sourceTarget = recorder();
    await new AsyncFunction('subject', 'createAccessory', actionSource(action, 'subject'))(sourceTarget.avatar, createAccessory);
    assert.deepEqual(sourceTarget.calls, direct.calls);
    const generated = recorder();
    const document = { querySelector: () => generated.avatar, getElementById: () => generated.avatar };
    await new AsyncFunction('document', 'createAccessory', stripImports(codeForAction(action)))(document, createAccessory);
    assert.deepEqual(generated.calls, direct.calls, 'copyable code and executed action must match exactly');
    assert.deepEqual(action, original, 'execution must not mutate descriptor');
  });
}

test('orientation and zoom remain a single compound descriptor in execution and copied code', async () => {
  const action = { steps: [{ method: 'setBodyOrientation', args: [{ yaw: 15, pitch: -8, roll: 5 }] }, { property: 'zoom', value: 1.5 }] };
  const direct = recorder(); await executeAction(direct.avatar, action, createAccessory);
  const copied = recorder(); await new AsyncFunction('avatar', 'createAccessory', actionSource(action))(copied.avatar, createAccessory);
  assert.deepEqual(direct.calls, action.steps); assert.deepEqual(copied.calls, direct.calls);
});

test('React examples compile as TSX and include the selected real API', () => {
  for (const action of actions) {
    const source = codeForAction(action, 'react');
    assert.match(source, /@hanana-kick\/sidekick\/react/);
    assert.match(source, /SidekickAvatar/);
    assert.match(source, /ref/);
    assert.ok(source.includes(action.method ?? action.property));
    const result = ts.transpileModule(source, { fileName: 'example.tsx', reportDiagnostics: true,
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
    assert.deepEqual(result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error), []);
  }
});

test('the playground is a free-page companion without a framed movement stage', async () => {
  const html = await readFile(new URL('../api-playground.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html);
  try {
    assert.equal(dom.window.document.querySelector('#movement-stage, .preview-panel'), null);
    for (const id of ['bot', 'action-kind', 'execute', 'code-format', 'copy', 'invocation']) assert.ok(dom.window.document.getElementById(id), id);
  } finally { dom.window.close(); }
});

test('both pages share a paused native avatar brand and accessible navigation', async t => {
  setSiteLocale('en'); t.after(() => setSiteLocale('ko'));
  const { mountSiteHeader } = await import('../playground/shared-header.js');
  const { resolveSidekickAttributes } = await import('../dist/library/element/attributes.js');
  const dom = new JSDOM('<div id="header"></div>', { url: 'https://sidekick.test/nested/' });
  t.after(() => dom.window.close());
  const host = dom.window.document.getElementById('header');
  for (const page of ['studio', 'api']) {
    const cleanup = mountSiteHeader(host, page, '/nested/');
    const avatar = host.querySelector('sidekick-avatar');
    const resolved = resolveSidekickAttributes(new Map([...avatar.attributes].map(a => [a.name, a.value])));
    assert.equal(resolved.design.body.shape, 'ghostish');
    assert.equal(resolved.paused, true);
    assert.equal(resolved.zoom, 2);
    assert.equal(resolved.trackingMode, 'off');
    assert.equal(resolved.interaction, 'none');
    assert.deepEqual(resolved.design.accessories.map(a => a.preset).sort(), ['beret', 'bowTie', 'glasses']);
    assert.equal(resolved.design.eyes.left.weights.smile, 1);
    assert.equal(resolved.design.eyes.right.weights.smile, 1);
    assert.equal(avatar.getAttribute('shape'), 'ghostish');
    assert.equal(avatar.getAttribute('body-color'), '#FFCC37');
    assert.equal(avatar.getAttribute('head-accessory'), 'beret');
    assert.equal(avatar.getAttribute('eyes-accessory'), 'glasses');
    assert.equal(avatar.getAttribute('neck-accessory'), 'bowTie');
    assert.equal(avatar.getAttribute('expression'), 'smile');
    assert.equal(avatar.getAttribute('aria-hidden'), 'true');
    assert.ok(avatar.hasAttribute('paused'));
    assert.equal(avatar.getAttribute('interaction'), 'none');
    assert.equal(avatar.getAttribute('tracking-mode'), 'off');
    assert.equal(host.querySelectorAll('[aria-current="page"]').length, 1);
    assert.equal(host.querySelector('[aria-current="page"]').textContent, page === 'api' ? 'API playground' : 'Studio');
    assert.equal(host.querySelector('.brand').href, 'https://sidekick.test/nested/?lang=en');
    assert.equal(host.querySelector('#api-playground-link').href, 'https://sidekick.test/nested/api-playground.html?lang=en');
    cleanup(); assert.equal(host.childElementCount, 0);
  }
});

async function controllerFixture(t) {
  const html = await readFile(new URL('../api-playground.html', import.meta.url), 'utf8');
  const source = (await readFile(new URL('../playground/api-playground.js', import.meta.url), 'utf8')).replace(/^import[^\n]+\n/gm, '');
  const dom = new JSDOM(html, { url: 'https://sidekick.test/api-playground.html', runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const w = dom.window, $ = id => w.document.getElementById(id);
  Object.assign(w, { mountGuideExercise:async()=>false, apiText, applyApiLocale, apiError, getSiteLocale, subscribeSiteLocale: callback => { const cleanup = subscribeSiteLocale(callback); t.after(cleanup); return cleanup; }, structuredClone, codeForAction, executeAction, createAccessory, MATERIAL_SHAPE_LABELS: { heart: 'Heart', ghostish: 'Ghost' }, mountSiteHeader() {}, loadStudioSession: () => ({ message: 'Default scene', scene: { design: {}, trackingMode: 'eyes-and-body', bodyOrientation: { yaw: 0, pitch: 0, roll: 0 }, zoom: 1 } }), applyStudioSession: async () => {} });
  w.matchMedia = () => ({ matches: false, addEventListener() {} });
  class Avatar extends w.HTMLElement {
    ready = true; calls = []; point = { x: 0, y: 0 }; activity = 'idle'; trackingMode = 'eyes-and-body'; zoom = 1;
    get position() { return this.point; }
    get offsetWidth() { return 180; } get offsetHeight() { return 180; }
    movementState = { phase: 'idle', progress: 0, velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 } };
    moveTo(...args) { this.calls.push({ method: 'moveTo', args }); this.point = args[0]; return Promise.resolve({ finished: true }); }
    moveBy(...args) { this.calls.push({ method: 'moveBy', args }); this.point = { x: this.point.x + args[0].x, y: this.point.y + args[0].y }; return Promise.resolve({ finished: true }); }
  }
  for (const method of ['setEmotion', 'reactTo', 'cancelReaction', 'setExpression', 'setActivity', 'play', 'stop', 'setBodyOrientation', 'transitionTo', 'cancelMove', 'cancelTransition', 'enter', 'exit', 'detachAnchor', 'moveToElement']) Avatar.prototype[method] = function (...args) { this.calls.push({ method, args }); return Promise.resolve({ finished: true }); };
  w.customElements.define('sidekick-avatar', Avatar);
  w.eval(source); await new Promise(resolve => setImmediate(resolve)); const bot = $('bot'); bot.calls.length = 0;
  const input = (id, value) => { $(id).value = String(value); $(id).dispatchEvent(new w.Event('input', { bubbles: true })); };
  const pointer = (type, x, y, target = w.document.body, extra = {}) => { const event = new w.Event(type, { bubbles: true }); Object.assign(event, { clientX: x, clientY: y, isPrimary: true, pointerId: 1, button: 0, ...extra }); target.dispatchEvent(event); };
  return { w, $, bot, input, pointer };
}
const plain = value => JSON.parse(JSON.stringify(value));

test('controller updates code before execution and dispatches every selected action', async t => {
  const f = await controllerFixture(t);
  for (const [kind, values, method] of [
    ['movement', [['target-x', 400], ['target-y', 200], ['duration', 0]], 'moveTo'],
    ['anchor', [], 'detachAnchor'],
    ['activity', [['activity-operation', 'setActivity'], ['activity', 'thinking']], 'setActivity'],
    ['activity', [['activity-operation', 'play'], ['activity-duration', 700]], 'play'],
    ['activity', [['activity-operation', 'stop']], 'stop'],
    ['expression', [['eye-side', 'left'], ['expression', 'smile'], ['expression-duration', 0]], 'setExpression'],
    ['orientation', [['body-yaw', 15], ['body-pitch', -8], ['body-roll', 5], ['zoom', 1.5]], 'setBodyOrientation'],
    ['assets', [['shape', 'heart'], ['head-accessory', 'halo'], ['transition-duration', 0]], 'transitionTo'],
    ['presence', [['presence-operation', 'enter']], 'enter'],
    ['presence', [['presence-operation', 'exit']], 'exit'],
  ]) {
    const before = f.bot.calls.length; f.input('action-kind', kind);
    for (const [id, value] of values) f.input(id, value);
    assert.equal(f.bot.calls.length, before, 'editing does not execute');
    const generated = recorder();
    await new AsyncFunction('document', 'createAccessory', stripImports(f.$('invocation').textContent))({ querySelector: () => generated.avatar }, createAccessory);
    assert.equal(f.$('execute').disabled, false, kind); f.$('execute').click();
    assert.equal(f.bot.calls.at(-1).method, method);
    assert.deepEqual(plain(f.bot.calls.at(-1)), generated.calls.find(call => call.method));
  }
  assert.equal(f.bot.zoom, 1.5);
  f.input('action-kind', 'tracking'); f.input('tracking-mode', 'off'); f.$('execute').click(); assert.equal(f.bot.trackingMode, 'off');
  f.input('action-kind', 'movement'); f.input('duration', -1); assert.equal(f.$('execute').disabled, true);
  const before = f.bot.calls.length; f.$('execute').click(); assert.equal(f.bot.calls.length, before);
});

test('controller free-page gestures ignore controls, drags, selections, cancellation and secondary pointers', async t => {
  const f = await controllerFixture(t);
  f.pointer('pointerdown', 700, 500); f.pointer('pointerup', 700, 500);
  assert.deepEqual(plain(f.bot.calls.at(-1).args[0]), { x: 610, y: 410 });
  const count = f.bot.calls.length;
  f.pointer('pointerdown', 600, 450, f.$('target-x')); f.pointer('pointerup', 600, 450, f.$('target-x'));
  f.pointer('pointerdown', 700, 500); f.pointer('pointermove', 700, 550); f.pointer('pointerup', 700, 550);
  f.pointer('pointerdown', 700, 500); f.pointer('pointercancel', 700, 500); f.pointer('pointerup', 700, 500);
  f.pointer('pointerdown', 700, 500); f.pointer('pointerdown', 710, 500, f.w.document.body, { isPrimary: false, pointerId: 2 }); f.pointer('pointerup', 700, 500);
  const range = f.w.document.createRange(); range.selectNodeContents(f.$('invocation')); f.w.getSelection().addRange(range);
  f.pointer('pointerdown', 700, 500); f.pointer('pointerup', 700, 500);
  assert.equal(f.bot.calls.length, count);
  f.w.getSelection().removeAllRanges();
  f.pointer('pointerdown', 1, 1); f.pointer('pointerup', 1, 1);
  assert.deepEqual(plain(f.bot.calls.at(-1).args[0]), { x: 0, y: 0 });
});

test('controller copy follows format changes, and telemetry does not overwrite code', async t => {
  const f = await controllerFixture(t); let copied;
  Object.defineProperty(f.w.navigator, 'clipboard', { value: { writeText: async value => { copied = value; } } });
  f.input('action-kind', 'expression');
  f.$('code-format').value = 'react'; f.$('code-format').dispatchEvent(new f.w.Event('change'));
  f.$('copy').click(); await Promise.resolve(); assert.equal(copied, f.$('invocation').textContent); assert.match(copied, /SidekickAvatar/);
  const code = f.$('invocation').textContent;
  f.$('diagnostics').open = true;
  f.bot.dispatchEvent(new f.w.CustomEvent('sidekick-move-progress', { detail: { phase: 'braking', progress: .6, velocity: { x: -30, y: 40 }, acceleration: { x: 120, y: -160 }, speed: 50 } }));
  assert.equal(f.$('speed').textContent, '50 px/s'); assert.equal(f.$('acceleration-value').textContent, '200 px/s²');
  assert.equal(f.$('invocation').textContent, code);
  for (const id of ['speed-plot', 'acceleration-plot']) assert.doesNotMatch(f.$(id).getAttribute('points'), /NaN|Infinity/);
});

test('page movement and stop commands preserve every draft and keep execution code separate', async t => {
  const f = await controllerFixture(t);
  f.input('move-method', 'moveBy'); f.input('target-x', -37); f.input('target-y', 81);
  f.input('action-kind', 'expression'); f.input('expression', 'smile'); f.input('expression-duration', 720);
  const draft = f.$('invocation').textContent;
  const snapshot = () => [...f.w.document.querySelectorAll('#action-panel input,#action-panel select')].map(e => [e.id,e.value,e.checked]);
  const before = snapshot();
  f.pointer('pointerdown', 700, 500); f.pointer('pointerup', 700, 500);
  assert.deepEqual(snapshot(), before); assert.equal(f.$('invocation').textContent, draft);
  assert.equal(f.bot.calls.at(-1).method, 'moveTo');
  assert.match(f.$('last-invocation').textContent, /moveTo/);
  for (const id of ['cancel', 'cancel-preview', 'cancel-transition']) {
    f.$(id).click(); assert.deepEqual(snapshot(), before); assert.equal(f.$('invocation').textContent, draft);
    assert.match(f.$('last-invocation').textContent, new RegExp(id === 'cancel-transition' ? 'cancelTransition' : 'cancelMove'));
  }
  f.$('execute').click(); assert.equal(f.bot.calls.at(-1).method, 'setExpression');
  assert.equal(f.$('last-invocation').textContent, draft);
  f.input('action-kind', 'movement'); assert.equal(f.$('move-method').value, 'moveBy'); assert.equal(f.$('target-x').value, '-37');
  f.input('action-kind', 'expression'); assert.equal(f.$('expression-duration').value, '720');
});

test('shadow controls are excluded and invalid background movement has a visible error without losing the draft', async t => {
  const f = await controllerFixture(t);
  const host = f.w.document.createElement('div'); f.w.document.body.append(host);
  const shadow = host.attachShadow({ mode: 'open' }); shadow.innerHTML = '<button>Control</button>';
  for (const type of ['pointerdown','pointerup']) {
    const event = new f.w.Event(type, { bubbles: true, composed: true });
    Object.assign(event, { clientX: 700, clientY: 500, isPrimary: true, pointerId: 1, button: 0 });
    shadow.querySelector('button').dispatchEvent(event);
  }
  assert.equal(f.bot.calls.length, 0);
  f.input('duration', -1); f.input('action-kind', 'activity');
  const draft = f.$('invocation').textContent;
  f.pointer('pointerdown', 700, 500); f.pointer('pointerup', 700, 500);
  assert.equal(f.bot.calls.length, 0); assert.equal(f.$('invocation').textContent, draft);
  assert.match(f.$('status').textContent, /유효한 범위/);
});

for (const anchor of [false, true]) {
  test(`element anchor ${anchor}: JavaScript and React copied calls exactly match execution`, async t => {
    const f = await controllerFixture(t);
    f.input('move-method', 'moveToElement'); f.input('target-selector', '#action-panel');
    f.input('align-x', 'right'); f.input('align-y', 'bottom');
    f.input('target-x', -17); f.input('target-y', 23);
    f.$('element-anchor').checked = anchor;
    f.$('element-anchor').dispatchEvent(new f.w.Event('input', { bubbles: true }));
    const target = f.$('action-panel');
    const originalCode = f.$('invocation').textContent;
    assert.match(originalCode, new RegExp(`anchor: ${anchor}`));
    f.$('execute').click();
    const direct = f.bot.calls.at(-1);
    assert.equal(direct.method, 'moveToElement'); assert.equal(direct.args[0], target);
    assert.deepEqual(plain(direct.args[1]), { x: -17, y: 23, alignX: 'right', alignY: 'bottom', anchor, duration: 1200, travel: 'natural', acceleration: 1800, deceleration: 2200 });
    for (const format of ['javascript', 'react']) {
      f.$('code-format').value = format; f.$('code-format').dispatchEvent(new f.w.Event('change'));
      const displayed = f.$('invocation').textContent;
      const copied = recorder();
      const document = { querySelector: selector => selector === '#bot' ? copied.avatar : f.w.document.querySelector(selector) };
      const source = format === 'react' ? displayed.match(/async function run\(\) \{([\s\S]*?)\n  \}/)[1] : stripImports(displayed);
      await new AsyncFunction('document', 'ref', source)(document, { current: copied.avatar });
      assert.equal(copied.calls[0].args[0], target);
      assert.deepEqual(copied.calls[0].args[1], plain(direct.args[1]));
      if (format === 'react') assert.match(displayed, /design=\{scene.design\}/, 'Studio scene remains in setup');
    }
    assert.equal(f.$('element-anchor').checked, anchor);
  });
}

test('anchor defaults to one-time and detach button leaves draft, options and selected task untouched', async t => {
  const f = await controllerFixture(t);
  assert.equal(f.$('element-anchor').checked, false);
  f.input('move-method', 'moveToElement');
  f.$('element-anchor').checked = true; f.$('element-anchor').dispatchEvent(new f.w.Event('input', { bubbles: true }));
  const snapshot = () => [...f.w.document.querySelectorAll('#action-panel input,#action-panel select')].map(e => [e.id,e.value,e.checked]);
  const before = snapshot(), draft = f.$('invocation').textContent;
  f.$('detach-anchor').click();
  assert.equal(f.bot.calls.at(-1).method, 'detachAnchor');
  assert.deepEqual(snapshot(), before); assert.equal(f.$('invocation').textContent, draft);
  assert.match(f.$('last-invocation').textContent, /avatar.detachAnchor\(\);/);
  f.pointer('pointerdown', 700, 500); f.pointer('pointerup', 700, 500);
  assert.deepEqual(snapshot(), before); assert.equal(f.$('invocation').textContent, draft);
  f.input('action-kind', 'anchor'); assert.match(f.$('invocation').textContent, /avatar.detachAnchor\(\);/);
  f.$('execute').click(); assert.equal(f.bot.calls.at(-1).method, 'detachAnchor');
});

test('emotion draft executes exact generated calls and survives page click and operation changes', async t=>{
 const { $,bot,input,pointer }=await controllerFixture(t);
 input('action-kind','emotion');input('emotion-name','curious');input('emotion-intensity',0.4);
 $('execute').click();await new Promise(r=>setImmediate(r));
 assert.deepEqual(plain(bot.calls.at(-1)),{method:'setEmotion',args:['curious',{intensity:0.4}]});
 assert.match($('invocation').textContent,/setEmotion\('curious', \{ intensity: 0.4 \}\)/);
 input('emotion-operation','reactTo');input('emotion-name','surprised');input('emotion-duration',2300);
 const draft=$('invocation').textContent;pointer('pointerdown',760,430);pointer('pointerup',760,430);
 assert.equal($('action-kind').value,'emotion');assert.equal($('invocation').textContent,draft);
 $('execute').click();await new Promise(r=>setImmediate(r));
 assert.deepEqual(plain(bot.calls.at(-1)),{method:'reactTo',args:['surprised',{intensity:0.4,duration:2300}]});
 assert.match(draft,/await avatar.reactTo/);
 input('emotion-operation','cancelReaction');$('execute').click();
 assert.equal(bot.calls.at(-1).method,'cancelReaction');
});
