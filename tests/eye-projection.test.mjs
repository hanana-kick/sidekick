import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MATERIAL_SHAPE_NAMES } from '../dist/src/core/design.js';
import { resolveShapeProfile, resolveShapeEyeGeometry } from '../dist/src/core/shape-profiles.js';
import { transform, multiply } from '../dist/src/core/math.js';
import { sampleSurfaceAtXY, deformBodyPoint, BODY_SIZE } from '../dist/src/core/surface.js';
import { bodyGeometry } from '../dist/src/renderer/body-geometry.js';
import { shapeContour, contourSignedDistance } from '../dist/src/core/contours.js';
import { projectEyes, clipOccludedEyes, viewPoint, eyeBasis } from '../dist/src/renderer/eye-projection.js';

import { createResolvedFixture as createDesign } from './internal-fixtures.mjs';

const near = (a,b,label,tolerance=2e-7)=>assert.ok(Math.abs(a-b)<=tolerance,label+': '+a+' vs '+b);
const planePoint=(b,[x,y])=>[b[0]*x+b[2]*y,b[1]*x+b[3]*y];

test('local glyph size uses each shape calibration and stays stable across views and squash',()=>{
 for(const shape of MATERIAL_SHAPE_NAMES)for(const rotation of [[0,0,0],[.3,.6,.7],[0,Math.PI/2,0],[0,Math.PI,.9]])for(const squash of [.88,1,1.12]){
  const design=createDesign({body:{shape}}),eyes=projectEyes(design,transform([.1,.2,0],rotation),[.2,-.1],[.4,-.3],squash);
  const effective=resolveShapeEyeGeometry(design.eyes,resolveShapeProfile(shape));
  assert.deepEqual(eyes.size,[effective.width*.59*design.eyes.scale,effective.height*.59*design.eyes.scale]);
  near(eyes.size[0]/eyes.size[1],effective.width/effective.height,'calibrated local aspect');
  for(const eye of[eyes.left,eyes.right])assert.ok([...eye.center,...eye.localCenter,...eye.direction].every(Number.isFinite));
 }
});

test('eye centers use the fixed-XY rounded surface rather than a ray or planar cap',()=>{
 for(const shape of MATERIAL_SHAPE_NAMES)for(const squash of [.88,1,1.12]){
  const design=createDesign({body:{shape}}),root=transform([.1,-.2,0],[.2,.6,.4]),eyes=projectEyes(design,root,[0,0],[0,0],squash);
  const stretch=1/Math.sqrt(squash),outline=shapeContour({kind:'material',name:shape});
  for(const eye of[eyes.left,eyes.right]){
   const x=eye.localCenter[0]/(.59*stretch),y=eye.localCenter[1]/(.59*squash),frame=sampleSurfaceAtXY(design.body,x,y,squash,outline);
   eye.localCenter.forEach((v,j)=>near(v,frame.position[j],'local surface center',1e-12));
   viewPoint(root,frame.position).forEach((v,j)=>near(v,eye.center[j],'view surface center',1e-12));
   assert.equal(eye.visible,contourSignedDistance(outline,x,y)>0&&viewPoint(root,frame.normal,true)[2]>.015);
  }
 }
});

