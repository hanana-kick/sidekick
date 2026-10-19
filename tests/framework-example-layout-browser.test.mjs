import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { transform } from 'esbuild';
import { createAppServer } from '../scripts/serve.mjs';
import { buildReactPeers } from '../scripts/build-react-peers.mjs';
import { scenarios } from '../playground/scenario-catalog.js';

let browser, server, base, temporary;
const fixtures=new Map();
before(async()=>{
 temporary=await mkdtemp(join(tmpdir(),'sidekick-example-layout-'));
 await buildReactPeers(temporary);
 for(const name of ['react.js','react-dom-client.js'])fixtures.set(`/__example-layout/${name}`,{type:'text/javascript',body:await readFile(join(temporary,name),'utf8')});
 const app=createAppServer();
 server=createServer((req,res)=>{
  const file=fixtures.get(new URL(req.url,'http://localhost').pathname);
  if(file){res.writeHead(200,{'Content-Type':file.type+'; charset=utf-8','Cache-Control':'no-store'});res.end(file.body);}
  else app.emit('request',req,res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:process.env.SIDEKICK_HEADED!=='1',executablePath:process.env.CHROMIUM_PATH??(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));if(temporary)await rm(temporary,{recursive:true,force:true});});

async function newPage(t,width){
 const page=await browser.newPage({viewport:{width,height:900},locale:'en-US',reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 t.after(async()=>{await page.close();assert.deepEqual(errors,[]);});return page;
}
async function settled(page){
 await page.waitForFunction(()=>{const bot=document.querySelector('#demo-bot');return bot?.ready&&['acting','completed'].includes(bot.behaviorState?.status);});
 await page.waitForTimeout(80);
}
async function layout(page,label){
 const result=await page.evaluate(()=>{
  const root=document.querySelector('#demo-app'),avatar=root.querySelector('sidekick-avatar');
  const rect=element=>{const r=element.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
  const app=rect(root),bot=rect(avatar),card=rect(root.querySelector('.app-card'));
  const overflow=[...root.querySelectorAll('.app-card,button,input,label,.target-item,.emotion-actions')].filter(element=>element.checkVisibility()).flatMap(element=>{
   const r=rect(element);return r.left<app.left-1||r.right>app.right+1||element.scrollWidth>element.clientWidth+1?[{tag:element.tagName,id:element.id,...r,scroll:element.scrollWidth,client:element.clientWidth}]:[];
  });
  return {app,bot,card,overflow,pageWidth:document.documentElement.scrollWidth,viewport:innerWidth};
 });
 assert.ok(result.pageWidth<=result.viewport+1,`${label}: horizontal page overflow ${JSON.stringify(result)}`);
 assert.deepEqual(result.overflow,[],`${label}: clipped or overflowing controls`);
 assert.ok(result.card.width>=Math.min(140,result.app.width*.45),`${label}: crushed app card ${JSON.stringify(result.card)}`);
 assert.ok(result.bot.width>=60&&result.bot.height>=60,`${label}: invisible or undersized companion`);
 assert.ok(result.bot.left>=result.app.left-1&&result.bot.right<=result.app.right+1,`${label}: companion outside horizontal rail ${JSON.stringify(result)}`);
 assert.ok(result.bot.top>=result.app.top-1&&result.bot.bottom<=result.app.bottom+1,`${label}: companion clipped vertically ${JSON.stringify(result)}`);
}
async function screenshot(page,name){
 const output=process.env.SIDEKICK_SCREENSHOTS;if(!output)return;
 await mkdir(output,{recursive:true});
 if(await page.locator('.application').count())await page.locator('.application').screenshot({path:join(output,`${name}.png`)});
 else await page.screenshot({path:join(output,`${name}.png`),fullPage:true});
}

for(const width of [320,375,1280])test(`all 18 live Guide examples have usable cards, controls and companion rails at ${width}px`,{timeout:240000},async t=>{
 const page=await newPage(t,width);
 for(const item of scenarios){
  await page.goto(`${base}/guide.html?lang=en#${item.id}`);await page.waitForSelector(`#demo-bot[data-scenario="${item.id}"][data-configured]`);await settled(page);
  await layout(page,`Guide ${item.id} ${width}`);await screenshot(page,`layout-guide-${width}-${item.id}`);
  if(width===320){
   await page.locator('#context-playground-link').click();await page.waitForSelector('#demo-bot[data-configured]');
   await page.locator('#restart-demo').click();await settled(page);await layout(page,`Playground ${item.id} ${width}`);await screenshot(page,`layout-context-${width}-${item.id}`);
  }
 }
});

const importMap=JSON.stringify({imports:{react:'/__example-layout/react.js','react-dom/client':'/__example-layout/react-dom-client.js','@hanana-kick/sidekick/react':'/browser/sidekick-react.js'}});
async function copiedPage(source,framework,key){
 let content;
 if(framework==='element')content=source.replace(/https:\/\/cdn\.jsdelivr\.net\/gh\/hanana-kick\/sidekick@[^/'"\s]+\/dist\/browser\/sidekick\.js/g,'/browser/sidekick.js');
 else{
  // Compile the displayed JSX unchanged; only the package import is mapped to
  // the locally built release, so the test cannot borrow Guide CSS or handlers.
  const {code}=await transform(`import React from 'react';\n${source}\nimport { createRoot } from 'react-dom/client';\nwindow.exampleRoot=createRoot(document.querySelector('#root'));\nwindow.exampleRoot.render(React.createElement(Example));`,{loader:'jsx',format:'esm',target:'es2022'});
  fixtures.set(`/__example-layout/${key}.js`,{type:'text/javascript',body:code});
  content=`<div id="root"></div><script type="importmap">${importMap}</script><script type="module" src="/__example-layout/${key}.js"></script>`;
 }
 fixtures.set(`/__example-layout/${key}.html`,{type:'text/html',body:`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:12px}</style></head><body>${content}</body></html>`});
 return `${base}/__example-layout/${key}.html`;
}
for(const framework of ['element','react'])for(const width of [320,375])test(`all 18 copied ${framework} examples execute with standalone ${width}px layout`,{timeout:240000},async t=>{
 const guide=await newPage(t,width),copy=await newPage(t,width);
 for(const item of scenarios){
  await guide.goto(`${base}/guide.html?lang=en&framework=${framework}#${item.id}`);await guide.waitForSelector('#demo-bot[data-configured]');await guide.locator('[data-level="3"]').click();
  const source=await guide.locator('#declaration-code').textContent();
  await copy.goto(await copiedPage(source,framework,`${framework}-${width}-${item.id}`));await settled(copy);
  await layout(copy,`Copied ${framework} ${item.id} ${width}`);await screenshot(copy,`layout-copy-${framework}-${width}-${item.id}`);
  if(['loading','upload'].includes(item.id)){
   const result=item.id==='loading'?'#loading-indicator':'#progress-label';
   await copy.waitForFunction(selector=>document.querySelector(selector)?.dataset.outcome==='success',result);
   assert.equal(await copy.locator('#demo-bot').evaluate(bot=>bot.emotion),'happy');await layout(copy,`Completed ${framework} ${item.id} ${width}`);
  }
  if(item.id==='failure'){
   await copy.locator('#app-retry').click();await copy.waitForFunction(()=>document.querySelector('#request-result')?.dataset.outcome==='success');
   assert.equal(await copy.locator('#demo-bot').evaluate(bot=>bot.emotion),'happy');
  }
  if(item.id==='input'){
   await copy.fill('#profile-name','Example');await copy.locator('#app-confirm').click();assert.equal(await copy.locator('#demo-bot').evaluate(bot=>bot.behavior.type),'celebrate');
  }
 }
});

test('all applied side/gap options reserve matching space in live and copied examples',{timeout:120000},async t=>{
 const page=await newPage(t,320),copy=await newPage(t,320);
 for(const side of ['left','right','above','below']){
  await page.goto(`${base}/guide.html?lang=en#input`);await page.waitForSelector('#demo-bot[data-configured]');await page.locator('[data-level="2"]').click();
  await page.selectOption('#behavior-side',side);await page.fill('#behavior-gap','48');await page.locator('#apply-options').click();await settled(page);await layout(page,`Applied ${side}`);
  await copy.goto(await copiedPage(await page.locator('#declaration-code').textContent(),'element',`side-${side}`));await settled(copy);await layout(copy,`Copied ${side}`);
  assert.equal(await copy.locator('#demo-app').getAttribute('data-side'),side);
 }
});
