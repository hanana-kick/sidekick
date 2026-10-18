import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MATERIAL_SHAPE_NAMES, createDesign as publicDesign, createAccessory as publicAccessory } from '../dist/src/core/design.js';
import { createResolvedFixture as createDesign, createResolvedAccessory as createAccessory } from './internal-fixtures.mjs';
import { resolveShapeProfile } from '../dist/src/core/shape-profiles.js';
import { shapeContour } from '../dist/src/core/contours.js';
import { ShapeTimeline } from '../dist/src/core/shape-motion.js';
import { bodyGeometry } from '../dist/src/renderer/body-geometry.js';
import { beretGeometry, beretBandColor } from '../dist/src/renderer/beret-geometry.js';
import { AvatarRenderer } from '../dist/src/renderer/webgl.js';
import './helpers/geometry/intersections.test.mjs';
import { triangles, intersections, sub, dot, cross } from './helpers/geometry/intersections.mjs';
import { initialPose, activityFrame } from '../dist/src/core/motion.js';
import { recordGL } from '../scripts/beret-qa/recorder.mjs';

const near = (a, b, message, tolerance = 2e-6) => assert.ok(Math.abs(a - b) <= tolerance, `${message}: ${a} vs ${b}`);
const point = (mesh, index) => Array.from(mesh.vertices.subarray(index * 6, index * 6 + 3));
// One meridian runs from the cavity ceiling through its wall and rolled opening,
// up the exterior band/crown, and into the closed stem. Only both poles are singletons.
const SEGMENTS = 64, RINGS = 31, BASE_VERTEX_COUNT = (RINGS - 2) * SEGMENTS + 2, VERTEX_COUNT = BASE_VERTEX_COUNT + 3 * SEGMENTS;
const ringStart = ring => ring === 0 ? 0 : ring === RINGS - 1 ? BASE_VERTEX_COUNT - 1 : 1 + (ring - 1) * SEGMENTS;
const ringPoints = (mesh, ring) => Array.from({ length: SEGMENTS }, (_, j) => point(mesh, ringStart(ring) + j));
const wearTilt = shape => resolveShapeProfile(shape).beretFitTilt;
const unsquash = (p, squash) => [p[0] * Math.sqrt(squash), p[1] / squash, p[2] * Math.sqrt(squash)];


// Independent XY queries against the production front triangles. This does not
// use the beret's rotated support axis, lower shell grid or intersection solver.
function frontEnvelope(contour) {
  const mesh = bodyGeometry(contour), { vertices: v, indices } = mesh, buckets = new Map(), cell = 24;
  for (let i = 0; i < indices.length; i += 6) {
    const t = [indices[i], indices[i + 1], indices[i + 2]].map(j => j * 6);
    const xs = t.map(j => v[j]), ys = t.map(j => v[j + 1]);
    for (let x = Math.floor(Math.min(...xs) * cell); x <= Math.floor(Math.max(...xs) * cell); x++) for (let y = Math.floor(Math.min(...ys) * cell); y <= Math.floor(Math.max(...ys) * cell); y++) {
      const key = `${x},${y}`, list = buckets.get(key) ?? []; list.push(t); buckets.set(key, list);
    }
  }
  return (x, y) => {
    let height = -Infinity;
    for (const [a, b, c] of buckets.get(`${Math.floor(x * cell)},${Math.floor(y * cell)}`) ?? []) {
      const determinant = (v[b + 1] - v[c + 1]) * (v[a] - v[c]) + (v[c] - v[b]) * (v[a + 1] - v[c + 1]);
      const wa = ((v[b + 1] - v[c + 1]) * (x - v[c]) + (v[c] - v[b]) * (y - v[c + 1])) / determinant;
      const wb = ((v[c + 1] - v[a + 1]) * (x - v[c]) + (v[a] - v[c]) * (y - v[c + 1])) / determinant;
      const wc = 1 - wa - wb;
      if (wa >= -1e-8 && wb >= -1e-8 && wc >= -1e-8) height = Math.max(height, wa * v[a + 2] + wb * v[b + 2] + wc * v[c + 2]);
    }
    return height;
  };
}
function assertClear(mesh, contour, profile, squash = 1, label = '') {
  const front = frontEnvelope(contour), stretch = 1 / Math.sqrt(squash), sx = .59 * stretch, sy = .59 * squash, sz = profile.depth * .5 * stretch;
  let minimum = Infinity;
  const check = p => { const h = front(p[0] / sx, p[1] / sy) * sz; minimum = Math.min(minimum, Math.abs(p[2]) - h); };
  for (let i = 0; i < mesh.vertices.length / 6; i++) check(point(mesh, i));
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const p = [mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]].map(j => point(mesh, j));
    for (const weights of [[1 / 3, 1 / 3, 1 / 3], [.5, .5, 0], [0, .5, .5], [.5, 0, .5]]) check([0, 1, 2].map(k => p.reduce((sum, v, j) => sum + weights[j] * v[k], 0)));
  }
  assert.ok(minimum >= -2e-6, `${label}: beret shell penetrated actual body mesh by ${-minimum}`);
}

test('worn beret has bounded geometry, independent cuff material and finite unit normals', () => {
  const mesh = beretGeometry(createDesign().body, createAccessory('beret'));
  assert.ok(mesh.vertices.length / 6 < 2500 && mesh.indices.length / 3 > 1500);
  assert.equal(mesh.bandIndexCount + mesh.crownIndexCount, mesh.indices.length);
  assert.ok(mesh.bandIndexCount > 0 && mesh.crownIndexCount > 0);
  assert.ok(mesh.vertices.every(Number.isFinite));
  for (let i = 0; i < mesh.vertices.length; i += 6) near(Math.hypot(...mesh.vertices.subarray(i + 3, i + 6)), 1, 'unit normal');
  assert.equal(beretBandColor('#b84742'), '#843330');
});

