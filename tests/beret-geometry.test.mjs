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

test('worn beret has bounded geometry, independent cuff material and finite unit normals', () => {
  const mesh = beretGeometry(createDesign().body, createAccessory('beret'));
  assert.ok(mesh.vertices.length / 6 < 2500 && mesh.indices.length / 3 > 1500);
  assert.equal(mesh.bandIndexCount + mesh.crownIndexCount, mesh.indices.length);
  assert.ok(mesh.bandIndexCount > 0 && mesh.crownIndexCount > mesh.bandIndexCount);
  assert.ok(mesh.vertices.every(Number.isFinite));
  for (let i = 0; i < mesh.vertices.length; i += 6) near(Math.hypot(...mesh.vertices.subarray(i + 3, i + 6)), 1, 'unit normal');
  assert.equal(beretBandColor('#b84742'), '#843330');
});

test('all 35 berets embrace a substantial upper body region instead of resting on its summit', () => {
  for (const shape of MATERIAL_SHAPE_NAMES) for (const squash of [.88, 1, 1.12]) {
    const body = createDesign({body:{shape}}).body, contour = shapeContour({kind:'material',name:shape}), profile = resolveShapeProfile(shape);
    const mesh = beretGeometry(body, createAccessory('beret'), squash, contour, profile);
    const top = Math.max(...contour.points.map(p => p[1])) * .59 * squash;
    const bottom = Math.min(...contour.points.map(p => p[1])) * .59 * squash;
    const cuff = Array.from({length:64}, (_, i) => point(mesh, 64 + i));
    const y = cuff[0][1];
    assert.ok(top - y > (top - bottom) * .22, shape + ': substantial insertion depth');
    assert.ok(Math.max(...Array.from({length:mesh.vertices.length/6}, (_, i)=>point(mesh,i)[1])) > top, shape + ': crown encloses summit');
    assert.ok(mesh.vertices.every(Number.isFinite), shape);
    assert.ok(Math.max(...cuff.map(p=>p[0]))-Math.min(...cuff.map(p=>p[0])) > .18, shape + ': broad opening');
    assert.ok(mesh.seating < -.15 * squash, shape + ': negative seating means worn');
    near(Math.max(...cuff.map(p=>p[1]))-Math.min(...cuff.map(p=>p[1])), 0, 'continuous level cuff');
  }
});

test('heart beret embraces the right lobe and preserves the opposite lobe', () => {
  const mesh=beretGeometry(createDesign({body:{shape:'heart'}}).body,createAccessory('beret'));
  const cuff=Array.from({length:64},(_,i)=>point(mesh,64+i));
  assert.ok(Math.min(...cuff.map(p=>p[0])) > 0);
  assert.ok(Math.max(...cuff.map(p=>p[0])) > .3);
  assert.ok(cuff[0][1] < .35);
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

test('beret stays present with fixed topology through interrupted concave morphs', async () => {
  for (const [from,to,next] of [['softBoom','pixelTriangle','heart'],['heart','puffy','softBoom']]) {
    const timeline=new ShapeTimeline(from),body=createDesign({body:{shape:to}}).body,accessory=createAccessory('beret');
    const sample=()=>beretGeometry(body,accessory,1,timeline.contour,timeline.profile);
    const pending=timeline.to(to,{duration:1000,easing:'linear'});timeline.advance(280.2);
    const before=sample(),retarget=timeline.to(next,{duration:700,easing:'linear'});
    assert.deepEqual(await pending,{finished:false});assert.deepEqual(sample(),before);
    for(let i=0;i<20;i++){timeline.advance(35);const mesh=sample();assert.ok(mesh.vertices.every(Number.isFinite));assert.equal(mesh.indices.length,before.indices.length);assert.ok(mesh.crownIndexCount>0);}
    timeline.finish();assert.deepEqual(await retarget,{finished:true});
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
