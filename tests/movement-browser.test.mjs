import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { createAppServer } from '../scripts/serve.mjs';
import { apiDemoFrame } from './helpers/api-demo-frame.mjs';
let browser, server, base;
before(async () => {
  server = createAppServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: process.env.SIDEKICK_HEADED !== '1', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });
// Movement objects, targets and coordinates belong to the child; controls stay in the shell.
async function pageFor(t, options = {}) {
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 900, height: 800 }, ...options });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  t.after(async () => { await page.close(); assert.deepEqual(errors, []); });
  await page.goto(`${base}/api-playground.html`); await apiDemoFrame(page);
  if (process.env.SIDEKICK_SCREENSHOTS) { await mkdir(process.env.SIDEKICK_SCREENSHOTS, { recursive: true }); await page.screenshot({ path: `${process.env.SIDEKICK_SCREENSHOTS}/movement-playground.png` }); }
  await page.locator('#bot-tools-launcher').click();
  return page;
}
for (const reducedMotion of ['no-preference', 'reduce']) test(`bounded canvas movement and interrupt semantics (${reducedMotion})`, async t => {
  const page = await pageFor(t, { reducedMotion });
  const result = await (await apiDemoFrame(page)).evaluate(async reduced => {
    const bot = document.getElementById('bot'), canvas = bot.shadowRoot.querySelector('canvas');
    const initial = await bot.capturePixelsAsync(); const generation = bot.diagnostics.generation;
    const destination = { x: Math.min(200, innerWidth - bot.offsetWidth), y: Math.min(300, innerHeight - bot.offsetHeight) };
    const events = []; bot.addEventListener('sidekick-move-end', event => events.push(event.detail));
    const first = bot.moveTo({ x: 500, y: 400 }, { duration: 500 });
    await new Promise(resolve => setTimeout(resolve, 70));
    const current = bot.position;
    const second = bot.moveTo(destination, { duration: 100 });
    const firstResult = await first, secondResult = await second;
    const final = await bot.capturePixelsAsync(); const rect = bot.getBoundingClientRect();
    return { firstResult, secondResult, current, events, destination, rect: { x: rect.x, y: rect.y }, size: [initial.width, initial.height, final.width, final.height], generation: [generation, bot.diagnostics.generation], sameCanvas: canvas === bot.shadowRoot.querySelector('canvas'), bodyOrientation: bot.bodyOrientation, zoom: bot.zoom, color: bot.design.body.color, reduced };
  }, reducedMotion === 'reduce');
  assert.equal(result.firstResult.finished, reducedMotion === 'reduce'); assert.equal(result.secondResult.finished, true);
  assert.deepEqual(result.rect, result.destination); assert.deepEqual(result.size.slice(0, 2), result.size.slice(2)); assert.equal(result.sameCanvas, true); assert.equal(result.generation[0], result.generation[1]);
  assert.equal(result.events.length, 2); assert.equal(result.color, '#ffcc37');
});

test('viewport resize clamps, scrolling keeps fixed coordinates, pointer passes through', async t => {
  const page = await pageFor(t, { reducedMotion: 'reduce' });
  // Close shell controls while testing pointer hit testing inside the demo.
  await page.locator('#bot-tools-close').click();
  await (await apiDemoFrame(page)).evaluate(async () => { const bot = document.getElementById('bot'); await bot.moveTo({ x: 10000, y: 10000 }); });
  await page.setViewportSize({ width: 390, height: 700 });
  await (await apiDemoFrame(page)).waitForFunction(() => {
    const bot = document.getElementById('bot');
    return bot.position.x <= innerWidth - bot.offsetWidth && bot.position.y <= innerHeight - bot.offsetHeight;
  });
  const result = await (await apiDemoFrame(page)).evaluate(async () => {
    const bot = document.getElementById('bot'), clamped = bot.position;
    const viewport = { width: innerWidth, height: innerHeight };
    const max = { x: innerWidth - bot.offsetWidth, y: innerHeight - bot.offsetHeight };
    await bot.moveTo({ x: 10, y: 240 }); window.scrollTo(0, 200);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const rect = bot.getBoundingClientRect(), point = { x: rect.left + 20, y: rect.top + 20 };
    const target = document.elementFromPoint(point.x, point.y), nonePointerEvents = getComputedStyle(bot).pointerEvents;
    bot.interaction = 'box';
    const interactiveTarget = document.elementFromPoint(point.x, point.y), boxPointerEvents = getComputedStyle(bot).pointerEvents;
    bot.interaction = 'none';
    const restoredTarget = document.elementFromPoint(point.x, point.y);
    return { clamped, max, viewport, scrollY, rect: { x: rect.x, y: rect.y }, passThrough: !!target && target !== bot,
      boxTarget: interactiveTarget === bot, restoredPassThrough: restoredTarget === target,
      nonePointerEvents, boxPointerEvents, width: bot.offsetWidth };
  });
  assert.deepEqual(result.clamped, result.max);
  assert.ok(result.viewport.width < 390 && result.viewport.height < 700, 'Bounds must come from the child viewport, not the shell');
  assert.ok(result.max.x > 0 && result.max.y >= 240, 'The resized demo must still fit the test avatar and hit-test point');
  assert.ok(result.scrollY > 0, 'The fixed-position assertion must include actual document scrolling');
  assert.deepEqual(result.rect, { x: 10, y: 240 });
  assert.equal(result.passThrough, true); assert.equal(result.boxTarget, true); assert.equal(result.restoredPassThrough, true);
  assert.equal(result.nonePointerEvents, 'none'); assert.equal(result.boxPointerEvents, 'auto'); assert.equal(result.width, 180);
});

