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
  const collarProbe = point(mesh, 1 * 8 + 2).map((v, k) => (v + point(mesh, 1 * 8 + 6)[k]) / 2); collarProbe[2] += .004 * size;
  assert.ok(contains(mesh, collarProbe, 0, 320), `${label}: collar overlap probe outside cloth`);
  assert.ok(contains(mesh, collarProbe, 532, 590), `${label}: collar and knot are separated`);
  for (const start of [320, 426]) {
    const tailProbe = point(mesh, start + 8 + 2).map((v, k) => (v + point(mesh, start + 8 + 6)[k]) / 2);
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
// Cloth may tuck into the body by a sub-pixel seam allowance. Projected Z
// penetration is not a physical distance near the equator, so use the local
// implicit-field normal to bound inset rather than requiring a floating shell.
function assertClear(mesh, contour, profile, squash, label, tolerance = .012) {
  const stretch = 1 / Math.sqrt(squash), sx = .59 * stretch, sy = .59 * squash, sz = profile.depth * .5 * stretch;
  let minimum = Infinity;
  const check = p => {
    const x = p[0] / sx, y = p[1] / sy, z = p[2] / sz, d = contourSignedDistanceExact(contour, x, y);
    if (d <= 0) return;
    const f = z * z * (d + .65 * (x * x + y * y)) - d;
    if (f >= 0) return;
    const step = .0001;
    const dx = (contourSignedDistanceExact(contour, x + step, y) - contourSignedDistanceExact(contour, x - step, y)) / (2 * step);
    const dy = (contourSignedDistanceExact(contour, x, y + step) - contourSignedDistanceExact(contour, x, y - step)) / (2 * step);
    const gradient = Math.hypot((dx * (z * z - 1) + 1.3 * x * z * z) / sx, (dy * (z * z - 1) + 1.3 * y * z * z) / sy, 2 * z * (d + .65 * (x * x + y * y)) / sz);
    minimum = Math.min(minimum, f / Math.max(.01, gradient));
  };
  for (let i = 0; i < mesh.vertices.length / 6; i++) if (i >= 320 || [1, 2, 3].includes(i % 8)) check(point(mesh, i));
  for (let i = 0; i < mesh.indices.length; i += 3) {
    if (i < 40 * 8 * 6 && ![1, 2].includes(Math.floor(i / 6) % 8)) continue;
    const p = [mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]].map(index => point(mesh, index));
    check([0, 1, 2].map(k => (p[0][k] + p[1][k] + p[2][k]) / 3));
  }
  assert.ok(minimum > -tolerance, `${label}: excessive surface-normal cloth inset ${-minimum}`);
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
    const mesh = catalogAccessoryGeometry(body, accessory, squash), size = accessory.scale;
    assert.equal(mesh.vertices.length / 6, 590, 'bounded fixed topology');
    assertClear(mesh, contour, profile, squash, `${shape}/${squash}`);
    assertJoined(mesh, size, `${shape}/${squash}`);
    const front = envelope(contour), stretch = 1 / Math.sqrt(squash);
    const gap = i => { const [x, y, z] = point(mesh, i); return Math.abs(z) - front(x / (.59 * stretch), y / (.59 * squash)) * profile.depth * .5 * stretch; };
    assert.ok(center(mesh, 0, 0)[2] > .02, `${shape}: no front wrap`);
    assert.ok(center(mesh, 0, 20)[2] < -.02, `${shape}: no rear wrap`);
    assert.ok(center(mesh, 0, 10)[0] - center(mesh, 0, 30)[0] > .08, `${shape}: missing side wrap`);
    const supported = Array.from({ length: 320 }, (_, i) => [1, 2, 3].includes(i % 8) ? gap(i) : Infinity).filter(Number.isFinite);
    assert.ok(supported.length > 0, `${shape}: no body overlap for the cloth`);
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

test('broad fitted wrap and free tails retain bounded cloth proportions', () => {
  for (const shape of MATERIAL_SHAPE_NAMES) {
    const mesh = catalogAccessoryGeometry(createDesign({ body: { shape } }).body, accessory);
    for (let ring = 0; ring < 40; ring++) {
      const a = point(mesh, ring * 8), b = point(mesh, ring * 8 + 4);
      const width = Math.hypot(...a.map((value, k) => value - b[k]));
      assert.ok(width > .06 && width < .23, `${shape}: cloth width ${width}`);
    }
    for (const start of [320, 426]) {
      const first = center(mesh, start, 0), last = center(mesh, start, 12);
      const length = Math.hypot(...last.map((v, k) => v - first[k]));
      assert.ok(length > .24 && length < .52, `${shape}: free cloth length ${length}`);
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
    assertJoined(before, accessory.scale, `${from}->${to}`);
    assert.deepEqual(await active, { finished: false }); assert.strictEqual(timeline.snapshot, snapshot); assert.deepEqual(sample(), before);
    // Every sampled view sees the same non-collapsed 3D cloth; there is no view refit.
    for (const yaw of [-90, -45, 0, 45, 90, 180]) for (const pitch of [-25, 0, 25]) {
      const matrix = transform([0, 0, 0], [pitch * Math.PI / 180, yaw * Math.PI / 180, 0]);
      const back = viewPoint(matrix, point(before, 320 + 12 * 8 + 6)), front = viewPoint(matrix, point(before, 320 + 12 * 8 + 2));
      near(Math.hypot(...front.map((value, k) => value - back[k])), .012 * accessory.scale);
    }
    timeline.advance(.001); const after = sample();
    assertJoined(after, accessory.scale, `${from}->${to}->${next}`);
    assertClear(after, timeline.contour, timeline.profile, 1, `${from}->${to}->${next}`, .06);
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

// Static fit remains strict. During lobe morphs allow bounded transient inset
// (up to .06 world units) while retaining complete, visible cloth; subpixel
// normal deformation below .003 is not a support/corner teleport.
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
      assert.ok(difference(left, right) < .003, `${from}->${to}: persistent wrap jump at ${lower}/${upper}`);
    }
  }
});


test('regression: wrap clears the steep Boom to Heart transition and an interrupted return', () => {
 const timeline = new ShapeTimeline('boom'), body = createDesign({ body: { shape: 'heart' } }).body;
 timeline.to('heart', { duration: 1000, easing: 'linear' }); let time = 0;
 for (const next of [100, 125, 140, 150, 150.8, 151, 160, 170, 200]) {
  timeline.advance(next - time); time = next;
  const mesh = catalogAccessoryGeometry(body, accessory, 1, timeline.contour, timeline.profile);
  assertClear(mesh, timeline.contour, timeline.profile, 1, `Boom->Heart at ${time}`, .06);
  assertJoined(mesh, accessory.scale, `Boom->Heart at ${time}`);
 }
 timeline.to('pixelTriangle', { duration: 600, easing: 'smooth' });
 for (const delta of [0.001, 1, 25, 50, 150, 300]) {
  timeline.advance(delta); const mesh = catalogAccessoryGeometry(body, accessory, 1, timeline.contour, timeline.profile);
  assertClear(mesh, timeline.contour, timeline.profile, 1, `Boom->Heart->PixelTriangle after ${delta}`, .06);
  assertJoined(mesh, accessory.scale, `Boom->Heart->PixelTriangle after ${delta}`);
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


test('visible outer cloth faces clear narrow lobes while hidden seams may tuck against the body', () => {
  for (const [from, to, times] of [['heart', 'boom', [876, 888, 896]], ['boom', 'heart', [104, 112, 124]], ['pixelTriangle', 'boom', [735, 740, 745]]]) {
    const timeline = new ShapeTimeline(from), body = createDesign({ body: { shape: to } }).body;
    timeline.to(to, { duration: 1000, easing: 'linear' }); let previous = 0;
    for (const time of times) {
      timeline.advance(time - previous); previous = time;
      const mesh = catalogAccessoryGeometry(body, accessory, 1, timeline.contour, timeline.profile);
      assertClear(mesh, timeline.contour, timeline.profile, 1, `${from}->${to} at ${time}`, .06);
    }
  }
});


test('cloth follows changing body sections rather than an extruded hoop, with broad hanging ends', () => {
  for (const shape of ['circle', 'diamond', 'heart']) {
    const profile = resolveShapeProfile(shape), size = accessory.scale;
    const mesh = catalogAccessoryGeometry(createDesign({ body: { shape } }).body, accessory);
    // Top and bottom edges have genuinely different body-fitted circumferences.
    // A single ellipse extruded into a cord or belt cannot pass this check.
    assert.ok(point(mesh, 10 * 8)[0] - point(mesh, 10 * 8 + 4)[0] > .045 * size, `${shape}: constant-width hoop`);
    assert.ok(point(mesh, 0)[2] - point(mesh, 4)[2] > .035 * size, `${shape}: flat front plate`);
    for (const start of [320, 426]) {
      const width = point(mesh, start)[0] - point(mesh, start + 4)[0];
      assert.ok(width > .12 * size, `${shape}: narrow cord-like end`);
    }
  }
});

test('hanging cloth twists gently without losing thickness or gravity drape', () => {
  for (const shape of MATERIAL_SHAPE_NAMES) {
    const profile = resolveShapeProfile(shape), size = accessory.scale;
    const mesh = catalogAccessoryGeometry(createDesign({ body: { shape } }).body, accessory);
    for (const start of [320, 426]) {
      const rootAcross = point(mesh, start).map((v, k) => v - point(mesh, start + 4)[k]);
      const tipAcross = point(mesh, start + 12 * 8).map((v, k) => v - point(mesh, start + 12 * 8 + 4)[k]);
      assert.ok(Math.abs(rootAcross[2]) < .08 * size, `${shape}: root drape is over-folded`);
      assert.ok(Math.abs(tipAcross[2]) > .04 * size, `${shape}: tail collapses to a wafer edge-on`);
      assert.ok(Math.abs(tipAcross[0]) > .10 * size, `${shape}: over-twisted tail loses its broad front`);
      const front = point(mesh, start + 12 * 8 + 2), back = point(mesh, start + 12 * 8 + 6);
      near(Math.hypot(...front.map((v, k) => v - back[k])), .012 * size, 1e-7);
    }
  }
});

test('authored scarf support poses retain the approved local-wrap placements', () => {
  const expected = {
    circle: [0, -.7043028677966102], square: [-.65, -.9146402343230225],
    triangle: [-.65, -.7892793479151976], boom: [.65, -.43],
    bun: [-.65, -.8695092438017838], heart: [0, -.6577334288135593],
  };
  for (const [shape, [angle, level]] of Object.entries(expected)) {
    const fit = resolveShapeProfile(shape).scarfFit;
    near(fit[0], angle); near(fit[1], level);
    assert.ok(Object.isFrozen(fit)); assert.ok(fit[2] < fit[3]);
  }
});

test('scarf support interpolation has no discrete lobe or mirrored-corner reselection', async () => {
  const { interpolateShapeProfile } = await import(`${root}/core/shape-profiles.${extension}`);
  for (const [from, to] of [['heart', 'boom'], ['square', 'bun'], ['softBoom', 'pixelTriangle']]) {
    const a = resolveShapeProfile(from), b = resolveShapeProfile(to);
    for (const t of [.01, .25, .5, .75, .99]) {
      const middle = interpolateShapeProfile(a, b, t);
      middle.scarfFit.forEach((value, i) => near(value, a.scarfFit[i] + (b.scarfFit[i] - a.scarfFit[i]) * t, 1e-12));
      assert.ok(Object.isFrozen(middle.scarfFit));
    }
  }
});

test('internal scarf rotation flexes free cloth while the supported collar stays seated', () => {
  for (const shape of ['circle', 'heart', 'softBoom']) {
    const body = createDesign({ body: { shape } }).body;
    const base = catalogAccessoryGeometry(body, accessory);
    const posed = catalogAccessoryGeometry(body, accessory, 1, undefined, undefined, [.25, -.3, .2]);
    for (let i = 0; i < 320; i++) assert.deepEqual(point(posed, i), point(base, i));
    let changed = 0;
    for (let i = 320; i < 532; i++) changed = Math.max(changed, Math.hypot(...point(posed, i).map((v, k) => v - point(base, i)[k])));
    assert.ok(changed > .005, `${shape}: internal pose must flex free material`);
    for (const start of [320, 426]) assert.ok(center(posed, start, 12)[1] < center(posed, start, 0)[1], `${shape}: posed cloth still hangs with gravity`);
  }
});
