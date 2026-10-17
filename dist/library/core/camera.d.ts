import type { Mat4 } from './math.js';
/** Viewing rotations in degrees, independent of the avatar's animated pose. */
export interface CameraAngles {
    yaw: number;
    pitch: number;
    roll: number;
}
export type CameraPreset = 'front' | 'three-quarter' | 'side';
export declare const CAMERA_PRESETS: Readonly<Record<CameraPreset, Readonly<CameraAngles>>>;
/** Validate the entire patch before changing camera state. No design data is involved. */
export declare function patchCamera(current: CameraAngles, patch: Partial<CameraAngles>): CameraAngles;
export declare function createCamera(angles?: Partial<CameraAngles>): CameraAngles;
export declare function cameraPreset(name: CameraPreset): CameraAngles;
/**
 * Legacy-compatible view rotation: positive yaw turns the front toward screen
 * right; positive pitch tilts its top toward the viewer; positive roll turns counterclockwise.
 * Apply this matrix before the separate body model matrix (view * model).
 */
export declare function cameraViewMatrix(camera: CameraAngles): Mat4;
