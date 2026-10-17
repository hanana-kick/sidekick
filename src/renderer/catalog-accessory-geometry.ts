import type { BodyDesign, Vec2, Vec3 } from '../core/design.js';
import type { ResolvedAccessoryDesign } from '../core/resolved-design.js';
import type { ShapeContour } from '../core/contours.js';
import type { ShapeProfile } from '../core/shape-profiles.js';
import { shapeContour } from '../core/contours.js';
import { contourVolumeHeight } from '../core/body-volume.js';
import { accessoryMountProfile, resolveShapeProfile } from '../core/shape-profiles.js';
import { BODY_SIZE, sampleAccessorySurface } from '../core/surface.js';
import { cross, normalize, sub, transform } from '../core/math.js';
import { viewPoint } from './eye-projection.js';
import { drapedFrontLifts, rigidFrontLift } from './rigid-contact.js';
import type { Geometry } from './geometry.js';

export type CatalogAccessoryPreset = 'moustache' | 'bowTie' | 'scarf' | 'earring';
/** Flat structural colors, never directional lighting. */
export interface CatalogAccessoryGeometry extends Geometry {
  mainIndexCount: number;
  detailIndexCount: number;
  /** Actual body junction, independent of a rigid object's clearance solve. */
  attachment: Vec3;
  seating: number;
}
export const CATALOG_ACCESSORY_CLEARANCE = 0.002;
/** Conservative local extents used by shape-independent camera framing. */
export const CATALOG_ACCESSORY_EXTENT: Readonly<Record<CatalogAccessoryPreset, number>> = Object.freeze({ moustache: .24, bowTie: .26, scarf: .47, earring: .23 });
interface MeshData { points: Vec3[]; indices: number[]; mainIndexCount: number }

