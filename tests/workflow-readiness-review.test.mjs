import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import * as workflows from '../playground/application-workflows.js';
import * as framework from '../playground/site-framework.js';
import * as frameworkCode from '../playground/guide-framework-code.js';
import * as navigation from '../playground/guide-navigation.js';
import * as emotions from '../playground/emotion-scenarios.js';
import * as catalog from '../playground/scenario-catalog.js';
import * as lessons from '../playground/guide-lessons.js';
import { createScene } from '../src/core/scene.ts';
import { guideTranslations } from '../playground/guide-translations.js';

const html=readFileSync(new URL('../guide.html',import.meta.url),'utf8');
const script=readFileSync(new URL('../playground/use-cases.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};

// Delay readiness and scene setup independently to expose lifecycle races that
// a normally fast renderer hides. Execute the actual guide controller.
function mount({exercise=false,context={id:'loading',level:1},applyStudioSession=async()=>{}}={}){
 const dom=new JSDOM(html,{url:new URL(navigation.guideHref(context,'en',exercise),'https://example.com/').href,runScripts:'outside-only'});
 const w=dom.window,$=id=>w.document.getElementById(id);
 if(exercise)w.document.documentElement.dataset.guideExercise='true';
 Object.assign(w,workflows,framework,frameworkCode,navigation,emotions,catalog,lessons,{
  guideTranslations,structuredClone,ResizeObserver:class{observe(){}},
  getSiteLocale:()=> 'en',subscribeSiteLocale:()=>()=>{},
  loadStudioSession:()=>({scene:createScene(),message:'mock'}),
  seedStudioSession:()=>{},applyStudioSession,mountSiteHeader:()=>{},
  scrollTo:()=>{},setTimeout,clearTimeout,
 });
 class Bot extends w.HTMLElement{
  calls=[];
  set behavior(value){this.value=value;this.calls.push(['behavior',value]);}
  get behavior(){return this.value;}
  stopBehavior(){this.calls.push(['stopBehavior']);}
  cancelReaction(){}
  setEmotion(value){this.calls.push(['setEmotion',value]);}
  moveToElement(){return Promise.resolve({finished:true});}
  lookAt(){}
  setExpression(){return Promise.resolve();}
 }
 w.customElements.define('sidekick-avatar',Bot);w.eval(script);
 return {w,$,async ready(bot=$('demo-bot')){bot.ready=true;bot.dispatchEvent(new w.CustomEvent('sidekick-ready'));await flush();},close(){w.dispatchEvent(new w.Event('pagehide'));w.close();}};
}

for(const exercise of [false,true])test(`Stop before readiness stays stopped in ${exercise?'exercise':'guide'} mode`,async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const page=mount({exercise});
 try{
  const bot=page.$('demo-bot');
  if(exercise)page.$('restart-demo').click();
  page.$('stop-demo').click();await page.ready(bot);t.mock.timers.tick(5000);
  assert.equal(bot.calls.filter(([method])=>method==='behavior').length,0);
  assert.equal(page.$('loading-indicator').dataset.outcome,undefined);
  assert.match(page.$('run-status').textContent,/Stopped/);
  page.$('restart-demo').click();await page.ready();t.mock.timers.tick(1800);
  assert.equal(page.$('loading-indicator').dataset.outcome,'success','an explicit later Run starts a fresh workload');
 }finally{page.close();}
});

test('returning from manual composition resumes the workload and restores its rail',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const page=mount({context:{id:'loading',level:2,side:'right',gap:28}});
 try{
  await page.ready();page.$('run-manual').click();await flush();t.mock.timers.tick(2000);
  assert.equal(page.$('loading-indicator').dataset.outcome,undefined);
  page.$('return-declaration').click();
  assert.equal(page.$('demo-app').dataset.side,'right');
  assert.equal(page.$('demo-app').style.getPropertyValue('--behavior-gap'),'28px');
  t.mock.timers.tick(1800);assert.equal(page.$('loading-indicator').dataset.outcome,'success');
 }finally{page.close();}
});