test('all 35 berets keep a compact inclined wearing region and connected cuff', () => {
  for (const shape of MATERIAL_SHAPE_NAMES) for (const squash of [.88, 1, 1.12]) {
    const body = createDesign({body:{shape}}).body, contour = shapeContour({kind:'material',name:shape}), profile = resolveShapeProfile(shape);
    const mesh = beretGeometry(body, createAccessory('beret'), squash, contour, profile);
    const top = Math.max(...contour.points.map(p => p[1])) * .59 * squash;
    const bottom = Math.min(...contour.points.map(p => p[1])) * .59 * squash;
    const width = (Math.max(...contour.points.map(p=>p[0])) - Math.min(...contour.points.map(p=>p[0]))) * .59 / Math.sqrt(squash);
    const cuff = ringPoints(mesh, 7);
    const points = Array.from({length:mesh.vertices.length/6}, (_, i)=>point(mesh,i));
    assert.ok(Math.min(...cuff.map(p=>p[1])) < top - (top-bottom)*.04, shape + ': support enters opening');
    assert.ok(Math.max(...points.map(p=>p[1])) > top-.06*squash, shape + ': crown reaches selected upper support');
    assert.ok(mesh.vertices.every(Number.isFinite), shape);
    assert.equal(mesh.contactResolved, true, shape + ': exact cloth/body surface guard');
    assert.ok(mesh.contactCorrection <= .006, shape + ': only a local clearance correction');
    const span = Math.max(...points.map(p=>p[0])) - Math.min(...points.map(p=>p[0]));
    assert.ok(span < width*.91, shape + ': no oversized full-head cap');
    assert.ok(span > width*.25, shape + ': visible intentional garment');
    // Depth is support-local: a rounded tip can seat naturally with less than
    // .04 insertion. Actual opening/silhouette overlap is checked above, and
    // the independent triangle/body and cavity checks below prohibit false seats.
    assert.ok(Number.isFinite(mesh.seating) && mesh.seating <= 0, shape + ': nonfloating support contact');
    const up = [-Math.sin(wearTilt(shape)), Math.cos(wearTilt(shape)), 0];
    const rim = ringPoints(mesh, 8).map(p => unsquash(p, squash));
    const rimHeight = rim.reduce((sum, p) => sum + dot(p, up), 0) / SEGMENTS;
    const actualBody = bodyGeometry(contour);
    let supportHeight = -Infinity;
    for (let i = 0; i < actualBody.vertices.length / 6; i++) {
      const p = point(actualBody, i).map((value, k) => value * [ .59, .59, profile.depth * .5 ][k]);
      supportHeight = Math.max(supportHeight, dot(p, up));
    }
    assert.ok(supportHeight >= rimHeight - 2e-6, shape + ': actual head reaches the open cavity plane');
    assert.ok(Math.max(...cuff.map(p=>p[1]))-Math.min(...cuff.map(p=>p[1])) > .015, shape + ': inclined asymmetric hem');
    for (let i=0;i<64;i++) {
      const cuffTop=point(mesh,ringStart(11)+i), crownBottom=point(mesh,ringStart(12)+i);
      assert.ok(Math.hypot(...cuffTop.map((v,k)=>v-crownBottom[k])) < .15, shape + ': joined cuff/crown');
    }
  }
});

test('felt deformation stays near heart proportions while flexing to local support', () => {
  const reference=beretGeometry(createDesign({body:{shape:'heart'}}).body,createAccessory('beret'));
  const pairs=[];
  const count=VERTEX_COUNT; // Both surfaces share one bounded deformation field.
  for(let i=0;i<count;i+=11) for(const offset of [1,17,64,197]) pairs.push([i,(i+offset)%count]);
  const distance=(mesh,a,b)=>Math.hypot(...[0,1,2].map(k=>mesh.vertices[a*6+k]-mesh.vertices[b*6+k]));
  const expected=pairs.map(([a,b])=>distance(reference,a,b));
  for(const shape of MATERIAL_SHAPE_NAMES)for(const squash of [.88,1,1.12]){
    const mesh=beretGeometry(createDesign({body:{shape}}).body,createAccessory('beret'),squash);
    assert.deepEqual(mesh.indices,reference.indices);
    for(let i=0;i<pairs.length;i++){
      const delta=distance(mesh,...pairs[i])-expected[i];
      assert.ok(delta>=-.141&&delta<=.141,shape+' bounded local felt deformation '+i+': '+delta);
    }
    // Pairwise distance can grow when two compressed sectors move apart.
    // Bound each actual displacement in the wearing frame instead of mistaking
    // that local compression for global hat scaling.
    const tilt=wearTilt(shape);
    const local=(m,i,t,q=1)=>{const p=unsquash(point(m,i),q),a=unsquash(point(m,BASE_VERTEX_COUNT-1),q),x=p[0]-a[0],y=p[1]-a[1];return[Math.cos(t)*x+Math.sin(t)*y,-Math.sin(t)*x+Math.cos(t)*y,p[2]-a[2]];};
    // Approved PixelTriangle sag measures .12735 in this frame; retain a
    // tight .13 local bound alongside the unchanged 15% envelope limits.
    for(let i=ringStart(12);i<BASE_VERTEX_COUNT;i++){const a=local(mesh,i,tilt,squash),b=local(reference,i,wearTilt('heart'));assert.ok(Math.hypot(...a.map((v,k)=>v-b[k]))<=.13,shape+' bounded per-vertex felt displacement '+i);}
    // A draped lip may move locally while the recognizable garment keeps its
    // intrinsic proportions. Measure the full wearing-frame envelope, removing
    // body squash and placement so pose cannot disguise global enlargement.
    const actualPoints=Array.from({length:count},(_,i)=>local(mesh,i,tilt,squash));
    const referencePoints=Array.from({length:count},(_,i)=>local(reference,i,wearTilt('heart')));
    for(let k=0;k<3;k++){
      const span=ps=>Math.max(...ps.map(p=>p[k]))-Math.min(...ps.map(p=>p[k]));
      const ratio=span(actualPoints)/span(referencePoints);
      assert.ok(ratio>=.85&&ratio<=1.15,shape+' intrinsic garment proportion '+k+': '+ratio);
    }
    if(shape==='circle'&&squash===1)assert.ok(pairs.some(([a,b],i)=>Math.abs(distance(mesh,a,b)-expected[i])>.005),'cuff actually flexes; rigid pose alone is insufficient');
  }
});

