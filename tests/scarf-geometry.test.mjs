import test from 'node:test';
import assert from 'node:assert/strict';
const root = process.env.SIDEKICK_SOURCE === '1' ? '../src' : '../dist/src', extension = process.env.SIDEKICK_SOURCE === '1' ? 'ts' : 'js';
const [{ createDesign, createAccessory, MATERIAL_SHAPE_NAMES }, { resolveDesign }, { resolveShapeProfile, accessoryMountProfile }, { shapeContour, contourSignedDistanceExact }, { ShapeTimeline }, { bodyGeometry }, { catalogAccessoryGeometry }, { transform }, { viewPoint }] = await Promise.all(['core/design', 'core/resolved-design', 'core/shape-profiles', 'core/contours', 'core/shape-motion', 'renderer/body-geometry', 'renderer/catalog-accessory-geometry', 'core/math', 'renderer/eye-projection'].map(path => import(`${root}/${path}.${extension}`)));

const accessory = resolveDesign(createDesign({ accessories: [createAccessory('scarf')] })).accessories[0];
const point = (mesh, i) => Array.from(mesh.vertices.subarray(i * 6, i * 6 + 3));
const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) <= tolerance, `${a} vs ${b}`);
const center = (mesh, start, ring) => [0, 1, 2].map(k => Array.from({ length: 8 }, (_, j) => mesh.vertices[(start + ring * 8 + j) * 6 + k]).reduce((a, b) => a + b, 0) / 8);
// Closed-component ray containment checks positive volumetric overlap at each
// sewn junction. Screen-space overlap or nearest-vertex distance is insufficient.
function contains(mesh, point, from, to) {
  const subtract = (a, b) => a.map((value, k) => value - b[k]);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a.reduce((sum, value, k) => sum + value * b[k], 0);
  return [[1, .173, .389], [-.217, 1, .431], [.293, -.311, 1]].every(direction => {
    let hits = 0;
    for (let i = 0; i < mesh.indices.length; i += 3) {
      if (mesh.indices[i] < from || mesh.indices[i] >= to) continue;
      const [a, b, c] = [0, 1, 2].map(j => Array.from(mesh.vertices.subarray(mesh.indices[i + j] * 6, mesh.indices[i + j] * 6 + 3)));
      const ab = subtract(b, a), ac = subtract(c, a), h = cross(direction, ac), determinant = dot(ab, h);
      if (Math.abs(determinant) < 1e-12) continue;
      const offset = subtract(point, a), u = dot(offset, h) / determinant;
      if (u < 0 || u > 1) continue;
      const q = cross(offset, ab), v = dot(direction, q) / determinant;
      if (v < 0 || u + v > 1) continue;
      if (dot(ac, q) / determinant > 1e-10) hits++;
    }
    return hits % 2 === 1;
  });
}
function assertJoined(mesh, size, label) {
  const collarProbe = center(mesh, 0, 2); collarProbe[2] += .006 * size;
  assert.ok(contains(mesh, collarProbe, 0, 320), `${label}: collar overlap probe outside cloth`);
  assert.ok(contains(mesh, collarProbe, 532, 590), `${label}: collar and knot are separated`);
  for (const start of [320, 426]) {
    const tailProbe = center(mesh, start, 1);
    assert.ok(contains(mesh, tailProbe, start, start + 106), `${label}: tail overlap probe outside cloth`);
    assert.ok(contains(mesh, tailProbe, 532, 590), `${label}: knot and tail ${start} are separated`);
  }
}
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
  const check = p => { minimum = Math.min(minimum, Math.abs(p[2]) - front(p[0] / sx, p[1] / sy) * sz); };
  for (let i = 0; i < mesh.vertices.length / 6; i++) check(point(mesh, i));
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const p = [mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]].map(index => point(mesh, index));
    for (const weights of [[1 / 3, 1 / 3, 1 / 3], [.5, .5, 0], [0, .5, .5], [.5, 0, .5]]) check([0, 1, 2].map(k => p.reduce((sum, v, j) => sum + weights[j] * v[k], 0)));
  }
  assert.ok(minimum > -2e-6, `${label}: penetration ${-minimum}`);
}

