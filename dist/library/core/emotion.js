import { finite } from './design.js';
/** Explicit application-authored feelings; no inference about a human user's emotions. */
export const EMOTIONS = Object.freeze(['neutral', 'happy', 'sad', 'curious', 'surprised', 'concerned', 'excited']);
export function parseEmotion(value) {
    if (typeof value !== 'string' || !EMOTIONS.includes(value))
        throw new TypeError(`emotion must be one of ${EMOTIONS.join(', ')}`);
    return value;
}
export function validateEmotionOptions(value = {}, reaction = false) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
        throw new TypeError('emotion options must be a plain object');
    const allowed = reaction ? ['intensity', 'duration'] : ['intensity'];
    for (const key of Reflect.ownKeys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (typeof key !== 'string' || !allowed.includes(key) || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value'))
            throw new TypeError(`unsupported emotion option: ${String(key)}`);
    }
    const options = value;
    return { intensity: finite(options.intensity === undefined ? 1 : options.intensity, 0, 1, 'emotion intensity'), duration: finite(options.duration === undefined ? 1200 : options.duration, 0, 60000, 'reaction duration') };
}
export function resolveEmotionFrame(value, time = 0, reduced = false) {
    const intensity = finite(value.intensity, 0, 1, 'emotion intensity');
    const emotion = parseEmotion(value.emotion);
    const wave = reduced ? 0 : Math.sin(time * (emotion === 'excited' ? 9 : 3));
    let smile = 0, blink = 0, bob = 0, roll = 0, pitch = 0, squash = 0;
    let gaze = [0, 0];
    switch (emotion) {
        case 'happy':
            smile = .85;
            bob = .018 * wave;
            roll = .035;
            break;
        case 'sad':
            blink = .38;
            pitch = .10;
            roll = -.055;
            gaze = [0, -.28];
            squash = -.025;
            break;
        case 'curious':
            blink = .06;
            roll = -.16;
            pitch = -.035;
            gaze = [.16, .10];
            break;
        case 'surprised':
            pitch = -.11;
            bob = .025;
            squash = .045;
            gaze = [0, .20];
            break;
        case 'concerned':
            blink = .22;
            roll = .10;
            pitch = .045;
            gaze = [-.12, -.08];
            break;
        case 'excited':
            smile = 1;
            bob = .035 * wave;
            roll = .065 * wave;
            squash = .018 * wave;
            break;
    }
    return { smile, blink, eyeWeight: emotion === 'neutral' ? 0 : intensity, bob: bob * intensity, roll: roll * intensity, pitch: pitch * intensity, gaze: [gaze[0] * intensity, gaze[1] * intensity], squash: 1 + squash * intensity };
}
export function emotionHasMotion(value) { return value.intensity > 0 && (value.emotion === 'happy' || value.emotion === 'excited'); }
