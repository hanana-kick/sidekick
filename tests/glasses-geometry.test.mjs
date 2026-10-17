import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MATERIAL_SHAPE_NAMES } from '../dist/src/core/design.js';
import { createResolvedFixture as createDesign, createResolvedAccessory as createAccessory } from './internal-fixtures.mjs';
import { shapeContour, contourSignedDistance } from '../dist/src/core/contours.js';
import { contourVolumeHeight } from '../dist/src/core/body-volume.js';
import { resolveShapeProfile } from '../dist/src/core/shape-profiles.js';
import { ShapeTimeline } from '../dist/src/core/shape-motion.js';
import { transform } from '../dist/src/core/math.js';
import { projectEyes, viewPoint } from '../dist/src/renderer/eye-projection.js';
import { bodyGeometry } from '../dist/src/renderer/body-geometry.js';
import { glassesGeometry, GLASSES_CLEARANCE, GLASSES_SHOULDER, GLASSES_TUBE_SCALE } from '../dist/src/renderer/glasses-geometry.js';

const near = (a, b, message, tolerance = 2e-7) => assert.ok(Math.abs(a - b) <= tolerance, `${message}: ${a} vs ${b}`);
const eyeFrame = (design, contour, profile, squash = 1, face = [0, 0]) => projectEyes(design, transform(), face, [0, 0], squash, contour, profile);

// Independent front-triangle height readback. Index the production body mesh;
// the production glasses builder never imports or regenerates that heavy mesh.
function meshFrontHeight(mesh) {
  const buckets = new Map(), cell = 24, { vertices: v, indices } = mesh;
  for (let i = 0; i < indices.length; i += 6) {
    const triangle = [indices[i], indices[i + 1], indices[i + 2]].map(index => index * 6);
    const xs = triangle.map(i => v[i]), ys = triangle.map(i => v[i + 1]);
    for (let x = Math.floor(Math.min(...xs) * cell); x <= Math.floor(Math.max(...xs) * cell); x++) {
      for (let y = Math.floor(Math.min(...ys) * cell); y <= Math.floor(Math.max(...ys) * cell); y++) {
        const key = `${x},${y}`, bucket = buckets.get(key) ?? []; bucket.push(triangle); buckets.set(key, bucket);
      }
    }
  }
  return (x, y) => {
    let nearest = -Infinity;
    for (const [a, b, c] of buckets.get(`${Math.floor(x * cell)},${Math.floor(y * cell)}`) ?? []) {
      const determinant = (v[b + 1] - v[c + 1]) * (v[a] - v[c]) + (v[c] - v[b]) * (v[a + 1] - v[c + 1]);
      const wa = ((v[b + 1] - v[c + 1]) * (x - v[c]) + (v[c] - v[b]) * (y - v[c + 1])) / determinant;
      const wb = ((v[c + 1] - v[a + 1]) * (x - v[c]) + (v[a] - v[c]) * (y - v[c + 1])) / determinant;
      const wc = 1 - wa - wb;
      if (wa >= -1e-6 && wb >= -1e-6 && wc >= -1e-6) nearest = Math.max(nearest, wa * v[a + 2] + wb * v[b + 2] + wc * v[c + 2]);
    }
    return nearest;
  };
}
function* footprintSamples(mesh) {
  const { vertices: v, indices } = mesh;
  for (let i = 0; i < v.length; i += 6) yield [v[i], v[i + 1], v[i + 2]];
  for (let i = 0; i < indices.length; i += 3) {
    const points = [indices[i], indices[i + 1], indices[i + 2]].map(j => [v[j * 6], v[j * 6 + 1], v[j * 6 + 2]]);
    for (const weights of [[1 / 3, 1 / 3, 1 / 3], [.5, .5, 0], [0, .5, .5], [.5, 0, .5]]) {
      yield [0, 1, 2].map(k => points.reduce((sum, p, j) => sum + p[k] * weights[j], 0));
    }
  }
}
function clearanceBounds(mesh, contour, profile, squash = 1, actualBody = true) {
  const stretch = 1 / Math.sqrt(squash), sx = .59 * stretch, sy = .59 * squash, sz = profile.depth * .5 * stretch;
  const front = actualBody ? meshFrontHeight(bodyGeometry(contour)) : null;
  let minimum = Infinity, maximum = -Infinity, analyticMinimum = Infinity, shoulder = Infinity;
  for (const [x, y, z] of footprintSamples(mesh)) {
    const u = x / sx, v = y / sy;
    shoulder = Math.min(shoulder, contourSignedDistance(contour, u, v));
    const analytic = z - contourVolumeHeight(contour, u, v) * sz;
    const gap = front ? z - front(u, v) * sz : analytic;
    minimum = Math.min(minimum, gap); maximum = Math.max(maximum, gap); analyticMinimum = Math.min(analyticMinimum, analytic);
  }
  return { minimum, maximum, analyticMinimum, shoulder };
}