// True Euclidean contact witnesses on rendered body triangles, including side
// support outside the front XY projection. A projected Z ray is not a distance.
function closeSurfaceWitness(mesh, contour, profile, squash, limit) {
  const { vertices, indices } = bodyGeometry(contour), stretch = 1 / Math.sqrt(squash);
  const scale = [.59 * stretch, .59 * squash, profile.depth * .5 * stretch], cloth = Array.from({ length: 320 }, (_, i) => point(mesh, i));
  const subtract = (a, b) => a.map((v, k) => v - b[k]), dot = (a, b) => a.reduce((s, v, k) => s + v * b[k], 0);
  const segmentDistance = (p, a, b) => {
    const ab = subtract(b, a), t = Math.max(0, Math.min(1, dot(subtract(p, a), ab) / dot(ab, ab)));
    return Math.hypot(...p.map((v, k) => v - a[k] - t * ab[k]));
  };
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = [0, 1, 2].map(j => [0, 1, 2].map(k => vertices[indices[i + j] * 6 + k] * scale[k]));
    const ab = subtract(b, a), ac = subtract(c, a), aa = dot(ab, ab), bb = dot(ab, ac), cc = dot(ac, ac), determinant = aa * cc - bb * bb;
    const lo = [0, 1, 2].map(k => Math.min(a[k], b[k], c[k]) - limit), hi = [0, 1, 2].map(k => Math.max(a[k], b[k], c[k]) + limit);
    for (let j = 0; j < 320; j++) {
      const p = cloth[j]; if (p[0] < lo[0] || p[0] > hi[0] || p[1] < lo[1] || p[1] > hi[1] || p[2] < lo[2] || p[2] > hi[2]) continue;
      const ap = subtract(p, a), d = dot(ap, ab), e = dot(ap, ac), u = (cc * d - bb * e) / determinant, v = (aa * e - bb * d) / determinant;
      const distance = u >= 0 && v >= 0 && u + v <= 1 ? Math.hypot(...ap.map((x, k) => x - u * ab[k] - v * ac[k])) : Math.min(segmentDistance(p, a, b), segmentDistance(p, b, c), segmentDistance(p, c, a));
      if (distance < limit) return distance;
    }
  }
  return Infinity;
}


test('all 35 scarves form a real front/side/rear loop with joined freely hanging ends', () => {
  for (const shape of MATERIAL_SHAPE_NAMES) for (const squash of [.88, 1, 1.12]) {
    const body = createDesign({ body: { shape } }).body, contour = shapeContour({ kind: 'material', name: shape }), profile = resolveShapeProfile(shape);
    const mesh = catalogAccessoryGeometry(body, accessory, squash), size = accessoryMountProfile(accessory, profile).scale;
    assert.equal(mesh.vertices.length / 6, 590, 'bounded fixed topology');
    assertClear(mesh, contour, profile, squash, `${shape}/${squash}`);
    assertJoined(mesh, size, `${shape}/${squash}`);
    const front = envelope(contour), stretch = 1 / Math.sqrt(squash);
    const gap = i => { const [x, y, z] = point(mesh, i); return Math.abs(z) - front(x / (.59 * stretch), y / (.59 * squash)) * profile.depth * .5 * stretch; };
    assert.ok(center(mesh, 0, 0)[2] > .02, `${shape}: no front wrap`);
    assert.ok(center(mesh, 0, 20)[2] < -.02, `${shape}: no rear wrap`);
    assert.ok(center(mesh, 0, 10)[0] > .05 && center(mesh, 0, 30)[0] < -.05, `${shape}: missing side wrap`);
    const supported = Array.from({ length: 320 }, (_, i) => gap(i)).filter(Number.isFinite);
    assert.ok(Math.min(...supported) >= .0019, `${shape}: wrap penetrates`);
    const contact = closeSurfaceWitness(mesh, contour, profile, squash, .055 * size);
    assert.ok(Number.isFinite(contact), `${shape}/${squash}: no body-surface contact within ${.055 * size}`);
    for (const start of [320, 426]) {
      for (let ring = 1; ring < 13; ring++) assert.ok(center(mesh, start, ring)[1] < center(mesh, start, ring - 1)[1], `${shape}: tail does not fall with gravity`);
    }
    // One connected genus-one surface, rather than separate front/back plates.
    const edges = new Map(); let faces = 0;
    for (let i = 0; i < 40 * 8 * 6; i += 3) {
      faces++; const ids = [...mesh.indices.subarray(i, i + 3)];
      for (const [a, b] of [[ids[0], ids[1]], [ids[1], ids[2]], [ids[2], ids[0]]]) {
        const key = `${Math.min(a, b)},${Math.max(a, b)}`, value = edges.get(key) ?? [0, 0]; value[0]++; value[1] += a < b ? 1 : -1; edges.set(key, value);
      }
    }
    for (const edge of edges.values()) assert.deepEqual(edge, [2, 0]);
    assert.equal(320 - edges.size + faces, 0, `${shape}: wrap is not a closed loop`);
  }
});

