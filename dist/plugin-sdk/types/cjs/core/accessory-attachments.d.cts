import type { AccessorySlot, BodyDesign, Vec3 } from './design.cjs';
import type { ShapeContour } from './contours.cjs';
import type { ShapeProfile } from './shape-profiles.cjs';
import type { SurfaceFrame } from './surface.cjs';
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
export declare const ACCESSORY_ATTACHMENT_POINTS: readonly AccessoryAttachmentPoint[];
/** Body-local frame; the renderer applies body orientation and movement exactly once afterward. */
export declare function getAccessoryAttachmentFrame(body: BodyDesign, point: AccessoryAttachmentPoint, options?: AttachmentFrameOptions): AccessoryAttachmentFrame;
/** Resolve multiple points in the same body/morph frame, useful for authored bridges or bands. */
export declare function getAccessoryAttachmentFrames(body: BodyDesign, points: readonly AccessoryAttachmentPoint[], options?: AttachmentFrameOptions): AccessoryAttachmentFrame[];
/** Convert an author-local point into body-local coordinates using a supplied attachment frame. */
export declare function attachmentPointToBody(frame: AccessoryAttachmentFrame, point: Vec3): Vec3;