function checkRigidLenses(mesh) {
  for (const lens of mesh.lenses) {
    assert.equal(lens.vertexCount, 65 * 9); assert.equal(lens.indexCount, 64 * 8 * 6);
    for (let i = 0; i <= 64; i++) {
      const angle = i / 64 * Math.PI * 2;
      const expected = lens.center.map((v, k) => v + lens.radius * (lens.tangent[k] * Math.cos(angle) + lens.bitangent[k] * Math.sin(angle)));
      const average = [0, 0, 0];
      for (let j = 0; j < 8; j++) {
        const at = (lens.vertexStart + i * 9 + j) * 6, p = Array.from(mesh.vertices.subarray(at, at + 3));
        for (let k = 0; k < 3; k++) average[k] += p[k] / 8;
        near(Math.hypot(...p.map((v, k) => v - expected[k])), lens.tubeRadius, 'rigid torus tube radius', 8e-8);
      }
      for (let k = 0; k < 3; k++) near(average[k], expected[k], 'intrinsically circular planar lens centerline', 8e-8);
      near(Math.hypot(...average.map((v, k) => v - lens.center[k])), lens.radius, 'fixed circular radius', 8e-8);
      near(average.reduce((v, p, k) => v + (p - lens.center[k]) * lens.normal[k], 0), 0, 'plane fit is a rigid transform', 8e-8);
    }
  }
}

