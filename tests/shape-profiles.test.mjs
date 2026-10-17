import test from 'node:test';
import assert from 'node:assert/strict';
import { createDesign as publicDesign, patchDesign, serializeDesign } from '../dist/src/core/design.js';
import { createResolvedFixture as createDesign, createResolvedAccessory as createAccessory } from './internal-fixtures.mjs';
import { MATERIAL_SHAPE_NAMES } from '../dist/src/core/shapes.js';
import { DEFAULT_SHAPE_PROFILES, BODY_DEPTH_RANGE, MOUNT_UV_RANGE, MOUNT_OFFSET_RANGE, parseShapeProfiles, resolveShapeProfile, interpolateShapeProfile, accessoryMountAnchor } from '../dist/src/core/shape-profiles.js';
import { ShapeTimeline } from '../dist/src/core/shape-motion.js';
import { buildMorph } from '../dist/src/core/morph.js';
import { bodyPoint, bodyNormal, contourSurfacePoint, deformBodyPoint, sampleSurface, sampleSurfaceAtXY, sampleAccessorySurface, accessoryChartDiagnostics } from '../dist/src/core/surface.js';
import { shapeContour, contourSnapshot, contourSignedDistance } from '../dist/src/core/contours.js';
import { bodyGeometry } from '../dist/src/renderer/body-geometry.js';
import { projectEyes, clipOccludedEyes } from '../dist/src/renderer/eye-projection.js';
import { transform } from '../dist/src/core/math.js';

const copy = value => structuredClone(value);
const near = (a, b, epsilon = 1e-10) => assert.ok(Math.abs(a - b) < epsilon, `${a} differs from ${b}`);
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const legacy = p => ({ depth: p.depth, mounts: copy(p.mounts), eyes: copy(p.eyes) });
const profile = (shape, depth, headU = 0, faceV = 0) => {
  const p = copy(resolveShapeProfile(shape)); p.depth = depth; p.mounts.head.uv[0] = headU; p.mounts.face.uv[1] = faceV; return p;
};

test('all 35 catalog shapes have isolated, immutable, bounded and varied profile defaults', () => {
  assert.deepEqual(Object.keys(DEFAULT_SHAPE_PROFILES).sort(), [...MATERIAL_SHAPE_NAMES].sort());
  assert.deepEqual(BODY_DEPTH_RANGE, [.08, 1.2]); assert.deepEqual(MOUNT_UV_RANGE, [-.65, .65]); assert.deepEqual(MOUNT_OFFSET_RANGE, [0, .25]);
  assert.ok(new Set(MATERIAL_SHAPE_NAMES.map(name => resolveShapeProfile(name).depth)).size >= 6);
  for (const name of MATERIAL_SHAPE_NAMES) {
    const p = resolveShapeProfile(name); assert.strictEqual(p, DEFAULT_SHAPE_PROFILES[name]);
    assert.deepEqual(parseShapeProfiles({ [name]: legacy(p) })[name].eyes, p.eyes);
    assert.ok(Object.isFrozen(p)); assert.ok(Object.isFrozen(p.mounts));
    for (const slot of ['head', 'face']) { assert.ok(Object.isFrozen(p.mounts[slot])); assert.ok(Object.isFrozen(p.mounts[slot].uv)); }
    assert.throws(() => { p.depth = .5; }); assert.throws(() => { p.mounts.head.uv[0] = .2; });
  }
});

