import type { Mat4 } from './math.js';
/** Viewing rotations in degrees, independent of the avatar's animated pose. */
export interface CameraAngles {
    yaw: number;
    pitch: number;
    roll: number;
}
/** Centered orthographic magnification, independent of model geometry and pose. */
export interface CameraState extends CameraAngles {
    zoom: number;
}
export declare const CAMERA_ZOOM_RANGE: Readonly<{
    min: 0.5;
    max: 3;
    default: 1;
}>;
export type CameraPreset = 'front' | 'three-quarter' | 'side';
export declare const CAMERA_PRESETS: Readonly<Record<CameraPreset, Readonly<CameraAngles>>>;
/** Validate the entire patch before changing camera state. No design data is involved. */
export declare function patchCamera(current: CameraAngles & Partial<Pick<CameraState, 'zoom'>>, patch: Partial<CameraState>): CameraState;
export declare function createCamera(angles?: Partial<CameraState>): CameraState;
export declare function cameraPreset(name: CameraPreset): CameraAngles;
/**
 * Legacy-compatible view rotation: positive yaw turns the front toward screen
 * right; positive pitch tilts its top toward the viewer; positive roll turns counterclockwise.
 * Apply this matrix before the separate body model matrix (view * model).
 */
export declare function cameraViewMatrix(camera: CameraAngles): Mat4;
/** Normalize wheel units to CSS pixels; page deltas use the preview height. */
export declare function wheelZoom(zoom: number, deltaY: number, deltaMode?: number, pageHeight?: number): number;
/** Distance-only pinch scale. The centroid never changes camera translation. */
export declare function pinchZoom(zoom: number, previousDistance: number, distance: number): number;