test('basis diagnostics retain yaw/pitch compression and roll, but do not gate curved-surface ink',()=>{
 const design=createDesign();
 for(const angle of[0,.3,Math.PI/3,5*Math.PI/12,88*Math.PI/180]){
  const yaw=projectEyes(design,transform([0,0,0],[0,angle,0])),pitch=projectEyes(design,transform([0,0,0],[angle,0,0]));
  near(Math.hypot(...planePoint(yaw.basis,[yaw.size[0],0])),yaw.size[0]*Math.cos(angle),'yaw basis width');
  near(Math.hypot(...planePoint(pitch.basis,[0,pitch.size[1]])),pitch.size[1]*Math.cos(angle),'pitch basis height');
 }
 const r=.6,b=eyeBasis(transform([0,0,0],[0,0,r]));near(b[0],Math.cos(r),'roll');near(b[1],Math.sin(r),'roll');
 const shader=readFileSync(new URL('../src/renderer/webgl.ts',import.meta.url),'utf8');
 assert.match(shader,/eyeDistance\(vFacePosition\s*-\s*eyeCenters\.xy/);
 assert.match(shader,/step\(0\.00001, vFrontCap\)/);
 assert.doesNotMatch(shader,/uniform vec4 eyeInverseBasis|clipOccludedEyes\(/);
 assert.doesNotMatch(shader,/eyes\.left\.visible|eyes\.right\.visible/);
});

test('rounded-surface eye points inherit composed camera/body geometry without a billboard',()=>{
 const views=[transform(),transform([0,0,0],[0,Math.PI/3,0]),transform([0,0,0],[Math.PI/3,0,0]),transform([.1,-.2,.3],[.5,-.8,.65]),multiply(transform([0,0,0],[-.35,.6,-.2]),transform([.1,-.2,.3],[.4,-.3,.65]))];
 for(const shape of MATERIAL_SHAPE_NAMES){
  const design=createDesign({body:{shape}}),contour=shapeContour({kind:'material',name:shape}),local=projectEyes(design,transform());
  for(const matrix of views){const eyes=projectEyes(design,matrix);for(const side of['left','right']){
   assert.deepEqual(eyes[side].localCenter,local[side].localCenter);
   const center=viewPoint(matrix,local[side].localCenter);center.forEach((v,j)=>near(eyes[side].center[j],v,'attached center'));
   for(const [dx,dy]of[[eyes.size[0]/2,0],[-eyes.size[0]/2,0],[0,eyes.size[1]/2],[0,-eyes.size[1]/2]]){
    const x=(eyes[side].localCenter[0]+dx)/.59,y=(eyes[side].localCenter[1]+dy)/.59;
    const frame=sampleSurfaceAtXY(design.body,x,y,1,contour),projected=viewPoint(matrix,frame.position);
    assert.ok(projected.every(Number.isFinite));near(frame.position[0]-eyes[side].localCenter[0],dx,'glyph x');near(frame.position[1]-eyes[side].localCenter[1],dy,'glyph y');
   }
  }}
 }
});

test('side views retain the near curved patch while rear eye centers are hidden',()=>{
 for(const shape of MATERIAL_SHAPE_NAMES){
  const design=createDesign({body:{shape}}),back=projectEyes(design,transform([0,0,0],[0,Math.PI,0]));
  assert.equal(back.left.visible,false,shape);assert.equal(back.right.visible,false,shape);
  for(const angle of[Math.PI/2,-Math.PI/2]){const eyes=projectEyes(design,transform([0,0,0],[0,angle,0]));assert.ok([...eyes.basis,...eyes.inverseBasis,...eyes.left.center,...eyes.right.center].every(Number.isFinite));}
 }
 const circle=createDesign({body:{shape:'circle'}}),side=projectEyes(circle,transform([0,0,0],[0,Math.PI/2,0]));
 assert.notEqual(side.left.visible,side.right.visible,'At a curved limb the nearer patch remains, unlike a flat billboard plane');
});

test('center occlusion remains a diagnostic without hiding sibling or partial glyphs in the renderer',()=>{
 const eyes={left:{center:[0,0,0],direction:[0,0,1],visible:true},right:{center:[2,0,0],direction:[0,0,1],visible:true},size:[.1,.2],depthRange:.36};
 const vertices=new Float32Array([-1,-1,.2,0,0,1,1,-1,.2,0,0,1,0,1,.2,0,0,1]);
 clipOccludedEyes(eyes,transform(),vertices,new Uint16Array([0,1,2]));assert.equal(eyes.left.visible,false);assert.equal(eyes.right.visible,true);
});

test('front eye anchors remain in front of all 35 actual rounded meshes',()=>{
 for(const shape of MATERIAL_SHAPE_NAMES){const design=createDesign({body:{shape}}),geometry=bodyGeometry({kind:'material',name:shape}),vertices=geometry.vertices.slice();
  for(let i=0;i<vertices.length;i+=6)vertices.set(deformBodyPoint(design.body,[vertices[i],vertices[i+1],vertices[i+2]]),i);
  const eyes=projectEyes(design,transform());clipOccludedEyes(eyes,transform(),vertices,geometry.indices);
  assert.ok(eyes.left.visible&&eyes.right.visible,shape+' front anchors');
 }
});

test('deeply notched catalog shapes fit the eye pair without shrinking capsules or collapsing centers',async()=>{
 const {MATERIAL_SHAPE_NAMES}=await import('../dist/src/core/design.js');const{shapeContour,contourSignedDistance}=await import('../dist/src/core/contours.js');const{BODY_SIZE}=await import('../dist/src/core/surface.js');
 for(const name of MATERIAL_SHAPE_NAMES){const design=createDesign({body:{shape:name}}),c=shapeContour({kind:'material',name}),eyes=projectEyes(design,transform(),[0,0],[0,0],1,c);assert.ok(eyes.right.center[0]-eyes.left.center[0]>eyes.size[0]);
  for(const eye of[eyes.left,eyes.right]){const x=eye.center[0]/(BODY_SIZE[0]/2),y=eye.center[1]/(BODY_SIZE[1]/2),hx=eyes.size[0]/BODY_SIZE[0],hy=eyes.size[1]/BODY_SIZE[1],r=Math.min(hx,hy);for(let i=0;i<80;i++){const a=i/80*Math.PI*2,dx=Math.cos(a)*r+Math.sign(Math.cos(a))*(hx-r),dy=Math.sin(a)*r+Math.sign(Math.sin(a))*(hy-r);assert.ok(contourSignedDistance(c,x+dx,y+dy)>=-.0005,name+' capsule');}}
 }
});

test('eye pair fitting moves continuously during concave morphs',async()=>{
 const{shapeContour}=await import('../dist/src/core/contours.js');const{buildMorph}=await import('../dist/src/core/morph.js');
 for(const[from,to]of[['square','boom'],['softBoom','pixelTriangle'],['boom','heart']]){const m=buildMorph(shapeContour({kind:'material',name:from}),shapeContour({kind:'material',name:to})),design=createDesign({body:{shape:to}});let previous;for(let i=0;i<=200;i++){const e=projectEyes(design,transform(),[0,0],[0,0],1,m.sample(i/200));if(previous)for(const side of['left','right'])assert.ok(Math.hypot(...e[side].center.map((v,j)=>v-previous[side].center[j]))<.015,from+'→'+to);previous=e;}}
});

test('all catalog shapes contain the enlarged default full-smile footprint through squash', async () => {
  const { shapeContour, contourSignedDistance } = await import('../dist/src/core/contours.js');
  for (const shape of MATERIAL_SHAPE_NAMES) for (const squash of [.88, 1, 1.12]) {
    const design = createDesign({ body: { shape } }), eyes = projectEyes(design, transform(), [0, 0], [0, 0], squash);
    const contour = shapeContour({ kind: 'material', name: shape }), stretch = 1 / Math.sqrt(squash);
    for (const side of ['left', 'right']) {
      const target = design.eyes[side].targets.smile;
      const radius = eyes.size[0] * target.radius, stroke = Math.min(...eyes.size) * target.thickness / 2;
      for (let i = 0; i <= 60; i++) for (let j = 0; j < 16; j++) {
        const arc = i / 60 * Math.PI, angle = j / 16 * 2 * Math.PI;
        const x = radius * Math.cos(arc) + stroke * Math.cos(angle);
        const y = radius * Math.sin(arc) + stroke * Math.sin(angle);
        const distance = contourSignedDistance(contour, (eyes[side].center[0] + x) / (.59 * stretch), (eyes[side].center[1] + y) / (.59 * squash));
        assert.ok(distance >= .00499, `${shape} ${side} squash=${squash} margin=${distance}`);
      }
    }
  }
});

test('editing either eye weight never moves either fitted center', () => {
  for (const shape of MATERIAL_SHAPE_NAMES) {
    const neutral = createDesign({ body: { shape } }), before = projectEyes(neutral, transform());
    for (const side of ['left', 'right']) for (const smile of [0, .35, 1]) for (const blink of [0, .4, 1]) {
      const design = createDesign({ body: { shape }, eyes: { [side]: { weights: { smile, blink } } } });
      const after = projectEyes(design, transform());
      assert.deepEqual(after.left.center, before.left.center); assert.deepEqual(after.right.center, before.right.center);
    }
  }
});

test('displayed profile eye calibration overrides the persisted target without changing global data or shape keys', () => {
 const design=createDesign({body:{shape:'square'},eyes:{scale:1.25,left:{weights:{smile:.7,blink:.2}},right:{weights:{smile:.1,blink:.8}}}});
 const original=structuredClone(design),runtime=structuredClone(resolveShapeProfile('square'));
 runtime.eyes={width:.7,height:1.2,spacing:.8,offsetY:-.12};
 const eyes=projectEyes(design,transform(),[0,0],[0,0],1,undefined,runtime),effective=resolveShapeEyeGeometry(design.eyes,runtime);
 near(eyes.size[0],design.eyes.width*.7*.59*design.eyes.scale,'displayed width');
 near(eyes.size[1],design.eyes.height*1.2*.59*design.eyes.scale,'displayed height');
 const neutral=projectEyes(design,transform());assert.notDeepEqual(eyes.size,neutral.size);
 assert.ok(eyes.left.localCenter[1]<neutral.left.localCenter[1],'displayed offsetY moves the current layout');
 assert.ok(eyes.right.localCenter[0]-eyes.left.localCenter[0]<neutral.right.localCenter[0]-neutral.left.localCenter[0],'displayed spacing is applied once');
 assert.equal(effective.anchor.uv[1],design.eyes.anchor.uv[1]+runtime.eyes.offsetY);
 assert.deepEqual(design,original,'geometry resolution never rewrites baseline, weights, targets, or scale');
});

test('extreme gaze translates both eyes together without collapsing or tilting their spacing', () => {
 for(const shape of MATERIAL_SHAPE_NAMES) for(const squash of [.88,1,1.12]) {
  const design=createDesign({body:{shape}}), neutral=projectEyes(design,transform(),[0,0],[0,0],squash);
  for(const gaze of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1],[-100,100],[100,-100]]) {
   const result=projectEyes(design,transform(),[0,0],gaze,squash);
   for(const axis of [0,1]) near(result.left.localCenter[axis]-neutral.left.localCenter[axis],result.right.localCenter[axis]-neutral.right.localCenter[axis],`${shape} conjugate axis ${axis}`,1e-12);
   assert.deepEqual(result.size,neutral.size);
   for(const side of ['left','right']) assert.ok(result[side].localCenter.every(Number.isFinite));
  }
 }
});