/** Small ear-clipped 2D patterns keep the silhouette deliberate and concave. */
function triangulate(points: readonly Vec2[]): number[] {
  const remaining = points.map((_, i) => i), triangles: number[] = [];
  const area = (a: Vec2, b: Vec2, c: Vec2): number => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  while (remaining.length > 3) {
    let clipped = false;
    for (let i = 0; i < remaining.length; i++) {
      const a = remaining[(i + remaining.length - 1) % remaining.length]!, b = remaining[i]!, c = remaining[(i + 1) % remaining.length]!;
      if (area(points[a]!, points[b]!, points[c]!) <= 1e-12) continue;
      if (remaining.some(index => index !== a && index !== b && index !== c && area(points[a]!, points[b]!, points[index]!) >= -1e-12 && area(points[b]!, points[c]!, points[index]!) >= -1e-12 && area(points[c]!, points[a]!, points[index]!) >= -1e-12)) continue;
      triangles.push(a, b, c); remaining.splice(i, 1); clipped = true; break;
    }
    if (!clipped) throw new Error('Accessory pattern must be a simple polygon.');
  }
  triangles.push(...remaining); return triangles;
}
function empty(): MeshData { return { points: [], indices: [], mainIndexCount: 0 }; }
function prism(mesh: MeshData, pattern: readonly Vec2[], back: number, front: number): void {
  let polygon = [...pattern];
  const signed = polygon.reduce((sum, p, i) => { const q = polygon[(i + 1) % polygon.length]!; return sum + p[0] * q[1] - q[0] * p[1]; }, 0);
  if (signed < 0) polygon = polygon.reverse();
  const start = mesh.points.length, count = polygon.length, faces = triangulate(polygon);
  for (const z of [back, front]) for (const [x, y] of polygon) mesh.points.push([x, y, z]);
  for (let i = 0; i < faces.length; i += 3) {
    const a = faces[i]!, b = faces[i + 1]!, c = faces[i + 2]!;
    mesh.indices.push(start + a, start + c, start + b, start + count + a, start + count + b, start + count + c);
  }
  for (let i = 0; i < count; i++) {
    const a = start + i, b = start + (i + 1) % count;
    mesh.indices.push(a, b, a + count, b, b + count, a + count);
  }
}
function cubic(a: Vec2, b: Vec2, c: Vec2, d: Vec2, steps = 6): Vec2[] {
  return Array.from({ length: steps }, (_, i) => {
    const t = (i + 1) / steps, s = 1 - t;
    return [s ** 3 * a[0] + 3 * s * s * t * b[0] + 3 * s * t * t * c[0] + t ** 3 * d[0], s ** 3 * a[1] + 3 * s * s * t * b[1] + 3 * s * t * t * c[1] + t ** 3 * d[1]];
  });
}
function moustachePattern(): MeshData {
  const mesh = empty(), top: Vec2 = [0, .018], bottom: Vec2 = [0, -.014];
  const right: Vec2[] = [top,
    ...cubic(top, [.027, .056], [.061, .056], [.091, .021]),
    ...cubic([.091, .021], [.126, -.009], [.160, .003], [.190, .047]),
    ...cubic([.190, .047], [.180, -.023], [.126, -.067], [.079, -.052]),
    ...cubic([.079, -.052], [.038, -.040], [.015, -.015], bottom),
  ];
  // One continuous two-lobe outline: tapered lifted tips and a center cleft.
  prism(mesh, [...right, ...right.slice(1, -1).reverse().map(([x, y]): Vec2 => [-x, y])], 0, .034);
  mesh.mainIndexCount = mesh.indices.length; return mesh;
}
function bowTiePattern(): MeshData {
  const mesh = empty();
  const loop: Vec2[] = [[.026, .028], [.145, .083], [.171, .073], [.181, .045], [.181, -.045], [.163, -.075], [.140, -.080], [.026, -.028]];
  prism(mesh, loop, 0, .040); prism(mesh, loop.map(([x, y]): Vec2 => [-x, y]), 0, .040);
  mesh.mainIndexCount = mesh.indices.length;
  // A separate chamfered knot overlaps the loop roots and carries the fold color.
  prism(mesh, [[-.031, -.034], [-.022, -.044], [.022, -.044], [.031, -.034], [.031, .034], [.022, .044], [-.022, .044], [-.031, .034]], .004, .058);
  return mesh;
}
/** Circular-section metal along a connected path. Closed paths have no seam. */
function tube(mesh: MeshData, path: readonly Vec3[], radius: number, closed = false, sides = 8): void {
  const start = mesh.points.length, count = path.length;
  for (let i = 0; i < count; i++) {
    const previous = path[closed ? (i + count - 1) % count : Math.max(0, i - 1)]!, next = path[closed ? (i + 1) % count : Math.min(count - 1, i + 1)]!;
    const tangent = normalize(sub(next, previous)), helper: Vec3 = Math.abs(tangent[2]) < .95 ? [0, 0, 1] : [0, 1, 0];
    const a = normalize(cross(tangent, helper)), b = cross(tangent, a);
    for (let j = 0; j < sides; j++) {
      const angle = j / sides * Math.PI * 2, c = Math.cos(angle), s = Math.sin(angle), p = path[i]!;
      mesh.points.push([p[0] + radius * (a[0] * c + b[0] * s), p[1] + radius * (a[1] * c + b[1] * s), p[2] + radius * (a[2] * c + b[2] * s)]);
    }
  }
  for (let i = 0; i < count - (closed ? 0 : 1); i++) for (let j = 0; j < sides; j++) {
    const a = start + i * sides + j, b = start + ((i + 1) % count) * sides + j, c = start + i * sides + (j + 1) % sides, d = start + ((i + 1) % count) * sides + (j + 1) % sides;
    mesh.indices.push(a, c, b, c, d, b);
  }
  if (!closed) {
    const first = mesh.points.push([...path[0]!]) - 1, last = mesh.points.push([...path[count - 1]!]) - 1;
    for (let j = 0; j < sides; j++) mesh.indices.push(first, start + (j + 1) % sides, start + j, last, start + (count - 1) * sides + j, start + (count - 1) * sides + (j + 1) % sides);
  }
}
function earringPattern(side: number): MeshData {
  const mesh = empty(), centerX = side * .044, centerY = -.050, radius = .044;
  tube(mesh, Array.from({ length: 36 }, (_, i): Vec3 => { const a = i / 36 * Math.PI * 2; return [centerX + radius * Math.cos(a), centerY + radius * Math.sin(a), .012]; }), .0085, true);
  // A small tapered drop shares the bottom of the hoop, rather than floating.
  prism(mesh, [[centerX, -.089], [centerX + .018, -.116], [centerX, -.145], [centerX - .018, -.116]], .004, .021);
  mesh.mainIndexCount = mesh.indices.length; return mesh;
}
const patterns = { moustache: moustachePattern(), bowTie: bowTiePattern(), leftEarring: earringPattern(-1), rightEarring: earringPattern(1) };