test('profile parser strictly rejects malformed maps, ranges, regions and nonfinite numbers', () => {
  const good = legacy(profile('square', .4));
  for (const value of [null, [], new Date(), { orb: good }, { square: undefined }, { square: { depth: .4 } }, { [Symbol()]: good }, Object.create({ square: good })]) assert.throws(() => parseShapeProfiles(value));
  for (const value of [NaN, Infinity, -Infinity, null, '0.4', .079, 1.201]) assert.throws(() => parseShapeProfiles({ square: { ...good, depth: value } }));
  for (const name of ['head', 'face']) {
    for (const uv of [[NaN, 0], [0, Infinity], [-.651, 0], [0, .651], [0], [0, 0, 0], '0,0']) {
      const p = copy(good); p.mounts[name].uv = uv; assert.throws(() => parseShapeProfiles({ square: p }));
    }
    for (const offset of [NaN, Infinity, -.001, .251, null]) { const p = copy(good); p.mounts[name].offset = offset; assert.throws(() => parseShapeProfiles({ square: p })); }
  }
  assert.throws(() => parseShapeProfiles(Object.defineProperty({}, 'square', { value: good })));
  let reads = 0; assert.throws(() => parseShapeProfiles({ get square() { reads++; return good; } })); assert.equal(reads, 0);
  const extra = copy(good); extra.mounts.head.region = 'face'; assert.throws(() => parseShapeProfiles({ square: extra }));
  const unknownSlot = copy(good); unknownSlot.mounts.neck = unknownSlot.mounts.head; assert.throws(() => parseShapeProfiles({ square: unknownSlot }));
  assert.throws(() => resolveShapeProfile('orb')); assert.throws(() => resolveShapeProfile('square', null));
});

test('public volume and mount overrides reject while internal defaults remain isolated', () => {
 const overrides={square:legacy(profile('square',.55,.2,-.15))};
 assert.throws(()=>publicDesign({body:{profiles:overrides}}));
 const d=publicDesign();assert.throws(()=>patchDesign(d,{body:{depth:.5}}));
 assert.doesNotMatch(serializeDesign(d),/profiles|depth|anchor|rotation/);
 const p=resolveShapeProfile('square'),a=copy(p);a.depth=.2;a.mounts.head.uv[0]=.3;assert.notDeepEqual(a,p);assert.equal(p.depth,.9);
});


test('per-accessory placement is independent of equipment slots and legacy mount calibration', () => {
 const p=copy(resolveShapeProfile('heart')),hat=createAccessory('beret'),halo=createAccessory('halo'),glasses=createAccessory('glasses');
 const before=[hat,halo,glasses].map(a=>accessoryMountAnchor(a,p));
 p.mounts.head.uv=[-.6,.6];p.mounts.head.offset=.2;p.mounts.face.uv=[.6,-.6];
 assert.deepEqual([hat,halo,glasses].map(a=>accessoryMountAnchor(a,p)),before);
 assert.notDeepEqual(before[0],before[1]);assert.equal(hat.slot,halo.slot);assert.equal(glasses.slot,'eyes');
 const h=copy(p);h.accessories.beret.anchor.uv[0]-=.1;assert.notDeepEqual(accessoryMountAnchor(hat,h),before[0]);assert.deepEqual(accessoryMountAnchor(halo,h),before[1]);
});


test('profile depth changes rounded front, rim, squash and mesh deformation through one shared scale', () => {
  const body = createDesign({ body: { shape: 'heart', profiles: { heart: profile('heart', .6) } } }).body;
  const contour = shapeContour({ kind: 'material', name: body.shape });
  for (const depth of [.08, .28, .65, 1.2]) for (const squash of [.88, 1, 1.12]) {
    const runtime = profile('heart', depth); const stretch = 1 / Math.sqrt(squash);
    near(bodyPoint(body, [0, 0, 1], squash, contour, runtime)[2], depth / 2 * stretch);
    near(bodyPoint(body, [0, 0, -1], squash, contour, runtime)[2], -depth / 2 * stretch);
    assert.ok(distance(bodyNormal(body, [0, 0, 1], squash, contour, runtime), [0, 0, 1]) < 1e-12);
    const mesh = bodyGeometry(contour);
    for (let i = 0; i < mesh.vertices.length; i += 6) {
      const v = Array.from(mesh.vertices.slice(i, i + 3)), point = deformBodyPoint(body, v, squash, runtime);
      near(point[2], v[2] * depth / 2 * stretch);
    }
    const eye = sampleSurface(body, { region: 'face', uv: [0, .1], offset: 0 }, squash, contour, runtime);
    const xy = [eye.position[0] / (.59 * stretch), eye.position[1] / (.59 * squash)];
    near(eye.position[2], contourSurfacePoint(contour, ...xy)[2] * depth / 2 * stretch, 1e-8);
    assert.ok(eye.position[2] < depth / 2 * stretch);
  }
  near(bodyPoint(body, [0, 0, 1])[2], resolveShapeProfile('heart').depth/2);
});

