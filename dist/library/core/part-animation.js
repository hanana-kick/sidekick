import { isAccessoryInstanceId } from './accessory-id.js';
import { isBoneId } from './rigging.js';
export const PART_ANIMATION_LIMITS = Object.freeze({ maxTracks: 128, maxKeyframes: 4096, maxDuration: 86400 });
function object(value, keys, path) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
        throw new TypeError(`${path} must be a plain data object.`);
    for (const key of Reflect.ownKeys(value)) {
        const field = Object.getOwnPropertyDescriptor(value, key);
        if (typeof key !== 'string' || !keys.includes(key) || !field.enumerable || !Object.hasOwn(field, 'value'))
            throw new TypeError(`${path} contains unsupported or accessor data.`);
    }
    return value;
}
function array(value, maximum, path) {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum || Reflect.ownKeys(value).length !== value.length + 1)
        throw new TypeError(`${path} must be a bounded dense plain array.`);
    for (let i = 0; i < value.length; i++) {
        const field = Object.getOwnPropertyDescriptor(value, String(i));
        if (!field?.enumerable || !Object.hasOwn(field, 'value'))
            throw new TypeError(`${path} must not contain holes or accessors.`);
    }
    return value;
}
function number(value, low, high, path) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high)
        throw new RangeError(`${path} must be finite and within ${low}..${high}.`);
    return value;
}
function vector(value, length, low, high) {
    const input = array(value, length, 'keyframe value');
    if (input.length !== length)
        throw new TypeError(`Keyframe value requires ${length} components.`);
    return input.map(item => number(item, low, high, 'keyframe component'));
}
function id(value) {
    if (!isAccessoryInstanceId(value))
        throw new TypeError('Invalid accessory animation id.');
    return value;
}
function boneId(value) {
    if (!isBoneId(value))
        throw new TypeError('Invalid bone animation id.');
    return value;
}
/** Strict validation and defensive copy. Call once when accepting a clip, not on every frame. */
export function validatePartAnimation(value) {
    const input = object(value, ['duration', 'loop', 'tracks'], 'clip');
    const duration = number(input.duration, Number.MIN_VALUE, PART_ANIMATION_LIMITS.maxDuration, 'duration');
    if (Object.hasOwn(input, 'loop') && typeof input.loop !== 'boolean')
        throw new TypeError('loop must be boolean.');
    const inputs = array(input.tracks, PART_ANIMATION_LIMITS.maxTracks, 'tracks'), channels = new Set();
    let total = 0;
    if (!inputs.length)
        throw new RangeError('A part animation requires at least one track.');
    const tracks = inputs.map(raw => {
        const track = object(raw, ['target', 'channel', 'keyframes', 'interpolation'], 'track');
        if (Object.hasOwn(track, 'interpolation') && track.interpolation !== 'linear' && track.interpolation !== 'smooth')
            throw new TypeError('interpolation must be linear or smooth.');
        let target, length, low, high;
        if (typeof track.target === 'string') {
            target = track.target;
            if (target === 'body' && track.channel === 'rotation') {
                length = 3;
                low = -Math.PI * 2;
                high = Math.PI * 2;
            }
            else if (target === 'face' && track.channel === 'uv') {
                length = 2;
                low = -.5;
                high = .5;
            }
            else if ((target === 'leftEye' || target === 'rightEye') && track.channel === 'weights') {
                length = 2;
                low = 0;
                high = 1;
            }
            else
                throw new TypeError('Unsupported part target/channel combination.');
        }
        else {
            const addressed = object(track.target, ['accessory', 'bone'], 'target');
            if (Object.hasOwn(addressed, 'bone')) {
                target = { bone: boneId(addressed.bone), ...(Object.hasOwn(addressed, 'accessory') ? { accessory: id(addressed.accessory) } : {}) };
                if (track.channel === 'position') {
                    length = 3;
                    low = -16;
                    high = 16;
                }
                else if (track.channel === 'rotation') {
                    length = 3;
                    low = -Math.PI * 2;
                    high = Math.PI * 2;
                }
                else
                    throw new TypeError('Unsupported bone animation channel.');
            }
            else {
                target = { accessory: id(addressed.accessory) };
                if (track.channel === 'opacity') {
                    length = 0;
                    low = 0;
                    high = 1;
                }
                else if (track.channel === 'scale') {
                    length = 3;
                    low = .01;
                    high = 16;
                }
                else if (track.channel === 'position') {
                    length = 3;
                    low = -16;
                    high = 16;
                }
                else if (track.channel === 'rotation') {
                    length = 3;
                    low = -Math.PI * 2;
                    high = Math.PI * 2;
                }
                else
                    throw new TypeError('Unsupported accessory animation channel.');
            }
        }
        // Encode path segments separately: valid identifiers may themselves contain ':' or '/'.
        const channelKey = JSON.stringify(typeof target === 'string' ? ['part', target, track.channel]
            : typeof target.bone === 'string' ? ['bone', target.accessory ?? null, target.bone, track.channel]
                : ['accessory', target.accessory, track.channel]);
        if (channels.has(channelKey))
            throw new TypeError('Each animation target/channel must be unique.');
        channels.add(channelKey);
        const frames = array(track.keyframes, PART_ANIMATION_LIMITS.maxKeyframes, 'keyframes');
        total += frames.length;
        if (!frames.length || total > PART_ANIMATION_LIMITS.maxKeyframes)
            throw new RangeError('Animation requires 1..4096 total keyframes.');
        let previous = -1;
        const keyframes = frames.map(rawFrame => {
            const frame = object(rawFrame, ['time', 'value'], 'keyframe'), time = number(frame.time, 0, duration, 'keyframe time');
            if (time <= previous)
                throw new RangeError('Keyframe times must be strictly increasing.');
            previous = time;
            return { time, value: length === 0 ? number(frame.value, low, high, 'keyframe value') : vector(frame.value, length, low, high) };
        });
        return { target, channel: track.channel, keyframes, ...(track.interpolation === undefined ? {} : { interpolation: track.interpolation }) };
    });
    return { duration, ...(input.loop === undefined ? {} : { loop: input.loop }), tracks };
}
function sampleTrack(track, time) {
    const frames = track.keyframes;
    const first = frames[0], last = frames[frames.length - 1];
    const copy = (value) => typeof value === 'number' ? value : [...value];
    if (time <= first.time)
        return copy(first.value);
    if (time >= last.time)
        return copy(last.value);
    let low = 0, high = frames.length - 1;
    while (high - low > 1) {
        const middle = (low + high) >>> 1;
        if (frames[middle].time <= time)
            low = middle;
        else
            high = middle;
    }
    const a = frames[low], b = frames[high];
    if (time === a.time)
        return copy(a.value);
    let t = (time - a.time) / (b.time - a.time);
    if (track.interpolation === 'smooth')
        t = t * t * (3 - 2 * t);
    if (typeof a.value === 'number')
        return a.value + (b.value - a.value) * t;
    return a.value.map((value, index) => value + (b.value[index] - value) * t);
}
/** Sample a validated clip deterministically; endpoint values hold outside each track's key range. */
export function samplePartAnimation(clip, time) {
    if (!Number.isFinite(time))
        throw new RangeError('Animation time must be finite.');
    const remainder = time % clip.duration;
    const local = clip.loop ? (remainder < 0 ? remainder + clip.duration : remainder) : Math.max(0, Math.min(clip.duration, time));
    const result = {
        accessories: Object.create(null),
        bones: Object.create(null),
        accessoryBones: Object.create(null),
    };
    for (const track of clip.tracks) {
        const value = sampleTrack(track, local);
        if (track.target === 'body')
            result.bodyRotation = value;
        else if (track.target === 'face')
            result.face = value;
        else if (track.target === 'leftEye' || track.target === 'rightEye') {
            const [smile, blink] = value;
            (result.eyes ??= {})[track.target === 'leftEye' ? 'left' : 'right'] = { smile, openness: 1 - blink };
        }
        else if (typeof track.target === 'object' && typeof track.target.bone === 'string') {
            const { bone, accessory } = track.target;
            const bones = accessory === undefined ? result.bones
                : result.accessoryBones[accessory] ??= Object.create(null);
            const sample = bones[bone] ??= {};
            sample[track.channel] = value;
        }
        else {
            const target = track.target;
            const sample = result.accessories[target.accessory] ??= {};
            if (track.channel === 'opacity')
                sample.opacity = value;
            else
                sample[track.channel] = value;
        }
    }
    return result;
}
