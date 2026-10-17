import { finite } from './design.js';
import { clamp, transform } from './math.js';
import type { Mat4 } from './math.js';

/** Viewing rotations in degrees, independent of the avatar's animated pose. */
export interface CameraAngles { yaw: number; pitch: number; roll: number }
/** Centered orthographic magnification, independent of model geometry and pose. */
export interface CameraState extends CameraAngles { zoom: number }
export const CAMERA_ZOOM_RANGE = Object.freeze({ min: 0.5, max: 3, default: 1 });
export type CameraPreset = 'front' | 'three-quarter' | 'side';
export const CAMERA_PRESETS: Readonly<Record<CameraPreset, Readonly<CameraAngles>>> = Object.freeze({
  front: Object.freeze({ yaw: 0, pitch: 0, roll: 0 }),
  'three-quarter': Object.freeze({ yaw: 45, pitch: 0, roll: 0 }),
  side: Object.freeze({ yaw: 90, pitch: 0, roll: 0 }),
});

/** Validate the entire patch before changing camera state. No design data is involved. */
export function patchCamera(current: CameraAngles & Partial<Pick<CameraState, 'zoom'>>, patch: Partial<CameraState>): CameraState {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('camera: 객체가 필요합니다.');
  const prototype: unknown = Object.getPrototypeOf(patch);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError('camera: 일반 객체가 필요합니다.');
  for (const key of Reflect.ownKeys(patch)) if (key !== 'yaw' && key !== 'pitch' && key !== 'roll' && key !== 'zoom') throw new TypeError('지원하지 않는 camera 설정입니다.');
  const value = (axis: keyof CameraState): number => Object.hasOwn(patch, axis) ? patch[axis]! : (axis === 'zoom' ? current.zoom ?? 1 : current[axis]);
  return {
    yaw: finite(value('yaw'), -360, 360, 'camera.yaw'),
    pitch: finite(value('pitch'), -90, 90, 'camera.pitch'),
    roll: finite(value('roll'), -180, 180, 'camera.roll'),
    zoom: finite(value('zoom'), CAMERA_ZOOM_RANGE.min, CAMERA_ZOOM_RANGE.max, 'camera.zoom'),
  };
}

export function createCamera(angles: Partial<CameraState> = {}): CameraState {
  return patchCamera(CAMERA_PRESETS.front, angles);
}

export function cameraPreset(name: CameraPreset): CameraAngles {
  if (typeof name !== 'string' || !Object.hasOwn(CAMERA_PRESETS, name)) throw new TypeError('camera preset은 front, three-quarter, side 중 하나여야 합니다.');
  return { ...CAMERA_PRESETS[name] };
}

/**
 * Legacy-compatible view rotation: positive yaw turns the front toward screen
 * right; positive pitch tilts its top toward the viewer; positive roll turns counterclockwise.
 * Apply this matrix before the separate body model matrix (view * model).
 */
export function cameraViewMatrix(camera: CameraAngles): Mat4 {
  const { yaw, pitch, roll } = createCamera(camera), radians = Math.PI / 180;
  return transform([0, 0, 0], [pitch * radians, yaw * radians, roll * radians]);
}

/** Normalize wheel units to CSS pixels; page deltas use the preview height. */
export function wheelZoom(zoom: number, deltaY: number, deltaMode = 0, pageHeight = 200): number {
  if (!Number.isFinite(deltaY)) return zoom;
  const pixels = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? Math.max(1, pageHeight) : 1);
  return clamp(zoom * Math.exp(clamp(-pixels * .002, -20, 20)), CAMERA_ZOOM_RANGE.min, CAMERA_ZOOM_RANGE.max);
}

/** Distance-only pinch scale. The centroid never changes camera translation. */
export function pinchZoom(zoom: number, previousDistance: number, distance: number): number {
  if (!Number.isFinite(distance) || !Number.isFinite(previousDistance) || previousDistance <= 0 || distance <= 0) return zoom;
  return clamp(zoom * distance / previousDistance, CAMERA_ZOOM_RANGE.min, CAMERA_ZOOM_RANGE.max);
}
