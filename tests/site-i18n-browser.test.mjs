import { apiDemoFrame } from './helpers/api-demo-frame.mjs';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createAppServer } from '../scripts/serve.mjs';
let browser, server, base;
const screenshots=process.env.SIDEKICK_SCREENSHOTS;
before(async()=>{
 if(screenshots)await mkdir(screenshots,{recursive:true});
 server=createAppServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:process.env.SIDEKICK_HEADED!=='1',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
for(const locale of ['ko','en','zh-CN','ja'])for(const path of ['','api-playground.html','guide.html'])test(`${locale} ${path||'Studio'}: visible locale, header and mobile layout`,async t=>{
 const page=await browser.newPage({viewport:{width:320,height:480},locale:'en-US',reducedMotion:'reduce'});t.after(()=>page.close());
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${base}/${path}?lang=${locale}`);await page.waitForSelector('#site-language');
 if(screenshots)await page.screenshot({path:`${screenshots}/locale-${locale}-${path.replace('.html','')||'studio'}-initial-320x480.png`});
 assert.equal(await page.locator('html').getAttribute('lang'),locale);
 assert.equal(await page.locator('#site-language').inputValue(),locale);
 assert.equal(await page.locator('.product-nav a').count(),3);
 assert.equal(await page.locator('.product-nav [aria-current=page]').count(),1);
 const headerFits=await page.locator('.site-navigation a,.site-language').evaluateAll(items=>items.every(item=>{const box=item.getBoundingClientRect();return box.left>=0&&box.right<=document.documentElement.clientWidth+1;}));
 assert.equal(headerFits,true,'All navigation and language controls fit beside the scrollbar gutter');
 assert.ok((await page.locator('#site-language').getAttribute('aria-label'))?.length);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true);
 for(const href of await page.locator('.product-nav a').evaluateAll(links=>links.map(link=>link.href)))assert.ok(href.includes(`lang=${locale}`));
 if(path==='api-playground.html') {
  await apiDemoFrame(page);
  await page.locator('#bot-tools-launcher').click();
  const titles={ko:'무엇을 하게 할까요?',en:'What should your companion do?','zh-CN':'想让伙伴做什么？',ja:'何をしてもらいましょう？'};
  assert.equal(await page.locator('h1').textContent(),titles[locale]);
  for(const action of ['movement','anchor','activity','expression','tracking','orientation','assets','presence']) {
    await page.locator('#action-kind').selectOption(action);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,action);
  }
 } else if(path==='') {
  const titles={ko:'나만의 작은 동료.',en:'Your own little companion.','zh-CN':'专属于你的小伙伴。',ja:'あなただけの小さな相棒。'};
  assert.equal(await page.locator('h1').textContent(),titles[locale]);
  for(const id of ['animation-tab','body-orientation-tab','scene-tab','json-tab','appearance-tab']) {
    await page.locator('#'+id).click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,id);
  }
  await page.locator('.preview-footer button').first().click();
  if(screenshots)await page.screenshot({path:`${screenshots}/locale-${locale}-studio-before-assert-320x480.png`});
  const settings=await page.locator('.settings-scroll').evaluate(el=>({client:el.clientHeight,scroll:el.scrollHeight}));
  assert.ok(settings.client>=50&&settings.scroll>settings.client,`Usable independent settings scroll: ${JSON.stringify(settings)}`);
  const preview=await page.locator('.previews').boundingBox();
  assert.ok(preview&&preview.height>=110,`Visible character preview must stay useful: ${preview?.height}px`);
  const tabLines=await page.locator('.settings-nav [data-slot=tabs-trigger]').evaluateAll(tabs=>tabs.map(tab=>{const range=document.createRange();range.selectNodeContents(tab);const rects=[...range.getClientRects()].filter(rect=>rect.width>0&&rect.height>0);return {label:tab.textContent,width:tab.clientWidth,overflow:tab.scrollWidth>tab.clientWidth+1,lines:new Set(rects.map(rect=>Math.round(rect.top))).size,rects:rects.map(rect=>({top:rect.top,left:rect.left,width:rect.width,height:rect.height}))};}));
  if(screenshots)await writeFile(`${screenshots}/locale-${locale}-studio-geometry.json`,JSON.stringify({preview,settings,tabs:tabLines,viewport:await page.evaluate(()=>({innerWidth,clientWidth:document.documentElement.clientWidth}))},null,2));
  for(const tab of tabLines){assert.equal(tab.overflow,false,JSON.stringify(tab));assert.ok(tab.lines<=2,`Tab exceeds two text lines: ${JSON.stringify(tab)}`);}
  for(const [width,height] of [[390,500],[667,375],[568,320]]) {
    await page.setViewportSize({width,height});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const stage=await page.locator('.stage').boundingBox();
    const layout=await page.locator('.settings-scroll').evaluate(el=>({client:el.clientHeight,scroll:el.scrollHeight}));
    assert.ok(layout.client>=50&&layout.scroll>layout.client,`${locale} ${width}×${height} usable settings: ${JSON.stringify(layout)}`);
    assert.ok(stage.y>=0&&stage.y+stage.height<=height+1,'Stage stays inside viewport');
    await page.locator('.settings-scroll').evaluate(el=>{el.scrollTop=el.scrollHeight;});
    assert.ok(await page.locator('.settings-scroll').evaluate(el=>el.scrollTop>0));
    assert.deepEqual(await page.locator('.stage').boundingBox(),stage,'Settings scroll must not move preview');
    if(screenshots)await page.screenshot({path:`${screenshots}/locale-${locale}-studio-${width}x${height}.png`});
  }
  await page.setViewportSize({width:320,height:480});
  await page.locator('.settings-scroll').evaluate(el=>{el.scrollTop=0;});
 }
 if(path==='api-playground.html') await apiDemoFrame(page);
 else await page.waitForFunction(()=>{const bot=document.querySelector('#flat');return !bot||bot.ready;});
 if(screenshots){
  await page.screenshot({path:`${screenshots}/locale-${locale}-${path.replace('.html','')||'studio'}-320x480.png`,fullPage:false});
  await page.setViewportSize({width:1280,height:900});
  await page.screenshot({path:`${screenshots}/locale-${locale}-${path.replace('.html','')||'studio'}-1280x900.png`,fullPage:false});
 }
 assert.deepEqual(errors,[]);
});
test('changing language preserves playground draft, hash and navigation preference while replacing only the demo',async t=>{
 const page=await browser.newPage({locale:'ko-KR',reducedMotion:'reduce'});t.after(()=>page.close());
 await page.goto(`${base}/api-playground.html?lang=ko#action-panel`);await page.waitForSelector('#site-language');
 await apiDemoFrame(page);
 if (!await page.locator('#bot-tools').isVisible()) await page.locator('#bot-tools-launcher').click();
 await page.locator('#bot-tools').waitFor({ state: 'visible' });
 assert.equal(await page.locator('#bot-tools-launcher').getAttribute('aria-expanded'), 'true');
 await page.locator('#action-kind').selectOption('expression');await page.locator('#expression-duration').fill('950');
 for(const locale of ['en','zh-CN','ja','ko']){
  await page.evaluate(()=>{window.originalFrame=document.querySelector('#site-preview-frame');window.originalBot=window.originalFrame.contentDocument.querySelector('#bot');});
  await page.locator('#site-language').selectOption(locale);
  const frame=await apiDemoFrame(page);
  assert.equal(await frame.locator('html').getAttribute('lang'),locale);
  assert.equal(await page.locator('#action-kind').inputValue(),'expression');assert.equal(await page.locator('#expression-duration').inputValue(),'950');
  assert.equal(await page.evaluate(()=>{
    const iframe=document.querySelector('#site-preview-frame'),bot=iframe.contentDocument.querySelector('#bot');
    return Boolean(window.originalBot)&&iframe!==window.originalFrame&&!window.originalFrame.isConnected
      &&bot!==window.originalBot&&bot.ready&&bot.hasAttribute('data-configured');
  }),true,'Locale replaces the old demo with one real ready avatar, not a null parent selector');
  assert.equal(await page.locator('#site-preview-frame').count(),1);
  assert.ok(page.url().endsWith('#action-panel'));
 }
 await page.locator('#site-language').selectOption('ja');await page.locator('.product-nav a').first().click();
 assert.equal(await page.locator('#site-language').inputValue(),'ja');
 await page.goto(`${base}/api-playground.html`);await page.waitForSelector('#site-language');assert.equal(await page.locator('#site-language').inputValue(),'ja');
});
