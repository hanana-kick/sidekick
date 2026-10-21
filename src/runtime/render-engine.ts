import type { PartAnimationClip, PartAnimationTrack } from '../core/part-animation.js';
import { samplePartAnimation } from '../core/part-animation.js';
import { resolveEmotionFrame, emotionHasMotion } from '../core/emotion.js';
import type { EmotionFrame } from '../core/emotion.js';
import { travelPose, travelActivity } from '../core/travel.js';
import { SmoothValues } from '../core/smooth-values.js';
import { clamp, spring } from '../core/math.js';
import { ActivityBlend } from '../core/activity-blend.js';
import { MotionTimeline } from '../core/motion.js';
import type { MotionResult } from '../core/motion.js';
import { ShapeTimeline } from '../core/shape-motion.js';
import { TrackingBodyLayer } from '../core/tracking.js';
import { cropPixels } from '../core/pixels.js';
import { automaticBlink } from '../core/expressions.js';
import type { PixelBuffer, SnapshotOptions } from '../core/pixels.js';
import { AvatarRenderer } from '../renderer/webgl.js';
import { RendererInitializationError } from '../renderer/render-backend.js';
import type { RenderState } from '../renderer/webgl.js';
import type { AvatarDesign, Vec2 } from '../core/design.js';
import { presentationSignature } from './presentation.js';
import type { RuntimeCommand, RuntimeEvent, RuntimeSnapshot, RuntimeState } from './protocol.js';

export interface RuntimeRenderer {
  readonly canvas: HTMLCanvasElement | OffscreenCanvas;
  readonly animating?: boolean;
  readonly graphics?: 'webgl2' | 'canvas2d';
  readonly stats: { drawCalls: number; buffers: number };
  resize(width: number, height: number, dpr: number): void;
  render(design: AvatarDesign, state: RenderState): void;
  readPixels(): Uint8Array;
  dispose(): void;
}
export interface FrameScheduler { request(callback: (now: number) => void): number; cancel(id: number): void }
const IDLE_DRAW_INTERVAL = 1 / 30;
export function frameScheduler(scope: typeof globalThis = globalThis): FrameScheduler {
  let next = 0;
  const pending = new Map<number, { kind: 'raf' | 'timer'; handle: number }>();
  return {
    request(callback) {
      const id = ++next;
      const run = (now: number): void => { pending.delete(id); callback(now); };
      // Worker RAF can exist but throw when its owner has no supported Window.
      if (typeof scope.requestAnimationFrame === 'function') {
        try { const handle = scope.requestAnimationFrame(run); pending.set(id, { kind: 'raf', handle }); return id; } catch { /* Timers remain usable. */ }
      }
      const handle = scope.setTimeout(() => run(scope.performance.now()), 16) as unknown as number;
      pending.set(id, { kind: 'timer', handle }); return id;
    },
    cancel(id) {
      const task = pending.get(id); if (!task) return; pending.delete(id);
      if (task.kind === 'raf') scope.cancelAnimationFrame(task.handle); else scope.clearTimeout(task.handle);
    },
  };
}

