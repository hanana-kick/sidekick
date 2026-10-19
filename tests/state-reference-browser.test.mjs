import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import ts from 'typescript';
import {createAppServer} from '../scripts/serve.mjs';
let browser,server,base;
before(async()=>{server=createAppServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:process.env.SIDEKICK_HEADED!=='1',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});});
after(async()=>{await browser?.close();await new Promise(r=>server?.close(r));});
const cases=[['state-emotion','emotion','curious'],['state-position','position-x','28'],['state-behavior','behavior',JSON.stringify({type:'idle'})],['state-facing','body-yaw','25'],['state-appearance','shape','heart'],['state-execution','activity','thinking']];
async function frameFor(page){await page.waitForSelector('[data-state-reference][data-configured]');const frame=page.frames().find(f=>f.url().includes('/state-preview.html'));assert.ok(frame);await frame.waitForFunction(()=>document.querySelector('#reference-bot')?.ready);return frame;}
async function edit(page,key,value){if(key==='behavior'&&JSON.parse(value).type==='idle'){await page.selectOption('[data-behavior-preset]','idle');return;}await page.check(`[data-state-enable="${key}"]`);const control=page.locator(`[data-state-control="${key}"]`);if(await control.evaluate(e=>e.tagName)==='SELECT')await control.selectOption(value);else{await control.fill(value);if(await control.evaluate(e=>e.tagName)==='TEXTAREA')await page.locator(`[data-state-field="${key}"] button`).click();else await control.dispatchEvent('change');}}
async function snapshot(frame){return frame.locator('#reference-bot').evaluate(bot=>({design:bot.design,orientation:bot.bodyOrientation,zoom:bot.zoom,tracking:bot.trackingMode,emotion:bot.emotionState.emotion,position:bot.position,pausedAttribute:bot.getAttribute('paused')}));}
for(const locale of ['ko','en','zh-CN','ja'])for(const mode of ['element','react'])test(`six state pages edit selected ${mode} source and actual renderer in ${locale}`,{timeout:120000},async()=>{
 const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  for(const [id,key,value]of cases){
   await page.goto(`${base}/guide.html?lang=${locale}&framework=${mode}#${id}`);let frame=await frameFor(page);await page.locator('.state-lab iframe').scrollIntoViewIfNeeded();
   assert.equal(await page.locator('[data-state-source]').count(),1);await edit(page,key,value);await page.waitForTimeout(80);
   const code=await page.locator('[data-state-source]').textContent();assert.equal(await page.locator('[data-state-source]').getAttribute('data-framework'),mode);assert.match(code,mode==='react'?/SidekickAvatar id=/:/sidekick-avatar id=/);
   if(mode==='react')assert.doesNotMatch(code,/<sidekick-avatar/);else assert.doesNotMatch(code,/<SidekickAvatar/);
   assert.equal(await page.locator('.state-lab iframe').count(),1);assert.equal(await frame.locator('#reference-bot').count(),1);
   await page.locator('.state-lab iframe').scrollIntoViewIfNeeded();await page.waitForTimeout(100);const before=await snapshot(frame);await page.selectOption('#site-framework',mode==='react'?'element':'react');frame=await frameFor(page);await page.waitForTimeout(100);assert.deepEqual(await snapshot(frame),before,`${id} framework change preserves live values`);
   await page.locator('[data-state-try]').click();await frameFor(page);assert.match(page.url(),/api-playground/);assert.equal((key==='behavior'?JSON.stringify(JSON.parse(await page.locator(`[data-state-control="${key}"]`).inputValue())):await page.locator(`[data-state-control="${key}"]`).inputValue()),value);assert.equal(await page.locator('[data-state-source]').getAttribute('data-framework'),mode==='react'?'element':'react');
   await page.locator('#guide-source-return').click();await frameFor(page);assert.equal(new URL(page.url()).hash,'#'+id);assert.equal(await page.locator(`[data-state-enable="${key}"]`).isChecked(),true);
  }
  assert.deepEqual(errors,[]);
 }finally{await page.close();}
});
test('mobile controls, JSON rejection, reset, locale switch and navigation retain independent state',async()=>{
 const page=await browser.newPage({viewport:{width:320,height:480},reducedMotion:'reduce'});
 try{
  await page.goto(`${base}/guide.html?lang=en#state-appearance`);await frameFor(page);await edit(page,'shape','flower');
  await page.check('[data-state-enable="design"]');const before=await page.locator('[data-state-source]').textContent();await page.fill('[data-state-control="design"]','{"unsupported":true}');await page.locator('[data-state-field="design"] button').click();
  assert.equal(await page.locator('.state-lab-status').getAttribute('role'),'alert');assert.equal(await page.locator('[data-state-source]').textContent(),before.replace(/$/,''),'invalid JSON leaves last accepted source unchanged');
  await page.selectOption('#site-language','ja');assert.equal(await page.inputValue('[data-state-control="shape"]'),'flower');
  await page.locator('#toc-toggle').click();await page.locator('[data-scenario="state-emotion"]').click();await frameFor(page);await edit(page,'emotion','happy');
  await page.locator('#toc-toggle').click();await page.locator('[data-scenario="state-appearance"]').click();await frameFor(page);assert.equal(await page.inputValue('[data-state-control="shape"]'),'flower');assert.equal(await page.locator('iframe').count(),1);
  assert.ok(await page.locator('.state-lab iframe').evaluate(el=>el.getBoundingClientRect().height>=240));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  if(process.env.SIDEKICK_SCREENSHOTS){await mkdir(process.env.SIDEKICK_SCREENSHOTS,{recursive:true});await page.locator('.state-lab iframe').scrollIntoViewIfNeeded();await page.screenshot({path:process.env.SIDEKICK_SCREENSHOTS+'/state-reference-320.png'});await page.setViewportSize({width:1280,height:900});await page.locator('.state-lab').scrollIntoViewIfNeeded();await page.screenshot({path:process.env.SIDEKICK_SCREENSHOTS+'/state-reference-desktop.png'});}
  await page.locator('[data-state-text="reset"]').click();assert.equal(await page.locator('[data-state-enable="shape"]').isChecked(),false);
 }finally{await page.close();}
});
test('actual copied Custom Element and React source replay matching Studio configuration',async()=>{
 const page=await browser.newPage({viewport:{width:900,height:700},reducedMotion:'reduce'});
 try{
  for(const mode of ['element','react']){
   await page.goto(`${base}/guide.html?lang=en&framework=${mode}#state-appearance`);await frameFor(page);await edit(page,'shape','heart');await edit(page,'body-color','#345678');await edit(page,'left-smile','0.65');
   const frame=await frameFor(page);await page.locator('.state-lab iframe').scrollIntoViewIfNeeded();await page.waitForTimeout(100);const expected=await snapshot(frame),source=await page.locator('[data-state-source]').textContent();
   const replay=await browser.newPage({viewport:{width:400,height:320},reducedMotion:'reduce'});
   try{
    let html=source.replace("'@hanana-kick/sidekick/auto'",`'${base}/browser/sidekick.js'`);
    if(mode==='react'){
     const output=ts.transpileModule(`import React from 'react';\nimport {createRoot} from 'react-dom/client';\n${source}\ncreateRoot(document.getElementById('root')).render(<StateExample />);`,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
     const imports={react:`${base}/react.js`,'react-dom/client':`${base}/react-dom-client.js`,'@hanana-kick/sidekick/react':`${base}/browser/sidekick-react.js`};
     html=`<!doctype html><div id="root"></div><script type="importmap">${JSON.stringify({imports})}</script><script type="module">${output}</script>`;
     for(const name of ['react','react-dom-client'])await replay.route(`${base}/${name}.js`,async route=>route.fulfill({contentType:'text/javascript',body:await readFile(new URL(`../cdn/react-19.3.1/${name}.js`,import.meta.url),'utf8')}));
    }
    await replay.route(`${base}/state-replay.html`,route=>route.fulfill({contentType:'text/html',body:html}));await replay.goto(`${base}/state-replay.html`);await replay.waitForFunction(()=>document.querySelector('#reference-bot')?.ready);const actual=await snapshot(replay);assert.deepEqual(actual,expected);
   }finally{await replay.close();}
  }
 }finally{await page.close();}
});
