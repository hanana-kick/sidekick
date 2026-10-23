import type { SidekickAvatar } from './avatar.js';
import { observeElementAnchor } from './element-anchor.js';
import type { HorizontalAlignment, VerticalAlignment } from './element-target.js';
import { validateMoveOptions } from './movement.js';
import type { MoveOptions } from './movement.js';

export interface ScrollRegion {
  id: string;
  region: Element;
  target?: Element;
  /** Viewport top-left CSS pixels, or an element whose matching edges are aligned. */
  waitAt?: { x: number; y: number } | { element: Element; alignX?: HorizontalAlignment; alignY?: VerticalAlignment; x?: number; y?: number };
}
export interface ActiveScrollRegion { id: string; region: Element; target: Element }
export interface ScrollRegionsOptions {
  regions: readonly ScrollRegion[];
  root?: Element;
  activationLine?: number;
  hysteresis?: number;
  movement?: MoveOptions;
  onChange?: (active: ActiveScrollRegion | null) => void;
}
export interface ScrollRegionsController {
  readonly activeRegion: string | null;
  readonly paused: boolean;
  pause(): void;
  resume(): void;
  refresh(): void;
  dispose(): void;
}
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
/** One owned anchor, retargeted without restarting its natural movement track. */
export function createScrollRegions(bot: SidekickAvatar, options: ScrollRegionsOptions): ScrollRegionsController {
  const doc = bot.ownerDocument, win = doc.defaultView;
  if (!win || !bot.isConnected || bot.placement !== 'viewport') throw new TypeError('scroll regions require a connected viewport avatar');
  const element = (value: Element) => {
    if (!value || value.nodeType !== 1 || value.ownerDocument !== doc || value === bot || bot.contains(value)) throw new TypeError('scroll regions require elements in the avatar document, outside the avatar');
  };
  const line = options.activationLine ?? .5, hysteresis = options.hysteresis ?? 48;
  if (!Number.isFinite(line) || line < 0 || line > 1 || !Number.isFinite(hysteresis) || hysteresis < 0) throw new TypeError('invalid scroll region activation line or hysteresis');
  if (!Array.isArray(options.regions)) throw new TypeError('regions must be an array');
  if (options.root) element(options.root);
  const ids = new Set<string>();
  const regions = options.regions.map(entry => {
    if (!entry || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id)) throw new TypeError('scroll region IDs must be unique nonempty strings');
    ids.add(entry.id); element(entry.region); if (entry.target) element(entry.target);
    const wait = entry.waitAt;
    if (wait) {
      if ('element' in wait) {
        element(wait.element);
        if (wait.alignX !== undefined && !['left','center','right'].includes(wait.alignX) || wait.alignY !== undefined && !['top','center','bottom'].includes(wait.alignY)) throw new TypeError('invalid waiting alignment');
      }
      if ((!('element' in wait) || wait.x !== undefined) && !Number.isFinite(wait.x) || (!('element' in wait) || wait.y !== undefined) && !Number.isFinite(wait.y)) throw new TypeError('waiting coordinates must be finite');
    }
    return { ...entry, waitAt: wait && { ...wait } };
  });
  validateMoveOptions(options.movement ?? {});
  const movement: MoveOptions = { travel: 'natural', maxSpeed: 700, acceleration: 1800, deceleration: 2200, ...options.movement };
  const marker = doc.createElement('span');
  marker.dataset.sidekickScrollRegions = ''; marker.setAttribute('aria-hidden', 'true');
  Object.assign(marker.style, { position:'fixed', width:'1px', height:'1px', pointerEvents:'none', opacity:'0', left:'0px', top:'0px' });
  doc.body.append(marker);
  let paused = false, disposed = false, owned = false, revision = 0, active: ScrollRegion | null = null;
  function notify(next: ScrollRegion | null) {
    if (active?.id === next?.id) return;
    active = next;
    try { options.onChange?.(next ? { id: next.id, region: next.region, target: next.target ?? next.region } : null); }
    catch (error) { win!.console.error('Sidekick scroll region onChange failed', error); }
  }
  function stop() {
    revision++;
    if (bot.elementAnchor?.target === marker) bot.cancelMove();
    owned = false;
  }
  function read(): (() => void) | undefined {
    if (disposed || paused || doc.hidden) return;
    if (owned && bot.elementAnchor?.target !== marker || bot.presenceState === 'hidden' || bot.presenceState === 'exiting') {
      return () => { paused = true; owned = false; notify(null); };
    }
    if (!bot.isConnected || options.root && !options.root.isConnected) return () => { stop(); notify(null); };
    const viewport = win!.visualViewport;
    const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0;
    const right = left + (viewport?.width ?? win!.innerWidth), bottom = top + (viewport?.height ?? win!.innerHeight);
    let rootTop = top, rootBottom = bottom, rootLeft = left, rootRight = right;
    if (options.root) { const r = options.root.getBoundingClientRect(); rootTop = Math.max(top,r.top); rootBottom = Math.min(bottom,r.bottom); rootLeft = Math.max(left,r.left); rootRight = Math.min(right,r.right); }
    const activation = rootTop + (rootBottom - rootTop) * line;
    const clips = new Map<Element, { x: boolean; y: boolean; rect: DOMRect | null }>();
    const measured = regions.flatMap(entry => {
      if (!entry.region.isConnected || !entry.region.getClientRects().length || options.root && !options.root.contains(entry.region)) return [];
      const rect = entry.region.getBoundingClientRect();
      let t = Math.max(rootTop,rect.top), b = Math.min(rootBottom,rect.bottom), l = Math.max(rootLeft,rect.left), r = Math.min(rootRight,rect.right);
      for (let p = entry.region.parentElement; p && p !== doc.body; p = p.parentElement) {
        let clip = clips.get(p);
        if (!clip) {
          const style = win!.getComputedStyle(p);
          const x = /(auto|scroll|hidden|clip)/.test(style.overflowX || style.overflow), y = /(auto|scroll|hidden|clip)/.test(style.overflowY || style.overflow);
          clip = { x, y, rect: x || y ? p.getBoundingClientRect() : null }; clips.set(p, clip);
        }
        if (clip.rect) { const box = clip.rect; if (clip.y) { t=Math.max(t,box.top); b=Math.min(b,box.bottom); } if (clip.x) { l=Math.max(l,box.left); r=Math.min(r,box.right); } }
      }
      return b > t && r > l ? [{ entry, top:t, bottom:b, distance: Math.max(t-activation,activation-b,0) }] : [];
    });
    const current = measured.find(item => item.entry.id === active?.id);
    const chosen = current && activation >= current.top-hysteresis && activation <= current.bottom+hysteresis ? current : measured.sort((a,b)=>a.distance-b.distance)[0];
    if (!chosen) return () => { stop(); notify(null); };
    const width = bot.offsetWidth, height = bot.offsetHeight, wait = chosen.entry.waitAt;
    let x = right-width-20, y = top+(bottom-top)*.56-height/2;
    if (wait && 'element' in wait) {
      if (!wait.element.isConnected || !wait.element.getClientRects().length) return () => { stop(); notify(null); };
      const rect = wait.element.getBoundingClientRect();
      x = rect.left+(rect.width-width)*(wait.alignX==='right'?1:wait.alignX==='center'?.5:0)+(wait.x??0);
      y = rect.top+(rect.height-height)*(wait.alignY==='bottom'?1:wait.alignY==='center'?.5:0)+(wait.y??0);
    } else if (wait) { x=wait.x; y=wait.y; }
    x=clamp(x,left,Math.max(left,right-width)); y=clamp(y,top,Math.max(top,bottom-height));
    return () => {
      if (disposed || paused) return;
      if (owned && bot.elementAnchor?.target !== marker) { owned=false; paused=true; notify(null); return; }
      marker.style.left=`${x}px`; marker.style.top=`${y}px`;
      if (!owned) {
        try {
          const token = ++revision;
          const result = bot.moveToElement(marker, { ...movement, anchor:true, alignX:'left', alignY:'top' });
          owned = bot.elementAnchor?.target === marker;
          void result.catch(() => { if (!disposed && token === revision && bot.elementAnchor?.target === marker) { stop(); paused=true; notify(null); } });
        } catch { paused=true; stop(); notify(null); return; }
      }
      notify(chosen.entry);
    };
  }
  const refresh = () => { const write = read(); write?.(); };
  const remove = observeElementAnchor(doc, read, () => true);
  win.visualViewport?.addEventListener('resize', refresh);
  win.visualViewport?.addEventListener('scroll', refresh);
  refresh();
  return {
    get activeRegion() { return active?.id ?? null; },
    get paused() { return paused; },
    pause() { if (!disposed) { paused=true; stop(); notify(null); } },
    resume() { if (!disposed) { paused=false; refresh(); } },
    refresh,
    dispose() { if (disposed) return; disposed=true; remove(); win.visualViewport?.removeEventListener('resize',refresh); win.visualViewport?.removeEventListener('scroll',refresh); stop(); marker.remove(); notify(null); },
  };
}