test('actual worker asset swap, pause, play/stop and disconnection settle commands', async t => {
  const page = await pageFor(t);
  const result = await (await apiDemoFrame(page)).evaluate(async () => {
    const bot = document.getElementById('bot');
    const { createAccessory } = await import('./browser/sidekick.js');
    const transition = await bot.transitionTo({ shape: 'heart', expression: 'smile', accessories: [createAccessory('halo')] }, { duration: 120 });
    const design = bot.design; const pixels = await bot.capturePixelsAsync();
    const loop = bot.play('speaking'); bot.stop(); const cancelledLoop = await loop;
    bot.paused = true; const immediate = await bot.moveTo({ x: 40, y: 50 }, { duration: 5000 }); bot.paused = false;
    const move = bot.moveBy({ x: 200, y: 0 }, { duration: 5000 });
    const transitioning = bot.transitionTo({ shape: 'circle', accessories: [createAccessory('beret')] }, { duration: 5000 });
    bot.remove(); const disconnected = await Promise.all([move, transitioning]);
    return { transition, design, pixels: [pixels.width, pixels.height], cancelledLoop, immediate, disconnected, animations: bot.shadowRoot.querySelector('canvas').getAnimations().length };
  });
  assert.equal(result.transition.finished, true); assert.equal(result.design.body.shape, 'heart'); assert.equal(result.design.eyes.left.weights.smile, 1); assert.equal(result.design.accessories[0].preset, 'halo');
  assert.equal(result.cancelledLoop.finished, false); assert.deepEqual(result.immediate.position, { x: 40, y: 50 }); assert.ok(result.disconnected.every(value => value.finished === false)); assert.equal(result.animations, 0);
});

for (const placement of ['viewport', 'inline']) test(`moveToElement anchors, scroll, own transform, sampling and errors (${placement})`, async t => {
 const page=await pageFor(t,{reducedMotion:'reduce'});
 const results=await (await apiDemoFrame(page)).evaluate(async placement=>{
  const bot=document.getElementById('bot');bot.placement=placement;bot.movementBounds='none';
  const target=document.createElement('div');target.style.cssText='position:absolute;left:320px;top:500px;width:260px;height:140px;transform:rotate(8deg) scale(1.1)';document.body.append(target);
  bot.style.transform='scale(.8) rotate(12deg)';
  const errors=[];
  for(const [alignX,ax] of [['left',0],['center',.5],['right',1]]) for(const [alignY,ay] of [['top',0],['center',.5],['bottom',1]]) {
   await bot.moveToElement(target,{alignX,alignY,x:13,y:-7});const b=bot.getBoundingClientRect(),r=target.getBoundingClientRect();
   errors.push(Math.abs(b.left+b.width*ax-r.left-r.width*ax-13),Math.abs(b.top+b.height*ay-r.top-r.height*ay+7));
  }
  window.scrollTo(0,100); await bot.moveToElement(target,{alignX:'center',alignY:'center'});
  const b=bot.getBoundingClientRect(),r=target.getBoundingClientRect();errors.push(Math.abs(b.left+b.width/2-r.left-r.width/2),Math.abs(b.top+b.height/2-r.top-r.height/2));
  target.style.width='360px';target.style.height='240px';
  await bot.moveToElement(target,{alignX:'right',alignY:'bottom'});
  const resizedBot=bot.getBoundingClientRect(),resizedTarget=target.getBoundingClientRect();
  errors.push(Math.abs(resizedBot.right-resizedTarget.right),Math.abs(resizedBot.bottom-resizedTarget.bottom));
  const before=bot.position;target.remove();let rejected=false;try{bot.moveToElement(target);}catch{rejected=true;}
  return {errors,rejected,before,after:bot.position};
 },placement);
 assert.ok(results.errors.every(error=>error<.1),JSON.stringify(results));assert.equal(results.rejected,true);assert.deepEqual(results.before,results.after);
});

