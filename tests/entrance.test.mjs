import test from 'node:test';
import assert from 'node:assert/strict';
import {validateEntrance, sameEntrance, entrancePositions, entranceClip} from '../dist/src/element/entrance.js';
test('entrance declarations normalize defaults and preserve target identity',()=>{
 assert.deepEqual(validateEntrance({source:'viewport',edge:'left'}),{source:'viewport',edge:'left',at:.5,inset:24});
 const target={nodeType:1};const value=validateEntrance({source:'element',target,direction:'top'});assert.equal(value.target,target);assert.equal(value.gap,16);assert.ok(sameEntrance(value,validateEntrance({...value})));assert.ok(!sameEntrance(value,{...value,target:{nodeType:1}}));
});
test('entrance rejects invalid keys, accessors and nonfinite or out of range declarations',()=>{
 for(const value of [null,[],{}, {source:'viewport',edge:'up'}, {source:'viewport',edge:'left',at:1.1}, {source:'viewport',edge:'left',inset:Infinity}, {source:'element',target:'',direction:'top'}, {source:'viewport',edge:'left',target:'#x'}, {source:'element',target:'#x',direction:'right',gap:-1},Object.defineProperty({source:'viewport'},'edge',{enumerable:true,get(){throw Error('getter');}})])assert.throws(()=>validateEntrance(value));
});
for(const edge of ['left','right','top','bottom']) test(`viewport ${edge} declares edge fraction and inset`,()=>{
 const at=0.25,r=entrancePositions({source:'viewport',edge,at,inset:30},100,80,900,700);
 assert.equal(r.start,undefined);assert.deepEqual(r.end,edge==='left'?{x:30,y:155}:edge==='right'?{x:770,y:155}:edge==='top'?{x:200,y:30}:{x:200,y:590});
});
for(const direction of ['left','right','top','bottom']) test(`element ${direction} begins concealed and ends beyond opaque rectangle`,()=>{
 const r=entrancePositions({source:'element',target:'#card',direction,at:.5,gap:16},100,80,900,700,{left:300,top:250,width:200,height:200});
 assert.ok(r.start.x>=300&&r.start.x+100<=500&&r.start.y>=250&&r.start.y+80<=450);
 assert.ok(direction==='left'?r.end.x+100===284:direction==='right'?r.end.x===516:direction==='top'?r.end.y+80===234:r.end.y===466);
});
test('undersized target and impossible destination fail without automatic resize',()=>{
 assert.throws(()=>entrancePositions({source:'element',target:'#card',direction:'top'},100,80,900,700,{left:300,top:250,width:99,height:200}));
 assert.throws(()=>entrancePositions({source:'element',target:'#card',direction:'left'},100,80,900,700,{left:0,top:250,width:200,height:200}));
});
test('rectangle cutout progressively reveals and removes only when disjoint',()=>{
 const target={left:200,top:200,width:200,height:200};
 assert.match(entranceClip({left:220,top:220,width:100,height:100},target),/^polygon\(evenodd/);
 assert.match(entranceClip({left:350,top:220,width:100,height:100},target),/50px 100px/);
 assert.equal(entranceClip({left:416,top:220,width:100,height:100},target),'none');
});
