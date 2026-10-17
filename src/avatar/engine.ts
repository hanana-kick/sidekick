import type { AvatarItem, AvatarMode, AvatarRenderer, Channels } from './types.js';
import { REST_CHANNELS } from './types.js';
import { AvatarAnimator } from './rig/animator.js';
import { Canvas2DRenderer } from './render/canvas2d.js';
import { WebGL3DRenderer, type WebGL3DOptions } from './render/webgl/renderer3d.js';
import { createAvatar } from './generator.js';
import { nextFrame } from '../core/scheduler.js';
import type { BotState, Mood } from '../core/types.js';

export interface AvatarEngineOptions {
  canvas: HTMLCanvasElement;
  /** Requested render mode. Defaults to the item's own `mode`, else `'2d'`. */
  mode?: AvatarMode;
  item?: AvatarItem;
  state?: BotState;
  mood?: Mood;
  reducedMotion?: boolean;
  /** Start the rAF loop immediately. Default `true`. */
  autoStart?: boolean;
  /** Downgrade to Canvas2D when WebGL2 is missing. Default `true`. */
  allow2DFallback?: boolean;
  webgl?: WebGL3DOptions;
  /** Fixed device-pixel-ratio override (tests). */
  dpr?: number;
}

/**
 * Owns the clock: it drives one `AvatarAnimator` and one renderer for a single
 * canvas. It never touches layout — the caller (usually a custom element)
 * reports size changes through `resize()`.
 */
export class AvatarEngine {
  readonly requestedMode: AvatarMode;
  #canvas: HTMLCanvasElement;
  #renderer: AvatarRenderer;
  #animator: AvatarAnimator;
  #item: AvatarItem;
  #running = false;
  #raf = 0;
  #last = 0;
  #dpr: number;
  #fellBack = false;
  #dirty = true;

  constructor(options: AvatarEngineOptions) {
    this.#canvas = options.canvas;
    this.#item = options.item ?? createAvatar({ seed: 'sidekick' });
    this.#dpr = options.dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    this.requestedMode = options.mode ?? this.#item.mode ?? '2d';

    this.#animator = new AvatarAnimator(this.#item, { reducedMotion: options.reducedMotion ?? false });
    if (options.state) this.#animator.setState(options.state);
    if (options.mood) this.#animator.setMood(options.mood);

    this.#renderer = this.#createRenderer(this.requestedMode, options);
    this.resize();

    if (options.autoStart ?? true) this.start();
  }

  #createRenderer(mode: AvatarMode, options: AvatarEngineOptions): AvatarRenderer {
    if (mode === '3d') {
      try {
        if (WebGL3DRenderer.isSupported()) {
          return new WebGL3DRenderer(this.#canvas, options.webgl);
        }
      } catch {
        /* fall through to 2D */
      }
      if (options.allow2DFallback === false) {
        throw new Error('WebGL2 is required but is not available in this environment');
      }
      this.#fellBack = true;
    }
    return new Canvas2DRenderer(this.#canvas);
  }

  get mode(): AvatarMode {
    return this.#renderer.mode;
  }

  /** True when `'3d'` was requested but the Canvas2D renderer is in use. */
  get fellBack(): boolean {
    return this.#fellBack;
  }

  get item(): AvatarItem {
    return this.#item;
  }

  get renderer(): AvatarRenderer {
    return this.#renderer;
  }

  get animator(): AvatarAnimator {
    return this.#animator;
  }

  setItem(item: AvatarItem): void {
    this.#item = item;
    this.#animator.setItem(item);
    this.#dirty = true;
  }

  setState(state: BotState): void {
    this.#animator.setState(state);
    this.#dirty = true;
  }

  setMood(mood: Mood): void {
    this.#animator.setMood(mood);
    this.#dirty = true;
  }

  /** Pointer position in canvas-local CSS pixels; drives the gaze. */
  setPointer(x: number, y: number): void {
    const w = this.#renderer.width || 1;
    const h = this.#renderer.height || 1;
    this.#animator.setPointer((x / w) * 2 - 1, (y / h) * 2 - 1);
    this.#dirty = true;
  }

  clearPointer(): void {
    this.#animator.setPointer(0, 0);
  }

  setReducedMotion(value: boolean): void {
    this.#animator.reducedMotion = value;
    this.#dirty = true;
  }

  resize(width?: number, height?: number, dpr?: number): void {
    const box =
      width !== undefined && height !== undefined
        ? { width, height }
        : this.#canvas.getBoundingClientRect
          ? this.#canvas.getBoundingClientRect()
          : { width: this.#canvas.clientWidth, height: this.#canvas.clientHeight };
    const w = Math.max(1, Math.round(width ?? box.width ?? 0));
    const h = Math.max(1, Math.round(height ?? box.height ?? 0));
    this.#dpr = Math.max(1, Math.min(dpr ?? this.#dpr, 3));
    this.#renderer.resize(w, h, this.#dpr);
    this.#dirty = true;
  }

  getChannels(): Readonly<Channels> {
    return this.#animator.update(0);
  }

  /** Advances the animation by `dtMs` and draws one frame. */
  tick(dtMs: number): void {
    const channels = this.#animator.update(dtMs);
    this.#renderer.render(this.#item, channels, this.#animator.time);
    this.#dirty = false;
  }

  renderOnce(): void {
    this.tick(0);
  }

  start(): void {
    if (this.#running) return;
    this.#running = true;
    this.#last = 0;
    this.#raf = this.#scheduleFrame();
  }

  stop(): void {
    this.#running = false;
    if (this.#raf && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.#raf);
    }
    this.#raf = 0;
  }

  #scheduleFrame(): number {
    if (typeof requestAnimationFrame === 'undefined') return 0;
    return requestAnimationFrame(this.#frame);
  }

  #frame = (now: number): void => {
    if (!this.#running) return;
    const dt = this.#last === 0 ? 16.7 : Math.min(64, now - this.#last);
    this.#last = now;
    this.tick(dt);
    if (this.#running) this.#raf = this.#scheduleFrame();
  };

  /**
   * One frame on the shared scheduler, used by elements that batch their own
   * updates and only want to repaint when something actually changed.
   */
  requestRepaint(): void {
    if (!this.#dirty) return;
    nextFrame(() => {
      if (this.#dirty) this.renderOnce();
    });
  }

  destroy(): void {
    this.stop();
    this.#renderer.destroy();
  }
}

export function createAvatarEngine(options: AvatarEngineOptions): AvatarEngine {
  return new AvatarEngine(options);
}

export { REST_CHANNELS };
