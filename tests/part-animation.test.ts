import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePartAnimation, samplePartAnimation } from '../src/core/part-animation.js';
const body = () => ({ target: 'body', channel: 'rotation', keyframes: [{ time: 0, value: [0,0,0] }, { time: 2, value: [2,4,6] }] });
const clip = () => ({ duration: 2, tracks: [body()] });
test('linear Euler tracks sample exact keys, intermediate times and held endpoints', () => {
  const c = validatePartAnimation(clip());
  assert.deepEqual(samplePartAnimation(c, 1).bodyRotation, [1,2,3]);
  assert.deepEqual(samplePartAnimation(c, -1).bodyRotation, [0,0,0]);
  assert.deepEqual(samplePartAnimation(c, 10).bodyRotation, [2,4,6]);
  assert.deepEqual(samplePartAnimation(c, 2).bodyRotation, [2,4,6]);
  const sparse = validatePartAnimation({ duration: 4, tracks: [{ ...body(), keyframes: [{ time: 1, value: [1,2,3] }, {time: 3, value: [2,3,4]}] }] });
  assert.deepEqual(samplePartAnimation(sparse, 0).bodyRotation, [1,2,3]);
  assert.deepEqual(samplePartAnimation(sparse, 4).bodyRotation, [2,3,4]);
});
test('loop wraps negative and later times deterministically', () => {
  const c = validatePartAnimation({ ...clip(), loop: true });
  assert.deepEqual(samplePartAnimation(c, -1).bodyRotation, [1,2,3]);
  assert.deepEqual(samplePartAnimation(c, 3).bodyRotation, [1,2,3]);
  assert.deepEqual(samplePartAnimation(c, 2).bodyRotation, [0,0,0]);
  assert.deepEqual(samplePartAnimation(c, 100).bodyRotation, [0,0,0]);
  assert.throws(() => samplePartAnimation(c, Infinity), /finite/);
});
test('smooth interpolation and exact interior keyframes preserve authored values', () => {
  const c = validatePartAnimation({duration:2,tracks:[{...body(),interpolation:'smooth',keyframes:[{time:0,value:[0,0,0]},{time:1,value:[1,2,3]},{time:2,value:[2,4,6]}]}]});
  assert.deepEqual(samplePartAnimation(c,.25).bodyRotation,[.15625,.3125,.46875]);
  assert.deepEqual(samplePartAnimation(c,1).bodyRotation,[1,2,3]);
});
test('face, independent eye weights and two accessory channels coexist', () => {
  const c = validatePartAnimation({duration:1,tracks:[
    {target:'face',channel:'uv',keyframes:[{time:0,value:[.1,-.2]}]},
    {target:'leftEye',channel:'weights',keyframes:[{time:0,value:[.7,.2]}]},
    {target:'rightEye',channel:'weights',keyframes:[{time:0,value:[.1,.8]}]},
    {target:{accessory:'hat'},channel:'rotation',keyframes:[{time:0,value:[1,2,3]}]},
    {target:{accessory:'hat'},channel:'opacity',keyframes:[{time:0,value:.6}]},
    {target:{accessory:'pin'},channel:'position',keyframes:[{time:0,value:[.1,.2,.3]}]},
    {target:{accessory:'pin'},channel:'scale',keyframes:[{time:0,value:[1,2,3]}]},
  ]});
  const sample = samplePartAnimation(c,.5);
  assert.deepEqual(sample.face,[.1,-.2]); assert.deepEqual(sample.eyes?.left,{smile:.7,openness:.8});
  assert.equal(sample.eyes?.right?.smile,.1); assert.ok(Math.abs(sample.eyes!.right!.openness-.2)<1e-12);
  assert.deepEqual(sample.accessories.hat,{rotation:[1,2,3],opacity:.6});
  assert.deepEqual(sample.accessories.pin,{position:[.1,.2,.3],scale:[1,2,3]});
});
test('validation and samples do not share mutable keyframe data', () => {
  const input = clip(), c = validatePartAnimation(input); input.tracks[0]!.keyframes[0]!.value[0] = 6;
  const a = samplePartAnimation(c,0); a.bodyRotation![0] = 5;
  assert.deepEqual(samplePartAnimation(c,0).bodyRotation,[0,0,0]);
});
test('rejects unsafe JSON, unsupported channels, duplicate tracks and malformed keyframes', () => {
  assert.throws(() => validatePartAnimation({...clip(),duration:0}), /duration/);
  assert.throws(() => validatePartAnimation({...clip(),loop:1}), /boolean/);
  assert.throws(() => validatePartAnimation({...clip(),tracks:[body(),body()]}), /unique/);
  assert.throws(() => validatePartAnimation({...clip(),tracks:[{...body(),channel:'position'}]}), /combination/);
  assert.throws(() => validatePartAnimation({...clip(),tracks:[{...body(),keyframes:[]}]}), /keyframes/);
  assert.throws(() => validatePartAnimation({...clip(),tracks:[{...body(),keyframes:[{time:1,value:[0,0,0]},{time:1,value:[1,1,1]}]}]}), /increasing/);
  assert.throws(() => validatePartAnimation({...clip(),tracks:[{...body(),keyframes:[{time:3,value:[0,0,0]}]}]}), /time/);
  assert.throws(() => validatePartAnimation({...clip(),tracks:[{...body(),keyframes:[{time:0,value:[0,NaN,0]}]}]}), /finite/);
  assert.throws(() => validatePartAnimation({...clip(),tracks:[{target:{accessory:'constructor'},channel:'opacity',keyframes:[{time:0,value:1}]}]}), /id/);
  let getterCalled = false;
  const malicious = Object.defineProperty({},'duration',{enumerable:true,get(){getterCalled=true;return 2;}});
  assert.throws(() => validatePartAnimation(malicious), /accessor/); assert.equal(getterCalled,false);
  const sparse = new Array(1); assert.throws(() => validatePartAnimation({duration:2,tracks:sparse}), /array/);
  assert.throws(() => validatePartAnimation({...clip(),tracks:Array.from({length:129},body)}), /bounded/);
});
test('enforces total keyframe limit and per-channel bounds', () => {
  const many = Array.from({length:4096},(_,i)=>({time:i/4096,value:[0,0,0]}));
  assert.throws(() => validatePartAnimation({duration:2,tracks:[{...body(),keyframes:many},{target:'face',channel:'uv',keyframes:[{time:0,value:[0,0]}]}]}), /4096/);
  for (const [channel,value] of [['opacity',2],['scale',[0,1,1]],['position',[17,0,0]]] as const) assert.throws(() => validatePartAnimation({duration:1,tracks:[{target:{accessory:'hat'},channel,keyframes:[{time:0,value}]}]}), /within/);
});

test('looping exact fractional keys are not perturbed by modulo normalization', () => {
  const c = validatePartAnimation({ duration: 2, loop: true, tracks: [{ target: 'face', channel: 'uv', keyframes: [{time:0,value:[0,0]},{time:.1,value:[.3,.4]},{time:1,value:[.1,.2]}] }] });
  assert.deepEqual(samplePartAnimation(c,.1).face,[.3,.4]);
});

test('empty looping clips are rejected instead of scheduling invisible work',()=>{assert.throws(()=>validatePartAnimation({duration:1,loop:true,tracks:[]}));});
test('prototype-named safe instance IDs use owned motion channels rather than inherited values',async()=>{
 const {MotionTimeline}=await import('../src/core/motion.js');
 for(const id of ['toString','valueOf','hasOwnProperty','isPrototypeOf']){
  const timeline=new MotionTimeline(),pending=timeline.to({accessories:{[id]:{rotation:[0,1,0]}}},{duration:100});timeline.advance(100);assert.deepEqual(await pending,{finished:true});assert.deepEqual(timeline.pose.accessories[id],[0,1,0]);timeline.removeAccessories([id]);assert.equal(Object.hasOwn(timeline.pose.accessories,id),false);
 }
});