test('moveToElement viewport bounds and retarget preserve movement semantics',async t=>{
 const page=await pageFor(t);
 const result=await (await apiDemoFrame(page)).evaluate(async()=>{
  const bot=document.getElementById('bot'),target=document.createElementNS('http://www.w3.org/2000/svg','svg');target.style.cssText='position:fixed;left:1500px;top:1500px;width:40px;height:30px';document.body.append(target);
  const first=bot.moveTo({x:600,y:400});await new Promise(resolve=>setTimeout(resolve,90));const velocity=bot.movementState.velocity;
  const second=bot.moveToElement(target,{alignX:'right',alignY:'bottom'});const after=bot.movementState.velocity;target.remove();
  return {first:await first,second:await second,velocity,after,max:{x:innerWidth-bot.offsetWidth,y:innerHeight-bot.offsetHeight}};
 });
 assert.equal(result.first.finished,false);assert.equal(result.second.finished,true);assert.deepEqual(result.second.position,result.max);// moveTo samples elapsed time since the previous RAF before retargeting.
 // Speed can increase during that interval; it must not reset or reverse.
 assert.ok(Math.hypot(result.velocity.x,result.velocity.y)>0);
 assert.ok(Math.hypot(result.after.x,result.after.y)>=Math.hypot(result.velocity.x,result.velocity.y));
 assert.ok(result.velocity.x*result.after.x+result.velocity.y*result.after.y>0);
 assert.ok(Math.abs(result.velocity.x*result.after.y-result.velocity.y*result.after.x)<1e-6);
});

for (const placement of ['viewport','inline']) test(`persistent element binding follows nested scroll, layout and transforms (${placement})`, async t => {
 const page=await pageFor(t,{reducedMotion:'reduce'});
 const result=await (await apiDemoFrame(page)).evaluate(async placement=>{
  const bot=document.getElementById('bot');bot.placement=placement;bot.movementBounds='none';
  const scroller=document.createElement('div');scroller.style.cssText='position:absolute;left:50px;top:200px;width:300px;height:180px;overflow:auto';
  scroller.innerHTML='<div style="height:700px;padding-top:200px"><div id="anchor-target" style="width:140px;height:60px"></div></div>';document.body.append(scroller);
  const target=scroller.querySelector('#anchor-target');
  const frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const error=()=>{const b=bot.getBoundingClientRect(),a=target.getBoundingClientRect();return Math.max(Math.abs(b.right-a.right-9),Math.abs(b.bottom-a.bottom+12));};
  await bot.moveToElement(target,{anchor:true,alignX:'right',alignY:'bottom',x:9,y:-12});
  const errors=[error()];scroller.scrollTop=100;await frame();errors.push(error());
  target.style.width='220px';target.style.marginLeft='37px';await frame();errors.push(error());
  target.style.transform='translate(52px,30px) rotate(12deg)';await frame();errors.push(error());
  const animation=target.animate([{transform:'translate(52px,30px)'},{transform:'translate(120px,70px)'}],{duration:180,fill:'forwards'});
  await animation.finished;await frame();errors.push(error());
  const state=bot.elementAnchor;state.x=5000;await frame();errors.push(error());
  bot.detachAnchor();const frozen=bot.position;target.style.marginTop='90px';scroller.scrollTop=150;await frame();
  const detached=bot.elementAnchor===null&&JSON.stringify(frozen)===JSON.stringify(bot.position);
  await bot.moveToElement(target,{anchor:true});bot.append(target);await frame();const reparented=bot.elementAnchor===null;
  scroller.append(target);await bot.moveToElement(target,{anchor:true});target.remove();await frame();const removed=bot.elementAnchor===null;
  scroller.remove();return {errors,detached,removed,reparented};
 },placement);
 assert.ok(result.errors.every(error=>error<.1),JSON.stringify(result));assert.ok(result.detached);assert.ok(result.removed);assert.ok(result.reparented);
});

test('binding replacement, validation atomicity and public movement/presence teardown', async t=>{
 const page=await pageFor(t,{reducedMotion:'reduce'});
 const result=await (await apiDemoFrame(page)).evaluate(async()=>{
  const bot=document.getElementById('bot');bot.movementBounds='none';
  const target=document.createElement('div');target.style.cssText='position:fixed;left:310px;top:300px;width:100px;height:100px';document.body.append(target);
  await bot.moveToElement(target,{anchor:true});
  try{bot.moveToElement(target,{anchor:'yes'});}catch{}
  const atomic=bot.elementAnchor?.target===target;
  await bot.moveBy({x:10,y:0});const by=bot.elementAnchor===null;
  await bot.moveToElement(target,{anchor:true});bot.cancelMove();const cancel=bot.elementAnchor===null;
  await bot.moveToElement(target,{anchor:true});await bot.exit({to:'right'});const exit=bot.elementAnchor===null;
  await bot.enter({x:100,y:100});await bot.moveToElement(target,{anchor:true});bot.remove();const disconnected=bot.elementAnchor===null;
  return {atomic,by,cancel,exit,disconnected};
 });assert.ok(Object.values(result).every(Boolean),JSON.stringify(result));
});

