import { finite } from './design.js';
import { transform } from './math.js';
export const BODY_ORIENTATION_PRESETS = Object.freeze({
    front: Object.freeze({ yaw: 0, pitch: 0, roll: 0 }),
    'three-quarter': Object.freeze({ yaw: 45, pitch: 0, roll: 0 }),
    side: Object.freeze({ yaw: 90, pitch: 0, roll: 0 }),
});
/** Validate the entire patch before changing bodyOrientation state. No design data is involved. */
export function patchBodyOrientation(current, patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch))
        throw new TypeError('bodyOrientation: 객체가 필요합니다.');
    const prototype = Object.getPrototypeOf(patch);
    if (prototype !== Object.prototype && prototype !== null)
        throw new TypeError('bodyOrientation: 일반 객체가 필요합니다.');
    for (const key of Reflect.ownKeys(patch)) {
        const descriptor = Object.getOwnPropertyDescriptor(patch, key);
        if ((key !== 'yaw' && key !== 'pitch' && key !== 'roll') || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable)
            throw new TypeError('지원하지 않는 bodyOrientation 설정입니다.');
    }
    const value = (axis) => Object.hasOwn(patch, axis) ? patch[axis] : current[axis];
    return {
        yaw: finite(value('yaw'), -360, 360, 'bodyOrientation.yaw'),
        pitch: finite(value('pitch'), -90, 90, 'bodyOrientation.pitch'),
        roll: finite(value('roll'), -180, 180, 'bodyOrientation.roll'),
    };
}
export function createBodyOrientation(angles = {}) {
    return patchBodyOrientation(BODY_ORIENTATION_PRESETS.front, angles);
}
export function bodyOrientationPreset(name) {
    if (typeof name !== 'string' || !Object.hasOwn(BODY_ORIENTATION_PRESETS, name))
        throw new TypeError('bodyOrientation preset은 front, three-quarter, side 중 하나여야 합니다.');
    return { ...BODY_ORIENTATION_PRESETS[name] };
}
/**
 * Body-facing rotation: positive yaw turns the front toward screen
 * right; positive pitch tilts its top toward the viewer; positive roll turns counterclockwise.
 * Compose the authored body orientation with the animated model matrix.
 */
export function bodyOrientationMatrix(bodyOrientation) {
    const { yaw, pitch, roll } = createBodyOrientation(bodyOrientation), radians = Math.PI / 180;
    return transform([0, 0, 0], [pitch * radians, yaw * radians, roll * radians]);
}
