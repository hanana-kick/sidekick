import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { POSITION_PLACEMENTS, validatePositioning, samePositioning, resolvePositioning, positioningPoint } from '../src/element/positioning.ts';
const dom = new JSDOM('<div id="bot"></div><div id="target"></div>');
const doc=dom.window.document, bot=doc.querySelector('#bot'), target=doc.querySelector('#target');
bot.getBoundingClientRect=()=>({left:150,top:80,width:100,height:80});
target.getBoundingClientRect=()=>({left:400,top:300,width:300,height:200});
const xs={left:284,center:500,right:716}, ys={top:204,center:360,bottom:516};
const vx={left:16,center:450,right:884}, vy={top:16,center:360,bottom:704};
for(const placement of POSITION_PLACEMENTS) test(`element / viewport geometry ${placement}`,()=>{
 const [v,h]=placement==='center'?['center','center']:placement.split('-');
 const config=validatePositioning({target,placement},doc);
 assert.deepEqual(positioningPoint(config,{width:100,height:80},target.getBoundingClientRect(),false),{x:xs[h],y:ys[v]});
 assert.deepEqual(positioningPoint(config,{width:100,height:80},{left:0,top:0,width:1000,height:800},true),{x:vx[h],y:vy[v]});
 assert.deepEqual(resolvePositioning(bot,{x:30,y:10},config).position,{x:xs[h]-120,y:ys[v]-70});
});
test('default, copied offsets, equal declarations and no coordinate alias',()=>{
 const raw={target:'#target',offset:{x:3}};const config=validatePositioning(raw,doc);raw.offset.x=99;
 assert.equal(config.offset.x,3);assert.equal(config.follow,true);assert.equal(config.placement,'bottom-right');
 assert.ok(samePositioning({target}, {target,gap:16,follow:true,placement:'bottom-right',offset:{x:0,y:0}}));
 assert.ok(!samePositioning({target}, {target,follow:false}));
 assert.throws(()=>validatePositioning({target,x:12},doc));
});
test('strict validation, finite coordinates, selectors, target hierarchy',()=>{
 for(const value of [null,[],{}, {target:''},{target:'['},{target,placement:'right-center'},{target,gap:-1},{target,gap:NaN},{target,offset:{x:Infinity}},{target,follow:1},{target,offset:{z:0}}]) assert.throws(()=>validatePositioning(value,doc));
 const getter={target};Object.defineProperty(getter,'gap',{enumerable:true,get(){throw new Error('getter executed');}});assert.throws(()=>validatePositioning(getter,doc),/unsupported/);
 const missing=validatePositioning({target:'#missing'},doc);assert.throws(()=>resolvePositioning(bot,{x:0,y:0},missing),/missing/);
 assert.throws(()=>resolvePositioning(bot,{x:0,y:0},validatePositioning({target:bot},doc)),/descendant/);
 const foreign=new JSDOM('<div></div>');assert.throws(()=>validatePositioning({target:foreign.window.document.querySelector('div')},doc),/same document/);foreign.window.close();
});
