import { finite } from './design.js';
import { transform } from './math.js';
import type { Mat4 } from './math.js';

/** Viewing rotations in degrees, independent of the avatar's animated pose. */
export interface CameraAngles { yaw: number; pitch: number; roll: number }
export type CameraPreset = 'front' | 'three-quarter' | 'side';
export const CAMERA_PRESETS: Readonly<Record<CameraPreset, Readonly<CameraAngles>>> = Object.freeze({
  front: Object.freeze({ yaw: 0, pitch: 0, roll: 0 }),
  'three-quarter': Object.freeze({ yaw: 45, pitch: 0, roll: 0 }),
  side: Object.freeze({ yaw: 90, pitch: 0, roll: 0 }),
});

/** Validate the entire patch before changing camera state. No design data is involved. */
export function patchCamera(current: CameraAngles, patch: Partial<CameraAngles>): CameraAngles {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('camera: 객체가 필요합니다.');
  const prototype: unknown = Object.getPrototypeOf(patch);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError('camera: 일반 객체가 필요합니다.');
  for (const key of Reflect.ownKeys(patch)) if (key !== 'yaw' && key !== 'pitch' && key !== 'roll') throw new TypeError('지원하지 않는 camera 설정입니다.');
  const value = (axis: keyof CameraAngles): number => Object.hasOwn(patch, axis) ? patch[axis]! : current[axis];
  return {
    yaw: finite(value('yaw'), -360, 360, 'camera.yaw'),
    pitch: finite(value('pitch'), -90, 90, 'camera.pitch'),
    roll: finite(value('roll'), -180, 180, 'camera.roll'),
  };
}

export function createCamera(angles: Partial<CameraAngles> = {}): CameraAngles {
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
