import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createScrollRegions } from '../dist/library/element/scroll-regions.js';

function setup(t){
 const dom=new JSDOM('<body><div id="bot"></div><main><section id="a"><h2>A</h2></section><section id="b"><h2>B</h2></section></main></body>',{pretendToBeVisual:true});
 const win=dom.window,doc=win.document,bot=doc.querySelector('#bot'),a=doc.querySelector('#a'),b=doc.querySelector('#b');
 Object.defineProperties(win,{innerWidth:{value:800},innerHeight:{value:600}});
 let anchor=null,cancels=0;const calls=[],changes=[];
 Object.defineProperties(bot,{offsetWidth:{value:64},offsetHeight:{value:64},elementAnchor:{get:()=>anchor}});
 Object.assign(bot,{placement:'viewport',presenceState:'visible',moveToElement(target,options){anchor={target};calls.push({target,options});return Promise.resolve({finished:true});},cancelMove(){anchor=null;cancels++;}});
 const rect=(el,top,bottom,left=0,right=800)=>{el.getBoundingClientRect=()=>({top,bottom,left,right,width:right-left,height:bottom-top});el.getClientRects=()=>[el.getBoundingClientRect()];};
 rect(a,0,600);rect(b,600,1200);rect(a.parentElement,0,1200);
 const make=(extra={})=>{const c=createScrollRegions(bot,{regions:[{id:'a',region:a,target:a.firstElementChild},{id:'b',region:b}],onChange:x=>changes.push(x),...extra});t.after(()=>c.dispose());return c;};
 t.after(()=>dom.window.close());
 return {win,doc,bot,a,b,rect,make,calls,changes,manual(){anchor=null;},get cancels(){return cancels;}};
}
test('one anchor preserves travel across small, rapid and reverse region changes',t=>{
 const x=setup(t),c=x.make(),marker=x.calls[0].target;
 assert.equal(c.activeRegion,'a');assert.equal(x.changes[0].target,x.a.firstElementChild);
 const y=marker.style.top;
 x.rect(x.a,-290,310);x.rect(x.b,310,910);c.refresh();assert.equal(c.activeRegion,'a');assert.equal(marker.style.top,y);
 x.rect(x.a,-320,280);x.rect(x.b,280,880);c.refresh();assert.equal(c.activeRegion,'a');
 x.rect(x.a,-400,200);x.rect(x.b,200,800);c.refresh();assert.equal(c.activeRegion,'b');
 x.rect(x.a,0,600);x.rect(x.b,600,1200);c.refresh();assert.equal(c.activeRegion,'a');
 assert.equal(x.calls.length,1);assert.equal(x.calls[0].options.travel,'natural');assert.equal(x.cancels,0);
});
test('manual move and hidden presence pause without reclaiming or revealing',t=>{
 const x=setup(t),c=x.make();x.manual();c.refresh();assert.equal(c.paused,true);assert.equal(x.calls.length,1);
 c.refresh();assert.equal(x.calls.length,1);c.resume();assert.equal(x.calls.length,2);
 x.bot.presenceState='hidden';c.refresh();assert.equal(c.paused,true);c.resume();assert.equal(c.paused,true);assert.equal(x.calls.length,2);
});
test('explicit positions and element placement stay separate from reaction targets',t=>{
 const x=setup(t);x.rect(x.a.firstElementChild,100,200,100,300);
 const c=x.make({regions:[{id:'a',region:x.a,target:x.b,waitAt:{element:x.a.firstElementChild,alignX:'right',alignY:'bottom',x:10,y:5}}]});
 const marker=x.calls[0].target;assert.equal(marker.style.left,'246px');assert.equal(marker.style.top,'141px');assert.equal(x.changes[0].target,x.b);
 x.rect(x.a.firstElementChild,900,1000,1000,1200);c.refresh();assert.equal(marker.style.left,'736px');assert.equal(marker.style.top,'536px');
});
test('nested overflow and root clipping deactivate invisible regions',t=>{
 const x=setup(t),root=x.a.parentElement;root.style.overflow='auto';x.rect(root,50,250);
 const c=x.make({root});assert.equal(c.activeRegion,'a');
 x.rect(x.a,-600,-1);x.rect(x.b,800,900);c.refresh();assert.equal(c.activeRegion,null);assert.equal(x.cancels,1);
 x.rect(x.b,100,300);c.refresh();assert.equal(c.activeRegion,'b');assert.equal(x.calls.length,2);
});
test('pause and dispose stop only owned anchors and remove marker',t=>{
 const x=setup(t),c=x.make(),marker=x.calls[0].target;c.pause();assert.equal(x.cancels,1);assert.equal(c.paused,true);
 c.resume();x.manual();c.dispose();assert.equal(x.cancels,1);assert.equal(marker.isConnected,false);c.resume();assert.equal(x.calls.length,2);
});
test('invalid data is rejected before creating a marker',t=>{
 const x=setup(t);for(const extra of [{activationLine:2},{hysteresis:-1},{regions:[{id:'x',region:x.a},{id:'x',region:x.b}]},{regions:[{id:'x',region:x.a,waitAt:{x:NaN,y:0}}]}])assert.throws(()=>x.make(extra),TypeError);
 assert.equal(x.doc.querySelector('[data-sidekick-scroll-regions]'),null);
});

test('shared scheduler catches layout movement without explicit refresh',async t=>{
 const x=setup(t),c=x.make();x.rect(x.a,-800,-200);x.rect(x.b,0,600);
 await new Promise(resolve=>x.win.setTimeout(resolve,300));assert.equal(c.activeRegion,'b');assert.equal(x.calls.length,1);
});
test('onChange exceptions do not leak the controller or interrupt later updates',t=>{
 const x=setup(t);let errors=0;t.mock.method(x.win.console,'error',()=>errors++);
 const c=x.make({onChange(){throw new Error('callback');}});assert.equal(errors,1);c.dispose();assert.equal(x.doc.querySelector('[data-sidekick-scroll-regions]'),null);
});
test('viewport resizing reclamps explicit waits and retains the movement anchor',t=>{
 const x=setup(t),c=x.make({regions:[{id:'a',region:x.a,waitAt:{x:1000,y:1000}}]});const marker=x.calls[0].target;
 assert.equal(marker.style.left,'736px');
 Object.defineProperty(x.win,'innerWidth',{value:320});Object.defineProperty(x.win,'innerHeight',{value:240});c.refresh();assert.equal(marker.style.left,'256px');assert.equal(marker.style.top,'176px');assert.equal(x.calls.length,1);
});
test('overlap priority is stable array order with hysteresis, not last scroll direction',t=>{
 const x=setup(t);x.rect(x.b,0,600);const c=x.make();assert.equal(c.activeRegion,'a');
 x.rect(x.a,-310,290);c.refresh();assert.equal(c.activeRegion,'a');
 x.rect(x.a,-400,200);c.refresh();assert.equal(c.activeRegion,'b');
 x.rect(x.a,0,600);c.refresh();assert.equal(c.activeRegion,'b');
});
test('dispose removes shared scheduler scroll, resize and visibility listeners',t=>{
 const x=setup(t),removed=[];
 const docRemove=x.doc.removeEventListener.bind(x.doc),winRemove=x.win.removeEventListener.bind(x.win);
 t.mock.method(x.doc,'removeEventListener',(type,...args)=>{removed.push(type);return docRemove(type,...args);});
 t.mock.method(x.win,'removeEventListener',(type,...args)=>{removed.push(type);return winRemove(type,...args);});
 const c=x.make();c.dispose();for(const event of ['scroll','resize','visibilitychange'])assert.ok(removed.includes(event));
});
