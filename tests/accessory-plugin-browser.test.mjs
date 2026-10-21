/** Real worker/local and Canvas/WebGL asset transport acceptance. */
import test, {before,after} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {createAppServer} from '../scripts/serve.mjs';
let browser,server,origin;
before(async()=>{
  server=createAppServer(); await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
});
after(async()=>{await browser?.close(); if(server)await new Promise(resolve=>server.close(resolve));});
for(const local of [false,true])for(const canvas of [false,true])test(`plugin mesh renders and survives reconnect: local=${local}, canvas=${canvas}`,async t=>{
  const page=await browser.newPage();t.after(()=>page.close());
  await page.addInitScript(({local,canvas})=>{
    if(local)Object.defineProperty(window,'Worker',{value:undefined});
    if(canvas)for(const ctor of [HTMLCanvasElement,globalThis.OffscreenCanvas].filter(Boolean)){
      const original=ctor.prototype.getContext;ctor.prototype.getContext=function(kind,...args){return kind==='webgl2'?null:original.call(this,kind,...args);};
    }
  },{local,canvas});
  if(canvas)await page.route('**/src/runtime/render-worker.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:`const get=OffscreenCanvas.prototype.getContext;OffscreenCanvas.prototype.getContext=function(k,...a){return k==='webgl2'?null:get.call(this,k,...a)};\n${await response.text()}`});});
  await page.route(`${origin}/plugin-check.html`,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><sidekick-avatar id="bot" activity="still" tracking-mode="off" style="width:160px;height:160px"></sidekick-avatar><script type="module" src="/src/auto.js"></script>'}));
  await page.goto(`${origin}/plugin-check.html`);await page.waitForFunction(()=>document.querySelector('#bot')?.ready);
  const result=await page.evaluate(async()=>{
    const api=await import('/src/auto.js'),bot=document.querySelector('#bot');
    let loads=0;const registry=new api.AccessoryPluginRegistry();
    registry.registerLazy('example/triangle',async()=>{loads++;return{apiVersion:1,id:'example/triangle',slots:['eyes'],createMesh:()=>({vertices:new Float32Array([-.15,-.15,.03,0,0,1,.15,-.15,.03,0,0,1,0,.15,.03,0,0,1]),indices:new Uint16Array([0,1,2])})};});
    const count=async()=>{const image=await bot.capturePixelsAsync();let n=0;for(let i=0;i<image.pixels.length;i+=4)if(image.pixels[i]>240&&image.pixels[i+1]<10&&image.pixels[i+2]>240)n++;return n;};
    const before=await count();await bot.equipPluginAccessory(registry,'example/triangle',{slot:'eyes',color:'#ff00ff'});const after=await count();
    bot.setPartAnimation({duration:2,tracks:[{target:{accessory:'example/triangle:eyes'},channel:'position',keyframes:[{time:0,value:[0,0,0]},{time:2,value:[.2,0,0]}]}]});
    bot.pausePartAnimation();bot.seekPartAnimation(.5);const seekA=Array.from((await bot.capturePixelsAsync()).pixels);bot.seekPartAnimation(1.5);await bot.capturePixelsAsync();bot.seekPartAnimation(.5);const seekB=Array.from((await bot.capturePixelsAsync()).pixels);const deterministic=seekA.every((v,i)=>v===seekB[i]);bot.clearPartAnimation();
    const backend=bot.diagnostics.backend,graphics=bot.diagnostics.graphics;bot.remove();document.body.append(bot);
    await new Promise((resolve,reject)=>{let tries=0;const poll=()=>bot.ready?resolve():++tries>100?reject(new Error('Reconnect timeout')):setTimeout(poll,20);poll();});
    const reconnected=await count();bot.removePluginAccessory('eyes');const removed=await count();return{before,after,reconnected,removed,loads,backend,graphics,deterministic};
  });
  assert.equal(result.deterministic,true);assert.equal(result.before,0);assert.ok(result.after>0);assert.equal(result.reconnected,result.after);assert.equal(result.removed,0);assert.equal(result.loads,1);
  assert.equal(result.backend,local?'main':'worker');assert.equal(result.graphics,canvas?'canvas2d':'webgl2');
});
