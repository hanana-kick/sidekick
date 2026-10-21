import test from 'node:test';
import assert from 'node:assert/strict';
import { AvatarRenderer } from '../src/renderer/webgl.js';
import { createDesign } from '../src/core/design.js';
import { initialPose } from '../src/core/motion.js';
const geometry = { vertices:new Float32Array([-.15,-.15,.02,0,0,1, .15,-.15,.02,0,0,1, 0,.15,.02,0,0,1]),indices:new Uint16Array([0,1,2]) };
function fixture() {
  let pixels = new Uint8ClampedArray();
  const canvas = {width:96,height:96,getContext:(type:string)=>type==='webgl2'?null:{createImageData:(w:number,h:number)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),putImageData:(image:{data:Uint8ClampedArray})=>{pixels=image.data.slice();}}} as unknown as HTMLCanvasElement;
  return {canvas,get pixels(){return pixels;}};
}
test('custom indexed mesh really renders through Canvas fallback, changes pose and is removable',()=>{
  const f=fixture(), renderer=new AvatarRenderer(f.canvas); renderer.resize(96,96,1);
  const design=createDesign(), state={pose:initialPose(),activity:'still' as const,time:0,delta:0,reduced:true,style:'flat' as const};
  renderer.render(design,state); const baseline=f.pixels;
  const pluginAccessories=[{id:'test',slot:'eyes' as const,color:'#ff00ff',asset:{pluginId:'test/triangle',slots:['eyes' as const],geometry}}];
  renderer.render(design,{...state,pluginAccessories});
  assert.ok(f.pixels.some((v,i)=>i%4===0 && v===255 && f.pixels[i+1]===0 && f.pixels[i+2]===255));
  assert.notDeepEqual(f.pixels,baseline); const first=f.pixels;
  renderer.render(design,{...state,pluginAccessories,bodyOrientation:{yaw:30}}); assert.notDeepEqual(f.pixels,first);
  renderer.render(design,state); assert.deepEqual(f.pixels,baseline);
  renderer.dispose(); renderer.dispose();
});
test('structured-cloned custom mesh payload renders identically after renderer replacement',()=>{
  const state={pose:initialPose(),activity:'still' as const,time:0,delta:0,reduced:true,style:'flat' as const,pluginAccessories:[{id:'test',slot:'eyes' as const,color:'#ff00ff',asset:{pluginId:'test/triangle',slots:['eyes' as const],geometry}}]};
  const a=fixture(),b=fixture(),ra=new AvatarRenderer(a.canvas),rb=new AvatarRenderer(b.canvas);
  ra.resize(96,96,1);rb.resize(96,96,1);ra.render(createDesign(),state);rb.render(createDesign(),structuredClone(state));
  assert.deepEqual(a.pixels,b.pixels);ra.dispose();rb.dispose();
});

test('attachment-local animation is independent and seeking restores exact pixels',async()=>{
  const {samplePartAnimation,validatePartAnimation}=await import('../src/core/part-animation.js');
  const f=fixture(),renderer=new AvatarRenderer(f.canvas);renderer.resize(96,96,1);
  const design=createDesign(),state={pose:initialPose(),activity:'still' as const,time:0,delta:0,reduced:true,style:'flat' as const};
  const pluginAccessories=[{id:'one',slot:'eyes' as const,color:'#ff00ff',asset:{pluginId:'test/triangle',slots:['eyes' as const],geometry}},{id:'two',slot:'mouth' as const,color:'#00ffff',asset:{pluginId:'test/triangle2',slots:['mouth' as const],geometry}}];
  const clip=validatePartAnimation({duration:2,tracks:[{target:{accessory:'one'},channel:'position',keyframes:[{time:0,value:[0,0,0]},{time:2,value:[.2,.1,0]}]},{target:{accessory:'two'},channel:'opacity',keyframes:[{time:0,value:1},{time:2,value:0}]}]});
  const render=(time:number)=>{renderer.render(design,{...state,pluginAccessories,partAnimation:samplePartAnimation(clip,time)});return f.pixels;};
  const first=render(.5),later=render(1.5);assert.notDeepEqual(first,later);assert.deepEqual(render(.5),first);
  renderer.render(design,{...state,pluginAccessories,partAnimation:samplePartAnimation(clip,.5),bodyOrientation:{yaw:25}});assert.notDeepEqual(f.pixels,first);
  renderer.dispose();
});

test('WebGL custom asset upload is stable across animated frames and freed on removal',async()=>{
  const {countingCanvas}=await import('./performance-fixture.mjs');
  const f=countingCanvas(),renderer=new AvatarRenderer(f.canvas),design=createDesign();
  const state={pose:initialPose(),activity:'still' as const,time:0,delta:0,reduced:true,style:'flat' as const,pluginAccessories:[{id:'test',slot:'eyes' as const,color:'#ff00ff',asset:{pluginId:'test/triangle',slots:['eyes' as const],geometry}}]};
  renderer.render(design,state);const before=f.snapshot();
  for(let i=0;i<10;i++)renderer.render(design,{...state,bodyOrientation:{yaw:i*3},partAnimation:{accessories:{test:{position:[i*.01,0,0]}}}});
  const after=f.snapshot();assert.equal(after.uploadedBytes,before.uploadedBytes);assert.equal(after.liveBuffers,before.liveBuffers);
  renderer.render(design,{...state,pluginAccessories:[]});assert.equal(f.snapshot().liveBuffers,after.liveBuffers-2);
  renderer.dispose();assert.equal(f.snapshot().liveBuffers,0);
});

test('built-in accessory local translation and opacity sample deterministically',async()=>{
  const {createAccessory}=await import('../src/core/design.js');
  const f=fixture(),renderer=new AvatarRenderer(f.canvas);renderer.resize(96,96,1);
  const design=createDesign({accessories:[createAccessory('halo',{id:'ring'})]}),state={pose:initialPose(),activity:'still' as const,time:0,delta:0,reduced:true,style:'flat' as const};
  renderer.render(design,state);const baseline=f.pixels;
  renderer.render(design,{...state,partAnimation:{accessories:{ring:{position:[.15,0,0],scale:[.8,.8,.8]}}}});const moved=f.pixels;assert.notDeepEqual(moved,baseline);
  renderer.render(design,{...state,partAnimation:{accessories:{ring:{opacity:0}}}});const hidden=f.pixels;
  renderer.render(createDesign(),state);assert.deepEqual(f.pixels,hidden);
  renderer.render(design,{...state,partAnimation:{accessories:{ring:{position:[.15,0,0],scale:[.8,.8,.8]}}}});assert.deepEqual(f.pixels,moved);renderer.dispose();
});
