import type { MaterialShapeName, Vec2, Vec3 } from '../core/design.js';
import type { ShapeContour } from '../core/contours.js';
import { transform } from '../core/math.js';
import { bodyGeometry } from './body-geometry.js';
import type { BeretGeometry } from './beret-geometry.js';

const SEGMENTS = 64;
const cross = (a: Vec2, b: Vec2, c: Vec2): number => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function hull(points: Vec2[]): Vec2[] {
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (points.length < 3) return points;
  const lower: Vec2[] = [], upper: Vec2[] = [];
  for (const p of points) { while (lower.length > 1 && cross(lower.at(-2)!, lower.at(-1)!, p) <= 0) lower.pop(); lower.push(p); }
  for (let i = points.length - 1; i >= 0; i--) { const p = points[i]!; while (upper.length > 1 && cross(upper.at(-2)!, upper.at(-1)!, p) <= 0) upper.pop(); upper.push(p); }
  lower.pop(); upper.pop(); return lower.concat(upper);
}
function radial(section: readonly Vec2[], cx: number, angle: number): number {
  const dx = Math.cos(angle), dz = Math.sin(angle); let radius = 0;
  for (let i = 0; i < section.length; i++) {
    const a = section[i]!, b = section[(i + 1) % section.length]!, ex = b[0] - a[0], ez = b[1] - a[1];
    const det = dx * ez - dz * ex;
    if (Math.abs(det) < 1e-12) continue;
    const r = ((a[0] - cx) * ez - a[1] * ex) / det, t = ((a[0] - cx) * dz - a[1] * dx) / det;
    if (r >= 0 && t >= 0 && t <= 1) radius = Math.max(radius, r);
  }
  return radius;
}
/**
 * Family-specific tilted supports put a lobe or point inside a compact crown.
 * The asymmetric free hem hangs below the support instead of enlarging the
 * hat to a full-body cross-section. Concealed inner seam overlap is intentional.
 */
