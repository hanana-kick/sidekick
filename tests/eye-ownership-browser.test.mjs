import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { createAppServer } from '../scripts/serve.mjs';
for (const fallback of [false,true]) test(`explicit eye controls remain visible during emotion (${fallback?'main':'worker'})`,async()=>{
 const server=createAppServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(fallback)await page.addInitScript(()=>Object.defineProperty(HTMLCanvasElement.prototype,'transferControlToOffscreen',{value:undefined,configurable:true}));
  await page.route('**/eye-test.html',r=>r.fulfill({contentType:'text/html',body:'<sidekick-avatar id="bot" paused activity="still" tracking-mode="off" style="width:300px;height:300px;display:block"></sidekick-avatar>'}));
  await page.goto(`http://127.0.0.1:${server.address().port}/eye-test.html`);
  const result=await page.evaluate(async()=>{
   await import('./browser/sidekick.js');const bot=document.querySelector('#bot');await new Promise(r=>bot.ready?r():bot.addEventListener('sidekick-ready',r,{once:true}));
   const pixels=async()=>Array.from((await bot.capturePixelsAsync()).pixels),same=(a,b)=>a.every((v,i)=>v===b[i]);const results=[];
   for(const emotion of ['neutral','happy','sad','curious','surprised','concerned','excited']){
    await bot.setExpression('both','neutral',{duration:0});bot.setEmotion(emotion);const baseline=await pixels();
    for(const side of ['left','right','both']){
     bot.setEmotion(emotion);await pixels();await bot.setExpression(side,'blink',{duration:0});const closed=await pixels();
     await bot.setExpression(side,'smile',{duration:0});const smiling=await pixels();await bot.setExpression(side,'neutral',{duration:0});const open=await pixels();
     results.push({emotion,side,changes:!same(closed,smiling)&&!same(smiling,open)&&!same(closed,open)});
    }
    bot.setEmotion(emotion);const reclaimed=await pixels();results.push({emotion,reclaimed:same(baseline,reclaimed)});
   }
   bot.setEmotion('happy');await pixels();await bot.setExpression('left','blink',{duration:0});const manual=await pixels();
   const reaction=bot.reactTo('surprised',{duration:20});await bot.setExpression('left','blink',{duration:0});await reaction;const after=await pixels();
   bot.setEmotion('happy');await bot.setExpression('left','blink',{duration:0});const expected=await pixels();
   return {results,reactionPreserves:same(after,expected),backend:bot.diagnostics.backend};
  });
  assert.equal(result.backend,fallback?'main':'worker');for(const item of result.results)assert.ok(item.changes??item.reclaimed,JSON.stringify(item));assert.ok(result.reactionPreserves);assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