test('rounded wrap and free tail folds preserve cloth volume instead of projecting vertices onto the body', () => {
  for (const shape of MATERIAL_SHAPE_NAMES) {
    const profile = resolveShapeProfile(shape), size = accessoryMountProfile(accessory, profile).scale;
    const mesh = catalogAccessoryGeometry(createDesign({ body: { shape } }).body, accessory);
    for (let ring = 0; ring < 40; ring++) {
      near(point(mesh, ring * 8)[1] - point(mesh, ring * 8 + 4)[1], .110 * size);
      const a = point(mesh, ring * 8 + 2), b = point(mesh, ring * 8 + 6);
      near(Math.hypot(...a.map((value, k) => value - b[k])), .030 * size);
    }
    for (const start of [320, 426]) for (let ring = 0; ring < 13; ring++) {
      const a = point(mesh, start + ring * 8 + 2), b = point(mesh, start + ring * 8 + 6);
      near(a[2] - b[2], .020 * size, 1e-7);
      if (ring) {
        const v = ring / 12, before = (ring - 1) / 12;
        near(center(mesh, start, ring)[2] - center(mesh, start, ring - 1)[2], size * (.030 / 12 + .014 * (Math.sin(Math.PI * v) - Math.sin(Math.PI * before))));
      }
    }
  }
});

test('scarf geometry is deterministic, view-independent and preserves interrupted morph snapshots on every shape', async () => {
  for (let i = 0; i < MATERIAL_SHAPE_NAMES.length; i++) {
    const from = MATERIAL_SHAPE_NAMES[i], to = MATERIAL_SHAPE_NAMES[(i + 13) % MATERIAL_SHAPE_NAMES.length], next = MATERIAL_SHAPE_NAMES[(i + 23) % MATERIAL_SHAPE_NAMES.length];
    const body = createDesign({ body: { shape: to } }).body, timeline = new ShapeTimeline(from);
    const active = timeline.to(to, { duration: 1000, easing: 'linear' }); timeline.advance(377);
    const sample = () => catalogAccessoryGeometry(body, accessory, 1, timeline.contour, timeline.profile);
    const before = sample(), snapshot = timeline.snapshot, interrupted = timeline.to(next, { duration: 600, easing: 'smooth' });
    assertJoined(before, accessoryMountProfile(accessory, timeline.profile).scale, `${from}->${to}`);
    assert.deepEqual(await active, { finished: false }); assert.strictEqual(timeline.snapshot, snapshot); assert.deepEqual(sample(), before);
    // Every sampled view sees the same non-collapsed 3D cloth; there is no view refit.
    for (const yaw of [-90, -45, 0, 45, 90, 180]) for (const pitch of [-25, 0, 25]) {
      const matrix = transform([0, 0, 0], [pitch * Math.PI / 180, yaw * Math.PI / 180, 0]);
      const back = viewPoint(matrix, point(before, 320 + 12 * 8 + 6)), front = viewPoint(matrix, point(before, 320 + 12 * 8 + 2));
      near(Math.hypot(...front.map((value, k) => value - back[k])), .020 * accessoryMountProfile(accessory, timeline.profile).scale);
    }
    timeline.advance(.001); const after = sample();
    assertJoined(after, accessoryMountProfile(accessory, timeline.profile).scale, `${from}->${to}->${next}`);
    assertClear(after, timeline.contour, timeline.profile, 1, `${from}->${to}->${next}`);
    for (let j = 0; j < after.vertices.length; j += 6) assert.ok(Math.hypot(...[0, 1, 2].map(k => after.vertices[j + k] - before.vertices[j + k])) < .003, `${from}: epsilon jump`);
    timeline.finish(); assert.deepEqual(await interrupted, { finished: true });
  }
});


