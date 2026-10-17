import test from 'node:test';
import assert from 'node:assert/strict';
import { createDesign, createAccessory, MATERIAL_SHAPE_NAMES } from '../dist/src/core/design.js';
import { resolveDesign } from '../dist/src/core/resolved-design.js';
import { resolveShapeProfile, accessoryMountProfile, interpolateShapeProfile, sameShapeProfile } from '../dist/src/core/shape-profiles.js';
import { sampleAccessorySurface } from '../dist/src/core/surface.js';
import { shapeContour, contourSignedDistance } from '../dist/src/core/contours.js';
import { ShapeTimeline } from '../dist/src/core/shape-motion.js';
import { bodyGeometry } from '../dist/src/renderer/body-geometry.js';
import { catalogAccessoryGeometry, accessoryDetailColor } from '../dist/src/renderer/catalog-accessory-geometry.js';
import { AvatarRenderer } from '../dist/src/renderer/webgl.js';
import { projectEyes } from '../dist/src/renderer/eye-projection.js';
import { glassesGeometry } from '../dist/src/renderer/glasses-geometry.js';
import { identity } from '../dist/src/core/math.js';
import { initialPose } from '../dist/src/core/motion.js';

const names = ['moustache', 'goatee', 'bowTie', 'scarf', 'necklace', 'leftEar', 'rightEar', 'leftStarEar', 'rightStarEar'];
const publicAccessory = name => name.endsWith('Ear') ? createAccessory(name.includes('Star') ? 'starEarring' : 'earring', { slot: name.startsWith('left') ? 'leftEar' : 'rightEar' }) : createAccessory(name);
const accessory = name => resolveDesign(createDesign({ accessories: [publicAccessory(name)] })).accessories[0];
const point = (mesh, i) => Array.from(mesh.vertices.subarray(i * 6, i * 6 + 3));
const distance = (a, b) => Math.hypot(...a.map((value, i) => value - b[i]));
const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) <= tolerance, `${a} vs ${b}`);
const envelopes = new WeakMap();
function envelope(contour) {
  if (envelopes.has(contour)) return envelopes.get(contour);
  const { vertices: v, indices } = bodyGeometry(contour), cells = new Map(), cell = 22;
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = [indices[i], indices[i + 1], indices[i + 2]].map(index => index * 6);
    const det = (v[b] - v[a]) * (v[c + 1] - v[a + 1]) - (v[b + 1] - v[a + 1]) * (v[c] - v[a]);
    if (det <= 1e-12) continue;
    const t = [a, b, c, det];
    for (let x = Math.floor(Math.min(v[a], v[b], v[c]) * cell); x <= Math.floor(Math.max(v[a], v[b], v[c]) * cell); x++) for (let y = Math.floor(Math.min(v[a + 1], v[b + 1], v[c + 1]) * cell); y <= Math.floor(Math.max(v[a + 1], v[b + 1], v[c + 1]) * cell); y++) {
      const key = `${x},${y}`, list = cells.get(key) ?? []; list.push(t); cells.set(key, list);
    }
  }
  const sample = (x, y) => {
    let h = -Infinity;
    for (const [a, b, c, det] of cells.get(`${Math.floor(x * cell)},${Math.floor(y * cell)}`) ?? []) {
      const u = ((x - v[a]) * (v[c + 1] - v[a + 1]) - (y - v[a + 1]) * (v[c] - v[a])) / det;
      const w = ((v[b] - v[a]) * (y - v[a + 1]) - (v[b + 1] - v[a + 1]) * (x - v[a])) / det;
      if (u >= -1e-7 && w >= -1e-7 && u + w <= 1 + 1e-7) h = Math.max(h, v[a + 2] * (1 - u - w) + v[b + 2] * u + v[c + 2] * w);
    }
    return h;
  };
  envelopes.set(contour, sample); return sample;
}
function assertClear(mesh, contour, profile, squash, label) {
  const front = envelope(contour), stretch = 1 / Math.sqrt(squash), sx = .59 * stretch, sy = .59 * squash, sz = profile.depth * .5 * stretch;
  let minimum = Infinity;
  const check = p => { minimum = Math.min(minimum, p[2] - front(p[0] / sx, p[1] / sy) * sz); };
  for (let i = 0; i < mesh.vertices.length / 6; i++) check(point(mesh, i));
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const p = [mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]].map(index => point(mesh, index));
    for (const weights of [[1 / 3, 1 / 3, 1 / 3], [.5, .5, 0], [0, .5, .5], [.5, 0, .5]]) check([0, 1, 2].map(k => p.reduce((sum, v, j) => sum + weights[j] * v[k], 0)));
  }
  assert.ok(minimum > -2e-6, `${label}: penetration ${-minimum}`);
}

