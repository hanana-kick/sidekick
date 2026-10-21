import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('./run.mjs',import.meta.url),'utf8');
const start=source.indexOf('async({size,dpr,backend,mode})=>'),end=source.indexOf(',{size,dpr,backend,mode});',start);
async function compare({different=false,short=false,graphics='canvas2d'}={}){let variant;const bench={setup:async v=>{variant=v.variant;return{snapshot:{graphics}};},capture:async()=>({width:2,height:1,pixels:new Uint8Array(variant==='atomic'&&short?[1]:variant==='atomic'&&different?[1,3]:[1,2])}),visibleCapture:async()=>({width:2,height:1,pixels:new Uint8Array([1,2])}),dispose(){}};const fn=vm.runInNewContext('('+source.slice(start,end)+')',{window:{bench},setTimeout:fn=>fn()});return fn({size:2,dpr:1,backend:'main',mode:'canvas'});}
test('actual in-page comparator accepts identical typed arrays',async()=>{const r=await compare();assert.equal(r.raw.differing,0);assert.equal(r.visible.differing,0);assert.equal(r.raw.sameDimensions,true);});
test('actual in-page comparator detects single-channel and length mismatches',async()=>{assert.equal((await compare({different:true})).raw.differing,1);const r=await compare({short:true});assert.equal(r.raw.differing,1);assert.equal(r.raw.sameDimensions,false);});
test('actual in-page comparator rejects unexpected renderer',async()=>{await assert.rejects(compare({graphics:'webgl2'}),/Requested renderer/);});
