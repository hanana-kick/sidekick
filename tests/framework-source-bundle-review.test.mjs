import test from 'node:test';
import assert from 'node:assert/strict';
import { build, transform } from 'esbuild';
import { JSDOM } from 'jsdom';

// Published Guide pages run the production-minified module. Functions emitted
// using toString() can no longer rely on their original declaration names.
async function minifiedModule(path) {
 const bundled = await build({
  entryPoints: [new URL(path, import.meta.url).pathname],
  bundle: true, write: false, format: 'esm', platform: 'browser', minify: true,
 });
 return import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
}
const generator = await minifiedModule('../playground/guide-framework-code.js');
const workflows = await minifiedModule('../playground/application-workflows.js');

for (const workflow of [false, true]) test(`production-minified element source runs its ${workflow ? 'automatic workflow' : 'layout helper'}`, async () => {
 const markup = '<div class="app-card"><div id="loading-indicator">Loading</div><button id="app-complete">Complete</button></div>';
 const dom = new JSDOM(`<div id="demo-app">${markup}<sidekick-avatar id="demo-bot"></sidekick-avatar></div>`, { runScripts: 'outside-only' });
 const w = dom.window;
 globalThis.document = w.document;
 try {
  const body = "bot.behavior = { type:'wait', target:'#loading-indicator', side:'left', gap:6 };\n"
   + (workflow ? workflows.workflowSource('loading', { '데이터 준비 완료': 'Data ready' }) : '')
   + '\nwindow.exampleStarts++;';
  const source = generator.scenarioCode(body, markup);
  const sourceDom = new JSDOM(source);
  const script = sourceDom.window.document.querySelector('script').textContent;
  sourceDom.window.close();
  const bot = w.document.querySelector('#demo-bot');
  bot.ready = true;
  for (const method of ['stopBehavior', 'cancelMove', 'cancelReaction', 'detachAnchor']) bot[method] = () => {};
  w.exampleStarts = 0;
  bot.setEmotion = emotion => { bot.emotion = emotion; };
  const timers = new Map(), errors = []; let nextTimer = 0;
  w.setTimeout = (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback: () => { timers.delete(id); callback(); }, delay }); return id; };
  w.clearTimeout = id => timers.delete(id);
  w.console.error = error => errors.push(error.message);
  w.eval(script.replace(/^import .*;\n/gm, ''));
  await Promise.resolve();
  assert.deepEqual(errors, []);
  assert.equal(w.exampleStarts, 1);
  assert.equal(bot.behavior.type, 'wait');
  bot.dispatchEvent(new w.Event('sidekick-behavior-change'));
  assert.equal(bot.parentElement.dataset.side, 'left');
  assert.equal(bot.parentElement.style.getPropertyValue('--behavior-gap'), '6px');
  if (workflow) {
   assert.equal(timers.size, 1);
   const timer = [...timers.values()][0];
   assert.equal(timer.delay, 1800); timer.callback();
   assert.equal(w.document.querySelector('#loading-indicator').dataset.outcome, 'success');
   assert.equal(w.document.querySelector('#loading-indicator').textContent, 'Data ready');
   assert.equal(bot.behavior.type, 'celebrate');
   assert.equal(bot.emotion, 'happy');
   assert.equal(timers.size, 0);
  }
  w.dispatchEvent(new w.Event('pagehide'));
  bot.behavior = { type:'wait', target:'#loading-indicator', side:'right', gap:28 };
  bot.dispatchEvent(new w.Event('sidekick-behavior-change'));
  assert.equal(bot.parentElement.dataset.side, 'left', 'layout listener is removed on disposal');
  if (workflow) {
   w.document.querySelector('#loading-indicator').dataset.outcome = 'pending';
   w.document.querySelector('#app-complete').disabled = false;
   w.document.querySelector('#app-complete').click();
   assert.equal(w.document.querySelector('#loading-indicator').dataset.outcome, 'pending', 'workflow event listeners are removed on disposal');
   assert.equal(timers.size, 0);
  }
 } finally {
  w.dispatchEvent(new w.Event('pagehide'));
  w.close();
  delete globalThis.document;
 }
});


