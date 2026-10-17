import { ACTIVITIES, createDesign, equipAccessory, finite, parseDesign, patchDesign, removeAccessory } from '../core/design.js';
import type { AccessoryDesign, Activity, AvatarDesign, DesignPatch, RenderStyle, Vec2 } from '../core/design.js';
import { clamp, spring } from '../core/math.js';
import { MotionTimeline, validateMotionOptions } from '../core/motion.js';
import { ShapeTimeline, validateShapeMotionOptions } from '../core/shape-motion.js';
import type { ShapeMotionOptions, ShapeMotionResult } from '../core/shape-motion.js';
import type { MaterialShapeName } from '../core/shapes.js';
import type { EyeExpression, EyeShapeWeights } from '../core/expressions.js';
import { expressionDuration, eyeExpressionWeights, patchEyeState } from '../core/expressions.js';
import { cameraPreset, createCamera, patchCamera } from '../core/camera.js';
import type { CameraAngles, CameraPreset } from '../core/camera.js';
import type { MotionOptions, MotionResult, MotionTarget, Pose } from '../core/motion.js';
import { AvatarRenderer } from '../renderer/webgl.js';
const HTMLElementBase = (typeof HTMLElement === 'undefined' ? class {} : HTMLElement) as typeof HTMLElement;