test('heart beret embraces the right lobe and preserves the opposite lobe', () => {
  const mesh=beretGeometry(createDesign({body:{shape:'heart'}}).body,createAccessory('beret'));
  const cuff=ringPoints(mesh,7);
  assert.ok(Math.min(...cuff.map(p=>p[0])) > 0);
  assert.ok(Math.max(...cuff.map(p=>p[0])) > .3);
  assert.ok(Math.min(...cuff.map(p=>p[1])) < .38);
  assert.ok(mesh.seating <= -.04, 'heart lobe keeps meaningful insertion into its cavity');
});

test('obsolete arbitrary placement cannot pull fitted garment off the body', () => {
  const body=createDesign().body, accessory=createAccessory('beret'), baseline=beretGeometry(body,accessory);
  accessory.anchor.offset=.2; accessory.scale=1.3;
  assert.deepEqual(beretGeometry(body,accessory),baseline);
});

test('explicit accessory rotation animates the fitted beret without changing topology', () => {
  const body=createDesign().body,accessory=createAccessory('beret');
  const base=beretGeometry(body,accessory), rotated=beretGeometry(body,accessory,1,undefined,undefined,[.1,.2,.3]);
  assert.notDeepEqual(base.vertices,rotated.vertices);assert.deepEqual(base.indices,rotated.indices);
  assert.ok(rotated.vertices.every(Number.isFinite));
});

test('displayed beret tilt and center invalidate the geometry fit cache independently', () => {
  const body = createDesign({ body: { shape: 'square' } }).body, accessory = createAccessory('beret');
  const contour = shapeContour({ kind: 'material', name: 'square' }), profile = structuredClone(resolveShapeProfile('square'));
  const baseline = beretGeometry(body, accessory, 1, contour, profile);
  for (const mutate of [p => { p.beretFitTilt += .01; }, p => { p.beretFitCenter[0] += .01; }, p => { p.beretFitCenter[1] += .003; }, p => { p.beretFitRoom += .1; }]) {
    const changed = structuredClone(profile); mutate(changed);
    const fitted = beretGeometry(body, accessory, 1, contour, changed);
    assert.notDeepEqual(fitted.vertices, baseline.vertices, 'displayed calibration affects the fitted geometry');
    assert.deepEqual(fitted.indices, baseline.indices);
    assert.deepEqual(beretGeometry(body, accessory, 1, contour, profile), baseline, 'later fits preserve cached neutral geometry');
  }
});

test('cavity room starts continuously without changing shell topology', () => {
  for (const shape of ['square','heart','flower','pixelTriangle']) {
    const contour=shapeContour({kind:'material',name:shape}),profile=structuredClone(resolveShapeProfile(shape));
    profile.beretFitRoom=0;
    const body=createDesign({body:{shape}}).body,accessory=createAccessory('beret');
    const before=beretGeometry(body,accessory,1,contour,profile);
    profile.beretFitRoom=1e-10;
    const after=beretGeometry(body,accessory,1,contour,profile);
    assert.deepEqual(after.indices,before.indices);
    let maximum=0;
    for(let i=0;i<VERTEX_COUNT;i++)maximum=Math.max(maximum,Math.hypot(...sub(point(after,i),point(before,i))));
    assert.ok(maximum<1e-6,shape+': cavity room epsilon displacement '+maximum);
  }
});

test('beret preserves its displayed fit when the runtime target design changes during interrupted morphs', async () => {
  const cases = [
    ['softBoom', 'pixelTriangle', 'heart', 280.2],
    ['heart', 'puffy', 'softBoom', 413],
    ['square', 'triangle', 'cookie6Sided', 413],
    ['cookie6Sided', 'heart', 'square', 280.2],
    ['flower', 'triangle', 'square', 1000 * 35 / 60],
    ['heart', 'boom', 'pixelTriangle', 1000 * 35 / 60],
    ['clover8Leaf', 'heart', 'circle', 1000 * 35 / 60],
  ];
  for (const [from, to, next, interruption] of cases) for (const easing of ['linear', 'smooth']) {
    const timeline = new ShapeTimeline(from), accessory = createAccessory('beret');
    let body = createDesign({ body: { shape: from } }).body;
    const sample = () => beretGeometry(body, accessory, 1, timeline.contour, timeline.profile);
    const initial = sample();
    // The runtime persists the requested catalog target immediately, while the
    // displayed contour/profile continue from their previous visible snapshot.
    body = createDesign({ body: { shape: to } }).body;
    const pending = timeline.to(to, { duration: 1000, easing });
    assert.deepEqual(sample(), initial, `${from}/${to}: target change at morph start`);
    timeline.advance(interruption);
    const before = sample(), visible = timeline.snapshot;
    body = createDesign({ body: { shape: next } }).body;
    let retarget = timeline.to(next, { duration: 700, easing });
    assert.deepEqual(await pending, { finished: false });
    assert.strictEqual(timeline.snapshot, visible, 'retarget preserves the displayed snapshot');
    assert.deepEqual(sample(), before, `${from}/${to}/${next}: no target-design pose jump`);
    timeline.advance(0);
    assert.deepEqual(sample(), before, 'zero elapsed time must preserve exact geometry');
    timeline.advance(.00001);
    const epsilon = sample();
    let maximum = 0;
    for (let i = 0; i < VERTEX_COUNT; i++) maximum = Math.max(maximum, Math.hypot(...sub(point(epsilon, i), point(before, i))));
    assert.ok(maximum < .0001, `${from}/${to}/${next}/${easing}: epsilon retarget displacement ${maximum}`);
    assert.deepEqual(epsilon.indices, before.indices);
    for (let i = 0; i < 20; i++) {
      timeline.advance(35);
      const mesh = sample();
      assert.ok(mesh.vertices.every(Number.isFinite));
      assert.deepEqual(mesh.indices, before.indices);
      assert.ok(mesh.crownIndexCount > 0);
      if (i === 9) {
        const repeatedSnapshot = timeline.snapshot, interrupted = retarget;
        retarget = timeline.to(next, { duration: 350, easing });
        assert.deepEqual(await interrupted, { finished: false });
        assert.strictEqual(timeline.snapshot, repeatedSnapshot);
        assert.deepEqual(sample(), mesh, `${next}: repeated target preserves the displayed fit`);
      }
    }
    timeline.finish();
    assert.deepEqual(await retarget, { finished: true });
    assert.deepEqual(sample(), beretGeometry(body, accessory), `${next}: exact final catalog fit`);
  }
});

