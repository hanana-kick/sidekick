export function validateSpeech(text, options = {}) {
    if (typeof text !== 'string' || !text.trim() || text.length > 1000)
        throw new TypeError('speech text must contain 1–1000 characters');
    if (!options || typeof options !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(options)))
        throw new TypeError('speech options must be a plain object');
    for (const key of Reflect.ownKeys(options)) {
        const item = Object.getOwnPropertyDescriptor(options, key);
        if (typeof key !== 'string' || !['duration', 'placement', 'dismissible', 'dismissLabel'].includes(key) || !item.enumerable || !Object.hasOwn(item, 'value'))
            throw new TypeError('unsupported speech option');
    }
    const { duration = 5000, placement = 'auto', dismissible = false, dismissLabel = 'Dismiss message' } = options;
    if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0 || duration > 60000)
        throw new TypeError('speech duration must be 0–60000 milliseconds');
    if (!['auto', 'top', 'bottom'].includes(placement))
        throw new TypeError('invalid speech placement');
    if (typeof dismissible !== 'boolean' || typeof dismissLabel !== 'string' || !dismissLabel.trim() || dismissLabel.length > 120)
        throw new TypeError('invalid speech dismissal options');
    return { duration, placement, dismissible, dismissLabel };
}
const composedParent = (element) => element.assignedSlot ?? element.parentElement ?? element.getRootNode().host ?? null;
/** DOM translations must remain viewport CSS pixels; the body portal must be viewport-fixed. */
function assertSpeechGeometry(host) {
    const view = host.ownerDocument.defaultView;
    if (!view || !host.isConnected)
        return;
    const scaled = (style) => !!style.zoom && style.zoom !== '1' && style.zoom !== 'normal';
    if (scaled(view.getComputedStyle(host)))
        throw new TypeError('say does not support CSS zoom on the avatar; use an own transform instead');
    for (let parent = composedParent(host); parent; parent = composedParent(parent)) {
        const style = view.getComputedStyle(parent);
        if (scaled(style) || [style.transform, style.scale, style.rotate, style.translate, style.perspective].some(value => value && value !== 'none'))
            throw new TypeError('say requires untransformed, unzoomed avatar ancestors');
    }
    for (const portalParent of [host.ownerDocument.body, host.ownerDocument.documentElement]) {
        if (!portalParent)
            continue;
        const style = view.getComputedStyle(portalParent);
        if (scaled(style) || [style.transform, style.scale, style.rotate, style.translate, style.perspective, style.filter, style.backdropFilter].some(value => value && value !== 'none') || /(?:layout|paint|strict|content)/.test(style.contain) || /(?:transform|perspective|filter|contain)/.test(style.willChange) || (style.contentVisibility && style.contentVisibility !== 'visible'))
            throw new TypeError('say requires body and html without fixed-position containing-block styles');
    }
}
/** No animation loop, GPU work, or idle observers. Movement uses cached geometry. */
export class SpeechController {
    host;
    position;
    available;
    root;
    bubble;
    message;
    timer;
    observer;
    frame;
    rect;
    origin;
    dimensions = { width: 0, height: 0 };
    options;
    constructor(host, position, available) {
        this.host = host;
        this.position = position;
        this.available = available;
    }
    say(text, input = {}) {
        const options = validateSpeech(text, input); // Invalid replacements preserve current speech.
        assertSpeechGeometry(this.host);
        this.clear();
        const doc = this.host.ownerDocument, view = doc.defaultView;
        if (!view || doc.hidden || !this.host.isConnected || !this.available())
            return;
        this.options = options;
        const root = doc.createElement('div');
        root.dataset.sidekickSpeech = '';
        root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483646;contain:layout style;';
        const shadow = root.attachShadow({ mode: 'open' }), style = doc.createElement('style');
        style.textContent = ':host{pointer-events:none} .bubble{position:absolute;box-sizing:border-box;max-width:280px;padding:12px 16px;border:1px solid #d9dce4;border-radius:16px;background:#fff;color:#20232b;font:500 14px/1.5 system-ui,sans-serif;overflow-wrap:anywhere;white-space:pre-wrap;pointer-events:none;overflow:hidden;display:flex;flex-direction:column} .message{display:block;min-height:0;overflow:auto;overscroll-behavior:contain;touch-action:pan-y;scrollbar-width:thin} .dismissible .message{margin-right:22px} .message[tabindex]:focus-visible{outline:2px solid #465ae8;outline-offset:-2px} button{pointer-events:auto;position:absolute;right:3px;top:3px;width:32px;height:32px;border:0;border-radius:8px;background:transparent;color:inherit;font:20px system-ui;cursor:pointer} button:focus-visible{outline:2px solid #465ae8;outline-offset:-2px}';
        const bubble = doc.createElement('div');
        bubble.className = options.dismissible ? 'bubble dismissible' : 'bubble';
        bubble.dir = 'auto';
        const message = doc.createElement('span');
        message.className = 'message';
        message.setAttribute('role', 'status');
        message.setAttribute('aria-live', 'polite');
        message.setAttribute('aria-atomic', 'true');
        if (options.dismissible) {
            const close = doc.createElement('button');
            close.type = 'button';
            close.textContent = '×';
            close.setAttribute('aria-label', options.dismissLabel);
            close.addEventListener('click', this.clear);
            close.addEventListener('keydown', event => { if (event.key === 'Escape') {
                event.preventDefault();
                this.clear();
            } });
            bubble.append(close);
        }
        bubble.append(message);
        shadow.append(style, bubble);
        doc.body.append(root);
        this.root = root;
        this.bubble = bubble;
        this.message = message;
        // Populate a connected live region without moving keyboard focus.
        message.textContent = text;
        view.addEventListener('resize', this.scheduleMeasure);
        doc.addEventListener('scroll', this.scheduleMeasure, true);
        doc.addEventListener('visibilitychange', this.visibility);
        view.visualViewport?.addEventListener('resize', this.scheduleMeasure);
        view.visualViewport?.addEventListener('scroll', this.scheduleMeasure);
        if (view.ResizeObserver) {
            this.observer = new view.ResizeObserver(this.scheduleMeasure);
            this.observer.observe(this.host);
            this.observer.observe(bubble);
        }
        this.measure();
        if (this.root && options.duration)
            this.timer = view.setTimeout(this.clear, options.duration);
    }
    clear = () => {
        const doc = this.host.ownerDocument, view = doc.defaultView;
        if (this.timer !== undefined)
            view?.clearTimeout(this.timer);
        if (this.frame !== undefined)
            view?.cancelAnimationFrame(this.frame);
        this.frame = undefined;
        this.timer = undefined;
        this.observer?.disconnect();
        this.observer = undefined;
        view?.removeEventListener('resize', this.scheduleMeasure);
        doc.removeEventListener('scroll', this.scheduleMeasure, true);
        doc.removeEventListener('visibilitychange', this.visibility);
        view?.visualViewport?.removeEventListener('resize', this.scheduleMeasure);
        view?.visualViewport?.removeEventListener('scroll', this.scheduleMeasure);
        this.root?.remove();
        this.root = this.bubble = undefined;
        this.message = undefined;
        this.rect = this.origin = this.options = undefined;
    };
    visibility = () => { if (this.host.ownerDocument.hidden)
        this.clear(); };
    scheduleMeasure = () => {
        if (this.bubble && this.frame === undefined)
            this.frame = this.host.ownerDocument.defaultView.requestAnimationFrame(() => { this.frame = undefined; this.measure(); });
    };
    // Internal boundary adapter: replace with projected visual bounds when available.
    anchorRect() { return this.host.getBoundingClientRect(); }
    measure = () => {
        if (!this.bubble)
            return;
        const view = this.host.ownerDocument.defaultView;
        this.bubble.style.width = `${Math.max(1, Math.min(280, (view.visualViewport?.width ?? view.innerWidth) - 16))}px`;
        this.bubble.style.maxHeight = `${Math.max(1, (view.visualViewport?.height ?? view.innerHeight) - 16)}px`;
        this.rect = this.anchorRect();
        this.origin = this.position();
        const box = this.bubble.getBoundingClientRect();
        this.dimensions = { width: box.width, height: box.height };
        if (this.message) {
            const overflow = this.message.scrollHeight > this.message.clientHeight + 1;
            this.message.style.pointerEvents = overflow ? 'auto' : 'none';
            if (overflow)
                this.message.tabIndex = 0;
            else
                this.message.removeAttribute('tabindex');
        }
        this.move();
    };
    /** Called by the existing DOM movement clock. No layout read here. */
    move() {
        if (!this.bubble || !this.rect || !this.origin || !this.options)
            return;
        const view = this.host.ownerDocument.defaultView, viewport = view.visualViewport;
        const minX = viewport?.offsetLeft ?? 0, minY = viewport?.offsetTop ?? 0;
        const maxX = minX + (viewport?.width ?? view.innerWidth), maxY = minY + (viewport?.height ?? view.innerHeight);
        const point = this.position(), rect = this.rect;
        const left = rect.left + point.x - this.origin.x, top = rect.top + point.y - this.origin.y;
        if (!this.available() || !this.host.isConnected || !rect.width || !rect.height || left + rect.width <= minX || top + rect.height <= minY || left >= maxX || top >= maxY) {
            this.clear();
            return;
        }
        const { width, height } = this.dimensions, above = top - height - 10, below = top + rect.height + 10;
        const fitsAbove = above >= minY + 8, fitsBelow = below + height <= maxY - 8;
        const preferBottom = this.options.placement === 'bottom';
        const y = preferBottom ? (fitsBelow || !fitsAbove ? below : above) : (fitsAbove || !fitsBelow ? above : below);
        const clamp = (n, low, high) => Math.max(low, Math.min(Math.max(low, high), n));
        this.bubble.style.left = `${clamp(left + (rect.width - width) / 2, minX + 8, maxX - width - 8)}px`;
        this.bubble.style.top = `${clamp(y, minY + 8, maxY - height - 8)}px`;
    }
}