test('new catalog pieces have bounded, closed, consistently oriented low-poly components', () => {
  const body = createDesign().body;
  for (const name of names) {
    const mesh = catalogAccessoryGeometry(body, accessory(name));
    assert.ok(mesh.vertices.length / 6 <= 650, name);
    assert.ok(mesh.vertices.every(Number.isFinite)); assert.ok(mesh.indices.every(i => i < mesh.vertices.length / 6));
    assert.equal(mesh.mainIndexCount + mesh.detailIndexCount, mesh.indices.length);
    const edges = new Map(); let volume = 0;
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const ids = Array.from(mesh.indices.subarray(i, i + 3)), [a, b, c] = ids.map(index => point(mesh, index));
      const u = b.map((v, k) => v - a[k]), v = c.map((v, k) => v - a[k]), n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      assert.ok(Math.hypot(...n) > 1e-10, `${name}: collapsed face`);
      volume += (a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
      for (const [from, to] of [[ids[0], ids[1]], [ids[1], ids[2]], [ids[2], ids[0]]]) { const key = `${Math.min(from, to)},${Math.max(from, to)}`, e = edges.get(key) ?? [0, 0]; e[0]++; e[1] += from < to ? 1 : -1; edges.set(key, e); }
    }
    assert.ok(volume > 0, name);
    for (const edge of edges.values()) assert.deepEqual(edge, [2, 0], name);
    assert.equal(mesh.detailIndexCount > 0, name === 'bowTie' || name === 'scarf' || name === 'necklace');
  }
});

test('all 35 shapes independently fit mouth, neck and both earrings outside actual body triangles', () => {
  for (const shape of MATERIAL_SHAPE_NAMES) {
    const body = createDesign({ body: { shape } }).body, contour = shapeContour({ kind: 'material', name: shape }), profile = resolveShapeProfile(shape);
    for (const squash of [.88, 1, 1.12]) for (const name of names) {
      const a = accessory(name), mesh = catalogAccessoryGeometry(body, a, squash, contour, profile);
      assert.ok(mesh.vertices.every(Number.isFinite), `${shape}/${name}`);
      assertClear(mesh, contour, profile, squash, `${shape}/${name}/${squash}`);
      const frame = sampleAccessorySurface(body, a, squash, contour, profile);
      assert.deepEqual(mesh.attachment, frame.position);
      if (name.endsWith('Ear')) {
        assert.ok(frame.position[0] * (name.startsWith('left') ? -1 : 1) > .12);
        assert.ok(frame.normal[2] > .99); assert.ok(Math.abs(frame.normal[1]) < 1e-8);
      }
    }
  }
});

test('earring side is mandatory and side-specific profile ownership cannot leak', () => {
  const profile = structuredClone(resolveShapeProfile('heart')), left = accessory('leftEar'), right = accessory('rightEar');
  assert.throws(() => accessoryMountProfile({ preset: 'earring' }, profile));
  const before = structuredClone(accessoryMountProfile(right, profile)); profile.accessories.leftEarring.anchor.uv[1] -= .1;
  assert.deepEqual(accessoryMountProfile(right, profile), before);
  assert.notDeepEqual(accessoryMountProfile(left, profile), accessoryMountProfile(left, resolveShapeProfile('heart')));
  assert.equal(sameShapeProfile(profile, resolveShapeProfile('heart')), false);
  for (const p of Object.values(resolveShapeProfile('heart').accessories)) { assert.ok(Object.isFrozen(p)); assert.ok(Object.isFrozen(p.anchor.uv)); assert.ok(Object.isFrozen(p.rotation)); }
});

