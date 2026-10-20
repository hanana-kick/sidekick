import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { BehaviorController, validateBehavior } from '../src/element/behavior.ts';

// Finite enums are exhaustive. Continuous numeric options use omitted, zero,
// fractional, and maximum representatives; this is not a browser geometry test.
const sides = [undefined, 'left', 'right', 'above', 'below'];
const gaps = [undefined, 0, .5, 10000];
const times = [undefined, 0, .5, 86400000];
const targetTypes = ['wait', 'follow', 'guide'];
const localTypes = ['idle', 'celebrate', 'error'];
const optional = entries => Object.fromEntries(entries.filter(([, value]) => value !== undefined));
const fixture = () => new JSDOM('<div id="reference-target"></div><ol><li class="reference-item"></li><li class="reference-item"></li><li class="reference-item"></li></ol>');

function harness(document) {
 const moves = [], states = [], preparations = [], ends = [];
 let restores = 0, stops = 0, watchers = 0;
 const controller = new BehaviorController({ document, connected: () => true,
  capture: () => () => restores++, prepare: (activity, expression) => preparations.push({activity, expression}),
  move: async (target, side, gap) => { moves.push({target, side, gap}); return {finished:true, position:{x:0,y:0}}; },
  watch: () => { watchers++; return () => watchers--; }, stop: () => stops++,
  change: state => states.push(state), end: result => ends.push(result),
 });
 return {controller, moves, states, preparations, ends, counts: () => ({restores, stops, watchers})};
}

test('behavior preview validation matrix: every type/side/target representation and numeric boundary combination', () => {
 const dom = fixture(), document = dom.window.document;
 try {
  const target = document.querySelector('#reference-target'), items = [...document.querySelectorAll('.reference-item')];
  let count = 0;
  for (const type of targetTypes) for (const source of ['#reference-target', target]) for (const side of sides) for (const gap of gaps) for (const timeout of times) for (const duration of times) {
   const input = {type, target:source, ...optional([['side',side],['gap',gap],['timeout',timeout],['duration',duration]])};
   const validated = validateBehavior(input, document);
   assert.deepEqual(validated,input); assert.ok(Object.isFrozen(validated)); count++;
  }
  for (const source of ['.reference-item', items]) for (const side of sides) for (const gap of gaps) for (const timeout of times) for (const dwell of times) {
   const input = {type:'review',targets:source,...optional([['side',side],['gap',gap],['timeout',timeout],['dwell',dwell]])};
   const validated = validateBehavior(input,document);
   assert.deepEqual(validated,input); assert.ok(Object.isFrozen(validated));
   if(Array.isArray(source)){assert.notEqual(validated.targets,source);assert.ok(Object.isFrozen(validated.targets));} count++;
  }
  for(const type of localTypes) for(const duration of times){const input={type,...optional([['duration',duration]])};assert.deepEqual(validateBehavior(input,document),input);count++;}
  assert.equal(count,2572);
 } finally {dom.window.close();}
});

test('behavior preview controller matrix: target order, all sides, gaps and Element/selector parity', async () => {
 const dom=fixture(), document=dom.window.document;
 try {
  const target=document.querySelector('#reference-target'), items=[...document.querySelectorAll('.reference-item')];
  let count=0;
  for(const type of [...targetTypes,'review']) for(const elements of [false,true]) for(const side of sides) for(const gap of gaps){
   const h=harness(document), expected=type==='review'?items:[target];
   const input={type,...(type==='review'?{targets:elements?items:'.reference-item',dwell:0}:{target:elements?target:'#reference-target',duration:0}),...optional([['side',side],['gap',gap]])};
   const result=await h.controller.perform(input);
   assert.equal(result.status,'completed');assert.equal(result.completedItems,expected.length);
   assert.deepEqual(h.moves,expected.map(target=>({target,side:side??'right',gap:gap??16})));
   assert.deepEqual(h.states.filter(state=>state.status==='moving').map(state=>state.itemIndex),expected.map((_,index)=>index));
   assert.deepEqual(h.counts(),{restores:1,stops:1,watchers:0});assert.equal(h.ends.length,1);count++;
  }
  for(const type of localTypes){const h=harness(document);assert.equal((await h.controller.perform({type,duration:0})).status,'completed');assert.deepEqual(h.moves,[]);count++;}
  assert.equal(count,163);
 } finally {dom.window.close();}
});

