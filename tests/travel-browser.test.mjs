import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { createAppServer } from '../scripts/serve.mjs';
let browser,server,base;
before(async()=>{server=createAppServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:process.env.SIDEKICK_HEADED!=='1',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']})});
after(async()=>{await browser?.close();if(server)await new Promise(r=>server.close(r))});
async function fixture(t,options={}){
 const directory=process.env.SIDEKICK_SCREENSHOTS;if(directory)await mkdir(directory,{recursive:true});
 const context=await browser.newContext({viewport:{width:900,height:650},...(directory?{recordVideo:{dir:directory,size:{width:900,height:650}}}:{}),...options});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));t.after(async()=>{await context.close();assert.deepEqual(errors,[])});
 await page.route('**/flight-test.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0;background:#f8fafc"></body></html>'}));
 await page.goto(base+'/flight-test.html');await page.evaluate(async()=>{await import('./browser/sidekick.js');document.body.innerHTML='<sidekick-avatar id="flight-bot" placement="viewport" shape="ghostish" head-accessory="beret" eyes-accessory="glasses" neck-accessory="bowTie" activity="still" style="width:200px;height:200px"></sidekick-avatar>';window.bot=document.getElementById('flight-bot');await new Promise(r=>bot.ready?r():bot.addEventListener('sidekick-ready',r,{once:true}));await bot.moveTo({x:50,y:250},{duration:0});});
 return page;
}
for(const fallback of [false,true])test(`directional flight, phase visuals, retarget and baseline (${fallback?'fallback':'worker'})`,async t=>{
 const page=await fixture(t);if(fallback){await page.evaluate(()=>{bot.remove();Object.defineProperty(HTMLCanvasElement.prototype,'transferControlToOffscreen',{value:undefined,configurable:true});document.body.append(bot)});await page.waitForFunction(()=>bot.ready)}
 const initial=await page.evaluate(async()=>{window.events=[];bot.addEventListener('sidekick-move-end',e=>events.push(e.detail));const p=await bot.capturePixelsAsync();window.flight=bot.moveTo({x:600,y:150},{duration:1800});return {width:p.width,height:p.height,design:bot.design,camera:bot.camera}});
 await page.waitForFunction(()=>bot.movementState.phase==='flight'&&bot.movementState.progress>.28);
 const flying=await page.evaluate(async()=>{await bot.capturePixelsAsync();return {state:bot.movementState,diagnostics:bot.diagnostics,pose:bot.pose,activity:bot.activity}});
 assert.ok(flying.state.velocity.x>0);assert.ok(flying.state.velocity.y<0);assert.equal(flying.activity,'still');assert.ok(flying.diagnostics.travel.strength>.8);assert.ok(flying.diagnostics.travel.direction[0]>.5);assert.ok(flying.diagnostics.travel.bank<0);
 if(process.env.SIDEKICK_SCREENSHOTS)await page.screenshot({path:`${process.env.SIDEKICK_SCREENSHOTS}/flight-${fallback?'fallback':'worker'}-right.png`});
 await page.evaluate(()=>{window.second=bot.moveTo({x:80,y:380},{duration:1200})});
 assert.equal(await page.evaluate(async()=>(await flight).finished),false);
 await page.waitForFunction(()=>bot.movementState.phase==='flight'&&bot.movementState.progress>.35);
 assert.ok(await page.evaluate(()=>bot.movementState.velocity.x<0));
 if(process.env.SIDEKICK_SCREENSHOTS)await page.screenshot({path:`${process.env.SIDEKICK_SCREENSHOTS}/flight-${fallback?'fallback':'worker'}-left.png`});
 const final=await page.evaluate(async()=>{const result=await second;const pixels=await bot.capturePixelsAsync();return {result,state:bot.movementState,design:bot.design,camera:bot.camera,width:pixels.width,height:pixels.height,events}});
 assert.equal(final.result.finished,true);assert.equal(final.state.phase,'idle');assert.deepEqual(final.design,initial.design);assert.deepEqual(final.camera,initial.camera);assert.deepEqual([final.width,final.height],[initial.width,initial.height]);assert.equal(final.events.length,2);
});
test('stopping travel freezes position, settles and does not restore an expired activity',async t=>{
 const page=await fixture(t);const result=await page.evaluate(async()=>{const playing=bot.play('thinking',{duration:150});const moving=bot.moveTo({x:600,y:200},{duration:1200});await new Promise(r=>setTimeout(r,400));bot.cancelMove();const stopped=bot.position;const phase=bot.movementState.phase;await new Promise(r=>setTimeout(r,60));const during=bot.position;const result=await moving;await playing;await bot.capturePixelsAsync();return {stopped,during,end:bot.position,phase,result,activity:bot.activity,state:bot.movementState}});
 assert.equal(result.phase,'settling');assert.deepEqual(result.stopped,result.during);assert.deepEqual(result.stopped,result.end);assert.equal(result.result.finished,false);assert.equal(result.state.phase,'idle');assert.equal(result.activity,'idle');
});
test('reduced motion completes without travel pose or residual rAF',async t=>{const page=await fixture(t,{reducedMotion:'reduce'});const result=await page.evaluate(async()=>({result:await bot.moveTo({x:400,y:200},{duration:1200}),state:bot.movementState}));assert.equal(result.result.finished,true);assert.equal(result.state.phase,'idle');assert.deepEqual(result.result.position,{x:400,y:200})});
test('flight preserves a persistent activity and current expression',async t=>{
 const page=await fixture(t);const result=await page.evaluate(async()=>{const playing=bot.play('thinking');await bot.setExpression('both','smile',{duration:0});const before=bot.design.eyes;await bot.moveTo({x:400,y:200},{duration:350});const activity=bot.activity,after=bot.design.eyes;bot.stop();await playing;return {activity,before,after}});
 assert.equal(result.activity,'thinking');assert.deepEqual(result.after,result.before);
});