test('ordinary 60fps idle morph frames keep bounded motion through the reported retarget paths', async () => {
  for (const [from, to, next] of [['flower', 'triangle', 'square'], ['heart', 'boom', 'pixelTriangle'], ['clover8Leaf', 'heart', 'circle']]) {
    const timeline = new ShapeTimeline(from), accessory = createAccessory('beret');
    let body = createDesign({ body: { shape: to } }).body;
    let pending = timeline.to(to, { duration: 1000, easing: 'linear' }), previous;
    for (let frame = 0; frame <= 120; frame++) {
      if (frame === 36) {
        const interrupted = pending;
        pending = timeline.to(next, { duration: 1000, easing: 'linear' });
        body = createDesign({ body: { shape: next } }).body;
        assert.deepEqual(await interrupted, { finished: false });
      }
      if (frame) timeline.advance(1000 / 60);
      const squash = activityFrame('idle', frame / 60, false).squash;
      const mesh = beretGeometry(body, accessory, squash, timeline.contour, timeline.profile);
      if (previous) {
        let maximum = 0;
        for (let i = 0; i < VERTEX_COUNT; i++) maximum = Math.max(maximum, Math.hypot(...sub(point(mesh, i), point(previous, i))));
        // Former support migration moved the whole hat .096/.111 per frame;
        // the target-design switch itself caused a separate .473 teleport.
        // The reviewed hollow-seat transition settles over several frames.
        // The final three Heart→Boom→Pixel recovery frames deliberately restore
        // curl quickly (observed .05967 raw / .06008 world), with continuous
        // supported silhouettes in the native review. Keep that exception local.
        const bound = from === 'heart' && frame >= 93 && frame <= 95 ? .065 : .05;
        assert.ok(maximum < bound, `${from}/${to}/${next}: frame ${frame} moved ${maximum}`);
        assert.deepEqual(mesh.indices, previous.indices);
      }
      previous = mesh;
    }
    timeline.finish();
    assert.deepEqual(await pending, { finished: true });
  }
});

// Match the production QA turn: all three body and accessory axes move together,
// while the normal idle activity supplies its independent breathing squash.
function jointAxisTurn(frame, accessoryId) {
  const time = frame / 30, pose = initialPose();
  pose.rotation = [Math.sin(time * 2) * .25, Math.sin(time) * .4, Math.sin(time * .7) * .15];
  const rotation = [Math.sin(time * 2) * .10, Math.sin(time * 1.3) * .10, Math.sin(time * .7) * .10];
  pose.accessories[accessoryId] = rotation;
  return { time, pose, rotation, squash: activityFrame('idle', time, false).squash };
}

test('Boom keeps its insertion through the reported joint-axis turn at frames 60 and 61', () => {
  const body = createDesign({ body: { shape: 'boom' } }).body, accessory = createAccessory('beret');
  const meshes = [60, 61].map(frame => {
    const { squash, rotation } = jointAxisTurn(frame, accessory.id);
    return beretGeometry(body, accessory, squash, undefined, undefined, rotation);
  });
  let maximum = 0;
  for (let i = 0; i < VERTEX_COUNT; i++) maximum = Math.max(maximum, Math.hypot(...sub(point(meshes[1], i), point(meshes[0], i))));
  // The previous rotating-frame anchor lost .063 of insertion and moved a
  // vertex .064 in one frame. Reprojecting its body support removes that snap.
  assert.ok(maximum < .005, `Boom 60→61: vertex movement ${maximum}`);
  assert.ok(Math.abs(meshes[1].seating - meshes[0].seating) < .005, 'Boom 60→61: no sudden loss of insertion');
  assert.ok(meshes.every(mesh => mesh.seating < 0 && mesh.vertices.every(Number.isFinite)));
  assert.deepEqual(meshes[1].indices, meshes[0].indices);
});

test('joint-axis turn neighborhoods do not switch between distant feasible insertion depths', () => {
  for (const [shape, start] of [['boom', 0], ['boom', 60], ['boom', 77], ['boom', 144], ['boom', 145], ['pentagon', 49]]) {
    const body = createDesign({ body: { shape } }).body, accessory = createAccessory('beret');
    let previous;
    for (let subframe = 0; subframe <= 100; subframe++) {
      const frame = start + subframe / 100, { squash, rotation } = jointAxisTurn(frame, accessory.id);
      const mesh = beretGeometry(body, accessory, squash, undefined, undefined, rotation);
      if (previous) {
        let maximum = 0;
        for (let i = 0; i < VERTEX_COUNT; i++) maximum = Math.max(maximum, Math.hypot(...sub(point(mesh, i), point(previous, i))));
        // A cylindrical virtual cavity previously allowed a .02 insertion jump
        // at an infinitesimal turn. Permit the ~.000142 depth-search quantum,
        // while rejecting even a small recurrence of the disconnected solution.
        assert.ok(maximum < .0005, `${shape} near frame ${frame}: subframe movement ${maximum}`);
        assert.ok(Math.abs(mesh.seating - previous.seating) < .0003, `${shape} near frame ${frame}: insertion branch jump`);
      }
      previous = mesh;
    }
  }
});

