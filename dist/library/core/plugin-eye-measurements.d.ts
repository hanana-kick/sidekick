import type { AvatarDesign, Vec2 } from './design.js';
import type { ShapeContour } from './contours.js';
import type { ShapeProfile } from './shape-profiles.js';
import type { AccessoryPluginEyeMeasurements } from './plugin-deformation.js';
export interface AccessoryPluginEyeMeasurementOptions {
    face?: Vec2;
    squash?: number;
    contour?: ShapeContour;
    profile?: ShapeProfile;
}
/** Current neutral fitted eye geometry: follows face motion, never gaze or expression weights. */
export declare function getAccessoryPluginEyeMeasurements(design: AvatarDesign, options?: AccessoryPluginEyeMeasurementOptions): AccessoryPluginEyeMeasurements;
