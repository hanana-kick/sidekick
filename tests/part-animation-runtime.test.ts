import test from 'node:test';
import assert from 'node:assert/strict';
import {RenderEngine} from '../src/runtime/render-engine.js';
import {createDesign} from '../src/core/design.js';
import {initialPose} from '../src/core/motion.js';
import {validatePartAnimation} from '../src/core/part-animation.js';
const clip=validatePartAnimation({duration:2,tracks:[{target:'body',channel:'rotation',keyframes:[{time:0,value:[0,0,0]},{time:2,value:[0,1,0]}]}]});
function fixture(){
 const renders:any[]=[];let callback:((time:number)=>void)|undefined;
 const canvas={width:32,height:32,addEventListener(){},removeEventListener(){}} as unknown as HTMLCanvasElement;
 const renderer={canvas,stats:{drawCalls:1,buffers:0},resize(){},render(_d:any,s:any){renders.push(structuredClone(s));},readPixels(){return new Uint8Array(4096);},dispose(){}};
 const state:any={design:createDesign(),bodyOrientation:{yaw:0,pitch:0,roll:0},zoom:1,pose:initialPose(),activity:'still',paused:false,reduced:false,active:true,time:0,gaze:[0,0],trackingMode:'off',width:32,height:32,dpr:1};
 const engine=new RenderEngine(canvas,state,()=>{},{request(fn){callback=fn;return 1;},cancel(){callback=undefined;}},renderer);
 return{engine,renders,step(time:number){const fn=callback;callback=undefined;fn?.(time);},get scheduled(){return !!callback;}};
}
test('clip uses common runtime clock, seek is reproducible and paused clip does not freeze global time',()=>{
 const f=fixture();f.engine.command({kind:'state',state:{partAnimation:{clip,time:0,anchorTime:0,playing:true}}});f.step(100);f.step(200);
 assert.ok(f.renders.at(-1).partAnimation.bodyRotation[1]>0);assert.ok(f.scheduled);
 f.engine.command({kind:'state',state:{partAnimation:{clip,time:1,anchorTime:0,playing:false}}});f.step(300);assert.equal(f.renders.at(-1).partAnimation.bodyRotation[1],.5);
 f.engine.command({kind:'state',state:{time:8}});f.step(400);assert.equal(f.renders.at(-1).partAnimation.bodyRotation[1],.5);
 f.engine.command({kind:'state',state:{partAnimation:{clip,time:.2,anchorTime:8,playing:false}}});f.step(500);assert.equal(f.renders.at(-1).partAnimation.bodyRotation[1],.1);
 f.engine.command({kind:'state',state:{partAnimation:undefined}});f.step(600);assert.equal(f.renders.at(-1).partAnimation,undefined);f.engine.dispose();
});
test('constant clips and absent accessory tracks do not keep still renderer running',()=>{
 for(const clip of [validatePartAnimation({duration:2,loop:true,tracks:[{target:'body',channel:'rotation',keyframes:[{time:0,value:[0,0,0]},{time:2,value:[0,0,0]}]}]}),validatePartAnimation({duration:2,loop:true,tracks:[{target:{accessory:'missing'},channel:'opacity',keyframes:[{time:0,value:0},{time:2,value:1}]}]})]){
  const f=fixture();f.engine.command({kind:'state',state:{partAnimation:{clip,time:0,anchorTime:0,playing:true}}});f.step(100);assert.equal(f.scheduled,false);f.engine.dispose();
 }
});
test('removing plugin equipment cancels its transient motion and stops absent looping tracks',()=>{
 const f=fixture(),asset={pluginId:'x',slots:['eyes' as const],geometry:{vertices:new Float32Array([0,0,0,0,0,1,.1,0,0,0,0,1,0,.1,0,0,0,1]),indices:new Uint16Array([0,1,2])}};
 const pluginAccessories=[{id:'x',slot:'eyes' as const,color:'#ffffff',asset}];
 const clip=validatePartAnimation({duration:2,loop:true,tracks:[{target:{accessory:'x'},channel:'opacity',keyframes:[{time:0,value:0},{time:2,value:1}]}]});
 f.engine.command({kind:'state',state:{pluginAccessories,partAnimation:{clip,time:0,anchorTime:0,playing:true}}});f.engine.command({kind:'motion',target:{accessories:{x:{rotation:[0,1,0]}}},options:{duration:10000},request:1});f.step(100);assert.equal(f.scheduled,true);
 f.engine.command({kind:'state',state:{pluginAccessories:[]}});f.step(200);assert.equal(f.scheduled,false);
 f.engine.command({kind:'state',state:{pluginAccessories}});f.step(300);assert.equal(f.scheduled,true);f.engine.dispose();
});
test('reduced motion displays explicit clip sample without advancing on unrelated dirty frames',()=>{
 const f=fixture();f.engine.command({kind:'state',state:{reduced:true,partAnimation:{clip,time:.5,anchorTime:0,playing:true}}});f.step(100);assert.equal(f.renders.at(-1).partAnimation.bodyRotation[1],.25);assert.equal(f.scheduled,false);
 f.engine.command({kind:'state',state:{time:12}});f.step(200);assert.equal(f.renders.at(-1).partAnimation.bodyRotation[1],.25);assert.equal(f.scheduled,false);f.engine.dispose();
});
test('bone tracks use shared scheduling and become dormant when their rig is removed',()=>{
 const f=fixture();const rig={skeleton:{bones:[{id:'root'}]},influences:[]};
 const clip=validatePartAnimation({duration:2,loop:true,tracks:[{target:{bone:'root'},channel:'rotation',keyframes:[{time:0,value:[0,0,0]},{time:2,value:[0,0,.5]}]}]});
 f.engine.command({kind:'state',state:{rig,bonePose:{root:{position:[.1,0,0]}},partAnimation:{clip,time:0,anchorTime:0,playing:true}}});f.step(100);f.step(200);
 assert.equal(f.scheduled,true);assert.ok(f.renders.at(-1).partAnimation.bones.root.rotation[2]>0);assert.equal(f.renders.at(-1).bonePose.root.position[0],.1);
 f.engine.command({kind:'state',state:{rig:undefined}});f.step(300);assert.equal(f.scheduled,false);
 f.engine.command({kind:'state',state:{rig,reduced:true}});f.step(400);assert.equal(f.scheduled,false);
 f.engine.command({kind:'state',state:{partAnimation:{clip,time:1,anchorTime:0,playing:false}}});f.step(500);assert.equal(f.renders.at(-1).partAnimation.bones.root.rotation[2],.25);f.engine.dispose();
});
test('body rig updates do not cancel independent accessory motion ownership',()=>{
 const f=fixture();const asset={pluginId:'x',slots:['head' as const],geometry:{vertices:new Float32Array([0,0,0,0,0,1,.1,0,0,0,0,1,0,.1,0,0,0,1]),indices:new Uint16Array([0,1,2])}};
 f.engine.command({kind:'state',state:{pluginAccessories:[{id:'x',slot:'head',color:'#ffffff',asset}]}});
 f.engine.command({kind:'motion',target:{accessories:{x:{rotation:[0,1,0]}}},options:{duration:10000},request:1});
 assert.equal((f.engine as any).timeline.active,true);
 f.engine.command({kind:'state',state:{rig:{skeleton:{bones:[{id:'root'}]},influences:[]}}});
 assert.equal((f.engine as any).timeline.active,true);
 f.engine.command({kind:'state',state:{rig:undefined}});assert.equal((f.engine as any).timeline.active,true);f.engine.dispose();
});