test('new attachments and geometry preserve interrupted morph snapshots and epsilon continuity', async () => {
  for (const [from, to, next] of [['heart', 'boom', 'puffy'], ['softBoom', 'pixelTriangle', 'circle'], ['bun', 'clover4Leaf', 'square']]) {
    const body = createDesign({ body: { shape: to } }).body, timeline = new ShapeTimeline(from);
    const first = timeline.to(to, { duration: 1000, easing: 'linear' }); timeline.advance(413);
    const visible = timeline.snapshot, before = names.map(name => catalogAccessoryGeometry(body, accessory(name), 1, timeline.contour, timeline.profile));
    const pending = timeline.to(next, { duration: 500, easing: 'smooth' }); assert.deepEqual(await first, { finished: false }); assert.strictEqual(timeline.snapshot, visible);
    names.forEach((name, i) => assert.deepEqual(catalogAccessoryGeometry(body, accessory(name), 1, timeline.contour, timeline.profile), before[i]));
    timeline.advance(.001);
    names.forEach((name, i) => {
      const mesh = catalogAccessoryGeometry(body, accessory(name), 1, timeline.contour, timeline.profile);
      for (let j = 0; j < mesh.vertices.length; j += 6) assert.ok(distance(Array.from(mesh.vertices.slice(j, j + 3)), Array.from(before[i].vertices.slice(j, j + 3))) < .001, `${from}/${name}`);
      assertClear(mesh, timeline.contour, timeline.profile, 1, `${from}->${to}->${next}/${name}`);
    });
    timeline.finish(); assert.deepEqual(await pending, { finished: true });
    assert.deepEqual(timeline.profile, interpolateShapeProfile(visible.profile, resolveShapeProfile(next), 1));
  }
});