test('Pentagon keeps its fit across historical short-interval joint-axis turn branches', () => {
  const body = createDesign({ body: { shape: 'pentagon' } }).body, accessory = createAccessory('beret');
  // The first pair exposed a .00342 non-nested cavity-fit jump. The second
  // exposed a .00980 radial-field jump despite only one depth-search quantum.
  for (const times of [[1.6468, 1.6468333333333334], [1.6617666666666668, 1.6618000000000002]]) {
    const meshes = times.map(time => {
      const { squash, rotation } = jointAxisTurn(time * 30, accessory.id);
      return beretGeometry(body, accessory, squash, undefined, undefined, rotation);
    });
    let maximum = 0;
    for (let i = 0; i < VERTEX_COUNT; i++) maximum = Math.max(maximum, Math.hypot(...sub(point(meshes[1], i), point(meshes[0], i))));
    assert.ok(maximum < .0005, `Pentagon at ${times[1]}s: vertex movement ${maximum}`);
    assert.ok(Math.abs(meshes[1].seating - meshes[0].seating) < .0003, `Pentagon at ${times[1]}s: insertion branch jump`);
  }
});

test('complete 181-frame joint-axis turns retain bounded runtime beret motion', () => {
  for (const shape of ['boom', 'pentagon', 'cookie6Sided']) {
    const captured = recordGL(), renderer = new AvatarRenderer({ width: 192, height: 192, getContext: () => captured.gl });
    const design = publicDesign({ body: { shape }, accessories: [publicAccessory('beret')] });
    let previous, previousIndices;
    try {
      for (let frame = 0; frame <= 180; frame++) {
        const { time, pose } = jointAxisTurn(frame, design.accessories[0].id);
        renderer.render(design, {
          pose, eyeMotion: { left: false, right: false }, activity: 'idle', time, delta: 1 / 30,
          reduced: false, style: 'flat', view: [0, 0], camera: { yaw: 0, pitch: -30, roll: 0 },
        });
        assert.equal(captured.draws.length, 3, `${shape}/${frame}: body, cuff and crown render`);
        const draw = captured.draws[1], crown = captured.draws[2];
        const vertices = new Float32Array(draw.vertices.buffer, draw.vertices.byteOffset, draw.vertices.length / 4);
        assert.equal(vertices.length, VERTEX_COUNT * 6);
        assert.ok(vertices.every(Number.isFinite), `${shape}/${frame}: finite positions and normals`);
        assert.deepEqual(crown.vertices, draw.vertices, `${shape}/${frame}: one shared garment mesh`);
        const indices = Buffer.concat([draw.indices, crown.indices]);
        if (previous) {
          let maximum = 0;
          for (let i = 0; i < vertices.length; i += 6) maximum = Math.max(maximum, Math.hypot(vertices[i] - previous[i], vertices[i + 1] - previous[i + 1], vertices[i + 2] - previous[i + 2]));
          // Measure the actual uploaded mesh in body-local space. The moving
          // root model adds the intended body turn and must not mask fit jumps.
          // The reviewed soft-contact Boom turn peaks at .01231 per 30 Hz frame.
          // Fine-substep tests above independently reject discontinuous branches.
          assert.ok(maximum < .015, `${shape}: frame ${frame} moved ${maximum}, limit .015`);
          if (shape === 'boom' && frame === 61) assert.ok(maximum < .005, `Boom runtime 60→61: ${maximum}`);
          assert.deepEqual(indices, previousIndices, `${shape}/${frame}: stable garment topology`);
        }
        previous = new Float32Array(vertices);
        previousIndices = indices;
      }
    } finally {
      renderer.dispose();
    }
  }
});

function mockGL() {
  let id = 0, updates = 0; const buffers = new Set(), vaos = new Set(), draws = [];
  const noOp = () => {};
  const gl = { VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, ELEMENT_ARRAY_BUFFER: 6, DYNAMIC_DRAW: 7, STATIC_DRAW: 8, FLOAT: 9, TRIANGLES: 10, UNSIGNED_SHORT: 11, DEPTH_TEST: 12, CULL_FACE: 13, BACK: 14, COLOR_BUFFER_BIT: 16, DEPTH_BUFFER_BIT: 32 };
  for (const name of ['shaderSource', 'compileShader', 'attachShader', 'linkProgram', 'deleteShader', 'bindVertexArray', 'bindBuffer', 'enableVertexAttribArray', 'vertexAttribPointer', 'vertexAttrib3f', 'enable', 'cullFace', 'clearColor', 'uniformMatrix4fv', 'uniform1i', 'uniform2f', 'uniform3f', 'uniform4f', 'viewport', 'useProgram', 'deleteProgram']) gl[name] = noOp;
  Object.assign(gl, { createShader: () => ({}), createProgram: () => ({}), getShaderParameter: () => true, getProgramParameter: () => true, getUniformLocation: (_p, name) => ({ name }), isContextLost: () => false,
    createBuffer: () => { const value = ++id; buffers.add(value); return value; }, createVertexArray: () => { const value = ++id; vaos.add(value); return value; },
    deleteBuffer: value => buffers.delete(value), deleteVertexArray: value => vaos.delete(value), bufferData: () => updates++, bufferSubData: () => updates++, clear: () => draws.splice(0), drawElements: (_mode, count, _type, offset) => draws.push({ count, offset }) });
  return { gl, buffers, vaos, draws, get updates() { return updates; } };
}

