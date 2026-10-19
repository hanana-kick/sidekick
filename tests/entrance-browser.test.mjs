import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createAppServer } from '../scripts/serve.mjs';
let browser,server,base;
// DOMRect uses browser layout precision; viewport/local conversion may differ by tiny fractions of a CSS pixel.
function assertPoint(actual, expected) { for (const axis of ['x','y']) assert.ok(Math.abs(actual[axis]-expected[axis]) < .001, `${axis}: ${actual[axis]} vs ${expected[axis]}`); }
before(async()=>{server=createAppServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:process.env.SIDEKICK_HEADED!=='1',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});});
after(async()=>{await browser?.close();if(server)await new Promise(r=>server.close(r));});
async function pageFor(t,{source='element',edge='right',worker=true,reducedMotion='no-preference'}={}) {
 const page=await browser.newPage({viewport:{width:900,height:700},reducedMotion});t.after(()=>page.close());
 if(!worker)await page.addInitScript(()=>{HTMLCanvasElement.prototype.transferControlToOffscreen=undefined;});
 const config=source==='element'?{source,target:'#card',direction:edge}:{source,edge,at:.25,inset:32};
 await page.route('**/entrance-test',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><body style="margin:0;background:white"><div id="card" style="position:absolute;left:300px;top:220px;width:260px;height:260px;background:#202020"></div><sidekick-avatar id="bot" shape="heart" placement="viewport" tracking-mode="off" move-max-speed="80" entrance='${JSON.stringify(config)}' style="width:140px;height:140px"></sidekick-avatar><script>window.samples=[];window.ends=[];const b=document.querySelector('#bot');b.addEventListener('sidekick-enter-end',e=>ends.push(e.detail));function sample(){const c=b.shadowRoot?.querySelector('canvas');samples.push({ready:b.ready,hidden:c?.hidden,clip:c?.style.clipPath,x:b.position?.x,y:b.position?.y,shape:b.design?.body.shape});if(samples.length<180)requestAnimationFrame(sample)}requestAnimationFrame(sample);</script><script type="module" src="/browser/sidekick.js"></script></body></html>`}));
 await page.goto(`${base}/entrance-test`);await page.waitForFunction(()=>document.querySelector('#bot')?.ready);return page;
}
for(const worker of [false,true]) for(const edge of ['left','right','top','bottom'])test(`declarative ${edge} opaque-card entrance progressively reveals (${worker?'worker':'main'})`,async t=>{
 const page=await pageFor(t,{worker,edge});
 if(process.env.SIDEKICK_SCREENSHOTS){await mkdir(process.env.SIDEKICK_SCREENSHOTS,{recursive:true});await page.screenshot({path:`${process.env.SIDEKICK_SCREENSHOTS}/entrance-${edge}-${worker?'worker':'main'}-start.png`});await page.waitForFunction(edge=>{const b=bot.getBoundingClientRect(),c=card.getBoundingClientRect();const center=edge==='left'||edge==='right'?b.left+b.width/2:b.top+b.height/2;const boundary=c[edge];return Math.abs(center-boundary)<12;},edge);await page.screenshot({path:`${process.env.SIDEKICK_SCREENSHOTS}/entrance-${edge}-${worker?'worker':'main'}-partial.png`});}
 await page.waitForFunction(()=>ends.length===1);const r=await page.evaluate(()=>({samples,ends,clip:bot.shadowRoot.querySelector('canvas').style.clipPath,targetStyle:card.getAttribute('style'),position:bot.position,backend:bot.diagnostics.backend}));
 if(process.env.SIDEKICK_SCREENSHOTS){await page.screenshot({path:`${process.env.SIDEKICK_SCREENSHOTS}/entrance-${edge}-${worker?'worker':'main'}-end.png`});await writeFile(`${process.env.SIDEKICK_SCREENSHOTS}/entrance-${edge}-${worker?'worker':'main'}-frames.json`,JSON.stringify(r.samples,null,2));}
 assert.equal(r.ends[0].finished,true);assert.equal(r.clip,'');assert.ok(r.samples.some(s=>s.ready&&s.clip?.startsWith('polygon')));assert.ok(r.samples.filter(s=>s.ready).every(s=>s.shape==='heart'));assert.equal(r.backend,worker?'worker':'main');assert.equal(r.targetStyle,'position:absolute;left:300px;top:220px;width:260px;height:260px;background:#202020');
 assertPoint(r.position,edge==='left'?{x:144,y:280}:edge==='right'?{x:576,y:280}:edge==='top'?{x:360,y:64}:{x:360,y:496});
});
test('same declaration does not replay, null cancels, readd starts from source',async t=>{
 const page=await pageFor(t);const r=await page.evaluate(async()=>{const b=bot,c=b.shadowRoot.querySelector('canvas');b.entrance=null;const stopped=b.movementState.phase,clip=c.style.clipPath;const v={source:'element',target:'#card',direction:'left'};b.entrance=v;const start=b.position;b.entrance={...v};const same=b.position;return{stopped,clip,start,same};});assert.equal(r.stopped,'idle');assert.equal(r.clip,'');assertPoint(r.start,{x:300,y:280});assert.deepEqual(r.same,r.start);
});
test('viewport source declares orthogonal fraction and final inset',async t=>{
 const page=await pageFor(t,{source:'viewport',edge:'bottom'});await page.waitForFunction(()=>ends.length===1);const r=await page.evaluate(()=>({position:bot.position,samples}));assertPoint(r.position,{x:190,y:528});assert.ok(r.samples.some(s=>s.ready&&s.y>700));
});
test('reduced motion exposes final configured state without a stranded mask',async t=>{
 const page=await pageFor(t,{reducedMotion:'reduce'});await page.waitForFunction(()=>ends.length===1);const r=await page.evaluate(()=>({position:bot.position,clip:bot.shadowRoot.querySelector('canvas').style.clipPath}));assertPoint(r.position,{x:576,y:280});assert.equal(r.clip,'');
});
test('target removal cancels safely and reports the declaration error',async t=>{
 const page=await pageFor(t);const r=await page.evaluate(async()=>{const errors=[];bot.addEventListener('sidekick-error',e=>errors.push(e.detail));card.remove();await new Promise(r=>setTimeout(r,100));return{errors,clip:bot.shadowRoot.querySelector('canvas').style.clipPath,ends};});assert.equal(r.clip,'');assert.ok(r.errors.some(e=>e.message.includes('removed')));assert.equal(r.ends[0].finished,false);
});
test('target translation updates mask and destination without replacing target styles',async t=>{
 const page=await pageFor(t);await page.evaluate(()=>{card.style.transform='translate(20px, 20px)';});await page.waitForFunction(()=>ends.length===1);const r=await page.evaluate(()=>({position:bot.position,transform:card.style.transform,clip:bot.shadowRoot.querySelector('canvas').style.clipPath}));assertPoint(r.position,{x:596,y:300});assert.equal(r.transform,'translate(20px, 20px)');assert.equal(r.clip,'');
});
test('disconnect and cancellation listeners cannot resurrect a stale mask',async t=>{
 const page=await pageFor(t);const r=await page.evaluate(()=>{const b=bot;b.addEventListener('sidekick-enter-end',()=>{b.entrance=null;b.remove();},{once:true});b.entrance={source:'element',target:'#card',direction:'left'};return{connected:b.isConnected,clip:b.shadowRoot.querySelector('canvas').style.clipPath};});assert.equal(r.connected,false);assert.equal(r.clip,'');
});
