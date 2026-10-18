import test from 'node:test';
import assert from 'node:assert/strict';
import { AvatarPresence, outsidePosition } from '../dist/src/element/presence.js';
import { AvatarMovement } from '../dist/src/element/movement.js';
function fixture(hooks = {}) {
  let now=0, frame=0, hidden=false, presence, movement;
  const callbacks=new Map(), events=[], points=[], visibility=[];
  const state={ immediate:false, viewport:true, width:900, height:700, boxWidth:180, boxHeight:200 };
  const constrain=p=>({x:Math.max(0,Math.min(state.width-state.boxWidth,p.x)),y:Math.max(0,Math.min(state.height-state.boxHeight,p.y))});
  movement=new AvatarMovement({ now:()=>now,immediate:()=>state.immediate,constrain:p=>presence.bypassBounds?p:constrain(p),render:p=>points.push(p),complete:()=>{},progress:s=>hooks.progress?.(s),requestFrame:cb=>{callbacks.set(++frame,cb);return frame;},cancelFrame:id=>callbacks.delete(id) });
  presence=new AvatarPresence({assertViewport:()=>{if(!state.viewport)throw Error('viewport');},position:()=>movement.position,geometry:()=>({width:state.boxWidth,height:state.boxHeight,viewportWidth:state.width,viewportHeight:state.height,offsetX:0,offsetY:0}),constrain,move:(p,o)=>movement.to(p,o),stage:p=>movement.relocate(p),visibility:value=>{hidden=value;visibility.push(value);},complete:(kind,result)=>{events.push({kind,...result});hooks.complete?.(kind,result);}});
  return {presence,movement,state,events,points,visibility,callbacks,get hidden(){return hidden;},async advance(ms){for(let end=now+ms;now<end;){now=Math.min(end,now+1000/60);for(const[id,cb]of[...callbacks]){callbacks.delete(id);cb(now);}await Promise.resolve();}},async finish(){for(let n=0;callbacks.size&&n<1800;n++)await this.advance(1000/60);await Promise.resolve();assert.equal(callbacks.size,0);}};
}

test('presence completion listener can replace an interrupted exit exactly once', async()=>{
 let replacement;
 const f=fixture({complete(kind,result){if(kind==='exit'&&!result.finished&&!replacement)replacement=f.presence.enter({x:111,y:222});}});
 const first=f.presence.exit();await f.advance(100);
 const superseded=f.presence.enter({x:333,y:444});
 assert.equal((await first).finished,false);assert.equal((await superseded).finished,false);
 await f.finish();assert.equal((await replacement).finished,true);assert.deepEqual(f.movement.position,{x:111,y:222});
 assert.equal(f.events.filter(e=>e.kind==='exit').length,1);
});
test('hidden relocation cannot overwrite a newer move from synchronous progress callback', async()=>{
 let armed=false,replacement;
 const f=fixture({progress(s){if(armed&&s.phase==='idle'&&!replacement){armed=false;replacement=f.movement.to({x:444,y:222});}}});
 f.movement.to({x:700,y:300});await f.advance(100);const before=f.movement.position;armed=true;
 f.movement.relocate({x:-188,y:0});
 assert.deepEqual(f.movement.position,before,'newer movement retains sampled position rather than old stage');
 await f.finish();assert.equal((await replacement).finished,true);assert.deepEqual(f.movement.position,{x:444,y:222});
});
test('cancel ownership guard leaves newer entry from cancellation event running', async()=>{
 let replacement;
 const f=fixture({complete(kind,result){if(kind==='exit'&&!result.finished&&!replacement)replacement=f.presence.enter({x:123,y:234});}});
 const exit=f.presence.exit();await f.advance(100);
 const revision=f.presence.interrupt();if(f.presence.owns(revision))f.movement.cancel();
 assert.equal((await exit).finished,false);await f.finish();assert.equal((await replacement).finished,true);
 assert.deepEqual(f.movement.position,{x:123,y:234});assert.equal(f.hidden,false);
});
test('already hidden exit emits exactly one completion for each call',async()=>{
 const f=fixture();f.state.immediate=true;
 await f.presence.exit();await f.presence.exit();assert.equal(f.events.length,2);assert(f.events.every(e=>e.finished&&e.presence==='hidden'));
});
test('disconnect sequence settles presence and cancels pending frames',async()=>{
 const f=fixture();const exit=f.presence.exit();await f.advance(150);
 f.state.viewport=false;f.presence.cancel();f.movement.disconnect();
 assert.equal((await exit).finished,false);assert.equal(f.callbacks.size,0);assert.equal(f.events.length,1);
});
test('cancel from staging idle callback prevents offscreen relocation after cancellation',async()=>{
 let armed=false;
 const f=fixture({progress(s){if(armed&&s.phase==='idle'){armed=false;const revision=f.presence.interrupt();if(f.presence.owns(revision))f.movement.cancel();}}});
 f.movement.to({x:700,y:300});await f.advance(100);const before=f.movement.position;armed=true;
 const enter=f.presence.enter({x:200,y:150});
 assert.equal((await enter).finished,false);assert.deepEqual(f.movement.position,before,'cancelled entry must not stage offscreen afterward');
 assert.equal(f.hidden,false);assert.equal(f.callbacks.size,0);
});