test('renderer reuses one beret resource, honors material index ranges and invalidates the changed curated junction', () => {
  const fake = mockGL(), renderer = new AvatarRenderer({ width: 400, height: 400, getContext: () => fake.gl });
  const accessory = publicAccessory('beret'), design = publicDesign({ accessories: [accessory] }), state = { pose: initialPose(), activity: 'still', time: 0, delta: 0, reduced: true, style: 'flat' };
  renderer.render(design, state); assert.deepEqual(renderer.stats, { drawCalls: 3, buffers: 8 });
  const updateCount = fake.updates; renderer.render(design, state); assert.equal(fake.updates, updateCount, 'static draw must not regenerate/reupload the beret');
  assert.equal(fake.draws[1].offset, 0); assert.equal(fake.draws[2].offset, fake.draws[1].count * 2, 'draw offset is a byte offset into the shared index buffer');
  for (let i = 0; i < 10; i++) { state.time = i; state.pose.rotation[2] = i * .01; renderer.render(design, state); assert.equal(fake.buffers.size, 8); assert.equal(fake.vaos.size, 4); }
  const profile = structuredClone(resolveShapeProfile('square')); state.profile = profile;
  renderer.render(design, state); const before = fake.updates; profile.accessories.beret.anchor.uv[0] = .20; renderer.render(design, state); assert.ok(fake.updates > before, 'changed curated contact frame must invalidate the beret fit');
  const beforeTilt = fake.updates; profile.beretFitTilt += .01; renderer.render(design, state); assert.ok(fake.updates > beforeTilt, 'changed displayed wearing tilt must invalidate the beret fit');
  const beforeCenter = fake.updates; profile.beretFitCenter[0] += .01; renderer.render(design, state); assert.ok(fake.updates > beforeCenter, 'changed displayed wearing center must invalidate the beret fit');
  const beforeRoom=fake.updates; profile.beretFitRoom += .1; renderer.render(design,state); assert.ok(fake.updates>beforeRoom,'cavity room invalidates the displayed fit');
  const beforeDrape=fake.updates; profile.beretDrapeStrength=.5; renderer.render(design,state); assert.ok(fake.updates>beforeDrape,'authored drape allowance invalidates the displayed fit');
  renderer.dispose(); renderer.dispose(); assert.equal(fake.buffers.size, 0); assert.equal(fake.vaos.size, 0);
  const source = readFileSync(new URL('../src/renderer/webgl.ts', import.meta.url), 'utf8'); assert.doesNotMatch(source, /this\.meshes\.sphere|sphere\(\)/);
});

test('open crown circlets are closed, hollow, and cleanly seated on all 35 shapes', () => {
  for (const shape of MATERIAL_SHAPE_NAMES) for (const squash of [.88, 1, 1.12]) {
    const body = createDesign({ body: { shape } }).body, contour = shapeContour({ kind: 'material', name: shape }), profile = resolveShapeProfile(shape);
    const mesh = beretGeometry(body, createAccessory('crown'), squash, contour, profile);
    assert.equal(mesh.vertices.length / 6, 480); assert.ok(mesh.vertices.every(Number.isFinite));
    assert.equal(mesh.bandIndexCount + mesh.crownIndexCount, mesh.indices.length);
    assertClear(mesh, contour, profile, squash, `${shape}/crown/${squash}`);
    const edges = new Map(); let volume = 0;
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const ids = Array.from(mesh.indices.subarray(i, i + 3)), [a,b,c] = ids.map(j => point(mesh,j));
      volume += (a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
      for (const [from,to] of [[ids[0],ids[1]],[ids[1],ids[2]],[ids[2],ids[0]]]) { const key = `${Math.min(from,to)},${Math.max(from,to)}`, e = edges.get(key) ?? [0,0]; e[0]++; e[1] += from < to ? 1 : -1; edges.set(key,e); }
    }
    assert.ok(volume > 0);
    for (const e of edges.values()) assert.deepEqual(e,[2,0]);
  }
});

test('crown contact is deterministic through interrupted concave shape morphs', async () => {
  for (const [from,to,next] of [['heart','boom','puffy'],['softBoom','pixelTriangle','circle']]) {
    const timeline = new ShapeTimeline(from), body = createDesign({body:{shape:to}}).body, accessory = createAccessory('crown');
    const sample = () => beretGeometry(body,accessory,1,timeline.contour,timeline.profile);
    const pending = timeline.to(to,{duration:1000,easing:'linear'}); timeline.advance(413);
    const before = sample(), snapshot = timeline.snapshot, nextPending = timeline.to(next,{duration:500,easing:'smooth'});
    assert.deepEqual(await pending,{finished:false}); assert.strictEqual(timeline.snapshot,snapshot); assert.deepEqual(sample(),before);
    timeline.advance(.001); const after=sample();
    for(let i=0;i<after.vertices.length;i+=6) assert.ok(Math.hypot(...[0,1,2].map(k=>after.vertices[i+k]-before.vertices[i+k]))<.003);
    assertClear(after,timeline.contour,timeline.profile,1,`${from}/${to}/${next}/crown`);
    timeline.finish();assert.deepEqual(await nextPending,{finished:true});
  }
});


function rayTriangle(origin, direction, a, b, c) {
  const e1 = sub(b, a), e2 = sub(c, a), h = cross(direction, e2), determinant = dot(e1, h);
  if (Math.abs(determinant) < 1e-12) return undefined;
  const s = sub(origin, a), u = dot(s, h) / determinant, q = cross(s, e1), v = dot(direction, q) / determinant;
  if (u < -1e-7 || v < -1e-7 || u + v > 1 + 1e-7) return undefined;
  const distance = dot(e2, q) / determinant;
  return distance > 0 ? distance : undefined;
}

