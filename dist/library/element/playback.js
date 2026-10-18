import { ACTIVITIES, finite, parseDesign } from '../core/design.js';
import { eyeExpressionWeights } from '../core/expressions.js';
import { validateMotionOptions } from '../core/motion.js';
function plainObject(value, name, keys) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new TypeError(`${name} must be a plain object`);
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
        throw new TypeError(`${name} must be a plain object`);
    for (const key of Reflect.ownKeys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (typeof key !== 'string' || !keys.includes(key) || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value'))
            throw new TypeError(`Unsupported ${name} field: ${String(key)}`);
    }
}
/** Activity playback and coordinated asset changes, independent of worker frame timing. */
export class PlaybackController {
    host;
    playing;
    transition;
    constructor(host) {
        this.host = host;
    }
    play(activity, options = {}) {
        if (!ACTIVITIES.includes(activity))
            throw new TypeError('Unsupported activity');
        plainObject(options, 'play options', ['duration']);
        const duration = options.duration === undefined ? undefined : finite(options.duration, 0, 60000, 'duration');
        this.cancelPlayback();
        if (!this.host.isConnected()) {
            const result = { finished: false };
            this.host.onPlaybackEnd?.(result);
            return Promise.resolve(result);
        }
        let playing;
        const result = new Promise(resolve => { playing = { resolve }; });
        this.playing = playing;
        this.host.setActivity(activity);
        // A synchronous activity listener may replace or stop this playback.
        if (this.playing !== playing)
            return result;
        if (duration === 0)
            this.finishPlayback(playing);
        else if (duration !== undefined)
            playing.timer = setTimeout(() => this.finishPlayback(playing), duration);
        return result;
    }
    /** Cancel playback and return to idle, including when setActivity started the loop. */
    stop() { this.cancelPlayback(); this.host.setActivity('idle'); }
    /** Called before an external setActivity takes ownership of the activity. */
    cancelPlayback() {
        const playing = this.playing;
        if (!playing)
            return;
        this.playing = undefined;
        if (playing.timer !== undefined)
            clearTimeout(playing.timer);
        playing.resolve({ finished: false });
        this.host.onPlaybackEnd?.({ finished: false });
    }
    finishPlayback(playing) {
        if (this.playing !== playing)
            return;
        this.playing = undefined;
        if (playing.timer !== undefined)
            clearTimeout(playing.timer);
        this.host.setActivity('idle');
        playing.resolve({ finished: true });
        this.host.onPlaybackEnd?.({ finished: true });
    }
    transitionTo(target, options = {}) {
        plainObject(target, 'transition target', ['shape', 'expression', 'accessories']);
        const timing = validateMotionOptions(options);
        // Validate every part before cancelling or changing any live state. parseDesign also
        // clones the caller's equipment and enforces IDs, exclusive slots, colors and presets.
        const current = this.host.getDesign();
        const validated = parseDesign({
            ...current,
            ...(target.shape === undefined ? {} : { body: { ...current.body, shape: target.shape } }),
            ...(target.accessories === undefined ? {} : { accessories: target.accessories }),
        });
        const shape = target.shape === undefined ? undefined : validated.body.shape;
        const expression = target.expression;
        if (expression !== undefined)
            eyeExpressionWeights(expression);
        const accessories = target.accessories === undefined ? undefined : validated.accessories;
        this.cancelTransition();
        let transition;
        const result = new Promise((resolve, reject) => { transition = { resolve, reject, channels: { shape: false, expression: false } }; });
        this.transition = transition;
        // Unmounted setters still persist their targets, matching setShape/setExpression.
        const duration = this.host.immediateMotion() ? 0 : timing.duration;
        void this.runTransition(transition, { shape, expression, accessories }, { ...timing, duration });
        return result;
    }
    async runTransition(transition, target, options) {
        try {
            const tasks = [];
            if (target.shape !== undefined) {
                transition.channels.shape = true;
                tasks.push(this.host.setShape(target.shape, options));
            }
            if (this.transition !== transition)
                return;
            if (target.expression !== undefined) {
                transition.channels.expression = true;
                tasks.push(this.host.setExpression('both', target.expression, options));
            }
            if (this.transition !== transition)
                return;
            // Attach promise handlers before waiting for the fade, including worker errors.
            const assetResults = Promise.all(tasks);
            const equipment = this.swapAccessories(transition, target.accessories, options);
            const [results] = await Promise.all([assetResults, equipment]);
            if (this.transition !== transition)
                return;
            this.transition = undefined;
            this.clearAnimation(transition);
            const result = { finished: results.every(result => result.finished) };
            transition.resolve(result);
            this.host.onTransitionEnd?.(result);
        }
        catch (error) {
            if (this.transition !== transition)
                return;
            this.transition = undefined;
            this.clearAnimation(transition);
            this.host.cancelAssetMotion(transition.channels);
            transition.reject(error);
        }
    }
    async swapAccessories(transition, accessories, options) {
        if (accessories === undefined)
            return;
        await this.fade(transition, 1, 0, options.duration / 2, options.easing);
        if (this.transition !== transition)
            return;
        // Patch only equipment: never restore a captured design over a newer shape/eye target.
        await this.host.updateDesign({ accessories: [...accessories] });
        if (this.transition !== transition)
            return;
        await this.fade(transition, 0, 1, options.duration / 2, options.easing);
        if (this.transition === transition)
            this.clearAnimation(transition);
    }
    async fade(transition, from, to, duration, easing) {
        const canvas = this.host.getCanvas();
        if (!duration || this.host.immediateMotion() || !canvas?.animate) {
            this.clearAnimation(transition);
            return;
        }
        const previous = transition.animation;
        const animation = canvas.animate([{ opacity: from }, { opacity: to }], { duration, easing: easing === 'linear' ? 'linear' : 'ease-in-out', fill: 'forwards' });
        transition.animation = animation;
        previous?.cancel();
        try {
            await animation.finished;
        }
        catch (error) {
            if (this.transition === transition && transition.animation === animation)
                throw error;
        }
    }
    cancelTransition() {
        const transition = this.transition;
        if (!transition)
            return;
        // Relinquish ownership before callbacks; old async work cannot mutate a new request.
        this.transition = undefined;
        this.clearAnimation(transition);
        this.host.cancelAssetMotion(transition.channels);
        transition.resolve({ finished: false });
        this.host.onTransitionEnd?.({ finished: false });
    }
    clearAnimation(transition) {
        const animation = transition.animation;
        transition.animation = undefined;
        animation?.cancel();
    }
    /** Paused/reduced motion snaps fades; renderer policy snaps shape/eye motion.
     * Playback intervals remain wall-clock intervals, even while visually paused.
     */
    policyChanged() {
        if (this.host.immediateMotion())
            this.transition?.animation?.finish();
    }
    disconnect() { this.cancelPlayback(); this.cancelTransition(); }
}