/** All animated state and geometry live here, on the dedicated worker by default. */
export class RenderEngine {
  private state: RuntimeState;
  private timeline: MotionTimeline;
  private shape: ShapeTimeline;
  private activityBlend: ActivityBlend;
  private emotion: SmoothValues;
  private emotionEyeControl: MotionTimeline;
  private orientation: SmoothValues;
  private attention: SmoothValues;
  private tracking = new TrackingBodyLayer();
  private velocity: Vec2 = [0, 0];
  private scheduled = 0;
  private lastTick = 0;
  private idleDrawElapsed = 0;
  private rendererDelta = 0;
  private dirty = true;
  private resizePending = false;
  private equipmentImmediate = false;
  private disposed = false;
  private frames = 0;
  private revision = 0;
  private batchDepth = 0;
  private renderCpu = { lastMs: 0, totalMs: 0, maxMs: 0 };
  private renderedRotation: import('../core/design.js').Vec3 = [0, 0, 0];
  private readonly contextLost = (event: Event): void => {
    event.preventDefault();
    this.stop();
    // Send the latest pose/phase before the owner replaces the locked WebGL canvas.
    this.notify({ kind: 'frame', snapshot: this.snapshot });
    this.notify({ kind: 'error', message: 'WebGL context lost', rendererFallback: true });
  };
  readonly renderer: RuntimeRenderer;
  constructor(canvas: HTMLCanvasElement | OffscreenCanvas, initial: RuntimeState, private readonly emit: (event: RuntimeEvent, revision?: number) => void, private readonly scheduler = frameScheduler(), renderer?: RuntimeRenderer) {
    this.state = structuredClone(initial);
    this.emotion = new SmoothValues(this.emotionTarget());
    this.emotionEyeControl = new MotionTimeline({ left: { weights: { smile: 0, blink: initial.emotionEyeOverrides?.left ? 1 : 0 } }, right: { weights: { smile: 0, blink: initial.emotionEyeOverrides?.right ? 1 : 0 } } });
    this.orientation = new SmoothValues([initial.bodyOrientation.yaw, initial.bodyOrientation.pitch, initial.bodyOrientation.roll], 22, .0001);
    this.attention = new SmoothValues([initial.attention ? 1 : 0]);
    this.timeline = new MotionTimeline({ left: initial.design.eyes.left, right: initial.design.eyes.right });
    this.timeline.seedPose(initial.pose);
    if (initial.paused || initial.reduced) this.timeline.pose.gaze = [...initial.gaze];
    this.activityBlend = new ActivityBlend(initial.activity, initial.time, initial.reduced);
    this.shape = new ShapeTimeline(initial.design.body.shape);
    this.renderer = renderer ?? new AvatarRenderer(canvas, { renderer: initial.renderer });
    try {
      canvas.addEventListener('webglcontextlost', this.contextLost);
      this.renderer.resize(initial.width, initial.height, initial.dpr);
      this.updateTracking(); this.updatePartAnimationAvailability();
      this.render(true); this.wake();
    } catch (error) {
      // The bridge cannot own this instance until construction succeeds. Release
      // the acquired renderer, listener and any frame before propagating failure.
      this.dispose();
      if (!renderer && this.renderer.graphics === 'webgl2') throw new RendererInitializationError(error);
      throw error;
    }
  }
  get snapshot(): RuntimeSnapshot {
    return { graphics: this.renderer.graphics, travel: this.state.travel ? structuredClone(this.state.travel) : undefined, renderCpu: { ...this.renderCpu }, pose: structuredClone(this.timeline.pose), time: this.state.time, renderedRotation: [...this.renderedRotation], frames: this.frames, running: this.scheduled !== 0, ...this.renderer.stats, width: this.renderer.canvas.width, height: this.renderer.canvas.height };
  }
  private notify(event: RuntimeEvent, revision = this.revision): void {
    if (this.batchDepth && event.kind === 'frame') return;
    this.emit(event, revision);
  }
  private complete(request: number | undefined, result: Promise<MotionResult>): void {
    void result.then(value => {
      if (this.disposed || request === undefined) return;
      if (this.dirty && this.state.active) this.render(true);
      if (!this.animated()) this.stop();
      this.notify({ kind: 'complete', request, result: value, snapshot: this.snapshot }, this.revision);
    }).catch(error => { if (!this.disposed) { this.stop(); this.notify({ kind: 'error', message: error instanceof Error ? error.message : String(error) }); } });
  }
  command(command: RuntimeCommand, revision = this.revision + 1): void {
    if (this.disposed) return;
    this.revision = revision;
    switch (command.kind) {
      case 'batch': {
        this.batchDepth++;
        try { for (const part of command.commands) this.command(part, revision); } finally { this.batchDepth--; }
        this.notify({ kind: 'frame', snapshot: this.snapshot }, revision); return;
      }
      case 'design': {
        const next = command.design, previous = this.state.design;
        this.equipmentImmediate ||= command.transition?.equipmentImmediate ?? false;
        if (next.body.shape !== previous.body.shape) {
          if (command.transition) this.complete(command.shapeRequest, this.shape.to(next.body.shape, command.transition.shape));
          else if (this.state.paused || this.state.reduced) this.shape.set(next.body.shape);
          else this.complete(undefined, this.shape.to(next.body.shape));
        } else if (command.shapeRequest !== undefined) this.complete(command.shapeRequest, Promise.resolve({ finished: true }));
        const sides = (['left', 'right'] as const).filter(side => command.transition?.eyeSides?.includes(side) || next.eyes[side].weights.smile !== previous.eyes[side].weights.smile || next.eyes[side].weights.blink !== previous.eyes[side].weights.blink);
        if (sides.length) {
          if (command.transition) this.complete(command.eyeRequest, this.timeline.to({ eyes: Object.fromEntries(sides.map(side => [side, { weights: next.eyes[side].weights }])) }, command.transition.eyes));
          else if (this.state.paused || this.state.reduced) this.timeline.setEyes({ left: next.eyes.left, right: next.eyes.right }, sides);
          else this.complete(undefined, this.timeline.to({ eyes: Object.fromEntries(sides.map(side => [side, { weights: next.eyes[side].weights }])) }));
        } else if (command.eyeRequest !== undefined) this.complete(command.eyeRequest, Promise.resolve({ finished: true }));
        this.timeline.removeAccessories(previous.accessories.filter(item => !next.accessories.some(part => part.id === item.id)).map(item => item.id));
        this.state.design = next;
        break;
      }
      case 'eye-control':
        this.state.emotionEyeOverrides = { ...command.overrides };
        void this.emotionEyeControl.to({ eyes: Object.fromEntries(command.sides.map(side => [side, { weights: { blink: command.overrides[side] ? 1 : 0 } }])) }, { ...command.options, duration: this.state.paused || this.state.reduced ? 0 : command.options.duration });
        break;
      case 'motion': this.complete(command.request, this.timeline.to(command.target, command.options)); break;
      case 'shape': this.complete(command.request, this.shape.to(command.shape, command.options)); this.state.design = { ...this.state.design, body: { ...this.state.design.body, shape: command.shape } }; break;
      case 'persist-design': this.state.design = command.design; break;
      case 'cancel-assets': if (command.shape) this.shape.cancel(); if (command.expression) { this.timeline.cancelEyes(); this.cancelManualEyeControl(); } break;
      case 'cancel': this.timeline.cancel(); this.cancelManualEyeControl(); break;
      case 'state': {
        const changed = Object.entries(command.state).some(([key, value]) => {
          const previous = this.state[key as keyof RuntimeState];
          if (Array.isArray(value) && Array.isArray(previous)) return value.length !== previous.length || value.some((part, index) => part !== previous[index]);
          if (key === 'bodyOrientation' && value && typeof value === 'object') { const bodyOrientation = value as RuntimeState['bodyOrientation']; return bodyOrientation.yaw !== this.state.bodyOrientation.yaw || bodyOrientation.pitch !== this.state.bodyOrientation.pitch || bodyOrientation.roll !== this.state.bodyOrientation.roll; }
          return value !== previous;
        });
        if (!changed) { this.notify({ kind: 'frame', snapshot: this.snapshot }, this.revision); return; }
        const wasActive = this.state.active;
        if ((command.state.activity !== undefined && command.state.activity !== this.state.activity)
          || (command.state.paused !== undefined && command.state.paused !== this.state.paused)
          || (command.state.reduced !== undefined && command.state.reduced !== this.state.reduced)
          || (command.state.time !== undefined && command.state.time !== this.state.time)) this.resetPacing();
        if (command.state.activity !== undefined) this.activityBlend.set(command.state.activity, (command.state.paused ?? this.state.paused) || (command.state.reduced ?? this.state.reduced));
        if (Object.hasOwn(command.state, 'pluginAccessories')) {
          const next = command.state.pluginAccessories ?? [];
          this.timeline.removeAccessories((this.state.pluginAccessories ?? []).filter(item => !next.some(other => other.id === item.id)).map(item => item.id));
        }
        Object.assign(this.state, command.state);
        if (!this.state.active || wasActive !== this.state.active) this.stop();
        if (this.state.paused || this.state.reduced) {
          this.emotion.set(this.emotionTarget()); this.emotionEyeControl.advance(60000); this.orientation.set(this.orientationTarget()); this.attention.set([this.state.attention ? 1 : 0]);
          this.timeline.advance(60000); this.shape.finish(); this.activityBlend.finish();
          this.timeline.pose.gaze = [...this.state.gaze]; this.velocity = [0, 0];
        }
        this.updateTracking();
        break;
      }
      case 'resize': {
        const { width, height, dpr } = command;
        if (width === this.state.width && height === this.state.height && dpr === this.state.dpr) { this.notify({ kind: 'frame', snapshot: this.snapshot }, this.revision); return; }
        Object.assign(this.state, { width, height, dpr });
        // Hidden layout changes do not need GPU framebuffer reallocations. Keep
        // only the latest size; the next visible draw or explicit capture applies it.
        this.resizePending = true; break;
      }
      case 'reset-tracking': this.tracking.reset(); this.velocity = [0, 0]; this.timeline.pose.gaze = [...this.state.gaze]; break;
      case 'resume-presentation': this.presentationHeld = false; this.wake(); return;
      case 'present': {
        // Startup barrier: commands queued during module/worker loading belong
        // to the initial configuration, not an animation from fallback defaults.
        this.timeline.advance(60000); this.shape.finish(); this.activityBlend.finish();
        this.emotion.set(this.emotionTarget()); this.emotionEyeControl.advance(60000);
        this.orientation.set(this.orientationTarget()); this.attention.set([this.state.attention ? 1 : 0]);
        this.timeline.pose.gaze = [...this.state.gaze]; this.velocity = [0, 0];
        this.equipmentImmediate = true;
        this.presentationHeld = command.verifySurface === true;
        this.render(true); if (this.presentationHeld || !this.animated()) this.stop();
        const presentation = this.presentationHeld ? presentationSignature({ width: this.renderer.canvas.width, height: this.renderer.canvas.height, pixels: this.renderer.readPixels() }, true) : undefined;
        this.notify({ kind: 'complete', request: command.request, result: { finished: true }, presentation, snapshot: this.snapshot });
        return;
      }
      case 'flush': this.render(true); this.notify({ kind: 'complete', request: command.request, result: { finished: true }, snapshot: this.snapshot }); return;
      case 'capture': this.notify({ kind: 'pixels', request: command.request, image: this.capture(), snapshot: this.snapshot }); return;
      case 'snapshot': {
        const image = this.capture(), snapshot = this.snapshot, revision = this.revision;
        void encodeSnapshot(image, command.options, this.renderer.canvas).then(blob => {
          if (!this.disposed) this.notify({ kind: 'snapshot', request: command.request, blob, snapshot }, revision);
        }, error => { if (!this.disposed) this.notify({ kind: 'request-error', request: command.request, message: error instanceof Error ? error.message : String(error) }, revision); });
        return;
      }
      case 'dispose': this.dispose(); return;
    }
    if (command.kind === 'design' || command.kind === 'persist-design' || (command.kind === 'state' && (Object.hasOwn(command.state, 'partAnimation') || Object.hasOwn(command.state, 'pluginAccessories')))) this.updatePartAnimationAvailability();
    this.dirty = true; this.wake();
    // Immediate commands acknowledge their pose even when the surface is hidden.
    this.notify({ kind: 'frame', snapshot: this.snapshot });
  }
  capture(): PixelBuffer {
    this.render(true); if (!this.animated()) this.stop();
    return { width: this.renderer.canvas.width, height: this.renderer.canvas.height, pixels: this.renderer.readPixels() };
  }
  private updateTracking(): void { this.tracking.follow(this.state.trackingMode === 'eyes-and-body' && !this.state.reduced ? this.state.trackedGaze : undefined); }
  private gazeMoving(): boolean { return this.state.gaze.some((target, i) => Math.abs(target - this.timeline.pose.gaze[i]!) > .0001 || Math.abs(this.velocity[i]!) > .0001); }
  private cancelManualEyeControl(): void {
    this.emotionEyeControl.cancelEyes((['left', 'right'] as const).filter(side => this.state.emotionEyeOverrides?.[side]));
  }
  private emotionTarget(): number[] { const e = resolveEmotionFrame(this.state.emotion ?? { emotion: 'neutral', intensity: 1 }, this.state.time, this.state.reduced); return [e.smile, e.blink, e.eyeWeight, e.bob, e.roll, e.pitch, ...e.gaze, e.squash]; }
  private emotionFrame(): EmotionFrame { const [smile, blink, eyeWeight, bob, roll, pitch, x, y, squash] = this.emotion.values; return { smile: smile!, blink: blink!, eyeWeight: eyeWeight!, bob: bob!, roll: roll!, pitch: pitch!, gaze: [x!, y!], squash: squash! }; }
  private orientationTarget(): number[] { const o = this.state.bodyOrientation; return [o.yaw, o.pitch, o.roll]; }
  private presentationMoving(): boolean { return this.emotionEyeControl.active || this.emotion.moving(this.emotionTarget()) || (!this.state.reduced && emotionHasMotion(this.state.emotion ?? { emotion: 'neutral', intensity: 1 })) || this.orientation.moving(this.orientationTarget()) || this.attention.moving([this.state.attention ? 1 : 0]); }
  private readonly movingPartTracks = new WeakMap<PartAnimationClip, PartAnimationTrack[]>();
  private partAnimationAvailable = false;
  private updatePartAnimationAvailability(): void {
    const part = this.state.partAnimation;
    if (!part) { this.partAnimationAvailable = false; return; }
    let tracks = this.movingPartTracks.get(part.clip);
    if (!tracks) {
      tracks = part.clip.tracks.filter(track => {
        const first = track.keyframes[0]!.value;
        return track.keyframes.some(key => typeof first === 'number' ? key.value !== first : Array.isArray(key.value) && key.value.some((value, i) => value !== first[i]));
      });
      this.movingPartTracks.set(part.clip, tracks);
    }
    const plugins = this.state.pluginAccessories ?? [];
    const ids = new Set([...plugins.map(item => item.id), ...this.state.design.accessories.filter(item => !plugins.some(plugin => plugin.slot === item.slot)).map(item => item.id)]);
    this.partAnimationAvailable = tracks.some(track => typeof track.target !== 'object' || ids.has(track.target.accessory));
  }
  private partAnimationMoving(): boolean {
    const part = this.state.partAnimation;
    return this.partAnimationAvailable && !!part?.playing && !this.state.reduced && (part.clip.loop === true || part.time + this.state.time - part.anchorTime < part.clip.duration);
  }
  private animated(): boolean {
    if (this.state.paused) return this.tracking.settling;
    return this.partAnimationMoving() || this.renderer.animating || this.presentationMoving() || this.activityBlend.active || this.timeline.active || this.shape.active || this.gazeMoving() || this.tracking.active || (!this.state.reduced && this.state.activity !== 'still');
  }
  private paceIdle(): boolean {
    return !this.dirty && !this.partAnimationMoving() && !this.renderer.animating && !this.presentationMoving() && this.state.activity === 'idle' && !this.state.paused && !this.state.reduced && !this.activityBlend.active && !this.timeline.active && !this.shape.active && !this.gazeMoving() && !this.tracking.active;
  }
  private resetPacing(): void { this.idleDrawElapsed = 0; this.rendererDelta = 0; }
  private presentationHeld = false;
  private wake(): void {
    if (this.disposed || this.presentationHeld || this.scheduled || !this.state.active || (!this.dirty && !this.animated())) return;
    this.scheduled = this.scheduler.request(this.tick);
  }
  private stop(): void { if (this.scheduled) this.scheduler.cancel(this.scheduled); this.scheduled = 0; this.lastTick = 0; this.resetPacing(); }
  private tick = (now: number): void => {
    try { this.tickFrame(now); } catch (error) { this.stop(); this.notify({ kind: 'error', message: error instanceof Error ? error.message : String(error) }); }
  };
  private tickFrame(now: number): void {
    this.scheduled = 0;
    if (this.disposed || !this.state.active) return;
    const elapsed = this.lastTick ? clamp(now - this.lastTick, 0, 60000) : 0;
    const delta = Math.min(elapsed / 1000, .05); this.lastTick = now;
    // Preserve pre-advance activity so a track's exact endpoint is never skipped.
    const idle = this.paceIdle();
    this.idleDrawElapsed += delta; this.rendererDelta += delta;
    if (!this.state.paused) {
      this.orientation.advance(this.orientationTarget(), delta); this.attention.advance([this.state.attention ? 1 : 0], delta);
      this.emotion.advance(this.emotionTarget(), delta); this.emotionEyeControl.advance(elapsed);
      this.state.time += delta; this.activityBlend.advance(elapsed); this.timeline.advance(elapsed); this.shape.advance(elapsed);
      for (const i of [0, 1] as const) {
        const [position, velocity] = spring(this.timeline.pose.gaze[i], this.velocity[i], this.state.gaze[i], delta, 16);
        this.timeline.pose.gaze[i] = position; this.velocity[i] = velocity;
        if (Math.abs(this.state.gaze[i] - position) < .0001 && Math.abs(velocity) < .0001) { this.timeline.pose.gaze[i] = this.state.gaze[i]; this.velocity[i] = 0; }
      }
    }
    if (!this.state.paused || this.tracking.settling) this.tracking.advance(delta);
    // Keep the entire blink, its final reopen and one incoming frame at RAF rate.
    const blink = idle && (automaticBlink(this.state.time) < 1 || automaticBlink(this.state.time + (delta || 1 / 60)) < 1 || automaticBlink(this.state.time - delta) < 1);
    const draw = !idle || !this.paceIdle() || blink || this.idleDrawElapsed + 1e-9 >= IDLE_DRAW_INTERVAL;
    if (draw) {
      // Carry cadence remainder to avoid 60 Hz floating-point drift into 20 Hz.
      const carry = idle && !blink ? Math.max(0, this.idleDrawElapsed - IDLE_DRAW_INTERVAL) % IDLE_DRAW_INTERVAL : 0;
      this.render(true); this.idleDrawElapsed = carry;
    }
    this.wake();
    if (!this.scheduled) this.lastTick = 0;
    if (draw) this.notify({ kind: 'frame', snapshot: this.snapshot });
  }
  private render(force = false): void {
    if (this.disposed || (!force && !this.dirty && !this.animated())) return;
    if (this.resizePending) {
      this.renderer.resize(this.state.width, this.state.height, this.state.dpr);
      this.resizePending = false;
    }
    const shape = this.shape.snapshot;
    const travel = this.state.reduced ? undefined : this.state.travel;
    const tracked = this.tracking.compose(this.timeline.pose);
    if (travel?.strength) tracked.rotation = tracked.rotation.map((value, index) => value + (this.timeline.pose.rotation[index]! - value) * travel.strength) as typeof tracked.rotation;
    const pose = travelPose(tracked, travel);
    const emotion = this.emotionFrame();
    pose.rotation = [pose.rotation[0] + emotion.pitch, pose.rotation[1], pose.rotation[2]];
    pose.eyes = Object.fromEntries((['left', 'right'] as const).map(side => [side, {
      smile: pose.eyes[side].smile + (emotion.smile - pose.eyes[side].smile) * emotion.eyeWeight * this.emotionEyeControl.pose.eyes[side].openness,
      openness: pose.eyes[side].openness + (1 - emotion.blink - pose.eyes[side].openness) * emotion.eyeWeight * this.emotionEyeControl.pose.eyes[side].openness,
    }])) as typeof pose.eyes;
    const clip = this.state.partAnimation;
    const partAnimation = clip ? samplePartAnimation(clip.clip, clip.time + (clip.playing && !this.state.reduced ? this.state.time - clip.anchorTime : 0)) : undefined;
    if (partAnimation?.bodyRotation) pose.rotation = partAnimation.bodyRotation;
    if (partAnimation?.face) pose.face = partAnimation.face;
    for (const side of ['left', 'right'] as const) if (partAnimation?.eyes?.[side]) pose.eyes[side] = partAnimation.eyes[side]!;
    this.renderedRotation = [...pose.rotation];
    const activityFrame = travelActivity(this.activityBlend.sample(this.state.time, this.state.reduced), travel);
    activityFrame.bob += emotion.bob; activityFrame.roll += emotion.roll; activityFrame.squash *= emotion.squash;
    activityFrame.gaze = activityFrame.gaze.map((value, i) => (value + emotion.gaze[i]!) * (1 - this.attention.values[0]!)) as Vec2;
    const [yaw, pitch, roll] = this.orientation.values;
    const started = performance.now();
    this.renderer.render(this.state.design, { partAnimation, pluginAccessories: this.state.pluginAccessories, pose, eyeMotion: this.timeline.eyeMotion, contour: shape.contour, profile: shape.profile, shapeWeights: this.state.pluginAccessories?.some(item => item.asset.attachment) ? shape.shapeWeights : undefined, activity: this.state.activity, instant: this.state.paused || this.state.reduced, equipmentImmediate: this.equipmentImmediate, activityFrame, travel, time: this.state.time, delta: this.rendererDelta, reduced: this.state.reduced, style: 'flat', bodyOrientation: { yaw: yaw!, pitch: pitch!, roll: roll! }, zoom: this.state.zoom });
    const duration = performance.now() - started;
    this.renderCpu.lastMs = duration; this.renderCpu.totalMs += duration; this.renderCpu.maxMs = Math.max(this.renderCpu.maxMs, duration);
    this.equipmentImmediate = false; this.dirty = false; this.frames++; this.resetPacing();
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.stop(); this.timeline.cancel(); this.emotionEyeControl.cancel(); this.shape.cancel(); this.tracking.reset();
    this.renderer.canvas.removeEventListener('webglcontextlost', this.contextLost); this.renderer.dispose();
  }
}

/** GPU bytes are bottom-up; flip after cropping so PNGs retain their orientation. */
export async function encodeSnapshot(image: PixelBuffer, options: SnapshotOptions, source: HTMLCanvasElement | OffscreenCanvas): Promise<Blob> {
  const cropped = cropPixels(image, options), { width, height } = cropped;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) pixels.set(cropped.pixels.subarray(y * width * 4, (y + 1) * width * 4), (height - y - 1) * width * 4);
  // WebGL's antialiased framebuffer is premultiplied; ImageData expects straight RGBA.
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3]!;
    if (alpha > 0 && alpha < 255) for (let channel = 0; channel < 3; channel++) pixels[i + channel] = Math.min(255, Math.round(pixels[i + channel]! * 255 / alpha));
  }
  const canvas = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(width, height) : (source as HTMLCanvasElement).ownerDocument.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!context) throw new Error('PNG 내보내기용 canvas를 만들지 못했습니다.');
  context.putImageData(new ImageData(pixels, width, height), 0, 0);
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type: 'image/png' });
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG 내보내기 실패')), 'image/png'));
}
