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

for (const framework of ['element', 'react']) for (const workflow of [false, true]) test(`production-minified ${framework} source runs its ${workflow ? 'automatic workflow' : 'layout helper'}`, async () => {
 const markup = '<div class="app-card"><div id="loading-indicator">Loading</div><button id="app-complete">Complete</button></div>';
 const dom = new JSDOM(`<div id="demo-app">${markup}<sidekick-avatar id="demo-bot"></sidekick-avatar></div>`, { runScripts: 'outside-only' });
 const w = dom.window;
 globalThis.document = w.document;
 let cleanup;
 try {
  const body = "bot.behavior = { type:'wait', target:'#loading-indicator', side:'left', gap:6 };\n"
   + (workflow ? workflows.workflowSource('loading', { '데이터 준비 완료': 'Data ready' }) : '')
   + '\nwindow.exampleStarts++;';
  const source = framework === 'element'
   ? generator.scenarioCode(body, markup)
   : generator.reactExample(body, markup);
  let script;
  if (framework === 'element') {
   const sourceDom = new JSDOM(source);
   script = sourceDom.window.document.querySelector('script').textContent;
   sourceDom.window.close();
  } else {
   ({ code: script } = await transform(source, { loader: 'jsx', format: 'esm', jsxFactory: 'createElement' }));
  }
  const bot = w.document.querySelector('#demo-bot');
  bot.ready = true;
  for (const method of ['stopBehavior', 'cancelMove', 'cancelReaction', 'detachAnchor']) bot[method] = () => {};
  w.exampleStarts = 0;
  bot.setEmotion = emotion => { bot.emotion = emotion; };
  const timers = new Map(), errors = []; let nextTimer = 0;
  w.setTimeout = (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback: () => { timers.delete(id); callback(); }, delay }); return id; };
  w.clearTimeout = id => timers.delete(id);
  w.console.error = error => errors.push(error.message);
  if (framework === 'react') {
   const refs = [bot, bot.parentElement];
   Object.assign(w, {
    useRef: () => ({ current: refs.shift() }),
    useEffect: callback => { cleanup = callback(); },
    createElement: () => null,
    SidekickAvatar: () => null,
   });
   script = script.replace(/export\s*\{[\s\S]*?\};?\s*$/, '') + '\nExample();';
  }
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
  cleanup?.(); cleanup = undefined;
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
  cleanup?.();
  w.dispatchEvent(new w.Event('pagehide'));
  w.close();
  delete globalThis.document;
 }
});
