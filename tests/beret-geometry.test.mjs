import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MATERIAL_SHAPE_NAMES, createDesign as publicDesign, createAccessory as publicAccessory } from '../dist/src/core/design.js';
import { createResolvedFixture as createDesign, createResolvedAccessory as createAccessory } from './internal-fixtures.mjs';
import { resolveShapeProfile } from '../dist/src/core/shape-profiles.js';
import { shapeContour } from '../dist/src/core/contours.js';
import { ShapeTimeline } from '../dist/src/core/shape-motion.js';
import { sampleAccessorySurface } from '../dist/src/core/surface.js';
import { bodyGeometry } from '../dist/src/renderer/body-geometry.js';
import { beretGeometry, beretBandColor, BERET_CLEARANCE, BERET_SEATING_OFFSET } from '../dist/src/renderer/beret-geometry.js';
import { AvatarRenderer } from '../dist/src/renderer/webgl.js';
import { initialPose } from '../dist/src/core/motion.js';

const near = (a, b, message, tolerance = 2e-6) => assert.ok(Math.abs(a - b) <= tolerance, `${message}: ${a} vs ${b}`);
const point = (mesh, index) => Array.from(mesh.vertices.subarray(index * 6, index * 6 + 3));

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

test('beret is one closed oriented shell with fitted lip, full interior, crown and integrated stem', () => {
  const mesh = beretGeometry(createDesign().body, createAccessory('beret'));
  assert.ok(mesh.vertices.length / 6 < 2500 && mesh.indices.length / 3 > 2500);
  assert.equal(mesh.bandIndexCount + mesh.crownIndexCount, mesh.indices.length);
  assert.ok(mesh.bandIndexCount > 0 && mesh.crownIndexCount > mesh.bandIndexCount);
  assert.ok(mesh.vertices.every(Number.isFinite));
  const edges = new Map(); let volume = 0;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const ids = [mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]], [a, b, c] = ids.map(j => point(mesh, j));
    const u = b.map((v, k) => v - a[k]), v = c.map((value, k) => value - a[k]), n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    assert.ok(Math.hypot(...n) > 1e-9, 'no collapsed polar triangles');
    volume += (a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
    for (const [from, to] of [[ids[0], ids[1]], [ids[1], ids[2]], [ids[2], ids[0]]]) { const key = `${Math.min(from, to)},${Math.max(from, to)}`, entry = edges.get(key) ?? [0, 0]; entry[0]++; entry[1] += from < to ? 1 : -1; edges.set(key, entry); }
  }
  assert.ok(volume > .015 && volume < .10, `positive hollow shell volume ${volume}`);
  for (const [key, value] of edges) assert.deepEqual(value, [2, 0], `watertight consistently oriented edge ${key}`);
  for (let i = 0; i < mesh.vertices.length; i += 6) near(Math.hypot(...mesh.vertices.subarray(i + 3, i + 6)), 1, 'unit surface normal');
  assert.equal(beretBandColor('#b84742'), '#843330');
  assert.equal(beretBandColor('#ffffff'), '#b8b8b8');
});

test('all 35 default seated berets keep vertices and triangle interiors out of the actual body', () => {
  for (const shape of MATERIAL_SHAPE_NAMES) {
    const body = createDesign({ body: { shape } }).body, contour = shapeContour({ kind: 'material', name: shape }), profile = resolveShapeProfile(shape);
    const mesh = beretGeometry(body, createAccessory('beret'), 1, contour, profile);
    assert.equal(profile.accessories.beret.anchor.offset, 0, `${shape}: obsolete safety lift would make a fitted beret hover`);
    assertClear(mesh, contour, profile, 1, shape);
  }
});

test('thin/deep bodies, squash, scale and internal rotations retain conservative seating', () => {
  for (const shape of ['circle', 'square', 'triangle', 'heart', 'softBoom', 'pixelTriangle']) {
    const body = createDesign({ body: { shape } }).body, contour = shapeContour({ kind: 'material', name: shape });
    for (const [depth, squash, scale, rotation] of [[.08, .88, .65, [.1, -.25, .12]], [1.2, 1.12, 1.35, [-.1, .15, -.2]]]) {
      const profile = structuredClone(resolveShapeProfile(shape)); profile.depth = depth;
      const accessory = createAccessory('beret'); accessory.scale = scale; accessory.rotation = rotation;
      assertClear(beretGeometry(body, accessory, squash, contour, profile), contour, profile, squash, `${shape}/${depth}/${squash}`);
    }
  }
});

