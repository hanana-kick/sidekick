import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { createAppServer } from '../scripts/serve.mjs';
let browser, server, base;
before(async()=>{
 server=createAppServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
for(const locale of ['ko','en','zh-CN','ja'])for(const path of ['','api-playground.html','guide.html'])test(`${locale} ${path||'Studio'}: visible locale, header and mobile layout`,async t=>{
 const page=await browser.newPage({viewport:{width:320,height:480},locale:'en-US',reducedMotion:'reduce'});t.after(()=>page.close());
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${base}/${path}?lang=${locale}`);await page.waitForSelector('#site-language');
 assert.equal(await page.locator('html').getAttribute('lang'),locale);
 assert.equal(await page.locator('#site-language').inputValue(),locale);
 assert.equal(await page.locator('.product-nav a').count(),3);
 assert.equal(await page.locator('.product-nav [aria-current=page]').count(),1);
 assert.ok((await page.locator('#site-language').getAttribute('aria-label'))?.length);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 for(const href of await page.locator('.product-nav a').evaluateAll(links=>links.map(link=>link.href)))assert.ok(href.includes(`lang=${locale}`));
 assert.deepEqual(errors,[]);
});
test('changing language preserves playground draft, hash, bot and navigation preference',async t=>{
 const page=await browser.newPage({locale:'ko-KR',reducedMotion:'reduce'});t.after(()=>page.close());
 await page.goto(`${base}/api-playground.html?lang=ko#action-panel`);await page.waitForSelector('#site-language');
 await page.locator('#action-kind').selectOption('expression');await page.locator('#expression-duration').fill('950');
 await page.evaluate(()=>{window.originalBot=document.querySelector('#bot');});
 for(const locale of ['en','zh-CN','ja','ko']){
  await page.locator('#site-language').selectOption(locale);
  assert.equal(await page.locator('#action-kind').inputValue(),'expression');assert.equal(await page.locator('#expression-duration').inputValue(),'950');
  assert.equal(await page.evaluate(()=>window.originalBot===document.querySelector('#bot')),true);
  assert.ok(page.url().endsWith('#action-panel'));
 }
 await page.locator('#site-language').selectOption('ja');await page.locator('.product-nav a').first().click();
 assert.equal(await page.locator('#site-language').inputValue(),'ja');
 await page.goto(`${base}/api-playground.html`);await page.waitForSelector('#site-language');assert.equal(await page.locator('#site-language').inputValue(),'ja');
});