test('heart extreme gaze moves both eyes and clamps to the same bounded endpoint',()=>{
 const design=createDesign({body:{shape:'heart'}}), neutral=projectEyes(design,transform());
 for(const direction of [-1,1]) {
  const end=projectEyes(design,transform(),[0,0],[direction,0]);
  for(const side of ['left','right']) assert.ok((end[side].localCenter[0]-neutral[side].localCenter[0])*direction>.005,`${side} must track rather than freeze`);
  assert.deepEqual(projectEyes(design,transform(),[0,0],[direction*1e6,0]),end);
 }
});

test('extreme gaze keeps the full smile and blink envelopes inside every catalog outline',()=>{
 for(const shape of MATERIAL_SHAPE_NAMES) for(const squash of [.88,1,1.12]) {
  const design=createDesign({body:{shape}}),outline=shapeContour({kind:'material',name:shape}),stretch=1/Math.sqrt(squash);
  for(const gaze of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]) {
   const eyes=projectEyes(design,transform(),[0,0],gaze,squash);
   for(const side of ['left','right']) {
    const state=design.eyes[side], radius=eyes.size[0]*state.targets.smile.radius, halfStroke=Math.min(...eyes.size)*state.targets.smile.thickness/2;
    const halfWidth=Math.max(eyes.size[0]/2,radius+halfStroke),bottom=-Math.max(eyes.size[1]/2,halfStroke),top=Math.max(eyes.size[1]/2,radius+halfStroke);
    for(let i=0;i<=8;i++) for(const[x,y]of[[-halfWidth+(2*halfWidth)*i/8,bottom],[-halfWidth+2*halfWidth*i/8,top],[-halfWidth,bottom+(top-bottom)*i/8],[halfWidth,bottom+(top-bottom)*i/8]]) {
      assert.ok(contourSignedDistance(outline,(eyes[side].localCenter[0]+x)/(.59*stretch),(eyes[side].localCenter[1]+y)/(.59*squash))>=.0049,`${shape} ${side} ${gaze}`);
    }
   }
  }
 }
});

test('morphing and camera rotation retain conjugate gaze in the displayed shape frame',async()=>{
 const {buildMorph}=await import('../dist/src/core/morph.js');
 for(const[from,to]of[['circle','heart'],['heart','boom'],['boom','pixelTriangle']]) {
  const morph=buildMorph(shapeContour({kind:'material',name:from}),shapeContour({kind:'material',name:to}));
  const design=createDesign({body:{shape:to}});
  for(let step=0;step<=20;step++) {
   const outline=morph.sample(step/20),neutral=projectEyes(design,transform(),[0,0],[0,0],1,outline);
   for(const gaze of [[-1,-1],[1,1]]) for(const rotation of [[0,0,0],[.3,.6,.2]]) {
    const eyes=projectEyes(design,transform([0,0,0],rotation),[0,0],gaze,1,outline);
    for(const axis of [0,1]) near(eyes.left.localCenter[axis]-neutral.left.localCenter[axis],eyes.right.localCenter[axis]-neutral.right.localCenter[axis],`${from}→${to} conjugate morph`,1e-12);
   }
  }
 }
});
