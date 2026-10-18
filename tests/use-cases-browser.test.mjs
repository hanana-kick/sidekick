import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createAppServer } from '../scripts/serve.mjs';
let browser, server, base;
before(async () => {
  server = createAppServer(); await new Promise(resolve => server.listen(0,'127.0.0.1',resolve)); base=`http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined), headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'] });
});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
async function setup(t,viewport={width:1280,height:900}) {
  const page=await browser.newPage({viewport,reducedMotion:'reduce'});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  t.after(async()=>{await page.close();assert.deepEqual(errors,[]);});
  await page.goto(`${base}/use-cases.html`);await page.waitForSelector('[data-start="viewport"]');return page;
}
async function start(page,kind){await page.locator(`[data-start="${kind}"]`).click();await page.waitForSelector('#demo-bot[data-configured]');assert.equal(await page.locator('#demo-bot').count(),1);}
test('fixed companion stays at same viewport coordinates through scroll and exits',async t=>{
 const page=await setup(t);await start(page,'viewport');const first=await page.locator('#demo-bot').boundingBox();
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