async function executeCopiedExample(source){
 const dom=new JSDOM(source,{runScripts:'outside-only'}),w=dom.window,bot=w.document.querySelector('#demo-bot');
 Object.assign(w,{setTimeout,clearTimeout});
 bot.ready=true;bot.motion={to:async()=>{}};
 for(const method of ['setBodyOrientation','lookAt','seek','setActivity','stopBehavior','cancelMove','cancelReaction','detachAnchor','setEmotion'])bot[method]=()=>{};
 w.eval(w.document.querySelector('script').textContent.replace(/^import .*;\n/gm,''));await flush();
 return {w,bot,close(){w.dispatchEvent(new w.Event('pagehide'));w.close();}};
}

test('copied successful validation replays a valid example without copying private form data',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const page=mount({context:{id:'validation',level:1}});let copy;
 try{
  await page.ready();page.$('profile-email').value='private.user@example.org';page.$('app-validate').click();
  const source=page.$('declaration-code').textContent;assert.doesNotMatch(source,/private\.user/);
  copy=await executeCopiedExample(source);
  assert.equal(copy.w.document.querySelector('#profile-email').value,'example@example.com');
  assert.equal(copy.w.document.querySelector('#validation-result').dataset.outcome,'success');
  assert.equal(copy.bot.behavior.type,'celebrate');
 }finally{copy?.close();page.close();}
});

test('copied pending retry preserves restored side and gap while completing automatically',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const page=mount({exercise:true,context:{id:'failure',level:2,side:'right',gap:28,events:['app-retry']}});let copy;
 try{
  await page.ready();copy=await executeCopiedExample(page.$('declaration-code').textContent);
  assert.equal(copy.bot.behavior.side,'right');assert.equal(copy.bot.behavior.gap,28);
  assert.equal(copy.w.document.querySelector('#request-result').dataset.outcome,'pending');
  t.mock.timers.tick(1400);
  assert.equal(copy.w.document.querySelector('#request-result').dataset.outcome,'success');
  assert.equal(copy.bot.behavior.type,'celebrate');
 }finally{copy?.close();page.close();}
});

test('Stop during asynchronous scene setup survives setup completion',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let finishSetup;
 const page=mount({applyStudioSession:()=>new Promise(resolve=>{finishSetup=resolve;})});
 try{
  await page.ready();assert.equal(typeof finishSetup,'function');
  page.$('stop-demo').click();finishSetup();await flush();t.mock.timers.tick(5000);
  assert.equal(page.$('demo-bot').calls.filter(([method])=>method==='behavior').length,0);
  assert.equal(page.$('loading-indicator').dataset.outcome,undefined);
 }finally{page.close();}
});

test('Stop before renderer failure suppresses the fallback workload',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const page=mount();
 try{
  page.$('stop-demo').click();
  page.$('demo-bot').dispatchEvent(new page.w.CustomEvent('sidekick-error',{detail:{recoverable:false}}));
  await flush();t.mock.timers.tick(5000);
  assert.equal(page.$('loading-indicator').dataset.outcome,undefined);
 }finally{page.close();}
});

test('navigation during scene setup cannot restart the replaced entry',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const pending=new Map();
 const page=mount({applyStudioSession:bot=>new Promise(resolve=>pending.set(bot,resolve))});
 try{
  const old=page.$('demo-bot');await page.ready(old);
  page.w.history.replaceState({},'','#upload');page.w.dispatchEvent(new page.w.HashChangeEvent('hashchange'));
  const current=page.$('demo-bot');await page.ready(current);pending.get(current)();await flush();
  pending.get(old)();await flush();t.mock.timers.tick(700);
  assert.equal(old.calls.filter(([method])=>method==='behavior').length,0);
  assert.equal(page.$('demo-bot'),current);assert.equal(page.$('progress-label').dataset.progress,'25');
 }finally{page.close();}
});