test('scarf chart exact distance agrees with the raw contour instead of a changing simplification', () => {
  for (const shape of MATERIAL_SHAPE_NAMES) {
    const contour = shapeContour({ kind: 'material', name: shape });
    for (const [x, y] of [[0, -.4], [.37, -.65], [-.43, -.72], [.91, .13], [-1.03, .77]]) {
      let squared = Infinity, inside = false;
      for (let i = 0; i < contour.points.length; i++) {
        const a = contour.points[i], b = contour.points[(i + 1) % contour.points.length], dx = b[0] - a[0], dy = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
        squared = Math.min(squared, (x - a[0] - dx * t) ** 2 + (y - a[1] - dy * t) ** 2);
        if ((a[1] > y) !== (b[1] > y) && x < dx * (y - a[1]) / dy + a[0]) inside = !inside;
      }
      near(contourSignedDistanceExact(contour, x, y), Math.sqrt(squared) * (inside ? 1 : -1), 1e-10);
    }
  }
});

test('dense difficult wrap trajectories have no persistent jumps when the steepest intervals are bisected', () => {
  const difference = (a, b) => {
    let maximum = 0;
    for (let i = 0; i < a.length; i += 6) maximum = Math.max(maximum, Math.hypot(a[i] - b[i], a[i + 1] - b[i + 1], a[i + 2] - b[i + 2]));
    return maximum;
  };
  for (const [from, to] of [['softBoom', 'pixelTriangle'], ['pixelTriangle', 'boom'], ['heart', 'boom'], ['boom', 'puffy']]) {
    const body = createDesign({ body: { shape: to } }).body;
    const at = time => {
      const timeline = new ShapeTimeline(from); timeline.to(to, { duration: 1000, easing: 'linear' }); timeline.advance(time);
      return catalogAccessoryGeometry(body, accessory, 1, timeline.contour, timeline.profile).vertices;
    };
    const candidates = []; let previous = at(0);
    for (let i = 1; i <= 200; i++) {
      const current = at(i * 5); candidates.push({ lower: (i - 1) * 5, upper: i * 5, delta: difference(previous, current), left: previous, right: current }); previous = current;
    }
    candidates.sort((a, b) => b.delta - a.delta);
    for (const candidate of candidates.slice(0, 3)) {
      let { lower, upper, left, right } = candidate;
      for (let iteration = 0; iteration < 15; iteration++) {
        const mid = (lower + upper) / 2, middle = at(mid);
        if (difference(left, middle) >= difference(middle, right)) { upper = mid; right = middle; }
        else { lower = mid; left = middle; }
      }
      assert.ok(difference(left, right) < .00005, `${from}->${to}: persistent wrap jump at ${lower}/${upper}`);
    }
  }
});


test('regression: wrap clears the steep Boom to Heart transition and an interrupted return', () => {
 const timeline = new ShapeTimeline('boom'), body = createDesign({ body: { shape: 'heart' } }).body;
 timeline.to('heart', { duration: 1000, easing: 'linear' }); let time = 0;
 for (const next of [100, 125, 140, 150, 150.8, 151, 160, 170, 200]) {
  timeline.advance(next - time); time = next;
  const mesh = catalogAccessoryGeometry(body, accessory, 1, timeline.contour, timeline.profile);
  assertClear(mesh, timeline.contour, timeline.profile, 1, `Boom->Heart at ${time}`);
  assertJoined(mesh, accessoryMountProfile(accessory, timeline.profile).scale, `Boom->Heart at ${time}`);
 }
 timeline.to('pixelTriangle', { duration: 600, easing: 'smooth' });
 for (const delta of [0.001, 1, 25, 50, 150, 300]) {
  timeline.advance(delta); const mesh = catalogAccessoryGeometry(body, accessory, 1, timeline.contour, timeline.profile);
  assertClear(mesh, timeline.contour, timeline.profile, 1, `Boom->Heart->PixelTriangle after ${delta}`);
  assertJoined(mesh, accessoryMountProfile(accessory, timeline.profile).scale, `Boom->Heart->PixelTriangle after ${delta}`);
 }
});