export class SidekickAvatar extends HTMLElementBase {
  static observedAttributes = ['render-style', 'activity', 'paused', 'interaction'];
  private configuration = createDesign();
  private timeline = new MotionTimeline({ left: this.configuration.eyes.left, right: this.configuration.eyes.right });
  private shapeTimeline = new ShapeTimeline(this.configuration.body.shape);
  private renderer?: AvatarRenderer;
  private canvas?: HTMLCanvasElement;
  private fallback?: HTMLSpanElement;
  private sizeObserver?: ResizeObserver;
  private visibilityObserver?: IntersectionObserver;
  private media?: MediaQueryList;
  private visible = true;
  private reduced = false;
  private raf = 0;
  private lastTick = 0;
  private elapsed = 0;
  private frames = 0;
  private readyState = false;
  private currentActivity: Activity = 'idle';
  private cameraAngles = createCamera();
  private gazeTarget: Vec2 = [0, 0];
  private gazeVelocity: Vec2 = [0, 0];
  private drag?: { id: number; x: number; y: number; camera: CameraAngles; moved: boolean };
  readonly motion = {
    to: (target: MotionTarget, options: MotionOptions = {}): Promise<MotionResult> => {
      for (const id of Object.keys(target.accessories ?? {})) if (!this.configuration.accessories.some(a => a.id === id)) throw new RangeError(`액세서리 ${id}가 없습니다.`);
      // Validate caller timing even when accessibility/disconnection makes the change immediate.
      const timing = validateMotionOptions(options);
      const result = this.timeline.to(target, { ...timing, duration: this.paused || this.reduced || !this.isConnected || (!!this.canvas && !this.ready) ? 0 : timing.duration });
      this.draw(); this.wake();
      void result.then(detail => this.emit('sidekick-motion-end', detail));
      return result;
    },
    cancel: (): void => { this.timeline.cancel(); },
  };
  get design(): AvatarDesign { return parseDesign(this.configuration); }
  set design(value: AvatarDesign) { this.applyDesign(value); }
  async setDesign(value: AvatarDesign | string): Promise<void> { this.applyDesign(value); }
  /** Apply selections/colors or expression weights without disturbing unrelated animation. */
  async updateDesign(patch: DesignPatch): Promise<void> { this.applyDesign(patchDesign(this.configuration, patch)); }
  /** Replace only the selected equipment slot, preserving unrelated animation clocks. */
  async equipAccessory(accessory: AccessoryDesign): Promise<void> { this.applyDesign(equipAccessory(this.configuration, accessory)); }
  /** Remove one instance by ID; the opposite earring and its motion remain independent. */
  async removeAccessory(id: string): Promise<void> { this.applyDesign(removeAccessory(this.configuration, id)); }
  private applyDesign(value: unknown): void {
    const next = parseDesign(value);
    const shapeChanged = next.body.shape !== this.configuration.body.shape;
    if (shapeChanged) this.shapeTimeline.set(next.body.shape);
    const changedEyes = (['left', 'right'] as const).filter(side => next.eyes[side].weights.smile !== this.configuration.eyes[side].weights.smile || next.eyes[side].weights.blink !== this.configuration.eyes[side].weights.blink);
    if (changedEyes.length) this.timeline.setEyes({ left: next.eyes.left, right: next.eyes.right }, changedEyes);
    const removedAccessories = this.configuration.accessories.filter(a => !next.accessories.some(nextPart => nextPart.id === a.id)).map(a => a.id);
    if (removedAccessories.length) this.timeline.removeAccessories(removedAccessories);
    this.configuration = next;
    this.draw(); this.emit('sidekick-design-change', { design: this.design });
  }
  /** Persist a shape target now, while moving directly from the currently visible outline. */
  setShape(shape: MaterialShapeName, options: ShapeMotionOptions = {}): Promise<ShapeMotionResult> {
    const timing = validateShapeMotionOptions(options);
    const next = parseDesign({ ...this.configuration, body: { ...this.configuration.body, shape } });
    const immediate = this.paused || this.reduced || !this.isConnected || (!!this.canvas && !this.ready);
    const result = this.shapeTimeline.to(shape, { ...timing, duration: immediate ? 0 : timing.duration });
    this.configuration = next;
    this.draw(); this.wake(); this.emit('sidekick-design-change', { design: this.design });
    void result.then(detail => this.emit('sidekick-shape-end', detail));
    return result;
  }
  /** Persist partial shape-key weights and transition from the currently displayed pose. */
  setEyeWeights(side: 'left' | 'right' | 'both', weights: Partial<EyeShapeWeights>, options: MotionOptions = {}): Promise<MotionResult> {
    if (side !== 'left' && side !== 'right' && side !== 'both') throw new TypeError('눈 방향은 left, right, both 중 하나여야 합니다.');
    const next = this.design;
    const eyes: NonNullable<MotionTarget['eyes']> = {};
    for (const eye of ['left', 'right'] as const) if (side === 'both' || side === eye) {
      next.eyes[eye] = patchEyeState(next.eyes[eye], { weights });
      eyes[eye] = { weights: next.eyes[eye].weights };
    }
    const result = this.motion.to({ eyes }, options);
    // The whole command is validated before changing the persisted design.
    this.configuration = next;
    this.emit('sidekick-design-change', { design: this.design });
    return result;
  }
  /** Named expressions are convenient exact weight presets, never separate state. */
  setExpression(side: 'left' | 'right' | 'both', expression: EyeExpression, options: MotionOptions = {}): Promise<MotionResult> {
    const timing = validateMotionOptions(options);
    return this.setEyeWeights(side, eyeExpressionWeights(expression), { ...timing, duration: options.duration === undefined ? expressionDuration(expression) : timing.duration });
  }
  get renderStyle(): RenderStyle { return 'flat'; }
  set renderStyle(value: RenderStyle) {
    // Legacy JavaScript integrations may still send "3d"; normalize that input.
    if (value !== 'flat' && (value as string) !== '3d') throw new TypeError('renderStyle은 flat입니다.');
    this.setAttribute('render-style', 'flat');
  }
  get activity(): Activity { return this.currentActivity; }
  setActivity(value: Activity): void {
    if (!ACTIVITIES.includes(value)) throw new TypeError('지원하지 않는 activity입니다.');
    this.setAttribute('activity', value);
  }
  get paused(): boolean { return this.hasAttribute('paused'); }
  set paused(value: boolean) { this.toggleAttribute('paused', value); }
  get interaction(): 'none' | 'box' { return this.getAttribute('interaction') === 'box' ? 'box' : 'none'; }
  set interaction(value: 'none' | 'box') {
    if (value !== 'none' && value !== 'box') throw new TypeError('interaction은 none 또는 box입니다.');
    this.setAttribute('interaction', value);
  }
  get ready(): boolean { return this.readyState; }
  get pose(): Pose { return structuredClone(this.timeline.pose); }
  get diagnostics(): { ready: boolean; running: boolean; frames: number; drawCalls: number; buffers: number } {
    return { ready: this.ready, running: this.raf !== 0, frames: this.frames, drawCalls: this.renderer?.stats.drawCalls ?? 0, buffers: this.renderer?.stats.buffers ?? 0 };
  }
  /** Camera viewing angles in degrees. Reads return an independent snapshot. */
  get camera(): CameraAngles { return { ...this.cameraAngles }; }
  set camera(value: CameraAngles) { this.setCamera(value); }
  setCamera(angles: Partial<CameraAngles>): void {
    const next = patchCamera(this.cameraAngles, angles);
    if (next.yaw === this.cameraAngles.yaw && next.pitch === this.cameraAngles.pitch && next.roll === this.cameraAngles.roll) return;
    this.cameraAngles = next;
    this.draw(); this.emit('sidekick-camera-change', { camera: this.camera });
  }
  setCameraPreset(preset: CameraPreset): void { this.setCamera(cameraPreset(preset)); }
  resetCamera(): void { this.setCameraPreset('front'); }
  /** Legacy radians API; yaw/pitch update the camera while preserving its roll. */
  setView(yaw: number, pitch = 0): void {
    const nextYaw = finite(yaw, -Math.PI * 2, Math.PI * 2, 'yaw'), nextPitch = finite(pitch, -Math.PI / 2, Math.PI / 2, 'pitch');
    this.setCamera({ yaw: nextYaw * 180 / Math.PI, pitch: nextPitch * 180 / Math.PI });
  }
  lookAt(target: { space: 'view'; x: number; y: number }): void {
    if (target.space !== 'view') throw new TypeError('시선 좌표계는 view입니다.');
    this.gazeTarget = [finite(target.x, -1, 1, 'gaze.x'), finite(target.y, -1, 1, 'gaze.y')];
    if (this.paused || this.reduced) { this.timeline.pose.gaze = [...this.gazeTarget]; this.gazeVelocity = [0, 0]; }
    this.draw(); this.wake();
  }
  seek(seconds: number): void { this.elapsed = finite(seconds, 0, 86400, 'time'); this.draw(); }
  /** Stable readback for exports/tests without permanently preserving the WebGL buffer. */
  capturePixels(): { width: number; height: number; pixels: Uint8Array } {
    if (!this.renderer || !this.canvas || !this.ready) throw new Error('아바타가 렌더링 준비 상태가 아닙니다.');
    this.draw(); return { width: this.canvas.width, height: this.canvas.height, pixels: this.renderer.readPixels() };
  }
  async snapshot(): Promise<Blob> {
    if (!this.canvas || !this.ready) throw new Error('아바타가 렌더링 준비 상태가 아닙니다.');
    this.draw();
    return new Promise((resolve, reject) => this.canvas!.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG 내보내기 실패')), 'image/png'));
  }
  connectedCallback(): void {
    if (this.renderer) return;
    if (!this.shadowRoot) {
      const shadow = this.attachShadow({ mode: 'open' });
      shadow.innerHTML = `<style>
        :host{display:inline-block;position:relative;width:200px;height:200px;contain:layout style;pointer-events:none;vertical-align:middle}
        :host([interaction="box"]){pointer-events:auto;cursor:grab;touch-action:pan-y}
        :host(:focus-visible){outline:2px solid currentColor;outline-offset:3px;border-radius:12px}
        canvas{display:block;width:100%;height:100%;background:transparent}
        span{position:absolute;inset:0;display:grid;place-items:center;padding:16px;text-align:center;font:13px/1.5 system-ui;color:currentColor}
        [hidden]{display:none!important}
      </style><canvas part="canvas" aria-hidden="true"></canvas><span part="fallback" hidden></span>`;
      this.canvas = shadow.querySelector('canvas')!;
      this.fallback = shadow.querySelector('span')!;
    }
    this.updateInteraction();
    if (!this.hasAttribute('aria-label')) this.setAttribute('aria-label', 'Sidekick 아바타');
    this.media = matchMedia('(prefers-reduced-motion: reduce)'); this.reduced = this.media.matches;
    if (this.reduced || this.paused) this.shapeTimeline.finish();
    this.media.addEventListener('change', this.onMotionPreference);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.addEventListener('keydown', this.onKey);
    this.canvas!.addEventListener('pointerdown', this.onPointerDown);
    this.canvas!.addEventListener('pointermove', this.onPointerMove);
    this.canvas!.addEventListener('pointerup', this.onPointerUp);
    this.canvas!.addEventListener('pointercancel', this.onPointerCancel);
    this.canvas!.addEventListener('webglcontextlost', this.onContextLost);
    this.canvas!.addEventListener('webglcontextrestored', this.onContextRestored);
    this.sizeObserver = new ResizeObserver(this.resize); this.sizeObserver.observe(this);
    this.visibilityObserver = new IntersectionObserver(entries => {
      this.visible = entries[0]?.isIntersecting ?? false;
      if (this.visible) this.wake(); else this.stop();
    });
    this.visibilityObserver.observe(this);
    this.initializeRenderer();
  }
  disconnectedCallback(): void {
    this.stop(); this.timeline.cancel(); this.resetEyes(); this.resetShape(); this.readyState = false;
    this.sizeObserver?.disconnect(); this.visibilityObserver?.disconnect();
    this.media?.removeEventListener('change', this.onMotionPreference);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.removeEventListener('keydown', this.onKey);
    this.canvas?.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas?.removeEventListener('pointermove', this.onPointerMove);
    this.canvas?.removeEventListener('pointerup', this.onPointerUp);
    this.canvas?.removeEventListener('pointercancel', this.onPointerCancel);
    this.canvas?.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas?.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.renderer?.dispose(); this.renderer = undefined; this.drag = undefined;
  }
  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === 'render-style' && value === '3d') { this.setAttribute('render-style', 'flat'); return; }
    if (name === 'activity') {
      if (value === null) this.currentActivity = 'idle';
      else if (ACTIVITIES.includes(value as Activity)) this.currentActivity = value as Activity;
      else { this.emit('sidekick-error', { message: '지원하지 않는 activity 속성입니다.' }); return; }
    }
    if (name === 'interaction' && this.isConnected) this.updateInteraction();
    if (this.paused) { this.timeline.advance(60000); this.shapeTimeline.finish(); this.stop(); }
    this.draw(); this.wake();
  }
  private initializeRenderer(): void {
    try {
      this.renderer = new AvatarRenderer(this.canvas!); this.readyState = true;
      this.canvas!.hidden = false; this.fallback!.hidden = true;
      this.resize(); this.wake(); this.emit('sidekick-ready', {});
    } catch (error) {
      this.readyState = false; this.timeline.cancel(); this.resetEyes(); this.resetShape(); this.renderer?.dispose(); this.renderer = undefined;
      const message = error instanceof Error ? error.message : '렌더러를 초기화하지 못했습니다.';
      this.canvas!.hidden = true; this.fallback!.hidden = false; this.fallback!.textContent = message;
      this.emit('sidekick-error', { message });
    }
  }
  private updateInteraction(): void { this.setAttribute('role', this.interaction === 'box' ? 'button' : 'img'); this.tabIndex = this.interaction === 'box' ? 0 : -1; }
  private resize = (): void => {
    const rect = this.getBoundingClientRect(); this.renderer?.resize(rect.width, rect.height, devicePixelRatio); this.draw();
  };
  private emit(name: string, detail: unknown): void { this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true })); }
  private gazeMoving(): boolean { return this.gazeTarget.some((target, i) => Math.abs(target - this.timeline.pose.gaze[i]!) > 0.0001 || Math.abs(this.gazeVelocity[i]!) > 0.0001); }
  private resetShape(): void { this.shapeTimeline.set(this.configuration.body.shape); }
  private resetEyes(): void { this.timeline.setEyes({ left: this.configuration.eyes.left, right: this.configuration.eyes.right }); }
  private needsAnimation(): boolean { return this.timeline.active || this.shapeTimeline.active || this.gazeMoving() || (!this.reduced && this.currentActivity !== 'still'); }
  private wake(): void {
    if (this.raf || !this.ready || this.paused || !this.visible || !this.isConnected || document.hidden || !this.needsAnimation()) return;
    this.lastTick = 0; this.raf = requestAnimationFrame(this.tick);
  }
  private stop(): void { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; this.lastTick = 0; }
  private tick = (now: number): void => {
    this.raf = 0;
    if (!this.ready || this.paused || !this.visible || document.hidden || !this.isConnected) return;
    const shapeDelta = this.lastTick ? clamp(now - this.lastTick, 0, 60000) : 0;
    const delta = this.lastTick ? Math.min((now - this.lastTick) / 1000, 0.05) : 0;
    this.lastTick = now; this.elapsed += delta;
    this.timeline.advance(shapeDelta);
    // Timed transitions follow active elapsed time; springs retain their bounded step.
    this.shapeTimeline.advance(shapeDelta);
    for (const i of [0, 1] as const) {
      const [position, velocity] = spring(this.timeline.pose.gaze[i], this.gazeVelocity[i], this.gazeTarget[i], delta, 16);
      this.timeline.pose.gaze[i] = position; this.gazeVelocity[i] = velocity;
    }
    this.draw(delta);
    if (this.needsAnimation()) this.raf = requestAnimationFrame(this.tick);
  };
  private draw(delta = 0): void {
    if (!this.ready || !this.renderer) return;
    const shape = this.shapeTimeline.snapshot;
    this.renderer.render(this.configuration, { pose: this.timeline.pose, eyeMotion: this.timeline.eyeMotion, contour: shape.contour, profile: shape.profile, activity: this.currentActivity, time: this.elapsed, delta, reduced: this.reduced, style: this.renderStyle, camera: this.cameraAngles }); this.frames++;
  }
  private onMotionPreference = (): void => {
    this.reduced = this.media?.matches ?? false;
    if (this.reduced) { this.timeline.advance(60000); this.shapeTimeline.finish(); this.timeline.pose.gaze = [...this.gazeTarget]; this.gazeVelocity = [0, 0]; this.stop(); }
    this.draw(); this.wake();
  };
  private onVisibility = (): void => { if (document.hidden) this.stop(); else this.wake(); };
  private onKey = (event: KeyboardEvent): void => {
    if (this.interaction === 'box' && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); this.emit('sidekick-activate', {}); }
  };
  private onPointerDown = (event: PointerEvent): void => {
    if (this.interaction !== 'box' || event.button !== 0) return;
    this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, camera: this.camera, moved: false };
    this.canvas!.setPointerCapture(event.pointerId);
  };
  private onPointerMove = (event: PointerEvent): void => {
    if (!this.drag || this.drag.id !== event.pointerId) return;
    const dx = event.clientX - this.drag.x, dy = event.clientY - this.drag.y;
    if (Math.hypot(dx, dy) > 4) this.drag.moved = true;
    this.setCamera({ yaw: clamp(this.drag.camera.yaw + dx * 0.01 * 180 / Math.PI, -360, 360), pitch: clamp(this.drag.camera.pitch + dy * 0.007 * 180 / Math.PI, -90, 90) });
  };
  private onPointerUp = (event: PointerEvent): void => {
    if (this.drag?.id !== event.pointerId) return;
    if (!this.drag.moved) this.emit('sidekick-activate', {});
    if (this.canvas?.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    this.drag = undefined;
  };
  private onPointerCancel = (): void => { this.drag = undefined; };
  private onContextLost = (event: Event): void => {
    event.preventDefault(); this.stop(); this.readyState = false; this.timeline.cancel(); this.resetEyes(); this.resetShape();
    this.renderer?.dispose(); this.renderer = undefined;
    this.fallback!.textContent = '그래픽 연결을 복구하고 있습니다.'; this.fallback!.hidden = false;
    this.emit('sidekick-error', { message: 'WebGL context lost', recoverable: true });
  };
  private onContextRestored = (): void => { this.renderer?.dispose(); this.renderer = undefined; this.initializeRenderer(); };
}
export function defineSidekick(tagName = 'sidekick-avatar'): void {
  if (typeof customElements === 'undefined') return;
  if (!customElements.get(tagName)) customElements.define(tagName, tagName === 'sidekick-avatar' ? SidekickAvatar : class extends SidekickAvatar {});
}
declare global { interface HTMLElementTagNameMap { 'sidekick-avatar': SidekickAvatar } }
