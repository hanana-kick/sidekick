import test from 'node:test';
import assert from 'node:assert/strict';
import { MATERIAL_SHAPE_NAMES } from '../dist/src/core/shapes.js';
import { CROWN_SUPPORTS } from '../dist/src/core/crown-profiles.js';
import { resolveShapeProfile } from '../dist/src/core/shape-profiles.js';
import { shapeContour } from '../dist/src/core/contours.js';
import { sampleAccessorySurface } from '../dist/src/core/surface.js';
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
    assert.ok(Object.isFrozen(support)); assert.equal(support.length,4);
    assert.ok(support.every(Number.isFinite)); assert.ok(support[3]>=.95&&support[3]<=1.50,shape+' restrained uniform size');
  }
});
test('all 35 crown fits preserve every vertex distance through squash and accessory rotation',()=>{
  for(const shape of MATERIAL_SHAPE_NAMES){
    const body=createResolvedFixture({body:{shape}}).body,profile=resolveShapeProfile(shape);
    for(const squash of [.86,1,1.14])for(const rotation of [[0,0,0],[.1,-.1,.05]])rigid(beretGeometry(body,crown,squash,undefined,profile,rotation),profile.accessories.crown.scale,shape+'/'+squash);
  }
});
test('rigid crown metal does not cross body triangles on 35 settled shapes',()=>{
  for(const shape of MATERIAL_SHAPE_NAMES){
    const body=createResolvedFixture({body:{shape}}).body,profile=resolveShapeProfile(shape),contour=shapeContour({kind:'material',name:shape});
    const mesh=beretGeometry(body,crown,1,contour,profile);
    const overlap=intersections(triangles(mesh),triangles(bodyGeometry(contour),[.59,.59,profile.depth*.5]));
    assert.equal(overlap.count,0,shape+': '+JSON.stringify(overlap.samples));
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
