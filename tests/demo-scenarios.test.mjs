import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {cheaperMatch,installDemoScenarios,scenarioCopy} from '../playground/demo-scenarios.js';
function setup(t,site,markup,adapter={}){
 const dom=new JSDOM(`<div id="root">${markup}</div><div id="bot"></div>`,{pretendToBeVisual:true,url:`https://sidekick.test/api-demo.html?site=${site}&sourceGeneration=4`});t.after(()=>dom.window.close());const w=dom.window,root=w.document.querySelector('#root'),bot=w.document.querySelector('#bot'),calls=[];
 const sourceEvents=[];Object.defineProperty(w,'parent',{value:{postMessage:data=>sourceEvents.push(data)}});
 w.matchMedia=()=>({matches:true});let observer;w.IntersectionObserver=class{constructor(cb){this.cb=cb;observer=this;}observe(){}disconnect(){} emit(target){this.cb([{target,isIntersecting:true,intersectionRatio:.7}]);}};
 for(const node of root.querySelectorAll('*'))node.getBoundingClientRect=()=>({width:200,height:100,top:50,bottom:150});
 Object.assign(bot,{moveToElement:async(el,options)=>calls.push(['move',el,options]),say:(text,options)=>calls.push(['say',text,options]),clearSpeech:()=>calls.push(['clear']),cancelMove:()=>{},detachAnchor:()=>calls.push(['detach'])});
 const api=installDemoScenarios({bot,root,site,adapter,window:w});t.after(()=>api.dispose());return{w,root,bot,calls,api,sourceEvents,observe:el=>observer.emit(el)};
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
 const x=setup(t,'company','<section id="nova-design"></section>');const target=x.root.firstChild;let resolve;x.bot.moveToElement=()=>new Promise(r=>resolve=r);x.observe(target);x.w.dispatchEvent(new x.w.Event('scroll'));target.getBoundingClientRect=()=>({width:200,height:100,top:-200,bottom:-100});resolve();await flush();assert.equal(x.calls.filter(c=>c[0]==='say').length,0);assert.ok(x.calls.some(c=>c[0]==='detach'));
});