test('contour depth and every curated accessory frame share easing and interruption snapshots', async()=>{
 for(const easing of ['linear','smooth']){const t=new ShapeTimeline('square'),initial=t.snapshot,first=t.to('heart',{duration:1000,easing});t.advance(250);const amount=easing==='linear'?.25:.15625;assert.deepEqual(t.profile,interpolateShapeProfile(initial.profile,resolveShapeProfile('heart'),amount));
 const visible=t.snapshot,next=t.to('puffy',{duration:750,easing:'linear'});assert.deepEqual(await first,{finished:false});assert.strictEqual(t.snapshot,visible);t.advance(0);assert.deepEqual(t.snapshot,visible);t.advance(375);assert.deepEqual(t.profile,interpolateShapeProfile(visible.profile,resolveShapeProfile('puffy'),.5));t.finish();assert.deepEqual(await next,{finished:true});assert.deepEqual(t.profile,resolveShapeProfile('puffy'));assert.ok(Object.isFrozen(t.profile.accessories.beret.rotation));}
});


test('catalog no-op and invalid retargets preserve visible calibration atomically', async()=>{
 const t=new ShapeTimeline('square'),before=t.snapshot;assert.deepEqual(await t.to('square'),{finished:true});assert.strictEqual(t.snapshot,before);
 const first=t.to('heart',{duration:1000,easing:'linear'});t.advance(300);const visible=t.snapshot,target=t.targetProfile;
 for(const invalid of['orb',null,{},1]){assert.throws(()=>t.to(invalid));assert.throws(()=>t.set(invalid));assert.strictEqual(t.snapshot,visible);assert.strictEqual(t.targetProfile,target);}
 t.cancel();assert.deepEqual(await first,{finished:false});assert.strictEqual(t.snapshot,visible);await t.to('heart',{duration:0});assert.deepEqual(t.profile,resolveShapeProfile('heart'));
});


test('actual concave head mounts stay continuous across changing contour and calibration', async () => {
  for (const [from, to] of [['heart', 'boom'], ['boom', 'puffy'], ['puffy', 'pixelTriangle'], ['pixelTriangle', 'heart']]) {
    const timeline = new ShapeTimeline(from), body = createDesign({ body: { shape: to } }).body, hat = createAccessory('halo');
    const done = timeline.to(to, { duration: 1000, easing: 'linear' });
    let previous = sampleAccessorySurface(body, hat, 1, timeline.contour, timeline.profile);
    for (let i = 1; i <= 1000; i++) {
      timeline.advance(1); const current = sampleAccessorySurface(body, hat, 1, timeline.contour, timeline.profile);
      assert.ok(distance(current.position, previous.position) < .01, `${from} -> ${to}, position at ${i}`);
      assert.ok(distance(current.normal, previous.normal) < .002, `${from} -> ${to}, orientation at ${i}`);
      assert.ok(current.matrix.every(Number.isFinite)); previous = current;
      if (i === 413) {
        const visible = timeline.snapshot, actual = copy(current);
        // A same-target interruption must preserve the full attachment frame.
        const retarget = timeline.to(to, { duration: 587, easing: 'linear' });
        assert.strictEqual(timeline.snapshot, visible);
        assert.deepEqual(sampleAccessorySurface(body, hat, 1, timeline.contour, timeline.profile), actual);
        // Remaining loop advances this request to the same original deadline.
        retarget.then(result => assert.equal(result.finished, true));
      }
    }
    assert.equal(timeline.active, false); await done;
    assert.deepEqual(previous, sampleAccessorySurface(body, hat));
  }
});


