import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {transform} from 'esbuild';
import {createAppServer} from '../scripts/serve.mjs';
import {lessons} from '../playground/guide-lessons.js';
import {scenarios} from '../playground/scenario-catalog.js';
let browser,server,base;
before(async()=>{server=createAppServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});});
after(async()=>{await browser?.close();await new Promise(r=>server?.close(r));});
for(const lang of ['ko','en','zh-CN','ja'])test(`global framework code and unchanged preview on all Guide examples: ${lang}`,{timeout:180000},async()=>{
 const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(`${base}/guide.html?lang=${lang}&framework=element#loading`);
  for(const item of scenarios){
   await page.evaluate(id=>location.hash=id,item.id);await page.waitForSelector(`#demo-bot[data-scenario="${item.id}"][data-configured]`);
   await page.locator('[data-level="2"]').click();
   const bot=await page.locator('#demo-bot').elementHandle();const behavior=await bot.evaluate(el=>el.behavior);
   await page.selectOption('#site-framework','react');
   assert.match(await page.locator('#declaration-code').textContent(),/<SidekickAvatar/);assert.doesNotMatch(await page.locator('#declaration-code').textContent(),/<sidekick-avatar/);
   assert.equal(await bot.evaluate(el=>el===document.querySelector('#demo-bot')),true);assert.deepEqual(await bot.evaluate(el=>el.behavior),behavior);
   await page.locator('[data-level="3"]').click();await transform(await page.locator('#declaration-code').textContent(),{loader:'jsx',format:'esm'});
   await page.selectOption('#site-framework','element');assert.match(await page.locator('#declaration-code').textContent(),/<sidekick-avatar/);assert.doesNotMatch(await page.locator('#declaration-code').textContent(),/<SidekickAvatar/);
   assert.equal(await page.locator('#event-code').textContent(),'');
  }
  for(const lesson of lessons.filter(item=>!item.id.startsWith('state-'))){
   await page.evaluate(id=>location.hash=id,lesson.id);await page.waitForSelector('#lesson-content [data-framework-code="element"]');
   await page.selectOption('#site-framework','react');const code=await page.locator('#lesson-content [data-framework-code]').textContent();assert.match(code,/<SidekickAvatar/);assert.doesNotMatch(code,/<sidekick-avatar/);await transform(code,{loader:'tsx',format:'esm'});
   await page.selectOption('#site-framework','element');assert.doesNotMatch(await page.locator('#lesson-content [data-framework-code]').textContent(),/<SidekickAvatar/);
  }
  assert.deepEqual(errors,[]);
 }finally{await page.close();}
});
test('framework survives locale, contextual navigation, reload and fits 320px header',async()=>{
 const page=await browser.newPage({viewport:{width:320,height:640},reducedMotion:'reduce'});
 try{
  await page.goto(`${base}/guide.html?lang=ko&framework=react#loading`);await page.waitForSelector('#demo-bot[data-configured]');
  for(const lang of ['ko','en','zh-CN','ja']){await page.selectOption('#site-language',lang);assert.equal(await page.inputValue('#site-framework'),'react');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await page.locator('#site-framework').isVisible(),true);}
  await page.locator('[data-level="2"]').click();await page.fill('#behavior-gap','28');await page.locator('#apply-options').click();
  const before=await page.locator('#declaration-code').textContent();await page.locator('#context-playground-link').click();await page.waitForSelector('#demo-bot[data-configured]');assert.equal(await page.inputValue('#site-framework'),'react');assert.equal(await page.locator('#declaration-code').textContent(),before);
  await page.reload();await page.waitForSelector('#demo-bot[data-configured]');assert.equal(await page.inputValue('#site-framework'),'react');await page.locator('#guide-source-return').click();await page.waitForSelector('#demo-bot[data-configured]');assert.equal(await page.inputValue('#behavior-gap'),'28');
  await page.locator('#api-playground-link').click();await page.waitForSelector('#bot[data-configured]');assert.equal(await page.inputValue('#site-framework'),'react');assert.match(await page.locator('#invocation').textContent(),/<SidekickAvatar/);assert.doesNotMatch(await page.locator('#install-code').textContent(),/<sidekick-avatar/);
  const action=await page.inputValue('#action-kind');await page.selectOption('#site-framework','element');assert.equal(await page.inputValue('#action-kind'),action);assert.equal(await page.locator('#code-format').count(),0);
 }finally{await page.close();}
});