function mockGL() {
  let id = 0, updates = 0, color; const buffers = new Set(), vaos = new Set(), draws = [];
  const gl = { VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, ELEMENT_ARRAY_BUFFER: 6, DYNAMIC_DRAW: 7, STATIC_DRAW: 8, FLOAT: 9, TRIANGLES: 10, UNSIGNED_SHORT: 11, DEPTH_TEST: 12, CULL_FACE: 13, BACK: 14, COLOR_BUFFER_BIT: 16, DEPTH_BUFFER_BIT: 32 };
  for (const name of ['shaderSource', 'compileShader', 'attachShader', 'linkProgram', 'deleteShader', 'bindVertexArray', 'bindBuffer', 'enableVertexAttribArray', 'vertexAttribPointer', 'vertexAttrib3f', 'enable', 'cullFace', 'clearColor', 'uniformMatrix4fv', 'uniform1i', 'uniform2f', 'uniform4f', 'viewport', 'useProgram', 'deleteProgram']) gl[name] = () => {};
  Object.assign(gl, { uniform3f: (uniform, ...rgb) => { if (uniform.name === 'color') color = rgb; }, createShader: () => ({}), createProgram: () => ({}), getShaderParameter: () => true, getProgramParameter: () => true, getUniformLocation: (_p, name) => ({ name }), isContextLost: () => false,
    createBuffer: () => { const v = ++id; buffers.add(v); return v; }, createVertexArray: () => { const v = ++id; vaos.add(v); return v; }, deleteBuffer: v => buffers.delete(v), deleteVertexArray: v => vaos.delete(v), bufferData: () => updates++, bufferSubData: () => updates++, clear: () => draws.splice(0), drawElements: (_mode, count, _type, offset) => draws.push({ count, offset, color: [...color] }) });
  return { gl, buffers, vaos, draws, get updates() { return updates; } };
}
test('renderer caches each occupied slot independently, changes only materials on color edits and disposes empty slots', () => {
  const fake = mockGL(), renderer = new AvatarRenderer({ width: 400, height: 400, getContext: () => fake.gl });
  const design = createDesign({ accessories: ['moustache', 'bowTie', 'leftEar', 'rightEar'].map(publicAccessory) });
  const state = { pose: initialPose(), activity: 'still', time: 0, delta: 0, reduced: true, style: 'flat' };
  renderer.render(design, state); assert.equal(renderer.stats.buffers, 16); assert.equal(renderer.stats.drawCalls, 6);
  const uploads = fake.updates; renderer.render(design, state); assert.equal(fake.updates, uploads);
  design.accessories[2].color = '#c35b20'; design.accessories[3].color = '#174bcc'; renderer.render(design, state); assert.equal(fake.updates, uploads);
  assert.deepEqual(fake.draws.at(-2).color, [195 / 255, 91 / 255, 32 / 255]); assert.deepEqual(fake.draws.at(-1).color, [23 / 255, 75 / 255, 204 / 255]);
  state.camera = { yaw: 70, pitch: -20, roll: 25 }; renderer.render(design, state); assert.equal(fake.updates, uploads, 'view changes must not rebuild body-local ornaments');
  design.accessories = design.accessories.filter(a => a.slot !== 'rightEar'); renderer.render(design, state); assert.equal(renderer.stats.buffers, 14);
  design.accessories = [publicAccessory('scarf')]; renderer.render(design, state); assert.equal(renderer.stats.buffers, 10); assert.equal(renderer.stats.drawCalls, 3);
  near(fake.draws[2].offset, fake.draws[1].count * 2);
  renderer.dispose(); renderer.dispose(); assert.equal(fake.buffers.size, 0); assert.equal(fake.vaos.size, 0);
  assert.equal(accessoryDetailColor('#ffffff'), '#c7c7c7'); assert.equal(accessoryDetailColor('#000000'), '#000000');
});

test('all new canonical mounts remain contained through representative lower-body morphs', () => {
  for (const [from, to] of [['heart', 'boom'], ['softBoom', 'pixelTriangle'], ['triangle', 'bun'], ['puffy', 'semiCircle'], ['clover4Leaf', 'flower']]) {
    const timeline = new ShapeTimeline(from), body = createDesign({ body: { shape: to } }).body; timeline.to(to, { duration: 1000, easing: 'linear' });
    for (let i = 0; i <= 20; i++) {
      if (i) timeline.advance(50);
      for (const name of names) { const frame = sampleAccessorySurface(body, accessory(name), 1, timeline.contour, timeline.profile); assert.ok(contourSignedDistance(timeline.contour, frame.position[0] / .59, frame.position[1] / .59) >= -1e-8, `${from}->${to}/${name}/${i}`); }
    }
  }
});


test('equipped glasses, mouth and neck pieces keep separate front silhouettes on every shape', () => {
  for (const shape of MATERIAL_SHAPE_NAMES) for (const squash of [.88, 1, 1.12]) {
    const design = resolveDesign(createDesign({ body: { shape }, accessories: [createAccessory('glasses')] }));
    const eyes = projectEyes(design, identity(), [0, 0], [0, 0], squash), glasses = glassesGeometry(design, design.accessories[0], eyes, squash);
    const moustache = catalogAccessoryGeometry(design.body, accessory('moustache'), squash), tie = catalogAccessoryGeometry(design.body, accessory('bowTie'), squash);
    const ys = mesh => Array.from(mesh.vertices).filter((_, i) => i % 6 === 1);
    const upperMouth = Math.max(...ys(moustache)), lowerMouth = Math.min(...ys(moustache));
    assert.ok(Math.min(...ys(glasses)) - upperMouth > .003, `${shape}/${squash}: glasses overlap moustache`);
    assert.ok(lowerMouth - Math.max(...ys(tie)) > .002, `${shape}/${squash}: bow tie overlaps moustache`);
  }
});