test('wrapped equator supports are invariant to cyclic indexing and collinear insertion during accessory rotation', async () => {
  const { drapedScarf } = await import(`${root}/renderer/scarf-geometry.${extension}`);
  for (const shape of MATERIAL_SHAPE_NAMES) {
    const contour = shapeContour({ kind: 'material', name: shape }), depth = resolveShapeProfile(shape).depth;
    const points = contour.points, shift = Math.floor(points.length / 3);
    const variants = [
      { kind: 'contour', points: [...points.slice(shift), ...points.slice(0, shift)] },
      { kind: 'contour', points: points.flatMap((a, i) => {
        const b = points[(i + 1) % points.length]; return [a, [a[0] * .63 + b[0] * .37, a[1] * .63 + b[1] * .37]];
      }) },
    ];
    for (const rotation of [[0, 0, 0], [.08, .1, .15], [.25, -.3, .2]]) {
      const sample = contour => drapedScarf([0, -.3, .2], .6, contour, [.59, .59, depth * .5], rotation);
      const original = sample(contour);
      for (const variant of variants) {
        const changed = sample(variant); assert.deepEqual(changed.indices, original.indices);
        for (let i = 0; i < original.points.length; i++) assert.ok(Math.hypot(...original.points[i].map((v, k) => v - changed.points[i][k])) < 1e-7, `${shape}/${rotation}: contour indexing changed vertex ${i}`);
      }
    }
  }
});


// A grazing face can cross even when all vertex/midpoint/centroid probes are
// outside. Check actual triangle edges at the historically failing intervals.
function assertNoLoopCrossings(mesh, contour, profile, label) {
  const body = bodyGeometry(contour), scale = [.59, .59, profile.depth * .5];
  const subtract = (a, b) => a.map((v, k) => v - b[k]), dot = (a, b) => a.reduce((s, v, k) => s + v * b[k], 0);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const hits = (a, b, triangle) => {
    const [p, q, r] = triangle, direction = subtract(b, a), e1 = subtract(q, p), e2 = subtract(r, p), h = cross(direction, e2), det = dot(e1, h);
    if (Math.abs(det) < 1e-12) return false;
    const s = subtract(a, p), u = dot(s, h) / det; if (u < -1e-9 || u > 1 + 1e-9) return false;
    const v = cross(s, e1), w = dot(direction, v) / det; if (w < -1e-9 || u + w > 1 + 1e-9) return false;
    const t = dot(e2, v) / det; return t >= -1e-9 && t <= 1 + 1e-9;
  };
  const bounds = t => [0, 1, 2].map(k => [Math.min(...t.map(p => p[k])), Math.max(...t.map(p => p[k]))]);
  const triangles = Array.from({ length: body.indices.length / 3 }, (_, i) => {
    const t = [0, 1, 2].map(j => [0, 1, 2].map(k => body.vertices[body.indices[i * 3 + j] * 6 + k] * scale[k])); return { t, box: bounds(t) };
  });
  for (let i = 0; i < 40 * 8 * 6; i += 3) {
    const cloth = [0, 1, 2].map(j => point(mesh, mesh.indices[i + j])), box = bounds(cloth);
    for (const { t, box: other } of triangles) {
      if (box.some(([lo, hi], k) => hi < other[k][0] || lo > other[k][1])) continue;
      for (let edge = 0; edge < 3; edge++) assert.ok(!hits(cloth[edge], cloth[(edge + 1) % 3], t) && !hits(t[edge], t[(edge + 1) % 3], cloth), `${label}: loop triangle ${i / 3} crosses the body`);
    }
  }
}

test('actual loop faces clear narrow equator lobes at historical morph collision times', () => {
  for (const [from, to, times] of [['heart', 'boom', [876, 888, 896]], ['boom', 'heart', [104, 112, 124]], ['pixelTriangle', 'boom', [735, 740, 745]]]) {
    const timeline = new ShapeTimeline(from), body = createDesign({ body: { shape: to } }).body;
    timeline.to(to, { duration: 1000, easing: 'linear' }); let previous = 0;
    for (const time of times) {
      timeline.advance(time - previous); previous = time;
      const mesh = catalogAccessoryGeometry(body, accessory, 1, timeline.contour, timeline.profile);
      assertNoLoopCrossings(mesh, timeline.contour, timeline.profile, `${from}->${to} at ${time}`);
    }
  }
});
