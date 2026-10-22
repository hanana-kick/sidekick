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

async function demo(t,site){
 const page=await browser.newPage({viewport:{width:1100,height:720},reducedMotion:'no-preference'});t.after(()=>page.close());
 await page.goto(`${base}/api-demo.html?site=${site}&lang=en`);
 await page.evaluate(async()=>{const api=await window.sidekickDemoReady;document.body.append(api.bot);await new Promise(resolve=>api.bot.ready?resolve():api.bot.addEventListener('sidekick-ready',resolve,{once:true}));await api.moveTo({x:440,y:420},{duration:0,travel:'none'});api.bot.setAttribute('data-configured','');api.startScenarios();});
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
 // quiet-known branch, not the allowed hidden-before-restore branch.
 await page.evaluate(async()=>{const api=await window.sidekickDemoReady;api.pauseScenarios(true);const p=api.bot.position;await api.moveTo({x:p.x>innerWidth/2?40:innerWidth-150,y:Math.min(innerHeight-140,Math.max(40,p.y))},{duration:550,travel:'none'});});
 await page.evaluate(installVisibleMotionTrace);
 await page.evaluate(async()=>{(await window.sidekickDemoReady).pauseScenarios(false)});
 await assertContinuous(page,'product:0');
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