test('moving anchored target preserves one natural-flight completion', async t=>{
 const page=await pageFor(t);
 const result=await (await apiDemoFrame(page)).evaluate(async()=>{
  const bot=document.getElementById('bot');bot.movementBounds='none';await bot.moveTo({x:0,y:0},{duration:0});
  const space={x:innerWidth-bot.offsetWidth,y:innerHeight-bot.offsetHeight};
  const target=document.createElement('div');target.style.cssText=`position:fixed;left:${space.x*.9}px;top:${space.y*.8}px;width:100px;height:100px`;document.body.append(target);
  const completions=[];bot.addEventListener('sidekick-move-end',event=>completions.push(event.detail));
  const pending=bot.moveToElement(target,{anchor:true,maxSpeed:1000});await new Promise(r=>setTimeout(r,90));
  target.style.left=`${space.x*.6}px`;target.style.top=`${space.y*.6}px`;const result=await pending;
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const b=bot.getBoundingClientRect(),a=target.getBoundingClientRect();
  bot.detachAnchor();target.remove();return {result,completions,error:Math.hypot(b.left-a.left,b.top-a.top)};
 });assert.equal(result.result.finished,true);assert.equal(result.completions.length,1);assert.ok(result.error<.1,JSON.stringify(result));
});

for (const fallback of [false, true]) test(`settled anchor pursues moving targets with inertia and idles offscreen (${fallback ? 'fallback' : 'worker'})`, async t => {
 const page=await browser.newPage({ locale: 'ko-KR',viewport:{width:900,height:800},reducedMotion:'no-preference'});
 t.after(()=>page.close());
 if(fallback) await page.addInitScript(()=>{window.Worker=class{constructor(){throw new Error('test fallback');}};});
 await page.goto(`${base}/api-playground.html`);await apiDemoFrame(page);
 const result=await (await apiDemoFrame(page)).evaluate(async()=>{
  const bot=document.getElementById('bot');bot.placement='viewport';bot.movementBounds='none';bot.trackingMode='off';
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const space={x:innerWidth-bot.offsetWidth,y:innerHeight-bot.offsetHeight};
  const positions={start:space.x*.25,settled:space.x*.9,returned:space.x*.6,offscreen:innerWidth+500};
  const target=document.createElement('div');target.style.cssText=`position:fixed;left:${positions.start}px;top:${space.y*.6}px;width:100px;height:100px`;document.body.append(target);
  await bot.moveToElement(target,{anchor:true,duration:0});
  const events=[];bot.addEventListener('sidekick-move-end',e=>events.push(e.detail));
  const origin=bot.position;target.style.left=`${positions.settled}px`;
  // A wall-clock100ms can expire before the first software-GPU RAF on CI.
  // Observe an actual movement step, without weakening the inertial bound.
  await new Promise((resolve,reject)=>{const deadline=performance.now()+5000;const sample=()=>{if(bot.position.x>origin.x)resolve();else if(performance.now()>deadline)reject(new Error('Anchor pursuit did not advance on RAF'));else requestAnimationFrame(sample);};requestAnimationFrame(sample);});
  const chasing=bot.position;
  await wait(2300);const settled=bot.position;
  target.style.left=`${positions.offscreen}px`;await wait(2300);const sleeping=bot.position;
  await wait(500);const still=bot.position;
  // CSS-transform-only target reentry must wake the 4Hz observer without a scroll event.
  target.style.transform=`translateX(${positions.returned-positions.offscreen}px)`;await wait(350);const waking=bot.position;
  await wait(2500);const returned=bot.position;
  const mode=bot.diagnostics.backend;bot.detachAnchor();target.remove();
  return {origin,chasing,settled,sleeping,still,waking,returned,events,mode,positions,viewportWidth:innerWidth};
 });
 assert.equal(result.mode,fallback?'main':'worker');
 assert.ok(result.chasing.x>result.origin.x && result.chasing.x<(result.positions.start+result.positions.settled)/2,JSON.stringify(result));
 assert.ok(Math.abs(result.settled.x-result.positions.settled)<.6,JSON.stringify(result));
 assert.ok(result.sleeping.x>=result.viewportWidth && result.sleeping.x<result.positions.offscreen,JSON.stringify(result));
 assert.deepEqual(result.still,result.sleeping);
 assert.ok(result.waking.x>result.positions.returned,JSON.stringify(result));
 assert.ok(Math.abs(result.returned.x-result.positions.returned)<.6,JSON.stringify(result));assert.equal(result.events.length,0);
});
