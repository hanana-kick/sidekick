import { ACTIVITIES, finite, parseDesign } from '../core/design.js';
import type { AccessoryDesign, Activity, AvatarDesign, DesignPatch } from '../core/design.js';
import { eyeExpressionWeights } from '../core/expressions.js';
import type { EyeExpression } from '../core/expressions.js';
import { validateMotionOptions } from '../core/motion.js';
import type { MotionOptions, MotionResult } from '../core/motion.js';
import type { MaterialShapeName } from '../core/shapes.js';

export interface PlayOptions { /** Wall-clock milliseconds; omit to loop until stopped. */ duration?: number }
export interface AssetTransitionTarget {
  shape?: MaterialShapeName;
  expression?: EyeExpression;
  /** Complete equipment selection, with one validated accessory per slot. */
  accessories?: readonly AccessoryDesign[];
}
export interface AssetMotionChannels { shape: boolean; expression: boolean }
/** Callbacks keep this controller importable without DOM globals or a renderer. */
export interface PlaybackHost {
  setActivity(activity: Activity): void;
  setShape(shape: MaterialShapeName, options: MotionOptions): Promise<MotionResult>;
  setExpression(side: 'both', expression: EyeExpression, options: MotionOptions): Promise<MotionResult>;
  updateDesign(patch: DesignPatch): Promise<void>;
  getDesign(): AvatarDesign;
  onPlaybackEnd?(result: MotionResult): void;
  onTransitionEnd?(result: MotionResult): void;
  getCanvas(): HTMLCanvasElement | undefined;
  immediateMotion(): boolean;
  isConnected(): boolean;
  cancelAssetMotion(channels: AssetMotionChannels): void;
}
interface Playing { resolve: (result: MotionResult) => void; timer?: ReturnType<typeof setTimeout> }
interface Transition {
  resolve: (result: MotionResult) => void;
  reject: (reason: unknown) => void;
  channels: AssetMotionChannels;
  animation?: Animation;
}
function plainObject(value: unknown, name: string, keys: readonly string[]): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be a plain object`);
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${name} must be a plain object`);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (typeof key !== 'string' || !keys.includes(key) || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw new TypeError(`Unsupported ${name} field: ${String(key)}`);
  }
}

/** Activity playback and coordinated asset changes, independent of worker frame timing. */
export class PlaybackController {
  private playing?: Playing;
  private transition?: Transition;
  constructor(private readonly host: PlaybackHost) {}

  play(activity: Activity, options: PlayOptions = {}): Promise<MotionResult> {
    if (!ACTIVITIES.includes(activity)) throw new TypeError('Unsupported activity');
    plainObject(options, 'play options', ['duration']);
    const duration = options.duration === undefined ? undefined : finite(options.duration, 0, 60000, 'duration');
    this.cancelPlayback();
    if (!this.host.isConnected()) { const result = { finished: false }; this.host.onPlaybackEnd?.(result); return Promise.resolve(result); }
    let playing!: Playing;
    const result = new Promise<MotionResult>(resolve => { playing = { resolve }; });
    this.playing = playing;
    this.host.setActivity(activity);
    // A synchronous activity listener may replace or stop this playback.
    if (this.playing !== playing) return result;
    if (duration === 0) this.finishPlayback(playing);
    else if (duration !== undefined) playing.timer = setTimeout(() => this.finishPlayback(playing), duration);
    return result;
  }

  /** Cancel playback and return to idle, including when setActivity started the loop. */
  stop(): void { this.cancelPlayback(); this.host.setActivity('idle'); }

  /** Called before an external setActivity takes ownership of the activity. */
  cancelPlayback(): void {
    const playing = this.playing;
    if (!playing) return;
    this.playing = undefined;
    if (playing.timer !== undefined) clearTimeout(playing.timer);
    playing.resolve({ finished: false });
    this.host.onPlaybackEnd?.({ finished: false });
  }

  private finishPlayback(playing: Playing): void {
    if (this.playing !== playing) return;
    this.playing = undefined;
    if (playing.timer !== undefined) clearTimeout(playing.timer);
    this.host.setActivity('idle');
    playing.resolve({ finished: true });
    this.host.onPlaybackEnd?.({ finished: true });
  }