test('earring hooks remain joined to the rigid hoop after their local body clearance', () => {
  const center = (mesh, from, count) => [0, 1, 2].map(k => Array.from({ length: count }, (_, i) => mesh.vertices[(from + i) * 6 + k]).reduce((a, b) => a + b, 0) / count);
  for (const shape of MATERIAL_SHAPE_NAMES) for (const name of ['leftEar', 'rightEar']) {
    const body = createDesign({ body: { shape } }).body, a = accessory(name), profile = resolveShapeProfile(shape);
    for (const squash of [.88, 1, 1.12]) {
      const mesh = catalogAccessoryGeometry(body, a, squash), hoopTop = center(mesh, 9 * 8, 8), wireEnd = center(mesh, 296 + 7 * 8, 8), radius = .0085 * accessoryMountProfile(a, profile).scale;
      assert.ok(distance(hoopTop, wireEnd) < radius, `${shape}/${name}/${squash}: wire-to-hoop separation`);
    }
  }
});

test('thin/deep profiles and posed ornaments remain finite and outside the body', () => {
  for (const shape of ['circle', 'heart', 'softBoom']) for (const depth of [.08, 1.2]) {
    const body = createDesign({ body: { shape } }).body, contour = shapeContour({ kind: 'material', name: shape }), profile = structuredClone(resolveShapeProfile(shape)); profile.depth = depth;
    for (const rotation of [[.25, -.3, .2], [Math.PI, 0, 0], [0, Math.PI, 0]]) for (const name of names) {
      const mesh = catalogAccessoryGeometry(body, accessory(name), 1, contour, profile, rotation);
      assert.ok(mesh.vertices.every(Number.isFinite)); assertClear(mesh, contour, profile, 1, `${shape}/${depth}/${name}/${rotation}`);
    }
  }
});

test('full accessory meshes stay epsilon-continuous inside difficult active morphs', () => {
  for (const [from, to] of [['softBoom', 'pixelTriangle'], ['cookie4Sided', 'heart'], ['puffy', 'triangle'], ['boom', 'heart']]) for (const at of [.15, .3295, .45, .73, .875]) {
    const body = createDesign({ body: { shape: to } }).body, timeline = new ShapeTimeline(from);
    timeline.to(to, { duration: 1000, easing: 'linear' }); timeline.advance(at * 1000);
    const before = names.map(name => catalogAccessoryGeometry(body, accessory(name), 1, timeline.contour, timeline.profile));
    timeline.advance(.001);
    names.forEach((name, i) => {
      const after = catalogAccessoryGeometry(body, accessory(name), 1, timeline.contour, timeline.profile);
      assert.equal(after.vertices.length, before[i].vertices.length);
      for (let j = 0; j < after.vertices.length; j += 6) assert.ok(distance(Array.from(after.vertices.subarray(j, j + 3)), Array.from(before[i].vertices.subarray(j, j + 3))) < .003, `${from}->${to}/${at}/${name}: epsilon mesh jump`);
    });
    timeline.finish();
  }
});

