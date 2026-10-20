import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import ts from 'typescript';
import {createAppServer} from '../scripts/serve.mjs';
let browser,server,base;
const forceCanvas = process.env.SIDEKICK_FORCE_CANVAS2D === '1';
before(async()=>{server=createAppServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));base=process.env.SIDEKICK_STATE_LIVE_URL??`http://127.0.0.1:${server.address().port}`;browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:process.env.SIDEKICK_HEADED!=='1',args:['--no-sandbox','--disable-dev-shm-usage',...(forceCanvas?['--disable-webgl']:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])]});});
after(async()=>{await browser?.close();await new Promise(r=>server?.close(r));});
const cases=[['state-lifecycle','presence',JSON.stringify({visible:true})],['state-emotion','emotion','curious'],['state-position','position-x','28'],['state-behavior','behavior',JSON.stringify({type:'idle'})],['state-facing','body-yaw','25'],['state-appearance','shape','heart'],['state-execution','activity','thinking']];
async function frameFor(page){await page.waitForSelector('[data-state-reference][data-configured]');const frame=page.frames().find(f=>f.url().includes('/state-preview.html'));assert.ok(frame);await frame.waitForFunction(()=>document.querySelector('#reference-bot')?.ready);assert.equal(await frame.locator('#reference-bot').evaluate(bot=>bot.diagnostics.graphics),forceCanvas?'canvas2d':'webgl2','reference suite must exercise the explicitly selected graphics renderer');return frame;}
async function edit(page,key,value){if(key==='behavior'&&JSON.parse(value).type==='idle'&&Object.keys(JSON.parse(value)).length===1){await page.selectOption('[data-behavior-preset]','idle');return;}await page.check(`[data-state-enable="${key}"]`);const control=page.locator(`[data-state-control="${key}"]`);if(await control.evaluate(e=>e.tagName)==='SELECT')await control.selectOption(value);else{await control.fill(value);if(await control.evaluate(e=>e.tagName)==='TEXTAREA')await page.locator(`[data-state-field="${key}"] button`).click();else await control.dispatchEvent('change');}}
async function snapshot(frame){return frame.locator('#reference-bot').evaluate(bot=>({design:bot.design,orientation:bot.bodyOrientation,zoom:bot.zoom,tracking:bot.trackingMode,emotion:bot.emotionState.emotion,emotionIntensity:bot.emotionState.intensity,activity:bot.activity,behavior:bot.behavior,presence:bot.presence,position:bot.position,paused:bot.paused}));}
for(const locale of ['ko','en','zh-CN','ja'])for(const mode of ['element','react'])test(`seven state pages edit selected ${mode} source and actual renderer in ${locale}`,{timeout:120000},async()=>{
 const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  for(const [id,key,value]of cases){
   await page.goto(`${base}/guide.html?lang=${locale}&framework=${mode}#${id}`);let frame=await frameFor(page);await page.locator('.state-lab iframe').scrollIntoViewIfNeeded();
   assert.equal(await page.locator('[data-state-source]').count(),1);await edit(page,key,value);await page.waitForTimeout(80);
   const code=await page.locator('[data-state-source]').textContent();assert.equal(await page.locator('[data-state-source]').getAttribute('data-framework'),mode);assert.match(code,mode==='react'?/SidekickAvatar id=/:/sidekick-avatar id=/);
   if(mode==='react')assert.doesNotMatch(code,/<sidekick-avatar/);else assert.doesNotMatch(code,/<SidekickAvatar/);
   assert.equal(await page.locator('.state-lab iframe').count(),1);assert.equal(await frame.locator('#reference-bot').count(),1);
   await page.locator('.state-lab iframe').scrollIntoViewIfNeeded();await page.waitForTimeout(100);const before=await snapshot(frame);const applied={presence:JSON.stringify(before.presence),emotion:before.emotion,'position-x':String(before.position.x),behavior:JSON.stringify(before.behavior),'body-yaw':String(before.orientation.yaw),shape:before.design.body.shape,activity:before.activity};assert.equal(applied[key],value,`${id} control reaches the live public API`);await page.selectOption('#site-framework',mode==='react'?'element':'react');frame=await frameFor(page);await page.waitForTimeout(100);assert.deepEqual(await snapshot(frame),before,`${id} framework change preserves live values`);
   await page.locator('[data-state-try]').click();await frameFor(page);assert.match(page.url(),/api-playground/);assert.equal((['behavior','presence'].includes(key)?JSON.stringify(JSON.parse(await page.locator(`[data-state-control="${key}"]`).inputValue())):await page.locator(`[data-state-control="${key}"]`).inputValue()),value);assert.equal(await page.locator('[data-state-source]').getAttribute('data-framework'),mode==='react'?'element':'react');
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
  if(process.env.SIDEKICK_SCREENSHOTS){await mkdir(process.env.SIDEKICK_SCREENSHOTS,{recursive:true});await page.locator('.state-lab iframe').scrollIntoViewIfNeeded();await page.screenshot({path:process.env.SIDEKICK_SCREENSHOTS+'/state-reference-320.png'});await page.setViewportSize({width:1280,height:900});await page.locator('.state-lab').evaluate(el=>window.scrollTo(0,scrollY+el.getBoundingClientRect().top-90));await page.waitForTimeout(100);await page.screenshot({path:process.env.SIDEKICK_SCREENSHOTS+'/state-reference-desktop.png'});}
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

async function entranceSettled(frame, declaration) {
 await frame.waitForFunction(expected=>{
  const bot=document.querySelector('#reference-bot');
  return bot?.ready&&JSON.stringify(bot.entrance)===JSON.stringify(expected)&&bot.presenceState==='visible'&&bot.movementState.phase==='idle';
 },declaration);
 return frame.locator('#reference-bot').evaluate(bot=>{
  const rect=element=>{const {left,top,width,height}=element.getBoundingClientRect();return {left,top,width,height};};
  return {entrance:bot.entrance,design:bot.design,position:bot.position,box:rect(bot),target:rect(document.querySelector('#reference-target')),viewport:{width:innerWidth,height:innerHeight}};
 });
}
function assertEntranceGeometry(actual) {
 const {entrance:c,box:b,target:t,viewport:v}=actual,at=c.at??.5;
 let x,y;
 if(c.source==='viewport'){
  x=at*(v.width-b.width);y=at*(v.height-b.height);
  if(c.edge==='left')x=c.inset;if(c.edge==='right')x=v.width-b.width-c.inset;
  if(c.edge==='top')y=c.inset;if(c.edge==='bottom')y=v.height-b.height-c.inset;
 }else{
  x=t.left+(t.width-b.width)*at;y=t.top+(t.height-b.height)*at;
  if(c.direction==='left')x=t.left-b.width-c.gap;if(c.direction==='right')x=t.left+t.width+c.gap;
  if(c.direction==='top')y=t.top-b.height-c.gap;if(c.direction==='bottom')y=t.top+t.height+c.gap;
 }
 assert.ok(Math.abs(b.left-x)<1,`entrance x ${b.left} ≈ ${x}`);assert.ok(Math.abs(b.top-y)<1,`entrance y ${b.top} ≈ ${y}`);
}
for(const locale of ['ko','en','zh-CN','ja'])for(const mode of ['element','react'])test(`declarative entrance source, geometry and configured bot: ${locale}/${mode}`,{timeout:120000},async()=>{
 const {createScene}=await import('../dist/src/core/scene.js'),{createDesign}=await import('../dist/src/core/design.js');
 const scene=createScene({design:createDesign({body:{shape:'heart',color:'#345678'}}),trackingMode:'off',activity:'still'});
 const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(scene=>localStorage.setItem('sidekick.studio.scene.v3',JSON.stringify(scene)),scene);
 try{
  await page.goto(`${base}/guide.html?lang=${locale}&framework=${mode}#state-entrance`);const frame=await frameFor(page);
  await page.locator('.state-lab iframe').scrollIntoViewIfNeeded();
  const change=async(key,value)=>{const input=page.locator(`[data-entrance-control="${key}"]`);if(await input.evaluate(e=>e.tagName)==='SELECT')await input.selectOption(value);else{await input.fill(value);await input.dispatchEvent('change');}};
  for(const source of ['element','viewport']){
   await change('source',source);
   for(const side of ['left','right','top','bottom']){
    await change('side',side);await change('at','0.3');await change('distance','12');
    const declaration=source==='element'?{source,target:'#reference-target',direction:side,at:.3,gap:12}:{source,edge:side,at:.3,inset:12};
    const actual=await entranceSettled(frame,declaration);assertEntranceGeometry(actual);assert.deepEqual(actual.design,scene.design);
    const code=await page.locator('[data-state-source]').textContent();assert.doesNotMatch(code,/\.enter\(/);
    if(mode==='react'){const props=JSON.parse(code.split('const avatarProps = ')[1].split(';\n\nexport')[0]);assert.deepEqual(props.entrance,declaration);assert.equal(props.placement,'viewport');assert.doesNotMatch(code,/<sidekick-avatar/);}
    else{const payload=await page.evaluate(source=>JSON.parse(new DOMParser().parseFromString(source,'text/html').querySelector('sidekick-avatar').getAttribute('entrance')),code);assert.deepEqual(payload,declaration);assert.doesNotMatch(code,/<SidekickAvatar/);}
   }
  }
  await page.setViewportSize({width:320,height:640});await change('source','element');
  const mobile=await entranceSettled(frame,{source:'element',target:'#reference-target',direction:'right',at:.5,gap:16});assertEntranceGeometry(mobile);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  assert.equal(await page.evaluate(()=>localStorage.getItem('sidekick.studio.scene.v3')),JSON.stringify(scene));
  await page.locator('[data-state-try]').click();await frameFor(page);assert.equal(await page.inputValue('[data-entrance-control="source"]'),'element');
  assert.deepEqual(errors,[]);
 }finally{await page.close();}
});

test('copied entrance examples replay the exact source declaration and canvas geometry', {timeout:120000},async()=>{
 const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});
 try{
  for(const mode of ['element','react'])for(const source of ['element','viewport']){
   await page.goto(`${base}/guide.html?lang=en&framework=${mode}#state-entrance`);const frame=await frameFor(page);await page.locator('.state-lab iframe').scrollIntoViewIfNeeded();
   await page.selectOption('[data-entrance-control="source"]',source);
   const declaration=source==='element'?{source,target:'#reference-target',direction:'right',at:.5,gap:16}:{source,edge:'left',at:.5,inset:24};
   const expected=await entranceSettled(frame,declaration),code=await page.locator('[data-state-source]').textContent();
   const replay=await browser.newPage({viewport:expected.viewport,reducedMotion:'reduce'});
   try{
    let html=code.replace("'@hanana-kick/sidekick/auto'",`'${base}/browser/sidekick.js'`);
    if(mode==='react'){
     const output=ts.transpileModule(`import React from 'react';\nimport {createRoot} from 'react-dom/client';\n${code}\ncreateRoot(document.getElementById('root')).render(<StateExample />);`,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
     const imports={react:`${base}/react.js`,'react-dom/client':`${base}/react-dom-client.js`,'@hanana-kick/sidekick/react':`${base}/browser/sidekick-react.js`};
     html=`<!doctype html><div id="root"></div><script type="importmap">${JSON.stringify({imports})}</script><script type="module">${output}</script>`;
     for(const name of ['react','react-dom-client'])await replay.route(`${base}/${name}.js`,async route=>route.fulfill({contentType:'text/javascript',body:await readFile(new URL(`../cdn/react-19.3.1/${name}.js`,import.meta.url),'utf8')}));
    }
    await replay.route(`${base}/entrance-replay.html`,route=>route.fulfill({contentType:'text/html',body:html}));await replay.goto(`${base}/entrance-replay.html`);
    const actual=await entranceSettled(replay,declaration);assertEntranceGeometry(actual);assert.deepEqual(actual.design,expected.design);assert.deepEqual(actual.entrance,expected.entrance);
    for(const axis of ['left','top','width','height'])assert.ok(Math.abs(actual.box[axis]-expected.box[axis])<1,axis+' matches the copied preview');
   }finally{await replay.close();}
  }
 }finally{await page.close();}
});
test('reference workspace aligns headings and preview at desktop and narrow widths', {timeout:120000}, async()=>{
 const page=await browser.newPage({reducedMotion:'reduce'});
 try{
  for(const width of [1280,390,320])for(const locale of ['ko','en','zh-CN','ja']){
   await page.setViewportSize({width,height:900});
   await page.goto(`${base}/guide.html?lang=${locale}#state-emotion`);const frame=await frameFor(page);
   await page.locator('.state-lab').scrollIntoViewIfNeeded();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   const boxes=await page.locator('.state-lab-grid').evaluate(grid=>{const bounds=selector=>{const r=grid.querySelector(selector).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};return{controls:bounds('.state-lab-control-panel>h3'),preview:bounds('.state-lab-preview>h3'),frame:bounds('iframe')};});
   if(width===1280)assert.ok(Math.abs(boxes.controls.y-boxes.preview.y)<2,'column headings share a baseline');
   else assert.ok(boxes.preview.y<boxes.controls.y,'preview precedes controls on mobile');
   const center=await frame.locator('#reference-bot').evaluate(bot=>{const b=bot.getBoundingClientRect();return Math.abs(b.x+b.width/2-innerWidth/2);});assert.ok(center<2,`preview bot centered: ${width}/${locale}`);
   assert.equal(await page.locator('.state-lab-preview [data-state-source]').count(),1,'source belongs to the preview');
   if(process.env.SIDEKICK_SCREENSHOTS&&locale==='ko'){await mkdir(process.env.SIDEKICK_SCREENSHOTS,{recursive:true});await page.locator('.state-lab').evaluate(el=>window.scrollTo(0,scrollY+el.getBoundingClientRect().top-100));await page.screenshot({path:`${process.env.SIDEKICK_SCREENSHOTS}/state-alignment-${width}.png`});}
  }
 }finally{await page.close();}
});

test('positioning controls generate matching CE and React placements without coordinate arithmetic',{timeout:120000},async()=>{
 const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});
 try{for(const mode of ['element','react']){
  await page.goto(`${base}/guide.html?lang=en&framework=${mode}#state-position`);await frameFor(page);await page.check('[data-state-enable="positioning"]');
  for(const gap of [16,0,-20]) for(const target of ['viewport','#reference-target']){
   await edit(page,'movement-bounds','none');
   await page.fill('[data-positioning-control="gap"]',String(gap));await page.dispatchEvent('[data-positioning-control="gap"]','change');
   await page.selectOption('[data-positioning-control="target"]',target);
   for(const placement of ['top-left','top-center','top-right','center-left','center','center-right','bottom-left','bottom-center','bottom-right']){
    await page.selectOption('[data-positioning-control="placement"]',placement);await page.waitForTimeout(80);
    const frame=await frameFor(page);await page.locator('.state-lab iframe').scrollIntoViewIfNeeded();
    const result=await frame.evaluate(()=>{const bot=document.querySelector('#reference-bot'),config=bot.positioning,r=bot.getBoundingClientRect(),t=config.target==='viewport'?{left:0,top:0,width:innerWidth,height:innerHeight}:document.querySelector(config.target).getBoundingClientRect();return{config,r:{left:r.left,top:r.top,width:r.width,height:r.height},t:{left:t.left,top:t.top,width:t.width,height:t.height}};});
    assert.equal(result.config.gap,gap);assert.equal(result.config.placement,placement);assert.equal(result.config.target,target);
    const [v,h]=placement==='center'?['center','center']:placement.split('-'),viewport=target==='viewport';
    const axis=(part,start,size,own)=>part==='center'?start+(size-own)/2:['left','top'].includes(part)?start+(viewport?gap:-own-gap):start+size-(viewport?own+gap:-gap);
    assert.ok(Math.abs(result.r.left-axis(h,result.t.left,result.t.width,result.r.width))<1);assert.ok(Math.abs(result.r.top-axis(v,result.t.top,result.t.height,result.r.height))<1);
    const source=await page.locator('[data-state-source]').textContent();assert.match(source,/positioning/);assert.match(source,new RegExp(String(gap)));assert.match(source,new RegExp(placement));
   }
  }
 }}finally{await page.close();}
});

// Every meaningful discrete behavior/side/target choice, including omitted defaults.
// Numeric domains are sampled at zero, normal and upper boundary, not called exhaustive.
const behaviorMatrix=[];
for(const type of ['wait','follow','guide','review'])for(const side of [undefined,'left','right','above','below'])for(const target of ['#reference-target','.reference-item'])for(const gap of [undefined,0,16,10000]){
 behaviorMatrix.push({type,...(type==='review'?{targets:target,dwell:0}:{target,duration:0}),...(side===undefined?{}:{side}),...(gap===undefined?{}:{gap})});
}
for(const type of ['idle','celebrate','error'])behaviorMatrix.push({type,duration:0});
function assertBehaviorBox(box,label){assert.ok(box.left>=-1&&box.top>=-1&&box.right<=box.viewportWidth+1&&box.bottom<=box.viewportHeight+1,`${label}: ${JSON.stringify(box)}`);}
async function trackBehavior(frame){
 await frame.evaluate(()=>{
  window.behaviorSamples=[];
  const rect=()=>{const bot=document.querySelector('#reference-bot'),b=bot.getBoundingClientRect();return {left:b.left,top:b.top,right:b.right,bottom:b.bottom,width:b.width,height:b.height,viewportWidth:innerWidth,viewportHeight:innerHeight};};
  window.behaviorRect=rect;
  // Capture every acting item, not just the last review destination.
  document.addEventListener('sidekick-behavior-change',event=>{if(event.detail.status==='acting'){const declaration=window.expectedBehavior;const target=declaration&&(declaration.target||declaration.targets)?document.querySelectorAll(declaration.target||declaration.targets)[event.detail.itemIndex]:null;const b=target?.getBoundingClientRect();window.behaviorSamples.push({state:event.detail,box:rect(),target:b?{left:b.left,top:b.top,width:b.width,height:b.height}:null});}});
 });
}
async function settledBehavior(frame,declaration,previousId){
 await frame.waitForFunction(expected=>{const bot=document.querySelector('#reference-bot');return bot?.ready&&bot.behaviorState.id>expected.previousId&&bot.behaviorState.type===expected.type&&bot.behaviorState.status==='completed';},{...declaration,previousId});
 return frame.evaluate(()=>({box:window.behaviorRect(),samples:window.behaviorSamples.splice(0),state:document.querySelector('#reference-bot').behaviorState}));
}
for(const mode of ['element','react'])for(const width of [320,1280])test(`behavior bounds matrix: ${mode}, ${width}px, 163 declarations`,{timeout:300000},async()=>{
 const page=await browser.newPage({viewport:{width,height:800},reducedMotion:'reduce'});
 try{
  await page.goto(`${base}/guide.html?lang=en&framework=${mode}#state-behavior`);const frame=await frameFor(page);await page.check('[data-state-enable="behavior"]');await page.locator('.state-lab iframe').scrollIntoViewIfNeeded();await frame.waitForFunction(()=>document.querySelector('#reference-bot').behaviorState.status==='acting');await trackBehavior(frame);
  assert.equal(behaviorMatrix.length,163);
  for(const declaration of behaviorMatrix){
   const previousId=await frame.evaluate(declaration=>{window.behaviorSamples=[];window.expectedBehavior=declaration;return document.querySelector('#reference-bot').behaviorState.id;},declaration);
   await edit(page,'behavior',JSON.stringify(declaration));await page.locator('.state-lab iframe').scrollIntoViewIfNeeded();
   const actual=await settledBehavior(frame,declaration,previousId),label=JSON.stringify(declaration);
   assertBehaviorBox(actual.box,label);
   const count=declaration.type==='review'&&declaration.targets==='.reference-item'?3:1;
   assert.equal(actual.samples.length,count,label+' visits every target');
   for(const sample of actual.samples){
    assertBehaviorBox(sample.box,label+' item '+sample.state.itemIndex);
    if(sample.target){const b=sample.box,t=sample.target,side=declaration.side??'right',gap=declaration.gap??16;let x=t.left+(t.width-b.width)/2,y=t.top+(t.height-b.height)/2;if(side==='left')x=t.left-b.width-gap;if(side==='right')x=t.left+t.width+gap;if(side==='above')y=t.top-b.height-gap;if(side==='below')y=t.top+t.height+gap;x=Math.max(0,Math.min(b.viewportWidth-b.width,x));y=Math.max(0,Math.min(b.viewportHeight-b.height,y));assert.ok(Math.abs(b.left-x)<1&&Math.abs(b.top-y)<1,label+' exact clamped destination');}
   }
   assert.equal(actual.state.completedItems,['idle','celebrate','error'].includes(declaration.type)?0:count);
  }
  // Real preset choices and their default-duration path, then disabling/resetting.
  for(const type of ['wait','follow','guide','review','idle','celebrate','error']){
   await page.selectOption('[data-behavior-preset]',type);await page.locator('.state-lab iframe').scrollIntoViewIfNeeded();
   await frame.waitForFunction(type=>{const bot=document.querySelector('#reference-bot');return bot?.behaviorState.type===type&&['acting','completed'].includes(bot.behaviorState.status);},type);
   assertBehaviorBox(await frame.evaluate(()=>window.behaviorRect()),type+' preset');
  }
  await page.uncheck('[data-state-enable="behavior"]');await frameFor(page);
  assert.equal(await frame.locator('#reference-bot').evaluate(bot=>bot.behavior),null);
  await page.locator('[data-state-text="reset"]').click();await frameFor(page);
  assert.equal(await frame.locator('#reference-bot').evaluate(bot=>bot.placement),'viewport');
  if(process.env.SIDEKICK_SCREENSHOTS){await mkdir(process.env.SIDEKICK_SCREENSHOTS,{recursive:true});await page.locator('.state-lab iframe').scrollIntoViewIfNeeded();await page.screenshot({path:`${process.env.SIDEKICK_SCREENSHOTS}/behavior-bounds-${mode}-${width}.png`});}
 }finally{await page.close();}
});

test('behavior copied CE/React source keeps all four sides and review in a narrow viewport',{timeout:120000},async()=>{
 const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'});
 try{for(const mode of ['element','react']){
  await page.goto(`${base}/guide.html?lang=en&framework=${mode}#state-behavior`);const frame=await frameFor(page);
  for(const declaration of [...['left','right','above','below'].map(side=>({type:'wait',target:'#reference-target',side,gap:16,duration:0})),{type:'review',targets:'.reference-item',side:'below',gap:10000,dwell:0}]){
   const previousId=await frame.locator('#reference-bot').evaluate(bot=>bot.behaviorState.id);
   await edit(page,'behavior',JSON.stringify(declaration));await page.locator('.state-lab iframe').scrollIntoViewIfNeeded();
   await frame.waitForFunction(({type,previousId})=>document.querySelector('#reference-bot').behaviorState.id>previousId&&document.querySelector('#reference-bot').behaviorState.type===type&&document.querySelector('#reference-bot').behaviorState.status==='completed',{type:declaration.type,previousId});
   const source=await page.locator('[data-state-source]').textContent(),replay=await browser.newPage({viewport:{width:240,height:320},reducedMotion:'reduce'});
   try{
    let html=source.replace("'@hanana-kick/sidekick/auto'",`'${base}/browser/sidekick.js'`);
    if(mode==='react'){
     const output=ts.transpileModule(`import React from 'react';\nimport {createRoot} from 'react-dom/client';\n${source}\ncreateRoot(document.getElementById('root')).render(<StateExample />);`,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
     const imports={react:`${base}/react.js`,'react-dom/client':`${base}/react-dom-client.js`,'@hanana-kick/sidekick/react':`${base}/browser/sidekick-react.js`};
     html=`<!doctype html><div id="root"></div><script type="importmap">${JSON.stringify({imports})}</script><script type="module">${output}</script>`;
     for(const name of ['react','react-dom-client'])await replay.route(`${base}/${name}.js`,async route=>route.fulfill({contentType:'text/javascript',body:await readFile(new URL(`../cdn/react-19.3.1/${name}.js`,import.meta.url),'utf8')}));
    }
    await replay.route(`${base}/behavior-replay.html`,route=>route.fulfill({contentType:'text/html',body:html}));await replay.goto(`${base}/behavior-replay.html`);
    await replay.waitForFunction(()=>document.querySelector('#reference-bot')?.ready&&document.querySelector('#reference-bot').behaviorState.status==='completed');
    const actual=await replay.locator('#reference-bot').evaluate(bot=>{const b=bot.getBoundingClientRect();return {box:{left:b.left,top:b.top,right:b.right,bottom:b.bottom,viewportWidth:innerWidth,viewportHeight:innerHeight},state:bot.behaviorState,placement:bot.placement,bounds:bot.movementBounds};});
    assertBehaviorBox(actual.box,mode+' copied '+JSON.stringify(declaration));assert.equal(actual.placement,'viewport');assert.equal(actual.bounds,'viewport');assert.equal(actual.state.completedItems,declaration.type==='review'?3:1);
   }finally{await replay.close();}
  }
 }}finally{await page.close();}
});

for(const mode of ['element','react'])test(`behavior normal-motion paths, interruption and resize: ${mode}`,{timeout:120000},async()=>{
 const page=await browser.newPage({viewport:{width:900,height:700},reducedMotion:'no-preference'});
 try{
  await page.goto(`${base}/guide.html?lang=en&framework=${mode}#state-behavior`);const frame=await frameFor(page);
  await page.check('[data-state-enable="behavior"]');await page.locator('.state-lab iframe').scrollIntoViewIfNeeded();await frame.waitForFunction(()=>document.querySelector('#reference-bot').behaviorState.status==='acting');await trackBehavior(frame);
  await frame.evaluate(()=>{window.pathSamples=[];window.samplePath=true;const sample=()=>{if(!window.samplePath)return;window.pathSamples.push(window.behaviorRect());requestAnimationFrame(sample);};requestAnimationFrame(sample);});
  for(const type of ['wait','follow','guide','review'])for(const side of ['left','right','above','below']){
   const declaration={type,...(type==='review'?{targets:'.reference-item',dwell:10}:{target:'#reference-target',duration:0}),side,gap:16};
   const previousId=await frame.locator('#reference-bot').evaluate(bot=>bot.behaviorState.id);
   await edit(page,'behavior',JSON.stringify(declaration));await page.locator('.state-lab iframe').scrollIntoViewIfNeeded();await settledBehavior(frame,declaration,previousId);
  }
  // Replacing active commands must not leave the previous trajectory running.
  await edit(page,'behavior',JSON.stringify({type:'follow',target:'#reference-target',side:'below',gap:10000}));
  await edit(page,'behavior',JSON.stringify({type:'wait',target:'.reference-item',side:'above',gap:0}));await page.locator('.state-lab iframe').scrollIntoViewIfNeeded();
  await frame.waitForFunction(()=>document.querySelector('#reference-bot').behaviorState.type==='wait'&&document.querySelector('#reference-bot').behaviorState.status==='acting');
  await page.setViewportSize({width:320,height:600});await page.waitForTimeout(500);
  assertBehaviorBox(await frame.evaluate(()=>window.behaviorRect()),'after responsive resize');
  const samples=await frame.evaluate(()=>{window.samplePath=false;return window.pathSamples;});assert.ok(samples.length>20);
  // The viewport changes synchronously before ResizeObserver applies its new bounds;
  // those resize frames are checked above after settling, not as animation defects.
  const originalWidth=samples[0].viewportWidth;
  for(const box of samples.filter(box=>box.viewportWidth===originalWidth))assertBehaviorBox(box,'normal animation frame');
  await edit(page,'behavior',JSON.stringify({type:'wait',target:'#missing-target',timeout:0}));
  await frame.waitForFunction(()=>document.querySelector('#reference-bot').behaviorState.status==='error');
  assertBehaviorBox(await frame.evaluate(()=>window.behaviorRect()),'missing target leaves bot visible');
 }finally{await page.close();}
});

for(const mode of ['element','react'])for(const width of [320,1280])test(`explicit size preserves active behavior anchoring: ${mode}, ${width}px`,{timeout:120000},async()=>{
 const page=await browser.newPage({viewport:{width,height:800},reducedMotion:'no-preference'});
 try{
  await page.goto(`${base}/guide.html?lang=en&framework=${mode}#state-behavior`);const frame=await frameFor(page);
  await page.check('[data-state-enable="behavior"]');await page.locator('.state-lab iframe').scrollIntoViewIfNeeded();
  for(const side of ['left','right','above','below']){
   await edit(page,'behavior',JSON.stringify({type:'wait',target:'#reference-target',side,gap:16}));
   await frame.waitForFunction(side=>{const bot=document.querySelector('#reference-bot');return bot.behavior?.side===side&&bot.behaviorState.status==='acting';},side);
   for(const size of [48,96,160.5]){
    await frame.locator('#reference-bot').evaluate((bot,size)=>{bot.size=size;},size);
    await frame.waitForFunction(({side,size})=>{
     const bot=document.querySelector('#reference-bot'),b=bot.getBoundingClientRect(),t=document.querySelector('#reference-target').getBoundingClientRect();
     let x=t.left+(t.width-b.width)/2,y=t.top+(t.height-b.height)/2;
     if(side==='left')x=t.left-b.width-16;if(side==='right')x=t.right+16;if(side==='above')y=t.top-b.height-16;if(side==='below')y=t.bottom+16;
     x=Math.max(0,Math.min(innerWidth-b.width,x));y=Math.max(0,Math.min(innerHeight-b.height,y));
     return bot.behaviorState.status==='acting'&&Math.abs(b.width-size)<.01&&Math.abs(b.height-size)<.01&&Math.abs(b.left-x)<1&&Math.abs(b.top-y)<1;
    },{side,size});
   }
  }
  await frame.locator('#reference-bot').evaluate(bot=>{bot.size=null;bot.stopBehavior();});
 }finally{await page.close();}
});

// Existing coverage starts at two viewport widths and performs one late shrink.
// These cases resize the same live document in both axes, including during a
// running move. A vh-sized preview makes parent-height changes real iframe
// viewport changes instead of merely resizing whitespace around a fixed iframe.
const liveResizeSteps=[
 {viewport:{width:320,height:520},sizes:[48]},
 {viewport:{width:1280,height:1000},sizes:[72,96]},
 {viewport:{width:1280,height:460},sizes:[160.5]},
 {viewport:{width:700,height:900},sizes:[96,72]},
];
async function resizeLiveReference(page,frame,step){
 const before=await frame.evaluate(()=>({width:innerWidth,height:innerHeight}));
 await frame.locator('#reference-bot').evaluate((bot,sizes)=>{for(const size of sizes)bot.size=size;},step.sizes);
 await page.setViewportSize(step.viewport);
 await page.locator('.state-lab iframe').scrollIntoViewIfNeeded();
 await frame.waitForFunction(previous=>innerWidth!==previous.width||innerHeight!==previous.height,before);
 // ResizeObserver and movement constraints run after layout. Do not classify the
 // synchronous pre-observer resize frame as an animation escape.
 await frame.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const samples=await frame.evaluate(async()=>{const samples=[];for(let i=0;i<6;i++){await new Promise(requestAnimationFrame);samples.push(window.behaviorRect());}return samples;});
 for(const sample of samples)assertBehaviorBox(sample,'live viewport resize');
 return samples.at(-1);
}
async function assertLiveBacking(frame,size){
 const actual=await frame.locator('#reference-bot').evaluate(async bot=>{
  const bitmap=await createImageBitmap(await bot.snapshot({crop:false}));
  const result={width:bitmap.width,height:bitmap.height,dpr:devicePixelRatio,graphics:bot.diagnostics.graphics,size:bot.size};bitmap.close();return result;
 });
 assert.equal(actual.size,size);assert.equal(actual.graphics,forceCanvas?'canvas2d':'webgl2');
 const expected=Math.max(1,Math.round(size*Math.min(Math.max(actual.dpr,1),2,(forceCanvas?384:2048)/size)));
 assert.deepEqual([actual.width,actual.height],[expected,expected],'backing follows latest size and DPR after viewport changes');
}
async function waitForLiveAnchor(frame,side,size){
 await frame.waitForFunction(({side,size})=>{
  const bot=document.querySelector('#reference-bot'),b=bot.getBoundingClientRect(),t=document.querySelector('#reference-target').getBoundingClientRect();
  let x=t.left+(t.width-b.width)/2,y=t.top+(t.height-b.height)/2;
  if(side==='right')x=t.right+16;else if(side==='below')y=t.bottom+16;
  x=Math.max(0,Math.min(innerWidth-b.width,x));y=Math.max(0,Math.min(innerHeight-b.height,y));
  return bot.behaviorState.status==='acting'&&Math.abs(b.width-size)<.01&&Math.abs(b.height-size)<.01&&Math.abs(b.left-x)<1&&Math.abs(b.top-y)<1;
 },{side,size});
 assertBehaviorBox(await frame.evaluate(()=>window.behaviorRect()),'realigned target after viewport resize');
}
for(const mode of ['element','react'])test(`live viewport shrink, grow and height changes during motion: ${mode}`,{timeout:120000},async()=>{
 const page=await browser.newPage({viewport:{width:1000,height:800},deviceScaleFactor:2,reducedMotion:'no-preference'});
 try{
  await page.goto(`${base}/guide.html?lang=en&framework=${mode}#state-behavior`);const frame=await frameFor(page);
  await page.locator('.state-lab iframe').evaluate(iframe=>{iframe.style.height='55vh';});
  await page.locator('.state-lab iframe').scrollIntoViewIfNeeded();await trackBehavior(frame);
  await frame.evaluate(async()=>{
   const bot=document.querySelector('#reference-bot');bot.stopBehavior();bot.size=72;bot.placement='viewport';bot.movementBounds='viewport';
   await bot.moveTo({x:0,y:0},{duration:0});window.viewportMoveResult=null;
   window.viewportMove=bot.moveTo({x:innerWidth-72,y:innerHeight-72},{duration:10000,travel:'none'}).then(result=>window.viewportMoveResult=result);
  });
  await frame.waitForFunction(()=>document.querySelector('#reference-bot').movementState.phase==='flight');
  const dimensions=[];
  for(const step of liveResizeSteps){
   assert.equal(await frame.evaluate(()=>window.viewportMoveResult),null,'viewport sequence starts while original move remains in flight');
   const box=await resizeLiveReference(page,frame,step);dimensions.push([box.viewportWidth,box.viewportHeight]);
   await assertLiveBacking(frame,step.sizes.at(-1));
  }
  assert.equal(new Set(dimensions.map(([w,h])=>`${w}x${h}`)).size,liveResizeSteps.length,'each resize changes the actual child viewport');
  const result=await frame.evaluate(async()=>{document.querySelector('#reference-bot').paused=true;return await window.viewportMove;});
  assert.equal(result.finished,true,'resize does not cancel the original move; explicit pause finishes it');
  assertBehaviorBox(await frame.evaluate(()=>window.behaviorRect()),'finished resized move');
 }finally{await page.close();}
});
for(const mode of ['element','react'])test(`live viewport and consecutive size changes preserve wait/follow anchors: ${mode}`,{timeout:120000},async()=>{
 const page=await browser.newPage({viewport:{width:1000,height:800},deviceScaleFactor:2,reducedMotion:'no-preference'});
 try{
  await page.goto(`${base}/guide.html?lang=en&framework=${mode}#state-behavior`);const frame=await frameFor(page);
  await page.locator('.state-lab iframe').evaluate(iframe=>{iframe.style.height='55vh';});
  await page.check('[data-state-enable="behavior"]');await page.locator('.state-lab iframe').scrollIntoViewIfNeeded();await trackBehavior(frame);
  for(const [type,side]of [['wait','right'],['follow','below']]){
   await edit(page,'behavior',JSON.stringify({type,target:'#reference-target',side,gap:16}));
   await frame.waitForFunction(({type,side})=>{const bot=document.querySelector('#reference-bot');return bot.behavior?.type===type&&bot.behavior?.side===side&&bot.behaviorState.status==='acting';},{type,side});
   const id=await frame.locator('#reference-bot').evaluate(bot=>bot.behaviorState.id);
   for(const step of liveResizeSteps){
    await resizeLiveReference(page,frame,step);const size=step.sizes.at(-1);
    await waitForLiveAnchor(frame,side,size);await assertLiveBacking(frame,size);
    assert.equal(await frame.locator('#reference-bot').evaluate(bot=>bot.behaviorState.id),id,'resize must not restart behavior');
   }
  }
 }finally{await page.close();}
});
