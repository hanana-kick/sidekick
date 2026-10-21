import type { BodyDesign } from './design.js';
import type { AccessoryPluginAttachment, AccessoryPluginMount } from './accessory-plugins.js';
import type { MaterialShapeName } from './shapes.js';
import type { ShapeContour } from './contours.js';
import type { AccessoryAttachmentFrame } from './accessory-attachments.js';
import type { AccessoryPluginEyeMeasurements } from './plugin-deformation.js';
export type ShapeWeights = Readonly<Partial<Record<MaterialShapeName, number>>>;
export interface AccessoryPluginAttachmentFrameOptions {
    contour?: ShapeContour;
    depth?: number;
    squash?: number;
    shapeWeights?: ShapeWeights;
    eyes?: AccessoryPluginEyeMeasurements;
}
/** Blend only asset-owned calibration data, including interrupted morph provenance. */
export declare function resolveAccessoryPluginMount(attachment: AccessoryPluginAttachment, shape: MaterialShapeName, weights?: ShapeWeights): AccessoryPluginMount;
/** Neutral calibrated frame BEFORE mesh clearance. Matrix is orthonormal; scale is separate.
 * Explicit part-animation translation/scale continue to use the public slot frame.
 */
export declare function getAccessoryPluginAttachmentFrame(body: BodyDesign, attachment: AccessoryPluginAttachment, options?: AccessoryPluginAttachmentFrameOptions): AccessoryAttachmentFrame;