// Recover centerlines from the actual mesh, not just the diagnostic lens axes.
// Each ring is circular individually even in the old broken implementation;
// checking one shared plane is what prevents a bent two-lens front returning.
function checkPlanarFront(mesh) {
  checkRigidLenses(mesh);
  const [left, right] = mesh.lenses;
  for (const axis of ['tangent', 'bitangent', 'normal']) assert.deepEqual(right[axis], left[axis], `common front ${axis}`);
  const planeDistance = point => point.reduce((sum, v, k) => sum + (v - left.center[k]) * left.normal[k], 0);
  near(planeDistance(right.center), 0, 'both lens centers share one plane', 8e-8);
  for (const lens of mesh.lenses) for (let i = 0; i <= 64; i++) {
    const a = (lens.vertexStart + i * 9) * 6, b = (lens.vertexStart + i * 9 + 4) * 6;
    const center = [0, 1, 2].map(k => (mesh.vertices[a + k] + mesh.vertices[b + k]) * .5);
    near(planeDistance(center), 0, 'both circular centerlines are coplanar', 8e-8);
  }
  const separation = right.center.map((v, k) => v - left.center[k]);
  const distance = Math.hypot(...separation), direction = separation.map(v => v / distance);
  const from = left.center.map((v, k) => v + direction[k] * left.radius);
  const to = right.center.map((v, k) => v - direction[k] * right.radius);
  assert.equal(mesh.bridge.vertexCount, 25 * 9); assert.equal(mesh.bridge.indexCount, 24 * 8 * 6);
  for (let i = 0; i <= 24; i++) {
    const expected = from.map((v, k) => v + (to[k] - v) * i / 24), center = [0, 0, 0];
    for (let j = 0; j < 8; j++) {
      const at = (mesh.bridge.vertexStart + i * 9 + j) * 6, point = Array.from(mesh.vertices.subarray(at, at + 3));
      for (let k = 0; k < 3; k++) center[k] += point[k] / 8;
      near(Math.hypot(...point.map((v, k) => v - expected[k])), mesh.tubeRadius, 'bridge tube keeps constant thickness', 8e-8);
    }
    for (let k = 0; k < 3; k++) near(center[k], expected[k], 'straight bridge joins inward rim edges', 8e-8);
    near(planeDistance(center), 0, 'bridge shares the same front plane', 8e-8);
  }
}
function checkOpenings(mesh, design, eyes, label) {
  const [left, right] = mesh.lenses;
  const outerGap = Math.hypot(...right.center.map((v, k) => v - left.center[k])) - left.radius - right.radius - 2 * mesh.tubeRadius;
  assert.ok(outerGap > 0, `${label}: lens tubes intersect ${outerGap}`);
  const inner = mesh.radii[0] - mesh.tubeRadius;
  assert.ok(eyes.size[1] / 2 < inner, `${label}: neutral capsule fits in circular lens opening`);
  for (const side of ['left', 'right']) {
    const target = design.eyes[side].targets.smile, stroke = Math.min(...eyes.size) * target.thickness / 2, radius = eyes.size[0] * target.radius;
    assert.ok(radius + stroke < inner, `${label}: full smile fits in circular lens opening`);
  }
}

test('all 35 glasses fronts stay planar with rigid circular rims across camera views and squash', () => {
  for (const shape of MATERIAL_SHAPE_NAMES) {
    const design = createDesign({ body: { shape } }), accessory = createAccessory('glasses'), profile = resolveShapeProfile(shape);
    for (const squash of [.88, 1, 1.12]) {
      const eyes = eyeFrame(design, undefined, undefined, squash), mesh = glassesGeometry(design, accessory, eyes, squash);
      near(mesh.radii[0], Math.max(eyes.size[0] * 1.28, eyes.size[1] * .64) * profile.accessories.glasses.scale, 'one uniform eye-size radius');
      assert.equal(mesh.radii[0], mesh.radii[1], 'intrinsic aspect is always circular'); checkPlanarFront(mesh);
      near(mesh.tubeRadius / (Math.min(...eyes.size) * .065 * mesh.fit), 1.3, 'frame tubes are exactly 30% thicker');
      assert.deepEqual(mesh.lenses[0].normal, [0, 0, 1], 'neutral front uses the stable body XY plane');
      for (const [i, side] of ['left', 'right'].entries()) {
        near(mesh.centers[i][0], eyes[side].localCenter[0], `${shape} fitted x`); near(mesh.centers[i][1], eyes[side].localCenter[1], `${shape} fitted y`);
      }
      for (const rotation of [[0, 0, 0], [.4, .8, -.2], [0, Math.PI / 2, 0], [0, Math.PI, 0]]) {
        const root = transform([.1, -.2, .3], rotation), projected = projectEyes(design, root, [0, 0], [0, 0], squash);
        assert.deepEqual(glassesGeometry(design, accessory, projected, squash).vertices, mesh.vertices, `${shape}: camera must not deform the lenses`);
        assert.ok(viewPoint(root, [...mesh.centers[0], 0]).every(Number.isFinite));
      }
    }
  }
});

