import type { BodyDesign } from './design.cjs';
import type { AccessoryPluginAttachment, AccessoryPluginMount } from './accessory-plugins.cjs';
import type { MaterialShapeName } from './shapes.cjs';
import type { ShapeContour } from './contours.cjs';
import type { AccessoryAttachmentFrame } from './accessory-attachments.cjs';
import type { AccessoryPluginEyeMeasurements } from './plugin-deformation.cjs';
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
