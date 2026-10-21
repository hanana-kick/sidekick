import test, {before,after} from 'node:test';
import assert from 'node:assert/strict';
import {accessSync,constants} from 'node:fs';
import {chromium} from 'playwright-core';
import {createAppServer} from '../scripts/serve.mjs';

// Exercise the real authored child document at the split preview's exact dimensions.
let browser,launcher,server,base;
before(async()=>{
 server=createAppServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
 launcher=await chromium.launchServer({executablePath:[process.env.CHROMIUM_PATH,'/opt/google/chrome/chrome','/usr/bin/chromium'].find(path=>{if(!path)return false;try{accessSync(path,constants.X_OK);return true;}catch{return false;}}),host:'127.0.0.1',headless:true,chromiumSandbox:true,ignoreDefaultArgs:true,args:['--headless','--remote-debugging-pipe','--no-startup-window']});
 browser=await chromium.connect(launcher.wsEndpoint());
});
after(async()=>{await browser?.close();await launcher?.close();if(server)await new Promise(resolve=>server.close(resolve));});
async function preview(t,width,height){
 const page=await browser.newPage({viewport:{width:1400,height:800},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 t.after(async()=>{await page.close();assert.deepEqual(errors,[],'no preview runtime errors');});
 await page.setContent(`<iframe title="Community preview" style="display:block;border:0;width:${width}px;height:${height}px" src="${base}/api-demo.html?site=community&lang=en"></iframe>`);
 const frame=await (await page.locator('iframe').elementHandle()).contentFrame();
 await frame.locator('.th-nav').waitFor();await frame.locator('.th-nav [data-nav="notifications"]').click();
 await frame.locator('.th-empty').waitFor();return {page,frame};
}
async function geometry(locator){return locator.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height,viewportWidth:innerWidth,viewportHeight:innerHeight,hit:!!hit&&(el===hit||el.contains(hit))};});}
function usable(r,label,min=40){assert.ok(r.left>=0&&r.right<=r.viewportWidth&&r.top>=0&&r.bottom<=r.viewportHeight,`${label} in child viewport: ${JSON.stringify(r)}`);assert.ok(r.width>=min&&r.height>=min,`${label} retains its target size: ${JSON.stringify(r)}`);assert.equal(r.hit,true,`${label} receives pointer hits`);}

for(const width of [600,601,1200])test(`community ${width}×438 keeps every navigation and Compose action reachable`,{timeout:60000},async t=>{
 const {frame}=await preview(t,width,438);
 for(const button of await frame.locator('.th-nav button,.th-compose-link').all())usable(await geometry(button),await button.getAttribute('aria-label'),width>600?44:40);
 if(width>600){usable(await geometry(frame.locator('.th-my-profile')),'self profile',44);assert.equal(await frame.locator('.th-left').evaluate(el=>el.scrollHeight<=el.clientHeight+1),true,'compact rail fits without scrolling at 438px');}
 else {assert.equal(await frame.locator('.th-left').evaluate(el=>getComputedStyle(el).position),'fixed');const compose=await geometry(frame.locator('.th-compose-link')),nav=await geometry(frame.locator('.th-nav button').first());assert.ok(Math.abs(compose.top-nav.top)<=4,'mobile empty-state Compose remains in bottom navigation');}
 await frame.locator('.th-compose-link').click();assert.equal(await frame.locator('#th-compose-text').evaluate(el=>el===document.activeElement),true);
 await frame.locator('.th-nav [data-nav="profile"]').click();assert.equal(await frame.locator('#th-info').evaluate(el=>el.open),true);
});

test('community very short desktop rail scrolls focused actions into view without shrinking them',{timeout:60000},async t=>{
 const {page,frame}=await preview(t,601,240);
 assert.equal(await frame.locator('.th-left').evaluate(el=>getComputedStyle(el).overflowY),'auto');
 await frame.locator('.th-nav button').first().focus();
 const selectors=['[data-nav="home"]','[data-nav="explore"]','[data-nav="notifications"]','[data-nav="saved"]','[data-nav="profile"]','.th-compose-link','.th-my-profile'];
 for(let i=0;i<selectors.length;i++){
  if(i)await page.keyboard.press('Tab');
  const target=frame.locator(selectors[i].startsWith('[data-nav=')?'.th-nav '+selectors[i]:selectors[i]);assert.equal(await target.evaluate(el=>el===document.activeElement),true,selectors[i]);usable(await geometry(target),selectors[i],44);
 }
 assert.ok(await frame.locator('.th-left').evaluate(el=>el.scrollTop>0),'keyboard navigation scrolls the rail');
 await page.keyboard.press('Enter');assert.equal(await frame.locator('#th-info').evaluate(el=>el.open),true);
});
