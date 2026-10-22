import {speechBox} from '../playground/company-presentation.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {cheaperMatch,installDemoScenarios,scenarioCopy,scenarioPlacement,captureDemoEngagement} from '../playground/demo-scenarios.js';
function setup(t,site,markup,adapter={},beforeInstall=()=>false){
 const dom=new JSDOM(`<div id="root">${markup}</div><div id="bot"></div>`,{pretendToBeVisual:true,url:`https://sidekick.test/api-demo.html?site=${site}&sourceGeneration=4`});t.after(()=>dom.window.close());const w=dom.window,root=w.document.querySelector('#root'),bot=w.document.querySelector('#bot'),calls=[];
 const sourceEvents=[];Object.defineProperty(w,'parent',{value:{postMessage:data=>sourceEvents.push(data)}});
 const nativeTimeout=w.setTimeout.bind(w);w.setTimeout=(fn,ms,...args)=>nativeTimeout(fn,ms===180?0:ms,...args);
 w.matchMedia=()=>({matches:true});let observer;w.IntersectionObserver=class{constructor(cb){this.cb=cb;observer=this;}observe(){}disconnect(){} emit(target){this.cb([{target,isIntersecting:true,intersectionRatio:.7}]);}};
 const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
 for(const node of root.querySelectorAll('*'))node.getBoundingClientRect=()=>rect(100,50,200,100);
 const nativeRect=w.HTMLElement.prototype.getBoundingClientRect;
 w.HTMLElement.prototype.getBoundingClientRect=function(){return this.hasAttribute('data-company-speech-sizer')?rect(0,0,Math.min(280,w.innerWidth-16),47):nativeRect.call(this);};
 let botRect=rect(700,600,115,115);bot.getBoundingClientRect=()=>botRect;
 let presence=null;Object.defineProperty(bot,'presence',{get:()=>presence,set:value=>{presence=value;calls.push(['presence',value]);}});
 Object.defineProperty(bot,'position',{get:()=>({x:botRect.left,y:botRect.top})});bot.moveTo=async(point,options)=>{calls.push(['restore',point,options]);botRect=rect(point.x,point.y,115,115);};
 Object.assign(bot,{moveToElement:async(el,options)=>{calls.push(['move',el,options]);if(site==='company'){const r=el.getBoundingClientRect();botRect=rect(r.left+options.x,r.top+options.y,115,115);}},say:(text,options)=>{calls.push(['say',text,options]);if(site==='company'){const portal=w.document.createElement('div');portal.dataset.sidekickSpeech='';const shadow=portal.attachShadow({mode:'open'}),bubble=w.document.createElement('div');bubble.className='bubble';bubble.getBoundingClientRect=()=>speechBox(botRect,{width:Math.min(280,w.innerWidth-16),height:47},rect(0,0,w.innerWidth,w.innerHeight),options.placement);shadow.append(bubble);w.document.body.append(portal);}},clearSpeech:()=>{calls.push(['clear']);w.document.querySelector('[data-sidekick-speech]')?.remove();},cancelMove:()=>{},detachAnchor:()=>calls.push(['detach'])});
 const initialEngaged=beforeInstall(root,w);const api=installDemoScenarios({bot,root,site,adapter,initialEngaged,window:w});t.after(()=>api.dispose());return{w,root,bot,calls,api,sourceEvents,observe:el=>observer.emit(el)};
}
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
test('company scroll reaches real sections and speaks only once, with reduced motion',async t=>{
 const x=setup(t,'company','<section id="nova-design"></section>');const target=x.root.firstChild;x.observe(target);await flush();assert.equal(x.calls.filter(c=>c[0]==='say').length,0);
 x.w.dispatchEvent(new x.w.Event('scroll'));await flush();assert.equal(x.calls.find(c=>c[0]==='move')[1],target);assert.equal(x.calls.find(c=>c[0]==='move')[2].duration,0);assert.equal(x.calls.filter(c=>c[0]==='say').length,1);
 assert.deepEqual(x.sourceEvents.map(e=>e.id),['nova-design']);
 x.observe(target);await flush();assert.equal(x.calls.filter(c=>c[0]==='say').length,1);
});
test('recommendations use saved fixtures, same category and strict cheaper price, never invented discounts',async t=>{
 const products=[{id:1,cat:2,price:89,name:'Saved coat'},{id:2,cat:2,price:64,name:'Other coat'},{id:3,cat:1,price:12,name:'Tee'}];
 assert.equal(cheaperMatch(products,[],2),null);assert.equal(cheaperMatch(products,[1],3),null);assert.equal(cheaperMatch(products,[2],1),null);
 let saved=[];const x=setup(t,'shop','<div id="muse-product-grid"><article data-product="2"></article></div>',{getScenarioState:()=>({products,saved})});const target=x.root.querySelector('article');x.observe(target);x.w.dispatchEvent(new x.w.Event('scroll'));await flush();assert.equal(x.calls.filter(c=>c[0]==='say').length,0);
 saved=[1];x.observe(target);await flush();assert.match(x.calls.find(c=>c[0]==='say')[1],/\$64, \$25 less/);assert.equal(x.calls.find(c=>c[0]==='move')[1],target);assert.deepEqual(x.sourceEvents.map(e=>e.id),['shop-cheaper']);
});
test('community arrivals trigger notification target speech; pause/dispose cancel stale motion',async t=>{
 const x=setup(t,'community','<button data-nav="notifications"></button><header class="th-feed-header"></header>');let resolve;x.bot.moveToElement=()=>new Promise(r=>resolve=r);
 x.root.dispatchEvent(new x.w.CustomEvent('sidekick-demo-arrival',{detail:{id:1,kind:'mention'}}));x.api.setPaused(true);resolve();await flush();assert.equal(x.calls.filter(c=>c[0]==='say').length,0);assert.deepEqual(x.sourceEvents,[]);
 x.api.setPaused(false);x.bot.moveToElement=async()=>{};x.root.dispatchEvent(new x.w.CustomEvent('sidekick-demo-arrival',{detail:{id:2,kind:'mention'}}));await flush();assert.match(x.calls.find(c=>c[0]==='say')[1],/Local demo.*mentioned/);assert.deepEqual(x.sourceEvents.map(e=>e.id),['community-mention-present']);x.api.dispose();assert.equal(x.calls.at(-1)[0],'detach');
});
test('all four locales explain on-site scenarios and local simulated notifications',()=>{
 for(const locale of ['ko','en','zh-CN','ja']){const t=scenarioCopy[locale];assert.equal(t.hint.length,3);assert.equal(t.company.length,4);for(const value of [...t.hint,...t.company,t.post,t.mention,t.localPost,t.localMention])assert.ok(value.length>8);}
});
test('the main experience has no floating control toolbar; privacy stays closed until requested',()=>{
 const html=readFileSync(new URL('../api-playground.html',import.meta.url),'utf8');assert.doesNotMatch(html,/class="flight-toolbar"|id="cancel-preview"/);
 const css=readFileSync(new URL('../playground/api-preview.css',import.meta.url),'utf8');assert.doesNotMatch(css,/#bot-tools(?:-launcher)?\{[^}]*position:fixed/);
 const analytics=readFileSync(new URL('../playground/site-analytics.js',import.meta.url),'utf8');assert.match(analytics,/panel.hidden = true/);
});
test('one-shot arrival during movement is queued and released after the cooldown',async t=>{
 const x=setup(t,'community','<button data-nav="notifications"></button><header class="th-feed-header"></header>');let resolve,clock=10000;const scheduled=new Map();let next=0;t.mock.method(Date,'now',()=>clock);
 x.w.setTimeout=(fn,ms)=>{scheduled.set(++next,{fn,ms});return next;};x.w.clearTimeout=id=>scheduled.delete(id);
 x.bot.moveToElement=()=>new Promise(r=>resolve=r);
 x.root.dispatchEvent(new x.w.CustomEvent('sidekick-demo-arrival',{detail:{id:1,kind:'post'}}));
 x.root.dispatchEvent(new x.w.CustomEvent('sidekick-demo-arrival',{detail:{id:2,kind:'mention'}}));resolve();await flush();
 assert.equal(x.calls.filter(c=>c[0]==='say').length,1);assert.deepEqual(x.sourceEvents.map(e=>e.id),['community-post-present']);const queued=[...scheduled.values()].find(job=>job.ms===7500);assert.ok(queued);
 clock+=8000;x.bot.moveToElement=async()=>{};queued.fn();await flush();assert.equal(x.calls.filter(c=>c[0]==='say').length,2);assert.match(x.calls.filter(c=>c[0]==='say')[1][1],/mentioned/);assert.deepEqual(x.sourceEvents.map(e=>e.id),['community-post-present','community-mention-present']);
});
test('offscreen completion releases its anchor instead of showing stale speech',async t=>{
 const x=setup(t,'company','<section id="nova-design"></section>');const target=x.root.firstChild;let resolve;x.bot.moveToElement=()=>new Promise(r=>resolve=r);x.observe(target);x.w.dispatchEvent(new x.w.Event('scroll'));await flush();target.getBoundingClientRect=()=>({width:200,height:100,top:-200,bottom:-100});resolve();await flush();assert.equal(x.calls.filter(c=>c[0]==='say').length,0);assert.ok(x.calls.some(c=>c[0]==='detach'));
});

test('leaving a narrated section lets the next visible section respond without the old cooldown',async t=>{
 const x=setup(t,'company','<section id="nova-design"></section><section id="nova-sound"></section>');
 const [first,second]=x.root.children;x.observe(first);x.w.dispatchEvent(new x.w.Event('scroll'));await flush();
 first.getBoundingClientRect=()=>({width:200,height:100,top:-200,bottom:-100});
 x.observe(second);x.w.dispatchEvent(new x.w.Event('scroll'));await flush();
 assert.equal(x.calls.filter(c=>c[0]==='say').length,2,'new visible story should not inherit a dismissed story cooldown');
});
test('queued shopping advice is revalidated when the saved reference is removed',async t=>{
 let saved=[1],clock=10000;const products=[{id:1,cat:2,price:89,name:'Saved coat'},{id:2,cat:2,price:64,name:'Coat A'},{id:3,cat:2,price:59,name:'Coat B'}];
 const x=setup(t,'shop','<div id="muse-product-grid"><article data-product="2"></article><article data-product="3"></article></div>',{getScenarioState:()=>({products,saved})});
 t.mock.method(Date,'now',()=>clock);const scheduled=new Map();let next=0;x.w.setTimeout=(fn,ms)=>{scheduled.set(++next,{fn,ms});return next;};x.w.clearTimeout=id=>scheduled.delete(id);
 const [first,second]=x.root.querySelectorAll('article');x.observe(first);x.w.dispatchEvent(new x.w.Event('scroll'));for(const job of [...scheduled.values()])if(job.ms===180)job.fn();await flush();x.observe(second);await flush();
 saved=[];clock+=8000;for(const job of [...scheduled.values()])job.fn();await flush();
 assert.equal(x.calls.filter(c=>c[0]==='say').length,1,'removed saved product cannot support later advice');
});
test('cancelled movement does not count as a delivered story',async t=>{
 const x=setup(t,'company','<section id="nova-design"></section>');x.bot.moveToElement=async()=>({finished:false});x.observe(x.root.firstChild);x.w.dispatchEvent(new x.w.Event('scroll'));await flush();
 assert.equal(x.calls.filter(c=>c[0]==='say').length,0,'do not announce arrival after a cancelled move');
});
test('removing the saved comparison dismisses currently visible shopping advice',async t=>{
 let saved=[1];const products=[{id:1,cat:2,price:89,name:'Saved coat'},{id:2,cat:2,price:64,name:'Coat'}];
 const x=setup(t,'shop','<div id="muse-product-grid"><article data-product="2"></article></div>',{getScenarioState:()=>({products,saved})});
 x.observe(x.root.querySelector('article'));x.w.dispatchEvent(new x.w.Event('scroll'));await flush();
 const before=x.calls.filter(c=>c[0]==='clear').length;saved=[];x.root.click();await flush();
 assert.ok(x.calls.filter(c=>c[0]==='clear').length>before,'an invalidated recommendation must not linger');
});
test('community notification arriving behind a modal waits until the dialog closes',async t=>{
 const x=setup(t,'community','<button data-nav="notifications"></button><header class="th-feed-header"></header><dialog open></dialog>');
 x.root.dispatchEvent(new x.w.CustomEvent('sidekick-demo-arrival',{detail:{id:7,kind:'mention'}}));await flush();
 assert.equal(x.calls.filter(c=>c[0]==='say').length,0,'a modal must not consume a hidden notification');
 const dialog=x.root.querySelector('dialog');dialog.removeAttribute('open');dialog.dispatchEvent(new x.w.Event('close'));await flush();
 assert.equal(x.calls.filter(c=>c[0]==='say').length,1,'closing the modal delivers the deferred notification');
});
test('a cancelled delivery does not discard an independent queued community arrival',async t=>{
 const x=setup(t,'community','<button data-nav="notifications"></button><header class="th-feed-header"></header>');let resolve;
 x.bot.moveToElement=()=>new Promise(r=>resolve=r);
 x.root.dispatchEvent(new x.w.CustomEvent('sidekick-demo-arrival',{detail:{id:1,kind:'post'}}));
 x.root.dispatchEvent(new x.w.CustomEvent('sidekick-demo-arrival',{detail:{id:2,kind:'mention'}}));
 x.bot.moveToElement=async()=>({finished:true});resolve({finished:false});await flush();
 assert.equal(x.calls.filter(c=>c[0]==='say').length,1);assert.match(x.calls.find(c=>c[0]==='say')[1],/mentioned/);
});

test('company observes the compact semantic target, not a tall enclosing section',async t=>{
 const x=setup(t,'company','<section id="nova-sound"><div class="nova-mode-tabs"></div></section>');
 const section=x.root.firstChild,target=section.firstChild;section.getBoundingClientRect=()=>({width:300,height:2000,top:-800,bottom:1200});
 x.observe(target);x.w.dispatchEvent(new x.w.Event('scroll'));await flush();
 assert.equal(x.calls.find(c=>c[0]==='move')[1],target);
 assert.equal(x.calls.find(c=>c[0]==='say')[2].dismissible,true);
});
test('narrow navigation and shopping placement reserve control clearance from actual box sizes',()=>{
 for(const viewport of [320,459]){
  const nav={left:viewport*.4,right:viewport*.6,top:370,bottom:428,width:viewport*.2,height:58};
  const p=scenarioPlacement('community',nav,115,115,viewport,428);
  assert.ok(nav.top+p.y+115<=nav.top-16,'bot ends above the bottom navigation');
  const image={left:0,right:150,top:80,bottom:300,width:150,height:220};
  const shop=scenarioPlacement('shop',image,115,115,viewport,428);
  assert.ok(image.top+shop.y>=image.top&&image.top+shop.y+115<=image.bottom,'bot stays in the image, above product actions');
 }
 const desktop=scenarioPlacement('community',{left:24,right:220,top:210,bottom:258,width:196,height:48},115,115,1280,800);
 assert.equal(220-115+desktop.x,232,'desktop bot clears the navigation to its right');
});
test('a clipped cheaper picture does not starve the next fully visible recommendation',async t=>{
 const products=[{id:1,cat:2,price:89,name:'Saved coat'},{id:2,cat:2,price:64,name:'Clipped coat'},{id:3,cat:2,price:59,name:'Visible coat'}];
 const x=setup(t,'shop','<div id="muse-product-grid"><article data-product="2"><div class="muse-product-picture"></div></article><article data-product="3"><div class="muse-product-picture"></div></article></div>',{getScenarioState:()=>({products,saved:[1]})});
 const [first,second]=x.root.querySelectorAll('article');
 first.firstChild.getBoundingClientRect=()=>({left:100,right:300,width:200,height:450,top:-350,bottom:100});
 second.firstChild.getBoundingClientRect=()=>({left:100,right:300,width:200,height:250,top:125,bottom:375});
 x.observe(first);x.observe(second);x.w.dispatchEvent(new x.w.Event('scroll'));await flush();
 assert.equal(x.calls.find(c=>c[0]==='move')[1],second.firstChild);assert.match(x.calls.find(c=>c[0]==='say')[1],/\$59/);
});
test('modal mutations cannot clear explicit manual speech while scenarios are paused',async t=>{
 const x=setup(t,'community','<button data-nav="notifications"></button><dialog></dialog>');x.api.setPaused(true);
 x.bot.say('Manual speech',{duration:0});const before=x.calls.filter(c=>c[0]==='clear').length;
 x.root.querySelector('dialog').setAttribute('open','');await flush();
 assert.equal(x.calls.filter(c=>c[0]==='clear').length,before);
});
test('community starts and returns to its reserved home after speech dismissal',async t=>{
 const x=setup(t,'community','<div id="th-companion-home"></div><button data-nav="notifications"></button>');const home=x.root.firstChild;
 assert.equal(x.calls.find(c=>c[0]==='move')[1],home);
 x.bot.say=()=>{const node=x.w.document.createElement('div');node.dataset.sidekickSpeech='';x.w.document.body.append(node);};
 x.bot.clearSpeech=()=>x.w.document.querySelector('[data-sidekick-speech]')?.remove();
 x.root.dispatchEvent(new x.w.CustomEvent('sidekick-demo-arrival',{detail:{id:1,kind:'post'}}));await flush();
 x.w.document.querySelector('[data-sidekick-speech]').remove();await flush();
 assert.equal(x.calls.filter(c=>c[0]==='move').at(-1)[1],home);
});
test('queued notification supersedes returning home and manual pause forbids autonomous return',async t=>{
 const x=setup(t,'community','<div id="th-companion-home"></div><button data-nav="notifications"></button>');const home=x.root.firstChild;
 x.bot.say=()=>{const node=x.w.document.createElement('div');node.dataset.sidekickSpeech='';x.w.document.body.append(node);};
 x.bot.clearSpeech=()=>x.w.document.querySelector('[data-sidekick-speech]')?.remove();
 const arrival=id=>x.root.dispatchEvent(new x.w.CustomEvent('sidekick-demo-arrival',{detail:{id,kind:'post'}}));arrival(1);await flush();arrival(2);
 x.w.document.querySelector('[data-sidekick-speech]').remove();await flush();
 assert.equal(x.calls.filter(c=>c[0]==='move'&&c[1]===home).length,1,'next event starts without a detour home');
 x.api.setPaused(true);const count=x.calls.filter(c=>c[0]==='move').length;await flush();assert.equal(x.calls.filter(c=>c[0]==='move').length,count);
});
test('returning to a visible community restores its safe home but not during manual ownership',async t=>{
 const x=setup(t,'community','<div id="th-companion-home"></div><button data-nav="notifications"></button>');let visibility='visible';
 Object.defineProperty(x.w.document,'visibilityState',{get:()=>visibility,configurable:true});
 visibility='hidden';x.w.document.dispatchEvent(new x.w.Event('visibilitychange'));visibility='visible';x.w.document.dispatchEvent(new x.w.Event('visibilitychange'));await flush();
 assert.equal(x.calls.filter(c=>c[0]==='move'&&c[1]===x.root.firstChild).length,2);
 x.api.setPaused(true);const count=x.calls.filter(c=>c[0]==='move').length;
 visibility='hidden';x.w.document.dispatchEvent(new x.w.Event('visibilitychange'));visibility='visible';x.w.document.dispatchEvent(new x.w.Event('visibilitychange'));await flush();
 assert.equal(x.calls.filter(c=>c[0]==='move').length,count);
});
test('visibility recovery during notification motion invalidates its stale completion and runs home once',async t=>{
 const x=setup(t,'community','<div id="th-companion-home"></div><button data-nav="notifications"></button>');let visibility='visible',resolve;
 Object.defineProperty(x.w.document,'visibilityState',{get:()=>visibility,configurable:true});
 x.bot.moveToElement=()=>new Promise(r=>resolve=r);
 x.root.dispatchEvent(new x.w.CustomEvent('sidekick-demo-arrival',{detail:{id:1,kind:'post'}}));
 visibility='hidden';x.w.document.dispatchEvent(new x.w.Event('visibilitychange'));
 x.bot.moveToElement=async(el)=>x.calls.push(['move',el]);visibility='visible';x.w.document.dispatchEvent(new x.w.Event('visibilitychange'));x.w.document.dispatchEvent(new x.w.Event('visibilitychange'));
 resolve({finished:true});await flush();assert.equal(x.calls.filter(c=>c[0]==='say').length,0);assert.equal(x.calls.filter(c=>c[0]==='move'&&c[1]===x.root.firstChild).length,2);
 x.api.dispose();const count=x.calls.length;x.w.document.dispatchEvent(new x.w.Event('visibilitychange'));await flush();assert.equal(x.calls.length,count);
});
test('expired pending target falls back to community home after dismissal',async t=>{
 const x=setup(t,'community','<div id="th-companion-home"></div><button data-nav="notifications"></button>');
 x.bot.say=()=>{const node=x.w.document.createElement('div');node.dataset.sidekickSpeech='';x.w.document.body.append(node);};
 x.bot.clearSpeech=()=>x.w.document.querySelector('[data-sidekick-speech]')?.remove();
 const arrival=id=>x.root.dispatchEvent(new x.w.CustomEvent('sidekick-demo-arrival',{detail:{id,kind:'post'}}));arrival(1);await flush();arrival(2);
 x.root.querySelector('button').remove();x.w.document.querySelector('[data-sidekick-speech]').remove();await flush();
 assert.equal(x.calls.filter(c=>c[0]==='move').at(-1)[1],x.root.firstChild);
});

test('early site click before avatar readiness is retained as intent without replaying a stale target',async t=>{
 const x=setup(t,'company','<section id="nova-compare"><h2>Compare</h2></section>',{},(root,w)=>{const capture=captureDemoEngagement(root,w);root.click();return capture.take();});
 x.observe(x.root.firstChild);await flush();assert.equal(x.calls.filter(c=>c[0]==='say').length,1);
});
test('boot intent capture detaches at readiness and disposal, with no cross-site carryover',t=>{
 const dom=new JSDOM('<div id="root"></div>');t.after(()=>dom.window.close());const w=dom.window,root=w.document.querySelector('#root');
 const first=captureDemoEngagement(root,w);assert.equal(first.take(),false);root.click();w.dispatchEvent(new w.Event('scroll'));assert.equal(first.take(),false);
 const consumed=captureDemoEngagement(root,w);root.click();assert.equal(consumed.take(),true);assert.equal(consumed.take(),false);
 const abandoned=captureDemoEngagement(root,w);root.click();abandoned.dispose();root.click();assert.equal(abandoned.take(),false);
 const next=captureDemoEngagement(root,w);assert.equal(next.take(),false,'new site starts without prior intent');
});

test('company envelope rejects flipping speech over controls and covers viewport edge matrices',async()=>{
 const {planCompanyPresentation,clearEnvelope}=await import('../playground/company-presentation.js');
 const box=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
 const target=box(123.359,189.641,202.281,48),viewport=box(0,0,464,428);
 const plan=planCompanyPresentation({target,viewport,host:{width:115,height:115},speech:{width:280,height:47},protectedRects:[target]});
 assert.ok(plan,'the measured public Sound geometry has a clear nearby envelope');
 assert.ok(clearEnvelope(plan.host,plan.bubble,viewport,[target]));
 for(const width of [279,320,459,768,1280])for(const height of [320,430,464,600,900])for(const size of [115,231])for(const speechHeight of [47,68,110])for(const top of [-15,12,height/2,height-40]){
  const viewport=box(7,11,width,height),target=box(30,top+11,Math.min(width-60,230),48);
  const result=planCompanyPresentation({target,viewport,host:{width:size,height:size},speech:{width:Math.min(280,width-16),height:speechHeight},protectedRects:[target]});
  if(result)assert.ok(clearEnvelope(result.host,result.bubble,viewport,[target]),JSON.stringify({width,height,size,speechHeight,top,result}));
 }
 assert.equal(planCompanyPresentation({target:viewport,viewport,host:{width:115,height:115},speech:{width:280,height:47},protectedRects:[viewport]}),null);
});
test('company sizing is non-live and removed; unsafe geometry defers without consuming delivery',async t=>{
 const {measureCompanySpeech}=await import('../playground/company-presentation.js');
 const x=setup(t,'company','<section id="nova-sound"><div class="nova-mode-tabs"><button>Quiet</button></div></section>');
 const target=x.root.querySelector('.nova-mode-tabs');let blocked=true;
 target.getBoundingClientRect=()=>blocked?{left:0,top:0,right:1024,bottom:768,width:1024,height:768}:{left:100,top:50,right:300,bottom:150,width:200,height:100};
 x.observe(target);x.w.dispatchEvent(new x.w.Event('scroll'));await flush();
 assert.equal(x.calls.filter(c=>c[0]==='say').length,0);assert.deepEqual(x.sourceEvents,[]);assert.equal(x.w.document.querySelector('[data-company-speech-sizer]'),null);
 measureCompanySpeech('Plain <text>',x.w.document,{width:320});assert.equal(x.w.document.querySelector('[data-company-speech-sizer]'),null);
 blocked=false;x.w.dispatchEvent(new x.w.Event('resize'));await flush();
 assert.equal(x.calls.filter(c=>c[0]==='say').length,1);assert.deepEqual(x.sourceEvents.map(e=>e.id),['nova-sound']);
});
test('company final geometry guard rejects moved controls without speaking or consuming source',async t=>{
 const x=setup(t,'company','<section id="nova-sound"><div class="nova-mode-tabs"></div></section>');const target=x.root.querySelector('.nova-mode-tabs');
 let resolve;x.bot.moveToElement=()=>new Promise(r=>resolve=r);x.observe(target);x.w.dispatchEvent(new x.w.Event('scroll'));await flush();
 target.getBoundingClientRect=()=>({left:0,top:0,right:1024,bottom:768,width:1024,height:768});resolve({finished:true});await flush();
 assert.equal(x.calls.filter(c=>c[0]==='say').length,0);assert.deepEqual(x.sourceEvents,[]);
});

test('company protection includes neighboring visible sections',async t=>{
 const {companyGeometry,planCompanyPresentation,overlaps}=await import('../playground/company-presentation.js');
 const x=setup(t,'company','<div class="nova-site"><section><button>Neighbor</button></section><section id="nova-design"><h2>Title</h2></section></div>');
 const target=x.root.querySelector('h2'),neighbor=x.root.querySelector('button');
 target.getBoundingClientRect=()=>({left:100,top:200,right:300,bottom:230,width:200,height:30});
 neighbor.getBoundingClientRect=()=>({left:100,top:25,right:300,bottom:65,width:200,height:40});
 const geometry=companyGeometry(target,x.w),plan=planCompanyPresentation({...geometry,host:{width:115,height:115},speech:{width:280,height:47}});
 assert.ok(geometry.protectedRects.some(r=>r.top===25));assert.ok(plan);assert.equal(overlaps(plan.bubble,neighbor.getBoundingClientRect()),false);
});
test('an unplaceable first company story cannot starve another clear visible target',async t=>{
 const x=setup(t,'company','<div class="nova-site"><section id="nova-design"><h2>Blocked</h2></section><section id="nova-sound"><div class="nova-mode-tabs">Clear</div></section></div>');
 const first=x.root.querySelector('h2'),second=x.root.querySelector('.nova-mode-tabs');first.getBoundingClientRect=()=>({left:800,top:0,right:1024,bottom:768,width:224,height:768});
 x.observe(first);x.observe(second);x.w.dispatchEvent(new x.w.Event('scroll'));await flush();
 assert.equal(x.calls.find(c=>c[0]==='move')[1],second);assert.deepEqual(x.sourceEvents.map(e=>e.id),['nova-sound']);
});
test('small safe company scroll preserves speech; unsafe early interruption gets one settled retry',async t=>{
 let now=10000;t.mock.method(Date,'now',()=>now);
 const x=setup(t,'company','<section id="nova-sound"><div class="nova-mode-tabs"></div></section>'),target=x.root.querySelector('.nova-mode-tabs');
 x.observe(target);x.w.dispatchEvent(new x.w.Event('scroll'));await flush();const clears=x.calls.filter(c=>c[0]==='clear').length;
 target.getBoundingClientRect=()=>({left:100,top:51,right:300,bottom:151,width:200,height:100});x.w.dispatchEvent(new x.w.Event('scroll'));await flush();
 assert.equal(x.calls.filter(c=>c[0]==='clear').length,clears);assert.equal(x.calls.filter(c=>c[0]==='say').length,1);
 target.getBoundingClientRect=()=>({left:0,top:0,right:1024,bottom:768,width:1024,height:768});now+=100;x.w.dispatchEvent(new x.w.Event('scroll'));await flush();
 assert.equal(x.w.document.querySelector('[data-sidekick-speech]'),null);
 target.getBoundingClientRect=()=>({left:100,top:50,right:300,bottom:150,width:200,height:100});x.w.dispatchEvent(new x.w.Event('scroll'));await flush();assert.equal(x.calls.filter(c=>c[0]==='say').length,2);
 target.getBoundingClientRect=()=>({left:0,top:0,right:1024,bottom:768,width:1024,height:768});now+=100;x.w.dispatchEvent(new x.w.Event('scroll'));await flush();
 target.getBoundingClientRect=()=>({left:100,top:50,right:300,bottom:150,width:200,height:100});x.w.dispatchEvent(new x.w.Event('scroll'));await flush();assert.equal(x.calls.filter(c=>c[0]==='say').length,2,'retry is bounded');
});

test('accepted company speech remeasures wrapping width before viewport expansion',async t=>{
 const x=setup(t,'company','<div class="nova-site"><section id="nova-sound"><div class="nova-mode-tabs"></div></section><section><button id="neighbor">Neighbor</button></section></div>',{},(root,w)=>{
  Object.defineProperty(w,'innerWidth',{value:250,writable:true});
  root.querySelector('#neighbor').getBoundingClientRect=()=>({left:285,top:283,right:315,bottom:330,width:30,height:47});return false;
 });
 const target=x.root.querySelector('.nova-mode-tabs');x.observe(target);x.w.dispatchEvent(new x.w.Event('scroll'));await flush();assert.equal(x.calls.filter(c=>c[0]==='say').length,1);
 x.w.innerWidth=400;x.w.dispatchEvent(new x.w.Event('resize'));await flush();
 assert.equal(x.w.document.querySelector('[data-sidekick-speech]'),null,'expanded real bubble must not cover the newly visible neighboring control');
});

test('Compare uses the measured image and adjacent whitespace band, not image-only containment',async()=>{
 const {planCompanyPresentation,clearEnvelope}=await import('../playground/company-presentation.js');
 const box=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
 const target=box(24,84.969,401,82.063),viewport=box(0,0,464,428);
 const protectedRects=[target,box(24,185.031,401,24.797),box(24,404.828,192.5,34.5),box(232.5,404.828,192.5,34.5)];
 const plan=planCompanyPresentation({target,viewport,host:{width:115,height:115},speech:{width:280,height:47},protectedRects,visuals:[box(24,237.828,192.5,150),box(232.5,237.828,192.5,150)]});
 assert.ok(plan,'normal Compare has enough measured noninteractive image/whitespace room');assert.ok(clearEnvelope(plan.host,plan.bubble,viewport,protectedRects));
});
test('a genuinely constrained story parks the companion on a clear visible visual without consuming speech',async t=>{
 const x=setup(t,'company','<div class="nova-site"><section class="nova-macro" id="nova-design"><img><h2>Title</h2><p>Prose</p></section></div>',{},(root,w)=>{
  Object.defineProperty(w,'innerWidth',{value:464});Object.defineProperty(w,'innerHeight',{value:428});
  root.querySelector('img').getBoundingClientRect=()=>({left:0,top:0,right:464,bottom:428,width:464,height:428});
  root.querySelector('h2').getBoundingClientRect=()=>({left:24,top:145,right:425,bottom:275,width:401,height:130});
  root.querySelector('p').getBoundingClientRect=()=>({left:24,top:338,right:425,bottom:375,width:401,height:37});return false;
 });
 x.observe(x.root.querySelector('h2'));x.w.dispatchEvent(new x.w.Event('scroll'));await flush();
 assert.equal(x.calls.filter(c=>c[0]==='say').length,0);assert.deepEqual(x.sourceEvents,[]);assert.equal(x.calls.filter(c=>c[0]==='move').length,1);
 const rest=x.bot.getBoundingClientRect();assert.ok(rest.top>=8&&rest.bottom<=137,'parked host stays above the heading, not at an old story position');
 x.api.setPaused(true);const moves=x.calls.filter(c=>c[0]==='move').length;x.w.dispatchEvent(new x.w.Event('resize'));await flush();assert.equal(x.calls.filter(c=>c[0]==='move').length,moves);
});

test('normal Configure navigation narrates the visible product before below-fold finish controls',async t=>{
 const x=setup(t,'company','<div class="nova-site"><section id="nova-configure"><div class="nova-config-image"><img></div><h2>Make it yours</h2><p>Choose a finish</p><fieldset class="nova-finishes"><div><button>Silver</button></div></fieldset></section></div>',{},(root,w)=>{
  Object.defineProperty(w,'innerWidth',{value:464});Object.defineProperty(w,'innerHeight',{value:428});
  const set=(selector,left,top,width,height)=>{root.querySelector(selector).getBoundingClientRect=()=>({left,top,width,height,right:left+width,bottom:top+height});};
  set('.nova-config-image',-6.063,54.781,461.141,334.156);set('h2',24,388.938,401,41.031);set('p',24,446.969,401,24);set('.nova-finishes>div',24,498.969,401,69.5);set('button',24,498.969,48,48);return false;
 });
 const visual=x.root.querySelector('.nova-config-image');x.observe(visual);x.w.dispatchEvent(new x.w.Event('scroll'));await flush();
 assert.equal(x.calls.find(c=>c[0]==='move')[1],visual);assert.match(x.calls.find(c=>c[0]==='say')[1],/Finishes below.*Demo-only/);assert.deepEqual(x.sourceEvents.map(e=>e.id),['nova-configure']);
});

test('failed visual rest can retry on the next event and stale rest cannot detach manual ownership',async t=>{
 const x=setup(t,'company','<div class="nova-site"><section class="nova-macro" id="nova-design"><img><h2>Title</h2><p>Prose</p></section></div>',{},(root,w)=>{
  Object.defineProperty(w,'innerWidth',{value:464});Object.defineProperty(w,'innerHeight',{value:428});
  root.querySelector('img').getBoundingClientRect=()=>({left:0,top:0,right:464,bottom:428,width:464,height:428});
  root.querySelector('h2').getBoundingClientRect=()=>({left:24,top:145,right:425,bottom:275,width:401,height:130});
  root.querySelector('p').getBoundingClientRect=()=>({left:24,top:338,right:425,bottom:375,width:401,height:37});return false;
 });
 const pending=[];x.bot.moveToElement=(...args)=>{x.calls.push(['move',...args]);return new Promise((resolve,reject)=>pending.push({resolve,reject}));};
 x.w.dispatchEvent(new x.w.Event('scroll'));await flush();assert.equal(pending.length,1);
 pending[0].resolve({finished:false});await flush();const afterFailure=x.calls.filter(c=>c[0]==='detach').length;
 x.root.click();await flush();assert.equal(pending.length,2,'same geometry is eligible again after a failed owned rest');
 x.api.setPaused(true);const afterPause=x.calls.filter(c=>c[0]==='detach').length;assert.ok(afterPause>afterFailure);
 pending[1].reject(new Error('cancelled after pause'));await flush();assert.equal(x.calls.filter(c=>c[0]==='detach').length,afterPause,'stale rest must not detach manual ownership');
 x.bot.moveToElement=()=>{throw new Error('synchronous validation failure');};x.api.setPaused(false);x.root.click();await flush();
 const afterThrow=x.calls.filter(c=>c[0]==='detach').length;assert.ok(afterThrow>afterPause,'synchronous failure releases owned rest');
 x.bot.moveToElement=()=>Promise.reject(new Error('asynchronous movement failure'));x.root.click();await flush();assert.ok(x.calls.filter(c=>c[0]==='detach').length>afterThrow,'rejection releases owned rest for later recovery');
});

test('compact Compare can share the image gutter when each image is narrower than the host',async()=>{
 const {planCompanyPresentation,clearEnvelope}=await import('../playground/company-presentation.js');
 const box=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
 const target=box(24,60,216,104),viewport=box(0,0,279,428),protectedRects=[target,box(24,182,216,50)];
 const plan=planCompanyPresentation({target,viewport,host:{width:115,height:115},speech:{width:263,height:47},protectedRects,visuals:[box(24,260,100,150),box(140,260,100,150)]});
 assert.ok(plan,'real visual plus its empty gutter remains a valid candidate');assert.ok(clearEnvelope(plan.host,plan.bubble,viewport,protectedRects));
 const blocked=planCompanyPresentation({target,viewport,host:{width:115,height:115},speech:{width:263,height:47},protectedRects:[...protectedRects,box(124,232,16,196)],visuals:[box(24,260,100,150),box(140,260,100,150)]});assert.equal(blocked,null,'a protected gutter cannot be treated as image-adjacent whitespace');
});

test('constrained centered Compare defers without consumption then recovers at its ordinary navigation alignment',async t=>{
 let normal=false;
 const x=setup(t,'company','<div class="nova-site"><section id="nova-compare"><div class="nova-heading"><h2>Compare models</h2><p>Model description</p></div><div class="nova-compare-products"><img><img><h3>Model One</h3><h3>Model Two</h3></div></section></div>',{},(root,w)=>{
  Object.defineProperty(w,'innerWidth',{value:464});Object.defineProperty(w,'innerHeight',{value:428});
  const box=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
  root.querySelector('h2').getBoundingClientRect=()=>box(24,normal?84.969:145,401,normal?82.063:130);
  root.querySelector('p').getBoundingClientRect=()=>box(24,normal?185.031:338,401,normal?24.797:37);
  [...root.querySelectorAll('img')].forEach((el,i)=>el.getBoundingClientRect=()=>box(24+i*208.5,normal?237.828:390,192.5,150));
  [...root.querySelectorAll('h3')].forEach((el,i)=>el.getBoundingClientRect=()=>box(24+i*208.5,normal?404.828:557,192.5,34.5));return false;
 });
 const heading=x.root.querySelector('h2');x.observe(heading);x.w.dispatchEvent(new x.w.Event('scroll'));await flush();assert.equal(x.calls.filter(c=>c[0]==='say').length,0);assert.deepEqual(x.sourceEvents,[]);
 normal=true;x.w.dispatchEvent(new x.w.Event('scroll'));await flush();assert.equal(x.calls.filter(c=>c[0]==='say').length,1);assert.deepEqual(x.sourceEvents.map(e=>e.id),['nova-compare']);
});

test('safe company scroll during pursuit retains one move and speaks at the latest anchor',async t=>{
 const x=setup(t,'company','<section id="nova-sound"><div class="nova-mode-tabs"></div></section>');
 const target=x.root.querySelector('.nova-mode-tabs');let y=50,finish,options,moves=0;
 target.getBoundingClientRect=()=>({left:100,top:y,right:300,bottom:y+100,width:200,height:100});
 const original=x.bot.moveToElement;
 x.bot.moveToElement=(el,opt)=>{moves++;options=opt;return new Promise(resolve=>{finish=async()=>{await original(el,opt);resolve({finished:true});};});};
 x.observe(target);x.w.dispatchEvent(new x.w.Event('scroll'));await flush();
 for(const delta of [1,2,3,2,1]){y=50+delta;x.w.dispatchEvent(new x.w.Event('scroll'));await flush();}
 assert.equal(moves,1,'scroll cannot restart an in-flight pursuit');assert.equal(x.calls.filter(c=>c[0]==='say').length,0);
 await finish();await flush();assert.equal(x.calls.filter(c=>c[0]==='say').length,1);assert.equal(x.calls.filter(c=>c[0]==='detach').length,0);
});
test('nested scroll engages the example without a window scroll or click',async t=>{
 const products=[{id:1,cat:'tops',price:18},{id:2,cat:'tops',price:12}];
 const x=setup(t,'shop','<div id="muse-product-grid"><article data-product="2"></article></div>',{getScenarioState:()=>({products,saved:[1]})});
 x.observe(x.root.querySelector('article'));await flush();assert.equal(x.calls.filter(c=>c[0]==='say').length,0);
 x.root.dispatchEvent(new x.w.Event('scroll',{bubbles:false}));await flush();assert.equal(x.calls.filter(c=>c[0]==='say').length,1);
});

test('shop waits for the actual price, not merely a product picture, before moving',async t=>{
 const products=[{id:1,cat:2,price:18,name:'Saved tee'},{id:2,cat:2,price:12,name:'Other tee'}];
 const x=setup(t,'shop','<div id="muse-product-grid"><article class="muse-product" data-product="2"><div class="muse-product-info"><div class="muse-price">$12</div></div></article></div>',{getScenarioState:()=>({products,saved:[1]})});
 const target=x.root.querySelector('article'),price=x.root.querySelector('.muse-price');price.getBoundingClientRect=()=>({left:100,top:1000,width:100,height:24,right:200,bottom:1024});
 x.observe(target);x.w.dispatchEvent(new x.w.Event('scroll'));await flush();assert.equal(x.calls.filter(c=>c[0]==='move').length,0);assert.match(target.querySelector('[data-demo-intent]').textContent,/\$6 less.*\$18.*\$12.*Saved tee.*Other tee/);
 price.getBoundingClientRect=()=>({left:100,top:200,width:100,height:24,right:200,bottom:224});x.w.scrollY=100;x.w.dispatchEvent(new x.w.Event('scroll'));await flush();assert.equal(x.calls.filter(c=>c[0]==='say').length,1);
});

// These cases use real policy durations and actual offsets, unlike the quick
// legacy fixture above. No browser frame loop or wall-clock timing is assumed.
function controlledClock(t,w){
 let time=0,id=0;const jobs=new Map();
 t.mock.method(Date,'now',()=>10000+time);t.mock.method(w.performance,'now',()=>time);
 w.setTimeout=(fn,ms=0)=>{jobs.set(++id,{fn,due:time+ms,ms});return id;};w.clearTimeout=id=>jobs.delete(id);
 return {jobs,advance(ms){const end=time+ms;let guard=0;while(true){const next=[...jobs].filter(([,j])=>j.due<=end).sort((a,b)=>a[1].due-b[1].due)[0];if(!next)break;assert.ok(++guard<1000,'event-driven timers must terminate');jobs.delete(next[0]);time=next[1].due;next[1].fn();}time=end;},scroll(y,ms=16,target=w){this.advance(ms);if(target===w)w.scrollY=y;else target.scrollTop=y;target.dispatchEvent(new w.Event('scroll'));}};
}
const movingRect=(left,top,width=200,height=100)=>({left,top,width,height,right:left+width,bottom:top+height});
test('rapid company bursts skip passed sections and deliver only the settled current section',async t=>{
 let clock;const ids=['nova-design','nova-sound','nova-compare'];
 const x=setup(t,'company',ids.map(id=>`<section id="${id}"></section>`).join(''),{},(root,w)=>{clock=controlledClock(t,w);[...root.children].forEach((el,i)=>el.getBoundingClientRect=()=>movingRect(300,80+i*800-w.scrollY));});
 clock.scroll(40);clock.scroll(760);clock.scroll(1560);await flush();assert.equal(x.calls.filter(c=>c[0]==='move').length,0);assert.deepEqual(x.sourceEvents,[]);
 clock.advance(179);await flush();assert.equal(x.calls.filter(c=>c[0]==='say').length,0);
 clock.advance(1);await flush();assert.deepEqual(x.sourceEvents.map(e=>e.id),['nova-compare']);assert.equal(x.calls.filter(c=>c[0]==='say').length,1);
 x.observe(x.root.firstChild);await flush();assert.equal(x.calls.filter(c=>c[0]==='say').length,1,'late observer callback cannot revive a passed section');
});
test('rapid company motion cancellation suppresses stale completion even when its envelope remains safe',async t=>{
 let clock;const x=setup(t,'company','<section id="nova-design"></section>',{},(root,w)=>{clock=controlledClock(t,w);});
 const original=x.bot.moveToElement;let finish;x.bot.moveToElement=(el,options)=>new Promise(resolve=>{finish=async()=>{await original(el,options);resolve({finished:true});};});
 clock.scroll(0);clock.advance(180);await flush();assert.ok(finish);
 clock.scroll(300);await finish();await flush();assert.equal(x.calls.filter(c=>c[0]==='say').length,0);assert.deepEqual(x.sourceEvents,[]);assert.equal(x.calls.filter(c=>c[0]==='detach').length,1);
 x.bot.moveToElement=original;clock.advance(180);await flush();assert.deepEqual(x.sourceEvents.map(e=>e.id),['nova-design']);
});
test('shop large jump and reversal choose the current price-visible product, not observer insertion order',async t=>{
 let clock;const products=[1,2,3,4].map(id=>({id,cat:'tops',price:20-id*2,name:'Top '+id}));
 const x=setup(t,'shop','<div id="muse-product-grid">'+[2,3,4].map(id=>`<article class="muse-product" data-product="${id}"><div class="muse-product-picture"></div><div class="muse-product-info"><div class="muse-price"></div></div></article>`).join('')+'</div>',{getScenarioState:()=>({products,saved:[1]})},(root,w)=>{
  clock=controlledClock(t,w);[...root.querySelectorAll('article')].forEach((el,i)=>{const top=()=>i*800-w.scrollY;el.getBoundingClientRect=()=>movingRect(100,top(),200,350);el.querySelector('.muse-product-picture').getBoundingClientRect=()=>movingRect(100,top(),200,250);el.querySelector('.muse-price').getBoundingClientRect=()=>movingRect(100,top()+260,200,25);});
 });
 const cards=[...x.root.querySelectorAll('article')];cards.forEach(x.observe);
 clock.scroll(100);clock.scroll(1500);clock.scroll(700);await flush();assert.equal(x.calls.filter(c=>c[0]==='say').length,0);
 clock.advance(180);await flush();const move=x.calls.find(c=>c[0]==='move');assert.equal(move[1],cards[1].querySelector('.muse-product-picture'));assert.match(x.calls.find(c=>c[0]==='say')[1],/\$14/);assert.equal(x.sourceEvents.length,1);
 x.observe(cards[2]);await flush();assert.equal(x.sourceEvents.length,1);
});
test('community coalesces presentation during a flick, retains records and resolves the replacement navigation target',async t=>{
 let clock;const x=setup(t,'community','<button data-nav="notifications"></button><header class="th-feed-header"></header>',{},(root,w)=>{clock=controlledClock(t,w);});
 const original=x.bot.moveToElement;let finish;x.bot.moveToElement=()=>new Promise(resolve=>{finish=resolve;});
 const arrive=(id,kind)=>{const record=x.w.document.createElement('article');record.id='record-'+id;x.root.append(record);x.root.dispatchEvent(new x.w.CustomEvent('sidekick-demo-arrival',{detail:{id,kind}}));};
 arrive('A','mention');clock.scroll(400);arrive('B','mention');arrive('C','post');
 const old=x.root.querySelector('[data-nav]'),fresh=old.cloneNode();fresh.getBoundingClientRect=()=>movingRect(100,50);old.replaceWith(fresh);finish({finished:true});await flush();assert.equal(x.calls.filter(c=>c[0]==='say').length,0);
 x.bot.moveToElement=original;clock.advance(180);await flush();assert.equal(x.calls.find(c=>c[0]==='move')[1],fresh);assert.deepEqual(x.sourceEvents.map(e=>e.id),['community-post-present']);assert.equal(x.root.querySelectorAll('[id^="record-"]').length,3);
});
test('nested scroll bursts defer company presentation even when window scroll offset is unchanged',async t=>{
 let clock;const x=setup(t,'company','<div id="nested"><section id="nova-design"></section></div>',{},(root,w)=>{clock=controlledClock(t,w);});const nested=x.root.firstChild;
 clock.scroll(0,0,nested);clock.scroll(80,16,nested);clock.scroll(320,16,nested);await flush();assert.equal(x.w.scrollY,0);assert.equal(x.calls.filter(c=>c[0]==='say').length,0);
 clock.advance(180);await flush();assert.deepEqual(x.sourceEvents.map(e=>e.id),['nova-design']);
});
test('resize during a burst renews geometry dwell without delivering early',async t=>{
 let clock;const x=setup(t,'company','<section id="nova-design"></section>',{},(root,w)=>{clock=controlledClock(t,w);});clock.scroll(300);clock.advance(100);x.w.dispatchEvent(new x.w.Event('resize'));clock.advance(179);await flush();assert.equal(x.calls.filter(c=>c[0]==='say').length,0);clock.advance(1);await flush();assert.equal(x.calls.filter(c=>c[0]==='say').length,1);
});
test('paused and disposed scroll timers cannot detach manual control or deliver stale advice',async t=>{
 let clock;const x=setup(t,'company','<section id="nova-design"></section>',{},(root,w)=>{clock=controlledClock(t,w);});clock.scroll(500);const stale=[...clock.jobs.values()].map(j=>j.fn);x.api.setPaused(true);const before=x.calls.length;for(const fn of stale)fn();clock.scroll(900);await flush();assert.equal(x.calls.length,before);assert.deepEqual(x.sourceEvents,[]);x.api.dispose();const disposed=x.calls.length;for(const fn of stale)fn();await flush();assert.equal(x.calls.length,disposed);
});
test('shop final viewport with removed reference stays quiet and does not poll',async t=>{
 let clock,saved=[1];const x=setup(t,'shop','<div id="muse-product-grid"><article class="muse-product" data-product="2"></article></div>',{getScenarioState:()=>({products:[{id:1,cat:'tops',price:18},{id:2,cat:'tops',price:12}],saved})},(root,w)=>{clock=controlledClock(t,w);});clock.scroll(500);saved=[];clock.advance(180);await flush();assert.equal(x.calls.filter(c=>c[0]==='move').length,0);assert.equal(clock.jobs.size,0);assert.deepEqual(x.sourceEvents,[]);
});
for(const site of ['company','shop','community'])test(`${site} waits through a fast inertial tail and settles once without waiting for every pixel to stop`,async t=>{
 let clock;const markup={company:'<section id="nova-design"></section>',shop:'<div id="muse-product-grid"><article class="muse-product" data-product="2"></article></div>',community:'<button data-nav="notifications"></button><header class="th-feed-header"></header>'}[site];
 const x=setup(t,site,markup,{getScenarioState:()=>({products:[{id:1,cat:'tops',price:18},{id:2,cat:'tops',price:12}],saved:[1]})},(root,w)=>{clock=controlledClock(t,w);});
 let y=300;clock.scroll(y);if(site==='community')x.root.dispatchEvent(new x.w.CustomEvent('sidekick-demo-arrival',{detail:{id:'tail',kind:'mention'}}));
 for(const delta of [64,32,16,8,4,2]){clock.scroll(y+=delta);await flush();assert.equal(x.calls.filter(c=>c[0]==='say').length,0);}
 for(let i=0;i<24;i++){clock.scroll(++y);await flush();}
 assert.equal(x.calls.filter(c=>c[0]==='say').length,1);assert.equal(x.sourceEvents.length,1);clock.advance(180);await flush();assert.equal(x.calls.filter(c=>c[0]==='say').length,1);
});
test('community target replacement during ordinary motion restarts at the new anchor before speaking',async t=>{
 const x=setup(t,'community','<button data-nav="notifications"></button><header class="th-feed-header"></header>');let finish;const original=x.bot.moveToElement;x.bot.moveToElement=()=>new Promise(resolve=>{finish=resolve;});x.root.dispatchEvent(new x.w.CustomEvent('sidekick-demo-arrival',{detail:{id:'replace',kind:'mention'}}));
 const old=x.root.querySelector('[data-nav]'),fresh=old.cloneNode();fresh.getBoundingClientRect=()=>movingRect(100,50);old.replaceWith(fresh);x.bot.moveToElement=original;finish({finished:true});await flush();
 assert.equal(x.calls.find(c=>c[0]==='move')[1],fresh);assert.equal(x.calls.filter(c=>c[0]==='say').length,1);assert.equal(fresh.dataset.demoTarget,'result');assert.equal(old.hasAttribute('data-demo-target'),false);assert.equal(x.sourceEvents.length,1);
});
for(const site of ['company','shop'])test(`${site} rejects a viewport-visible target clipped outside a nested scroller`,async t=>{
 let clock;const contents=site==='company'?'<section id="nova-design"></section>':'<article class="muse-product" data-product="2"></article>';
 const x=setup(t,site,`<div id="muse-product-grid"><div id="clip" style="overflow-x:auto;overflow-y:auto">${contents}</div></div>`,{getScenarioState:()=>({products:[{id:1,cat:'tops',price:18},{id:2,cat:'tops',price:12}],saved:[1]})},(root,w)=>{clock=controlledClock(t,w);root.querySelector('#clip').getBoundingClientRect=()=>movingRect(100,300,250,200);});
 clock.scroll(300);clock.advance(180);await flush();assert.equal(x.calls.filter(c=>c[0]==='say').length,0);assert.deepEqual(x.sourceEvents,[]);
});
test('shop requires the complete price inside the current viewport before presenting',async t=>{
 let clock;const x=setup(t,'shop','<div id="muse-product-grid"><article class="muse-product" data-product="2"><div class="muse-price"></div></article></div>',{getScenarioState:()=>({products:[{id:1,cat:'tops',price:18},{id:2,cat:'tops',price:12}],saved:[1]})},(root,w)=>{clock=controlledClock(t,w);root.querySelector('.muse-price').getBoundingClientRect=()=>movingRect(100,w.innerHeight-30,100,25);});clock.scroll(200);clock.advance(180);await flush();assert.equal(x.calls.filter(c=>c[0]==='say').length,0);
});
test('latest community intent survives temporarily missing targets during a rapid gesture',async t=>{
 let clock;const x=setup(t,'community','<button data-nav="notifications"></button><header class="th-feed-header"></header>',{},(root,w)=>{clock=controlledClock(t,w);});clock.scroll(300);const arrive=(id,kind)=>x.root.dispatchEvent(new x.w.CustomEvent('sidekick-demo-arrival',{detail:{id,kind}}));arrive('older','mention');const nav=x.root.querySelector('[data-nav]');x.root.querySelector('.th-feed-header').remove();nav.remove();arrive('latest','post');x.root.append(nav);clock.advance(180);await flush();assert.deepEqual(x.sourceEvents.map(e=>e.id),['community-post-present']);
});
test('community restores its quiet home only after settlement and yields it to a pending notice',async t=>{
 let clock;const x=setup(t,'community','<button data-nav="notifications"></button><header class="th-feed-header"></header><aside id="th-companion-home"></aside>',{},(root,w)=>{clock=controlledClock(t,w);});await flush();const home=x.root.querySelector('#th-companion-home');assert.equal(x.calls.filter(c=>c[0]==='move').length,1);clock.scroll(300);assert.equal(x.calls.filter(c=>c[0]==='move').length,1);clock.advance(180);await flush();assert.equal(x.calls.filter(c=>c[0]==='move').length,2);assert.equal(x.calls.filter(c=>c[0]==='move').at(-1)[1],home);assert.equal(x.calls.filter(c=>c[0]==='move').at(-1)[2].duration,0);
 clock.scroll(700);x.root.dispatchEvent(new x.w.CustomEvent('sidekick-demo-arrival',{detail:{id:'notice',kind:'mention'}}));clock.advance(180);await flush();assert.equal(x.calls.filter(c=>c[0]==='move').length,3);assert.equal(x.calls.filter(c=>c[0]==='move').at(-1)[1],x.root.querySelector('[data-nav]'));assert.equal(x.sourceEvents.length,1);
});
test('a slow company scroll performs one owned geometry validation, not duplicate ancestor reads',async t=>{
 let clock;const x=setup(t,'company','<section id="nova-design"></section>',{},(root,w)=>{clock=controlledClock(t,w);});x.bot.moveToElement=()=>new Promise(()=>{});clock.scroll(0);clock.advance(180);await flush();
 let reads=0;const original=x.w.getComputedStyle.bind(x.w);t.mock.method(x.w,'getComputedStyle',(...args)=>{if(args[0]===x.root)reads++;return original(...args);});clock.scroll(1);
 assert.equal(reads,2,'one clipping read for the planned envelope and one for current target visibility');assert.deepEqual(x.sourceEvents,[]);
});

function restingShop(t){
 let clock;const x=setup(t,'shop','<div id="muse-product-grid"><article class="muse-product" data-product="2"><div class="muse-price"></div></article></div>',{getScenarioState:()=>({products:[{id:1,cat:'tops',price:18},{id:2,cat:'tops',price:12},{id:3,cat:'tops',price:10}],saved:[1]})},(root,w)=>{clock=controlledClock(t,w);});
 const card=x.root.querySelector('article'),price=card.firstChild;
 const visible=value=>{card.getBoundingClientRect=()=>movingRect(100,value?50:-500,200,300);price.getBoundingClientRect=()=>movingRect(100,value?350:-200,120,25);};visible(true);
 return {...x,clock,visible};
}
test('shop settles away from an active offer into one owned hide and returns silently to the known match',async t=>{
 const x=restingShop(t);x.w.matchMedia=()=>({matches:false});x.clock.scroll(0);x.clock.advance(180);await flush();assert.equal(x.calls.find(c=>c[0]==='move')[2].duration,550);assert.equal(x.sourceEvents.length,1);x.clock.advance(2000);
 x.visible(false);x.clock.scroll(500);assert.equal(x.bot.presence,null,'stop in place throughout the flick');x.clock.advance(179);assert.equal(x.bot.presence,null);x.clock.advance(1);await flush();assert.deepEqual(x.bot.presence,{visible:false});
 for(let i=1;i<=24;i++)x.clock.scroll(500+i);await flush();assert.equal(x.calls.filter(c=>c[0]==='presence'&&c[1]?.visible===false).length,1,'tiny tails do not restart the fade');
 x.visible(true);x.clock.scroll(0);x.clock.advance(180);await flush();assert.equal(x.bot.presence,null);assert.equal(x.calls.filter(c=>c[0]==='move').at(-1)[2].duration,0);assert.equal(x.calls.filter(c=>c[0]==='say').length,1,'known comparison does not narrate again');assert.equal(x.sourceEvents.length,1,'quiet reattachment is not a new narrated source action');assert.equal(x.root.querySelector('[data-demo-target]'),null);
 x.visible(false);x.clock.scroll(500);x.clock.advance(180);await flush();assert.equal(x.calls.filter(c=>c[0]==='presence'&&c[1]?.visible===false).length,2,'a later distinct departure can hide again');
});
for(const action of ['pause','dispose'])test(`shop ${action} synchronously restores only its own hide before manual control`,async t=>{
 const x=restingShop(t);x.clock.scroll(0);x.clock.advance(180);await flush();x.visible(false);x.clock.scroll(500);x.clock.advance(180);await flush();assert.deepEqual(x.bot.presence,{visible:false});const position=x.bot.position;
 if(action==='pause')x.api.setPaused(true);else x.api.dispose();assert.equal(x.bot.presence,null);assert.deepEqual(x.calls.find(c=>c[0]==='restore').slice(1),[position,{duration:0,travel:'none'}]);
 x.bot.presence={visible:false};const writes=x.calls.length;x.clock.advance(10000);await flush();assert.equal(x.calls.length,writes,'stale callbacks cannot override the new owner');assert.deepEqual(x.bot.presence,{visible:false});
});
test('shop does not reveal an explicit externally hidden companion or hide before its first presentation',async t=>{
 const x=restingShop(t);x.visible(false);x.clock.scroll(500);x.clock.advance(180);await flush();assert.equal(x.bot.presence,null);
 x.bot.presence={visible:false};x.visible(true);x.clock.scroll(0);x.clock.advance(180);await flush();assert.equal(x.calls.filter(c=>c[0]==='move').length,0);assert.equal(x.sourceEvents.length,0);x.api.setPaused(true);assert.deepEqual(x.bot.presence,{visible:false});assert.equal(x.calls.filter(c=>c[0]==='restore').length,0);
});

test('shop handoff preserves an outside presence change instead of restoring stale state',async t=>{
 const x=restingShop(t);x.clock.scroll(0);x.clock.advance(180);await flush();x.visible(false);x.clock.scroll(500);x.clock.advance(180);await flush();
 x.bot.presence={visible:true};x.api.setPaused(true);assert.deepEqual(x.bot.presence,{visible:true});assert.equal(x.calls.filter(c=>c[0]==='restore').length,0);
});

test('shop restores at a new useful offer without flying through unrelated products',async t=>{
 const x=restingShop(t);x.w.matchMedia=()=>({matches:false});x.clock.scroll(0);x.clock.advance(180);await flush();x.visible(false);x.clock.scroll(500);x.clock.advance(180);await flush();
 const card=x.w.document.createElement('article');card.className='muse-product';card.dataset.product='3';card.getBoundingClientRect=()=>movingRect(100,50,200,300);x.root.querySelector('#muse-product-grid').append(card);
 x.clock.scroll(1000);x.clock.advance(180);await flush();assert.equal(x.bot.presence,null);assert.equal(x.calls.filter(c=>c[0]==='move').at(-1)[1],card);assert.equal(x.calls.filter(c=>c[0]==='move').at(-1)[2].duration,0);assert.equal(x.calls.filter(c=>c[0]==='say').length,2);assert.match(x.calls.filter(c=>c[0]==='say').at(-1)[1],/\$10/);assert.equal(x.sourceEvents.length,2);
});

test('a clipped company image does not clip the independent viewport speech envelope',async t=>{
 let clock;const x=setup(t,'company','<section id="nova-design" class="nova-macro" style="overflow:clip"><img><div><h2>Title</h2></div></section>',{},(root,w)=>{
  clock=controlledClock(t,w);Object.defineProperty(w,'innerWidth',{value:264,configurable:true});Object.defineProperty(w,'innerHeight',{value:428,configurable:true});
  root.querySelector('section').getBoundingClientRect=()=>movingRect(0,20,264,760);root.querySelector('img').getBoundingClientRect=()=>movingRect(0,20,264,516);
  root.querySelector('h2').getBoundingClientRect=()=>movingRect(26,223,212,238);root.querySelector('section>div').getBoundingClientRect=()=>movingRect(26,223,212,400);
  const native=w.HTMLElement.prototype.getBoundingClientRect;w.HTMLElement.prototype.getBoundingClientRect=function(){return this.hasAttribute('data-company-speech-sizer')?movingRect(0,0,248,68):native.call(this);};
 });
 clock.scroll(0);clock.advance(180);await flush();assert.equal(x.calls.filter(c=>c[0]==='say').length,1);assert.deepEqual(x.sourceEvents.map(e=>e.id),['nova-design']);
});

test('community input and keyboard rendering refresh empty-state guidance without adding movement',t=>{
 const x=setup(t,'community','<main class="th-main"><div class="th-tabs"><button>Following</button></div><input data-search><div id="th-feed"><div class="th-empty"><p>Original</p></div></div><button class="active" data-nav="notifications">Notifications</button></main>');const guide=x.root.querySelector('[data-demo-intent]'),feed=x.root.querySelector('#th-feed');assert.equal(guide.hidden,true);
 x.root.querySelector('[data-nav]').classList.remove('active');feed.innerHTML='<article>Matching post</article>';x.root.querySelector('input').dispatchEvent(new x.w.Event('input',{bubbles:true}));assert.equal(guide.hidden,false);
 feed.innerHTML='<div class="th-empty"><p>No followed authors</p></div>';x.root.querySelector('.th-tabs button').dispatchEvent(new x.w.KeyboardEvent('keydown',{bubbles:true,key:'ArrowRight'}));assert.equal(guide.hidden,true);assert.equal(x.calls.filter(c=>c[0]==='move'||c[0]==='say').length,0);
 x.api.dispose();const original=guide.hidden;feed.innerHTML='<article>After disposal</article>';x.root.querySelector('input').dispatchEvent(new x.w.Event('input',{bubbles:true}));assert.equal(guide.hidden,original);
});
