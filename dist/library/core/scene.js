import { createDesign, finite, migrateDesign, parseDesign, ACTIVITIES } from './design.js';
import { createCamera } from './camera.js';
import { MotionTimeline, validateMotionOptions } from './motion.js';
import { parseTrackingMode } from './tracking.js';
import { validateShapeMotionOptions } from './shape-motion.js';
export const MAX_SCENE_BYTES = 65536;
const KEYS = ['sceneVersion', 'design', 'camera', 'activity', 'paused', 'trackingMode', 'interaction', 'renderStyle', 'gaze', 'time', 'motion', 'shapeDuration', 'shapeEasing', 'motionDuration', 'motionEasing'];
function record(value, keys, path) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
        throw new TypeError(`${path}: 일반 객체가 필요합니다.`);
    for (const key of Reflect.ownKeys(value)) {
        const field = Object.getOwnPropertyDescriptor(value, key);
        if (typeof key !== 'string' || !keys.includes(key) || !field.enumerable || !Object.hasOwn(field, 'value'))
            throw new TypeError(`${path}.${String(key)}: 지원하지 않는 데이터입니다.`);
    }
    return value;
}
function jsonData(value, path, depth = 0) {
    if (depth > 12)
        throw new RangeError(`${path}: 데이터가 너무 깊습니다.`);
    if (value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)))
        return;
    if (!value || typeof value !== 'object')
        throw new TypeError(`${path}: JSON 데이터가 필요합니다.`);
    if (Array.isArray(value)) {
        if (Object.getPrototypeOf(value) !== Array.prototype || Reflect.ownKeys(value).length !== value.length + 1)
            throw new TypeError(`${path}: 일반 배열이 필요합니다.`);
        for (let i = 0; i < value.length; i++) {
            const field = Object.getOwnPropertyDescriptor(value, String(i));
            if (!field || !Object.hasOwn(field, 'value') || !field.enumerable)
                throw new TypeError(`${path}: 일반 배열이 필요합니다.`);
            jsonData(field.value, `${path}[${i}]`, depth + 1);
        }
    }
    else {
        const data = record(value, Object.keys(value), path);
        for (const [key, item] of Object.entries(data))
            jsonData(item, `${path}.${key}`, depth + 1);
    }
}
function boolean(value, name) {
    if (typeof value !== 'boolean')
        throw new TypeError(`${name}: boolean이 필요합니다.`);
    return value;
}
function decode(input) {
    if (typeof input !== 'string')
        return input;
    if (new TextEncoder().encode(input).length > MAX_SCENE_BYTES)
        throw new RangeError('장면 JSON은 64 KiB 이하여야 합니다.');
    return JSON.parse(input);
}
/** Strict pure validation: no element, storage or active animation is touched. */
export function parseScene(input) {
    const data = record(decode(input), [...KEYS, 'mouseTracking'], 'scene');
    if (data.sceneVersion !== 1 && data.sceneVersion !== 2)
        throw new TypeError('지원하는 장면 버전은 1 또는 2입니다.');
    const keys = data.sceneVersion === 1 ? KEYS.map(key => key === 'trackingMode' ? 'mouseTracking' : key) : KEYS;
    record(data, keys, 'scene');
    for (const key of keys)
        if (!Object.hasOwn(data, key))
            throw new TypeError(`scene.${key}: 필수 항목입니다.`);
    const cameraData = record(data.camera, ['yaw', 'pitch', 'roll', 'zoom'], 'scene.camera');
    const design = parseDesign(data.design), camera = createCamera({ yaw: finite(cameraData.yaw, -360, 360, 'scene.camera.yaw'), pitch: finite(cameraData.pitch, -90, 90, 'scene.camera.pitch'), roll: finite(cameraData.roll, -180, 180, 'scene.camera.roll'), ...(Object.hasOwn(cameraData, 'zoom') ? { zoom: cameraData.zoom } : {}) });
    if (!ACTIVITIES.includes(data.activity))
        throw new TypeError('scene.activity: 지원하지 않는 활동입니다.');
    if (data.interaction !== 'none' && data.interaction !== 'box')
        throw new TypeError('scene.interaction: none 또는 box가 필요합니다.');
    if (data.renderStyle !== 'flat')
        throw new TypeError('scene.renderStyle: flat이 필요합니다.');
    const gaze = record(data.gaze, ['x', 'y'], 'scene.gaze');
    if (data.shapeEasing !== 'smooth' && data.shapeEasing !== 'linear' || data.motionEasing !== 'smooth' && data.motionEasing !== 'linear')
        throw new TypeError('scene.easing: smooth 또는 linear가 필요합니다.');
    const timing = validateShapeMotionOptions({ duration: finite(data.shapeDuration, 0, 60000, 'scene.shapeDuration'), easing: data.shapeEasing });
    const motionTiming = validateMotionOptions({ duration: finite(data.motionDuration, 0, 60000, 'scene.motionDuration'), easing: data.motionEasing });
    jsonData(data.motion, 'scene.motion');
    const motion = structuredClone(data.motion);
    for (const id of Object.keys(motion.accessories ?? {}))
        if (!design.accessories.some(item => item.id === id))
            throw new RangeError(`scene.motion: 액세서리 ${id}가 없습니다.`);
    const timeline = new MotionTimeline({ left: design.eyes.left, right: design.eyes.right });
    void timeline.to(motion, { duration: 0 });
    return {
        sceneVersion: 2, design, camera, activity: data.activity,
        paused: boolean(data.paused, 'scene.paused'),
        trackingMode: data.sceneVersion === 1 ? (boolean(data.mouseTracking, 'scene.mouseTracking') ? 'eyes' : 'off') : parseTrackingMode(data.trackingMode),
        interaction: data.interaction, renderStyle: 'flat',
        gaze: { x: finite(gaze.x, -1, 1, 'scene.gaze.x'), y: finite(gaze.y, -1, 1, 'scene.gaze.y') },
        time: finite(data.time, 0, 86400, 'scene.time'), motion,
        shapeDuration: timing.duration, shapeEasing: timing.easing,
        motionDuration: motionTiming.duration, motionEasing: motionTiming.easing,
    };
}
/** Complete a scene with runtime defaults; geometry remains solely in the design contract. */
export function createScene(input = {}) {
    const data = record(input, [...KEYS.filter(key => key !== 'sceneVersion'), 'mouseTracking'], 'scene.input');
    if (input.camera !== undefined)
        record(input.camera, ['yaw', 'pitch', 'roll', 'zoom'], 'scene.input.camera');
    if (input.gaze !== undefined)
        record(input.gaze, ['x', 'y'], 'scene.input.gaze');
    const { mouseTracking, ...canonical } = data;
    if (Object.hasOwn(data, 'mouseTracking'))
        boolean(mouseTracking, 'scene.input.mouseTracking');
    return parseScene({
        sceneVersion: 2, design: createDesign(), activity: 'idle', paused: false,
        trackingMode: mouseTracking ? 'eyes' : 'off', interaction: 'none', renderStyle: 'flat', time: 0,
        motion: {}, shapeDuration: 450, shapeEasing: 'smooth', motionDuration: 400, motionEasing: 'smooth',
        ...canonical, camera: createCamera(input.camera), gaze: { x: 0, y: 0, ...input.gaze },
    });
}
/** Accept a versioned scene or an existing v1–v7 design file. */
export function migrateScene(input) {
    const decoded = decode(input);
    if (decoded && typeof decoded === 'object' && Object.hasOwn(decoded, 'sceneVersion'))
        return { scene: parseScene(decoded), warnings: [], legacyDesign: false };
    const migrated = migrateDesign(decoded);
    return { scene: createScene({ design: migrated.design }), warnings: migrated.warnings, legacyDesign: true };
}
export function serializeScene(scene) { return JSON.stringify(parseScene(scene), null, 2); }
