import type { AvatarDesign, Vec2 } from './design.cjs';
import type { ShapeContour } from './contours.cjs';
import type { ShapeProfile } from './shape-profiles.cjs';
import type { AccessoryPluginEyeMeasurements } from './plugin-deformation.cjs';
export interface AccessoryPluginEyeMeasurementOptions {
    face?: Vec2;
    squash?: number;
    contour?: ShapeContour;
    profile?: ShapeProfile;
}
/** Current neutral fitted eye geometry: follows face motion, never gaze or expression weights. */
export declare function getAccessoryPluginEyeMeasurements(design: AvatarDesign, options?: AccessoryPluginEyeMeasurementOptions): AccessoryPluginEyeMeasurements;
