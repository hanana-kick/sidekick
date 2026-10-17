import { LitElement, html, type PropertyValues } from 'lit';
import type { AvatarMode } from '../avatar/types.js';
import type { Alignment, BotState, Mood, Placement, PlacementMode, Point } from '../core/types.js';
import { computePlacement, parseAnchorKeyword } from '../core/geometry.js';
import { observeLayout, type LayoutHandle } from '../core/scheduler.js';
import { createLocalStore, noopStore, type PositionStore } from '../core/persistence.js';
import { BotStateMachine, type StateRequestResult } from '../core/state.js';
import './skk-avatar.js';
import type { SkkAvatar } from './skk-avatar.js';

export type PositionMode = PlacementMode;

const rectOf = (el: Element | null): { x: number; y: number; width: number; height: number } => {
  if (!el) return { x: 0, y: 0, width: 0, height: 0 };
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, width: r.width, height: r.height };
};

/**
 * The bot itself: a canvas avatar plus the placement engine. It renders itself
 * into its own shadow root and positions the host element anywhere on screen.
 */
export class SkkBot extends LitElement {
  static override properties = {
    seed: { type: String },
    mode: { type: String },
    shape: { type: String },
    eyes: { type: String },
    mouth: { type: String },
    accessories: { type: String },
    hue: { type: Number },
    state: { type: String, reflect: true },
    mood: { type: String },
    size: { type: Number },
    position: { type: String },
    positionMode: { type: String, attribute: 'position-mode' },
    anchorSelector: { type: String, attribute: 'anchor-selector' },
    placement: { type: String },
    alignment: { type: String },
    gap: { type: Number },
    offsetX: { type: Number, attribute: 'offset-x' },
    offsetY: { type: Number, attribute: 'offset-y' },
    margin: { type: Number },
    padding: { type: Number },
    drag: { type: Boolean },
    persist: { type: String },
    snap: { type: Number },
    portal: { type: Boolean },
    zIndex: { type: Number, attribute: 'z-index' },
    reducedMotion: { type: Boolean, attribute: 'reduced-motion' },
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
  declare position: string;
  declare positionMode: PositionMode;
  declare anchorSelector: string;
  declare placement: Placement;
  declare alignment: Alignment;
  declare gap: number;
  declare offsetX: number;
  declare offsetY: number;
  declare margin: number;
  declare padding: number;
  declare drag: boolean;
  declare persist: string;
  declare snap: number;
  declare portal: boolean;
  declare zIndex: number;
  declare reducedMotion: boolean;

  #layout: LayoutHandle | null = null;
  #machine = new BotStateMachine('idle');
  #free: Point | null = null;
  #store: PositionStore = noopStore;
  #dragState: { pointerId: number; startX: number; startY: number; origin: Point } | null = null;
  #unlinked = false;
  #syncing = false;

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
    this.size = 96;
    this.position = 'bottom-right';
    this.positionMode = 'viewport';
    this.anchorSelector = '';
    this.placement = 'auto';
    this.alignment = 'center';
    this.gap = 12;
    this.offsetX = 0;
    this.offsetY = 0;
    this.margin = 16;
    this.padding = 8;
    this.drag = false;
    this.persist = '';
    this.snap = 0;
    this.portal = false;
    this.zIndex = 9999;
    this.reducedMotion = false;
    this.#machine.onChange((next) => {
      if (next === this.state) return;
      this.#syncing = true;
      this.state = next;
      this.#syncing = false;
      this.dispatchEvent(new CustomEvent('skk-state-change', { detail: { state: next }, bubbles: true }));
    });
  }

  protected override createRenderRoot(): ShadowRoot {
    const root = super.createRenderRoot() as ShadowRoot;
    if (!root.querySelector('style')) {
      const style = document.createElement('style');
      style.textContent = `
        :host {
          position: fixed;
          left: 0;
          top: 0;
          display: block;
          width: auto;
          contain: layout style;
          touch-action: none;
          user-select: none;
        }
        :host([hidden]) { display: none; }
        .frame { position: relative; display: grid; place-items: center; }
        .shell { position: absolute; inset: 0; display: grid; }
        ::slotted([slot="bubble"]) { grid-area: 1 / 1; }
      `;
      root.appendChild(style);
    }
    return root;
  }

  override render() {
    return html`
      <div class="frame" style=${`width:${this.size}px;height:${this.size}px`}>
        <skk-avatar
          .seed=${this.seed}
          .mode=${this.mode}
          .shape=${this.shape}
          .eyes=${this.eyes}
          .mouth=${this.mouth}
          .accessories=${this.accessories}
          .hue=${this.hue}
          .state=${this.state}
          .mood=${this.mood}
          .reducedMotion=${this.reducedMotion}
          part="avatar"
        ></skk-avatar>
        <div class="shell">
          <slot name="bubble"></slot>
          <slot name="badge"></slot>
          <slot name="overlay"></slot>
        </div>
      </div>
    `;
  }

  protected override firstUpdated(): void {
    this.#loadPersisted();
    this.#attachLayoutObservers();
    this.applyPlacement();
  }

  // ---- placement -------------------------------------------------------

  #attachLayoutObservers(): void {
    this.#layout?.dispose();
    const anchor = this.#anchorElement();
    this.#layout = observeLayout(
      [this, anchor, this.positionMode === 'contained' ? this.parentElement : null].filter(
        (el): el is Element => !!el,
      ),
      () => this.applyPlacement(),
      { scroll: true, resize: true },
    );
  }

  #anchorElement(): Element | null {
    if (this.positionMode !== 'anchor' || !this.anchorSelector) return null;
    const root = this.getRootNode() as Document | ShadowRoot;
    try {
      return root.querySelector?.(this.anchorSelector) ?? document.querySelector(this.anchorSelector);
    } catch {
      return null;
    }
  }

  /** Recomputes the host transform from the placement engine. */
  applyPlacement(): void {
    if (this.positionMode === 'free' && this.#free) {
      this.#applyTransform(this.#free.x, this.#free.y);
      return;
    }

    const width = this.size;
    const height = this.size;
    const isAnchor = this.positionMode === 'anchor';
    const anchorEl = this.#anchorElement();
    const contained = this.positionMode === 'contained';
    const container = contained ? ((this.offsetParent as Element | null) ?? this.parentElement) : null;
    const containerRect = contained ? rectOf(container) : this.#viewportRect();
    const origin = contained ? { x: containerRect.x, y: containerRect.y } : { x: 0, y: 0 };

    const result = computePlacement({
      mode: this.positionMode,
      corner: parseAnchorKeyword(this.position, 'bottom-right'),
      anchorRect: isAnchor ? rectOf(anchorEl) : undefined,
      containerRect,
      size: { width, height },
      placement: this.placement,
      alignment: this.alignment,
      gap: this.gap,
      padding: this.padding,
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
      offset: { main: this.offsetY, cross: this.offsetX },
      position: this.#free ?? undefined,
      snap: this.snap,
    });

    this.#applyTransform(result.x - origin.x, result.y - origin.y);
  }

  #viewportRect() {
    if (typeof window === 'undefined') return { x: 0, y: 0, width: 0, height: 0 };
    return { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
  }

  #applyTransform(x: number, y: number): void {
    this.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
    this.style.zIndex = String(this.zIndex);
    this.style.position = this.positionMode === 'contained' ? 'absolute' : 'fixed';
  }

  /** Moves the bot to free coordinates (also what dragging produces). */
  moveTo(x: number, y: number, options: { persist?: boolean } = {}): void {
    this.#free = { x, y };
    if (this.positionMode !== 'free') {
      this.positionMode = 'free';
      this.setAttribute('position-mode', 'free');
    }
    this.applyPlacement();
    if (options.persist !== false) this.#savePosition();
    this.dispatchEvent(new CustomEvent('skk-move', { detail: { x, y }, bubbles: true }));
  }

  resetPosition(): void {
    this.#free = null;
    this.#store.clear(this.#storageKey());
    this.applyPlacement();
  }

  #storageKey(): string {
    return this.persist || this.id || 'bot';
  }

  #loadPersisted(): void {
    if (!this.persist) {
      this.#store = noopStore;
      return;
    }
    this.#store = createLocalStore();
    const saved = this.#store.load(this.#storageKey());
    if (saved) {
      this.#free = { x: saved.x, y: saved.y };
      if (saved.mode) this.positionMode = saved.mode;
    }
  }

  #savePosition(): void {
    if (!this.persist || !this.#free) return;
    this.#store.save(this.#storageKey(), { x: this.#free.x, y: this.#free.y, mode: 'free' });
  }

  // ---- state machine ---------------------------------------------------

  /** Requests a state. Transient states (`speaking`, `success`, `error`) revert automatically. */
  request(next: BotState, options: { duration?: number; force?: boolean } = {}): void {
    const result = this.#machine.request(next, options);
    this.#scheduleRevert(result);
  }

  get botState(): BotState {
    return this.#machine.state;
  }

  // ---- drag ------------------------------------------------------------

  protected override updated(changed: PropertyValues<this>): void {
    if (
      changed.has('position') ||
      changed.has('positionMode') ||
      changed.has('anchorSelector') ||
      changed.has('placement') ||
      changed.has('alignment') ||
      changed.has('gap') ||
      changed.has('offsetX') ||
      changed.has('offsetY') ||
      changed.has('size') ||
      changed.has('snap')
    ) {
      this.#attachLayoutObservers();
      this.applyPlacement();
    }
    if (changed.has('drag')) this.#toggleDrag();
    if (changed.has('portal')) this.#togglePortal();
    if (changed.has('state') && !this.#syncing && this.state !== this.#machine.state) {
      this.request(this.state, { force: true });
    }
  }

  #scheduleRevert(result: StateRequestResult): void {
    const duration = result.scheduleAfter;
    if (!duration) return;
    const expected = result.state;
    window.setTimeout(() => this.#machine.revert(expected), duration);
  }

  #togglePortal(): void {
    if (typeof document === 'undefined') return;
    if (this.portal && !this.#unlinked && this.parentElement !== document.body) {
      this.#unlinked = true;
      document.body.appendChild(this);
    }
  }

  #toggleDrag(): void {
    if (this.drag) {
      this.addEventListener('pointerdown', this.#onPointerDown);
      this.addEventListener('keydown', this.#onKeyDown);
      this.setAttribute('tabindex', this.tabIndex >= 0 ? String(this.tabIndex) : '0');
      if (!this.getAttribute('role')) this.setAttribute('role', 'img');
    } else {
      this.removeEventListener('pointerdown', this.#onPointerDown);
      this.removeEventListener('keydown', this.#onKeyDown);
    }
  }

  #currentPoint(): Point {
    const match = /translate3d\((-?[\d.]+)px,\s*(-?[\d.]+)px/.exec(this.style.transform ?? '');
    return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: 0, y: 0 };
  }

  #onPointerDown = (event: PointerEvent): void => {
    if (!this.drag || event.button !== 0) return;
    if ((event.target as Element | null)?.closest?.('[data-skk-interactive]')) return;
    this.#dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: this.#currentPoint(),
    };
    this.setPointerCapture(event.pointerId);
    this.setAttribute('data-dragging', '');
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('pointermove', this.#onPointerMove);
    this.addEventListener('pointerup', this.#onPointerUp);
    this.addEventListener('pointercancel', this.#onPointerUp);
  }

  #onPointerMove = (event: PointerEvent): void => {
    const drag = this.#dragState;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
    const size = this.size;
    const bounds = this.#viewportRect();
    const x = Math.min(Math.max(drag.origin.x + dx, -size * 0.5), bounds.width - size * 0.5);
    const y = Math.min(Math.max(drag.origin.y + dy, -size * 0.5), bounds.height - size * 0.5);
    this.moveTo(x, y, { persist: false });
  };

  #onPointerUp = (event: PointerEvent): void => {
    if (!this.#dragState || this.#dragState.pointerId !== event.pointerId) return;
    this.#dragState = null;
    this.removeAttribute('data-dragging');
    try {
      this.releasePointerCapture(event.pointerId);
    } catch {
      /* capture may already be gone */
    }
    if (this.persist) this.#savePosition();
    this.dispatchEvent(
      new CustomEvent('skk-drag-end', { detail: { ...(this.#free ?? this.#currentPoint()) }, bubbles: true }),
    );
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    if (!this.drag) return;
    const step = event.shiftKey ? 24 : 8;
    const deltas: Record<string, Point> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    const at = this.#currentPoint();
    this.moveTo(at.x + delta.x, at.y + delta.y);
  };

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#layout?.dispose();
    this.#layout = null;
    this.removeEventListener('pointermove', this.#onPointerMove);
    this.removeEventListener('pointerup', this.#onPointerUp);
    this.removeEventListener('pointercancel', this.#onPointerUp);
  }

  /** The inner avatar element, once upgraded. */
  get avatarElement(): SkkAvatar | null {
    return this.renderRoot.querySelector('skk-avatar');
  }
}