test('eye centers and occlusion use displayed profile depth instead of the persisted target depth', async () => {
  const profiles = { circle: resolveShapeProfile('circle'), square: resolveShapeProfile('square') };
  const design = createDesign({ body: { shape: 'square', profiles } }), timeline = new ShapeTimeline('circle', profiles);
  const identity = transform([0, 0, 0], [0, 0, 0]);
  const done = timeline.to('square', { duration: 1000, easing: 'linear' }, profiles);
  for (const delta of [0, 100, 300, 500, 100]) {
    timeline.advance(delta);
    const eyes = projectEyes(design, identity, [0, 0], [0, 0], 1, timeline.contour, timeline.profile);
    for (const side of ['left', 'right']) {
      const [x,y,z] = eyes[side].center;
      near(z, contourSurfacePoint(timeline.contour, x/.59, y/.59)[2] * timeline.profile.depth / 2, 1e-8);
      assert.ok(z < timeline.profile.depth / 2);
    }
    const geometry = bodyGeometry(timeline.contour), vertices = geometry.vertices.slice();
    for (let i = 0; i < vertices.length; i += 6) vertices.set(deformBodyPoint(design.body, Array.from(vertices.slice(i, i + 3)), 1, timeline.profile), i);
    clipOccludedEyes(eyes, identity, vertices, geometry.indices);
    assert.equal(eyes.left.visible, true); assert.equal(eyes.right.visible, true);
  }
  assert.deepEqual(await done, { finished: true });
});


test('semantic perimeter charts remove the SoftBoom to PixelTriangle concave ray branch jump', () => {
  const from = resolveShapeProfile('softBoom'), to = resolveShapeProfile('pixelTriangle');
  const morph = buildMorph({ kind: 'material', name: 'softBoom' }, { kind: 'material', name: 'pixelTriangle' });
  const body = createDesign({ body: { shape: 'pixelTriangle' } }).body, hat = createAccessory('beret');
  const frame = amount => sampleAccessorySurface(body, hat, 1, morph.sample(amount), interpolateShapeProfile(from, to, amount));
  assert.ok(distance(frame(.2801).position, frame(.2802).position) < .0001);
  let previous = frame(.27);
  for (let i = 2701; i <= 2900; i++) {
    const current = frame(i / 10000);
    assert.ok(distance(current.position, previous.position) < .001, `concave transition at ${i / 10000}`);
    previous = current;
  }
});

test('perimeter charts are invariant to cyclic indexing and collinear subdivision', () => {
  for (const name of MATERIAL_SHAPE_NAMES) {
    const contour = shapeContour({ kind: 'material', name }), points = contour.points;
    const shift = Math.floor(points.length / 3), reindexed = contourSnapshot([...points.slice(shift), ...points.slice(0, shift)]);
    const subdivided = contourSnapshot(points.flatMap((p, i) => { const q = points[(i + 1) % points.length]; return [p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]]; }));
    const body = createDesign({ body: { shape: name } }).body;
    for(const [x,y] of [[0,0],[.2,.1],[-.3,.2]]){
      const expected=sampleSurfaceAtXY(body,x,y,1,contour);
      for(const variant of [reindexed,subdivided]){
        const actual=sampleSurfaceAtXY(body,x,y,1,variant);
        assert.ok(distance(actual.position,expected.position)<1e-10,`${name}: reindex altered rounded field`);
        assert.ok(distance(actual.normal,expected.normal)<1e-8,`${name}: reindex altered rounded normal`);
      }
    }
    for (const region of ['face', 'crown', 'left', 'right']) {
      const accessory = createAccessory('beret'); accessory.anchor = { region, uv: [.4, -.3], offset: 0 };
      const expected = sampleAccessorySurface(body, accessory, 1, contour);
      for (const variant of [reindexed, subdivided]) {
        const actual = sampleAccessorySurface(body, accessory, 1, variant);
        assert.ok(distance(actual.position, expected.position) < 1e-6, `${name} ${region}: arbitrary contour indexing altered mount`);
        assert.ok(distance(actual.normal, expected.normal) < 1e-12);
        near(accessoryChartDiagnostics(variant).magnitude, accessoryChartDiagnostics(contour).magnitude, 1e-10);
      }
    }
    assert.ok(accessoryChartDiagnostics(contour).magnitude > .1, `${name}: degenerate chart phase`);
  }
});

