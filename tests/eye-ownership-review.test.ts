import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDesign } from '../src/core/design.js';
import { initialPose } from '../src/core/motion.js';
import { EmotionController } from '../src/element/emotion.js';
import { RenderEngine } from '../src/runtime/render-engine.js';
import type { FrameScheduler, RuntimeRenderer } from '../src/runtime/render-engine.js';
import type { RenderState } from '../src/renderer/webgl.js';
import type { RuntimeState } from '../src/runtime/protocol.js';

function fixture() {
  const frames: RenderState[] = [], pending = new Map<number, (now: number) => void>();
  let id = 0, now = 10;
  const canvas = Object.assign(new EventTarget(), { width: 100, height: 100 }) as HTMLCanvasElement;
  const scheduler: FrameScheduler = { request: cb => { pending.set(++id, cb); return id; }, cancel: key => { pending.delete(key); } };
  const renderer: RuntimeRenderer = { canvas, stats: { drawCalls: 0, buffers: 0 }, resize() {}, render(_design, state) { frames.push(structuredClone(state)); }, readPixels: () => new Uint8Array(40000), dispose() {} };
  const state: RuntimeState = { design: createDesign(), pose: initialPose(), bodyOrientation: { yaw: 0, pitch: 0, roll: 0 }, zoom: 1, activity: 'still', paused: false, reduced: false, active: true, time: 0, gaze: [0, 0], trackingMode: 'off', width: 100, height: 100, dpr: 1 };
  const engine = new RenderEngine(canvas, state, () => {}, scheduler, renderer);
  return { engine, frames, pending, last: () => frames.at(-1)!, step(ms = 16) { now += ms; const jobs = [...pending.values()]; pending.clear(); jobs.forEach(cb => cb(now)); } };
}
const near = (a: number, b: number, epsilon = 1e-8) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);

test('explicit eye ownership releases emotional eyes without resetting body emotion', () => {
  const f = fixture();
  f.engine.command({kind:'state',state:{emotion:{emotion:'happy',intensity:1},paused:true}});
  f.engine.capture(); near(f.last().pose.eyes.left.smile,.85);
  f.engine.command({kind:'motion',target:{eyes:{left:{weights:{smile:0,blink:1}}}},options:{duration:0},request:1});
  f.engine.capture();
  // Reproduction: successful authored commands alone were completely hidden.
  near(f.engine.snapshot.pose.eyes.left.openness,0); near(f.last().pose.eyes.left.openness,1);
  f.engine.command({kind:'eye-control',overrides:{left:true,right:false},sides:['left','right'],options:{duration:0}});
  f.engine.capture(); near(f.last().pose.eyes.left.openness,0); near(f.last().pose.eyes.left.smile,0);
  near(f.last().pose.eyes.right.smile,.85); near(f.last().activityFrame!.roll,.035);
  f.engine.command({kind:'eye-control',overrides:{left:false,right:false},sides:['left','right'],options:{duration:0}});
  f.engine.capture(); near(f.last().pose.eyes.left.smile,.85); near(f.last().pose.eyes.left.openness,1);
  f.engine.dispose();
});

test('eye ownership blend starts from displayed emotion and converges without a render loop', () => {
  const f=fixture();
  f.engine.command({kind:'state',state:{emotion:{emotion:'concerned',intensity:1}}});
  for(let i=0;i<160;i++)f.step();
  const before=structuredClone(f.last());
  f.engine.command({kind:'eye-control',overrides:{left:true,right:false},sides:['left'],options:{duration:400}});
  f.engine.command({kind:'motion',target:{eyes:{left:{weights:{smile:1,blink:0}}}},options:{duration:400},request:2});
  f.engine.capture(); near(f.last().pose.eyes.left.openness,before.pose.eyes.left.openness);
  f.step(); f.step(16); assert.ok(f.last().pose.eyes.left.openness<1);
  for(let i=0;i<200;i++)f.step();
  near(f.last().pose.eyes.left.smile,1); near(f.last().pose.eyes.left.openness,1);
  near(f.last().pose.eyes.right.openness,.78); assert.equal(f.pending.size,0);
  // Reaction completion / unrelated sync never silently restores emotional eye ownership.
  f.engine.command({kind:'state',state:{emotion:{emotion:'sad',intensity:1}}});
  for(let i=0;i<200;i++)f.step();
  near(f.last().pose.eyes.left.smile,1); near(f.last().pose.eyes.right.openness,.62);
  f.engine.dispose();
});

test('short expression completion includes its eye-ownership transition', () => {
 const f=fixture();f.engine.command({kind:'state',state:{emotion:{emotion:'happy',intensity:1}}});for(let i=0;i<160;i++)f.step();
 f.engine.command({kind:'eye-control',overrides:{left:true,right:false},sides:['left'],options:{duration:90}});
 f.engine.command({kind:'motion',target:{eyes:{left:{weights:{smile:0,blink:1}}}},options:{duration:90},request:3});
 f.step(30);f.step(30);f.step(30);near(f.last().pose.eyes.left.openness,0);near(f.last().pose.eyes.left.smile,0);f.engine.dispose();
});

test('cancelling authored motion cannot freeze a newer emotion reclaim midway', () => {
 const f=fixture();f.engine.command({kind:'eye-control',overrides:{left:true,right:true},sides:['left','right'],options:{duration:0}});
 f.engine.command({kind:'motion',target:{eyes:{left:{weights:{blink:1}},right:{weights:{blink:1}}}},options:{duration:0},request:4});
 f.engine.command({kind:'eye-control',overrides:{left:false,right:false},sides:['left','right'],options:{duration:400}});
 f.engine.command({kind:'state',state:{emotion:{emotion:'concerned',intensity:1}}});f.step();f.step(100);
 f.engine.command({kind:'cancel'});for(let i=0;i<160;i++)f.step();
 near(f.last().pose.eyes.left.openness,.78);near(f.last().pose.eyes.right.openness,.78);f.engine.dispose();
});
