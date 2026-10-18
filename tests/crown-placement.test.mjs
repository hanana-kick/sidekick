import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { MATERIAL_SHAPE_NAMES } from '../dist/src/core/shapes.js';
import { CROWN_SUPPORTS } from '../dist/src/core/crown-profiles.js';
import { resolveShapeProfile } from '../dist/src/core/shape-profiles.js';
import { shapeContour } from '../dist/src/core/contours.js';
import { sampleAccessorySurface } from '../dist/src/core/surface.js';
import { activityFrame } from '../dist/src/core/motion.js';
import { ShapeTimeline } from '../dist/src/core/shape-motion.js';
import { beretGeometry } from '../dist/src/renderer/beret-geometry.js';
import { bodyGeometry } from '../dist/src/renderer/body-geometry.js';
import { createResolvedFixture, createResolvedAccessory } from './internal-fixtures.mjs';
import { triangles, intersections } from './helpers/geometry/intersections.mjs';
const crown = createResolvedAccessory('crown');
const point = (mesh, index) => Array.from(mesh.vertices.subarray(index * 6, index * 6 + 3));
const distance = (a,b) => Math.hypot(...a.map((v,k)=>v-b[k]));
const baseline = beretGeometry(createResolvedFixture({body:{shape:'circle'}}).body,crown);
const baseScale = resolveShapeProfile('circle').accessories.crown.scale;
function rigid(mesh,scale,label){
  assert.deepEqual(mesh.indices, baseline.indices, label+' topology');
  for(let i=0;i<mesh.vertices.length/6;i++){
    assert.ok(point(mesh,i).every(Number.isFinite),label+' finite');
    // Four noncoplanar reference vertices constrain the full shape, not only its bounding box.
    for(const anchor of [0,20,80,260]) assert.ok(Math.abs(distance(point(mesh,i),point(mesh,anchor))/scale-distance(point(baseline,i),point(baseline,anchor))/baseScale)<1e-6,label+' rigid distances '+i);
    assert.ok(Math.abs(Math.hypot(...mesh.vertices.slice(i*6+3,i*6+6))-1)<1e-5,label+' unit normal');
  }
}
test('each catalog shape has an independently authored immutable crown support',()=>{
  assert.deepEqual(Object.keys(CROWN_SUPPORTS),MATERIAL_SHAPE_NAMES);
  for(const [shape,support] of Object.entries(CROWN_SUPPORTS)){
    assert.ok(Object.isFrozen(support)); assert.ok(support.length === 4 || support.length === 5);
    assert.ok(support.every(Number.isFinite)); assert.ok(support[3]>=.95&&support[3]<=1.50,shape+' restrained uniform size');
  }
});
test('all 35 crown fits preserve every vertex distance through squash and accessory rotation',()=>{
  for(const shape of MATERIAL_SHAPE_NAMES){
    const body=createResolvedFixture({body:{shape}}).body,profile=resolveShapeProfile(shape);
    for(const squash of [.86,1,1.14])for(const rotation of [[0,0,0],[.1,-.1,.05]])rigid(beretGeometry(body,crown,squash,undefined,profile,rotation),profile.accessories.crown.scale,shape+'/'+squash);
  }
});
test('rigid crown metal does not cross body triangles in 105 catalog squash states',()=>{
  for(const shape of MATERIAL_SHAPE_NAMES){
    const body=createResolvedFixture({body:{shape}}).body,profile=resolveShapeProfile(shape),contour=shapeContour({kind:'material',name:shape});
    for(const squash of [.86,1,1.14]){
    const stretch=1/Math.sqrt(squash),mesh=beretGeometry(body,crown,squash,contour,profile);
    const overlap=intersections(triangles(mesh),triangles(bodyGeometry(contour),[.59*stretch,.59*squash,profile.depth*.5*stretch]));
    assert.equal(overlap.count,0,shape+'/'+squash+': '+JSON.stringify(overlap.samples));
    }
  }
});
test('interrupted body morphs interpolate rigid crown placement, never the metal mesh',()=>{
  for(const [from,to,next] of [['heart','flower','pixelTriangle'],['pentagon','puffy','softBurst'],['circle','square','diamond']]){
    const timeline=new ShapeTimeline(from),body=createResolvedFixture({body:{shape:to}}).body;
    timeline.to(to,{duration:1000,easing:'linear'});
    for(let frame=0;frame<=60;frame++){
      if(frame===30)timeline.to(next,{duration:1000,easing:'linear'});
      timeline.advance(1000/60);
      const mesh=beretGeometry(body,crown,1,timeline.contour,timeline.profile);
      rigid(mesh,timeline.profile.accessories.crown.scale,from+'/'+to+'/'+frame);
    }
  }
});

test('crown support anchors use actual canonical coordinates rather than perimeter phase',()=>{
 for(const shape of MATERIAL_SHAPE_NAMES){
 const body=createResolvedFixture({body:{shape}}).body,profile=resolveShapeProfile(shape);
 const frame=sampleAccessorySurface(body,crown,1,undefined,profile);
 assert.ok(Math.abs(frame.position[0]-CROWN_SUPPORTS[shape][0]*.59)<1e-6,shape+' exact support X');
 assert.ok(Math.abs(frame.position[1]-CROWN_SUPPORTS[shape][1]*.59)<1e-6,shape+' exact support Y');
 }
});

test('sampled activity squash retains crown rigidity through 2730 catalog states',()=>{
 for(const shape of MATERIAL_SHAPE_NAMES){
 const body=createResolvedFixture({body:{shape}}).body,profile=resolveShapeProfile(shape);
 for(const activity of ['idle','thinking','listening','speaking','celebrating','still'])for(let sample=0;sample<=12;sample++){
 const state=activityFrame(activity,sample*.5,false);
 rigid(beretGeometry(body,crown,state.squash),profile.accessories.crown.scale,shape+'/'+activity+'/'+sample);
 }
 }
});

test('crown cavity shading preserves original vertices and every oriented triangle',()=>{
  const expected=JSON.parse(fs.readFileSync(new URL('./fixtures/crown-shell-v0.6.0.json',import.meta.url),'utf8'));
  const hash=value=>createHash('sha256').update(value).digest('hex');
  assert.equal(hash(Buffer.from(baseline.vertices.buffer)),expected.vertices);
  const triangles=[];for(let i=0;i<baseline.indices.length;i+=3){const a=Array.from(baseline.indices.slice(i,i+3));while(a[0]!==Math.min(...a))a.push(a.shift());triangles.push(a.join(','));}
  assert.equal(hash(triangles.sort().join(';')),expected.orientedTriangles);
  assert.equal(baseline.bandIndexCount,80*6*4,'band and inner wall share the existing darker material batch');
  assert.equal(baseline.crownIndexCount,80*6*2,'outer wall and lip retain the main color');
});
