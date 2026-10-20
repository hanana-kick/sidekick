import type { RenderEngine } from './render-engine.js';
import { createRenderWorker } from './create-worker.js';
import { PROTOCOL_VERSION } from './protocol.js';
import type { RuntimeCommand, RuntimeEvent, RuntimeSnapshot, RuntimeState, WorkerRequest, WorkerResponse } from './protocol.js';
import type { PixelBuffer } from '../core/pixels.js';

export interface BridgeCallbacks {
  ready(snapshot: RuntimeSnapshot, revision: number): void;
  event(event: RuntimeEvent, revision: number): void;
  failed(error: Error, rendererFallback?: boolean): void;
}
export interface RenderBridge {
  readonly backend: 'worker' | 'main';
  readonly generation: number;
  readonly revision: number;
  readonly transferred: boolean;
  start(state: RuntimeState): void;
  send(command: RuntimeCommand): void;
  capture?(): PixelBuffer;
  dispose(): void;
}
export class LocalRenderBridge implements RenderBridge {
  readonly backend = 'main' as const;
  readonly transferred = false;
  revision = 0;
  private engine?: RenderEngine;
  private disposed = false;
  private queued: { command: RuntimeCommand; revision: number }[] = [];
  constructor(private canvas: HTMLCanvasElement, readonly generation: number, private callbacks: BridgeCallbacks) {}
  start(state: RuntimeState): void {
    // Successful worker mode must never initialize renderer modules or mesh factories on main.
    void import('./render-engine.js').then(({ RenderEngine }) => {
      if (this.disposed) return;
      this.engine = new RenderEngine(this.canvas, state, (event, revision = this.revision) => { if (!this.disposed) this.callbacks.event(event, revision); });
      for (const queued of this.queued) this.engine.command(queued.command, queued.revision);
      this.queued = [];
      if (!this.disposed) this.callbacks.ready(this.engine.snapshot, this.revision);
    }).catch(error => { if (!this.disposed) this.callbacks.failed(error instanceof Error ? error : new Error(String(error)), error instanceof Error && error.name === 'RendererInitializationError'); });
  }
  send(command: RuntimeCommand): void {
    if (this.disposed) return;
    const revision = ++this.revision;
    if (this.engine) { try { this.engine.command(command, revision); } catch (error) { this.callbacks.failed(error instanceof Error ? error : new Error(String(error)), error instanceof Error && error.name === 'RendererInitializationError'); } } else this.queued.push({ command, revision });
  }
  capture(): PixelBuffer {
    if (!this.engine || this.disposed) throw new Error('Renderer is not ready');
    const image = this.engine.capture(); this.callbacks.event({ kind: 'frame', snapshot: this.engine.snapshot }, this.revision); return image;
  }
  dispose(): void { if (this.disposed) return; this.disposed = true; this.engine?.dispose(); this.engine = undefined; this.queued = []; }
}

export class WorkerRenderBridge implements RenderBridge {
  readonly backend = 'worker' as const;
  revision = 0;
  transferred = false;
  private worker: Worker;
  private disposed = false;
  private timeout?: ReturnType<typeof setTimeout>;
  constructor(private canvas: HTMLCanvasElement, readonly generation: number, private callbacks: BridgeCallbacks, create = createRenderWorker) {
    this.worker = create();
    this.worker.addEventListener('message', this.message);
    this.worker.addEventListener('error', this.error);
    this.worker.addEventListener('messageerror', this.messageError);
  }
  start(state: RuntimeState): void {
    const canvas = this.canvas.transferControlToOffscreen(); this.transferred = true;
    this.timeout = setTimeout(() => this.fail(new Error('Render worker startup timed out')), 10000);
    this.post({ version: PROTOCOL_VERSION, generation: this.generation, sequence: this.revision, kind: 'init', canvas, state }, [canvas]);
  }
  send(command: RuntimeCommand): void {
    if (!this.disposed) this.post({ version: PROTOCOL_VERSION, generation: this.generation, sequence: ++this.revision, kind: 'command', command });
  }
  private post(message: WorkerRequest, transfer: Transferable[] = []): void {
    try { this.worker.postMessage(message, transfer); } catch (error) { this.fail(error instanceof Error ? error : new Error(String(error))); }
  }
  private message = ({ data }: MessageEvent<WorkerResponse>): void => {
    if (this.disposed || !data || data.version !== PROTOCOL_VERSION || data.generation !== this.generation || data.sequence > this.revision) return;
    if (data.kind === 'ready') { clearTimeout(this.timeout); this.timeout = undefined; this.callbacks.ready(data.snapshot, data.sequence); }
    else if (data.kind === 'error') this.fail(new Error(data.message), data.rendererFallback);
    else this.callbacks.event(data, data.sequence);
  };
  private error = (event: ErrorEvent): void => { event.preventDefault(); this.fail(new Error(event.message || 'Render worker failed to load')); };
  private messageError = (): void => this.fail(new Error('Render worker message could not be decoded'));
  private fail(error: Error, rendererFallback = false): void { if (this.disposed) return; this.dispose(); this.callbacks.failed(error, rendererFallback); }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; clearTimeout(this.timeout); this.timeout = undefined;
    this.worker.removeEventListener('message', this.message); this.worker.removeEventListener('error', this.error); this.worker.removeEventListener('messageerror', this.messageError);
    this.worker.terminate();
  }
}

/** No probe may call getContext() on the HTML canvas before its one transfer. */
export function supportsRenderWorker(canvas: HTMLCanvasElement): boolean {
  return typeof Worker === 'function' && typeof OffscreenCanvas === 'function' && typeof canvas.transferControlToOffscreen === 'function';
}