test('behavior matrix rejects invalid enums, cross-type fields, numeric boundaries and target shapes', () => {
 const dom=fixture(), foreign=fixture(), document=dom.window.document;
 try {
  const target=document.querySelector('#reference-target');
  for(const type of [...targetTypes,'review',...localTypes]){
   const base={type,...(type==='review'?{targets:'.reference-item'}:targetTypes.includes(type)?{target:'#reference-target'}:{})};
   const allowed=type==='review'?['gap','timeout','dwell']:targetTypes.includes(type)?['gap','timeout','duration']:['duration'];
   for(const key of allowed)for(const value of [-1,NaN,Infinity,-Infinity,'0',null,undefined,(key==='gap'?10000:86400000)+1])assert.throws(()=>validateBehavior({...base,[key]:value},document),`${type}.${key}=${String(value)}`);
   for(const key of ['target','targets','side','gap','timeout','duration','dwell']){
    const validKeys=['type',...allowed,...(type==='review'?['targets','side']:targetTypes.includes(type)?['target','side']:[])];
    if(!validKeys.includes(key))assert.throws(()=>validateBehavior({...base,[key]:0},document),`${type} rejects ${key}`);
   }
   if(!localTypes.includes(type))for(const side of ['top','bottom','LEFT','',null,undefined])assert.throws(()=>validateBehavior({...base,side},document));
  }
  for(const type of targetTypes)for(const target of ['', ' ', '[', null, undefined, [], {}, foreign.window.document.body])assert.throws(()=>validateBehavior({type,target},document));
  for(const targets of ['', '[', null, undefined, {}, [target,'#reference-target'], [foreign.window.document.body], new Array(1), Array(10001).fill(target)])assert.throws(()=>validateBehavior({type:'review',targets},document));
  assert.equal(validateBehavior({type:'review',targets:Array(10000).fill(target)},document).targets.length,10000);
  assert.deepEqual(validateBehavior({type:'review',targets:[]},document).targets,[]);
  for(const type of ['', 'WAIT','attention',null,undefined])assert.throws(()=>validateBehavior({type},document));
 }finally{dom.window.close();foreign.window.close();}
});

test('behavior target-resolution matrix distinguishes missing selectors, detached Elements and empty review arrays', async () => {
 const dom=fixture(), document=dom.window.document;
 try{
  for(const type of [...targetTypes,'review']){
   for(const source of ['#missing',document.createElement('div')]){
    const h=harness(document), declaration={type,timeout:0,...(type==='review'?{targets:typeof source==='string'?source:[source],dwell:0}:{target:source,duration:0})};
    const result=await h.controller.perform(declaration);
    assert.equal(result.status,type==='review'&&typeof source!=='string'?'completed':'error');assert.equal(result.completedItems,0);assert.deepEqual(h.moves,[]);
   }
  }
  const h=harness(document);assert.equal((await h.controller.perform({type:'review',targets:[]})).status,'completed');assert.deepEqual(h.moves,[]);
 }finally{dom.window.close();}
});

test('omitted indefinite durations can be cancelled without leaked target watches', async () => {
 const dom=fixture(), document=dom.window.document;
 try{
  for(const type of [...targetTypes,'idle']){
   const h=harness(document), result=h.controller.perform({type,...(type==='idle'?{}:{target:'#reference-target'})});
   // Resolve-target and move promises take two microtasks before acting.
   await Promise.resolve();await Promise.resolve();await Promise.resolve();
   assert.equal(h.controller.state.status,'acting');h.controller.cancel();
   assert.equal((await result).status,'cancelled');assert.deepEqual(h.counts(),{restores:1,stops:1,watchers:0});
  }
 }finally{dom.window.close();}
});
