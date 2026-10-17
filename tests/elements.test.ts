import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineElements, TAGS } from '../src/elements/define.js';
import { createAvatar } from '../src/avatar/generator.js';
import type { SkkAvatar } from '../src/elements/skk-avatar.js';
import type { SkkBot } from '../src/elements/skk-bot.js';
import type { SkkBubble } from '../src/elements/skk-bubble.js';
import type { AvatarItem } from '../src/avatar/types.js';

defineElements();

type WithUpdate = HTMLElement & { updateComplete: Promise<boolean> };

function nextTick(el: WithUpdate, rounds = 4): Promise<void> {
  return Promise.all(Array.from({ length: rounds }, () => el.updateComplete)).then(() => undefined);
}

async function mount<T extends HTMLElement>(tag: string, attrs: Record<string, string> = {}): Promise<T> {
  const el = document.createElement(tag) as T;
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  document.body.appendChild(el);
  await nextTick(el as unknown as WithUpdate);
  return el;
}

function ready(el: SkkAvatar): Promise<AvatarItem> {
  return new Promise((resolve, reject) => {
    el.addEventListener('skk-ready', (event) => resolve((event as CustomEvent).detail.item), { once: true });
    void nextTick(el, 8);
    setTimeout(() => reject(new Error('skk-ready never fired')), 2000);
  });
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('custom element registration', () => {
  it('registers all three tags idempotently', () => {
    expect(() => defineElements()).not.toThrow();
    for (const tag of Object.values(TAGS)) expect(customElements.get(tag)).toBeDefined();
    expect(TAGS.avatar).toBe('skk-avatar');
  });
});

describe('skk-avatar', () => {
  it('boots an engine and reports ready', async () => {
    const el = await mount<SkkAvatar>('skk-avatar', { seed: 'hello' });
    const item = await ready(el);
    expect(item.body.shape).toBeDefined();
    expect(el.engine).not.toBeNull();
    expect(el.shadowRoot?.querySelector('canvas')).not.toBeNull();
  });

  it('is deterministic for the same seed', async () => {
    const a = await mount<SkkAvatar>('skk-avatar', { seed: 'same-seed' });
    const b = await mount<SkkAvatar>('skk-avatar', { seed: 'same-seed' });
    await Promise.all([ready(a), ready(b)]);
    expect(a.getAvatar()).toEqual(b.getAvatar());
  });

  it('honours shape/eyes/mouth/accessories/hue attributes', async () => {
    const el = await mount<SkkAvatar>('skk-avatar', {
      seed: 'constrained',
      shape: 'hexagon',
      eyes: 'dot',
      mouth: 'grin',
      accessories: 'cap,glasses',
      hue: '210',
    });
    const item = await ready(el);
    expect(item.body.shape).toBe('hexagon');
    expect(item.eyes[0]!.kind).toBe('dot');
    expect(item.mouth.kind).toBe('grin');
    expect(item.accessories.map((a) => a.kind)).toEqual(expect.arrayContaining(['cap', 'glasses']));
    expect(Math.round(item.palette.hue)).toBe(210);
  });

  it('generates an avatar when no seed is given', async () => {
    const el = await mount<SkkAvatar>('skk-avatar');
    const item = await ready(el);
    expect(item.hash).toMatch(/^[0-9a-f]{8,}$/);
  });

  it('adopts a programmatic avatar', async () => {
    const el = await mount<SkkAvatar>('skk-avatar');
    await ready(el);
    const item = createAvatar({ seed: 'programmatic', shape: 'teardrop' });
    el.setAvatar(item);
    expect(el.getAvatar()).toEqual(item);
    el.avatar = item;
    await nextTick(el);
    expect(el.getAvatar()?.hash).toBe(item.hash);
  });

  it('refreshes from changed attributes', async () => {
    const el = await mount<SkkAvatar>('skk-avatar', { seed: 'refresh-me' });
    await ready(el);
    const before = el.getAvatar()!.body.shape;
    el.setAttribute('shape', 'hexagon');
    el.refresh();
    expect(el.getAvatar()!.body.shape).toBe('hexagon');
    expect(before).not.toBe('hexagon');
  });

  it('falls back to Canvas2D when WebGL2 is missing', async () => {
    const el = await mount<SkkAvatar>('skk-avatar', { seed: 'three-d', mode: '3d' });
    await ready(el);
    expect(el.engine?.requestedMode).toBe('3d');
    expect(el.engine?.mode).toBe('2d');
    expect(el.engine?.fellBack).toBe(true);
  });

  it('exposes a data URL of the canvas', async () => {
    const el = await mount<SkkAvatar>('skk-avatar', { seed: 'shot' });
    await ready(el);
    expect(el.toDataURL()).toMatch(/^data:image\/png/);
  });

  it('stops animating when paused', async () => {
    const el = await mount<SkkAvatar>('skk-avatar', { seed: 'paused', paused: '' });
    await ready(el);
    expect(el.engine?.animator.state).toBeDefined();
  });
});

describe('skk-bot', () => {
  it('renders an avatar inside a positioned host', async () => {
    const el = await mount<SkkBot>('skk-bot', { seed: 'bot', position: 'bottom-right' });
    expect(el.avatarElement).not.toBeNull();
    expect(el.style.transform).toContain('translate3d');
    expect(el.style.position).toBe('fixed');
  });

  it('requests states and reverts transient ones', async () => {
    vi.useFakeTimers();
    try {
      const el = await mount<SkkBot>('skk-bot');
      const seen: string[] = [];
      el.addEventListener('skk-state-change', (e) => seen.push((e as CustomEvent).detail.state));

      el.request('thinking');
      expect(el.botState).toBe('thinking');
      await el.updateComplete;
      expect(el.getAttribute('state')).toBe('thinking');

      el.request('success');
      expect(el.botState).toBe('success');
      vi.advanceTimersByTime(4000);
      await el.updateComplete;
      expect(el.botState).toBe('thinking');
      expect(el.getAttribute('state')).toBe('thinking');
      expect(seen).toEqual(['thinking', 'success', 'thinking']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('locks while sleeping unless forced', async () => {
    const el = await mount<SkkBot>('skk-bot');
    el.request('sleeping');
    el.request('thinking');
    expect(el.botState).toBe('sleeping');
    el.request('thinking', { force: true });
    expect(el.botState).toBe('thinking');
  });

  it('syncs an externally changed state attribute', async () => {
    const el = await mount<SkkBot>('skk-bot');
    el.setAttribute('state', 'listening');
    await el.updateComplete;
    expect(el.botState).toBe('listening');
  });

  it('moves to free coordinates and emits skk-move', async () => {
    const el = await mount<SkkBot>('skk-bot', { 'position-mode': 'free' });
    let detail: { x: number; y: number } | null = null;
    el.addEventListener('skk-move', (e) => (detail = (e as CustomEvent).detail));
    el.moveTo(120, 240);
    await el.updateComplete;
    expect(detail).toEqual({ x: 120, y: 240 });
    expect(el.style.transform).toBe('translate3d(120px, 240px, 0)');
    el.resetPosition();
    await el.updateComplete;
    expect(el.style.transform).not.toBe('translate3d(120px, 240px, 0)');
  });

  it('persists a dragged position', async () => {
    window.localStorage.clear();
    const el = await mount<SkkBot>('skk-bot', { persist: 'demo-bot', 'position-mode': 'free' });
    el.moveTo(37, 91);
    await el.updateComplete;
    expect(Object.values(storageDump()).join(' ')).toContain('37');

    const reloaded = await mount<SkkBot>('skk-bot', { persist: 'demo-bot' });
    await reloaded.updateComplete;
    expect(reloaded.style.transform).toContain('37px');
  });

  it('offsets from an anchor element', async () => {
    const anchor = document.createElement('div');
    anchor.id = 'anchor-target';
    anchor.getBoundingClientRect = () =>
      ({
        x: 50,
        y: 60,
        width: 20,
        height: 20,
        top: 60,
        left: 50,
        right: 70,
        bottom: 80,
        toJSON: () => ({}),
      }) as DOMRect;
    document.body.appendChild(anchor);

    const el = await mount<SkkBot>('skk-bot', {
      'position-mode': 'anchor',
      'anchor-selector': '#anchor-target',
      placement: 'bottom',
      gap: '10',
    });
    await el.updateComplete;
    expect(el.style.transform).toMatch(/translate3d\(-?\d+px, -?\d+px, 0\)/);
  });

  it('portals into the body when asked', async () => {
    const wrapper = document.createElement('div');
    document.body.appendChild(wrapper);
    const el = document.createElement('skk-bot') as SkkBot;
    wrapper.appendChild(el);
    el.portal = true;
    await nextTick(el as unknown as WithUpdate);
    expect(el.parentElement).toBe(document.body);
  });
});

describe('skk-bubble', () => {
  it('shows its message and exposes a status role', async () => {
    const el = await mount<SkkBubble>('skk-bubble', { message: 'Hello there', open: '' });
    expect(el.shadowRoot?.textContent).toContain('Hello there');
    expect(el.getAttribute('role') ?? el.shadowRoot?.querySelector('[role]')?.getAttribute('role')).toBe(
      'status',
    );
  });

  it('uses an assertive live region for errors', async () => {
    const el = await mount<SkkBubble>('skk-bubble', { message: 'Boom', variant: 'error', open: '' });
    const live = el.shadowRoot?.querySelector('[aria-live]');
    expect(live?.getAttribute('aria-live')).toBe('assertive');
  });

  it('auto-dismisses after duration and emits skk-close', async () => {
    vi.useFakeTimers();
    try {
      const el = await mount<SkkBubble>('skk-bubble');
      const closed = vi.fn();
      el.addEventListener('skk-close', closed);
      el.show('Temporary', { duration: 500 });
      await el.updateComplete;
      expect(el.open).toBe(true);
      vi.advanceTimersByTime(600);
      expect(el.open).toBe(false);
      expect(closed).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('closes imperatively', async () => {
    const el = await mount<SkkBubble>('skk-bubble', { message: 'Close me', open: '', dismissible: '' });
    const button = el.shadowRoot?.querySelector<HTMLButtonElement>('button');
    button?.click();
    await el.updateComplete;
    expect(el.open).toBe(false);
  });
});

function storageDump(): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key) out[key] = window.localStorage.getItem(key) ?? '';
  }
  return out;
}
