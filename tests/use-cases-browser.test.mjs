import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createAppServer } from '../scripts/serve.mjs';
let browser, server, base;
before(async () => {
  if (process.env.SIDEKICK_USECASES_LIVE_URL) {
    assert.equal(process.env.SIDEKICK_USECASES_LIVE_URL, 'https://sidekick.hananakick.cc');
    base = process.env.SIDEKICK_USECASES_LIVE_URL;
  } else {
    server = createAppServer(); await new Promise(resolve => server.listen(0,'127.0.0.1',resolve)); base=`http://127.0.0.1:${server.address().port}`;
  }
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined), headless: process.env.SIDEKICK_HEADED !== '1',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'] });
});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
async function setup(t,viewport={width:1280,height:900}) {
  const page=await browser.newPage({viewport,reducedMotion:'reduce'});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  t.after(async()=>{await page.close();assert.deepEqual(errors,[]);});
  await page.goto(`${base}/use-cases.html`);await page.waitForSelector('[data-start="viewport"]');return page;
}
async function start(page,kind){await page.locator(`[data-start="${kind}"]`).click();await page.waitForSelector('#demo-bot[data-configured]');assert.equal(await page.locator('#demo-bot').count(),1);}
test('fixed companion stays at same viewport coordinates through scroll and exits',async t=>{
 const page=await setup(t);await start(page,'viewport');assert.match(await page.locator('#code-viewport').textContent(), /function dockInViewport\(bot\)/); const first=await page.locator('#demo-bot').boundingBox();
 await page.evaluate(()=>window.scrollTo(0,800));const second=await page.locator('#demo-bot').boundingBox();assert.ok(Math.abs(first.x-second.x)<1&&Math.abs(first.y-second.y)<1);
 await page.locator('#viewport-exit').click();await page.waitForFunction(()=>document.querySelector('#demo-bot').presenceState==='hidden');
 await page.locator('#viewport-return').click();await page.waitForFunction(()=>document.querySelector('#demo-bot').presenceState!=='hidden');
});
test('section DOM owns origin, movement stays inside and scrolls with container',async t=>{
 const page=await setup(t);await start(page,'section');await page.locator('[data-section="right"]').click();
 const before=await page.evaluate(()=>{const b=document.querySelector('#demo-bot').getBoundingClientRect(),s=document.querySelector('#section-area').getBoundingClientRect();return {bx:b.x,by:b.y,sx:s.x,sy:s.y,right:b.right,sright:s.right};});assert.ok(before.right<before.sright);
 await page.evaluate(()=>window.scrollBy(0,100));const after=await page.evaluate(()=>{const b=document.querySelector('#demo-bot').getBoundingClientRect(),s=document.querySelector('#section-area').getBoundingClientRect();return {x:b.x-s.x,y:b.y-s.y};});assert.ok(Math.abs(after.x-(before.bx-before.sx))<1&&Math.abs(after.y-(before.by-before.sy))<1);
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);await page.locator('[data-section="left"]').click();
 const fit=await page.evaluate(()=>{const b=document.querySelector('#demo-bot').getBoundingClientRect(),s=document.querySelector('#section-area').getBoundingClientRect();return b.left>=s.left&&b.right<=s.right&&b.top>=s.top&&b.bottom<=s.bottom;});assert.ok(fit);
});
test('DOM alignment options control actual movement and snippet; events clean up on switching',async t=>{
 const page=await setup(t);await start(page,'anchor');await page.selectOption('#align-x','right');await page.selectOption('#align-y','center');await page.fill('#offset-x','-12');await page.locator('#anchor-move').click();
 const delta=await page.evaluate(()=>{const b=document.querySelector('#demo-bot').getBoundingClientRect(),s=document.querySelector('#anchor-target').getBoundingClientRect();return b.right-s.right;});assert.ok(Math.abs(delta+12)<1);assert.match(await page.locator('#code-anchor').textContent(),/"x": -12/);
 await start(page,'events');await page.fill('#task-name','Demo');await page.locator('#task-submit').click();await page.waitForFunction(()=>document.querySelector('#event-status').textContent==='작업 완료');
 assert.equal(await page.locator('#demo-bot').evaluate(b=>b.design.eyes.left.weights.smile),1);
 await start(page,'section');await page.evaluate(()=>document.querySelector('#event-target').dispatchEvent(new CustomEvent('demo-task',{detail:{state:'error'}})));assert.equal(await page.locator('#event-status').textContent(),'작업 완료');
});
test('mobile navigation remains visible, Studio design loads and only one demo renderer is active',async t=>{
 const page=await setup(t,{width:320,height:640});
 for(const link of await page.locator('.app-header a').all()){const box=await link.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=321);}
 await page.evaluate(async()=>{const {createScene,createDesign}=await import('/browser/sidekick.js');const scene=createScene({design:createDesign({body:{shape:'heart',color:'#123456'}}),bodyOrientation:{yaw:20,pitch:5,roll:3},trackingMode:'off'});localStorage.setItem('sidekick.studio.scene.v3',JSON.stringify(scene));});
 await page.reload();await start(page,'viewport');assert.deepEqual(await page.locator('#demo-bot').evaluate(b=>({shape:b.design.body.shape,color:b.design.body.color,orientation:b.bodyOrientation})),{shape:'heart',color:'#123456',orientation:{yaw:20,pitch:5,roll:3}});
await start(page,'anchor');await start(page,'events');assert.equal(await page.locator('sidekick-avatar').count(),2);
 await page.locator('#stop-demo').click();assert.equal(await page.locator('#demo-bot').count(),0);
 if(process.env.SIDEKICK_SCREENSHOTS){await mkdir(process.env.SIDEKICK_SCREENSHOTS,{recursive:true});await page.screenshot({path:`${process.env.SIDEKICK_SCREENSHOTS}/use-cases-mobile.png`,fullPage:true});}
});
test('natural section flights queue rapid taps without clipping through any edge', async t => {
 const page=await setup(t);await page.emulateMedia({reducedMotion:'no-preference'});await start(page,'section');
 await page.evaluate(()=>{const section=document.querySelector('#section-area'),bot=document.querySelector('#demo-bot');window.sectionSamples=[];bot.addEventListener('sidekick-move-progress',()=>{const b=bot.getBoundingClientRect(),s=section.getBoundingClientRect();window.sectionSamples.push(b.left>=s.left-1&&b.right<=s.right+1&&b.top>=s.top-1&&b.bottom<=s.bottom+1);});});
 await page.locator('[data-section="right"]').click();await page.locator('[data-section="left"]').click();
 await page.waitForFunction(()=>{const b=document.querySelector('#demo-bot');return b.position.x<22&&b.movementState.phase==='idle';},{},{timeout:15000});
 const samples=await page.evaluate(()=>window.sectionSamples);assert.ok(samples.length>3);assert.ok(samples.every(Boolean));
 if(process.env.SIDEKICK_SCREENSHOTS){await mkdir(process.env.SIDEKICK_SCREENSHOTS,{recursive:true});await page.screenshot({path:`${process.env.SIDEKICK_SCREENSHOTS}/use-cases-desktop.png`,fullPage:true});}
});

