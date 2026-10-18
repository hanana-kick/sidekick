import type { HorizontalAlignment, VerticalAlignment } from './element-target.js';

export interface ElementAnchorState {
  readonly target: Element;
  readonly x: number;
  readonly y: number;
  readonly alignX: HorizontalAlignment;
  readonly alignY: VerticalAlignment;
}

interface Binding { read(): (() => void) | undefined }
/** A single read-then-write frame loop per document, only while bindings exist.
 * Geometry polling is intentional: observers do not detect transform-only motion
 * (including Web Animations). Hidden documents suspend it entirely. */
class AnchorScheduler {
  private bindings = new Set<Binding>();
  private frame = 0;
  constructor(private document: Document) {}
  private visibility = (): void => {
    if (this.document.hidden && this.frame) { this.document.defaultView!.cancelAnimationFrame(this.frame); this.frame = 0; }
    else this.schedule();
  };
  add(binding: Binding): () => void {
    if (!this.bindings.size) this.document.addEventListener('visibilitychange', this.visibility);
    this.bindings.add(binding); this.schedule();
    return () => {
      this.bindings.delete(binding);
      if (!this.bindings.size) {
        if (this.frame) this.document.defaultView!.cancelAnimationFrame(this.frame);
        this.frame = 0; this.document.removeEventListener('visibilitychange', this.visibility);
      }
    };
  }
  private schedule(): void {
    if (!this.frame && this.bindings.size && !this.document.hidden) this.frame = this.document.defaultView!.requestAnimationFrame(this.tick);
  }
  private tick = (): void => {
    this.frame = 0;
    const writes: (() => void)[] = [];
    for (const binding of [...this.bindings]) { const write = binding.read(); if (write) writes.push(write); }
    for (const write of writes) write();
    this.schedule();
  };
}
const schedulers = new WeakMap<Document, AnchorScheduler>();
export function observeElementAnchor(document: Document, read: Binding['read']): () => void {
  let scheduler = schedulers.get(document);
  if (!scheduler) { scheduler = new AnchorScheduler(document); schedulers.set(document, scheduler); }
  return scheduler.add({ read });
}