for (const finish of [false, true]) test(`production-minified React source waits for an asynchronously forwarded ref and ${finish ? 'completes' : 'cancels'} its workflow`, async () => {
 const dom = new JSDOM('<div id="root"></div>', { url: 'https://sidekick.test/', runScripts: 'outside-only' });
 const w = dom.window;
 const globals = ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'CustomEvent', 'Event', 'MutationObserver', 'IS_REACT_ACT_ENVIRONMENT'];
 const previous = new Map(globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
 for (const key of globals) Object.defineProperty(globalThis, key, { value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : w[key], configurable: true, writable: true });
 let root, mounted = false;
 try {
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { SidekickAvatar } = await import('../dist/library/react.js');
  class DelayedAvatar extends w.HTMLElement {
   ready = false;
   behavior = null;
   stopped = 0;
   setEmotion(emotion) { this.emotion = emotion; }
   stopBehavior() { this.stopped++; }
   cancelMove() {}
   cancelReaction() {}
   detachAnchor() {}
  }
  w.customElements.define('sidekick-avatar', DelayedAvatar);
  const timers = new Map(), errors = []; let nextTimer = 0;
  w.setTimeout = (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback: () => { timers.delete(id); callback(); }, delay }); return id; };
  w.clearTimeout = id => timers.delete(id);
  w.console.error = error => errors.push(error.message ?? String(error));
  Object.assign(w, { ...React, SidekickAvatar, exampleStarts: 0 });
  const markup = '<div class="app-card"><div id="loading-indicator">Loading</div><button id="app-complete">Complete</button></div>';
  const body = "bot.behavior = { type:'wait', target:'#loading-indicator', side:'left', gap:6 };\n"
   + workflows.workflowSource('loading', { '데이터 준비 완료': 'Data ready' }) + '\nwindow.exampleStarts++;';
  const source = generator.reactExample(body, markup);
  const { code } = await transform(source, { loader: 'jsx', format: 'esm', jsxFactory: 'createElement' });
  w.eval(code.replace(/^import .*;\n/gm, '').replace(/export\s*\{[\s\S]*?\};?\s*$/, '') + '\nwindow.GeneratedExample = Example;');
  root = createRoot(w.document.querySelector('#root'));
  await React.act(async () => { root.render(React.createElement(w.GeneratedExample)); }); mounted = true;
  const bot = w.document.querySelector('#demo-bot'), app = bot.parentElement;
  const indicator = w.document.querySelector('#loading-indicator'), button = w.document.querySelector('#app-complete');
  assert.equal(w.exampleStarts, 0, 'the first parent effect runs before the native API/ref is available');
  assert.equal(timers.size, 0);
  // The real wrapper publishes its ref only once it sees the upgraded API.
  await React.act(async () => {
   bot.setDesign = () => {};
   bot.ready = true;
   bot.dispatchEvent(new w.CustomEvent('sidekick-ready', { detail: {} }));
  });
  assert.deepEqual(errors, []);
  assert.equal(w.exampleStarts, 1, 'late ref publication starts the copied example');
  assert.equal(bot.behavior.type, 'wait');
  assert.equal(timers.size, 1);
  await React.act(async () => { bot.dispatchEvent(new w.CustomEvent('sidekick-ready', { detail: {} })); });
  assert.equal(w.exampleStarts, 1, 'repeated readiness does not duplicate the workflow');
  assert.equal(timers.size, 1);
  if (finish) {
   const timer = [...timers.values()][0]; assert.equal(timer.delay, 1800);
   await React.act(async () => { timer.callback(); });
   assert.equal(indicator.dataset.outcome, 'success');
   assert.equal(indicator.textContent, 'Data ready');
   assert.equal(bot.behavior.type, 'celebrate');
   assert.equal(bot.emotion, 'happy');
   assert.equal(timers.size, 0);
  }
  await React.act(async () => { root.unmount(); }); mounted = false;
  assert.equal(timers.size, 0, 'unmount cancels any pending automatic completion');
  assert.equal(bot.stopped, 1);
  bot.behavior = { type:'wait', target:'#loading-indicator', side:'right', gap:28 };
  bot.dispatchEvent(new w.Event('sidekick-behavior-change'));
  assert.equal(app.dataset.side, 'left', 'layout listener is removed on unmount');
  indicator.dataset.outcome = 'pending'; button.disabled = false; button.click();
  assert.equal(indicator.dataset.outcome, 'pending', 'workflow event listeners are removed on unmount');
  bot.dispatchEvent(new w.CustomEvent('sidekick-ready', { detail: {} }));
  assert.equal(w.exampleStarts, 1);
  assert.deepEqual(errors, []);
 } finally {
  if (mounted) { const { act } = await import('react'); await act(async () => root.unmount()); }
  w.close();
  for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
 }
});