function makeWornBeret(contour: ShapeContour, scales: Vec3, shape: MaterialShapeName): { mesh: BeretGeometry; pivot: Vec3 } {
  const mesh = bodyGeometry(contour), v = mesh.vertices, points: Vec3[] = [];
  const tilt = (shape === 'heart' ? -18 : shape === 'triangle' || shape === 'pixelTriangle' ? -10 : shape === 'boom' ? -32 : -20) * Math.PI / 180;
  const co = Math.cos(tilt), si = Math.sin(tilt);
  let top = -Infinity, bottom = Infinity;
  for (let i = 0; i < v.length; i += 6) {
    const p: Vec3 = [v[i]! * scales[0], v[i + 1]! * scales[1], v[i + 2]! * scales[2]];
    const x = p[0], y = p[1]; p[0] = co * x + si * y; p[1] = -si * x + co * y;
    points.push(p); top = Math.max(top, p[1]); bottom = Math.min(bottom, p[1]);
  }
  const hanger = shape === 'triangle' || shape === 'pixelTriangle' || shape === 'boom';
  const crownLift = hanger ? .025 : shape === 'circle' ? .12 : .065;
  const slouch = shape === 'triangle' || shape === 'pixelTriangle' ? .12 : .085;
  const height = top - bottom, bandHeight = height * .030;
  const insertion = shape === 'triangle' || shape === 'pixelTriangle' ? .18 : shape === 'boom' ? .115 : shape === 'heart' ? .12 : .085;
  const cut = top - height * insertion;
  const lobe = shape === 'heart', pointed = shape === 'boom';
  const supportX = points.reduce((a, b) => a[1] > b[1] ? a : b)[0];
  const minX = lobe ? .025 : pointed ? supportX - .16 : -Infinity;
  const maxX = pointed ? supportX + .24 : Infinity;
  // Deduplicate mesh edges once; section samples only visit their Y interval.
  const edges: { a: Vec3; b: Vec3; low: number; high: number }[] = [], seen = new Set<string>();
  for (let i = 0; i < mesh.indices.length; i += 3) for (let j = 0; j < 3; j++) {
    const ai = mesh.indices[i + j]!, bi = mesh.indices[i + (j + 1) % 3]!;
    const a = points[ai]!, b = points[bi]!;
    if (Math.max(a[1], b[1]) < cut - .15) continue;
    const key = Math.min(ai, bi) + ':' + Math.max(ai, bi);
    if (seen.has(key)) continue; seen.add(key);
    if (Math.abs(a[1] - b[1]) > 1e-10) edges.push({ a, b, low: Math.min(a[1], b[1]), high: Math.max(a[1], b[1]) });
  }
  const sectionAt = (y: number): Vec2[] => {
    const result: Vec2[] = [];
    for (const { a, b, low, high } of edges) {
      if (y < low || y >= high) continue;
      const t = (y - a[1]) / (b[1] - a[1]);
      result.push([a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t]);
    }
    let section = hull(result);
    for (const [edge, sign] of [[minX, 1], [maxX, -1]]) {
      if (!Number.isFinite(edge)) continue;
      const clipped: Vec2[] = [];
      for (let i = 0; i < section.length; i++) {
        const a = section[i]!, b = section[(i + 1) % section.length]!;
        const insideA = sign! * (a[0] - edge!) >= 0, insideB = sign! * (b[0] - edge!) >= 0;
        if (insideA) clipped.push(a);
        if (insideA !== insideB) clipped.push([edge!, a[1] + (b[1] - a[1]) * (edge! - a[0]) / (b[0] - a[0])]);
      }
      section = clipped;
    }
    return section;
  };
  const base = sectionAt(cut), cx = (Math.min(...base.map(p => p[0])) + Math.max(...base.map(p => p[0]))) / 2;
  const bandEnvelope = hull([...base, ...sectionAt(cut + bandHeight), ...points.filter(p => p[1] >= cut && p[1] <= cut + bandHeight && (p[0] >= minX && p[0] <= maxX)).map((p): Vec2 => [p[0], p[2]])]);
  const bandRadius = Array.from({ length: SEGMENTS }, (_, i) => radial(bandEnvelope, cx, i / SEGMENTS * Math.PI * 2));
  const baseRadius = Array.from({ length: SEGMENTS }, (_, i) => radial(base, cx, i / SEGMENTS * Math.PI * 2));
  const radiusX = Math.max(...baseRadius), pad = .008;
  const fullnessScale = 1;
  const vertices: number[] = [], indices: number[] = [];
  const sections = Array.from({ length: 81 }, (_, i) => sectionAt(cut - .15 + (top + .16 - cut) * i / 80));
  const atHeight = (y: number): Vec2[] => sections[Math.max(0, Math.min(80, Math.floor((y - cut + .15) / (top + .16 - cut) * 80)))]!;
  // A turned lower hem, a broad dark cuff, then the asymmetric felt crown.
  const rings = [
    { y: cut + .010, puff: -.005, blend: 1, shift: 0 },
    { y: cut - .004, puff: .006, blend: 1, shift: 0 },
    { y: cut + .006, puff: .015, blend: 1, shift: 0 },
    { y: cut + bandHeight, puff: .012, blend: 1, shift: 0 },
    ...Array.from({ length: 12 }, (_, j) => {
      const t = j / 11;
      return { y: cut + bandHeight + .008 + (top + crownLift - cut - bandHeight) * t,
        puff: .025 + radiusX * .19 * Math.sin(Math.PI * t), blend: Math.sqrt(Math.max(0, 1 - t * t)) * (1 + .05 * Math.sin(Math.PI * t)), shift: -slouch * Math.sin(Math.PI * t * (hanger ? 1 : .5)) };
    }),
  ];
  const cuffEdge: number[] = [];
  for (let ring = 0; ring < rings.length; ring++) {
    const r = rings[ring]!, center = cx + r.shift;
    for (let i = 0; i < SEGMENTS; i++) {
      const a = i / SEGMENTS * Math.PI * 2;
      const actualY = r.y - (hanger ? .13 : .065) * Math.pow(Math.max(0, -Math.cos(a)), 2) * (1 - (ring / (rings.length - 1)) ** 2);
      const body = radial(atHeight(actualY), center, a);
      const authored = (hanger ? Math.max(baseRadius[i]!, .085) : baseRadius[i]!) * r.blend * fullnessScale + r.puff;
      const radius = ring < 4 ? Math.max(body, bandRadius[i]!, cuffEdge[i] ?? 0) + (ring === 0 ? r.puff : Math.max(r.puff, .025))
        : Math.max(body + (hanger ? .022 : pad), authored, (cuffEdge[i]! + .033) * Math.max(0, 1 - ((ring - 4) / 11) ** 2));
      if (ring < 4) cuffEdge[i] = radius - (ring === 0 ? r.puff : Math.max(r.puff, .025));
      // Low-frequency felt fullness, not high-frequency folds or a rigid disk.
      const fullness = ring < 4 ? 0 : .006 * Math.sin(a * 2 + .4) * Math.sin((ring - 3) / (rings.length - 3) * Math.PI);
      vertices.push(center + (radius + fullness) * Math.cos(a), actualY, (radius + fullness) * Math.sin(a), 0, 0, 0);
    }
  }
  for (let ring = 0; ring < rings.length - 1; ring++) for (let i = 0; i < SEGMENTS; i++) {
    const a = ring * SEGMENTS + i, b = ring * SEGMENTS + (i + 1) % SEGMENTS, c = a + SEGMENTS, d = b + SEGMENTS;
    indices.push(a, c, b, b, c, d);
  }
  const cap = vertices.length / 6; vertices.push(cx - (hanger ? 0 : slouch), top + crownLift + .006, 0, 0, 1, 0);
  for (let i = 0; i < SEGMENTS; i++) indices.push((rings.length - 1) * SEGMENTS + i, cap, (rings.length - 1) * SEGMENTS + (i + 1) % SEGMENTS);
  // Small fabric stem, part of the same mesh and draw range.
  const stem = vertices.length / 6;
  for (let ring = 0; ring < 3; ring++) for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, radius = ring === 2 ? .002 : .012;
    vertices.push(cx - (hanger ? 0 : slouch) - ring * .004 + radius * Math.cos(a), top + crownLift + .005 + ring * .014, radius * Math.sin(a), 0, 0, 0);
  }
  for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 12; i++) { const a = stem + ring * 12 + i, b = stem + ring * 12 + (i + 1) % 12; indices.push(a, a + 12, b, b, a + 12, b + 12); }
  const output = new Float32Array(vertices);
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i]! * 6, b = indices[i + 1]! * 6, c = indices[i + 2]! * 6;
    const u = [output[b]! - output[a]!, output[b + 1]! - output[a + 1]!, output[b + 2]! - output[a + 2]!];
    const w = [output[c]! - output[a]!, output[c + 1]! - output[a + 1]!, output[c + 2]! - output[a + 2]!];
    const normal = [u[1]! * w[2]! - u[2]! * w[1]!, u[2]! * w[0]! - u[0]! * w[2]!, u[0]! * w[1]! - u[1]! * w[0]!];
    for (const p of [a, b, c]) for (let k = 0; k < 3; k++) output[p + 3 + k]! += normal[k]!;
  }
  for (let i = 0; i < output.length; i += 6) { const n = Math.hypot(output[i + 3]!, output[i + 4]!, output[i + 5]!); for (let k = 3; k < 6; k++) output[i + k]! /= n || 1; }
  // Return from the intentionally inclined wearing plane into body space.
  for (let i = 0; i < output.length; i += 6) for (const off of [0, 3]) {
    const x = output[i + off]!, y = output[i + off + 1]!;
    output[i + off] = co * x - si * y; output[i + off + 1] = si * x + co * y;
  }
  const bandIndexCount = 3 * SEGMENTS * 6;
  return { mesh: { vertices: output, indices: new Uint16Array(indices), bandIndexCount, crownIndexCount: indices.length - bandIndexCount, seating: cut - top }, pivot: [co * cx - si * cut, si * cx + co * cut, 0] };
}