for (const viewport of [{width:1280,height:900},{width:390,height:844},{width:320,height:480}]) {
 test(`sequential visible walkthrough ${viewport.width}: choose, move, scroll, bind, submit, read code`, async t => {
  const name=`usecase-walkthrough-${viewport.width}`;
  const out=process.env.SIDEKICK_SCREENSHOTS;
  if(out)await mkdir(out,{recursive:true});
  const context=await browser.newContext({viewport,reducedMotion:'no-preference',...(out?{recordVideo:{dir:`${out}/videos`,size:viewport}}:{})});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  t.after(async()=>{await context.close();assert.deepEqual(errors,[]);});
  const shot=async step=>{if(out)await page.screenshot({path:`${out}/${name}-${step}.png`});};
  const visibleBot=async()=>{const b=await page.locator('#demo-bot').boundingBox(),bar=await page.locator('.scenario-bar').boundingBox();assert.ok(b.y+b.height/2>bar.y+bar.height && b.y+b.height/2<viewport.height-8, `bot center ${b.y+b.height/2} must be visible below controls in ${viewport.width}x${viewport.height}`);};
  await page.goto(`${base}/use-cases.html`);await page.waitForSelector('#demo-bot[data-configured]');
  await shot('01-open');
  assert.equal(await page.locator('section.case:visible').count(),1);
  const fixed=await page.locator('#demo-bot').boundingBox();
  await page.locator('#case-viewport [data-scroll-demo]').click();
  await page.waitForTimeout(750);await shot('02-scroll-fixed');
  const still=await page.locator('#demo-bot').boundingBox();assert.ok(Math.abs(still.y-fixed.y)<1);
  await start(page,'section');await page.locator('#back-to-demo').click();await page.waitForTimeout(700);
  await page.locator('[data-section="right"]').click();
  await page.waitForFunction(()=>document.querySelector('#demo-bot').movementState.phase==='idle');
  await shot('03-section-right');await visibleBot();
  const section=await page.locator('#section-area').boundingBox(),bot=await page.locator('#demo-bot').boundingBox();
  assert.ok(bot.x>=section.x&&bot.x+bot.width<=section.x+section.width+1);
  await start(page,'anchor');await page.locator('#case-anchor').scrollIntoViewIfNeeded();
  await page.locator('#anchor-shift').click();await page.waitForTimeout(1100);await shot('04-anchor-follow');await visibleBot();
  const delta=await page.evaluate(()=>{const b=document.querySelector('#demo-bot').getBoundingClientRect(),a=document.querySelector('#anchor-target').getBoundingClientRect();return Math.abs(b.x+b.width/2-a.x-a.width/2);});assert.ok(delta<2);
  await page.locator('#anchor-detach').click();await page.locator('#anchor-shift').click();await page.waitForTimeout(1000);await shot('05-anchor-detach');
  assert.equal(await page.locator('#demo-bot').evaluate(b=>b.elementAnchor),null);
  await start(page,'events');await page.locator('#task-submit').click();await shot('06-task-pending');
  await page.waitForFunction(()=>document.querySelector('#event-status').textContent==='작업 완료');await page.waitForTimeout(400);await shot('07-task-success');await visibleBot();
  await page.selectOption('#task-result','error');await page.locator('#task-submit').click();await page.waitForFunction(()=>document.querySelector('#event-status').textContent.includes('작업 실패'));await shot('08-task-error');
  await page.locator('#case-events summary').click();await page.locator('#code-events').scrollIntoViewIfNeeded();await shot('09-code');
  assert.match(await page.locator('#code-events').textContent(),/function connectTaskEvents/);
  await page.locator('#case-events [data-close-code]').click();await shot('10-back-to-task');
  assert.ok(await page.locator('#task-submit').isVisible());assert.equal(await page.locator('#task-name').inputValue(),'파일 정리');
  assert.ok(await page.locator('[data-start="viewport"]').isVisible());
 });
}
test('unsupported renderer reports a recoverable UI message instead of waiting forever',async t=>{
 const page=await setup(t);await page.reload();
 await page.evaluate(()=>{const bot=document.querySelector('#demo-bot');bot.dispatchEvent(new CustomEvent('sidekick-error',{detail:{message:'WebGL unavailable',recoverable:false}}));});
 // Exercise initialization failure before the renderer can become ready.
 await page.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=function(){return null;};window.Worker=undefined;});
 await page.reload();await page.waitForSelector('#demo-status[data-error]');
 assert.match(await page.locator('#demo-status').textContent(),/WebGL/);
 await page.locator('[data-start="anchor"]').click();await page.waitForSelector('#demo-status[data-error]');
 await page.locator('#case-anchor summary').click();assert.ok((await page.locator('#code-anchor').textContent()).includes('moveToElement'));
 await page.locator('#stop-demo').click();assert.equal(await page.locator('#demo-bot').count(),0);
});
