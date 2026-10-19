import test, {before,after,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
let dom, frames, id=0; const originals=new Map();
before(async()=>{
 dom=new JSDOM('<body></body>',{pretendToBeVisual:true});frames=new Map();
 const request=cb=>{frames.set(++id,cb);return id},cancel=id=>frames.delete(id);
 for(const [key,value] of Object.entries({HTMLElement:dom.window.HTMLElement,CustomEvent:dom.window.CustomEvent,requestAnimationFrame:request,cancelAnimationFrame:cancel})){
 originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
 }
 dom.window.requestAnimationFrame=request;dom.window.cancelAnimationFrame=cancel;
 const {SidekickAvatar}=await import('../src/element/avatar.ts');
 class TestAvatar extends SidekickAvatar {connectedCallback(){this.connected=true;}}
 dom.window.customElements.define('position-review-avatar',TestAvatar);
});
const drain=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function frame(){for(const [key,cb] of [...frames])if(frames.delete(key))cb(performance.now()+100);}
afterEach(async()=>{dom.window.document.body.replaceChildren();await drain();assert.equal(frames.size,0);});
after(()=>{dom.window.close();for(const [k,v]of originals){if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k];}});
function fixture(){
 const avatar=dom.window.document.createElement('position-review-avatar'),target=dom.window.document.createElement('div');target.id='target';
 const layout={left:200,top:200,width:100,height:100};
 avatar.canvas=dom.window.document.createElement('canvas');avatar.attachShadow({mode:'open'}).append(avatar.canvas);
 avatar.getBoundingClientRect=()=>({left:avatar.position.x,top:avatar.position.y,width:20,height:20});
 avatar.getClientRects=()=>[avatar.getBoundingClientRect()];target.getClientRects=()=>[layout];target.getBoundingClientRect=()=>({...layout});
 dom.window.document.body.append(avatar,target);avatar.placementState='viewport';avatar.readyState=true;avatar.movementBox={width:20,height:20};
 const errors=[];avatar.addEventListener('sidekick-error',e=>errors.push(e.detail));return{avatar,target,layout,errors};
}
test('initial declaration stages before reveal and preserves DOM parent',()=>{
 const {avatar,target}=fixture();const parent=avatar.parentNode;avatar.readyState=false;avatar.positioning={target,placement:'center-right'};
 assert.deepEqual(avatar.position,{x:0,y:0});avatar.readyState=true;avatar.startPositioning(true);
 assert.deepEqual(avatar.position,{x:316,y:240});assert.equal(avatar.parentNode,parent);
});
test('equal declarations preserve current physical flight; copies do not expose mutable state',()=>{
 const {avatar,target}=fixture();avatar.positioning={target,placement:'center-right'};const track=avatar.movement.track;frame();const point=avatar.position;
 avatar.positioning={target,placement:'center-right',gap:16,offset:{x:0,y:0},follow:true};assert.equal(avatar.movement.track,track);assert.deepEqual(avatar.position,point);
 const copy=avatar.positioning;copy.offset.x=200;assert.equal(avatar.positioning.offset.x,0);
});
test('moving target updates pursuit, not immediate DOM teleport',()=>{
 const {avatar,target,layout}=fixture();avatar.positioning={target,placement:'center-right'};frame();const before=avatar.position;layout.left+=120;frame();
 assert.notDeepEqual(avatar.position,{x:436,y:240});assert.ok(avatar.position.x>=before.x);assert.ok(avatar.movement.track);
});
test('one-shot does not attach scheduler and ignores later target movement',()=>{
 const {avatar,target,layout}=fixture();avatar.pausedState=true;avatar.positioning={target,placement:'center-right',follow:false};
 assert.deepEqual(avatar.position,{x:316,y:240});assert.equal(avatar.anchorCleanup,undefined);layout.left+=100;frame();assert.deepEqual(avatar.position,{x:316,y:240});
});
test('null, imperative movement, cancel and detach relinquish declaration',async()=>{
 for(const method of ['null','moveTo','moveBy','cancelMove','detachAnchor']){
  const {avatar,target}=fixture();avatar.pausedState=true;avatar.positioning={target};
  if(method==='null')avatar.positioning=null;else if(method==='moveTo')await avatar.moveTo({x:50,y:60});else if(method==='moveBy')await avatar.moveBy({x:1,y:2});else avatar[method]();
  assert.equal(avatar.positioning,null);assert.equal(avatar.anchorCleanup,undefined);avatar.remove();target.remove();
 }
});
test('missing/replaced target reports one error and releases observers',()=>{
 const {avatar,target,errors}=fixture();avatar.positioning={target:'#target'};target.remove();frame();assert.equal(avatar.positioning,null);assert.equal(errors.length,1);assert.equal(avatar.anchorCleanup,undefined);frame();assert.equal(errors.length,1);
});
test('invalid replacement leaves previous declaration and flight intact',()=>{
 const {avatar,target}=fixture();avatar.positioning={target};const track=avatar.movement.track;
 assert.throws(()=>{avatar.positioning={target:'#missing'};});assert.equal(avatar.positioning.target,target);assert.equal(avatar.movement.track,track);
});
test('offscreen current and destination suspend movement, return wakes pursuit',()=>{
 const {avatar,target,layout}=fixture();avatar.boundsState='none';avatar.movement.relocate({x:-300,y:-300});layout.left=-500;layout.top=-500;
 avatar.positioning={target};frame();assert.equal(avatar.anchorSleeping,true);layout.left=200;layout.top=200;dom.window.document.dispatchEvent(new dom.window.Event('scroll'));frame();assert.equal(avatar.movement.suspended,false);
});
test('entrance preserves source at while positioning supplies destination',()=>{
 const {avatar,target}=fixture();avatar.readyState=false;avatar.positioning={target,placement:'center-right'};avatar.entrance={source:'viewport',edge:'left',at:.2};avatar.readyState=true;avatar.startEntrance();
 assert.deepEqual(avatar.position,{x:-28,y:(dom.window.innerHeight-20)*.2});assert.deepEqual(avatar.presence.operation.point,{x:316,y:240});
});
test('JSON null detaches without an invalid transaction',()=>{
 const {avatar,target,errors}=fixture();avatar.positioning={target};avatar.setAttribute('positioning','null');avatar.flushAttributes();assert.equal(avatar.positioning,null);assert.deepEqual(errors,[]);
});

test('signed gap is preserved through follow, entrance destination, and viewport bounds',()=>{
 const {avatar,target,layout}=fixture();avatar.pausedState=true;
 avatar.positioning={target,placement:'center-right',gap:-10};
 assert.deepEqual(avatar.position,{x:290,y:240});
 layout.left+=50;frame();assert.deepEqual(avatar.position,{x:340,y:240});
 avatar.positioning={target:'viewport',placement:'top-left',gap:-20};
 assert.deepEqual(avatar.position,{x:0,y:0});
 avatar.boundsState='none';avatar.positioning={target:'viewport',placement:'top-left',gap:-21};
 assert.deepEqual(avatar.position,{x:-21,y:-21});
 avatar.readyState=false;avatar.positioning={target,placement:'center-right',gap:-10};
 avatar.entrance={source:'viewport',edge:'left',at:.2};avatar.readyState=true;avatar.pausedState=false;avatar.startEntrance();
 assert.deepEqual(avatar.presence.operation.point,{x:340,y:240});
});
