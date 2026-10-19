import { installStateReferenceHarness } from './state-reference-harness.mjs';
import { createScene } from '../src/core/scene.ts';
import * as framework from '../playground/site-framework.js';
import * as frameworkCode from '../playground/guide-framework-code.js';
import { readGuideContext,readGuideSource, guideHref, technicalHref, lessonDestinations, navigationText,guideIds } from '../playground/guide-navigation.js';
import { emotionFlowById, emotionMarkup, emotionCode, runEmotionAction, customizeEmotionAction } from '../playground/emotion-scenarios.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { sectionDestination, dockInViewport, alignWithElement, connectTaskEvents } from '../playground/use-case-actions.js';
import { JSDOM } from 'jsdom';
import { mountSiteHeader } from '../playground/shared-header.js';
test('section target clamps to measured DOM size with a safe interior margin', () => {
  const bot = { offsetWidth: 128, offsetHeight: 128 }, section = { clientWidth: 500, clientHeight: 300 };
  assert.deepEqual(sectionDestination(bot, section, { x: -800, y: 800 }), { x: 20, y: 152 });
  assert.deepEqual(sectionDestination(bot, { clientWidth: 100, clientHeight: 100 }, { x: 50, y: 50 }), { x: 0, y: 0 });
});
test('element example forwards real target and alignment without rewriting coordinate frame', () => {
  const target = {}, options = { alignX: 'right', alignY: 'bottom', x: -10, y: 20 };
  const bot = { moveToElement: (a,b) => { assert.equal(a,target); assert.equal(b,options); return 123; } };
  assert.equal(alignWithElement(bot,target,options),123);
});
test('shared navigation includes Use cases and correct relative paths', () => {
  const dom = new JSDOM('<header></header>'); const host = dom.window.document.querySelector('header');
  mountSiteHeader(host,'guide','../');
  assert.deepEqual([...host.querySelectorAll('nav a')].map(a => a.getAttribute('href')), ['../?lang=ko&framework=element','../api-playground.html?lang=ko&framework=element','../guide.html?lang=ko&framework=element']);
  assert.equal(host.querySelector('[aria-current]').textContent,'가이드');
});
test('copyable event function cancels stale submit timer on another event and cleanup', async () => {
  const dom = new JSDOM('<div id="target"></div><form><input required value="test"><select><option value="error">error</option></select></form><output></output>');
  const { document, AbortController, CustomEvent } = dom.window;
  const previous = globalThis.CustomEvent; globalThis.CustomEvent = CustomEvent;
  try {
    const target = document.querySelector('#target'), form = document.querySelector('form'), output = document.querySelector('output'), controller = new AbortController();
    const calls = []; const bot = { setActivity: x => calls.push(x), setExpression: () => Promise.resolve(), moveToElement: () => Promise.resolve(), play: x => calls.push(x) };
    connectTaskEvents(bot,target,form,output,controller.signal);
    form.dispatchEvent(new dom.window.Event('submit',{ cancelable:true }));
    assert.equal(output.textContent,'처리 중…');
    target.dispatchEvent(new CustomEvent('demo-task',{ detail:{state:'success'} }));
    await new Promise(resolve => setTimeout(resolve,950));
    assert.equal(output.textContent,'작업 완료'); assert.ok(calls.includes('celebrating'));
    controller.abort(); const count = calls.length;
    target.dispatchEvent(new CustomEvent('demo-task',{ detail:{state:'error'} }));
    assert.equal(calls.length,count);
  } finally { globalThis.CustomEvent = previous; }
});

import { scenarioGroups, scenarios, scenarioById } from '../playground/scenario-catalog.js';
test('semantic scenario catalog has three real navigation depths and unique routes',()=>{
 assert.equal(scenarioGroups.length,4);assert.equal(scenarioGroups.flatMap(g=>g.groups).length,8);assert.equal(scenarios.length,18);
 assert.equal(new Set(scenarios.map(s=>s.id)).size,18);
 for(const item of scenarios){assert.ok(item.major&&item.middle&&item.title&&item.sentence&&item.hint);assert.equal(scenarioById(item.id).id,item.id);}
 assert.equal(scenarioById('unknown').id,'loading');
});

