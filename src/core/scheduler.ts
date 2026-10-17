/**
 * One set of global listeners for every mounted bot, plus rAF-batched refresh.
 * Keeping this a module singleton means N avatars on a page still cost one scroll
 * listener and one ResizeObserver.
 */

type Listener = () => void;

export interface LayoutHandle {
  /** Force a refresh on the next animation frame. */
  refresh(): void;
  dispose(): void;
}

const canUseDom = (): boolean => typeof window !== 'undefined' && typeof document !== 'undefined';

const scrollSubs = new Set<Listener>();
const layoutSubs = new Set<Listener>();
const resizeTargets = new Map<Element, Set<Listener>>();

let queuedScroll = false;
let queuedLayout = false;
let bound = false;
let observer: ResizeObserver | null = null;

let frameScheduler: (cb: Listener) => void = (cb) => {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => cb());
  else setTimeout(cb, 16);
};

/** Test seam: lets tests drive frames deterministically. */
export function setFrameScheduler(fn: (cb: Listener) => void): void {
  frameScheduler = fn;
}

function flush(set: Set<Listener>): void {
  for (const listener of [...set]) listener();
}

function onScroll(): void {
  if (queuedScroll) return;
  queuedScroll = true;
  frameScheduler(() => {
    queuedScroll = false;
    flush(scrollSubs);
  });
}

function onResize(): void {
  // Scroll-dependent subscribers must react to viewport size changes too.
  if (!queuedScroll) {
    queuedScroll = true;
    frameScheduler(() => {
      queuedScroll = false;
      flush(scrollSubs);
    });
  }
  if (queuedLayout) return;
  queuedLayout = true;
  frameScheduler(() => {
    queuedLayout = false;
    flush(layoutSubs);
  });
}

function ensureGlobalListeners(): void {
  if (bound || !canUseDom()) return;
  bound = true;
  const opts = { passive: true, capture: true } as const;
  window.addEventListener('scroll', onScroll, opts);
  window.addEventListener('resize', onResize, opts);
  window.addEventListener('orientationchange', onResize, opts);
  const vv = typeof visualViewport !== 'undefined' ? visualViewport : undefined;
  vv?.addEventListener('resize', onResize, opts);
}

function ensureResizeObserver(): ResizeObserver | null {
  if (!canUseDom() || typeof ResizeObserver === 'undefined') return null;
  if (!observer) {
    observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const listeners = resizeTargets.get(entry.target);
        if (!listeners) continue;
        for (const listener of [...listeners]) listener();
      }
    });
  }
  return observer;
}

/**
 * Subscribes to layout changes relevant to one or more elements.
 * `scroll: false` skips scroll invalidation — correct for `position: fixed` bots,
 * which do not move when the page scrolls.
 */
export function observeLayout(
  element: Element | Element[] | null,
  onLayout: Listener,
  options: { scroll?: boolean; resize?: boolean } = {},
): LayoutHandle {
  const { scroll = true, resize = true } = options;
  ensureGlobalListeners();

  const targets = (Array.isArray(element) ? element : [element]).filter((el): el is Element => !!el);
  const set = scroll ? scrollSubs : layoutSubs;
  set.add(onLayout);

  const ro = resize ? ensureResizeObserver() : null;
  if (ro) {
    for (const el of targets) {
      let subs = resizeTargets.get(el);
      if (!subs) {
        subs = new Set();
        resizeTargets.set(el, subs);
      }
      subs.add(onLayout);
      ro.observe(el);
    }
  }

  let disposed = false;
  return {
    refresh() {
      if (!disposed) onResize();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      set.delete(onLayout);
      if (!ro) return;
      for (const el of targets) {
        const subs = resizeTargets.get(el);
        if (subs?.delete(onLayout) && subs.size === 0) {
          resizeTargets.delete(el);
          ro.unobserve(el);
        }
      }
    },
  };
}

/** Schedules `cb` on the next animation frame. */
export function nextFrame(cb: Listener): void {
  frameScheduler(cb);
}

/** Test helper: drops all global subscriptions. */
export function __resetLayoutObservers(): void {
  scrollSubs.clear();
  layoutSubs.clear();
  resizeTargets.clear();
  observer?.disconnect();
  observer = null;
  queuedScroll = false;
  queuedLayout = false;
}