/** Closed, thin cloth patch. A fixed grid provides coherent cloth silhouettes. */
function clothPatch(mesh: MeshData, columns: number, rows: number, xy: (u: number, v: number) => Vec2, height: (x: number, y: number) => number, thickness: number, lift = 0): void {
  const indexStart = mesh.indices.length;
  const start = mesh.points.length, sheet = (columns + 1) * (rows + 1), rowWidth = rows + 1;
  for (let front = 0; front <= 1; front++) for (let i = 0; i <= columns; i++) for (let j = 0; j <= rows; j++) {
    const [x, y] = xy(i / columns, j / rows); mesh.points.push([x, y, height(x, y) + CATALOG_ACCESSORY_CLEARANCE + lift + front * thickness]);
  }
  for (let i = 0; i < columns; i++) for (let j = 0; j < rows; j++) {
    const a = start + i * rowWidth + j, b = a + rowWidth, c = a + 1, d = b + 1;
    mesh.indices.push(a, c, b, c, d, b, a + sheet, b + sheet, c + sheet, c + sheet, b + sheet, d + sheet);
  }
  const boundary = [
    ...Array.from({ length: columns }, (_, i) => start + i * rowWidth),
    ...Array.from({ length: rows }, (_, j) => start + columns * rowWidth + j),
    ...Array.from({ length: columns }, (_, i) => start + (columns - i) * rowWidth + rows),
    ...Array.from({ length: rows }, (_, j) => start + rows - j),
  ];
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i]!, b = boundary[(i + 1) % boundary.length]!;
    mesh.indices.push(a, b, a + sheet, b, b + sheet, a + sheet);
  }
  const a = mesh.points[start]!, b = mesh.points[start + rowWidth]!, c = mesh.points[start + 1]!;
  if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) < 0) {
    for (let i = indexStart; i < mesh.indices.length; i += 3) [mesh.indices[i + 1], mesh.indices[i + 2]] = [mesh.indices[i + 2]!, mesh.indices[i + 1]!];
  }
}
function scarfPattern(center: Vec3, size: number, height: (x: number, y: number) => number): MeshData {
  const mesh = empty(), [x, y] = center;
  // The collar is draped over the lower-front shoulder. Its ends curve upward
  // and its back follows the actual rounded body, without fabricating a neck.
  clothPatch(mesh, 32, 3, (u, v) => { const t = u * 2 - 1; return [x + .34 * size * t, y + size * (.055 * t * t + (v - .5) * .086)]; }, height, .026 * size);
  // One connected hanging end, with a shallow cut at its hem and a slight fold.
  clothPatch(mesh, 5, 16, (u, v) => {
    const hem = .020 * (1 - Math.abs(u * 2 - 1)) * v ** 8;
    return [x + size * (.105 + .035 * v + (u - .5) * .090), y + size * (.024 - .265 * v + hem)];
  }, height, .022 * size);
  mesh.mainIndexCount = mesh.indices.length;
  clothPatch(mesh, 5, 3, (u, v) => [x + size * (.105 + (u - .5) * .058), y + size * ((v - .5) * .095)], height, .018 * size, .027 * size);
  return mesh;
}
function geometry(mesh: MeshData, attachment: Vec3, seating: number): CatalogAccessoryGeometry {
  const vertices = new Float32Array(mesh.points.length * 6);
  mesh.points.forEach((p, i) => vertices.set(p, i * 6));
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = mesh.indices[i]!, b = mesh.indices[i + 1]!, c = mesh.indices[i + 2]!, n = cross(sub(mesh.points[b]!, mesh.points[a]!), sub(mesh.points[c]!, mesh.points[a]!));
    for (const index of [a, b, c]) for (let k = 0; k < 3; k++) vertices[index * 6 + 3 + k]! += n[k]!;
  }
  for (let i = 0; i < vertices.length; i += 6) {
    const n = normalize([vertices[i + 3]!, vertices[i + 4]!, vertices[i + 5]!]); vertices.set(n, i + 3);
  }
  return { vertices, indices: new Uint16Array(mesh.indices), mainIndexCount: mesh.mainIndexCount, detailIndexCount: mesh.indices.length - mesh.mainIndexCount, attachment, seating };
}
/**
 * Bounded low-poly catalog geometry in body-local coordinates. Rigid pieces
 * retain their authored silhouettes and receive one exact front clearance
 * translation; cloth follows the surface before the same conservative solve.
 * Camera, gaze, eye expression, color and frame history never enter the fit.
 */