import { readFileSync } from 'node:fs';
import {lessons,lessonById} from '../playground/guide-lessons.js';
import {guideTranslations} from '../playground/guide-translations.js';
test('application controls feed the displayed declaration across all routes (mock renderer)',async()=>{
 const html=readFileSync(new URL('../guide.html',import.meta.url),'utf8');
 const script=readFileSync(new URL('../playground/use-cases.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 const dom=new JSDOM(html,{url:'https://example.com/guide.html#loading',runScripts:'outside-only'}),w=dom.window;
 w.ResizeObserver=class{observe(){}};w.scrollTo=()=>{};
 Object.assign(w,{...framework,...frameworkCode,readGuideContext,readGuideSource,guideHref,technicalHref,lessonDestinations,navigationText,guideIds,emotionFlowById,emotionMarkup,emotionCode,runEmotionAction,customizeEmotionAction,scenarioGroups,scenarioById,lessons,lessonById,guideTranslations,getSiteLocale:()=>'ko',subscribeSiteLocale:()=>()=>{},loadStudioSession:()=>({scene:createScene(),message:'mock'}),seedStudioSession:()=>{}, applyStudioSession:async()=>{},mountSiteHeader:()=>{}});
 class Bot extends w.HTMLElement {
 setActivity(){} setEmotion(){} reactTo(){return Promise.resolve();} cancelReaction(){} setExpression(){return Promise.resolve();}

  connectedCallback(){queueMicrotask(()=>{this.ready=true;this.dispatchEvent(new w.CustomEvent('sidekick-ready'));});}
  stopBehavior(){this.stopped=true;}
  set behavior(value){this.value=value;}get behavior(){return this.value;}
 }
 installStateReferenceHarness(w);w.customElements.define('sidekick-avatar',Bot);w.eval(script);
 const tick=()=>new Promise(resolve=>setTimeout(resolve,10));const $=id=>w.document.getElementById(id);
 try{
  await tick();
  for(const item of scenarios){w.location.hash=item.id;await tick();assert.ok($('demo-bot').hasAttribute('data-configured'));assert.equal(w.document.querySelectorAll('#demo-bot').length,1);assert.equal(w.document.querySelector('[aria-current="page"]').dataset.scenario,item.id);if(!emotionFlowById(item.id))assert.match($('declaration-code').textContent,new RegExp(`"type": "${$('demo-bot').behavior.type}"`));}
  for(const [route,prefix] of [['review','review'],['onboarding','onboard']]){w.location.hash=route;await tick();const rows=[1,2,3].map(n=>$(prefix+'-'+n));assert.equal(w.document.querySelectorAll('#demo-app .target-item').length,3);for(const node of rows){assert.ok(node);assert.equal(w.document.querySelectorAll('#'+node.id).length,1);}w.localizeGuide();rows.forEach((node,index)=>assert.equal($(prefix+'-'+(index+1)),node,'locale updates preserve target identity'));assert.ok(!$('demo-app').textContent.includes('<button'));}
  $('app-next').click();assert.equal($('demo-bot').behavior.target,'#onboard-2');$('app-previous').click();assert.equal($('demo-bot').behavior.target,'#onboard-1');
  w.location.hash='upload';await tick();for(let i=0;i<4;i++)$('app-progress').click();assert.equal($('demo-bot').behavior.type,'celebrate');
  w.location.hash='search';await tick();$('search-query').value='계정';$('app-search').click();assert.equal(w.document.querySelectorAll('#search-results .target-item').length,2);assert.equal($('demo-bot').behavior.type,'review');$('search-query').value='없음';$('app-search').click();assert.equal($('demo-bot').behavior.type,'idle');
  w.location.hash='validation';await tick();$('app-validate').click();assert.equal($('demo-bot').behavior.type,'guide');$('profile-email').value='hello@example.com';$('app-validate').click();assert.equal($('demo-bot').behavior.type,'celebrate');
  $('stop-demo').click();assert.ok($('demo-bot').stopped);
  $('toc-toggle').click();w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'}));assert.equal($('toc-toggle').getAttribute('aria-expanded'),'false');
 }finally{w.dispatchEvent(new w.Event('pagehide'));w.close();}
});
test('every scenario and technical lesson has complete nonempty translations in all three added languages',()=>{
 for(const locale of ['en','zh-CN','ja'])for(const entry of [...scenarios,...lessons])for(const value of [entry.major,entry.middle,entry.title,entry.sentence,entry.hint,...(entry.paragraphs??[])])assert.ok(guideTranslations[locale][value],`${locale} missing ${value}`);
});
test('all guide routes localize visible prose without untranslated Korean (mock renderer)',async()=>{
 const html=readFileSync(new URL('../guide.html',import.meta.url),'utf8');const script=readFileSync(new URL('../playground/use-cases.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 const dom=new JSDOM(html,{url:'https://example.com/guide.html#html-start',runScripts:'outside-only'}),w=dom.window;let locale='en';
 w.ResizeObserver=class{observe(){}};w.scrollTo=()=>{};
 Object.assign(w,{...framework,...frameworkCode,readGuideContext,readGuideSource,guideHref,technicalHref,lessonDestinations,navigationText,guideIds,emotionFlowById,emotionMarkup,emotionCode,runEmotionAction,customizeEmotionAction,scenarioGroups,scenarioById,lessons,lessonById,guideTranslations,getSiteLocale:()=>locale,subscribeSiteLocale:()=>()=>{},loadStudioSession:()=>({scene:createScene(),message:'아직 저장된 Studio 설정이 없어 기본 봇을 표시합니다.'}),seedStudioSession:()=>{}, applyStudioSession:async()=>{},mountSiteHeader:()=>{}});
 class Bot extends w.HTMLElement{setActivity(){} setEmotion(){}reactTo(){return Promise.resolve();}cancelReaction(){}setExpression(){return Promise.resolve();}connectedCallback(){queueMicrotask(()=>{this.ready=true;this.dispatchEvent(new w.CustomEvent('sidekick-ready'));});}stopBehavior(){}set behavior(v){this.value=v;}get behavior(){return this.value;}}
 installStateReferenceHarness(w);w.customElements.define('sidekick-avatar',Bot);w.eval(script);
 try{for(const language of ['en','zh-CN','ja']){locale=language;w.localizeGuide();for(const item of [...lessons,...scenarios]){w.location.hash=item.id;await new Promise(r=>setTimeout(r,4));const walker=w.document.createTreeWalker(w.document.querySelector('.catalog-layout'),w.NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode())if(!node.parentElement.closest('pre,[hidden]'))assert.ok(!/[가-힣]/.test(node.nodeValue),`${language}/${item.id}: ${node.nodeValue}`);}}}
 finally{w.dispatchEvent(new w.Event('pagehide'));w.close();}
});

test('emotion flow code and execution share exact calls, including interruption and independent behavior', async()=>{
 const {emotionFlows}=await import('../playground/emotion-scenarios.js');
 for(const flow of emotionFlows)for(const action of [flow.initial,...flow.buttons.map(([,a])=>a)]){
  const calls=[];const bot=new Proxy({}, {get:(_,method)=>(...args)=>{calls.push([method,args]);return Promise.resolve({finished:true});},set:(_,name,value)=>{calls.push([name,value]);return true;}});
  await runEmotionAction(bot,action);const expected=structuredClone(calls);calls.length=0;
  const {actionSource}=await import('../playground/playground-actions.js');
  await new (Object.getPrototypeOf(async()=>{}).constructor)('bot',actionSource(action,'bot'))(bot);
  assert.deepEqual(calls,expected,flow.id);
 }
 const custom=customizeEmotionAction(emotionFlows[4].buttons[0][1],0.2,2500);
 assert.deepEqual(custom.args,['surprised',{intensity:0.2,duration:2500}]);
 assert.equal(emotionFlows[4].buttons[0][1].args[1].intensity,0.9,'preset remains immutable');
});

test('guide technical copy has identical keys across all four locales',()=>{
 const keys=Object.keys(guideTranslations.ko).sort();
 for(const locale of ['ko','en','zh-CN','ja']){
  assert.deepEqual(Object.keys(guideTranslations[locale]).sort(),keys,locale);
  for(const [key,value] of Object.entries(guideTranslations[locale]))assert.ok(typeof value==='string'&&value.trim(),`${locale}: ${key}`);
 }
 assert.equal(guideTranslations.ko['HTML에서 한 줄로 행동 선언'],'설치와 초기화');
 assert.equal(guideTranslations.en['빠르게 시작'],'Basic usage');
 assert.equal(guideTranslations.ko['작은 동료가 사용자의 작업을 함께합니다.'],'이 문단은 guide 행동의 첫 번째 대상입니다.');
 for(const locale of ['ko','en','zh-CN','ja']){
  const prose=Object.values(guideTranslations[locale]).join('\n');
  assert.ok(!/한 줄로|가장 간단한 시작|작은 동료가|for you|ひとつで|即可/.test(prose),locale);
 }
});
