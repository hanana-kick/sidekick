import type { HorizontalAlignment, VerticalAlignment } from './element-target.js';

export interface ElementAnchorState {
  readonly target: Element;
  readonly x: number;
  readonly y: number;
  readonly alignX: HorizontalAlignment;
  readonly alignY: VerticalAlignment;
}

interface Binding { read(): (() => void) | undefined; idle(): boolean; nextRead: number }
/** One read-then-write loop per document. Visible pursuit samples each frame;
 * sleeping bindings check transforms at 4 Hz, with immediate scroll/resize wake.
 * Hidden documents do no geometry polling. */
class AnchorScheduler {
  private bindings = new Set<Binding>();
  private frame = 0;
  private timer = 0;
  private forceRead = false;
  constructor(private document: Document) {}
  private stop(): void {
    if (this.frame) this.document.defaultView!.cancelAnimationFrame(this.frame);
    if (this.timer) this.document.defaultView!.clearTimeout(this.timer);
    this.frame = this.timer = 0;
  }
  private wake = (): void => { this.stop(); this.forceRead = true; this.schedule(true); };
  add(binding: Binding): () => void {
    if (!this.bindings.size) {
      this.document.addEventListener('visibilitychange', this.wake);
      this.document.addEventListener('scroll', this.wake, true);
      this.document.defaultView!.addEventListener('resize', this.wake);
    }
    this.bindings.add(binding); this.wake();
    return () => {
      this.bindings.delete(binding);
      if (!this.bindings.size) {
        this.stop();
        this.document.removeEventListener('visibilitychange', this.wake);
        this.document.removeEventListener('scroll', this.wake, true);
        this.document.defaultView!.removeEventListener('resize', this.wake);
      }
    };
  }
  private schedule(immediate = false): void {
    if (this.frame || this.timer || !this.bindings.size || this.document.hidden) return;
    if (!immediate && [...this.bindings].every(binding => binding.idle())) {
      this.timer = this.document.defaultView!.setTimeout(() => { this.timer = 0; this.schedule(true); }, 250);
    } else this.frame = this.document.defaultView!.requestAnimationFrame(this.tick);
  }
  private tick = (): void => {
    this.frame = 0;
    const writes: (() => void)[] = [];
    const now = this.document.defaultView!.performance.now(), force = this.forceRead;
    this.forceRead = false;
    for (const binding of [...this.bindings]) {
      if (!force && binding.idle() && now < binding.nextRead) continue;
      binding.nextRead = now + 250;
      const write = binding.read(); if (write) writes.push(write);
    }
    for (const write of writes) write();
    this.schedule();
  };
}
const schedulers = new WeakMap<Document, AnchorScheduler>();
export function observeElementAnchor(document: Document, read: Binding['read'], idle: Binding['idle'] = () => false): () => void {
  let scheduler = schedulers.get(document);
  if (!scheduler) { scheduler = new AnchorScheduler(document); schedulers.set(document, scheduler); }
  return scheduler.add({ read, idle, nextRead: 0 });
}