export function catalogAccessoryGeometry(body: BodyDesign, accessory: ResolvedAccessoryDesign, squash = 1, contourOverride?: ShapeContour, profileOverride?: ShapeProfile, rotation: Vec3 = accessory.rotation): CatalogAccessoryGeometry {
  if (!['moustache', 'bowTie', 'scarf', 'earring'].includes(accessory.preset)) throw new TypeError('Expected a lower-body catalog accessory.');
  const contour = contourOverride ?? shapeContour({ kind: 'material', name: body.shape }), profile = profileOverride ?? resolveShapeProfile(body.shape), mount = accessoryMountProfile(accessory, profile);
  const frame = sampleAccessorySurface(body, accessory, squash, contour, profile), size = mount.scale * accessory.scale, stretch = 1 / Math.sqrt(squash);
  const scales: Vec3 = [BODY_SIZE[0] * .5 * stretch, BODY_SIZE[1] * .5 * squash, profile.depth * .5 * stretch];
  const height = (x: number, y: number): number => contourVolumeHeight(contour, x / scales[0], y / scales[1]) * scales[2];
  let mesh: MeshData;
  if (accessory.preset === 'scarf') {
    mesh = scarfPattern(frame.position, size, height);
    const lifts = drapedFrontLifts(mesh.points, mesh.indices, contour, scales);
    mesh.points.forEach((point, i) => { point[2] += lifts[i]!; });
    const posed = transform(frame.position, rotation);
    mesh.points = mesh.points.map(point => viewPoint(posed, sub(point, frame.position)));
  } else {
    const pattern = accessory.preset === 'earring' ? patterns[accessory.slot === 'leftEar' ? 'leftEarring' : 'rightEarring'] : patterns[accessory.preset as 'moustache' | 'bowTie'];
    const posed = transform([0, 0, 0], rotation, [size, size, size]);
    mesh = { points: pattern.points.map(point => viewPoint(frame.matrix, viewPoint(posed, point))), indices: [...pattern.indices], mainIndexCount: pattern.mainIndexCount };
  }
  const seating = rigidFrontLift(mesh.points, mesh.indices, contour, scales, CATALOG_ACCESSORY_CLEARANCE);
  for (const point of mesh.points) point[2] += seating;
  if (accessory.preset === 'earring') {
    const sign = accessory.slot === 'leftEar' ? -1 : 1, posed = transform([0, 0, 0], rotation, [size, size, size]);
    const end = viewPoint(frame.matrix, viewPoint(posed, [sign * .044, -.006, .012])); end[2] += seating;
    const radius = .0085 * size, start: Vec3 = [frame.position[0], frame.position[1], frame.position[2] + radius + CATALOG_ACCESSORY_CLEARANCE];
    const path = Array.from({ length: 8 }, (_, i): Vec3 => {
      const t = i / 7, p = start.map((value, k) => value + (end[k]! - value) * t) as Vec3;
      p[2] = Math.max(p[2], height(p[0], p[1]) + radius + CATALOG_ACCESSORY_CLEARANCE); return p;
    });
    const wire = empty(); tube(wire, path, radius);
    const lifts = drapedFrontLifts(wire.points, wire.indices, contour, scales);
    // Keep every wire cross-section circular. The maximum exact correction at
    // either neighboring face raises the complete ring instead of stretching
    // individual tube vertices. The contact end retains its own short seating.
    for (let ring = 0; ring < path.length; ring++) {
      let lift = 0;
      for (let j = 0; j < 8; j++) lift = Math.max(lift, lifts[ring * 8 + j]!);
      if (ring === 0) lift = Math.max(lift, lifts[path.length * 8]!);
      if (ring === path.length - 1) lift = Math.max(lift, lifts[path.length * 8 + 1]!);
      for (let j = 0; j < 8; j++) wire.points[ring * 8 + j]![2] += lift;
      if (ring === 0) wire.points[path.length * 8]![2] += lift;
      if (ring === path.length - 1) wire.points[path.length * 8 + 1]![2] += lift;
    }
    const startIndex = mesh.points.length; mesh.points.push(...wire.points); mesh.indices.push(...wire.indices.map(index => index + startIndex));
    mesh.mainIndexCount = mesh.indices.length;
  }
  return geometry(mesh, [...frame.position], seating);
}
/** Derived fold/knot color remains a solid, camera-independent material. */
export function accessoryDetailColor(color: string): string {
  const value = parseInt(color.slice(1), 16);
  return '#' + [16, 8, 0].map(shift => Math.round(((value >> shift) & 255) * .78).toString(16).padStart(2, '0')).join('');
}
