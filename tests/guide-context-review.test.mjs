import { recordGuideSetting } from '../playground/guide-setting-analytics.js';
import * as workflows from '../playground/application-workflows.js';
import * as framework from '../playground/site-framework.js';
import * as frameworkCode from '../playground/guide-framework-code.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import * as navigation from '../playground/guide-navigation.js';
import * as emotions from '../playground/emotion-scenarios.js';
import * as catalog from '../playground/scenario-catalog.js';
import * as lessons from '../playground/guide-lessons.js';
import * as stateSchema from '../playground/state-reference-schema.js';
import { stateCopy } from '../playground/state-reference-copy.js';
import { stateLessons } from '../playground/guide-state-lessons.js';
import { createScene } from '../src/core/scene.ts';
import { guideTranslations } from '../playground/guide-translations.js';

const html = readFileSync(new URL('../guide.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../playground/use-cases.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');
const tick = () => new Promise(resolve => setTimeout(resolve, 10));

test('field change events preserve typed guide context and the current scroll position', async () => {
 const page=await mount({id:'state-emotion',level:1});
 try {
  Object.defineProperty(page.w,'scrollY',{configurable:true,value:321});
  page.$('behavior-gap').value='28';
  page.$('behavior-gap').dispatchEvent(new page.w.Event('change',{bubbles:true}));
  const context=navigation.readGuideContext(page.w.location.href);
  assert.equal(context.id,'state-emotion');
  assert.equal(context.level,1);
  assert.equal(context.gap,28);
  assert.equal(context.scroll,321);
  const destination=navigation.readGuideSource(page.$('context-playground-link').href);
  assert.equal(destination.id,'state-emotion');
  assert.equal(destination.gap,28);
  assert.equal(destination.scroll,321);
 } finally { page.close(); }
});

// Exercise the real Guide controller with a recording renderer. Browser integration
// separately verifies template mounting, WebGL, layout, and real browser history.
async function mount(context, { exercise = false, source = null, hash, locale = 'en' } = {}) {
  const url = new URL(navigation.guideHref(context, locale, exercise, source), 'https://example.com/nested/');
  if (hash !== undefined) url.hash = hash;
  const dom = new JSDOM(html, { url: url.href, runScripts: 'outside-only' });
  const w = dom.window;
  const $ = id => w.document.getElementById(id);
  if (exercise) {
    w.document.documentElement.dataset.guideExercise = 'true';
    const back = w.document.createElement('a');
    back.id = 'guide-source-return';
    w.document.body.prepend(back);
  }
  w.structuredClone=structuredClone;
  w.IntersectionObserver=class { observe() {} disconnect() {} };
  w.ResizeObserver = class { observe() {} };
  w.scrollTo = () => {};
  Object.assign(w, {recordGuideSetting}, workflows, stateSchema, {stateCopy,stateLessons}, navigation, emotions, catalog, lessons, framework, frameworkCode, {
    guideTranslations,
    getSiteLocale: () => locale, subscribeSiteLocale: () => () => {},
    loadStudioSession: () => ({ scene: createScene(), message: 'mock' }),
    seedStudioSession:()=>{}, applyStudioSession: async () => {}, mountSiteHeader: () => {},
  });
  w.mountStateReference=w.eval('(function(){'+readFileSync(new URL('../playground/state-reference.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/export /g,'')+';return mountStateReference;})()');
  class Bot extends w.HTMLElement {
    calls = [];
    connectedCallback() { queueMicrotask(() => { this.ready = true; this.dispatchEvent(new w.CustomEvent('sidekick-ready')); }); }
    set behavior(value) { this.value = value; this.calls.push(['behavior', value]); }
    get behavior() { return this.value; }
    stopBehavior() { this.calls.push(['stopBehavior']); }
    cancelReaction() {}
    setActivity(...args) { this.calls.push(['setActivity', ...args]); }
    setEmotion(...args) { this.calls.push(['setEmotion', ...args]); }
    reactTo(...args) { this.calls.push(['reactTo', ...args]); return Promise.resolve(); }
    setExpression(...args) { this.calls.push(['setExpression', ...args]); return Promise.resolve(); }
    moveToElement(...args) { this.calls.push(['moveToElement', ...args]); return Promise.resolve({ finished: true }); }
    lookAt(...args) { this.calls.push(['lookAt', ...args]); }
  }
  w.customElements.define('sidekick-avatar', Bot);
  w.eval(script);
  await tick();
  return { w, $, close() { w.dispatchEvent(new w.Event('pagehide')); w.close(); } };
}

for (const item of catalog.scenarios) {
  test(`independent context roundtrip preserves ${item.id} code without executing on arrival`, async () => {
    const source = await mount({ id: item.id, level: 2 });
    let destination;
    try {
      [...source.w.document.querySelectorAll('#demo-app button')].at(-1)?.click();
      const expected = source.$('declaration-code').textContent;
      const context = navigation.readGuideContext(source.$('context-playground-link').href);
      destination = await mount(context, { exercise: true });
      assert.equal(destination.$('declaration-code').textContent, expected);
      assert.deepEqual(destination.$('demo-bot').calls, []);
      assert.equal(destination.w.document.querySelectorAll('#demo-bot').length, 1);
    } finally { destination?.close(); source.close(); }
  });
}

test('level four primary Run executes the displayed manual sequence', async () => {
  const page = await mount({ id: 'loading', level: 4 }, { exercise: true });
  try {
    assert.match(page.$('declaration-code').textContent, /await bot\.moveToElement/);
    page.$('restart-demo').click(); await tick();
    const methods = page.$('demo-bot').calls.map(call => call[0]);
    assert.deepEqual(methods, ['stopBehavior', 'moveToElement', 'lookAt', 'setExpression']);
  } finally { page.close(); }
});

test('applied emotion survives a later unexecuted control edit', async () => {
  const source = await mount({ id: 'emotion-request', level: 2 });
  let destination;
  try {
    source.$('guide-emotion-intensity').value = '0.2';
    source.w.document.querySelector('[data-emotion-step="0"]').click();
    const expected = source.$('declaration-code').textContent;
    assert.match(expected, /intensity: 0\.2/);
    source.$('guide-emotion-intensity').value = '0.9';
    source.$('guide-emotion-intensity').dispatchEvent(new source.w.Event('change'));
    destination = await mount(navigation.readGuideContext(source.$('context-playground-link').href), { exercise: true });
    assert.equal(destination.$('declaration-code').textContent, expected);
    assert.deepEqual(destination.$('demo-bot').calls, []);
  } finally { destination?.close(); source.close(); }
});

test('applied geometry survives restoring an app selection event', async () => {
  const page = await mount({ id: 'onboarding', level: 2, side: 'right', gap: 28, events: ['app-next'] }, { exercise: true });
  try {
    const code = page.$('declaration-code').textContent;
    assert.match(code, /"target": "#onboard-2"/);
    assert.match(code, /"side": "right"/);
    assert.match(code, /"gap": 28/);
    assert.equal(page.$('behavior-side').value, 'right');
  } finally { page.close(); }
});

test('source identity and scroll remain same-origin through destination edits and reload', async () => {
  const origin = { id: 'react-start', level: 1, scroll: 640 };
  const context = { id: 'loading', level: 3 };
  let page = await mount(context, { exercise: true, source: origin });
  try {
    page.$('restart-demo').click();
    await new Promise(resolve=>setTimeout(resolve,1900));
    const back = new URL(page.$('guide-source-return').href);
    assert.equal(back.origin, 'https://example.com');
    assert.equal(back.pathname, '/nested/guide.html');
    assert.equal(back.searchParams.get('lang'), 'en');
    assert.equal(back.hash, '#react-start');
    assert.deepEqual(navigation.readGuideContext(back.href), origin);
    const reloadContext = navigation.readGuideContext(page.w.location.href);
    const reloadSource = navigation.readGuideSource(page.w.location.href);
    page.close();
    page = await mount(reloadContext, { exercise: true, source: reloadSource });
    assert.deepEqual(navigation.readGuideContext(page.$('guide-source-return').href), origin);
  } finally { page.close(); }
});

test('unknown hash is recoverable and reports an invalid link', async () => {
  const page = await mount({ id: 'loading', level: 1 }, { hash: 'unknown-section' });
  try {
    assert.ok(page.$('invalid-guide-context'));
    assert.ok(page.$('demo-bot'));
    assert.equal(page.$('demo-bot').dataset.scenario, 'loading');
  } finally { page.close(); }
});

test('persisted pageshow restores the bot after pagehide cleanup', async () => {
  const page = await mount({ id: 'loading', level: 2 }, { exercise: true });
  try {
    page.w.dispatchEvent(new page.w.PageTransitionEvent('pagehide', { persisted: true }));
    page.w.dispatchEvent(new page.w.PageTransitionEvent('pageshow', { persisted: true }));
    await tick();
    assert.equal(page.w.document.querySelectorAll('#demo-bot').length, 1);
    assert.ok(page.$('demo-bot').hasAttribute('data-configured'));
    assert.deepEqual(page.$('demo-bot').calls, []);
  } finally { page.close(); }
});

test('scroll persistence cannot overwrite a pending route and popstate restores its settings', async () => {
  const page = await mount({ id: 'loading', level: 1 });
  try {
    const target = { id: 'review', level: 2, side: 'right', gap: 28 };
    page.w.history.replaceState({}, '', navigation.guideHref(target, 'en'));
    page.w.dispatchEvent(new page.w.Event('scroll'));
    assert.equal(page.w.location.hash, '#review');
    assert.equal(navigation.readGuideContext(page.w.location.href).id, 'review');
    page.w.dispatchEvent(new page.w.PopStateEvent('popstate'));
    await tick();
    assert.equal(page.$('demo-bot').dataset.scenario, 'review');
    assert.equal(page.$('behavior-side').value, 'right');
    assert.equal(page.$('behavior-gap').value, '28');
    assert.equal(page.w.document.querySelector('[data-level="2"]').getAttribute('aria-pressed'), 'true');
    const bot = page.$('demo-bot');
    page.w.dispatchEvent(new page.w.HashChangeEvent('hashchange'));
    await tick();
    assert.equal(page.$('demo-bot'), bot, 'Following hashchange must not restart the same route');
  } finally { page.close(); }
});

for(const lesson of lessons.lessons.filter(item=>item.id.startsWith('state-')))test(`state reference ${lesson.id} renders fields before examples and preserves links`,async()=>{
 const page=await mount({id:lesson.id,level:1});try{
  assert.deepEqual([...page.w.document.querySelectorAll('#scenario-toc > details > summary')].map(x=>x.textContent),['Bot state','Usage examples','Direct control']);
  assert.deepEqual([...page.w.document.querySelectorAll('#scenario-toc [data-scenario]')].slice(0,3).map(x=>x.dataset.scenario),['state-emotion','state-position','state-behavior']);
  assert.equal(page.$('lesson-content').querySelectorAll('tbody tr').length,stateSchema.STATE_FIELDS[lesson.id].length);
  assert.equal(page.$('lesson-content').querySelectorAll('pre').length,1);
  const target=page.$('lesson-content').querySelector('[data-lesson-destination]');assert.ok(target.textContent.trim(),`${lesson.id} destination has visible text`);assert.equal(navigation.readGuideSource(target.href).id,lesson.id);
  if(lesson.id==='state-lifecycle')assert.equal(new URL(target.href).searchParams.get('lesson'),'declarative-lifecycle');
  else assert.ok(catalog.scenarios.some(item=>'#'+item.id===new URL(target.href).hash));
  assert.equal(page.$('demo-bot'),null);
 }finally{page.close();}
});
test('all state reference prose is translated and declaration attribute keys are supported',()=>{
 const attributeSource=readFileSync(new URL('../src/element/attributes.ts',import.meta.url),'utf8');
 for(const lesson of lessons.lessons.filter(item=>item.id.startsWith('state-'))){
  for(const locale of ['ko','en','zh-CN','ja'])for(const key of [lesson.major,lesson.middle,lesson.title,lesson.sentence,lesson.hint,...lesson.paragraphs,...lesson.parameters.map(row=>row[3])])assert.ok(guideTranslations[locale][key],`${locale}: ${key}`);
  for(const row of lesson.parameters){const keys=row[0].split(' / ')[0].split(', ');for(const key of keys){if(['type','targets','duration','dwell','timeout'].includes(key)||key.startsWith('behavior.'))continue;assert.ok(attributeSource.includes("'"+key+"'")||attributeSource.includes(key+'?:'),key);}}
 }
});

test('entrance controls share one declaration with preview, selected source and URL context',async()=>{
 const page=await mount({id:'state-entrance',level:1});
 try{
  const {w}=page,query=selector=>w.document.querySelector(selector),frame=query('.state-lab iframe'),messages=[];
  frame.contentWindow.postMessage=value=>messages.push(value);
  w.dispatchEvent(new w.MessageEvent('message',{source:frame.contentWindow,origin:w.location.origin,data:{type:'state-reference-mounted'}}));
  const change=(key,value)=>{const control=query(`[data-entrance-control="${key}"]`);control.value=value;control.dispatchEvent(new w.Event('change',{bubbles:true}));};
  const values=()=>messages.filter(message=>message.type==='state-reference-config').at(-1).values;
  assert.deepEqual(JSON.parse(JSON.stringify(values().entrance)),{source:'element',target:'#reference-target',direction:'right',at:0.5,gap:16});
  assert.equal(query('[data-state-enable="entrance"]').checked,true);
  change('source','viewport');change('side','bottom');change('at','0.3');change('distance','12');
  const expected={source:'viewport',edge:'bottom',at:0.3,inset:12};
  assert.deepEqual(JSON.parse(JSON.stringify(values().entrance)),expected);
  const source=query('[data-state-source]').textContent,example=new JSDOM(source);
  assert.equal(example.window.document.querySelector('sidekick-avatar').getAttribute('placement'),'viewport');
  assert.deepEqual(JSON.parse(example.window.document.querySelector('sidekick-avatar').getAttribute('entrance')),expected);
  example.window.close();
  assert.deepEqual(JSON.parse(new URL(w.location.href).searchParams.get('state')).values.entrance,expected);
  change('at','2');assert.equal(query('[data-state-source]').textContent,source,'invalid numeric control cannot change accepted source');
  change('source','element');change('side','top');change('at','0.75');change('distance','8');
  assert.deepEqual(JSON.parse(JSON.stringify(values().entrance)),{source:'element',target:'#reference-target',direction:'top',at:0.75,gap:8});
  const previous=query('[data-state-source]').textContent;
  query('[data-state-control="entrance"]').value='{"source":"viewport","edge":"left","at":2}';query('[data-state-field="entrance"] button').click();
  assert.equal(query('[data-state-source]').textContent,previous);assert.equal(query('.state-lab-status').getAttribute('role'),'alert');
  change('source','null');assert.equal(values().entrance,null);
  query('[data-state-text="reset"]').click();assert.deepEqual(Object.keys(values()),[]);assert.doesNotMatch(query('[data-state-source]').textContent,/entrance=/);
  change('source','viewport');assert.equal(values().entrance.source,'viewport');
  query('[data-state-text="run"]').click();assert.equal(messages.filter(message=>message.type==='state-reference-config').at(-1).restart,true);
 }finally{page.close();}
});


for(const locale of ['ko','en','zh-CN','ja'])test(`lifecycle destination has visible localized text and preserves its return context: ${locale}`,async()=>{
 const page=await mount({id:'state-lifecycle',level:1,scroll:640},{locale});try{
  const link=page.w.document.querySelector('[data-lesson-destination="state-lifecycle"]');
  assert.ok(link.textContent.trim(),'the contextual destination must render visible link text');
  assert.equal(link.textContent,navigation.navigationText[locale].lifecycle);
  assert.equal(link.hidden,false);assert.notEqual(page.w.getComputedStyle(link).display,'none');
  const target=new URL(link.href);
  assert.equal(target.searchParams.get('lang'),locale);
  assert.equal(target.searchParams.get('lesson'),'declarative-lifecycle');
  assert.equal(navigation.readGuideSource(target.href).id,'state-lifecycle');
 }finally{page.close();}
});
