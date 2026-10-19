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

test('actual drawn emotion reversal preserves position and signed velocity while body motion continues', () => {
  const f = fixture();
  f.engine.command({ kind: 'motion', target: { body: { rotation: [0, 1, 0] } }, options: { duration: 1000, easing: 'linear' } });
  f.engine.command({ kind: 'state', state: { emotion: { emotion: 'excited', intensity: 1 } } });
  f.step(); f.step(40); f.step(.001);
  const before = f.frames.at(-2)!, start = structuredClone(f.last());
  const velocity = (start.pose.eyes.left.smile - before.pose.eyes.left.smile) / .001;
  f.engine.command({ kind: 'state', state: { emotion: { emotion: 'neutral', intensity: 1 } } });
  f.engine.capture();
  near(f.last().pose.eyes.left.smile, start.pose.eyes.left.smile);
  f.step(.001);
  const afterVelocity = (f.last().pose.eyes.left.smile - start.pose.eyes.left.smile) / .001;
  assert.ok(velocity > 0 && afterVelocity > 0);
  near(velocity, afterVelocity, .00001);
  near(f.last().pose.rotation[1], .040002);
  for (let i = 0; i < 100; i++) f.step(16);
  near(f.last().pose.rotation[1], 1); near(f.last().pose.eyes.left.smile, 0);
  f.engine.dispose();
});

test('full design expression replacement starts from displayed eye pose and does not reset body motion', () => {
  const f = fixture();
  f.engine.command({ kind: 'motion', target: { body: { rotation: [0, 1, 0] } }, options: { duration: 1000, easing: 'linear' } });
  f.engine.command({ kind: 'design', design: createDesign({ eyes: { left: { weights: { smile: 1 } } } }) });
  f.step(); f.step(120);
  const start = structuredClone(f.last());
  assert.ok(start.pose.eyes.left.smile > 0 && start.pose.eyes.left.smile < 1);
  f.engine.command({ kind: 'design', design: createDesign() }); f.engine.capture();
  near(f.last().pose.eyes.left.smile, start.pose.eyes.left.smile);
  f.step(1); assert.ok(f.last().pose.eyes.left.smile > start.pose.eyes.left.smile);
  near(f.last().pose.rotation[1], .121);
  f.engine.dispose();
});

test('hidden emotion and orientation updates resume at displayed pose without hidden-time jump', () => {
  const f = fixture();
  f.engine.command({ kind: 'state', state: { emotion: { emotion: 'happy', intensity: 1 }, bodyOrientation: { yaw: 1, pitch: 0, roll: 0 } } });
  f.step(); f.step(32); const before = structuredClone(f.last());
  f.engine.command({ kind: 'state', state: { active: false, emotion: { emotion: 'sad', intensity: 1 } } });
  f.step(30000); assert.equal(f.pending.size, 0);
  f.engine.command({ kind: 'state', state: { active: true } }); f.step();
  assert.deepEqual(f.last().pose, before.pose); assert.deepEqual(f.last().bodyOrientation, before.bodyOrientation);
  f.step(16); assert.notDeepEqual(f.last().pose, before.pose); f.engine.dispose();
});

test('nested reaction-end replacement settles each promise once and stale timers cannot restore state', async () => {
  const timers = new Map<number, () => void>(), ends: string[] = []; let id = 0;
  let nested: Promise<unknown> | undefined;
  const c = new EmotionController({ connected: () => true, change() {}, end(result) {
    ends.push(result.emotion);
    if (result.emotion === 'happy') nested = c.react('curious');
  }, schedule(cb) { timers.set(++id, cb); return id; }, clear(key) { timers.delete(key as number); } });
  c.set('concerned'); const a = c.react('happy'); const stale = [...timers.values()][0]!;
  const b = c.react('sad');
  assert.equal((await a).reason, 'replaced'); assert.equal((await b).reason, 'replaced');
  assert.equal(c.state.emotion, 'curious'); assert.equal(timers.size, 1);
  stale(); assert.equal(c.state.emotion, 'curious');
  [...timers.values()][0]!(); await nested;
  assert.equal(c.state.emotion, 'concerned'); assert.deepEqual(ends.sort(), ['curious', 'happy', 'sad']);
});

test('rapid emotion replacements keep rendered eye weights bounded and reveal the latest authored expression', () => {
  const f = fixture();
  const emotions = ['neutral', 'happy', 'sad', 'curious', 'surprised', 'concerned', 'excited'] as const;
  f.engine.command({ kind: 'state', state: { activity: 'speaking' } });
  f.step();
  for (let i = 0; i < 600; i++) {
    if (i % 3 === 0) f.engine.command({ kind: 'state', state: { emotion: { emotion: emotions[(i / 3) % emotions.length]!, intensity: i % 2 ? 1 : .3 } } });
    f.step(8);
    for (const eye of Object.values(f.last().pose.eyes)) {
      assert.ok(eye.smile >= 0 && eye.smile <= 1, `smile ${eye.smile}`);
      assert.ok(eye.openness >= 0 && eye.openness <= 1, `openness ${eye.openness}`);
    }
  }
  f.engine.command({ kind: 'design', design: createDesign({ eyes: { left: { weights: { smile: .6, blink: .25 } }, right: { weights: { smile: .2, blink: .1 } } } }) });
  f.engine.command({ kind: 'state', state: { emotion: { emotion: 'neutral', intensity: 1 }, activity: 'still' } });
  for (let i = 0; i < 160; i++) f.step(16);
  near(f.last().pose.eyes.left.smile, .6); near(f.last().pose.eyes.left.openness, .75);
  near(f.last().pose.eyes.right.smile, .2); near(f.last().pose.eyes.right.openness, .9);
  assert.equal(f.pending.size, 0); f.engine.dispose();
});
