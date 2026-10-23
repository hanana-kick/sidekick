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

const rig=()=>({skeleton:{bones:[{id:'root'},{id:'tip',parent:'root',position:[0,.2,0] as [number,number,number]}]},influences:[],fallbackBone:'root' as const,attachments:{head:'tip'}});
const boneClip=():PartAnimationClip=>({duration:1,tracks:[{target:{bone:'tip'},channel:'rotation',keyframes:[{time:0,value:[0,0,0]},{time:1,value:[0,0,.5]}]},{target:'body',channel:'rotation',keyframes:[{time:0,value:[0,0,0]},{time:1,value:[0,.1,0]}]}]});
test('body rig and poses own their snapshots and survive runtime recreation',()=>{
 const {bot,internal}=setup(); const input=rig(); bot.setBodyRig(input); input.skeleton.bones[0]!.id='changed';
 assert.equal(bot.bodyRig!.skeleton.bones[0]!.id,'root');
 bot.setBonePose({tip:{rotation:[0,0,.2]}}); const pose=bot.getBonePose(); pose.tip!.rotation![2]=9;
 assert.equal(bot.getBonePose().tip!.rotation![2],.2);
 const state=internal.runtimeState(); assert.equal(state.rig.skeleton.bones[0].id,'root');assert.equal(state.bonePose.tip.rotation[2],.2);
 state.bonePose.tip.rotation[2]=8; assert.equal(bot.getBonePose().tip!.rotation![2],.2);
 bot.disconnectedCallback();assert.equal(bot.getBonePose().tip!.rotation![2],.2);
});
test('manual bone pose takes only bone track ownership and new clips restore it',()=>{
 const {bot}=setup();bot.setBodyRig(rig());bot.setPartAnimation(boneClip());bot.setBonePose({tip:{position:[.1,0,0]}});
 assert.equal(bot.partAnimation!.clip.tracks.length,1);assert.equal(bot.partAnimation!.clip.tracks[0]!.target,'body');
 bot.setPartAnimation(boneClip());assert.equal(bot.partAnimation!.clip.tracks.length,2);
 bot.clearBonePose();assert.equal(Object.keys(bot.getBonePose()).length,0);assert.equal(bot.partAnimation!.clip.tracks.length,1);
 bot.setPartAnimation(boneClip());bot.setBodyRig(null);assert.equal(bot.bodyRig,undefined);assert.equal(bot.partAnimation!.clip.tracks.length,1);assert.throws(()=>bot.getBonePose());
});
test('invalid pose and bone target reject atomically without removing active clip',()=>{
 const {bot}=setup();bot.setBodyRig(rig());bot.setPartAnimation(boneClip());const previous=bot.partAnimation;
 assert.throws(()=>bot.setBonePose({absent:{rotation:[0,0,0]}}));assert.deepEqual(bot.partAnimation,previous);
 assert.throws(()=>bot.setBonePose({tip:{rotation:[NaN,0,0]}}));assert.throws(()=>bot.setPartAnimation({duration:1,tracks:[{target:{bone:'absent'},channel:'position',keyframes:[{time:0,value:[0,0,0]}]}]}));assert.deepEqual(bot.partAnimation,previous);
 let calls=0;assert.throws(()=>bot.getBonePose({get accessory(){calls++;return 'x';}}));assert.equal(calls,0);
});
test('plugin skin loading, direct poses, clips and replacement clean up coherently',async()=>{
 const {bot,internal}=setup();internal.bridge=undefined;
 const {AccessoryPluginRegistry}=await import('../src/core/accessory-plugins.ts'); const registry=new AccessoryPluginRegistry();
 const geometry=()=>({vertices:new Float32Array([0,0,0,0,0,1,.1,0,0,0,0,1,0,.1,0,0,0,1]),indices:new Uint16Array([0,1,2]),skin:{skeleton:{bones:[{id:'tip'}]},joints:new Uint8Array(12),weights:new Float32Array([1,0,0,0,1,0,0,0,1,0,0,0])}});
 registry.register({apiVersion:1,id:'rig/test',slots:['head'],createMesh:geometry});
 await bot.equipPluginAccessory(registry,'rig/test',{slot:'head',id:'hat'});bot.setBonePose({tip:{rotation:[0,0,.2]}},{accessory:'hat'});
 assert.equal(bot.getBonePose({accessory:'hat'}).tip!.rotation![2],.2);
 bot.setPartAnimation({duration:1,tracks:[{target:{bone:'tip',accessory:'hat'},channel:'rotation',keyframes:[{time:0,value:[0,0,0]},{time:1,value:[0,0,.3]}]}]});
 assert.ok(internal.runtimeState().accessoryBonePoses.hat);bot.removePluginAccessory('head');assert.equal(bot.partAnimation,undefined);assert.equal(internal.runtimeState().accessoryBonePoses.hat,undefined);assert.throws(()=>bot.getBonePose({accessory:'hat'}));
});
