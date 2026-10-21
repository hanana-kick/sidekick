import { finite } from './design.js';
import { shapeContour } from './contours.js';
import { buildMorph } from './morph.js';
import { MATERIAL_SHAPE_NAMES } from './shapes.js';
import { interpolateShapeProfile, resolveShapeProfile, sameShapeProfile } from './shape-profiles.js';
const oneHot = (shape) => Object.freeze({ [shape]: 1 });
function snapshot(contour, profile, weights) {
    let owned;
    return Object.freeze({ contour, profile, get shapeWeights() { return owned ??= typeof weights === 'function' ? weights() : weights; } });
}
function mixWeights(from, to, progress) {
    if (progress <= 0)
        return from;
    if (progress >= 1)
        return oneHot(to);
    const result = {};
    for (const shape of MATERIAL_SHAPE_NAMES) {
        const weight = (from[shape] ?? 0) * (1 - progress) + (shape === to ? progress : 0);
        if (weight > 0)
            result[shape] = weight;
    }
    return Object.freeze(result);
}
function catalogShape(value) {
    if (typeof value !== 'string' || !MATERIAL_SHAPE_NAMES.includes(value))
        throw new TypeError('shape: 지원하는 Material 도형 이름이 필요합니다.');
    return value;
}
const catalogContour = (name) => shapeContour({ kind: 'material', name });
/** Validate before applying accessibility overrides, including immediate/no-op requests. */
export function validateShapeMotionOptions(options = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options))
        throw new TypeError('options: 객체가 필요합니다.');
    const prototype = Object.getPrototypeOf(options);
    if (prototype !== Object.prototype && prototype !== null)
        throw new TypeError('options: 일반 객체가 필요합니다.');
    for (const key of Reflect.ownKeys(options))
        if (key !== 'duration' && key !== 'easing')
            throw new TypeError('지원하지 않는 shape motion 옵션입니다.');
    const duration = finite(options.duration === undefined ? 450 : options.duration, 0, 60000, 'duration');
    if (options.easing !== undefined && options.easing !== 'linear' && options.easing !== 'smooth')
        throw new TypeError('지원하지 않는 easing입니다.');
    return { duration, easing: options.easing ?? 'smooth' };
}
/**
 * A runtime contour/depth/eyes/mount snapshot is separate from the serializable catalog target. Interruptions
 * match from the exact visible snapshot, so no nested recipe or old endpoint leaks
 * into the next transition. All public snapshots are immutable.
 */
export class ShapeTimeline {
    current;
    destinationProfile;
    targetShape;
    atTarget = true;
    transition;
    constructor(shape = 'square') {
        this.targetShape = catalogShape(shape);
        this.destinationProfile = resolveShapeProfile(this.targetShape);
        this.current = snapshot(catalogContour(this.targetShape), this.destinationProfile, oneHot(this.targetShape));
    }
    get active() { return !!this.transition; }
    get contour() { return this.current.contour; }
    get profile() { return this.current.profile; }
    get snapshot() { return this.current; }
    get targetProfile() { return this.destinationProfile; }
    get remainingDuration() { return this.transition ? this.transition.duration - this.transition.elapsed : 0; }
    get easing() { return this.transition?.smooth === false ? 'linear' : 'smooth'; }
    get target() { return this.targetShape; }
    /** Immediately replace a design baseline; settle any superseded request. */
    set(shape) {
        const target = catalogShape(shape);
        const contour = catalogContour(target), profile = resolveShapeProfile(target);
        this.cancel();
        this.targetShape = target;
        this.destinationProfile = profile;
        this.current = snapshot(contour, profile, oneHot(target));
        this.atTarget = true;
    }
    to(shape, options = {}) {
        const { duration, easing } = validateShapeMotionOptions(options);
        const target = catalogShape(shape), profile = resolveShapeProfile(target);
        const sameTarget = target === this.targetShape && sameShapeProfile(profile, this.destinationProfile);
        // An already-visible catalog shape needs no frame loop, but an in-flight request
        // still retargets from its current contour, even when it repeats the target.
        if (!this.active && sameTarget && this.atTarget)
            return Promise.resolve({ finished: true });
        const contour = catalogContour(target);
        const morph = duration === 0 ? undefined : buildMorph(this.current.contour, contour);
        // All validation and geometry preparation happen before canceling old work.
        this.cancel();
        this.targetShape = target;
        this.destinationProfile = profile;
        if (!morph) {
            this.current = snapshot(contour, profile, oneHot(target));
            this.atTarget = true;
            return Promise.resolve({ finished: true });
        }
        this.atTarget = false;
        return new Promise(resolve => {
            this.transition = { morph, fromProfile: this.current.profile, fromWeights: this.current.shapeWeights, toShape: target, toProfile: profile, elapsed: 0, duration, smooth: easing === 'smooth', resolve };
        });
    }
    advance(ms) {
        finite(ms, 0, 60000, 'delta');
        const transition = this.transition;
        if (!transition)
            return;
        transition.elapsed = Math.min(transition.duration, transition.elapsed + ms);
        const ratio = transition.elapsed / transition.duration;
        const progress = transition.smooth ? ratio * ratio * (3 - 2 * ratio) : ratio;
        this.current = snapshot(transition.morph.sample(progress), interpolateShapeProfile(transition.fromProfile, transition.toProfile, progress), () => mixWeights(transition.fromWeights, transition.toShape, progress));
        if (ratio === 1) {
            this.atTarget = true;
            this.transition = undefined;
            transition.resolve({ finished: true });
        }
    }
    /** Accessibility/paused changes complete the persisted target immediately. */
    finish() {
        const transition = this.transition;
        if (!transition)
            return;
        this.current = snapshot(transition.morph.sample(1), transition.toProfile, oneHot(transition.toShape));
        this.atTarget = true;
        this.transition = undefined;
        transition.resolve({ finished: true });
    }
    /** Canceling freezes the visible contour and full profile; set() replaces both. */
    cancel() {
        const transition = this.transition;
        this.transition = undefined;
        transition?.resolve({ finished: false });
    }
}
