import type { AccessorySlot, BodyDesign, Vec3 } from './design.js';
import type { ShapeContour } from './contours.js';
import type { ShapeProfile } from './shape-profiles.js';
import type { Anchor } from './resolved-design.js';
import { sampleSurface } from './surface.js';
import type { SurfaceFrame } from './surface.js';

/** Named rigid mounting locations. Local +X is tangent, +Y bitangent, +Z outward normal. */
export type AccessoryAttachmentPoint = AccessorySlot | 'leftEye' | 'rightEye';
export interface AccessoryAttachmentFrame extends SurfaceFrame {
  /** Model units, not pixels. Frame basis is orthonormal; no hidden accessory scaling. */
  scale: number;
}
export interface AttachmentFrameOptions {
  squash?: number;
  /** Advanced renderer integration: current morph, not just the destination shape. */
  contour?: ShapeContour;
  profile?: ShapeProfile;
}
const anchors: Record<AccessoryAttachmentPoint, Anchor> = {
  head: { region: 'crown', uv: [0, 0], offset: 0 },
  eyes: { region: 'face', uv: [0, 0.1], offset: 0 },
  leftEye: { region: 'face', uv: [-0.3, 0.1], offset: 0 },
  rightEye: { region: 'face', uv: [0.3, 0.1], offset: 0 },
  mouth: { region: 'face', uv: [0, -0.23], offset: 0 },
  neck: { region: 'face', uv: [0, -0.55], offset: 0 },
  leftEar: { region: 'left', uv: [0, -0.15], offset: 0 },
  rightEar: { region: 'right', uv: [0, -0.15], offset: 0 },
};
export const ACCESSORY_ATTACHMENT_POINTS = Object.freeze(Object.keys(anchors) as AccessoryAttachmentPoint[]);
/** Body-local frame; the renderer applies body orientation and movement exactly once afterward. */
export function getAccessoryAttachmentFrame(body: BodyDesign, point: AccessoryAttachmentPoint, options: AttachmentFrameOptions = {}): AccessoryAttachmentFrame {
  if (!Object.hasOwn(anchors, point)) throw new TypeError(`Unknown accessory attachment point: ${point}`);
  const squash = options.squash ?? 1;
  if (!Number.isFinite(squash) || squash < 0.25 || squash > 4) throw new RangeError('Attachment squash must be between 0.25 and 4.');
  return { ...sampleSurface(body, anchors[point], squash, options.contour, options.profile), scale: 1 };
}
/** Resolve multiple points in the same body/morph frame, useful for authored bridges or bands. */
export function getAccessoryAttachmentFrames(body: BodyDesign, points: readonly AccessoryAttachmentPoint[], options: AttachmentFrameOptions = {}): AccessoryAttachmentFrame[] {
  return points.map(point => getAccessoryAttachmentFrame(body, point, options));
}
/** Convert an author-local point into body-local coordinates using a supplied attachment frame. */
export function attachmentPointToBody(frame: AccessoryAttachmentFrame, point: Vec3): Vec3 {
  if (point.length !== 3 || !point.every(Number.isFinite)) throw new TypeError('Attachment point must have three finite coordinates.');
  return frame.position.map((value, i) => value + frame.scale * (frame.tangent[i]! * point[0] + frame.bitangent[i]! * point[1] + frame.normal[i]! * point[2])) as Vec3;
}
