import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { resolveElementTarget } from '../dist/src/element/element-target.js';
import { actionSource, executeAction } from '../playground/playground-actions.js';
function fixture() {
  const dom = new JSDOM('<div id="parent"><div id="bot"></div></div><div id="target"></div>');
  const bot = dom.window.document.querySelector('#bot'), target = dom.window.document.querySelector('#target');
  bot.getBoundingClientRect = () => ({ left: 150, top: 80, width: 100, height: 80 });
  target.getBoundingClientRect = () => ({ left: 400, top: 300, width: 300, height: 200 });
  return { dom, bot, target };
}
for (const [alignX, ax] of [['left',0],['center',.5],['right',1]]) for(const [alignY, ay] of [['top',0],['center',.5],['bottom',1]]) test(`matching anchors ${alignX}/${alignY} preserve inline layout origin`, () => {
  const {dom,bot,target} = fixture();
  assert.deepEqual(resolveElementTarget(bot,{x:30,y:10},target,{alignX,alignY,x:7,y:-9,maxSpeed:600}), {position:{x:287+200*ax,y:221+120*ay},options:{maxSpeed:600}});
  dom.window.close();
});
test('defaults, zero-size targets, transforms on target and immutable options', () => {
 const {dom,bot,target} = fixture(); target.style.transform='rotate(45deg)';
 const options=Object.freeze({x:2});assert.deepEqual(resolveElementTarget(bot,{x:0,y:0},target,options).position,{x:252,y:220});
 target.getBoundingClientRect=()=>({left:50,top:60,width:0,height:0});
 assert.deepEqual(resolveElementTarget(bot,{x:0,y:0},target,{alignX:'center',alignY:'bottom'}).position,{x:-150,y:-100}); dom.window.close();
});
test('invalid geometry/options/targets reject before performing any command', () => {
 const {dom,bot,target}=fixture();
 for(const options of [null,{x:NaN},{y:Infinity},{alignX:'start'},{alignY:'left'},{duration:-1}]) assert.throws(()=>resolveElementTarget(bot,{x:0,y:0},target,options));
 for(const invalid of [null,{},dom.window.document.createElement('div')]) assert.throws(()=>resolveElementTarget(bot,{x:0,y:0},invalid));
 const foreign=new JSDOM('<div></div>');assert.throws(()=>resolveElementTarget(bot,{x:0,y:0},foreign.window.document.querySelector('div')));foreign.window.close();
 bot.parentElement.style.transform='scale(2)';assert.throws(()=>resolveElementTarget(bot,{x:0,y:0},target),/ancestors/);dom.window.close();
});
test('Playground source and executable action use the actual Element', () => {
 const {dom,bot,target}=fixture();const action={method:'moveToElement',args:['#target',{alignX:'center',alignY:'bottom',x:10,y:-20}]};
 let received;bot.moveToElement=(...args)=>{received=args;};executeAction(bot,action);
 assert.equal(received[0],target);assert.deepEqual(received[1],action.args[1]);
 assert.match(actionSource(action),/^await avatar.moveToElement\(document.querySelector\('#target'\)/);
 assert.throws(()=>executeAction(bot,{method:'moveToElement',args:['#missing',{}]}),/찾을/);dom.window.close();
});

test('anchor is validated separately from movement options', () => {
 const {dom,bot,target}=fixture();
 assert.deepEqual(resolveElementTarget(bot,{x:0,y:0},target,{anchor:true,x:1}).options,{});
 for(const anchor of ['true',null,1]) assert.throws(()=>resolveElementTarget(bot,{x:0,y:0},target,{anchor}),/boolean/);
 assert.throws(()=>resolveElementTarget(bot,{x:0,y:0},bot,{anchor:true}),/descendant/);
 const child=dom.window.document.createElement('span');bot.append(child);
 assert.throws(()=>resolveElementTarget(bot,{x:0,y:0},child,{anchor:true}),/descendant/);
 dom.window.close();
});

test('shared anchor scheduler reads before writes, suspends hidden, removes final loop', async () => {
 const {observeElementAnchor}=await import('../dist/src/element/element-anchor.js');
 const callbacks=new Map(),listeners=new Map(),order=[];let id=0;
 const document={hidden:false,defaultView:{requestAnimationFrame:callback=>{callbacks.set(++id,callback);return id;},cancelAnimationFrame:id=>callbacks.delete(id)},addEventListener:(name,callback)=>listeners.set(name,callback),removeEventListener:name=>listeners.delete(name)};
 const a=observeElementAnchor(document,()=>{order.push('read-a');return()=>order.push('write-a');});
 const b=observeElementAnchor(document,()=>{order.push('read-b');return()=>order.push('write-b');});
 assert.equal(callbacks.size,1);const [key,tick]=[...callbacks][0];callbacks.delete(key);tick();
 assert.deepEqual(order,['read-a','read-b','write-a','write-b']);assert.equal(callbacks.size,1);
 document.hidden=true;listeners.get('visibilitychange')();assert.equal(callbacks.size,0);
 document.hidden=false;listeners.get('visibilitychange')();assert.equal(callbacks.size,1);
 a();assert.equal(callbacks.size,1);b();assert.equal(callbacks.size,0);assert.equal(listeners.size,0);
});