test('all rigid default rims and connectors clear the actual rounded body, including triangle interiors', () => {
  for (const shape of MATERIAL_SHAPE_NAMES) {
    const design = createDesign({ body: { shape } }), contour = shapeContour({ kind: 'material', name: shape }), profile = resolveShapeProfile(shape);
    const mesh = glassesGeometry(design, createAccessory('glasses'), eyeFrame(design)), bounds = clearanceBounds(mesh, contour, profile);
    assert.ok(bounds.minimum > .005, `${shape}: rendered-body penetration ${JSON.stringify(bounds)}`);
    assert.ok(bounds.analyticMinimum > .004, `${shape}: tessellation clearance ${JSON.stringify(bounds)}`);
    assert.ok(bounds.maximum < .20, `${shape}: unexpected rigid-frame stand-off ${JSON.stringify(bounds)}`);
  }
});

test('thin/deep and squashed bodies retain rigid lens shape and exact conservative mesh clearance', () => {
  for (const shape of MATERIAL_SHAPE_NAMES) {
    const design = createDesign({ body: { shape } }), contour = shapeContour({ kind: 'material', name: shape });
    for (const depth of [.08, 1.2]) for (const squash of [.88, 1.12]) {
      const profile = structuredClone(resolveShapeProfile(shape)); profile.depth = depth;
      const eyes = eyeFrame(design, contour, profile, squash), mesh = glassesGeometry(design, createAccessory('glasses'), eyes, squash, contour, profile);
      checkPlanarFront(mesh);
      const bounds = clearanceBounds(mesh, contour, profile, squash);
      assert.ok(bounds.minimum > 0 && bounds.analyticMinimum > 0, `${shape} depth=${depth} squash=${squash}: ${JSON.stringify(bounds)}`);
    }
  }
});

test('spacing moves whole lenses and changes the bridge while size scales each circle uniformly', () => {
  const design = createDesign(), accessory = createAccessory('glasses'), eyes = eyeFrame(design), initial = glassesGeometry(design, accessory, eyes);
  const wider = structuredClone(eyes); wider.left.localCenter[0] -= .04; wider.right.localCenter[0] += .04;
  const spaced = glassesGeometry(design, accessory, wider);
  assert.deepEqual(spaced.radii, initial.radii); assert.equal(spaced.tubeRadius, initial.tubeRadius);
  near(spaced.centers[1][0] - spaced.centers[0][0], initial.centers[1][0] - initial.centers[0][0] + .08, 'spacing changes lens separation only');
  const larger = structuredClone(eyes); larger.size = eyes.size.map(v => v * 1.2);
  const scaled = glassesGeometry(design, accessory, larger);
  near(scaled.radii[0] / initial.radii[0], 1.2, 'uniform radius scale'); near(scaled.tubeRadius / initial.tubeRadius, 1.2, 'uniform tube scale');
  assert.deepEqual(scaled.centers, initial.centers); checkPlanarFront(spaced); checkPlanarFront(scaled);
});

test('internal per-shape fitting moves and rotates whole lenses without reviving legacy public controls', () => {
  const design = createDesign(), accessory = createAccessory('glasses'), eyes = eyeFrame(design), initial = glassesGeometry(design, accessory, eyes), profile = structuredClone(resolveShapeProfile('square'));
  accessory.anchor.offset = .2; profile.mounts.face.offset = .2;
  assert.deepEqual(glassesGeometry(design, accessory, eyes, 1, undefined, profile).vertices, initial.vertices, 'legacy calibration is not active');
  profile.accessories.glasses.anchor.offset = .035;
  const raised = glassesGeometry(design, accessory, eyes, 1, undefined, profile);
  for (const lens of raised.lenses) {
    const base = initial.lenses[raised.lenses.indexOf(lens)];
    near(lens.center[2] - base.center[2], .035, 'curated rigid stand-off adds once');
  }
  profile.accessories.glasses.rotation = [.15, -.2, .3];
  profile.accessories.glasses.anchor.uv = [.08, .18];
  const tilted = glassesGeometry(design, accessory, eyes, 1, undefined, profile);
  checkPlanarFront(tilted); assert.notDeepEqual(tilted.vertices, initial.vertices);
  for (const axis of [0, 1]) assert.ok(tilted.centers[0][axis] + tilted.centers[1][axis] > initial.centers[0][axis] + initial.centers[1][axis], 'calibration moves the whole-frame midpoint');
  assert.ok(clearanceBounds(tilted, shapeContour({kind:'material',name:'square'}), profile).minimum > 0);
});

