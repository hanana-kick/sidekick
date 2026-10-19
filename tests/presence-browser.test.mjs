import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { createAppServer } from '../scripts/serve.mjs';
let browser,server,base;
before(async()=>{server=createAppServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:process.env.SIDEKICK_HEADED!=='1',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});});
after(async()=>{await browser?.close();if(server)await new Promise(r=>server.close(r));});
async function pageFor(t,options={}){const page=await browser.newPage({ locale: 'ko-KR',viewport:{width:900,height:700},...options});const errors=[];page.on('pageerror',e=>errors.push(e.message));t.after(async()=>{await page.close();assert.deepEqual(errors,[]);});await page.route('**/presence-test',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0"><script type="module" src="/browser/sidekick.js"></script><sidekick-avatar id="presence-bot" placement="viewport" style="width:180px;height:200px" activity="speaking"></sidekick-avatar></body></html>'}));await page.goto(`${base}/presence-test`);await page.waitForFunction(()=>document.querySelector('sidekick-avatar')?.ready);return page;}
for(const reducedMotion of ['no-preference','reduce'])test(`natural entrance/exit and hidden resource suspension (${reducedMotion})`,async t=>{
 const page=await pageFor(t,{reducedMotion});
 const result=await page.evaluate(async()=>{
  const bot=document.querySelector('sidekick-avatar'),canvas=bot.shadowRoot.querySelector('canvas');const design=JSON.stringify(bot.design),tracking=bot.trackingMode,activity=bot.activity,events=[];
  bot.addEventListener('sidekick-enter-end',e=>events.push(['enter',e.detail.finished]));bot.addEventListener('sidekick-exit-end',e=>events.push(['exit',e.detail.finished]));
  const entry=await bot.enter({x:200,y:180},{from:'left'});const shown=bot.getBoundingClientRect().toJSON();
  const exit=await bot.exit({to:'right'});const outside=bot.getBoundingClientRect().toJSON(),hidden=getComputedStyle(bot).visibility;
  await new Promise(r=>setTimeout(r,100));const before=bot.diagnostics.frames;await new Promise(r=>setTimeout(r,180));const after=bot.diagnostics.frames,running=bot.diagnostics.running;
  const reentry=await bot.enter({x:50,y:80},{from:'top'});return{entry,exit,reentry,shown,outside,hidden,before,after,running,sameCanvas:canvas===bot.shadowRoot.querySelector('canvas'),design:design===JSON.stringify(bot.design),tracking:tracking===bot.trackingMode,activity:activity===bot.activity,visibility:getComputedStyle(bot).visibility,events};
 });
 assert.equal(result.entry.finished,true);assert.equal(result.shown.x,200);assert.equal(result.shown.y,180);assert.equal(result.exit.presence,'hidden');assert.ok(result.outside.left>=900);assert.equal(result.hidden,'hidden');assert.equal(result.after,result.before);assert.equal(result.running,false);assert.equal(result.reentry.finished,true);assert.equal(result.visibility,'visible');assert.ok(result.sameCanvas&&result.design&&result.tracking&&result.activity);assert.deepEqual(result.events,[['enter',true],['exit',true],['enter',true]]);
});
test('presence retarget, normal move interruption, cancellation and disconnect settle once',async t=>{
 const page=await pageFor(t);
 const result=await page.evaluate(async()=>{
  const bot=document.querySelector('sidekick-avatar');await bot.moveTo({x:300,y:200},{duration:0});const events=[];bot.addEventListener('sidekick-exit-end',e=>events.push(e.detail.finished));
  const exit=bot.exit({to:'right'});await new Promise(r=>setTimeout(r,100));const before=bot.position;const entry=bot.enter({x:100,y:100},{from:'left'});const after=bot.position;const exitResult=await exit;const entryResult=await entry;
  const second=bot.exit({to:'bottom'});await new Promise(r=>setTimeout(r,70));const moved=bot.moveTo({x:150,y:140});const secondResult=await second;await moved;
  const third=bot.exit({to:'left'});await new Promise(r=>setTimeout(r,70));bot.cancelMove();const cancelled=await third;
  const fourth=bot.exit({to:'top'});bot.remove();const detached=await fourth;return{before,after,exitResult,entryResult,secondResult,cancelled,detached,events};
 });
 assert.ok(Math.hypot(result.after.x-result.before.x,result.after.y-result.before.y)<5);assert.equal(result.exitResult.finished,false);assert.equal(result.entryResult.finished,true);assert.equal(result.secondResult.finished,false);assert.equal(result.cancelled.finished,false);assert.equal(result.detached.finished,false);assert.deepEqual(result.events,[false,false,false,false]);
});
test('viewport expansion while exiting recomputes fully offscreen destination',async t=>{
 const page=await pageFor(t);await page.evaluate(()=>{window.presenceExit=document.querySelector('sidekick-avatar').exit({to:'right'});});await page.waitForTimeout(100);await page.setViewportSize({width:1200,height:700});const result=await page.evaluate(async()=>{const result=await window.presenceExit;return{result,left:document.querySelector('sidekick-avatar').getBoundingClientRect().left};});assert.equal(result.result.finished,true);assert.ok(result.left>=1200);
});
test('invalid API values cannot interrupt an active flight',async t=>{
 const page=await pageFor(t,{reducedMotion:'reduce'});const result=await page.evaluate(async()=>{const bot=document.querySelector('sidekick-avatar');await bot.exit();const before=bot.presenceState,errors=[];for(const fn of[()=>bot.enter({x:1,y:2},{from:'bad'}),()=>bot.exit({to:'left',unexpected:true}),()=>bot.moveTo({x:NaN,y:0})])try{fn();}catch(e){errors.push(e.message);}return{before,after:bot.presenceState,errors};});assert.equal(result.before,'hidden');assert.equal(result.after,'hidden');assert.equal(result.errors.length,3);
});
test('changing placement ends presence flight instead of restarting it in inline space',async t=>{
 const page=await pageFor(t);const result=await page.evaluate(async()=>{const bot=document.querySelector('sidekick-avatar');const flight=bot.exit({to:'right'});await new Promise(r=>setTimeout(r,60));bot.placement='inline';const ended=await flight;await new Promise(r=>setTimeout(r,80));return{ended,placement:bot.placement,phase:bot.movementState.phase,presence:bot.presenceState};});assert.equal(result.ended.finished,false);assert.equal(result.placement,'inline');assert.equal(result.phase,'idle');assert.equal(result.presence,'visible');
});
test('presence completion listener can start entry while outer cancelMove stops only old request',async t=>{
 const page=await pageFor(t);const result=await page.evaluate(async()=>{const bot=document.querySelector('sidekick-avatar');await bot.moveTo({x:200,y:200},{duration:0});let next;bot.addEventListener('sidekick-exit-end',e=>{if(!e.detail.finished)next=bot.enter({x:100,y:120},{from:'top'});},{once:true});const old=bot.exit();await new Promise(r=>setTimeout(r,80));bot.cancelMove();return{old:await old,next:await next};});assert.equal(result.old.finished,false);assert.equal(result.next.finished,true);assert.deepEqual(result.next.position,{x:100,y:120});
});