// Shape morphs own short-lived contours; WeakMap entries disappear with them.
// Breathing/squash and explicitly animated cap poses reuse the fitted garment.
const fitted = new WeakMap<ShapeContour, { key: string; mesh: BeretGeometry; pivot: Vec3 }>();
export function wornBeret(contour: ShapeContour, scales: Vec3, shape: MaterialShapeName, rotation: Vec3 = [0, 0, 0]): BeretGeometry {
  const squash = scales[1] / .59, stretch = 1 / Math.sqrt(squash), depth = scales[2] / stretch;
  const key = shape + ':' + depth.toFixed(10);
  let cached = fitted.get(contour);
  if (!cached || cached.key !== key) { cached = { key, ...makeWornBeret(contour, [.59, .59, depth], shape) }; fitted.set(contour, cached); }
  if (squash === 1 && rotation.every(value => value === 0)) return cached.mesh;
  const output = new Float32Array(cached.mesh.vertices), matrix = transform([0, 0, 0], rotation);
  const cx = cached.pivot[0] * stretch, cut = cached.pivot[1] * squash;
  for (let i = 0; i < output.length; i += 6) {
    output[i]! *= stretch; output[i + 1]! *= squash; output[i + 2]! *= stretch;
    output[i + 3]! /= stretch; output[i + 4]! /= squash; output[i + 5]! /= stretch;
    const norm = Math.hypot(output[i + 3]!, output[i + 4]!, output[i + 5]!);
    for (let k = 3; k < 6; k++) output[i + k]! /= norm || 1;
    for (const normal of [false, true]) {
      const offset = i + (normal ? 3 : 0);
      const x = output[offset]! - (normal ? 0 : cx), y = -output[offset + 2]!, z = output[offset + 1]! - (normal ? 0 : cut);
      const rx = matrix[0]! * x + matrix[4]! * y + matrix[8]! * z;
      const ry = matrix[1]! * x + matrix[5]! * y + matrix[9]! * z;
      const rz = matrix[2]! * x + matrix[6]! * y + matrix[10]! * z;
      output[offset] = rx + (normal ? 0 : cx); output[offset + 1] = rz + (normal ? 0 : cut); output[offset + 2] = -ry;
    }
  }
  return { ...cached.mesh, vertices: output, seating: cached.mesh.seating * squash };
}