test('every catalog shape supports expanded equipment on interrupted morphs without a mesh jump', async () => {
  const { beretGeometry } = await import('../dist/src/renderer/beret-geometry.js');
  for (let i = 0; i < MATERIAL_SHAPE_NAMES.length; i++) {
    const from = MATERIAL_SHAPE_NAMES[i], to = MATERIAL_SHAPE_NAMES[(i + 13) % MATERIAL_SHAPE_NAMES.length], next = MATERIAL_SHAPE_NAMES[(i + 23) % MATERIAL_SHAPE_NAMES.length];
    const timeline = new ShapeTimeline(from), design = resolveDesign(createDesign({ body: { shape: to }, accessories: [createAccessory('crown'), createAccessory('sunglasses'), createAccessory('goatee'), createAccessory('necklace'), createAccessory('starEarring', { slot: 'leftEar' }), createAccessory('starEarring', { slot: 'rightEar' })] }));
    const sample = () => {
      const eyes = projectEyes(design, identity(), [0,0], [0,0], 1, timeline.contour, timeline.profile);
      return design.accessories.map(a => a.preset === 'crown' ? beretGeometry(design.body,a,1,timeline.contour,timeline.profile) : a.preset === 'sunglasses' ? glassesGeometry(design,a,eyes,1,timeline.contour,timeline.profile) : catalogAccessoryGeometry(design.body,a,1,timeline.contour,timeline.profile));
    };
    const first = timeline.to(to,{duration:1000,easing:'linear'}); timeline.advance(377);
    const before = sample(), snapshot = timeline.snapshot, pending = timeline.to(next,{duration:600,easing:'smooth'});
    assert.deepEqual(await first,{finished:false}); assert.strictEqual(timeline.snapshot,snapshot); assert.deepEqual(sample(),before);
    timeline.advance(.001); const after = sample();
    for (let mesh = 0; mesh < before.length; mesh++) {
      assert.equal(after[mesh].vertices.length,before[mesh].vertices.length);
      for (let j = 0; j < before[mesh].vertices.length; j += 6) assert.ok(Math.hypot(...[0,1,2].map(k=>after[mesh].vertices[j+k]-before[mesh].vertices[j+k])) < .003, `${from}->${to}->${next}/${design.accessories[mesh].preset}: epsilon jump`);
    }
    timeline.finish(); assert.deepEqual(await pending,{finished:true});
  }
});

test('all mouth and neck preset combinations keep separate silhouettes throughout the squash range', () => {
  const area = polygon => polygon.reduce((sum, a, i) => { const b = polygon[(i + 1) % polygon.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0) / 2;
  const cross2 = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  const clip = (polygon, triangle) => {
    for (let i = 0; i < 3 && polygon.length; i++) {
      const a = triangle[i], b = triangle[(i + 1) % 3], output = [];
      for (let j = 0; j < polygon.length; j++) {
        const p = polygon[j], q = polygon[(j + 1) % polygon.length], cp = cross2(a, b, p), cq = cross2(a, b, q);
        if (cp >= 0) output.push(p);
        if ((cp >= 0) !== (cq >= 0)) { const f = cp / (cp - cq); output.push([p[0] + f * (q[0] - p[0]), p[1] + f * (q[1] - p[1])]); }
      }
      polygon = output;
    }
    return polygon;
  };
  const triangles = mesh => {
    const result = [];
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const points = [0, 1, 2].map(j => point(mesh, mesh.indices[i + j]));
      if (area(points) > 1e-12) result.push({ points, minX: Math.min(...points.map(p => p[0])), maxX: Math.max(...points.map(p => p[0])), minY: Math.min(...points.map(p => p[1])), maxY: Math.max(...points.map(p => p[1])) });
    }
    return result;
  };
  for (const shape of MATERIAL_SHAPE_NAMES) for (const squash of [.88, 1, 1.12]) {
    const body = createDesign({ body: { shape } }).body;
    const meshes = Object.fromEntries(['moustache', 'goatee', 'bowTie', 'scarf', 'necklace'].map(name => [name, triangles(catalogAccessoryGeometry(body, accessory(name), squash))]));
    for (const mouth of ['moustache', 'goatee']) for (const neck of ['bowTie', 'scarf', 'necklace']) {
      let overlap = 0;
      for (const a of meshes[mouth]) for (const b of meshes[neck]) {
        if (a.minX > b.maxX || a.maxX < b.minX || a.minY > b.maxY || a.maxY < b.minY) continue;
        const polygon = clip(a.points, b.points); if (polygon.length >= 3) overlap += Math.abs(area(polygon));
      }
      assert.ok(overlap < 1e-8, `${shape}/${squash}/${mouth}+${neck}: overlap ${overlap}`);
    }
  }
});
