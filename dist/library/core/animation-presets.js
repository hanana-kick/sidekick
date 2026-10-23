import { validatePartAnimation } from './part-animation.js';
export const PART_ANIMATION_PRESET_LIMITS = Object.freeze({ minDuration: .05, maxDuration: 60, maxIntensity: 1 });
const defaults = { nod: .8, shake: .7, wiggle: .9, blink: .24 };
function readOptions(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
        throw new TypeError('Preset options must be a plain data object.');
    for (const key of Reflect.ownKeys(value)) {
        const field = Object.getOwnPropertyDescriptor(value, key);
        if (typeof key !== 'string' || !['duration', 'intensity', 'loop'].includes(key) || !field.enumerable || !Object.hasOwn(field, 'value'))
            throw new TypeError('Preset options contain unsupported or accessor data.');
    }
    const options = value;
    if (Object.hasOwn(options, 'duration') && (typeof options.duration !== 'number' || !Number.isFinite(options.duration) || options.duration < PART_ANIMATION_PRESET_LIMITS.minDuration || options.duration > PART_ANIMATION_PRESET_LIMITS.maxDuration))
        throw new RangeError('Preset duration must be finite and within 0.05..60 seconds.');
    if (Object.hasOwn(options, 'intensity') && (typeof options.intensity !== 'number' || !Number.isFinite(options.intensity) || options.intensity < 0 || options.intensity > PART_ANIMATION_PRESET_LIMITS.maxIntensity))
        throw new RangeError('Preset intensity must be finite and within 0..1.');
    if (Object.hasOwn(options, 'loop') && typeof options.loop !== 'boolean')
        throw new TypeError('Preset loop must be boolean.');
    return options;
}
/** Create an ordinary, validated clip with neutral endpoints. No rig or separate player is required. */
export function createPartAnimationPreset(name, options = {}) {
    if (typeof name !== 'string' || !Object.hasOwn(defaults, name))
        throw new TypeError('Unknown part animation preset.');
    const input = readOptions(options);
    const duration = input.duration ?? defaults[name], intensity = input.intensity ?? 1;
    let tracks;
    if (name === 'blink') {
        const keys = [[0, 0], [.45, 1], [.85, 0], [1, 0]];
        tracks = ['leftEye', 'rightEye'].map(target => ({
            target, channel: 'weights', interpolation: 'smooth',
            keyframes: keys.map(([time, amount]) => ({ time: time * duration, value: [0, amount * intensity] })),
        }));
    }
    else {
        const axis = name === 'nod' ? 0 : name === 'shake' ? 1 : 2;
        const keys = name === 'nod' ? [[0, 0], [.35, .22], [.7, -.07], [1, 0]]
            : name === 'shake' ? [[0, 0], [.2, .3], [.5, -.3], [.8, .15], [1, 0]]
                : [[0, 0], [.2, .2], [.5, -.2], [.8, .12], [1, 0]];
        tracks = [{
                target: 'body', channel: 'rotation', interpolation: 'smooth',
                keyframes: keys.map(([time, amount]) => {
                    const value = [0, 0, 0];
                    value[axis] = intensity === 0 ? 0 : amount * intensity;
                    return { time: time * duration, value };
                }),
            }];
    }
    return validatePartAnimation({ duration, loop: input.loop ?? false, tracks });
}
