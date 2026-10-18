import test from 'node:test';
import assert from 'node:assert/strict';
import { AvatarPresence, outsidePosition } from '../dist/src/element/presence.js';
import { AvatarMovement } from '../dist/src/element/movement.js';
function fixture() {
  let now=0, frame=0, hidden=false, presence, movement;
  const callbacks=new Map(), events=[], points=[], visibility=[];
  const state={ immediate:false, viewport:true, width:900, height:700, boxWidth:180, boxHeight:200 };
  const constrain=p=>({x:Math.max(0,Math.min(state.width-state.boxWidth,p.x)),y:Math.max(0,Math.min(state.height-state.boxHeight,p.y))});
  movement=new AvatarMovement({ now:()=>now,immediate:()=>state.immediate,constrain:p=>presence.bypassBounds?p:constrain(p),render:p=>points.push(p),complete:()=>{},requestFrame:cb=>{callbacks.set(++frame,cb);return frame;},cancelFrame:id=>callbacks.delete(id) });
  presence=new AvatarPresence({assertViewport:()=>{if(!state.viewport)throw Error('viewport');},position:()=>movement.position,geometry:()=>({width:state.boxWidth,height:state.boxHeight,viewportWidth:state.width,viewportHeight:state.height,offsetX:0,offsetY:0}),constrain,move:(p,o)=>movement.to(p,o),stage:p=>movement.relocate(p),visibility:value=>{hidden=value;visibility.push(value);},complete:(kind,result)=>events.push({kind,...result})});
  return {presence,movement,state,events,points,visibility,callbacks,get hidden(){return hidden;},async advance(ms){for(let end=now+ms;now<end;){now=Math.min(end,now+1000/60);for(const[id,cb]of[...callbacks]){callbacks.delete(id);cb(now);}await Promise.resolve();}},async finish(){for(let n=0;callbacks.size&&n<1800;n++)await this.advance(1000/60);await Promise.resolve();assert.equal(callbacks.size,0);}};
}
for(const edge of ['left','right','top','bottom'])test(`entry/exit ${edge} contains entire box outside, physical motion and hidden completion`,async()=>{
 const f=fixture(), enter=f.presence.enter({x:250,y:230},{from:edge});
 const start=f.movement.position;
 assert.equal(f.presence.current,'entering');assert.equal(f.hidden,false);
 assert.ok(edge==='left'?start.x+180<0:edge==='right'?start.x>900:edge==='top'?start.y+200<0:start.y>700);
 await f.advance(100);assert.ok(f.movement.state.speed>0);assert.ok(f.movement.state.speed<1350);
 await f.finish();assert.deepEqual(await enter,{finished:true,position:{x:250,y:230},presence:'visible'});
 const exit=f.presence.exit({to:edge});await f.advance(80);assert.equal(f.hidden,false);await f.finish();assert.equal((await exit).presence,'hidden');assert.equal(f.hidden,true);assert.equal(f.events.length,2);
});
test('superseded exit to entrance preserves current position, velocity and acceleration',async()=>{
 const f=fixture();f.state.immediate=true;await f.presence.enter({x:250,y:230});f.state.immediate=false;
 const first=f.presence.exit({to:'right'});await f.advance(140);const before=f.movement.state;
 const second=f.presence.enter({x:100,y:150},{from:'left'});const after=f.movement.state;
 assert.deepEqual(after.position,before.position);assert.deepEqual(after.velocity,before.velocity);assert.deepEqual(after.acceleration,before.acceleration);
 assert.equal((await first).finished,false);await f.finish();assert.equal((await second).finished,true);assert.equal(f.hidden,false);
});
test('resize recomputes exit edge without settling obsolete segment promise',async()=>{
 const f=fixture();f.state.immediate=true;await f.presence.enter({x:100,y:100});f.state.immediate=false;
 const exit=f.presence.exit({to:'right'});await f.advance(200);f.state.width=1200;f.presence.resize();await f.finish();assert.equal((await exit).position.x,1208);assert.equal(f.events.filter(e=>e.kind==='exit').length,1);
});
test('cancel exit brakes outside without clamping or automatically hiding',async()=>{
 const f=fixture();f.state.immediate=true;await f.presence.enter({x:700,y:100});f.state.immediate=false;
 const exit=f.presence.exit({to:'right'});await f.advance(500);const before=f.movement.position.x;f.presence.cancel();f.movement.cancel();assert.equal((await exit).finished,false);await f.finish();assert.ok(f.movement.position.x>=before);assert.equal(f.hidden,false);assert.equal(f.presence.current,'visible');
});
test('reduced/paused immediate exit and reentry preserve lifecycle and hidden state',async()=>{
 const f=fixture();f.state.immediate=true;const exit=await f.presence.exit({to:'bottom'});assert.equal(exit.finished,true);assert.equal(f.hidden,true);
 const entry=await f.presence.enter({x:30,y:50},{from:'top'});assert.equal(entry.finished,true);assert.equal(f.hidden,false);assert.deepEqual(f.movement.position,{x:30,y:50});
});
test('strict invalid options and inline placement fail atomically',async()=>{
 const f=fixture();const pending=f.presence.exit();for(const value of [{to:'nowhere'},{to:'left',maxSpeed:-1},{from:'left'},{to:'right',unknown:1},null])assert.throws(()=>f.presence.exit(value));
 assert.throws(()=>f.presence.enter({x:NaN,y:0}));f.state.viewport=false;assert.throws(()=>f.presence.enter({x:1,y:1}));assert.equal(f.presence.current,'exiting');f.state.viewport=true;await f.finish();assert.equal((await pending).finished,true);
});
test('normal move reveals hidden avatar and restores bounds only after recovery',async()=>{
 const f=fixture();f.state.immediate=true;await f.presence.exit({to:'left'});f.state.immediate=false;
 const revision=f.presence.reveal(), move=f.movement.to({x:80,y:60});assert.equal(f.hidden,false);assert.ok(f.presence.bypassBounds);await f.finish();assert.equal((await move).finished,true);f.presence.recovered(revision);assert.equal(f.presence.bypassBounds,false);
});
test('offscreen edge placement accounts for transformed bounding box offsets',()=>{
 const box={width:240,height:220,viewportWidth:900,viewportHeight:700,offsetX:-30,offsetY:15};assert.deepEqual(outsidePosition('left',{x:1,y:2},box),{x:-218,y:2});assert.deepEqual(outsidePosition('bottom',{x:1,y:2},box),{x:1,y:693});
});