test('perimeter charts preserve exact stationary endpoint limits and nonzero phase through difficult morphs', () => {
  for (const [fromName, toName] of [['softBoom', 'pixelTriangle'], ['heart', 'boom'], ['puffy', 'pixelTriangle'], ['clover8Leaf', 'flower'], ['circle', 'heart']]) {
    const from = resolveShapeProfile(fromName), to = resolveShapeProfile(toName), body = createDesign({ body: { shape: toName } }).body;
    const morph = buildMorph({ kind: 'material', name: fromName }, { kind: 'material', name: toName }), hat = createAccessory('halo');
    const frame = amount => sampleAccessorySurface(body, hat, 1, morph.sample(amount), interpolateShapeProfile(from, to, amount));
    assert.ok(distance(frame(0).position, frame(1e-8).position) < 1e-6, `${fromName}: source seam`);
    assert.ok(distance(frame(1).position, frame(1 - 1e-8).position) < 1e-6, `${toName}: target seam`);
    for (let i = 0; i <= 100; i++) assert.ok(accessoryChartDiagnostics(morph.sample(i / 100)).magnitude > .1);
  }
});

test('semantic region mounts retain stable rim XY or lie safely on the rounded front', () => {
  for (const name of MATERIAL_SHAPE_NAMES) {
    const body = createDesign({ body: { shape: name } }).body, contour = shapeContour({ kind: 'material', name });
    const runtime = copy(resolveShapeProfile(name));
    for (const region of ['face', 'crown', 'left', 'right']) for (const uv of [[0, 0], [.85, .85], [-.85, -.85], [.5, -.3]]) {
      const hat = createAccessory('beret'); runtime.accessories.beret.anchor = { region, uv, offset: 0 }; runtime.accessories.beret.rotation = [0,0,0];
      const frame = sampleAccessorySurface(body, hat, 1, contour, runtime), canonical = [frame.position[0] / .59, frame.position[1] / .59, frame.position[2] / (runtime.depth / 2)];
      assert.ok(canonical.every(Number.isFinite)); assert.ok(Math.abs(canonical[2]) <= 1 + 1e-12);
      const signedDistance = contourSignedDistance(contour, canonical[0], canonical[1]);
      if (region === 'face') { near(canonical[2], contourSurfacePoint(contour,canonical[0],canonical[1])[2],1e-8); assert.ok(signedDistance >= .0009); }
      else assert.ok(Math.abs(signedDistance) < .0008, `${name} ${region}: mount left contour rim`);
    }
  }
});

test('XY surface queries preserve face-plane spacing on every rounded catalog body', () => {
  for(const name of MATERIAL_SHAPE_NAMES){
    const body=createDesign({body:{shape:name}}).body,contour=shapeContour({kind:'material',name});
    for(const squash of [.88,1,1.12])for(const [x,y]of[[0,0],[.2,.15],[-.3,.1]]){
      const frame=sampleSurfaceAtXY(body,x,y,squash,contour),stretch=1/Math.sqrt(squash);
      near(frame.position[0],x*.59*stretch);near(frame.position[1],y*.59*squash);
      near(frame.position[2],contourSurfacePoint(contour,x,y)[2]*resolveShapeProfile(name).depth/2*stretch);
      assert.ok(frame.normal[2]>0);near(Math.hypot(...frame.normal),1);assert.ok(frame.matrix.every(Number.isFinite));
      const back=sampleSurfaceAtXY(body,x,y,squash,contour,undefined,false);
      near(back.position[2],-frame.position[2]);near(back.normal[2],-frame.normal[2]);
    }
  }
});

