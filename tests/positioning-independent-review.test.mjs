import test, {before,after,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
let dom, frames, id=0; const timers=new Set(); const originals=new Map();
before(async()=>{
 dom=new JSDOM('<body></body>',{pretendToBeVisual:true});frames=new Map();
 const request=cb=>{frames.set(++id,cb);return id},cancel=id=>frames.delete(id);
 for(const [key,value] of Object.entries({HTMLElement:dom.window.HTMLElement,CustomEvent:dom.window.CustomEvent,requestAnimationFrame:request,cancelAnimationFrame:cancel})){
 originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
 }
 dom.window.requestAnimationFrame=request;dom.window.cancelAnimationFrame=cancel;
 const schedule=dom.window.setTimeout.bind(dom.window), clear=dom.window.clearTimeout.bind(dom.window);
 dom.window.setTimeout=(callback,delay,...args)=>{const handle=schedule(()=>{timers.delete(handle);callback(...args);},delay);timers.add(handle);return handle;};
 dom.window.clearTimeout=handle=>{timers.delete(handle);clear(handle);};
 const {SidekickAvatar}=await import('../src/element/avatar.ts');
 class TestAvatar extends SidekickAvatar {connectedCallback(){this.connected=true;}}
 dom.window.customElements.define('position-independent-avatar',TestAvatar);
});
const drain=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function frame(){for(const [key,cb] of [...frames])if(frames.delete(key))cb(performance.now()+100);}
afterEach(async()=>{dom.window.document.body.replaceChildren();await drain();assert.equal(frames.size,0);assert.equal(timers.size,0);});
after(()=>{dom.window.close();for(const [k,v]of originals){if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k];}});
function fixture(){
 const avatar=dom.window.document.createElement('position-independent-avatar'),target=dom.window.document.createElement('div');target.id='target';
 const layout={left:200,top:200,width:100,height:100};
 avatar.canvas=dom.window.document.createElement('canvas');avatar.attachShadow({mode:'open'}).append(avatar.canvas);
 avatar.getBoundingClientRect=()=>({left:avatar.position.x,top:avatar.position.y,width:20,height:20});
 avatar.getClientRects=()=>[avatar.getBoundingClientRect()];target.getClientRects=()=>[layout];target.getBoundingClientRect=()=>({...layout});
 dom.window.document.body.append(avatar,target);avatar.placementState='viewport';avatar.readyState=true;avatar.movementBox={width:20,height:20};
 const errors=[];avatar.addEventListener('sidekick-error',e=>errors.push(e.detail));return{avatar,target,layout,errors};
}
test('invalid mounted positioning target rolls back the entire HTML batch',()=>{
 const {avatar,target,errors}=fixture(); avatar.positioning={target}; const before=avatar.zoom;
 avatar.setAttribute('zoom','1.5'); avatar.setAttribute('positioning',JSON.stringify({target:'#missing'})); avatar.flushAttributes();
 assert.equal(errors.length,1); assert.equal(avatar.zoom,before); assert.equal(avatar.positioning.target,target);
});
test('progress listener replacing declaration retains newer intent and observer',()=>{
 const {avatar,target}=fixture(); let replaced=false;
 avatar.addEventListener('sidekick-move-progress',()=>{ if(replaced)return; replaced=true; avatar.positioning={target:'viewport',placement:'top-left'}; });
 avatar.positioning={target}; assert.equal(avatar.positioning.target,'viewport'); assert.equal(avatar.positioning.placement,'top-left'); assert.ok(avatar.anchorCleanup);
});
test('error listener replacement survives lost target cleanup',()=>{
 const {avatar,target,errors}=fixture(); avatar.positioning={target};
 avatar.addEventListener('sidekick-error',()=>{avatar.positioning={target:'viewport',placement:'top-left'};},{once:true});
 target.remove(); frame(); assert.equal(errors.length,1); assert.equal(avatar.positioning.target,'viewport'); assert.ok(avatar.anchorCleanup);
});
test('changing positioning during exit cancels exit and recovers visible presence',async()=>{
 const {avatar,target}=fixture(); avatar.positioning={target}; const exiting=avatar.exit({to:'left'});
 avatar.positioning={target:'viewport',placement:'top-right'};
 assert.notEqual(avatar.presenceState,'exiting'); await exiting;
 assert.equal(avatar.positioning.target,'viewport'); assert.equal(avatar.presenceHidden,false);
});
test('invalid imperative enter leaves positioning binding intact',()=>{
 const {avatar,target}=fixture(); avatar.positioning={target};
 assert.throws(()=>avatar.enter({x:NaN,y:0})); assert.equal(avatar.positioning.target,target); assert.ok(avatar.anchorCleanup);
});
test('positioning after completed exit reveals avatar at requested destination',async()=>{
 const {avatar,target}=fixture(); avatar.pausedState=true; await avatar.exit({to:'left'}); assert.equal(avatar.presenceHidden,true);
 avatar.positioning={target,placement:'center-right'}; await drain();
 assert.equal(avatar.presenceHidden,false); assert.equal(avatar.presenceState,'visible'); assert.deepEqual(avatar.position,{x:316,y:240});
});
test('null during entrance stops arrival and observer from reacquiring movement',async()=>{
 const {avatar,target}=fixture(); avatar.readyState=false; avatar.positioning={target}; avatar.entrance={source:'viewport',edge:'left',at:.2}; avatar.readyState=true; avatar.startEntrance();
 avatar.positioning=null; await drain(); assert.equal(avatar.positioning,null); assert.equal(avatar.entranceCleanup,undefined); assert.equal(avatar.anchorCleanup,undefined);
});
test('newer positioning from synchronous batch event wins over older batch declaration',()=>{
 const {avatar,target}=fixture(); avatar.addEventListener('sidekick-zoom-change',()=>{ avatar.positioning={target:'viewport',placement:'top-left'}; },{once:true});
 avatar.setAttribute('zoom','1.5'); avatar.setAttribute('positioning',JSON.stringify({target:'#target',placement:'center-right'})); avatar.flushAttributes();
 assert.equal(avatar.positioning.target,'viewport'); assert.equal(avatar.positioning.placement,'top-left');
});
test('invalid exit options leave positioning intact',()=>{
 const {avatar,target}=fixture(); avatar.positioning={target}; assert.throws(()=>avatar.exit({to:'invalid'})); assert.equal(avatar.positioning.target,target);
});
test('positioning target lost during entrance releases declaration and both observers',async()=>{
 const {avatar,target,errors}=fixture(); avatar.readyState=false; avatar.positioning={target}; avatar.entrance={source:'viewport',edge:'left',at:.2}; avatar.readyState=true; avatar.startEntrance();
 target.remove(); frame(); await drain(); assert.equal(errors.length,1); assert.equal(avatar.positioning,null); assert.equal(avatar.entranceCleanup,undefined); assert.equal(avatar.anchorCleanup,undefined);
});
test('selector replacement during entrance cannot silently change target identity',async()=>{
 const {avatar,target,errors}=fixture(); avatar.readyState=false; avatar.positioning={target:'#target'}; avatar.entrance={source:'viewport',edge:'left',at:.2}; avatar.readyState=true; avatar.startEntrance();
 const replacement=target.cloneNode(); replacement.getBoundingClientRect=()=>({left:600,top:400,width:100,height:100}); replacement.getClientRects=()=>[replacement.getBoundingClientRect()]; target.replaceWith(replacement);
 frame(); await drain(); assert.equal(errors.length,1); assert.equal(avatar.positioning,null); assert.equal(avatar.entranceCleanup,undefined);
});
test('combined legacy coordinates and positioning apply the declarative final target',()=>{
 const {avatar,target,errors}=fixture(); avatar.pausedState=true;
 avatar.setAttribute('position-x','40'); avatar.setAttribute('position-y','60'); avatar.setAttribute('positioning',JSON.stringify({target:'#target',placement:'center-right'})); avatar.flushAttributes();
 assert.deepEqual(errors,[]); assert.equal(avatar.positioning?.target,'#target'); assert.deepEqual(avatar.position,{x:316,y:240});
});
test('entrance target-loss error handler can install newer positioning',async()=>{
 const {avatar,target}=fixture(); avatar.readyState=false; avatar.positioning={target}; avatar.entrance={source:'viewport',edge:'left',at:.2}; avatar.readyState=true; avatar.startEntrance();
 avatar.addEventListener('sidekick-error',()=>{avatar.positioning={target:'viewport',placement:'top-left'};},{once:true}); target.remove(); frame(); await drain();
 assert.equal(avatar.positioning?.target,'viewport'); assert.ok(avatar.anchorCleanup); assert.equal(avatar.entranceCleanup,undefined);
});