test('beret is an oriented nondegenerate closed felt shell with a deep open cavity', () => {
  for (const shape of MATERIAL_SHAPE_NAMES) {
    const mesh = beretGeometry(createDesign({ body: { shape } }).body, createAccessory('beret'));
    assert.equal(mesh.vertices.length / 6, VERTEX_COUNT, shape + ': coherent profile topology');
    const edges = new Map(), adjacency = new Map(); let volume = 0;
    for (let i = 0; i < mesh.vertices.length; i += 6) near(Math.hypot(...mesh.vertices.subarray(i + 3, i + 6)), 1, shape + ': unit normal');
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const ids = Array.from(mesh.indices.subarray(i, i + 3)), [a, b, c] = ids.map(j => point(mesh, j));
      assert.equal(new Set(ids).size, 3, shape + ': distinct triangle vertices');
      const face = cross(sub(b, a), sub(c, a));
      assert.ok(Math.hypot(...face) > 1e-9, shape + ': nondegenerate triangle ' + i / 3);
      const normal = [0, 1, 2].map(k => ids.reduce((sum, j) => sum + mesh.vertices[j * 6 + 3 + k], 0));
      assert.ok(dot(face, normal) > 0, shape + ': face and vertex orientation ' + i / 3);
      volume += dot(a, cross(b, c)) / 6;
      for (let j = 0; j < 3; j++) {
        const from = ids[j], to = ids[(j + 1) % 3], key = `${Math.min(from, to)}:${Math.max(from, to)}`;
        const edge = edges.get(key) ?? [0, 0]; edge[0]++; edge[1] += from < to ? 1 : -1; edges.set(key, edge);
        const neighbours = adjacency.get(from) ?? new Set(); neighbours.add(to); adjacency.set(from, neighbours);
      }
    }
    assert.ok(volume > 1e-5, shape + ': positive solid felt volume');
    for (const [key, edge] of edges) assert.deepEqual(edge, [2, 0], shape + ': sealed consistently wound edge ' + key);
    assert.equal(VERTEX_COUNT - edges.size + mesh.indices.length / 3, 2, shape + ': one closed cup shell');
    const visited = new Set([0]), pending = [0];
    while (pending.length) for (const next of adjacency.get(pending.pop()) ?? []) if (!visited.has(next)) { visited.add(next); pending.push(next); }
    assert.equal(visited.size, VERTEX_COUNT, shape + ': all lining, cuff, crown and stem vertices connected');

    // Matching inner/outer wall samples must have real material between them.
    // This is a shaped cup profile, not the old constant-normal-offset duplicate.
    for (let j = 0; j < SEGMENTS; j++) {
      const inner = point(mesh, ringStart(5) + j), outer = point(mesh, ringStart(11) + j);
      const thickness = Math.hypot(...sub(outer, inner));
      assert.ok(thickness >= .004 && thickness <= .04, `${shape}: finite cuff wall ${j}: ${thickness}`);
    }
    // A ray entering the centre of the opening must reach the elevated cavity
    // ceiling, then leave through a separate outer skin. A fake bottom disk fails.
    const rim = ringPoints(mesh, 8), centre = [0, 1, 2].map(k => rim.reduce((sum, p) => sum + p[k], 0) / SEGMENTS);
    const tilt = wearTilt(shape), up = [-Math.sin(tilt), Math.cos(tilt), 0], origin = centre.map((v, k) => v - .02 * up[k]);
    const hits = [];
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const hit = rayTriangle(origin, up, ...Array.from(mesh.indices.subarray(i, i + 3), j => point(mesh, j)));
      if (hit !== undefined) hits.push(hit);
    }
    const distinct = hits.sort((a, b) => a - b).filter((value, i, all) => i === 0 || value - all[i - 1] > 1e-5);
    assert.ok(distinct.length >= 2, shape + ': separate inner and outer cavity ceilings');
    assert.ok(distinct[0] > .08, shape + ': actual head aperture, not a solid bottom disk');
    assert.ok(distinct[1] - distinct[0] > .004, shape + ': finite cavity ceiling thickness');
  }
});

test('all 35 coherent beret shells have no self-crossings or actual body intersections', () => {
  for (const shape of MATERIAL_SHAPE_NAMES) {
    const body = createDesign({ body: { shape } }).body, contour = shapeContour({ kind: 'material', name: shape }), profile = resolveShapeProfile(shape);
    const mesh = beretGeometry(body, createAccessory('beret'), 1, contour, profile), shell = triangles(mesh);
    const self = intersections(shell, shell, { classify: () => 'felt', ringOf: () => 'continuous-shell', maxSamples: 2 });
    assert.equal(self.count, 0, `${shape}: felt self-crossings ${JSON.stringify(self.samples)}`);
    const actualBody = triangles(bodyGeometry(contour), [.59, .59, profile.depth * .5]);
    const contact = intersections(shell, actualBody, { ringOf: () => 'continuous-shell', maxSamples: 2 });
    assert.equal(contact.count, 0, `${shape}: actual body crossings ${JSON.stringify(contact.samples)}`);
    assertClear(mesh, contour, profile, 1, shape + '/beret');
  }
});

test('breathing preserves the coherent neutral fit by the same affine body squash on all 35 shapes', () => {
  for (const shape of MATERIAL_SHAPE_NAMES) {
    const body = createDesign({ body: { shape } }).body, accessory = createAccessory('beret'), contour = shapeContour({ kind: 'material', name: shape }), profile = resolveShapeProfile(shape);
    const neutral = beretGeometry(body, accessory, 1, contour, profile);
    for (const squash of [.88, .94, 1.06, 1.12]) {
      const mesh = beretGeometry(body, accessory, squash, contour, profile);
      assert.deepEqual(mesh.indices, neutral.indices, shape + ': invariant breathing topology');
      for (let i = 0; i < VERTEX_COUNT; i++) {
        const recovered = unsquash(point(mesh, i), squash), expected = point(neutral, i);
        assert.ok(Math.hypot(...sub(recovered, expected)) < 2e-6, `${shape}/${squash}: coherent affine vertex ${i}`);
        const normal = [mesh.vertices[i * 6 + 3] / Math.sqrt(squash), mesh.vertices[i * 6 + 4] * squash, mesh.vertices[i * 6 + 5] / Math.sqrt(squash)];
        const length = Math.hypot(...normal);
        for (let k = 0; k < 3; k++) near(normal[k] / length, neutral.vertices[i * 6 + 3 + k], `${shape}/${squash}: inverse-transpose normal ${i}/${k}`);
      }
    }
  }
});