test('rigid frames preserve interrupted contour/depth/orientation snapshots and epsilon continuity', async () => {
  for (const [from, to, next] of [['softBoom', 'pixelTriangle', 'heart'], ['heart', 'puffy', 'clover4Leaf']]) {
    const design = createDesign({body:{shape:to}}), accessory = createAccessory('glasses'), timeline = new ShapeTimeline(from);
    const sample = () => glassesGeometry(design, accessory, eyeFrame(design, timeline.contour, timeline.profile), 1, timeline.contour, timeline.profile);
    const pending = timeline.to(to, {duration:1000,easing:'linear'}); timeline.advance(280.2);
    const before = sample(), snapshot = timeline.snapshot, nextMotion = timeline.to(next, {duration:719.8,easing:'linear'});
    assert.deepEqual(await pending,{finished:false}); assert.strictEqual(timeline.snapshot,snapshot); assert.deepEqual(sample(),before);
    let previous=before;
    for(let i=0;i<32;i++) {
      timeline.advance(719.8/32);const mesh=sample();checkPlanarFront(mesh);checkOpenings(mesh,design,eyeFrame(design,timeline.contour,timeline.profile),`${from} to ${next} frame ${i}`);
      assert.equal(mesh.vertices.length,before.vertices.length,'fixed rigid lens/connector topology');
      let maximum=0;for(let j=0;j<mesh.vertices.length;j+=6)maximum=Math.max(maximum,Math.hypot(...[0,1,2].map(k=>mesh.vertices[j+k]-previous.vertices[j+k])));
      assert.ok(maximum<.06,`interrupted frame jumped ${maximum}`);
      const bounds=clearanceBounds(mesh,timeline.contour,timeline.profile,1,i%8===0);
      assert.ok(bounds.minimum>0&&bounds.analyticMinimum>0,`morph frame penetration ${JSON.stringify(bounds)}`);previous=mesh;
    }
    timeline.finish();assert.deepEqual(await nextMotion,{finished:true});
  }
});

