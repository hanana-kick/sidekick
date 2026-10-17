import { LitElement, html, nothing, type PropertyValues } from 'lit';

export type BubbleVariant = 'info' | 'success' | 'warning' | 'error' | 'thinking';
export type BubbleTail = 'none' | 'top' | 'bottom' | 'left' | 'right';

const VARIANT_ROLES: Record<BubbleVariant, string> = {
  info: 'polite',
  success: 'polite',
  warning: 'assertive',
  error: 'assertive',
  thinking: 'polite',
};

/**
 * Announcement bubble that pairs with `<skk-bot>`. Content is announced through
 * an `aria-live` region, and `duration` gives sighted users the same window.
 */
export class SkkBubble extends LitElement {
  static override properties = {
    message: { type: String },
    variant: { type: String },
    tail: { type: String },
    duration: { type: Number },
    open: { type: Boolean, reflect: true },
    dismissible: { type: Boolean },
  };

  declare message: string;
  declare variant: BubbleVariant;
  declare tail: BubbleTail;
  declare duration: number;
  declare open: boolean;
  declare dismissible: boolean;

  #timer = 0;

  constructor() {
    super();
    this.message = '';
    this.variant = 'info';
    this.tail = 'bottom';
    this.duration = 0;
    this.open = false;
    this.dismissible = false;
  }

  protected override createRenderRoot(): ShadowRoot {
    const root = super.createRenderRoot() as ShadowRoot;
    if (!root.querySelector('style')) {
      const style = document.createElement('style');
      style.textContent = `
        :host { display: block; position: relative; max-width: 260px; }
        :host([hidden]) { display: none; }
        .bubble {
          background: var(--skk-bubble-bg, #ffffff);
          color: var(--skk-bubble-fg, #16181d);
          border: 1px solid var(--skk-bubble-border, rgba(0,0,0,.08));
          border-radius: var(--skk-radius, 14px);
          padding: 10px 12px;
          font: var(--skk-font, 500 13px/1.45 system-ui, sans-serif);
          box-shadow: var(--skk-bubble-shadow, 0 8px 24px rgba(15,23,42,.14));
          animation: skk-pop var(--skk-duration-pop, 180ms) ease-out;
        }
        :host([variant="error"]) .bubble { border-color: var(--skk-error, #ef5b5b); }
        :host([variant="success"]) .bubble { border-color: var(--skk-success, #24c88a); }
        :host([variant="thinking"]) .bubble { color: var(--skk-muted, #6b7280); }
        .tail { position: absolute; width: 10px; height: 10px; background: inherit; border: inherit; }
        :host([tail="bottom"]) .tail { bottom: -6px; left: 22px; transform: rotate(45deg); border-top: 0; border-left: 0; }
        :host([tail="top"]) .tail { top: -6px; left: 22px; transform: rotate(45deg); border-bottom: 0; border-right: 0; }
        .actions { display: flex; gap: 6px; margin-top: 8px; }
        button {
          border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer;
          padding: 2px 6px; border-radius: 6px;
        }
        button:focus-visible { outline: 2px solid var(--skk-focus, #4cc9f0); outline-offset: 1px; }
        @keyframes skk-pop { from { opacity: 0; transform: translateY(4px) scale(.97); } }
        @media (prefers-reduced-motion: reduce) { .bubble { animation: none; } }
      `;
      root.appendChild(style);
    }
    return root;
  }

  override render() {
    const show = this.open && this.message.length > 0;
    if (!show) {
      // Keep an empty live region so late content is still announced.
      return html`<div
        class="bubble"
        part="bubble"
        role="status"
        aria-live=${VARIANT_ROLES[this.variant]}
        hidden
      ></div>`;
    }
    return html`
      <div class="bubble" part="bubble" role="status" aria-live=${VARIANT_ROLES[this.variant]}>
        ${this.message}
        ${
          this.dismissible
            ? html`<button
                type="button"
                data-skk-interactive
                aria-label="Dismiss"
                @click=${() => this.close()}
              >
                ×
              </button>`
            : nothing
        }
        <div class="actions" part="actions">
          <slot name="action"></slot>
        </div>
      </div>
      ${this.tail !== 'none' ? html`<span class="tail" aria-hidden="true"></span>` : nothing}
    `;
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('open') || changed.has('duration') || changed.has('message')) this.#restartTimer();
  }

  #restartTimer(): void {
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = 0;
    }
    if (this.open && this.duration > 0) {
      this.#timer = window.setTimeout(() => this.close(), this.duration);
    }
  }

  show(message?: string, options: { variant?: BubbleVariant; duration?: number } = {}): void {
    if (message !== undefined) this.message = message;
    if (options.variant) this.variant = options.variant;
    if (options.duration !== undefined) this.duration = options.duration;
    this.open = true;
  }

  close(): void {
    this.open = false;
    this.dispatchEvent(new CustomEvent('skk-close', { bubbles: true }));
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.#timer) clearTimeout(this.#timer);
  }
}
