import { activityFrame } from './motion.js';
/** Crossfade only the established activity transform layer; geometry stays untouched. */
export class ActivityBlend {
    activity;
    duration;
    source;
    elapsed = 0;
    current;
    constructor(activity, time = 0, reduced = false, duration = 200) {
        this.activity = activity;
        this.duration = duration;
        this.current = activityFrame(activity, time, reduced);
    }
    get active() { return this.source !== undefined; }
    set(activity, immediate = false) {
        if (activity === this.activity) {
            if (immediate)
                this.finish();
            return;
        }
        // Capture the last displayed blended sample, including an interrupted transition.
        this.source = immediate ? undefined : { ...this.current, gaze: [...this.current.gaze] };
        this.activity = activity;
        this.elapsed = 0;
    }
    advance(milliseconds) {
        if (!this.source)
            return;
        this.elapsed += Math.max(0, milliseconds);
        if (this.elapsed >= this.duration)
            this.finish();
    }
    finish() { this.source = undefined; this.elapsed = 0; }
    sample(time, reduced = false) {
        const target = activityFrame(this.activity, time, reduced);
        if (reduced)
            this.finish();
        if (!this.source)
            this.current = target;
        else {
            const progress = Math.min(1, this.elapsed / this.duration);
            const weight = progress * progress * (3 - 2 * progress);
            const mix = (from, to) => from + (to - from) * weight;
            this.current = {
                bob: mix(this.source.bob, target.bob), roll: mix(this.source.roll, target.roll),
                squash: mix(this.source.squash, target.squash), blink: mix(this.source.blink, target.blink),
                gaze: [mix(this.source.gaze[0], target.gaze[0]), mix(this.source.gaze[1], target.gaze[1])],
            };
        }
        return { ...this.current, gaze: [...this.current.gaze] };
    }
}