test('squash stays epsilon-continuous across the historical support and radial-section branch jumps', () => {
  for (const [shape, centre] of [['cookie6Sided', 1.001929217762], ['softBurst', .999091312042]]) {
    const body = createDesign({ body: { shape } }).body, accessory = createAccessory('beret'), contour = shapeContour({ kind: 'material', name: shape }), profile = resolveShapeProfile(shape);
    for (const epsilon of [1e-4, 1e-6, 1e-8]) {
      const before = beretGeometry(body, accessory, centre - epsilon, contour, profile), after = beretGeometry(body, accessory, centre + epsilon, contour, profile);
      assert.deepEqual(after.indices, before.indices);
      let maximum = 0;
      for (let i = 0; i < VERTEX_COUNT; i++) maximum = Math.max(maximum, Math.hypot(...sub(point(after, i), point(before, i))));
      // Old v0.2.5 jumps remain .279 and .102 even as epsilon approaches zero.
      assert.ok(maximum < 4 * epsilon + 2e-7, `${shape}/${epsilon}: no finite breathing jump (${maximum})`);
    }
  }
});

test('explicit beret rotations stay continuous across historical fitting branches', () => {
  for (const [shape, from, to] of [['cookie6Sided', .009, .010], ['pixelTriangle', -.084, -.083]]) {
    const body = createDesign({ body: { shape } }).body, accessory = createAccessory('beret'), contour = shapeContour({ kind: 'material', name: shape }), profile = resolveShapeProfile(shape);
    const before = beretGeometry(body, accessory, 1, contour, profile, [0, from, 0]);
    const after = beretGeometry(body, accessory, 1, contour, profile, [0, to, 0]);
    assert.deepEqual(after.indices, before.indices);
    let maximum = 0;
    for (let i = 0; i < VERTEX_COUNT; i++) maximum = Math.max(maximum, Math.hypot(...sub(point(after, i), point(before, i))));
    assert.ok(maximum > 1e-5, shape + ': explicit rotation must still take effect');
    assert.ok(maximum < .003, `${shape}: no fitting jump across .001 radians (${maximum})`);
    const actualBody = triangles(bodyGeometry(contour), [.59, .59, profile.depth * .5]);
    for (const [label, mesh] of [['before', before], ['after', after]]) {
      const shell = triangles(mesh), self = intersections(shell, shell, { maxSamples: 2 });
      const contact = intersections(shell, actualBody, { maxSamples: 2 });
      assert.equal(self.count, 0, `${shape}/${label}: posed self-crossings ${JSON.stringify(self.samples)}`);
      assert.equal(contact.count, 0, `${shape}/${label}: posed body crossings ${JSON.stringify(contact.samples)}`);
    }
  }
});

test('direct morph fitting is continuous across adaptive body triangulation controls', () => {
  const body=createDesign({body:{shape:'pixelTriangle'}}).body, accessory=createAccessory('beret');
  for(const [a,b] of [[.00036,.00037],[.00095,.00096],[.30899,.309],[.39499,.395]]) {
    const meshes=[a,b].map(progress=>{
      const timeline=new ShapeTimeline('heart');
      timeline.to('pixelTriangle',{duration:1000,easing:'linear'});
      timeline.advance(progress*1000);
      return beretGeometry(body,accessory,1,timeline.contour,timeline.profile,[0,0,0]);
    });
    let step=0;
    for(let i=0;i<VERTEX_COUNT;i++)step=Math.max(step,Math.hypot(...sub(point(meshes[1],i),point(meshes[0],i))));
    assert.ok(step<.0005, `Heart→Pixel ${a}→${b}: ${step}`);
    for(const mesh of meshes)assert.equal(mesh.contactResolved,true);
  }
});

test('Flower lip support does not snap when a boundary sample loses Gaussian dominance', () => {
  const body=createDesign({body:{shape:'triangle'}}).body, accessory=createAccessory('beret');
  const meshes=[6.8166666667,6.8333333333].map(time=>{
    const timeline=new ShapeTimeline('flower');
    timeline.to('triangle',{duration:1000,easing:'linear'});
    timeline.advance(time);
    return beretGeometry(body,accessory,1,timeline.contour,timeline.profile,[0,0,0]);
  });
  let step=0;
  for(let i=0;i<VERTEX_COUNT;i++)step=Math.max(step,Math.hypot(...sub(point(meshes[1],i),point(meshes[0],i))));
  // The former narrow support kernel moved .015 units in this 16.7µs interval.
  assert.ok(step<.0005, `Flower boundary-support handoff: ${step}`);
  for(const mesh of meshes)assert.equal(mesh.contactResolved,true);
});

test('authored curl limits carry the Boom cuff continuously into a Heart transition', () => {
  const body=createDesign({body:{shape:'heart'}}).body, accessory=createAccessory('beret');
  const meshes=[1.6666666667,3.3333333333].map(time=>{
    const timeline=new ShapeTimeline('boom');
    timeline.to('heart',{duration:1000,easing:'linear'});
    timeline.advance(time);
    return beretGeometry(body,accessory,1,timeline.contour,timeline.profile,[0,0,0]);
  });
  let step=0;
  for(let i=0;i<VERTEX_COUNT;i++)step=Math.max(step,Math.hypot(...sub(point(meshes[1],i),point(meshes[0],i))));
  // The former sampled collision limiter switched full curl to zero here.
  assert.ok(step<.003, `Boom→Heart authored curl onset: ${step}`);
  for(const mesh of meshes)assert.equal(mesh.contactResolved,true);
});
