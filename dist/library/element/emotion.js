import { parseEmotion, validateEmotionOptions } from '../core/emotion.js';
/** A separate layer: never captures or restores activity, gaze, design or behavior. */
export class EmotionController {
    host;
    baseline = { emotion: 'neutral', intensity: 1 };
    reaction;
    constructor(host) {
        this.host = host;
    }
    get state() { return { ...(this.reaction?.value ?? this.baseline), baseline: { ...this.baseline }, reacting: !!this.reaction }; }
    set(emotion, options = {}) {
        const next = { emotion: parseEmotion(emotion), intensity: validateEmotionOptions(options).intensity };
        const previous = this.takeReaction();
        this.baseline = next;
        this.host.change(this.state);
        this.finish(previous, 'replaced');
    }
    react(emotion, options = {}) {
        const name = parseEmotion(emotion), validated = validateEmotionOptions(options, true);
        if (!this.host.connected())
            return Promise.resolve({ finished: false, emotion: name, reason: 'disconnected' });
        const previous = this.takeReaction();
        let resolve;
        const promise = new Promise(done => { resolve = done; });
        const reaction = { value: { emotion: name, intensity: validated.intensity }, resolve, timer: undefined };
        this.reaction = reaction;
        this.host.change(this.state);
        // A change listener may synchronously replace/cancel this reaction.
        if (this.reaction === reaction)
            reaction.timer = this.host.schedule(() => {
                if (this.reaction !== reaction)
                    return;
                this.reaction = undefined;
                this.host.change(this.state);
                this.finish(reaction, 'completed');
            }, validated.duration);
        this.finish(previous, 'replaced');
        return promise;
    }
    cancel(reason = 'cancelled') {
        const previous = this.takeReaction();
        if (!previous)
            return;
        this.host.change(this.state);
        this.finish(previous, reason);
    }
    takeReaction() {
        const previous = this.reaction;
        this.reaction = undefined;
        if (previous?.timer !== undefined)
            this.host.clear(previous.timer);
        return previous;
    }
    finish(reaction, reason) {
        if (!reaction)
            return;
        const result = { finished: reason === 'completed', emotion: reaction.value.emotion, reason };
        reaction.resolve(result);
        this.host.end(result);
    }
}