test('physical rays choose the first rounded exit before a later concave re-entry',()=>{
  const contour=contourSnapshot([[-1,-1],[2,-1],[2,1],[.6,1],[.6,.01],[.4,.01],[.4,1],[-1,1]]);
  const body=createDesign().body,direction=[1,0,.6],p=bodyPoint(body,direction,1,contour);
  const canonical=[p[0]/.59,p[1]/.59,p[2]/(resolveShapeProfile(body.shape).depth/2)];
  assert.ok(canonical[0]>.4&&canonical[0]<.6,`first exit at ${canonical[0]}`);
  near(canonical[2],.6*canonical[0],1e-10);near(canonical[2],contourSurfacePoint(contour,canonical[0],0)[2],1e-7);
  assert.ok(.6*.7<contourSurfacePoint(contour,.7,0)[2],'the ray re-enters the later lobe');
  for(let i=0;i<200;i++){
    const x=canonical[0]*i/200;assert.ok(.6*x<contourSurfacePoint(contour,x,0)[2],'first exit skipped an earlier crossing');
  }
  assert.ok(bodyNormal(body,direction,1,contour).every(Number.isFinite));
});

test('rounded surface fields and semantic cap mounts retain interrupted snapshot identity',async()=>{
  const timeline=new ShapeTimeline('softBoom'),body=createDesign({body:{shape:'pixelTriangle'}}).body,glasses=createAccessory('glasses');
  const pending=timeline.to('pixelTriangle',{duration:1000,easing:'linear'});timeline.advance(280.2);
  const snapshot=timeline.snapshot,physical=sampleSurface(body,{region:'face',uv:[.3,.2],offset:0},1,snapshot.contour,snapshot.profile);
  const xy=sampleSurfaceAtXY(body,.3,.2,1,snapshot.contour,snapshot.profile),mount=sampleAccessorySurface(body,glasses,1,snapshot.contour,snapshot.profile);
  const next=timeline.to('heart',{duration:500,easing:'linear'});
  assert.deepEqual(await pending,{finished:false});assert.strictEqual(timeline.snapshot,snapshot);
  assert.deepEqual(sampleSurface(body,{region:'face',uv:[.3,.2],offset:0},1,timeline.contour,timeline.profile),physical);
  assert.deepEqual(sampleSurfaceAtXY(body,.3,.2,1,timeline.contour,timeline.profile),xy);
  assert.deepEqual(sampleAccessorySurface(body,glasses,1,timeline.contour,timeline.profile),mount);
  let previous=mount;
  for(let i=0;i<500;i++){
    timeline.advance(1);const current=sampleAccessorySurface(body,glasses,1,timeline.contour,timeline.profile);
    assert.ok(distance(current.position,previous.position)<.01);assert.ok(current.matrix.every(Number.isFinite));previous=current;
  }
  assert.deepEqual(await next,{finished:true});
});

test('crown front/back calibration changes position at the current physical depth',()=>{
  for(const name of MATERIAL_SHAPE_NAMES){
    const body=createDesign({body:{shape:name}}).body,hat=createAccessory('beret'),contour=shapeContour({kind:'material',name});
    const runtime=copy(resolveShapeProfile(name));
    const sample=v=>{runtime.accessories.beret.anchor={region:'crown',uv:[.2,v],offset:0};return sampleAccessorySurface(body,hat,1,contour,runtime);};
    const back=sample(.35),rim=sample(0),front=sample(-.35);
    for(const p of [back,front]){near(p.position[0],rim.position[0]);near(p.position[1],rim.position[1]);}
    near(rim.position[2],0);assert.ok(back.position[2]<-.01&&front.position[2]>.01);near(back.position[2],-front.position[2]);
    runtime.depth*=.5;near(sample(-.35).position[2],front.position[2]*.5);
  }
});

test('fuller curated volumes remain varied while public thickness editing is unavailable',()=>{
 assert.equal(resolveShapeProfile('circle').depth,1);assert.equal(resolveShapeProfile('square').depth,.9);assert.equal(resolveShapeProfile('heart').depth,.9);assert.equal(resolveShapeProfile('puffy').depth,1.08);
 for(const name of MATERIAL_SHAPE_NAMES){assert.ok(resolveShapeProfile(name).depth>=.5);assert.throws(()=>publicDesign({body:{shape:name,profiles:{[name]:legacy(profile(name,.18))}}}));}
});
