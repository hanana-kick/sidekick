import { LitElement, html, nothing, type PropertyValues } from 'lit';
import type { AvatarItem, AvatarMode } from '../avatar/types.js';
import { avatarFromHash, createAvatar, isAvatarItem } from '../avatar/generator.js';
import type { AccessoryKind, BodyShapeKind, EyeKind, MouthKind } from '../avatar/types.js';
import type { AvatarEngine } from '../avatar/engine.js';
import type { BotState, Mood } from '../core/types.js';
import { observeLayout, type LayoutHandle } from '../core/scheduler.js';

const list = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

/**
 * Renders a single avatar into a canvas. Pure presentation: it owns an engine
 * and a canvas, and knows nothing about where it sits on the page.
 */
export class SkkAvatar extends LitElement {
  static override properties = {
    seed: { type: String },
    mode: { type: String },
    shape: { type: String },
    eyes: { type: String },
    mouth: { type: String },
    accessories: { type: String },
    hue: { type: Number },
    state: { type: String },
    mood: { type: String },
    size: { type: Number },
    reducedMotion: { type: Boolean, attribute: 'reduced-motion' },
    paused: { type: Boolean },
    avatar: { attribute: false },
  };

  declare seed: string;
  declare mode: AvatarMode;
  declare shape: string;
  declare eyes: string;
  declare mouth: string;
  declare accessories: string;
  declare hue: number;
  declare state: BotState;
  declare mood: Mood;
  declare size: number;
  declare reducedMotion: boolean;
  declare paused: boolean;
  declare avatar?: AvatarItem;

  #engine: AvatarEngine | null = null;
  #layout: LayoutHandle | null = null;
  #item: AvatarItem | null = null;

  constructor() {
    super();
    this.seed = '';
    this.mode = '2d';
    this.shape = '';
    this.eyes = '';
    this.mouth = '';
    this.accessories = '';
    this.hue = NaN;
    this.state = 'idle';
    this.mood = 'neutral';
    this.size = 0;
    this.reducedMotion = false;
    this.paused = false;
  }

  protected override createRenderRoot(): ShadowRoot {
    const root = super.createRenderRoot() as ShadowRoot;
    if (!root.adoptedStyleSheets?.length) {
      const style = document.createElement('style');
      style.textContent = `
        :host { display: block; width: 100%; height: 100%; contain: layout style; }
        :host([hidden]) { display: none; }
        canvas { display: block; width: 100%; height: 100%; }
      `;
      root.appendChild(style);
    }
    return root;
  }

  override render() {
    return html`<canvas
      part="canvas"
      aria-hidden="true"
      style=${this.size ? `width:${this.size}px;height:${this.size}px` : nothing}
    ></canvas>`;
  }

  protected override firstUpdated(): void {
    void this.#boot();
  }

  async #boot(): Promise<void> {
    const { AvatarEngine } = await import('../avatar/engine.js');
    const canvas = this.renderRoot.querySelector('canvas');
    if (!canvas || this.#engine) return;
    this.#engine = new AvatarEngine({
      canvas,
      item: this.#resolveItem(),
      mode: this.mode,
      state: this.state,
      mood: this.mood,
      reducedMotion: this.#effectiveReducedMotion(),
      autoStart: !this.paused,
    });
    this.#item = this.#engine.item;
    this.#layout = observeLayout(this, () => this.#syncSize(), { resize: true });
    this.#syncSize();
    this.dispatchEvent(new CustomEvent('skk-ready', { detail: { item: this.#item }, bubbles: true }));
  }

  #syncSize(): void {
    if (!this.#engine) return;
    const box = this.getBoundingClientRect();
    const w = this.size || box.width || this.clientWidth || 128;
    const h = this.size || box.height || this.clientHeight || 128;
    this.#engine.resize(w, h);
  }

  #effectiveReducedMotion(): boolean {
    if (this.reducedMotion) return true;
    return (
      typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    );
  }

  #resolveItem(): AvatarItem {
    if (this.avatar && isAvatarItem(this.avatar)) return this.avatar;
    const shape = (this.shape || undefined) as BodyShapeKind | undefined;
    const eyeKind = (this.eyes || undefined) as EyeKind | undefined;
    const mouthKind = (this.mouth || undefined) as MouthKind | undefined;
    const accessoryList = this.accessories ? (list(this.accessories) as AccessoryKind[]) : undefined;
    const hue = Number.isFinite(this.hue) ? this.hue : undefined;
    if (!this.seed) {
      return createAvatar({
        mode: this.mode,
        shape,
        eyes: eyeKind,
        mouth: mouthKind,
        accessories: accessoryList,
        hue,
      });
    }
    // Seeded: every field is a constraint on the deterministic generator.
    return avatarFromHash(this.seed, {
      mode: this.mode,
      shapes: shape ? [shape] : undefined,
      eyes: eyeKind ? [eyeKind] : undefined,
      mouths: mouthKind ? [mouthKind] : undefined,
      accessories: accessoryList ?? 'auto',
      hue,
    });
  }

  /** Rebuilds the avatar from the current attributes, or adopts `item` verbatim. */
  refresh(item?: AvatarItem): void {
    const next = item ?? (this.avatar && isAvatarItem(this.avatar) ? this.avatar : this.#resolveItem());
    this.#item = next;
    this.#engine?.setItem(next);
  }

  getAvatar(): AvatarItem | null {
    return this.#item ?? (this.#item = this.#resolveItem());
  }

  setAvatar(item: AvatarItem): void {
    this.avatar = item;
    this.refresh(item);
  }

  override updated(changed: PropertyValues<this>): void {
    if (!this.#engine) return;
    if (changed.has('state')) this.#engine.setState(this.state);
    if (changed.has('mood')) this.#engine.setMood(this.mood);
    if (changed.has('reducedMotion')) this.#engine.setReducedMotion(this.#effectiveReducedMotion());
    if (changed.has('size')) this.#syncSize();
    if (changed.has('paused')) {
      if (this.paused) this.#engine.stop();
      else this.#engine.start();
    }
    const structural = ['seed', 'mode', 'shape', 'eyes', 'mouth', 'accessories', 'hue', 'avatar'] as const;
    if (structural.some((key) => changed.has(key))) {
      if (changed.has('mode')) {
        // Mode swaps the renderer, which means a fresh engine.
        this.#teardownEngine();
        void this.#boot();
      } else {
        this.refresh();
      }
    }
  }

  #teardownEngine(): void {
    this.#layout?.dispose();
    this.#layout = null;
    this.#engine?.destroy();
    this.#engine = null;
  }

  /** PNG snapshot of the current frame. */
  toDataURL(type = 'image/png'): string {
    const canvas = this.renderRoot.querySelector('canvas');
    return canvas?.toDataURL(type) ?? '';
  }

  get engine(): AvatarEngine | null {
    return this.#engine;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#teardownEngine();
  }
}
