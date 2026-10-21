import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { PartAnimationClip } from '../src/core/part-animation.ts';

const dom=new JSDOM('<!doctype html><body></body>',{pretendToBeVisual:true,url:'https://part-animation.test/'});
const originals=new Map<string,PropertyDescriptor|undefined>();
for(const [key,value] of Object.entries({HTMLElement:dom.window.HTMLElement,CustomEvent:dom.window.CustomEvent,requestAnimationFrame:dom.window.requestAnimationFrame.bind(dom.window),cancelAnimationFrame:dom.window.cancelAnimationFrame.bind(dom.window)})) {
  originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key)); Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
}
const {SidekickAvatar}=await import('../src/element/avatar.ts');
dom.window.customElements.define('part-test-avatar',SidekickAvatar);
test.after(()=>{ dom.window.close(); for(const[key,value]of originals) {if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);} });
function setup() {
  const bot=dom.window.document.createElement('part-test-avatar') as unknown as InstanceType<typeof SidekickAvatar>;
  const sent:any[]=[];
  const internal=bot as any;
  internal.bridge={send:(command:unknown)=>sent.push(command),revision:0,dispose:()=>{}};
  const clock=(time:number)=>{internal.elapsed=time; internal.snapshotState={time};};
  return {bot,sent,internal,clock};
}
const clip=():PartAnimationClip=>({duration:2,tracks:[{target:'body',channel:'rotation',keyframes:[{time:0,value:[0,0,0]},{time:2,value:[0,1,0]}]}]});
test('clip clock pauses/resumes/seeks independently of bot clock and owns snapshots',()=>{
  const {bot,sent,internal,clock}=setup(); clock(10);
  const input=clip(); bot.setPartAnimation(input); input.duration=99;
  assert.equal(bot.partAnimation?.clip.duration,2); assert.equal(bot.partAnimation?.playing,true);
  clock(10.75); assert.equal(bot.partAnimation?.time,.75);
  bot.pausePartAnimation(); clock(15); assert.equal(bot.partAnimation?.time,.75);
  bot.seekPartAnimation(1.25); assert.equal(bot.partAnimation?.time,1.25); assert.equal(bot.partAnimation?.playing,false);
  assert.equal(internal.elapsed,15); bot.playPartAnimation(); clock(15.5); assert.equal(bot.partAnimation?.time,1.75);
  const copy=bot.partAnimation!; copy.clip.duration=100; assert.equal(bot.partAnimation?.clip.duration,2);
  assert.equal(sent.filter(item=>item.kind==='state'&&Object.hasOwn(item.state,'time')).length,0);
  bot.clearPartAnimation(); assert.equal(bot.partAnimation,undefined); assert.ok(Object.hasOwn(sent.at(-1).state,'partAnimation')); assert.equal(sent.at(-1).state.partAnimation,undefined);
});
test('invalid clip or seek is atomic and absent-clip control is a no-op',()=>{
  const {bot,sent,clock}=setup(); clock(3); bot.pausePartAnimation();bot.playPartAnimation();bot.seekPartAnimation(2);assert.equal(sent.length,0);
  bot.setPartAnimation(clip()); const previous=bot.partAnimation;
  assert.throws(()=>bot.seekPartAnimation(-1)); assert.throws(()=>bot.seekPartAnimation(NaN));
  assert.throws(()=>bot.setPartAnimation({...clip(),duration:-1})); assert.deepEqual(bot.partAnimation,previous);
});
test('completed configuration survives disconnect and runtime generation initialization',()=>{
  const {bot,clock,internal}=setup();clock(4);bot.setPartAnimation(clip());clock(4.5);bot.pausePartAnimation();
  bot.disconnectedCallback(); assert.equal(bot.partAnimation?.time,.5);
  const runtime=internal.runtimeState();assert.equal(runtime.partAnimation.time,.5);assert.equal(runtime.partAnimation.playing,false);
  runtime.partAnimation.clip.duration=90;assert.equal(bot.partAnimation?.clip.duration,2);
});
test('accessory target ownership includes plugin IDs, rejects absent IDs before changing clip',async()=>{
  const {bot,internal}=setup(); internal.bridge=undefined;
  const {AccessoryPluginRegistry}=await import('../src/core/accessory-plugins.ts');
  const registry=new AccessoryPluginRegistry();
  registry.register({apiVersion:1,id:'test/hat',slots:['head'],createMesh:()=>({vertices:new Float32Array([0,0,0,0,0,1,.1,0,0,0,0,1,0,.1,0,0,0,1]),indices:new Uint16Array([0,1,2])})});
  await bot.equipPluginAccessory(registry,'test/hat',{slot:'head',id:'my-hat'});
  const accessoryClip=(id:string):PartAnimationClip=>({duration:1,tracks:[{target:{accessory:id},channel:'rotation',keyframes:[{time:0,value:[0,0,0]},{time:1,value:[0,1,0]}]}]});
  bot.setPartAnimation(accessoryClip('my-hat'));
  const old=bot.partAnimation;assert.throws(()=>bot.setPartAnimation(accessoryClip('absent')),/없습니다/);assert.deepEqual(bot.partAnimation,old);
  assert.deepEqual(await bot.motion.to({accessories:{'my-hat':{rotation:[0,0,.2]}}},{duration:0}),{finished:true});
  assert.throws(()=>bot.motion.to({accessories:{'absent':{rotation:[0,0,.2]}}},{duration:0}),/없습니다/);
});
test('global seek outranks stale snapshots until its runtime revision is acknowledged',()=>{
  const {bot,internal,clock}=setup();
  let revision=10;
  internal.bridge={send:()=>{revision++;},get revision(){return revision;},dispose:()=>{}};
  internal.acknowledgedRevision=10; clock(30); bot.setPartAnimation(clip());
  bot.seek(35); const seekRevision=revision;
  assert.equal(bot.partAnimation?.time,5);
  internal.acceptSnapshot({time:31,frames:100,pose:internal.currentPose},seekRevision-1);
  assert.equal(internal.snapshotState.time,31); assert.equal(internal.elapsed,35); assert.equal(bot.partAnimation?.time,5);
  bot.pausePartAnimation(); assert.equal(bot.partAnimation?.time,5);
  internal.acceptSnapshot({time:35.25,frames:101,pose:internal.currentPose},seekRevision);
  assert.equal(internal.elapsed,35.25); assert.equal(bot.partAnimation?.time,5);
  bot.playPartAnimation(); bot.seek(33.25);
  assert.equal(bot.partAnimation?.time,3);
  bot.setPartAnimation(clip());assert.equal(bot.partAnimation?.anchorTime,33.25);assert.equal(bot.partAnimation?.time,0);
});
test('playing local clock keeps signed backward seek delta for runtime sampler parity',()=>{
  const {bot,clock}=setup();clock(20);bot.setPartAnimation(clip());bot.seek(18);
  assert.equal(bot.partAnimation?.time,-2);bot.pausePartAnimation();assert.equal(bot.partAnimation?.time,-2);
});
test('catalog and plugin instance ids cannot collide, including a catalog change during lazy loading',async()=>{
 const {bot}=setup();const {createAccessory}=await import('../src/core/design.ts');
 const asset={pluginId:'test/plugin',slots:['mouth'],geometry:{vertices:new Float32Array([0,0,0,0,0,1,.1,0,0,0,0,1,0,.1,0,0,0,1]),indices:new Uint16Array([0,1,2])}};
 await bot.equipAccessory(createAccessory('halo',{id:'shared'}));
 await assert.rejects(bot.equipPluginAccessory({load:async()=>asset} as any,'test/plugin',{slot:'mouth',id:'shared'}));assert.deepEqual(bot.pluginAccessories,[]);
 let release!:(a:any)=>void;const pending=bot.equipPluginAccessory({load:()=>new Promise(resolve=>{release=resolve;})} as any,'test/plugin',{slot:'mouth',id:'later'});
 await Promise.resolve();await bot.equipAccessory(createAccessory('halo',{id:'later'}));release(asset);await assert.rejects(pending);assert.deepEqual(bot.pluginAccessories,[]);
 await bot.equipPluginAccessory({load:async()=>asset} as any,'test/plugin',{slot:'mouth',id:'custom'});
 const previous=bot.design;await assert.rejects(bot.equipAccessory(createAccessory('halo',{id:'custom'})));assert.deepEqual(bot.design,previous);
 for(const id of ['__proto__','constructor','prototype'])assert.throws(()=>bot.equipPluginAccessory({load:async()=>asset} as any,'test/plugin',{slot:'mouth',id}));
});
test('default namespaced plugin id supports legacy motion and removal clears retained pose',async()=>{
 const {bot,internal}=setup();internal.bridge=undefined;
 const asset={pluginId:'example/badge',slots:['mouth'],geometry:{vertices:new Float32Array([0,0,0,0,0,1,.1,0,0,0,0,1,0,.1,0,0,0,1]),indices:new Uint16Array([0,1,2])}};
 await bot.equipPluginAccessory({load:async()=>asset} as any,'example/badge',{slot:'mouth'});const id=bot.pluginAccessories[0]!.id;
 assert.equal(id,'example/badge:mouth');assert.deepEqual(await bot.motion.to({accessories:{[id]:{rotation:[0,.1,0]}}},{duration:0}),{finished:true});assert.deepEqual(internal.currentPose.accessories[id],[0,.1,0]);
 bot.removePluginAccessory('mouth');assert.equal(Object.hasOwn(internal.currentPose.accessories,id),false);assert.equal(Object.hasOwn(internal.validator.pose.accessories,id),false);
});
