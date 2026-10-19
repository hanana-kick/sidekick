import { parseEmotion, validateEmotionOptions } from '../core/emotion.js';
import type { Emotion, EmotionOptions, EmotionResult, EmotionState, EmotionValue, ReactionOptions } from '../core/emotion.js';
interface EmotionHost {
  connected(): boolean;
  change(state: EmotionState): void;
  end(result: EmotionResult): void;
  schedule(callback: () => void, milliseconds: number): unknown;
  clear(timer: unknown): void;
}
/** A separate layer: never captures or restores activity, gaze, design or behavior. */
export class EmotionController {
  private baseline: EmotionValue = { emotion: 'neutral', intensity: 1 };
  private reaction?: { value: EmotionValue; timer?: unknown; resolve(result: EmotionResult): void };
  constructor(private host: EmotionHost) {}
  get state(): EmotionState { return { ...(this.reaction?.value ?? this.baseline), baseline: { ...this.baseline }, reacting: !!this.reaction }; }
  set(emotion: Emotion, options: EmotionOptions = {}): void {
    const next = { emotion: parseEmotion(emotion), intensity: validateEmotionOptions(options).intensity };
    const previous = this.takeReaction();
    this.baseline = next;
    this.host.change(this.state);
    this.finish(previous, 'replaced');
  }
  react(emotion: Emotion, options: ReactionOptions = {}): Promise<EmotionResult> {
    const name = parseEmotion(emotion), validated = validateEmotionOptions(options, true);
    if (!this.host.connected()) return Promise.resolve({ finished: false, emotion: name, reason: 'disconnected' });
    const previous = this.takeReaction();
    let resolve!: (result: EmotionResult) => void;
    const promise = new Promise<EmotionResult>(done => { resolve = done; });
    const reaction = { value: { emotion: name, intensity: validated.intensity }, resolve, timer: undefined as unknown };
    this.reaction = reaction;
    this.host.change(this.state);
    // A change listener may synchronously replace/cancel this reaction.
    if (this.reaction === reaction) reaction.timer = this.host.schedule(() => {
      if (this.reaction !== reaction) return;
      this.reaction = undefined;
      this.host.change(this.state);
      this.finish(reaction, 'completed');
    }, validated.duration);
    this.finish(previous, 'replaced');
    return promise;
  }
  cancel(reason: 'cancelled' | 'disconnected' = 'cancelled'): void {
    const previous = this.takeReaction();
    if (!previous) return;
    this.host.change(this.state);
    this.finish(previous, reason);
  }
  private takeReaction(): typeof this.reaction {
    const previous = this.reaction;
    this.reaction = undefined;
    if (previous?.timer !== undefined) this.host.clear(previous.timer);
    return previous;
  }
  private finish(reaction: typeof this.reaction, reason: EmotionResult['reason']): void {
    if (!reaction) return;
    const result = { finished: reason === 'completed', emotion: reaction.value.emotion, reason };
    reaction.resolve(result); this.host.end(result);
  }
}
