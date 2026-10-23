import { ACCESSORY_SLOTS } from './design.js';
import { RIGGING_LIMITS, validateSkeleton } from './rigging.js';
function plain(value, name) {
    if (!value || typeof value !== 'object' || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null))
        throw new TypeError(`${name} must be a plain data object.`);
    const result = Object.create(null);
    for (const key of Reflect.ownKeys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (typeof key !== 'string' || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value'))
            throw new TypeError(`${name} requires enumerable data fields, not symbols or accessors.`);
        result[key] = descriptor.value;
    }
    return result;
}
function keys(input, allowed, name) {
    if (Object.keys(input).some(key => !allowed.includes(key)))
        throw new TypeError(`${name} contains unsupported fields.`);
}
function dataArray(value, min, max, name) {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype)
        throw new TypeError(`${name} must be a plain array.`);
    if (value.length < min || value.length > max)
        throw new RangeError(`${name} requires ${min}–${max} entries.`);
    if (Reflect.ownKeys(value).length !== value.length + 1)
        throw new TypeError(`${name} must be dense, without extra fields.`);
    return Array.from({ length: value.length }, (_, index) => {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value'))
            throw new TypeError(`${name} entries must be data, not accessors or holes.`);
        return descriptor.value;
    });
}
/** Validate and own all mutable input, suitable for worker messages and later author edits. */
export function validateBodyRig(value) {
    const input = plain(value, 'Body rig');
    keys(input, ['skeleton', 'influences', 'fallbackBone', 'attachments'], 'Body rig');
    const skeleton = validateSkeleton(input.skeleton), names = new Set(skeleton.bones.map(bone => bone.id));
    const boneName = (value) => {
        if (typeof value !== 'string' || !names.has(value))
            throw new TypeError('Body rig references an unknown bone.');
        return value;
    };
    const seen = new Set();
    const influences = dataArray(input.influences, 0, RIGGING_LIMITS.maxBones, 'Body influences').map(value => {
        const field = plain(value, 'Body influence');
        keys(field, ['bone', 'center', 'radius'], 'Body influence');
        const bone = boneName(field.bone);
        if (seen.has(bone))
            throw new TypeError('Body influences must name unique bones.');
        seen.add(bone);
        const center = dataArray(field.center, 3, 3, 'Body influence center');
        if (!center.every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 16))
            throw new RangeError('Body influence center requires three finite coordinates within 16 units.');
        if (typeof field.radius !== 'number' || !Number.isFinite(field.radius) || field.radius <= 0 || field.radius > 32)
            throw new RangeError('Body influence radius must be positive and at most 32 units.');
        return { bone, center: center, radius: field.radius };
    });
    const fallbackBone = input.fallbackBone === undefined ? undefined : boneName(input.fallbackBone);
    let attachments;
    if (input.attachments !== undefined) {
        const map = plain(input.attachments, 'Body attachments');
        keys(map, ACCESSORY_SLOTS, 'Body attachments');
        attachments = Object.fromEntries(Object.entries(map).map(([slot, bone]) => [slot, boneName(bone)]));
    }
    return { skeleton, influences, ...(fallbackBone === undefined ? {} : { fallbackBone }), ...(attachments === undefined ? {} : { attachments }) };
}
/** Select the four strongest compact quadratic fields, normalize, and use a rigid fallback outside. */
export function createBodySkinBinding(vertices, input) {
    const rig = validateBodyRig(input);
    if (!vertices || Object.getPrototypeOf(vertices) !== Float32Array.prototype)
        throw new TypeError('Body skin requires a plain Float32Array.');
    const typed = Object.getPrototypeOf(Float32Array.prototype);
    const length = Object.getOwnPropertyDescriptor(typed, 'length').get.call(vertices);
    const buffer = Object.getOwnPropertyDescriptor(typed, 'buffer').get.call(vertices);
    if (!(buffer instanceof ArrayBuffer) || length < 6 || length > RIGGING_LIMITS.maxVertices * 6 || length % 6 !== 0)
        throw new RangeError('Body skin requires 1–16384 interleaved position/normal vertices.');
    const vertexKeys = Reflect.ownKeys(vertices);
    if (vertexKeys.length !== length || vertexKeys.some((key, i) => key !== String(i)))
        throw new TypeError('Body skin vertices cannot contain extra fields or accessors.');
    if (!Float32Array.prototype.every.call(vertices, Number.isFinite))
        throw new TypeError('Body skin vertices must be finite.');
    const count = length / 6, joints = new Uint8Array(count * 4), weights = new Float32Array(count * 4);
    const names = new Map(rig.skeleton.bones.map((bone, index) => [bone.id, index]));
    const fields = rig.influences.map(field => ({ ...field, joint: names.get(field.bone) }));
    const fallback = names.get(rig.fallbackBone ?? rig.skeleton.bones[0].id);
    for (let vertex = 0; vertex < count; vertex++) {
        const at = vertex * 6, offset = vertex * 4;
        const strongest = [];
        for (const field of fields) {
            const distance = Math.hypot(vertices[at] - field.center[0], vertices[at + 1] - field.center[1], vertices[at + 2] - field.center[2]);
            const weight = Math.max(0, 1 - distance / field.radius) ** 2;
            if (!weight)
                continue;
            const rank = strongest.findIndex(other => weight > other.weight);
            if (rank < 0) {
                if (strongest.length < 4)
                    strongest.push({ joint: field.joint, weight });
            }
            else {
                strongest.splice(rank, 0, { joint: field.joint, weight });
                if (strongest.length > 4)
                    strongest.pop();
            }
        }
        if (!strongest.length) {
            joints[offset] = fallback;
            weights[offset] = 1;
            continue;
        }
        const total = strongest.reduce((sum, field) => sum + field.weight, 0);
        strongest.forEach((field, index) => { joints[offset + index] = field.joint; weights[offset + index] = field.weight / total; });
    }
    return { skeleton: rig.skeleton, joints, weights };
}