test('internal curated clearance adds once; legacy user calibration cannot override the seated fit', () => {
  const body = createDesign().body, accessory = createAccessory('beret'), original = beretGeometry(body, accessory), profile = structuredClone(resolveShapeProfile(body.shape));
  assert.equal(BERET_SEATING_OFFSET, .035);
  accessory.anchor.offset = .20; profile.mounts.head.offset = .15;
  assert.deepEqual(beretGeometry(body, accessory, 1, undefined, profile).vertices, original.vertices);
  profile.accessories.beret.anchor.offset = .04;
  const raised = beretGeometry(body, accessory, 1, undefined, profile), frame = sampleAccessorySurface(body, accessory, 1, undefined, profile);
  for (let i = 0; i < original.vertices.length; i += 6) for (let k = 0; k < 3; k++) near(raised.vertices[i + k] - original.vertices[i + k], frame.normal[k] * .04, 'internal stand-off adds once');
  assert.equal(raised.seating, original.seating);
  assert.ok(BERET_CLEARANCE > 0 && BERET_CLEARANCE <= .001);
});

test('heart mount selects the right lobe summit and an independent level cap band', () => {
  const body = createDesign({ body: { shape: 'heart' } }).body, accessory = createAccessory('beret'), profile = resolveShapeProfile('heart');
  const frame = sampleAccessorySurface(body, accessory, 1, undefined, profile);
  assert.ok(frame.position[0] > .30 && frame.position[0] < .34, 'mount is at lobe summit, away from inner notch');
  assert.ok(frame.position[1] > .49, 'mount reaches the summit');
  near(frame.normal[0], 0, 'lobe placement does not tilt band'); near(frame.normal[1], 1, 'band plane is upright');
  const mesh = beretGeometry(body, accessory);
  const ring = Array.from({length:64}, (_, i) => point(mesh, 1 + 7 * 64 + i));
  near(Math.max(...ring.map(p => p[1])) - Math.min(...ring.map(p => p[1])), 0, 'rolled band stays level');
  assertClear(mesh, shapeContour({kind:'material', name:'heart'}), profile);
});

