import test from 'node:test';
import assert from 'node:assert/strict';
import { EmotionController } from '../dist/src/element/emotion.js';
import { EMOTIONS, resolveEmotionFrame, validateEmotionOptions, emotionHasMotion } from '../dist/src/core/emotion.js';
import { resolveSidekickAttributes } from '../dist/src/element/attributes.js';
function setup() {
  let connected = true, id = 0;
  const timers = new Map(), changes = [], ends = [];
  const controller = new EmotionController({ connected: () => connected, change: state => changes.push(state), end: result => ends.push(result), schedule: callback => { timers.set(++id, callback); return id; }, clear: key => timers.delete(key) });
  return { controller, changes, ends, timers, disconnect: () => { connected = false; controller.cancel('disconnected'); }, tick: () => { const jobs = [...timers.values()]; timers.clear(); for (const job of jobs) job(); } };
}
test('all authored emotions have finite, distinct cues; neutral preserves authored presentation', () => {
  const frames = EMOTIONS.map(emotion => resolveEmotionFrame({ emotion, intensity: 1 }, .3));
  assert.equal(new Set(frames.map(JSON.stringify)).size, EMOTIONS.length);
  assert.equal(frames[0].eyeWeight, 0);
  for (const frame of frames) for (const number of Object.values(frame).flat()) assert.ok(Number.isFinite(number));
  assert.equal(emotionHasMotion({ emotion:'excited', intensity:0 }), false);
  assert.deepEqual(resolveEmotionFrame({ emotion:'excited', intensity:1 }, 1, true), resolveEmotionFrame({ emotion:'excited', intensity:1 }, 3, true));
});
test('reaction restores persistent feeling without changing baseline', async () => {
  const {controller:c,tick}=setup(); c.set('curious',{intensity:.4});
  const promise=c.react('happy',{intensity:.8,duration:900});
  assert.deepEqual(c.state,{emotion:'happy',intensity:.8,baseline:{emotion:'curious',intensity:.4},reacting:true});
  tick(); assert.deepEqual(await promise,{finished:true,emotion:'happy',reason:'completed'});
  assert.equal(c.state.emotion,'curious'); assert.equal(c.state.intensity,.4);
});
test('new persistent emotion supersedes reaction, stale timers never restore old state', async () => {
  const {controller:c,tick,timers}=setup(); const p=c.react('sad'); c.set('excited');
  assert.equal((await p).reason,'replaced');assert.equal(timers.size,0);tick();assert.equal(c.state.emotion,'excited');
});
test('rapid reactions settle every promise and restore only persistent baseline', async () => {
  const {controller:c,tick}=setup(); c.set('concerned'); const a=c.react('happy'),b=c.react('surprised');
  assert.equal((await a).finished,false); tick(); assert.equal((await b).finished,true);assert.equal(c.state.emotion,'concerned');
});
test('cancel and detach release timers; disconnected reaction does not mutate', async () => {
  const {controller:c,disconnect,timers}=setup();c.set('curious');const a=c.react('happy');c.cancel();assert.equal((await a).reason,'cancelled');
  const b=c.react('sad');disconnect();assert.equal((await b).reason,'disconnected');assert.equal(timers.size,0);
  assert.equal((await c.react('excited')).reason,'disconnected');assert.equal(c.state.emotion,'curious');
});
test('validation is strict and atomic before replacing an active reaction', async () => {
  const {controller:c,tick}=setup();const p=c.react('happy');
  for (const value of [null, NaN, Infinity, -.1, 1.1,'1']) assert.throws(()=>c.set('sad',{intensity:value}));
  assert.throws(()=>c.react('unknown'));assert.throws(()=>c.react('sad',{duration:-1}));assert.throws(()=>validateEmotionOptions({duration:100}));
  assert.throws(()=>c.react('sad',{get intensity(){throw new Error('getter invoked');}}),/unsupported/);
  assert.equal(c.state.emotion,'happy');tick();assert.equal((await p).finished,true);
});
test('state snapshots are isolated and reentrant change can replace reaction safely', async () => {
  let c,replace=false;
  const timers=new Map();
  c=new EmotionController({connected:()=>true,change:()=>{if(replace){replace=false;c.set('curious');}},end:()=>{},schedule:cb=>{timers.set(1,cb);return 1;},clear:id=>timers.delete(id)});
  const state=c.state;state.baseline.emotion='sad';assert.equal(c.state.emotion,'neutral');
  replace=true;assert.equal((await c.react('happy')).reason,'replaced');assert.equal(timers.size,0);assert.equal(c.state.emotion,'curious');
});
test('HTML emotion fields validate atomically and default neutral independently of behavior', () => {
  assert.deepEqual(resolveSidekickAttributes(new Map()).emotion,{emotion:'neutral',intensity:1});
  assert.deepEqual(resolveSidekickAttributes(new Map([['emotion','happy'],['emotion-intensity','.7']])).emotion,{emotion:'happy',intensity:.7});
  assert.throws(()=>resolveSidekickAttributes(new Map([['emotion','happy'],['emotion-intensity','2']])));
});
