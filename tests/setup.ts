import { vi } from 'vitest';

/** jsdom lacks these; the library feature-detects them but tests need deterministic behaviour. */

class ResizeObserverStub {
  static instances: ResizeObserverStub[] = [];
  callback: ResizeObserverCallback;
  observed: Element[] = [];
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    ResizeObserverStub.instances.push(this);
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  unobserve(el: Element) {
    this.observed = this.observed.filter((e) => e !== el);
  }
  disconnect() {
    this.observed = [];
  }
  trigger() {
    this.callback(
      this.observed.map((target) => ({ target, contentRect: {} }) as ResizeObserverEntry),
      this as unknown as ResizeObserver,
    );
  }
}

class IntersectionObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

if (!('ResizeObserver' in globalThis)) {
  Object.defineProperty(globalThis, 'ResizeObserver', { value: ResizeObserverStub, writable: true });
}
if (!('IntersectionObserver' in globalThis)) {
  Object.defineProperty(globalThis, 'IntersectionObserver', {
    value: IntersectionObserverStub,
    writable: true,
  });
}

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// Deterministic clocks: tests drive time explicitly through animator.update()/engine.tick().
if (typeof window !== 'undefined' && !window.performance?.now) {
  Object.defineProperty(window, 'performance', { value: { now: () => 0 }, writable: true });
}

const storage = new Map<string, string>();
const memoryStorage: Storage = {
  get length() {
    return storage.size;
  },
  clear: () => storage.clear(),
  getItem: (key: string) => storage.get(key) ?? null,
  key: (index: number) => [...storage.keys()][index] ?? null,
  removeItem: (key: string) => storage.delete(key),
  setItem: (key: string, value: string) => storage.set(key, String(value)),
};
if (typeof window !== 'undefined' && !window.localStorage) {
  Object.defineProperty(window, 'localStorage', { value: memoryStorage, writable: true });
}

/** jsdom has no canvas backend: return a no-op 2D context so renderers can be exercised. */
const context2dStub = () =>
  new Proxy(
    {
      canvas: null,
      measureText: () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      setTransform: () => {},
    } as Record<string, unknown>,
    {
      get(target, prop) {
        if (prop in target) return target[prop as string];
        if (
          typeof prop === 'string' &&
          /^(save|restore|begin|close|move|line|arc|rect|fill|stroke|clip|translate|rotate|scale|draw|set|clear|bezier|quadratic|ellipse|round)/.test(
            prop,
          )
        ) {
          return () => {};
        }
        return undefined;
      },
      set(target, prop, value) {
        target[prop as string] = value;
        return true;
      },
    },
  );

if (typeof HTMLCanvasElement !== 'undefined') {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((contextId: string) =>
    contextId === '2d' ? context2dStub() : null) as never);
  HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,AAAA';
}

export { ResizeObserverStub };
