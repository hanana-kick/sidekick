import type { Vec2, Vec3 } from '../core/design.js';
import type { ResolvedAccessoryDesign, ResolvedAvatarDesign } from '../core/resolved-design.js';
import type { ShapeContour } from '../core/contours.js';
import type { ShapeProfile } from '../core/shape-profiles.js';
import { shapeContour } from '../core/contours.js';
import { resolveShapeProfile } from '../core/shape-profiles.js';
import { BODY_SIZE, sampleAccessorySurface } from '../core/surface.js';
import { add, sub, cross, normalize, scale, multiply, transform } from '../core/math.js';
import { viewPoint } from './eye-projection.js';
import type { ProjectedEyes } from './eye-projection.js';
import type { Geometry } from './geometry.js';
import { rigidFrontLift } from './rigid-contact.js';

/** Deliberate rigid-object clearance, including the body tessellation tolerance. */
export const GLASSES_CLEARANCE = 0.009;
/** Retained for diagnostics; a rigid rim is allowed to overhang the face outline. */
export const GLASSES_SHOULDER = 0;
/** 30% more substantial than the previous 0.065 eye-relative tube radius. */
export const GLASSES_TUBE_SCALE = 0.065 * 1.3;
const RING_SEGMENTS = 64, TUBE_SIDES = 8, BRIDGE_SEGMENTS = 24;
export interface RigidLens {
  center: Vec3; tangent: Vec3; bitangent: Vec3; normal: Vec3;
  radius: number; tubeRadius: number;
  vertexStart: number; vertexCount: number; indexStart: number; indexCount: number;
}
export interface GlassesGeometry extends Geometry {
  /** Body-local XY centers follow fitted eyes before whole-accessory rotation. */
  centers: [Vec2, Vec2];
  /** Equal intrinsic radii. Camera foreshortening is never baked into the mesh. */
  radii: Vec2;
  tubeRadius: number;
  /** Uniform radius multiplier from the internal shape/accessory recipe. */
  fit: number;
  lenses: [RigidLens, RigidLens];
  bridge: { vertexStart: number; vertexCount: number; indexStart: number; indexCount: number };
}

/**
 * One rigid, planar front assembly: two circular rims and a straight bridge.
 * Neutral eye size sets one uniform radius; spacing only separates the rims.
 * The complete front starts in the body's XY plane and receives one optional
 * mount/pose rotation about its midpoint, then ONE exact clearance translation
 * against the rendered body. Surface curvature never changes a lens normal,
 * bends the bridge, or projects individual vertices onto the face.
 */
