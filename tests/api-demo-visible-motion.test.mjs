import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { accessSync, constants } from 'node:fs';

import { chromium } from 'playwright-core';
import { createAppServer } from '../scripts/serve.mjs';
import { installVisibleMotionTrace } from './helpers/visible-motion-trace.mjs';


// Use a fresh owned browser with its sandbox enabled. No user profile or CDP attachment.
let browser, launcher, server, base;
before(async () => {
  server = createAppServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  launcher = await chromium.launchServer({
    executablePath: [process.env.CHROMIUM_PATH, '/opt/google/chrome/chrome', '/usr/bin/chromium'].find(path => {
      if (!path) return false;
      try { accessSync(path, constants.X_OK); return true; } catch { return false; }
    }),
    host: '127.0.0.1', headless: true, chromiumSandbox: true, ignoreDefaultArgs: true,
    args: ['--headless', '--remote-debugging-pipe', '--no-startup-window'],
  });
  browser = await chromium.connect(launcher.wsEndpoint());
});
after(async () => {
  await browser?.close();
  await launcher?.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

async function demo(t,site,viewport={width:1100,height:720}){
 const page=await browser.newPage({viewport,reducedMotion:'no-preference'});t.after(()=>page.close());
 await page.goto(`${base}/api-demo.html?site=${site}&lang=en`);
 const initial=await page.evaluate(async()=>{
  const api=await window.sidekickDemoReady,bot=api.bot;document.body.append(bot);
  await new Promise(resolve=>bot.ready?resolve():bot.addEventListener('sidekick-ready',resolve,{once:true}));
  // A desktop-sized seed is not a valid mobile precondition: innerWidth can
  // include a classic scrollbar while visualViewport.width excludes it.
  const v=visualViewport,viewport={left:v?.offsetLeft||0,top:v?.offsetTop||0,width:v?.width||innerWidth,height:v?.height||innerHeight};
  await api.moveTo({x:viewport.left+Math.max(0,Math.min(440,viewport.width-bot.offsetWidth-16)),y:viewport.top+Math.max(0,Math.min(420,viewport.height-bot.offsetHeight-16))},{duration:0,travel:'none'});
  bot.setAttribute('data-configured','');const r=bot.getBoundingClientRect();
  return {viewport,host:{left:r.left,top:r.top,right:r.right,bottom:r.bottom},anchor:bot.elementAnchor!==null};
 });
 assert.equal(initial.anchor,false,'fixture starts with no autonomous anchor');
 assert.ok(initial.host.left>=initial.viewport.left&&initial.host.top>=initial.viewport.top&&initial.host.right<=initial.viewport.left+initial.viewport.width&&initial.host.bottom<=initial.viewport.top+initial.viewport.height,`fixture must start fully inside the actual viewport before scenario ownership: ${JSON.stringify(initial)}`);
 await page.evaluate(async()=>{(await window.sidekickDemoReady).startScenarios();});
 return page;
}
async function assertContinuous(page,target){
 await page.waitForFunction(target=>window.visibleMotionTrace.calls.some(c=>c.target.includes(target)&&c.result?.finished),target);
 const trace=await page.evaluate(()=>window.visibleMotionTrace.stop());
 const relevant=trace.calls.filter(c=>c.target.includes(target));assert.ok(relevant.length,`branch ${target} was exercised`);
 assert.ok(relevant.some(c=>c.visible),`branch ${target} was actually visible`);
 // Synchronous displacement is immune to slow/stalled CI frames. Frame samples
 // remain diagnostic only: a long rAF interval is not itself a teleport.
 for(const call of relevant.filter(c=>c.visible)){assert.ok(call.synchronousStep<2,`visible synchronous public-position teleport: ${JSON.stringify({call,frames:trace.rows.slice(-8)})}`);assert.ok(call.synchronousHostStep<2,`visible synchronous rendered-host teleport: ${JSON.stringify({call,frames:trace.rows.slice(-8)})}`);}
 assert.ok(relevant.some(c=>c.duration>0),`normal-motion visible path must request interpolation: ${JSON.stringify(relevant)}`);
 return trace;
}

test('normal motion community dismissal returns home without a visible snap',{timeout:45000},async t=>{
 const page=await demo(t,'community');
 await page.evaluate(()=>scrollTo({top:40,behavior:'instant'}));
 await page.locator('[data-sidekick-speech] .message').waitFor();
 await page.evaluate(installVisibleMotionTrace);
 await page.locator('[data-sidekick-speech] button').click();
 await assertContinuous(page,'#th-companion-home');
});

test('visible known shop match retarget interpolates rather than teleporting',{timeout:45000},async t=>{
 const page=await demo(t,'shop');
 await page.locator('[data-product="0"] .muse-price').evaluate(price=>{price.scrollIntoView({block:'end',behavior:'instant'});scrollBy({top:32,behavior:'instant'});});
 await page.locator('[data-sidekick-speech] .message').waitFor();
 // Public manual-override lifecycle: preserve known-match memory, leave the bot
 // fully visible, then let the scenario take control again. This exercises the
 // quiet-known branch while the companion remains visibly present.
 await page.evaluate(async()=>{const api=await window.sidekickDemoReady;api.pauseScenarios(true);const p=api.bot.position;await api.moveTo({x:p.x>innerWidth/2?40:innerWidth-150,y:Math.min(innerHeight-140,Math.max(40,p.y))},{duration:550,travel:'none'});});
 await page.evaluate(installVisibleMotionTrace);
 await page.evaluate(async()=>{(await window.sidekickDemoReady).pauseScenarios(false)});
 await assertContinuous(page,'product:0');
});

// Drive genuine document scroll events, including an uninterrupted reversal.
// Trace rAFs independently sample public coordinates, actual rendered bounds,
// opacity and physical derivatives rather than inferring visibility from state.
async function scrollWithReversal(page,frames=90){
 return page.evaluate(async count=>{
  const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
  const trace=window.visibleMotionTrace;
  trace.mark('scroll-down');
  for(let i=0;i<count;i++){scrollBy({top:8,behavior:'instant'});await frame();}
  trace.mark('scroll-up');
  for(let i=0;i<count;i++){scrollBy({top:-8,behavior:'instant'});await frame();}
  trace.mark('scroll-stop');
  await frame();await frame();
  return trace.stop();
 },frames);
}

function assertFollowingTrace(trace,site){
 const following=trace.calls.filter(call=>call.target==='[data-companion-follow]');
 const scrolling=trace.rows.filter(row=>row.stage==='scroll-down'||row.stage==='scroll-up');
 const owned=scrolling.filter(row=>row.anchor?.target==='[data-companion-follow]');
 const debug=()=>JSON.stringify({site,calls:trace.calls,marks:trace.marks,frames:trace.rows.slice(-12)});
 const speedLimit=Math.max(700,...following.map(call=>call.beforeMovement?.speed||0));
 const accelerationLimit=Math.max(2200,...following.map(call=>Math.hypot(call.beforeMovement?.acceleration.x||0,call.beforeMovement?.acceleration.y||0)));
 assert.ok(following.length>0,`scrolling must start live pursuit: ${debug()}`);
 assert.ok(scrolling.filter(row=>Math.abs(row.scrollDelta)>2).length>=40,'exercise sustained real document scrolling, not synthetic events at a boundary');
 // A CI frame stalled for the classifier's full quiet interval legitimately
 // ends a gesture. Otherwise, all destination updates must share one command.
 const longGaps=scrolling.filter(row=>row.dt>=180).length;
 assert.ok(following.length<=1+longGaps,`scroll samples must not restart movement: ${debug()}`);
 for(const call of following){
  assert.equal(call.travel,'natural');
  assert.ok(call.duration>0,'normal motion must not snap');
  assert.ok(call.visible&&call.opacity>.98,`no hide-before-relocate shortcut: ${debug()}`);
  assert.ok(call.synchronousStep<2&&call.synchronousHostStep<2,`no synchronous public/host teleport: ${debug()}`);
 }
 assert.ok(owned.length>=40,`the live anchor must remain owned throughout scrolling: ${debug()}`);
 for(const row of owned){
  assert.ok(row.visible&&row.opacity>.98,`companion vanished or faded while scrolling: ${debug()}`);
  assert.notEqual(row.presenceState,'hidden');
  assert.notEqual(row.presenceState,'exiting');
  const v=row.viewport;
  assert.ok(row.host.x>=v.left-1&&row.host.y>=v.top-1&&row.host.right<=v.left+v.width+1&&row.host.bottom<=v.top+v.height+1,`rendered host left the visible viewport: ${debug()}`);
  assert.ok(Number.isFinite(row.movement.speed)&&row.movement.speed<=speedLimit+5,`physical speed must remain bounded: ${debug()}`);
  assert.ok(Math.hypot(row.movement.acceleration.x,row.movement.acceleration.y)<=accelerationLimit+1,`physical acceleration must remain bounded: ${debug()}`);
 }
 // Renderer and trace callbacks may run only a few milliseconds apart after
 // a stalled frame. Compare motion across >=100ms windows with one-frame
 // scheduling allowance; never divide a late integrated step by a tiny dt.
 for(let i=1;i<owned.length;i++){
  let j=i-1;while(j>0&&owned[i].t-owned[j].t<100)j--;
  const seconds=(owned[i].t-owned[j].t)/1000;if(seconds<.1)continue;
  const allowance=speedLimit*(seconds+1/30)+2;
  assert.ok(Math.hypot(owned[i].x-owned[j].x,owned[i].y-owned[j].y)<=allowance,`time-normalized public-coordinate jump: ${debug()}`);
  assert.ok(Math.hypot(owned[i].host.x-owned[j].host.x,owned[i].host.y-owned[j].host.y)<=allowance,`time-normalized rendered-host jump: ${debug()}`);
 }
 const moving=owned.filter(row=>Math.abs(row.scrollDelta)>2&&row.movement.speed>5);
 assert.ok(moving.length>=6,`locomotion must occur during scrolling, not only after it stops: ${debug()}`);
 assert.ok(owned.reduce((sum,row)=>sum+(row.hostStep||0),0)>30,'visible host must move a meaningful distance during the gesture');
 const down=owned.filter(row=>row.stage==='scroll-down'),up=owned.filter(row=>row.stage==='scroll-up');
 assert.ok(down.length&&up.length,'both scroll directions must be sampled');
 assert.ok(Math.max(...up.map(row=>row.anchor.y))-Math.min(...down.map(row=>row.anchor.y))>10,'reversal must retarget the trailing position rather than remain frozen');
 assert.ok(up.some(row=>row.movement.velocity.y>5),'the rendered companion must follow the reversed destination before scrolling ends');
 for(let i=1;i<owned.length;i++){
  const before=owned[i-1],after=owned[i],seconds=(after.t-before.t)/1000;
  if(seconds<.008||seconds>.1)continue;
  const velocityDelta=Math.hypot(after.movement.velocity.x-before.movement.velocity.x,after.movement.velocity.y-before.movement.velocity.y);
  assert.ok(velocityDelta<=accelerationLimit*seconds+8,`reversal/reset introduced a velocity discontinuity: ${debug()}`);
  const accelerationDelta=Math.hypot(after.movement.acceleration.x-before.movement.acceleration.x,after.movement.acceleration.y-before.movement.acceleration.y);
  assert.ok(accelerationDelta<=2*accelerationLimit*(1-Math.exp(-seconds/.06))+8,`reversal/reset introduced an acceleration discontinuity: ${debug()}`);
 }
}

for(const site of ['company','shop','community'])for(const viewport of [{width:1100,height:720},{width:390,height:640}])test(`${site} visibly follows sustained ${viewport.width<600?'mobile':'desktop'} scrolling and reverses continuously`,{timeout:45000},async t=>{
 const page=await demo(t,site,viewport);
 // The community's initial home approach must finish before measuring the
 // bounded follow profile, otherwise its previous tween has a different speed.
 await page.waitForFunction(()=>document.querySelector('#bot').movementState.phase==='idle');
 await page.evaluate(installVisibleMotionTrace);
 assertFollowingTrace(await scrollWithReversal(page),site);
});

for(const site of ['company','shop','community'])test(`${site} respects a manually hidden companion while scrolling`,{timeout:45000},async t=>{
 const page=await demo(t,site);
 await page.evaluate(async()=>{const api=await window.sidekickDemoReady;api.pauseScenarios(true);api.bot.presence={visible:false};});
 await page.waitForFunction(()=>document.querySelector('#bot').presenceState==='hidden');
 await page.evaluate(installVisibleMotionTrace);
 await page.evaluate(async()=>{(await window.sidekickDemoReady).pauseScenarios(false);});
 const trace=await scrollWithReversal(page,30);
 assert.equal(trace.calls.length,0,'scrolling cannot issue reveal-capable movement for an explicit hide');
 assert.ok(trace.rows.every(row=>!row.visible&&row.presenceState==='hidden'),'explicit hide must remain rendered hidden, not just declared hidden');
 const result=await page.evaluate(()=>({presence:document.querySelector('#bot').presence,speech:!!document.querySelector('[data-sidekick-speech]')}));
 assert.equal(result.presence.visible,false);
 assert.equal(result.speech,false);
});

test('shop stays visibly nearby after its saved comparison is removed instead of hiding at rest',{timeout:45000},async t=>{
 const page=await demo(t,'shop');
 await page.locator('[data-product="0"] .muse-price').evaluate(price=>{price.scrollIntoView({block:'end',behavior:'instant'});scrollBy({top:32,behavior:'instant'});});
 await page.locator('[data-sidekick-speech] .message').waitFor();
 await page.evaluate(installVisibleMotionTrace);
 await page.locator('.muse-companion-remove').click();
 await page.waitForFunction(()=>document.querySelector('#muse-wish-count').textContent==='0');
 await page.waitForFunction(()=>{const bot=document.querySelector('#bot');return bot.elementAnchor?.target.hasAttribute('data-companion-follow')&&bot.movementState.phase==='idle';});
 const trace=await page.evaluate(()=>window.visibleMotionTrace.stop());
 const followed=trace.rows.filter(row=>row.anchor?.target==='[data-companion-follow]');
 assert.ok(followed.length>5,'departure must produce a real persistent follow, not just no speech');
 assert.ok(followed.every(row=>row.visible&&row.opacity>.98&&row.presenceState!=='hidden'),'a quiet shop companion must remain actually visible after settlement');
 const result=await page.evaluate(()=>({presence:document.querySelector('#bot').presence,speech:!!document.querySelector('[data-sidekick-speech]')}));
 assert.notEqual(result.presence?.visible,false);
 assert.equal(result.speech,false,'removing the reference invalidates comparison narration, not the companion');
});

test('company settled parking interpolates a visibly obstructing companion',{timeout:45000},async t=>{
 const page=await demo(t,'company');
 await page.locator('#nova-design').evaluate(section=>scrollTo({top:section.getBoundingClientRect().top+scrollY-120,behavior:'instant'}));
 await page.locator('[data-sidekick-speech] .message').waitFor();
 await page.locator('[data-sidekick-speech] button').click();
 // Put an already-visible companion over the known story heading through the
 // public manual movement API. A subsequent click asks the real scenario to
 // resolve this invalid settled resting geometry, with no hidden-state trick.
 await page.evaluate(async()=>{const api=await window.sidekickDemoReady;api.pauseScenarios(true);const r=document.querySelector('#nova-design h2').getBoundingClientRect();await api.moveTo({x:Math.max(20,Math.min(innerWidth-140,r.left+Math.min(30,r.width/2))),y:Math.max(40,Math.min(innerHeight-140,r.top+Math.min(10,r.height/2)))},{duration:550,travel:'none'});});
 await page.evaluate(installVisibleMotionTrace);
 await page.evaluate(async()=>{(await window.sidekickDemoReady).pauseScenarios(false);document.querySelector('#demo-content').dispatchEvent(new MouseEvent('click',{bubbles:true}));});
 const trace=await assertContinuous(page,'IMG');
 assert.ok(trace.calls.some(c=>c.visible&&Math.hypot((c.result?.position?.x??c.before.x)-c.before.x,(c.result?.position?.y??c.before.y)-c.before.y)>20),'parking actually moved the companion a meaningful distance');
});