test('concave morphs and interrupted retargets preserve exact snapshots and epsilon continuity', async () => {
  for (const [from, to, next] of [['softBoom', 'pixelTriangle', 'heart'], ['heart', 'puffy', 'softBoom']]) {
    const timeline = new ShapeTimeline(from), body = createDesign({ body: { shape: to } }).body, accessory = createAccessory('beret');
    const sample = () => beretGeometry(body, accessory, 1, timeline.contour, timeline.profile);
    const pending = timeline.to(to, { duration: 1000, easing: 'linear' }); timeline.advance(280.2);
    const before = sample(), snapshot = timeline.snapshot, retarget = timeline.to(next, { duration: 700, easing: 'linear' });
    assert.deepEqual(await pending, { finished: false }); assert.strictEqual(timeline.snapshot, snapshot); assert.deepEqual(sample(), before);
    let maximum = 0;
    for (const at of [0.001, 83.123, 184.251, 399.333, 611.345]) {
      timeline.advance(at - (timeline.__testElapsed ?? 0)); timeline.__testElapsed = at;
      const a = sample(); timeline.advance(.0001); timeline.__testElapsed += .0001; const b = sample();
      for (let i = 0; i < a.vertices.length; i += 6) maximum = Math.max(maximum, Math.hypot(...[0, 1, 2].map(k => a.vertices[i + k] - b.vertices[i + k])));
      assertClear(b, timeline.contour, timeline.profile, 1, `${from}->${to}->${next}`);
    }
    assert.ok(maximum < .003, `support switch must not jump at epsilon: ${maximum}`);
    timeline.finish(); assert.deepEqual(await retarget, { finished: true });
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
  renderer.render(design, state); assert.deepEqual(renderer.stats, { drawCalls: 3, buffers: 9 });
  const updateCount = fake.updates; renderer.render(design, state); assert.equal(fake.updates, updateCount, 'static draw must not regenerate/reupload the beret');
  assert.equal(fake.draws[1].offset, 0); assert.equal(fake.draws[2].offset, fake.draws[1].count * 2, 'draw offset is a byte offset into the shared index buffer');
  for (let i = 0; i < 10; i++) { state.time = i; state.pose.rotation[2] = i * .01; renderer.render(design, state); assert.equal(fake.buffers.size, 9); assert.equal(fake.vaos.size, 4); }
  const profile = structuredClone(resolveShapeProfile('square')); state.profile = profile;
  renderer.render(design, state); const before = fake.updates; profile.accessories.beret.anchor.uv[0] = .20; renderer.render(design, state); assert.ok(fake.updates > before, 'changed curated contact frame must invalidate the beret fit');
  renderer.dispose(); renderer.dispose(); assert.equal(fake.buffers.size, 0); assert.equal(fake.vaos.size, 0);
  const source = readFileSync(new URL('../src/renderer/webgl.ts', import.meta.url), 'utf8'); assert.doesNotMatch(source, /this\.meshes\.sphere|sphere\(\)/);
});

test('full legal rotation sweeps stay outside on the chosen mounting side without changing orientation', () => {
  for (const shape of ['circle', 'heart', 'softBoom']) {
    const body = createDesign({ body: { shape } }).body, contour = shapeContour({ kind: 'material', name: shape }), profile = resolveShapeProfile(shape), accessory = createAccessory('beret');
    const frame = sampleAccessorySurface(body, { ...accessory, anchor: { ...accessory.anchor, offset: 0 } }, 1, contour, profile);
    for (const axis of [0, 1]) for (let step = 0; step <= 12; step++) {
      accessory.rotation = [0, 0, 0]; accessory.rotation[axis] = step * Math.PI / 6;
      const mesh = beretGeometry(body, accessory, 1, contour, profile), center = [0, 0, 0];
      for (let i = 0; i < mesh.vertices.length; i += 6) for (let k = 0; k < 3; k++) center[k] += mesh.vertices[i + k] / (mesh.vertices.length / 6);
      assert.ok(center.reduce((sum, v, k) => sum + v * frame.normal[k], 0) > .25, `${shape}: rotation ${accessory.rotation} crossed to the opposite body side`);
      assertClear(mesh, contour, profile, 1, `${shape}/rotation ${accessory.rotation}`);
      // The stem axis remains the exact animated rotation: fitting adds translation,
      // not a clamp or corrective rotation. Vertex0 and the final stem tip are
      // fixed features of the authored shell; compare their displacement.
      const direction = point(mesh, mesh.vertices.length / 6 - 1).map((v, k) => v - mesh.vertices[k]);
      const angle = accessory.rotation[axis], c = Math.cos(angle), s = Math.sin(angle), local = [-.018, .005, .095];
      const rotated = axis === 0 ? [local[0], c * local[1] - s * local[2], s * local[1] + c * local[2]] : [c * local[0] + s * local[2], local[1], -s * local[0] + c * local[2]];
      for (let k = 0; k < 3; k++) near(direction[k], (frame.tangent[k] * rotated[0] + frame.bitangent[k] * rotated[1] + frame.normal[k] * rotated[2]) * profile.accessories.beret.scale, 'custom cap rotation retained');
    }
  }
});

test('outward fitting is epsilon-continuous through sideways, inverted and combined rotations', () => {
  const body = createDesign({ body: { shape: 'circle' } }).body, accessory = createAccessory('beret');
  for (const axis of [0, 1]) for (const angle of [Math.PI / 3, Math.PI / 2 - 1e-7, Math.PI / 2, Math.PI / 2 + 1e-7, 2 * Math.PI / 3, Math.PI, 1.5 * Math.PI]) {
    accessory.rotation = [.15, -.12, .2]; accessory.rotation[axis] = angle;
    const a = beretGeometry(body, accessory); accessory.rotation[axis] += 1e-7; const b = beretGeometry(body, accessory);
    let maximum = 0;
    for (let i = 0; i < a.vertices.length; i += 6) maximum = Math.max(maximum, Math.hypot(...[0, 1, 2].map(k => a.vertices[i + k] - b.vertices[i + k])));
    assert.ok(maximum < 2e-5, `no angular fallback pop: axis ${axis}, angle ${angle}, delta ${maximum}`);
  }
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