export function glassesGeometry(
  design: ResolvedAvatarDesign,
  accessory: ResolvedAccessoryDesign,
  eyes: ProjectedEyes,
  squash = 1,
  contourOverride?: ShapeContour,
  profileOverride?: ShapeProfile,
  rotation: Vec3 = accessory.rotation,
): GlassesGeometry {
  const contour = contourOverride ?? shapeContour({ kind: 'material', name: design.body.shape });
  const profile = profileOverride ?? resolveShapeProfile(design.body.shape), mount = profile.accessories.glasses;
  const stretch = 1 / Math.sqrt(squash), sx = BODY_SIZE[0] * 0.5 * stretch, sy = BODY_SIZE[1] * 0.5 * squash, sz = profile.depth * 0.5 * stretch;
  // Scale is uniform and independent from spacing, camera, gaze and expressions.
  const size = accessory.scale * mount.scale;
  const radius = Math.max(eyes.size[0] * 1.28, eyes.size[1] * 0.64) * size;
  const tubeRadius = Math.min(...eyes.size) * GLASSES_TUBE_SCALE * size;
  const neutralProfile: ShapeProfile = { ...profile, accessories: { ...profile.accessories, glasses: { anchor: { region: 'face', uv: [0, 0.1], offset: 0 }, rotation: [0, 0, 0], scale: 1 } } };
  const reference = sampleAccessorySurface(design.body, accessory, squash, contour, neutralProfile);
  const calibrated = sampleAccessorySurface(design.body, accessory, squash, contour, profile);
  const shift: Vec2 = [calibrated.position[0] - reference.position[0], calibrated.position[1] - reference.position[1]];
  const orientation = multiply(transform([0, 0, 0], mount.rotation), transform([0, 0, 0], rotation));
  const axes: [Vec3, Vec3, Vec3] = [[orientation[0]!, orientation[1]!, orientation[2]!], [orientation[4]!, orientation[5]!, orientation[6]!], [orientation[8]!, orientation[9]!, orientation[10]!]];
  const pivot: Vec3 = [(eyes.left.localCenter[0] + eyes.right.localCenter[0]) * 0.5 + shift[0], (eyes.left.localCenter[1] + eyes.right.localCenter[1]) * 0.5 + shift[1], 0];
  const points: Vec3[] = [], indices: number[] = [];
  const appendTubeIndices = (base: number, segments: number, reverse = false): void => {
    for (let i = 0; i < segments; i++) for (let j = 0; j < TUBE_SIDES; j++) {
      const a = base + i * (TUBE_SIDES + 1) + j, b = a + TUBE_SIDES + 1;
      if (reverse) indices.push(a, a + 1, b, b, a + 1, b + 1);
      else indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  };
  const makeLens = (eyeCenter: Vec3): RigidLens => {
    // Eye surface Z and local slopes must never enter the front-frame fit.
    const offset: Vec3 = [eyeCenter[0] + shift[0] - pivot[0], eyeCenter[1] + shift[1] - pivot[1], 0];
    const center = add(pivot, viewPoint(orientation, offset));
    const vertexStart = points.length, indexStart = indices.length;
    for (let i = 0; i <= RING_SEGMENTS; i++) {
      const angle = i / RING_SEGMENTS * Math.PI * 2, c = Math.cos(angle), s = Math.sin(angle);
      for (let j = 0; j <= TUBE_SIDES; j++) {
        const tubeAngle = j / TUBE_SIDES * Math.PI * 2, radial = radius + tubeRadius * Math.cos(tubeAngle);
        const local: Vec3 = [radial * c, radial * s, tubeRadius * Math.sin(tubeAngle)];
        points.push(add(center, viewPoint(orientation, local)));
      }
    }
    appendTubeIndices(vertexStart, RING_SEGMENTS);
    return { center, tangent: axes[0], bitangent: axes[1], normal: axes[2], radius, tubeRadius, vertexStart, vertexCount: points.length - vertexStart, indexStart, indexCount: indices.length - indexStart };
  };
  const lenses: [RigidLens, RigidLens] = [makeLens(eyes.left.localCenter), makeLens(eyes.right.localCenter)];
  const centers = lenses.map(lens => [lens.center[0], lens.center[1]] as Vec2) as [Vec2, Vec2];
  const direction = normalize(sub(lenses[1].center, lenses[0].center));
  const from = add(lenses[0].center, scale(direction, radius)), to = add(lenses[1].center, scale(direction, -radius));
  const up = normalize(cross(axes[2], direction));
  const bridge = { vertexStart: points.length, vertexCount: 0, indexStart: indices.length, indexCount: 0 };
  for (let i = 0; i <= BRIDGE_SEGMENTS; i++) {
    const amount = i / BRIDGE_SEGMENTS;
    const center = add(from, scale(sub(to, from), amount));
    for (let j = 0; j <= TUBE_SIDES; j++) {
      const angle = j / TUBE_SIDES * Math.PI * 2;
      points.push(add(center, add(scale(up, tubeRadius * Math.cos(angle)), scale(axes[2], tubeRadius * Math.sin(angle)))));
    }
  }
  // A straight tube's longitudinal/circumference order has the opposite winding
  // from a torus. Keep outward normals so exact clearance reads its back faces.
  appendTubeIndices(bridge.vertexStart, BRIDGE_SEGMENTS, true);
  bridge.vertexCount = points.length - bridge.vertexStart; bridge.indexCount = indices.length - bridge.indexStart;
  const lift = rigidFrontLift(points, indices, contour, [sx, sy, sz], GLASSES_CLEARANCE + mount.anchor.offset);
  for (const point of points) point[2] += lift;
  for (const lens of lenses) lens.center[2] += lift;
  const vertices = new Float32Array(points.length * 6);
  points.forEach((point, i) => vertices.set(point, i * 6));
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i]! * 6, b = indices[i + 1]! * 6, c = indices[i + 2]! * 6;
    const u: Vec3 = [vertices[b]! - vertices[a]!, vertices[b + 1]! - vertices[a + 1]!, vertices[b + 2]! - vertices[a + 2]!];
    const v: Vec3 = [vertices[c]! - vertices[a]!, vertices[c + 1]! - vertices[a + 1]!, vertices[c + 2]! - vertices[a + 2]!], n = cross(u, v);
    for (const at of [a, b, c]) for (let k = 0; k < 3; k++) vertices[at + 3 + k]! += n[k]!;
  }
  for (let i = 0; i < vertices.length; i += 6) {
    const normal = normalize([vertices[i + 3]!, vertices[i + 4]!, vertices[i + 5]!]); vertices.set(normal, i + 3);
  }
  return { vertices, indices: new Uint16Array(indices), centers, radii: [radius, radius], tubeRadius, fit: size, lenses, bridge };
}
