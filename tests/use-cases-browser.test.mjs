import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createAppServer } from '../scripts/serve.mjs';
import { scenarios } from '../playground/scenario-catalog.js';
let browser, server, base;
before(async()=>{
 if(process.env.SIDEKICK_USECASES_LIVE_URL){assert.equal(process.env.SIDEKICK_USECASES_LIVE_URL,'https://sidekick.hananakick.cc');base=process.env.SIDEKICK_USECASES_LIVE_URL;}
 else{server=createAppServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:process.env.SIDEKICK_HEADED!=='1',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
});
after(async()=>{await browser?.close();if(server)await new Promise(r=>server.close(r));});
async function setup(t,viewport={width:1280,height:900},hash='loading'){
 const page=await browser.newPage({viewport,locale:'ko-KR',reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));t.after(async()=>{await page.close();assert.deepEqual(errors,[]);});
 await page.goto(`${base}/guide.html#${hash}`);await page.waitForSelector('#demo-bot[data-configured]');return page;
}
async function choose(page,id){
 if(await page.locator('#toc-toggle').isVisible()&&await page.locator('#toc-toggle').getAttribute('aria-expanded')==='false')await page.locator('#toc-toggle').click();
 await page.locator(`#scenario-toc [data-scenario="${id}"]`).click();await page.waitForSelector(`#demo-bot[data-configured][data-scenario="${id}"]`);
 assert.equal(await page.locator('#demo-bot').count(),1);
 assert.equal(await page.locator('#scenario-toc [aria-current=page]').getAttribute('data-scenario'),id);
}
test('three-level contents provides all 18 actual scenarios and hash history navigation',async t=>{
 const page=await setup(t);assert.equal(await page.locator('#scenario-toc > details').count(),3);assert.equal(await page.locator('#scenario-toc h3').count(),9);assert.equal(await page.locator('#scenario-toc [data-scenario]').count(),26);
 await choose(page,'review');await choose(page,'input');await page.goBack();await page.waitForFunction(()=>document.querySelector('[aria-current="page"][data-scenario]')?.dataset.scenario==='review');
 await page.goForward();await page.waitForFunction(()=>document.querySelector('[aria-current="page"][data-scenario]')?.dataset.scenario==='input');
 assert.equal(await page.locator('#breadcrumb').textContent(),'행동 선언 / 사용자 안내 / 입력할 위치 안내');
});
test('loading declaration and app completion execute exactly the displayed semantic command',async t=>{
 const page=await setup(t);assert.equal(await page.locator('#demo-bot').evaluate(b=>b.behavior.type),'wait');
 assert.match(await page.locator('#declaration-code').textContent(),/"target": "#loading-indicator"/);
 await page.locator('#app-complete').click();assert.equal(await page.locator('#demo-bot').evaluate(b=>b.behavior.type),'celebrate');assert.match(await page.locator('#declaration-code').textContent(),/"type": "celebrate"/);
 await page.locator('#restart-demo').click();await page.waitForSelector('#demo-bot[data-configured]');assert.equal(await page.locator('#demo-bot').evaluate(b=>b.behavior.type),'wait');
 await page.locator('#stop-demo').click();assert.match(await page.locator('#run-status').textContent(),/중단/);
});
test('review visits list sequentially and search reviews only current matching DOM',async t=>{
 const page=await setup(t,undefined,'review');assert.equal(await page.locator('#demo-app .target-item').count(),3);await page.waitForFunction(()=>['completed','cancelled','error'].includes(document.querySelector('#demo-bot').behaviorState.status),{},{timeout:20000});
 assert.equal(await page.locator('#demo-bot').evaluate(b=>b.behaviorState.status),'completed',JSON.stringify(await page.locator('#demo-bot').evaluate(b=>b.behaviorState)));
 assert.equal(await page.locator('#demo-bot').evaluate(b=>b.behaviorState.completedItems),3);
 await choose(page,'search');await page.fill('#search-query','계정');await page.locator('#app-search').click();assert.equal(await page.locator('#search-results .target-item').count(),2);
 assert.equal(await page.locator('#demo-bot').evaluate(b=>b.behavior.type),'review');
 await page.fill('#search-query','없는 검색어');await page.locator('#app-search').click();assert.equal(await page.locator('#demo-bot').evaluate(b=>b.behavior.type),'idle');assert.match(await page.locator('#search-results').textContent(),/없습니다/);
});
test('selection, paragraph and onboarding change focus only on application actions',async t=>{
 const page=await setup(t,undefined,'selection');await page.locator('#selected-3').click();assert.equal(await page.locator('#demo-bot').evaluate(b=>b.behavior.target),'#selected-3');
 await choose(page,'paragraph');await page.locator('#app-next').click();assert.equal(await page.locator('#demo-bot').evaluate(b=>b.behavior.target),'#paragraph-2');assert.ok(await page.locator('#app-next').isDisabled());
 await choose(page,'onboarding');await page.locator('#app-next').click();assert.equal(await page.locator('#demo-bot').evaluate(b=>b.behavior.target),'#onboard-2');await page.locator('#app-previous').click();assert.equal(await page.locator('#demo-bot').evaluate(b=>b.behavior.target),'#onboard-1');
});
test('upload, validation and input expose genuine application outcomes',async t=>{
 const page=await setup(t,undefined,'upload');for(let i=0;i<4;i++)await page.locator('#app-progress').click();assert.equal(await page.locator('#demo-bot').evaluate(b=>b.behavior.type),'celebrate');
 await choose(page,'validation');await page.locator('#app-validate').click();assert.equal(await page.locator('#demo-bot').evaluate(b=>b.behavior.type),'guide');await page.fill('#profile-email','hello@example.com');await page.locator('#app-validate').click();assert.equal(await page.locator('#demo-bot').evaluate(b=>b.behavior.type),'celebrate');
 await choose(page,'input');await page.locator('#app-confirm').click();assert.equal(await page.locator('#demo-bot').evaluate(b=>b.behavior.type),'wait');await page.fill('#profile-name','테스트');await page.locator('#app-confirm').click();assert.equal(await page.locator('#demo-bot').evaluate(b=>b.behavior.type),'celebrate');
});
for(const viewport of [{width:1280,height:900},{width:390,height:844},{width:320,height:640}])test(`visible complete catalog walkthrough ${viewport.width}`,async t=>{
 const page=await setup(t,viewport);const out=process.env.SIDEKICK_SCREENSHOTS;if(out)await mkdir(out,{recursive:true});
 for(const scenario of scenarios){await choose(page,scenario.id);await page.locator('.application').scrollIntoViewIfNeeded();await page.waitForTimeout(400);
  assert.ok(await page.locator('#demo-app .app-card').isVisible());assert.ok(await page.locator('#restart-demo').isVisible());
  assert.equal(await page.locator('sidekick-avatar').count(),2,'one active demo plus static header only');
  const geometry=await page.locator('#demo-bot').evaluate(b=>{const r=b.getBoundingClientRect(),a=document.querySelector('.application').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,left:a.left,right:a.right,top:a.top,bottom:a.bottom};});
  assert.ok(geometry.x+geometry.w>geometry.left&&geometry.x<geometry.right,'avatar must intersect application example');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
  if(out)await page.screenshot({path:`${out}/semantic-${viewport.width}-${scenario.id}.png`});
 }
 await page.locator('#declaration-code').scrollIntoViewIfNeeded();assert.match(await page.locator('#declaration-code').textContent(),/bot.behavior =/);
});
test('mobile keyboard contents and persisted Studio avatar survive route switches',async t=>{
 const page=await setup(t,{width:390,height:844});await page.evaluate(async()=>{const {createScene,createDesign}=await import('/browser/sidekick.js');localStorage.setItem('sidekick.studio.scene.v3',JSON.stringify(createScene({design:createDesign({body:{shape:'heart',color:'#123456'}})})));});await page.reload();await page.waitForSelector('#demo-bot[data-configured]');
 assert.equal(await page.locator('#demo-bot').evaluate(b=>b.design.body.shape),'heart');
 await page.locator('#toc-toggle').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#toc-toggle').getAttribute('aria-expanded'),'true');
 await choose(page,'success');assert.equal(await page.locator('#toc-toggle').getAttribute('aria-expanded'),'false');assert.equal(await page.locator('#demo-bot').evaluate(b=>b.design.body.color),'#123456');
 await page.locator('#app-save').click();assert.match(await page.locator('#save-result').textContent(),/저장/);
});
test('unsupported WebGL keeps contents and application code available without hanging',async t=>{
 const page=await setup(t);await page.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=function(){return null;};window.Worker=undefined;});
 await page.reload();await page.waitForFunction(()=>document.querySelector('#run-status').textContent.includes('WebGL'));
 assert.match(await page.locator('#declaration-code').textContent(),/bot.behavior =/);
 await page.locator('[data-scenario="input"]').click();await page.waitForFunction(()=>document.querySelector('#run-status').textContent.includes('WebGL'));
 await page.fill('#profile-name','테스트');await page.locator('#app-confirm').click();assert.match(await page.locator('#declaration-code').textContent(),/celebrate/);
});
test('guide progresses from one declaration to live options, events and direct composition',async t=>{
 const page=await setup(t,{width:390,height:844});
 await page.locator('[data-level="2"]').click();await page.selectOption('#behavior-side','right');await page.fill('#behavior-gap','16');await page.locator('#apply-options').click();
 assert.equal(await page.locator('#demo-bot').evaluate(b=>b.behavior.side),'right');assert.match(await page.locator('#declaration-code').textContent(),/"gap": 16/);
 await page.locator('[data-level="3"]').click();assert.ok(await page.locator('.declaration-panel details').getAttribute('open')!==null);
 await page.locator('[data-level="4"]').click();assert.match(await page.locator('#declaration-code').textContent(),/moveToElement/);await page.locator('#run-manual').click();
 await page.waitForFunction(()=>document.querySelector('#run-status').textContent==='직접 조합 완료');assert.equal(await page.locator('#demo-bot').evaluate(b=>b.behavior),null);
 await page.locator('#return-declaration').click();assert.equal(await page.locator('#demo-bot').evaluate(b=>b.behavior.type),'wait');
});
test('legacy use-case URL preserves hash and redirects to canonical Guide',async t=>{
 const page=await setup(t);await page.goto(`${base}/use-cases.html?lang=ko#review`);await page.waitForSelector('#demo-bot[data-configured][data-scenario="review"]');assert.match(page.url(),/\/guide\.html\?lang=ko#review$/);
});
for(const locale of ['ko','en','zh-CN','ja'])test(`Guide translates technical lessons and live scenarios in ${locale}`,async t=>{
 const page=await setup(t,{width:390,height:844});await page.selectOption('#site-language',locale);
 await choose(page,'loading');await page.locator('[data-level="2"]').click();
 const untranslated=await page.evaluate(()=>{const walker=document.createTreeWalker(document.querySelector('.catalog-layout'),NodeFilter.SHOW_TEXT),bad=[];let n;while(n=walker.nextNode())if(!n.parentElement.closest('pre,[hidden]')&&/[가-힣]/.test(n.nodeValue))bad.push(n.nodeValue);return bad;});if(locale!=='ko')assert.deepEqual(untranslated,[]);
 const basicLabels={ko:'1. 기본 선언',en:'1. Basic declaration','zh-CN':'1. 基本声明',ja:'1. 基本宣言'};
 assert.equal(await page.locator('[data-level="1"]').textContent(),basicLabels[locale]);
 await page.goto(`${base}/guide.html?lang=${locale}#html-start`);await page.waitForSelector('#lesson-content:not([hidden])');assert.equal(await page.locator('#demo-bot').count(),0);assert.ok((await page.locator('#lesson-content pre').textContent()).includes('bot.behavior'));
 const lessonTitles={ko:'HTML 초기화와 행동 선언',en:'HTML initialization and behavior declaration','zh-CN':'HTML 初始化与行为声明',ja:'HTML の初期化と行動宣言'};
 assert.equal(await page.locator('#scenario-title').textContent(),lessonTitles[locale]);
 const visibleProse=await page.locator('.catalog-layout').innerText();
 assert.doesNotMatch(visibleProse,/한 줄로 행동 선언|가장 간단한 시작|작은 동료가 사용자의|coordinated for you/);
 if(process.env.SIDEKICK_SCREENSHOTS)await page.screenshot({path:`${process.env.SIDEKICK_SCREENSHOTS}/guide-${locale}-html-start.png`});
});

test('emotion request outcomes and reactions preserve behavior with runnable displayed code',async t=>{
 const page=await setup(t,undefined,'emotion-request');
 await page.locator('[data-emotion-step="1"]').click();
 assert.equal(await page.locator('#demo-bot').evaluate(b=>b.emotion),'concerned');
 assert.match(await page.locator('#declaration-code').textContent(),/setEmotion\('concerned'/);
 await page.locator('[data-emotion-step="2"]').click();
 assert.equal(await page.locator('#demo-bot').evaluate(b=>b.behavior.type),'wait');
 await page.locator('[data-emotion-step="3"]').click();
 assert.equal(await page.locator('#demo-bot').evaluate(b=>b.emotion),'happy');
 await choose(page,'emotion-notification');
 await page.locator('[data-emotion-step="0"]').click();
 assert.equal(await page.locator('#demo-bot').evaluate(b=>b.behavior.type),'wait');
 await page.locator('[data-emotion-step="1"]').click();
 assert.equal(await page.locator('#demo-bot').evaluate(b=>b.emotionState.reacting),false);
});
test('emotion guide options, rapid interruption and keyboard contents work on mobile',async t=>{
 const page=await setup(t,{width:320,height:640},'emotion-interruption');
 await page.locator('[data-level="2"]').click();
 await page.locator('#guide-emotion-intensity').fill('0.2');await page.locator('#guide-emotion-duration').fill('2400');
 await page.locator('[data-emotion-step="0"]').click();
 assert.match(await page.locator('#declaration-code').textContent(),/intensity: 0.2, duration: 2400/);
 await page.locator('[data-emotion-step="1"]').click();await page.locator('[data-emotion-step="2"]').click();
 assert.equal(await page.locator('#demo-bot').evaluate(b=>b.emotion),'happy');
 await page.locator('#toc-toggle').click();
 await page.locator('[data-scenario="emotion-composition"]').focus();await page.keyboard.press('Enter');
 await page.waitForSelector('#demo-bot[data-scenario="emotion-composition"][data-configured]');
 assert.equal(await page.locator('#toc-toggle').getAttribute('aria-expanded'),'false');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
});

test('compact mobile emotion examples keep the avatar and last action visible together',async t=>{
 const page=await setup(t,{width:320,height:640},'emotion-interruption');
 for(const route of ['emotion-interruption','emotion-composition']){
  if(route!=='emotion-interruption')await choose(page,route);
  await page.waitForTimeout(450);
  await page.evaluate(()=>{
   const app=document.querySelector('.application').getBoundingClientRect();
   const header=document.querySelector('.app-header').getBoundingClientRect().height;
   const toc=document.querySelector('.catalog-nav').getBoundingClientRect().height;
   window.scrollTo({top:scrollY+app.top-header-toc-8,behavior:'instant'});
  });
  const geometry=await page.evaluate(()=>{
   const bot=document.querySelector('#demo-bot').getBoundingClientRect(),last=[...document.querySelectorAll('[data-emotion-step]')].at(-1).getBoundingClientRect();
   const fixedBottom=document.querySelector('.catalog-nav').getBoundingClientRect().bottom;
   return {botTop:bot.top,botBottom:bot.bottom,lastTop:last.top,lastBottom:last.bottom,fixedBottom,height:innerHeight};
  });
  assert.ok(geometry.botTop>=geometry.fixedBottom-1,`${route}: avatar behind header`);
  assert.ok(geometry.botBottom<=geometry.height,`${route}: avatar below viewport`);
  assert.ok(geometry.lastTop>=geometry.fixedBottom&&geometry.lastBottom<=geometry.height,`${route}: last action and avatar must be visible together`);
  if(process.env.SIDEKICK_SCREENSHOTS)await page.screenshot({path:`${process.env.SIDEKICK_SCREENSHOTS}/compact-320-${route}.png`});
 }
});