test('renderer retains zero-gaze equipment, fixed resources and exact circular expression math', () => {
  const source=readFileSync(new URL('../src/renderer/webgl.ts',import.meta.url),'utf8');
  assert.match(source,/projectEyes\(design, root, pose\.face, \[0, 0\]/);assert.match(source,/glassesGeometry\(design, accessory, frameEyes/);
  assert.doesNotMatch(source,/Math\.sin\(design\.eyes\.spacing|this\.meshes\.ring|\[side \* spacing, 0, 0\.10\]/);
  assert.match(source,/curveDistance\(p, halfSpan, happy \* open\) - radius/);assert.match(source,/deleteBuffer\(mesh\.buffer\).*deleteBuffer\(mesh\.index\)/);
  assert.ok(GLASSES_CLEARANCE<.01);assert.equal(GLASSES_SHOULDER,0);
});

test('all 35 thicker rigid frames preserve a positive bridge gap and contain the full eye envelope', () => {
  near(GLASSES_TUBE_SCALE / .065, 1.3, 'tube thickness increase');
  for (const shape of MATERIAL_SHAPE_NAMES) for (const squash of [.88, 1, 1.12]) {
    const design = createDesign({ body: { shape } }), eyes = eyeFrame(design, undefined, undefined, squash);
    const mesh = glassesGeometry(design, createAccessory('glasses'), eyes, squash);
    checkOpenings(mesh, design, eyes, `${shape} squash=${squash}`);
  }
});

test('transient rotation moves the entire front rigidly about the midpoint', () => {
  const design = createDesign({ body: { shape: 'slanted' } }), accessory = createAccessory('glasses');
  const eyes = eyeFrame(design), base = glassesGeometry(design, accessory, eyes), rotation = [.25, -.4, .32];
  const rotated = glassesGeometry(design, accessory, eyes, 1, undefined, undefined, rotation), orientation = transform([0, 0, 0], rotation);
  checkPlanarFront(rotated);
  const midpoint = mesh => [0, 1, 2].map(k => (mesh.lenses[0].center[k] + mesh.lenses[1].center[k]) / 2);
  const before = midpoint(base), after = midpoint(rotated);
  near(before[0], after[0], 'whole-front rotation pivot x'); near(before[1], after[1], 'whole-front rotation pivot y');
  for (let i = 0; i < base.vertices.length; i += 6) {
    const relative = [0, 1, 2].map(k => base.vertices[i + k] - before[k]), expected = viewPoint(orientation, relative);
    for (let k = 0; k < 3; k++) near(rotated.vertices[i + k] - after[k], expected[k], 'one rigid transform for every rim and bridge vertex', 9e-8);
  }
  assert.ok(clearanceBounds(rotated, shapeContour({ kind: 'material', name: 'slanted' }), resolveShapeProfile('slanted')).minimum > 0);
});

test('eye surface depths and expression weights cannot bend the front', () => {
  const design = createDesign({ body: { shape: 'heart' } }), accessory = createAccessory('glasses');
  const eyes = eyeFrame(design), base = glassesGeometry(design, accessory, eyes), differentDepths = structuredClone(eyes);
  differentDepths.left.localCenter[2] -= .3; differentDepths.right.localCenter[2] += .4;
  assert.deepEqual(glassesGeometry(design, accessory, differentDepths).vertices, base.vertices, 'ignore per-lens surface depth');
  design.eyes.left.weights = { smile: 1, blink: .2 }; design.eyes.right.weights = { smile: .3, blink: 1 };
  assert.deepEqual(glassesGeometry(design, accessory, eyeFrame(design)).vertices, base.vertices, 'expression weights do not alter frame geometry');
});


test('sunglasses reuse the rigid coplanar glasses front and add two opaque parallel inserts on all shapes', () => {
  for (const shape of MATERIAL_SHAPE_NAMES) for (const squash of [.88,1,1.12]) {
    const design = createDesign({body:{shape}}), contour = shapeContour({kind:'material',name:shape}), profile = resolveShapeProfile(shape), eyes = eyeFrame(design,contour,profile,squash);
    const accessory = createAccessory('sunglasses'), mesh = glassesGeometry(design,accessory,eyes,squash,contour,profile);
    checkRigidLenses(mesh);
    assert.equal(mesh.frameIndexCount + mesh.fillIndexCount,mesh.indices.length); assert.equal(mesh.fillIndexCount,64*12*2);
    const [left,right] = mesh.lenses;
    assert.deepEqual(left.normal,right.normal);
    near(left.normal.reduce((sum,v,i)=>sum+v*(left.center[i]-right.center[i]),0),0,'complete frame shares plane');
    assert.ok(clearanceBounds(mesh,contour,profile,squash).minimum>0,`${shape}: lens fill clearance`);
    const start = mesh.bridge.vertexStart + mesh.bridge.vertexCount, count=65;
    for(let side=0;side<2;side++) for(let face=0;face<2;face++) for(let i=0;i<count;i++) {
      const lens=mesh.lenses[side], at=(start+side*count*2+face*count+i)*6;
      near(lens.normal.reduce((sum,v,k)=>sum+v*(mesh.vertices[at+k]-lens.center[k]),0),(face ? 1 : -1)*mesh.tubeRadius*.42,'flat filled lens',1e-7);
    }
  }
});
