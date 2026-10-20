import { apiDemoFrame } from './helpers/api-demo-frame.mjs';
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {createAppServer} from '../scripts/serve.mjs';
import {lessons} from '../playground/guide-lessons.js';
import {scenarios} from '../playground/scenario-catalog.js';
import {readGuideContext,readGuideSource,guideHref} from '../playground/guide-navigation.js';
let browser,server,base;
before(async()=>{server=createAppServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));base=process.env.SIDEKICK_GUIDE_LIVE_URL??`http://127.0.0.1:${server.address().port}`;browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:process.env.SIDEKICK_HEADED!=='1',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});});
after(async()=>{await browser?.close();await new Promise(r=>server?.close(r));});

const clickedSourceKey='sidekick-test-clicked-guide-source';
const restoredSourceKey='sidekick-test-restored-guide-source';
async function clickContextLink(page){
 // Capture the source in the same click turn that snapshots the destination URL.
 // Automatic workload ticks may legitimately change it before Playwright clicks.
 await page.locator('#context-playground-link').evaluate((link,key)=>{
  sessionStorage.removeItem(key);
  link.addEventListener('click',()=>sessionStorage.setItem(key,document.querySelector('#declaration-code').textContent),{capture:true,once:true});
 },clickedSourceKey);
 await page.locator('#context-playground-link').click();await page.waitForSelector('#demo-bot[data-configured]');
 const source=await page.evaluate(key=>sessionStorage.getItem(key),clickedSourceKey);
 assert.equal(typeof source,'string','the actual contextual click captured its source');
 return source;
}
for(const lang of ['ko','en','zh-CN','ja'])test(`actual contextual link clicks for all 34 Guide sections: ${lang}`,{timeout:180000},async()=>{
 const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('GUIDE PAGE ERROR',e.stack)});page.on('console',m=>{if(m.type()==='error')console.error('GUIDE CONSOLE',m.text())});
 // Context restoration renders the source before attaching the avatar. Capture
 // that source at readiness, before a returned Guide starts its next workload.
 // The automatic examples keep running; this test compares navigation snapshots.
 await page.addInitScript(key=>{
  if(!location.pathname.endsWith('/guide.html')||!new URL(location.href).searchParams.has('context'))return;
  sessionStorage.removeItem(key);
  const captureSource=event=>{
   if(event.target.id!=='demo-bot')return;
   sessionStorage.setItem(key,document.querySelector('#declaration-code').textContent);
   document.removeEventListener('sidekick-ready',captureSource,true);
  };
  document.addEventListener('sidekick-ready',captureSource,{capture:true});
 },restoredSourceKey);
 try{
  for(const item of scenarios){
   await page.goto(`${base}/guide.html?lang=${lang}#${item.id}`);await page.waitForSelector('#demo-bot[data-configured]');
   await page.locator('[data-level="2"]').click();
   if(!item.id.startsWith('emotion-')){await page.selectOption('#behavior-side','right');await page.fill('#behavior-gap','28');await page.locator('#apply-options').click();}
   else {await page.fill('#guide-emotion-intensity','0.3');await page.fill('#guide-emotion-duration','1700');await page.locator('[data-emotion-step="0"]').click();}
   const code=await clickContextLink(page);
   assert.match(page.url(),/api-playground.html/);assert.equal(await page.locator('.app-header').count(),1);assert.equal(await page.locator('.catalog-nav').isVisible(),false);assert.equal(await page.locator('#context-playground-link').isVisible(),false);
   if(process.env.SIDEKICK_SCREENSHOTS&&lang==='en'&&item.id==='review'){await mkdir(process.env.SIDEKICK_SCREENSHOTS,{recursive:true});await page.screenshot({path:process.env.SIDEKICK_SCREENSHOTS+'/contextual-guide-desktop.png',fullPage:true});}
   assert.equal(await page.locator('#declaration-code').textContent(),code,item.id);assert.equal(await page.locator('[data-level="2"]').getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('#demo-bot').evaluate(bot=>bot.behavior),null,'URL does not automatically execute behavior');
   await page.locator('#restart-demo').click();await page.waitForFunction(()=>document.querySelector('#demo-bot').behavior!==null);
   await page.locator('#guide-source-return').click();await page.waitForSelector('#demo-bot[data-configured]');assert.equal(new URL(page.url()).hash,'#'+item.id);assert.equal(await page.evaluate(key=>sessionStorage.getItem(key),restoredSourceKey),code);
  }
  for(const lesson of lessons){
   await page.goto(`${base}/guide.html?lang=${lang}#${lesson.id}`);await page.locator('[data-lesson-destination]').click();
   await page.waitForSelector('#guide-source-return');assert.equal(readGuideSource(page.url()).id,lesson.id);
   if(lesson.id==='element-anchor'){await apiDemoFrame(page);assert.equal(await page.inputValue('#move-method'),'moveToElement');assert.equal(await page.isChecked('#element-anchor'),true);assert.match(await page.locator('#invocation').textContent(),/moveToElement/);}
   if(lesson.id==='performance'){await apiDemoFrame(page);assert.equal(await page.inputValue('#action-kind'),'performance');assert.match(await page.locator('#invocation').textContent(),/paused = true/);}
   await page.locator('#guide-source-return').click();await page.waitForSelector('[data-lesson-destination]');assert.equal(new URL(page.url()).hash,'#'+lesson.id);
  }
  assert.deepEqual(errors,[]);
 }catch(error){console.error('GUIDE DIAGNOSTICS',page.url(),await page.locator('#run-status').textContent().catch(()=>''),await page.locator('#demo-bot').count());throw error;}finally{await page.close();}
});
test('running upload navigation preserves the events present at the actual click',async()=>{
 const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});
 try{
  await page.goto(`${base}/guide.html?lang=zh-CN#upload`);await page.waitForSelector('#demo-bot[data-configured]');
  await page.waitForFunction(()=>Number(document.querySelector('#progress-label')?.dataset.progress)>=25);
  const code=await clickContextLink(page);
  const context=readGuideContext(page.url()),source=readGuideSource(page.url());
  assert.equal(context.id,'upload');assert.equal(source.id,'upload');
  assert.ok(context.events.length>=1,'the workload advanced before navigation');
  assert.ok(context.events.every(event=>event==='app-progress'));
  assert.deepEqual(context.events,source.events,'destination and return link preserve the same click-time events');
  const destination=await page.locator('#declaration-code').textContent();
  assert.equal(destination,code);
  const restored=destination.match(/for \(const event of (\[[^\n]*\])\) disposeWorkflow\.restore\(event\);/);
  assert.ok(restored,'copied source explicitly restores the bounded event history');
  assert.deepEqual(JSON.parse(restored[1]),context.events);
  assert.equal(await page.locator('#progress-label').getAttribute('data-progress'),String(Math.min(100,context.events.length*25)));
  assert.equal(await page.locator('#demo-bot').evaluate(bot=>bot.behavior),null,'restoring the click-time state does not automatically run the destination');
 }finally{await page.close();}
});
test('direct reload, source scroll, history, manual level and invalid context',async()=>{
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 try{
  const context={id:'onboarding',level:4,side:'right',gap:28,events:['app-next','app-next'],scroll:640};
  await page.goto(base+'/'+guideHref(context,'en',true).slice(2));await page.waitForSelector('#demo-bot[data-configured]');
  assert.match(await page.locator('#declaration-code').textContent(),/#onboard-3/);assert.equal(readGuideSource(page.url()).scroll,640);
  await page.reload();await page.waitForSelector('#demo-bot[data-configured]');assert.match(await page.locator('#declaration-code').textContent(),/#onboard-3/);
  await page.locator('#restart-demo').click();await page.waitForFunction(()=>document.querySelector('#run-status').textContent.includes('complete')||document.querySelector('#run-status').textContent.includes('완료'));assert.equal(await page.locator('#demo-bot').evaluate(bot=>bot.behavior),null);
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,'Mobile exercise must not overflow horizontally');
  if(process.env.SIDEKICK_SCREENSHOTS){await mkdir(process.env.SIDEKICK_SCREENSHOTS,{recursive:true});await page.screenshot({path:process.env.SIDEKICK_SCREENSHOTS+'/contextual-guide-mobile.png',fullPage:true});}
  await page.locator('#guide-source-return').click();await page.waitForSelector('#demo-bot[data-configured]');assert.equal(new URL(page.url()).hash,'#onboarding');
  await page.goBack();await page.waitForSelector('#demo-bot[data-configured]');assert.match(page.url(),/api-playground/);
  await page.goto(`${base}/api-playground.html?context=%7Bbad`);await page.waitForSelector('#invalid-guide-context');assert.equal(await page.locator('#bot').count(),0);assert.equal(await page.locator('#site-preview-frame').count(),0,'Invalid context must not mount an avatar demo');
 }finally{await page.close();}
});
for(const lang of ['ko','en','zh-CN','ja'])test(`state-first reference and narrow-screen table: ${lang}`,async()=>{
 const page=await browser.newPage({viewport:{width:320,height:740},reducedMotion:'reduce'});
 try{
  await page.goto(`${base}/guide.html?lang=${lang}`);await page.waitForSelector('[data-state-reference]');
  assert.equal(await page.locator('#scenario-toc [aria-current="page"]').getAttribute('data-scenario'),'state-emotion');
  if(process.env.SIDEKICK_SCREENSHOTS&&lang==='ko'){await mkdir(process.env.SIDEKICK_SCREENSHOTS,{recursive:true});await page.setViewportSize({width:1280,height:900});await page.screenshot({path:process.env.SIDEKICK_SCREENSHOTS+'/guide-state-ko-desktop.png',fullPage:true});await page.setViewportSize({width:320,height:740});}
  await page.locator('#toc-toggle').click();await page.locator('[data-scenario="state-appearance"]').click();await page.locator('.state-lab-details summary').click();
  assert.equal(await page.locator('.state-reference tbody tr').count(),26);
  assert.equal(await page.locator('#lesson-content pre').count(),1);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.ok(await page.locator('.state-table-wrap').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'reference fields are readable without horizontal scrolling');
  assert.equal(await page.locator('.state-reference td[data-label]').count(),78);
  const text=await page.locator('.state-reference').textContent();if(lang!=='ko')assert.doesNotMatch(text,/[가-힣]/);
  if(process.env.SIDEKICK_SCREENSHOTS){await mkdir(process.env.SIDEKICK_SCREENSHOTS,{recursive:true});await page.screenshot({path:process.env.SIDEKICK_SCREENSHOTS+`/guide-state-${lang}-320.png`,fullPage:true});}
  await page.locator('[data-lesson-destination]').click();await page.waitForSelector('#demo-bot[data-configured]');assert.equal(readGuideSource(page.url()).id,'state-appearance');
  await page.locator('#guide-source-return').click();await page.waitForSelector('[data-state-reference]');assert.equal(new URL(page.url()).hash,'#state-appearance');
 }finally{await page.close();}
});
