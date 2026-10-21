/** No-WebGL regression: deny context creation explicitly in both browser realms. */
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {createAppServer} from '../scripts/serve.mjs';
import {forceCanvasForPage,closePageAfterCanvasRoutes} from './helpers/force-no-webgl.mjs';
let browser,server,origin;
before(async()=>{
 server=createAppServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox','--disable-webgl','--disable-dev-shm-usage']});
});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
for(const worker of [true,false])test(`WebGL disabled: ${worker?'worker':'no-worker main'} preserves first frame, alpha, snapshots and idle lifecycle`,async t=>{
 const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[];page.on('pageerror',error=>errors.push(error.message));t.after(()=>closePageAfterCanvasRoutes(page));
 const canvasAudit=await forceCanvasForPage(page);
 if(!worker)await page.addInitScript(()=>{window.Worker=undefined;});
 await page.route(`${origin}/canvas-fallback.html`,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><style>sidekick-avatar{display:block;width:180px;height:180px}</style><sidekick-avatar id="bot" paused activity="still" tracking-mode="off" shape="puffy" body-color="#ff0000"></sidekick-avatar><script type="module" src="/src/auto.js"></script>'}));
 await page.goto(`${origin}/canvas-fallback.html`);await page.waitForFunction(()=>document.getElementById('bot')?.ready);
 const first=await page.evaluate(async()=>{const bot=document.getElementById('bot'),p=await bot.capturePixelsAsync(),png=await bot.snapshot();return {diagnostics:bot.diagnostics,alpha:p.pixels.filter((_,i)=>i%4===3).some(Boolean),corner:p.pixels[3],pngType:png.type,pngSize:png.size};});
 await canvasAudit.assertDenied({worker});
 assert.equal(first.diagnostics.graphics,'canvas2d');assert.equal(first.diagnostics.backend,worker?'worker':'main');assert.equal(first.alpha,true);assert.equal(first.corner,0);assert.equal(first.pngType,'image/png');assert.ok(first.pngSize>100);assert.equal(first.diagnostics.running,false);
 const exercise=await page.evaluate(async()=>{const bot=document.getElementById('bot');bot.paused=false;bot.activity='celebrating';await new Promise(resolve=>setTimeout(resolve,150));const frames=bot.diagnostics.frames;bot.paused=true;await bot.capturePixelsAsync();const paused=bot.diagnostics.frames;await new Promise(resolve=>setTimeout(resolve,100));const idle=bot.diagnostics.frames;bot.style.width='900px';bot.style.height='450px';await new Promise(resolve=>setTimeout(resolve,50));const image=await bot.capturePixelsAsync();bot.remove();return {frames,paused,idle,width:image.width,height:image.height,ready:bot.ready};});
 assert.ok(exercise.frames>first.diagnostics.frames);assert.equal(exercise.idle,exercise.paused);assert.ok(Math.max(exercise.width,exercise.height)<=384);assert.ok(Math.abs(exercise.width/exercise.height-2)<.02);assert.equal(exercise.ready,false);assert.deepEqual(errors,[]);
});
