import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { createAppServer } from '../scripts/serve.mjs';
let browser, server, base;
before(async()=>{
 server=createAppServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 base=process.env.SIDEKICK_LIFECYCLE_DOCS_URL??`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:process.env.SIDEKICK_HEADED!=='1',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
});
after(async()=>{await browser?.close();await new Promise(resolve=>server?.close(resolve));});
for(const framework of ['element','react'])test(`lifecycle guide runs app outcomes, interruption, visibility and moving home: ${framework}`,{timeout:90000},async()=>{
 const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(`${base}/guide.html?lang=en&framework=${framework}#state-lifecycle`);
  await page.waitForSelector('[data-state-reference="state-lifecycle"][data-configured]');
  const frame=page.frames().find(candidate=>candidate.url().includes('state-preview.html'));
  await page.locator('.state-lab iframe').scrollIntoViewIfNeeded();
  const phase=expected=>frame.waitForFunction(value=>document.querySelector('#reference-bot')?.lifecycleState.phase===value,expected,{timeout:15000});
  await phase('resting');
  if(process.env.SIDEKICK_SCREENSHOTS){await mkdir(process.env.SIDEKICK_SCREENSHOTS,{recursive:true});await page.screenshot({path:`${process.env.SIDEKICK_SCREENSHOTS}/lifecycle-guide-${framework}-desktop.png`,fullPage:true});}
  const click=action=>frame.locator(`[data-lifecycle-action="${action}"]`).click();
  await click('wait');await frame.waitForFunction(()=>document.querySelector('#reference-bot')?.task?.status==='pending');
  await click('success');await phase('reacting');
  await click('follow');assert.equal(await frame.locator('#reference-bot').evaluate(bot=>bot.task.id),2);
  await click('cancel');await phase('resting');
  await click('wait');await click('error');await phase('settled');
  assert.equal(await frame.locator('#reference-bot').evaluate(bot=>bot.task.status),'error');
  await click('wait');await click('success');await phase('resting');
  await click('visible');await phase('hidden');await click('visible');await phase('resting');
  const previous=await frame.locator('#reference-bot').evaluate(bot=>bot.position);
  await click('move-home');await frame.waitForFunction(before=>Math.hypot(document.querySelector('#reference-bot').position.x-before.x,document.querySelector('#reference-bot').position.y-before.y)>10,previous);
  await click('mount-home');await phase('error');
  await click('mount-home');await phase('resting');
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  if(process.env.SIDEKICK_SCREENSHOTS)await page.screenshot({path:`${process.env.SIDEKICK_SCREENSHOTS}/lifecycle-guide-${framework}-mobile.png`,fullPage:true});
  assert.deepEqual(errors,[]);
 }finally{await page.close();}
});
test('API playground lifecycle preset runs application-owned outcomes and emits standalone source',{timeout:60000},async()=>{
 const page=await browser.newPage({viewport:{width:1280,height:1000}});
 try{
  await page.goto(`${base}/api-playground.html?lang=en&lesson=declarative-lifecycle`);
  await page.waitForFunction(()=>!document.querySelector('#execute')?.disabled);
  await page.locator('#execute').click();await page.locator('[data-lifecycle-action="wait"]').click();
  assert.equal(await page.locator('#bot').evaluate(bot=>bot.task.status),'pending');
  assert.match(await page.locator('#invocation').textContent(),/<!doctype html>/i);
  if(process.env.SIDEKICK_SCREENSHOTS){await mkdir(process.env.SIDEKICK_SCREENSHOTS,{recursive:true});await page.screenshot({path:`${process.env.SIDEKICK_SCREENSHOTS}/lifecycle-api-desktop.png`,fullPage:true});}
  await page.locator('[data-lifecycle-action="success"]').click();
  await page.waitForFunction(()=>document.querySelector('#bot')?.task?.status==='success');
 }finally{await page.close();}
});