  transitionTo(target: AssetTransitionTarget, options: MotionOptions = {}): Promise<MotionResult> {
    plainObject(target, 'transition target', ['shape', 'expression', 'accessories']);
    const timing = validateMotionOptions(options);
    // Validate every part before cancelling or changing any live state. parseDesign also
    // clones the caller's equipment and enforces IDs, exclusive slots, colors and presets.
    const current = this.host.getDesign();
    const validated = parseDesign({
      ...current,
      ...(target.shape === undefined ? {} : { body: { ...current.body, shape: target.shape } }),
      ...(target.accessories === undefined ? {} : { accessories: target.accessories as AccessoryDesign[] }),
    });
    const shape = target.shape === undefined ? undefined : validated.body.shape;
    const expression = target.expression;
    if (expression !== undefined) eyeExpressionWeights(expression);
    const accessories = target.accessories === undefined ? undefined : validated.accessories;
    this.cancelTransition();
    let transition!: Transition;
    const result = new Promise<MotionResult>((resolve, reject) => { transition = { resolve, reject, channels: { shape: false, expression: false } }; });
    this.transition = transition;
    // Unmounted setters still persist their targets, matching setShape/setExpression.
    const duration = this.host.immediateMotion() ? 0 : timing.duration;
    void this.runTransition(transition, { shape, expression, accessories }, { ...timing, duration });
    return result;
  }

  private async runTransition(transition: Transition, target: AssetTransitionTarget, options: Required<MotionOptions>): Promise<void> {
    try {
      const tasks: Promise<MotionResult>[] = [];
      if (target.shape !== undefined) {
        transition.channels.shape = true;
        tasks.push(this.host.setShape(target.shape, options));
      }
      if (this.transition !== transition) return;
      if (target.expression !== undefined) {
        transition.channels.expression = true;
        tasks.push(this.host.setExpression('both', target.expression, options));
      }
      if (this.transition !== transition) return;
      // Attach promise handlers before waiting for the fade, including worker errors.
      const assetResults = Promise.all(tasks);
      const equipment = this.swapAccessories(transition, target.accessories, options);
      const [results] = await Promise.all([assetResults, equipment]);
      if (this.transition !== transition) return;
      this.transition = undefined;
      this.clearAnimation(transition);
      const result = { finished: results.every(result => result.finished) };
      transition.resolve(result);
      this.host.onTransitionEnd?.(result);
    } catch (error) {
      if (this.transition !== transition) return;
      this.transition = undefined;
      this.clearAnimation(transition);
      this.host.cancelAssetMotion(transition.channels);
      transition.reject(error);
    }
  }

  private async swapAccessories(transition: Transition, accessories: readonly AccessoryDesign[] | undefined, options: Required<MotionOptions>): Promise<void> {
    if (accessories === undefined) return;
    await this.fade(transition, 1, 0, options.duration / 2, options.easing);
    if (this.transition !== transition) return;
    // Patch only equipment: never restore a captured design over a newer shape/eye target.
    await this.host.updateDesign({ accessories: [...accessories] });
    if (this.transition !== transition) return;
    await this.fade(transition, 0, 1, options.duration / 2, options.easing);
    if (this.transition === transition) this.clearAnimation(transition);
  }

  private async fade(transition: Transition, from: number, to: number, duration: number, easing: Required<MotionOptions>['easing']): Promise<void> {
    const canvas = this.host.getCanvas();
    if (!duration || this.host.immediateMotion() || !canvas?.animate) { this.clearAnimation(transition); return; }
    const previous = transition.animation;
    const animation = canvas.animate([{ opacity: from }, { opacity: to }], { duration, easing: easing === 'linear' ? 'linear' : 'ease-in-out', fill: 'forwards' });
    transition.animation = animation;
    previous?.cancel();
    try { await animation.finished; }
    catch (error) { if (this.transition === transition && transition.animation === animation) throw error; }
  }

  cancelTransition(): void {
    const transition = this.transition;
    if (!transition) return;
    // Relinquish ownership before callbacks; old async work cannot mutate a new request.
    this.transition = undefined;
    this.clearAnimation(transition);
    this.host.cancelAssetMotion(transition.channels);
    transition.resolve({ finished: false });
    this.host.onTransitionEnd?.({ finished: false });
  }

  private clearAnimation(transition: Transition): void {
    const animation = transition.animation;
    transition.animation = undefined;
    animation?.cancel();
  }

  /** Paused/reduced motion snaps fades; renderer policy snaps shape/eye motion.
   * Playback intervals remain wall-clock intervals, even while visually paused.
   */
  policyChanged(): void {
    if (this.host.immediateMotion()) this.transition?.animation?.finish();
  }

  disconnect(): void { this.cancelPlayback(); this.cancelTransition(); }
}
