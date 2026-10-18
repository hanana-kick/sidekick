import type { Mat4 } from './math.js';
/** Authored body-facing rotations in degrees, composed with the animated pose. */
export interface BodyOrientation {
    yaw: number;
    pitch: number;
    roll: number;
}
export type BodyOrientationPreset = 'front' | 'three-quarter' | 'side';
export declare const BODY_ORIENTATION_PRESETS: Readonly<Record<BodyOrientationPreset, Readonly<BodyOrientation>>>;
/** Validate the entire patch before changing bodyOrientation state. No design data is involved. */
export declare function patchBodyOrientation(current: BodyOrientation, patch: Partial<BodyOrientation>): BodyOrientation;
export declare function createBodyOrientation(angles?: Partial<BodyOrientation>): BodyOrientation;
export declare function bodyOrientationPreset(name: BodyOrientationPreset): BodyOrientation;
/**
 * Body-facing rotation: positive yaw turns the front toward screen
 * right; positive pitch tilts its top toward the viewer; positive roll turns counterclockwise.
 * Compose the authored body orientation with the animated model matrix.
 */
export declare function bodyOrientationMatrix(bodyOrientation: BodyOrientation): Mat4;
