import { finite } from './design.js';
import { automaticBlink, createEyeState, expressionPose, parseEyeState, patchEyeState } from './expressions.js';
const eyeSides = ['left', 'right'];
const initialEyes = () => ({ left: createEyeState(), right: createEyeState() });
export const initialPose = () => ({ rotation: [0, 0, 0], face: [0, 0], gaze: [0, 0], openness: 1, eyes: { left: { openness: 1, smile: 0 }, right: { openness: 1, smile: 0 } }, accessories: {} });
function object(value, path, keys) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new TypeError(`${path}: 객체가 필요합니다.`);
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
        throw new TypeError(`${path}: 일반 객체가 필요합니다.`);
    for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== 'string' || (keys && !keys.includes(key)))
            throw new TypeError(`${path}.${String(key)}: 지원하지 않는 항목입니다.`);
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value'))
            throw new TypeError(`${path}.${key}: 일반 데이터 항목이 필요합니다.`);
    }
    return value;
}
/** Validate caller options before lifecycle/accessibility overrides are applied. */
export function validateMotionOptions(options = {}) {
    object(options, 'options', ['duration', 'easing']);
    const duration = finite(options.duration === undefined ? 400 : options.duration, 0, 60000, 'duration');
    if (options.easing !== undefined && options.easing !== 'linear' && options.easing !== 'smooth')
        throw new TypeError('지원하지 않는 easing입니다.');
    return { duration, easing: options.easing ?? 'smooth' };
}
function vec(value, length, min, max) {
    if (!Array.isArray(value) || value.length !== length)
        throw new TypeError('잘못된 모션 벡터입니다.');
    return value.map(v => finite(v, min, max, 'motion'));
}
function eyeTarget(value, previous) {
    const patch = object(value, 'eyes', ['weights', 'expression', 'openness']);
    return patchEyeState(previous, patch);
}
/** Keep the inherited velocity unless its cubic would leave the channel's valid domain. */
function boundedTangent(from, to, tangent, min, max) {
    const valid = (m) => {
        const d = to - from, a = -2 * d + m, b = 3 * d - 2 * m, c = m;
        const points = [0, 1];
        if (Math.abs(a) < 1e-12) {
            if (Math.abs(b) > 1e-12)
                points.push(-c / (2 * b));
        }
        else {
            const discriminant = 4 * b * b - 12 * a * c;
            if (discriminant >= 0) {
                const root = Math.sqrt(discriminant);
                points.push((-2 * b + root) / (6 * a), (-2 * b - root) / (6 * a));
            }
        }
        return points.filter(t => t >= 0 && t <= 1).every(t => { const value = from + ((a * t + b) * t + c) * t; return value >= min - 1e-12 && value <= max + 1e-12; });
    };
    if (valid(tangent))
        return tangent;
    let low = 0, high = 1;
    for (let i = 0; i < 32; i++) {
        const middle = (low + high) / 2;
        if (valid(tangent * middle))
            low = middle;
        else
            high = middle;
    }
    return tangent * low;
}
/** Disjoint channels keep their own clocks; only a replaced channel is interrupted. */
export class MotionTimeline {
    pose = initialPose();
    eyeStates = initialEyes();
    tracks = new Map();
    constructor(eyes) { if (eyes)
        this.setEyes(eyes); }
    get active() { return this.tracks.size > 0; }
    get eyeMotion() {
        return { left: this.tracks.has('left') || this.tracks.has('openness'), right: this.tracks.has('right') || this.tracks.has('openness') };
    }
    values(channel, pose = this.pose) {
        if (channel === 'rotation')
            return [...pose.rotation];
        if (channel === 'face')
            return [...pose.face];
        if (channel === 'openness')
            return [pose.openness];
        if (channel === 'left' || channel === 'right')
            return [pose.eyes[channel].openness, pose.eyes[channel].smile];
        return [...(pose.accessories[channel.slice(10)] ?? [0, 0, 0])];
    }
    write(channel, values) {
        if (channel === 'rotation')
            this.pose.rotation = values;
        else if (channel === 'face')
            this.pose.face = values;
        else if (channel === 'openness')
            this.pose.openness = values[0];
        else if (channel === 'left' || channel === 'right')
            this.pose.eyes[channel] = { openness: values[0], smile: values[1] };
        else
            this.pose.accessories[channel.slice(10)] = values;
    }
    settle(request, finished) {
        if (!request.settled) {
            request.settled = true;
            request.resolve({ finished });
        }
    }
    stopChannel(channel) {
        const previous = this.tracks.get(channel);
        if (previous) {
            this.tracks.delete(channel);
            this.settle(previous.request, false);
        }
    }
    /** Replace only edited design baselines; unrelated movement keeps its original timing. */
    setEyes(states, sides = eyeSides) {
        const value = object(states, 'eyes', ['left', 'right']);
        const next = { left: parseEyeState(value.left, 'eyes.left'), right: parseEyeState(value.right, 'eyes.right') };
        if (!Array.isArray(sides) || sides.some(side => !eyeSides.includes(side)))
            throw new TypeError('잘못된 눈 방향입니다.');
        for (const side of sides) {
            this.stopChannel(side);
            this.eyeStates[side] = next[side];
            this.pose.eyes[side] = expressionPose(next[side]);
        }
        if (new Set(sides).size === 2) {
            this.stopChannel('openness');
            this.pose.openness = 1;
        }
    }
    /** Removed design parts must not be resurrected by an unfinished motion track. */
    removeAccessories(ids) {
        if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(id)))
            throw new TypeError('잘못된 액세서리 id입니다.');
        for (const id of ids) {
            this.stopChannel(`accessory:${id}`);
            delete this.pose.accessories[id];
        }
    }
    to(target, options = {}) {
        const value = object(target, 'motion', ['body', 'face', 'eyes', 'accessories']);
        const { duration, easing } = validateMotionOptions(options);
        const next = structuredClone(this.pose), nextEyes = structuredClone(this.eyeStates);
        const channels = [];
        if (value.body !== undefined) {
            const body = object(value.body, 'body', ['rotation']);
            next.rotation = vec(body.rotation, 3, -Math.PI * 2, Math.PI * 2);
            channels.push('rotation');
        }
        if (value.face !== undefined) {
            const face = object(value.face, 'face', ['uv']);
            next.face = vec(face.uv, 2, -0.5, 0.5);
            channels.push('face');
        }
        if (value.eyes !== undefined) {
            const eyes = object(value.eyes, 'eyes', ['openness', 'left', 'right']);
            if (eyes.openness !== undefined) {
                next.openness = finite(eyes.openness, 0, 1, 'openness');
                channels.push('openness');
            }
            for (const side of eyeSides)
                if (eyes[side] !== undefined) {
                    nextEyes[side] = eyeTarget(eyes[side], nextEyes[side]);
                    next.eyes[side] = expressionPose(nextEyes[side]);
                    channels.push(side);
                }
        }
        const accessories = value.accessories === undefined ? {} : object(value.accessories, 'accessories');
        for (const [id, entry] of Object.entries(accessories)) {
            if (!/^[a-z][a-z0-9-]{0,39}$/.test(id))
                throw new TypeError('잘못된 액세서리 id입니다.');
            const accessory = object(entry, `accessories.${id}`, ['rotation']);
            next.accessories[id] = vec(accessory.rotation, 3, -Math.PI, Math.PI);
            channels.push(`accessory:${id}`);
        }
        // No validation below this point: invalid replacements leave every running track intact.
        this.eyeStates = nextEyes;
        if (!channels.length)
            return Promise.resolve({ finished: true });
        return new Promise(resolve => {
            const request = { remaining: channels.length, settled: false, resolve };
            for (const channel of channels) {
                const previous = this.tracks.get(channel), from = this.values(channel), to = this.values(channel, next);
                const tangent = to.map((end, index) => {
                    if (!previous || duration === 0)
                        return 0;
                    const ratio = previous.elapsed / previous.duration;
                    const derivative = previous.smooth
                        ? (previous.to[index] - previous.from[index]) * 6 * ratio * (1 - ratio) + (3 * ratio * ratio - 4 * ratio + 1) * previous.tangent[index]
                        : previous.to[index] - previous.from[index];
                    const velocity = derivative / previous.duration;
                    const limits = channel === 'left' || channel === 'right' || channel === 'openness' ? [0, 1]
                        : channel === 'face' ? [-.5, .5] : channel === 'rotation' ? [-Math.PI * 2, Math.PI * 2] : [-Math.PI, Math.PI];
                    return boundedTangent(from[index], end, velocity * duration, limits[0], limits[1]);
                });
                this.stopChannel(channel);
                if (duration === 0) {
                    this.write(channel, to);
                    request.remaining--;
                }
                else
                    this.tracks.set(channel, { from, to, tangent, elapsed: 0, duration, smooth: easing === 'smooth', request });
            }
            if (request.remaining === 0)
                this.settle(request, true);
        });
    }
    advance(ms) {
        finite(ms, 0, 60000, 'delta');
        for (const [channel, track] of this.tracks) {
            track.elapsed = Math.min(track.duration, track.elapsed + ms);
            const ratio = track.elapsed / track.duration;
            this.write(channel, track.to.map((end, index) => {
                const eased = track.smooth ? ratio * ratio * (3 - 2 * ratio) : ratio;
                return track.from[index] + (end - track.from[index]) * eased + (track.smooth ? ratio * (1 - ratio) ** 2 * track.tangent[index] : 0);
            }));
            if (ratio === 1) {
                this.tracks.delete(channel);
                track.request.remaining--;
                if (track.request.remaining === 0)
                    this.settle(track.request, true);
            }
        }
    }
    cancelEyes() { for (const channel of ['left', 'right', 'openness'])
        this.stopChannel(channel); }
    cancel() { for (const channel of this.tracks.keys())
        this.stopChannel(channel); }
}
export function activityFrame(activity, time, reduced = false) {
    if (reduced || activity === 'still')
        return { bob: 0, roll: 0, squash: 1, gaze: [0, 0], blink: 1 };
    const breathe = Math.sin(time * 2.2);
    const frame = { bob: breathe * 0.018, roll: Math.sin(time * 1.1) * 0.025, squash: 1 + breathe * 0.016, gaze: [0, 0], blink: 1 };
    frame.blink = automaticBlink(time);
    if (activity === 'thinking') {
        frame.roll += 0.12;
        frame.gaze = [0.3, 0.35];
    }
    if (activity === 'listening') {
        frame.roll += Math.sin(time * 3) * 0.05;
        frame.squash += Math.sin(time * 3) * 0.014;
    }
    if (activity === 'speaking') {
        frame.squash += Math.sin(time * 12) * 0.035;
        frame.bob += Math.sin(time * 6) * 0.016;
    }
    if (activity === 'celebrating') {
        frame.bob += Math.sin(time * 5) ** 2 * 0.14;
        frame.roll += Math.sin(time * 5) * 0.12;
        frame.squash += Math.sin(time * 10) * 0.055;
    }
    return frame;
}
