import { parseEmotion, validateEmotionOptions } from '../core/emotion.js';
import { EmotionController } from './emotion.js';
import type { Emotion, EmotionOptions, EmotionState, EmotionResult, ReactionOptions } from '../core/emotion.js';
import { BehaviorController, validateBehavior } from './behavior.js';
import type { BotBehavior, BehaviorState, BehaviorResult, PerformOptions, BehaviorSide } from './behavior.js';
import { observeElementAnchor } from './element-anchor.js';
import type { ElementAnchorState } from './element-anchor.js';
import { assertAnchorHierarchy, resolveElementTarget } from './element-target.js';
import type { MoveToElementOptions } from './element-target.js';
import { AvatarPresence } from './presence.js';
import type { EnterOptions, ExitOptions, PresenceResult, PresenceState } from './presence.js';
import { PlaybackController } from './playback.js';
import type { PlayOptions, AssetTransitionTarget } from './playback.js';
import type { TravelPresentation } from '../core/travel.js';
import { AvatarMovement, validatePosition, validateMoveOptions } from './movement.js';
import type { AvatarPlacement, AvatarPosition, MovementBounds, MoveResult, MoveOptions, MovementState } from './movement.js';
import { ACTIVITIES, createAccessory, createDesign, equipAccessory, finite, parseDesign, patchDesign, removeAccessory } from '../core/design.js';
import type { AccessoryDesign, Activity, AvatarDesign, DesignPatch, RenderStyle, Vec2 } from '../core/design.js';
import { parseTrackingMode } from '../core/tracking.js';
import type { TrackingMode } from '../core/tracking.js';
import { clamp } from '../core/math.js';
import { MotionTimeline, validateMotionOptions } from '../core/motion.js';
import { validateShapeMotionOptions } from '../core/shape-motion.js';
import type { ShapeMotionOptions, ShapeMotionResult } from '../core/shape-motion.js';
import type { MaterialShapeName } from '../core/shapes.js';
import type { EyeExpression, EyeShapeWeights } from '../core/expressions.js';
import { expressionDuration, eyeExpressionWeights, patchEyeState } from '../core/expressions.js';
import { bodyOrientationPreset, createBodyOrientation, patchBodyOrientation } from '../core/body-orientation.js';
import { createZoom, pinchZoom, wheelZoom } from '../core/zoom.js';
import type { BodyOrientation, BodyOrientationPreset } from '../core/body-orientation.js';
import type { MotionOptions, MotionResult, MotionTarget, Pose } from '../core/motion.js';
import { validateSnapshotOptions } from '../core/pixels.js';
import type { SnapshotOptions } from '../core/pixels.js';
import { LocalRenderBridge, WorkerRenderBridge, supportsRenderWorker } from '../runtime/render-bridge.js';
import type { RenderBridge } from '../runtime/render-bridge.js';
import type { DesignTransition, RuntimeCommand, RuntimeEvent, RuntimeSnapshot, RuntimeState } from '../runtime/protocol.js';
import type { PixelBuffer } from '../core/pixels.js';
import { ACCESSORY_ATTRIBUTE_SLOTS, SIDEKICK_ATTRIBUTES, REMOVED_ORIENTATION_ATTRIBUTES, SidekickAttributeError, resolveSidekickAttributes } from './attributes.js';
import type { SidekickEventMap } from './attributes.js';
const HTMLElementBase = (typeof HTMLElement === 'undefined' ? class {} : HTMLElement) as typeof HTMLElement;

export class SidekickAvatar extends HTMLElementBase {
  static observedAttributes = [...SIDEKICK_ATTRIBUTES, ...Object.keys(REMOVED_ORIENTATION_ATTRIBUTES)];
  addEventListener<K extends keyof SidekickEventMap>(type: K, listener: (this: SidekickAvatar, event: SidekickEventMap[K]) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: HTMLElement, event: HTMLElementEventMap[K]) => void, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void { if (listener) super.addEventListener(type, listener, options); }
  removeEventListener<K extends keyof SidekickEventMap>(type: K, listener: (this: SidekickAvatar, event: SidekickEventMap[K]) => void, options?: boolean | EventListenerOptions): void;
  removeEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: HTMLElement, event: HTMLElementEventMap[K]) => void, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void { if (listener) super.removeEventListener(type, listener, options); }
  private emotionEyeOverrides = { left: false, right: false };
  private setEyeControl(sides: readonly ('left' | 'right')[], override: boolean, options: MotionOptions = {}): void {
    if (!sides.length) return;
    for (const side of sides) this.emotionEyeOverrides[side] = override;
    this.send({ kind: 'eye-control', overrides: { ...this.emotionEyeOverrides }, sides, options: { ...options, duration: this.immediateMotion() ? 0 : options.duration ?? 400 } });
  }
  private emotionController = new EmotionController({
    connected: () => this.isConnected,
    change: state => { this.send({ kind: 'state', state: { emotion: { emotion: state.emotion, intensity: state.intensity } } }); this.emit('sidekick-emotion-change', state); },
    end: result => this.emit('sidekick-reaction-end', result),
    schedule: (callback, milliseconds) => setTimeout(callback, milliseconds),
    clear: timer => clearTimeout(timer as ReturnType<typeof setTimeout>),
  });
  /** Persistent feeling. Transient reactions are available in emotionState. */
  get emotion(): Emotion { return this.emotionController.state.baseline.emotion; }
  set emotion(value: Emotion) { this.setEmotion(value, { intensity: this.emotionIntensity }); }
  get emotionIntensity(): number { return this.emotionController.state.baseline.intensity; }
  set emotionIntensity(value: number) { this.setEmotion(this.emotion, { intensity: value }); }
  get emotionState(): EmotionState { return this.emotionController.state; }
  setEmotion(value: Emotion, options: EmotionOptions = {}): void { parseEmotion(value); validateEmotionOptions(options); this.setEyeControl(['left', 'right'], false); this.emotionController.set(value, options); }
  reactTo(value: Emotion, options: ReactionOptions = {}): Promise<EmotionResult> { parseEmotion(value); validateEmotionOptions(options, true); if (this.isConnected) this.setEyeControl(['left', 'right'], false); return this.emotionController.react(value, options); }
  cancelReaction(): void { this.emotionController.cancel(); }
  private behaviorCommand = false;
  private behaviorAttention = false;
  private pendingBehavior: BotBehavior | null | undefined;
  private behaviorController = new BehaviorController({
    document: this.ownerDocument,
    connected: () => this.isConnected,
    capture: () => {
      const activity = this.currentActivity, tracking = this.trackingModeState;
      const orientation = this.bodyOrientation, gaze: Vec2 = [...this.manualGaze];
      return () => {
        this.behaviorAttention = false; this.currentActivity = activity; this.trackingModeState = tracking;
        this.orientationState = orientation; this.manualGaze = gaze; this.gazeTarget = [...gaze];
        this.send({ kind: 'state', state: { bodyOrientation: orientation } });
        void this.behaviorOperation(() => this.motion.to({ eyes: { left: this.configuration.eyes.left, right: this.configuration.eyes.right } }, { duration: 180 }));
        this.updateMouseTracking(); this.syncState();
      };
    },
    prepare: (activity, expression, current) => {
      this.playback.cancelPlayback(); if (!current()) return; this.playback.cancelTransition(); if (!current()) return;
      this.behaviorAttention = true; this.currentActivity = activity; this.trackingModeState = 'off';
      this.lastTrackedPointer = undefined; this.pendingPointer = undefined; this.trackedGaze = undefined; this.gazeTarget = [...this.manualGaze];
      this.updateMouseTracking(); this.syncState();
      const weights = eyeExpressionWeights(expression);
      void this.behaviorOperation(() => this.motion.to({ eyes: { left: { weights }, right: { weights } } }, { duration: 180 }));
    },
    move: (target, side, gap) => this.behaviorOperation(() => this.moveToElement(target, this.behaviorPlacement(side, gap))),
    watch: (target, lost) => this.watchBehaviorTarget(target, lost),
    stop: () => this.behaviorOperation(() => { this.releaseAnchor(false); this.movement.cancel(); }),
    change: state => this.emit('sidekick-behavior-change', state),
    end: result => this.emit('sidekick-behavior-end', result),
  });
  /** A deterministic semantic intent; null stops it. DOM targets are retained by identity. */
  get behavior(): BotBehavior | null { return this.pendingBehavior === undefined ? this.behaviorController.declaration : this.pendingBehavior === null ? null : validateBehavior(this.pendingBehavior, this.ownerDocument); }
  set behavior(value: BotBehavior | null) {
    const next = value === null ? null : validateBehavior(value, this.ownerDocument);
    if (!this.isConnected) { this.pendingBehavior = next; return; }
    this.pendingBehavior = undefined;
    if (next === null) this.stopBehavior(); else void this.perform(next);
  }
  get behaviorState(): BehaviorState { return this.behaviorController.state; }
  perform(value: BotBehavior, options: PerformOptions = {}): Promise<BehaviorResult> { return this.behaviorController.perform(value, options); }
  stopBehavior(): void { this.pendingBehavior = undefined; this.behaviorController.cancel(); }
  private interruptBehavior(): void { if (!this.behaviorCommand) this.behaviorController.cancel('manual-command'); }
  private behaviorOperation<T>(action: () => T): T { const previous = this.behaviorCommand; this.behaviorCommand = true; try { return action(); } finally { this.behaviorCommand = previous; } }
  private behaviorPlacement(side: BehaviorSide, gap: number): MoveToElementOptions {
    const rect = this.getBoundingClientRect();
    return side === 'left' ? { anchor: true, alignX: 'left', alignY: 'center', x: -rect.width - gap }
      : side === 'right' ? { anchor: true, alignX: 'right', alignY: 'center', x: rect.width + gap }
      : side === 'above' ? { anchor: true, alignX: 'center', alignY: 'top', y: -rect.height - gap }
      : { anchor: true, alignX: 'center', alignY: 'bottom', y: rect.height + gap };
  }
  private watchBehaviorTarget(target: Element, lost: () => void): () => void {
    let asleep = false, ended = false;
    const cleanup = observeElementAnchor(this.ownerDocument, () => {
      if (ended) return;
      if (!target.isConnected || target.ownerDocument !== this.ownerDocument) { ended = true; this.behaviorOperation(() => this.cancelMove()); lost(); return; }
      const own = this.getBoundingClientRect(), other = target.getBoundingClientRect(), view = this.ownerDocument.defaultView!;
      asleep = !this.getClientRects().length || !target.getClientRects().length || own.right <= 0 || own.bottom <= 0 || own.left >= view.innerWidth || own.top >= view.innerHeight;
      if (asleep) return;
      const dx = other.left + other.width / 2 - own.left - own.width / 2;
      const dy = other.top + other.height / 2 - own.top - own.height / 2;
      const x = clamp(dx / Math.max(own.width, 120), -1, 1), y = clamp(-dy / Math.max(own.height, 120), -1, 1);
      if (Math.abs(x - this.manualGaze[0]) < .002 && Math.abs(y - this.manualGaze[1]) < .002) { asleep = this.movement.state.phase === 'idle'; return; }
      return () => {
        if (ended) return;
        this.manualGaze = [x, y]; this.gazeTarget = [x, y];
        this.orientationState = { yaw: x * 30, pitch: -y * 12, roll: 0 };
        this.send({ kind: 'state', state: { bodyOrientation: this.bodyOrientation, gaze: [x, y] } });
      };
    }, () => asleep);
    return () => { ended = true; cleanup(); };
  }
  private playbackCommand = false;
  private playback = new PlaybackController({
    setActivity: activity => this.ownPlaybackCommand(() => this.setActivity(activity)),
    setShape: (shape, options) => this.ownPlaybackCommand(() => this.setShape(shape, options)),
    setExpression: (side, expression, options) => this.ownPlaybackCommand(() => this.setExpression(side, expression, options)),
    updateDesign: async patch => { await this.ownPlaybackCommand(() => this.updateDesign(patch)); if (this.bridge && this.connected) { const pending = this.request<MotionResult>('barrier'); this.send({ kind: 'flush', request: pending.id }); await pending.promise; } },
    getDesign: () => this.design, getCanvas: () => this.canvas,
    immediateMotion: () => this.immediateMotion(), isConnected: () => this.connected,
    cancelAssetMotion: channels => this.send({ kind: 'cancel-assets', ...channels }),
    onPlaybackEnd: result => this.emit('sidekick-play-end', result),
    onTransitionEnd: result => this.emit('sidekick-transition-end', result),
  });
  private ownPlaybackCommand<T>(operation: () => T): T {
    const previous = this.playbackCommand; this.playbackCommand = true;
    try { return operation(); } finally { this.playbackCommand = previous; }
  }
  play(activity: Activity, options: PlayOptions = {}): Promise<MotionResult> { this.interruptBehavior(); return this.playback.play(activity, options); }
  stop(): void { this.interruptBehavior(); this.playback.stop(); }
  transitionTo(target: AssetTransitionTarget, options: MotionOptions = {}): Promise<MotionResult> { this.interruptBehavior(); return this.playback.transitionTo(target, options); }
  cancelTransition(): void { this.playback.cancelTransition(); }
  private placementState: AvatarPlacement = 'inline';
  private boundsState: MovementBounds = 'viewport';
  private movementBox?: { width: number; height: number };
  private measureMovementBox(): void { this.movementBox = { width: this.offsetWidth, height: this.offsetHeight }; }
  private travelPresentation?: TravelPresentation;
  private movement = new AvatarMovement({
    now: () => performance.now(), immediate: () => this.paused || this.reduced || !this.connected,
    constrain: point => this.constrainPosition(point),
    render: point => { this.style.setProperty('--sidekick-x', `${point.x}px`); this.style.setProperty('--sidekick-y', `${point.y}px`); if (this.lastTrackedPointer && this.trackingDocument && !this.gesturing) { this.pendingPointer = { ...this.lastTrackedPointer }; this.queueInput(); } },
    complete: async result => {
      if (this.bridge && this.connected) {
        const barrier = this.request<MotionResult>('barrier');
        this.send({ kind: 'flush', request: barrier.id });
        try { await barrier.promise; } catch { /* Teardown still settles the caller's movement. */ }
      }
      this.emit('sidekick-move-end', result);
    },
    progress: state => this.emit('sidekick-move-progress', state),
    presentation: travel => { this.travelPresentation = travel; this.send({ kind: 'state', state: { travel } }); },
    requestFrame: callback => requestAnimationFrame(callback), cancelFrame: id => cancelAnimationFrame(id),
  });
  private anchorRevision = 0;
  private anchorState: ElementAnchorState | null = null;
  private anchorCleanup?: () => void;
  private anchorSleeping = false;
  /** Logical binding only: no reparenting, CSS positioning, or canvas changes. */
  get elementAnchor(): ElementAnchorState | null { return this.anchorState ? { ...this.anchorState } : null; }
  detachAnchor(): void { this.releaseAnchor(true); }
  private releaseAnchor(brake: boolean): void { this.anchorRevision++; this.anchorCleanup?.(); this.anchorCleanup = undefined; this.anchorState = null; this.anchorSleeping = false; this.movement.suspend(false); if (brake) this.movement.stopFollowing(); }
  private attachAnchor(state: ElementAnchorState): void {
    this.releaseAnchor(false); this.anchorState = state;
    this.anchorCleanup = observeElementAnchor(this.ownerDocument, () => {
      if (this.anchorState !== state) return;
      if (!this.isConnected || !state.target.isConnected || state.target.ownerDocument !== this.ownerDocument) { this.detachAnchor(); return; }
      try { assertAnchorHierarchy(this, state.target); } catch { this.detachAnchor(); return; }
      // display:none has no layout origin: its zero rectangle must not be added
      // to the current translation repeatedly. Keep the binding for restoration.
      if (!this.getClientRects().length || !state.target.getClientRects().length) {
        return () => { if (this.anchorState !== state) return; this.anchorSleeping = true; this.movement.suspend(true); };
      }
      const view = this.ownerDocument.defaultView!;
      const inView = (rect: { left: number; top: number; width: number; height: number }): boolean => rect.width > 0 && rect.height > 0 && rect.left + rect.width > 0 && rect.top + rect.height > 0 && rect.left < view.innerWidth && rect.top < view.innerHeight;
      const rect = this.getBoundingClientRect();
      let point: AvatarPosition;
      try { point = resolveElementTarget(this, this.position, state.target, { anchor: true, x: state.x, y: state.y, alignX: state.alignX, alignY: state.alignY }).position; }
      catch { this.detachAnchor(); return; }
      point = this.constrainPosition(point, true);
      const goal = { left: rect.left + point.x - this.position.x, top: rect.top + point.y - this.position.y, width: rect.width, height: rect.height };
      const sleeping = !inView(rect) && !inView(goal);
      return () => {
        if (this.anchorState !== state) return;
        this.anchorSleeping = sleeping;
        this.movement.suspend(sleeping || this.ownerDocument.hidden);
        this.movement.followTarget(this.constrainPosition(point, true));
      };
    }, () => this.anchorSleeping);
  }
  private presenceHidden = false;
  private presence = new AvatarPresence({
    assertViewport: () => { if (this.placement !== 'viewport' || !this.connected) throw new Error('enter/exit require a connected avatar with placement="viewport"'); this.releaseAnchor(false); },
    position: () => this.position,
    geometry: () => { const rect = this.getBoundingClientRect(), view = this.ownerDocument.defaultView!; return { width: rect.width, height: rect.height, viewportWidth: view.innerWidth, viewportHeight: view.innerHeight, offsetX: rect.left - this.position.x, offsetY: rect.top - this.position.y }; },
    constrain: point => this.constrainPosition(point, true),
    move: (point, options) => this.movement.to(point, options),
    stage: point => this.movement.relocate(point),
    visibility: hidden => { this.presenceHidden = hidden; this.style.setProperty('--sidekick-visibility', hidden ? 'hidden' : 'visible'); this.updateMouseTracking(); this.syncState(); },
    complete: (kind, result) => this.emit(kind === 'enter' ? 'sidekick-enter-end' : 'sidekick-exit-end', result),
  });
  get presenceState(): PresenceState { return this.presence.current; }
  enter(position: AvatarPosition, options: EnterOptions = {}): Promise<PresenceResult> { return this.presence.enter(position, options); }
  exit(options: ExitOptions = {}): Promise<PresenceResult> { return this.presence.exit(options); }
  get placement(): AvatarPlacement { return this.placementState; }
  set placement(value: AvatarPlacement) { if (value !== 'inline' && value !== 'viewport') throw new TypeError('placement must be inline or viewport'); this.reflectAttribute('placement', value); }
  get movementBounds(): MovementBounds { return this.boundsState; }
  set movementBounds(value: MovementBounds) { if (value !== 'viewport' && value !== 'none') throw new TypeError('movementBounds must be viewport or none'); this.reflectAttribute('movement-bounds', value); }
  /** Inline: offset from normal layout. Viewport: layout viewport top-left, CSS pixels. */
  get position(): AvatarPosition { return this.movement.position; }
  get movementState(): MovementState { return this.movement.state; }
  moveTo(position: AvatarPosition, options: MoveOptions = {}): Promise<MoveResult> { const target = this.constrainPosition(validatePosition(position), true); validateMoveOptions(options); this.interruptBehavior(); this.releaseAnchor(false); const revision = this.presence.reveal(); if (!this.presence.owns(revision)) return Promise.resolve({ finished: false, position: this.position }); return this.movement.to(target, options).then(result => { if (result.finished) this.presence.recovered(revision); return result; }); }
  /** Sample the target's viewport border-box and align matching anchors, then move with inertia. */
  moveToElement(target: Element, options: MoveToElementOptions = {}): Promise<MoveResult> {
    const resolved = resolveElementTarget(this, this.position, target, options);
    const state: ElementAnchorState | null = options.anchor ? { target, x: options.x ?? 0, y: options.y ?? 0, alignX: options.alignX ?? 'left', alignY: options.alignY ?? 'top' } : null;
    const expectedRevision = this.anchorRevision + 1;
    const result = this.moveTo(resolved.position, resolved.options);
    if (state && this.anchorRevision === expectedRevision) this.attachAnchor(state);
    return result;
  }
  moveBy(delta: AvatarPosition, options: MoveOptions = {}): Promise<MoveResult> { validatePosition(delta); validateMoveOptions(options); this.interruptBehavior(); this.releaseAnchor(false); const revision = this.presence.reveal(); if (!this.presence.owns(revision)) return Promise.resolve({ finished: false, position: this.position }); return this.movement.by(delta, options, point => this.constrainPosition(point, true)).then(result => { if (result.finished) this.presence.recovered(revision); return result; }); }
  cancelMove(): void { this.interruptBehavior(); this.releaseAnchor(false); const revision = this.presence.interrupt(); if (this.presence.owns(revision)) this.movement.cancel(); }
  private constrainPosition(point: AvatarPosition, presenceTarget = false): AvatarPosition {
    if (!presenceTarget && this.presence?.bypassBounds) return { ...point };
    if (this.placementState !== 'viewport' || this.boundsState === 'none' || !this.connected) return { ...point };
    const view = this.ownerDocument.defaultView;
    if (!view) return { ...point };
    if (!this.movementBox) this.measureMovementBox();
    return { x: clamp(point.x, 0, Math.max(0, view.innerWidth - this.movementBox!.width)), y: clamp(point.y, 0, Math.max(0, view.innerHeight - this.movementBox!.height)) };
  }
  private updatePlacement(): void {
    this.style.setProperty('--sidekick-position', this.placementState === 'viewport' ? 'fixed' : 'relative');
    this.style.setProperty('--sidekick-inset', this.placementState === 'viewport' ? '0px' : 'auto');
    this.measureMovementBox(); if (this.presence?.bypassBounds) this.presence.resize(); else this.movement.resize();
  }
  private onViewportResize = (): void => { this.measureMovementBox(); if (this.presence?.bypassBounds) this.presence.resize(); else this.movement.resize(); };
  private configuration = createDesign();
  // This zero-duration reducer validates commands synchronously. It never runs animation.
  private validator = new MotionTimeline({ left: this.configuration.eyes.left, right: this.configuration.eyes.right });
  private currentPose = structuredClone(this.validator.pose);
  private bridge?: RenderBridge;
  private generation = 0;
  private acknowledgedRevision = 0;
  private poseRevision = 0;
  private timeRevision = 0;
  private snapshotState?: RuntimeSnapshot;
  private nextRequest = 0;
  private commandBatch?: RuntimeCommand[];
  private requests = new Map<number, { kind: 'motion' | 'shape' | 'capture' | 'snapshot' | 'barrier'; resolve: (value: unknown) => void; reject: (reason: Error) => void }>();
  private inputFrame = 0;
  private pendingResize = false;
  private lastTrackedPointer?: { x: number; y: number };
  private pendingPointer?: { x: number; y: number };
  private pendingDrag?: { x: number; y: number };
  private pendingZoom?: number;
  private pointers = new Map<number, { x: number; y: number; type: string }>();
  private pinch?: { distance: number; zoom: number };
  private pendingPinchDistance?: number;
  private wheelTimer?: ReturnType<typeof setTimeout>;
  private wheelGesture = false;
  private connected = false;
  private transferred = false;
  private captureCanvas?: HTMLCanvasElement;
  private canvas?: HTMLCanvasElement;
  private fallback?: HTMLSpanElement;
  private sizeObserver?: ResizeObserver;
  private visibilityObserver?: IntersectionObserver;
  private media?: MediaQueryList;
  private visible = true;
  private reduced = false;
  private elapsed = 0;
  private readyState = false;
  private currentActivity: Activity = 'idle';
  private orientationState = createBodyOrientation();
  private zoomState = createZoom();
  private gazeTarget: Vec2 = [0, 0];
  private manualGaze: Vec2 = [0, 0];
  private pausedState = false;
  private interactionState: 'none' | 'box' = 'none';
  private trackingModeState: TrackingMode = 'eyes-and-body';
  private trackedGaze?: Vec2;
  private trackingDocument?: Document;
  private acceptedAttributes = new Map<string, string>();
  private pendingAttributes = new Map<string, string | null>();
  private attributesQueued = false;
  private propertiesUpgraded = false;
  private drag?: { id: number; x: number; y: number; bodyOrientation: BodyOrientation; moved: boolean };
  readonly motion = {
    to: (target: MotionTarget, options: MotionOptions = {}): Promise<MotionResult> => {
      const timing = validateMotionOptions(options);
      // Probe without mutating even the validation reducer until ownership checks pass.
      void new MotionTimeline({ left: this.configuration.eyes.left, right: this.configuration.eyes.right }).to(target, { ...timing, duration: 0 });
      for (const id of Object.keys(target.accessories ?? {})) if (!this.configuration.accessories.some(a => a.id === id)) throw new RangeError(`액세서리 ${id}가 없습니다.`);
      this.interruptBehavior();
      this.validator.pose = structuredClone(this.currentPose);
      void this.validator.to(target, { ...timing, duration: 0 });
      const duration = this.immediateMotion() ? 0 : timing.duration;
      if (!duration) this.currentPose = structuredClone(this.validator.pose);
      if (!this.behaviorCommand && target.eyes) this.setEyeControl((['left', 'right'] as const).filter(side => target.eyes?.[side] !== undefined || target.eyes?.openness !== undefined), true, { ...timing, duration });
      const pending = this.request<MotionResult>('motion');
      this.send({ kind: 'motion', target: structuredClone(target), options: { ...timing, duration }, request: pending.id });
      this.poseRevision = this.bridge?.revision ?? 0;
      if (!this.bridge) this.resolveRequest(pending.id, { finished: true });
      return pending.promise;
    },
    cancel: (): void => { this.interruptBehavior(); this.send({ kind: 'cancel' }); },
  };
  get design(): AvatarDesign { return parseDesign(this.configuration); }
  set design(value: AvatarDesign) { const next = parseDesign(value); this.interruptBehavior(); if (!this.playbackCommand) this.playback.cancelTransition(); this.applyDesign(next); }
  async setDesign(value: AvatarDesign | string): Promise<void> { const next = typeof value === 'string' ? parseDesign(JSON.parse(value)) : parseDesign(value); this.interruptBehavior(); if (!this.playbackCommand) this.playback.cancelTransition(); this.applyDesign(next); }
  /** Apply selections/colors or expression weights without disturbing unrelated animation. */
  async updateDesign(patch: DesignPatch): Promise<void> { const next = patchDesign(this.configuration, patch); if (patch.eyes) this.interruptBehavior(); if (!this.playbackCommand) this.playback.cancelTransition(); this.applyDesign(next, undefined, (['left', 'right'] as const).filter(side => patch.eyes?.[side] !== undefined)); }
  /** Replace only the selected equipment slot, preserving unrelated animation clocks. */
  async equipAccessory(accessory: AccessoryDesign): Promise<void> { const next = equipAccessory(this.configuration, accessory); if (!this.playbackCommand) this.playback.cancelTransition(); this.applyDesign(next); }
  /** Remove one instance by ID; the opposite earring and its motion remain independent. */
  async removeAccessory(id: string): Promise<void> { const next = removeAccessory(this.configuration, id); if (!this.playbackCommand) this.playback.cancelTransition(); this.applyDesign(next); }
  private applyDesign(value: unknown, transition?: DesignTransition, explicitEyes: readonly ('left' | 'right')[] = []): void {
    const next = parseDesign(value), previous = this.configuration;
    const shapeChanged = next.body.shape !== previous.body.shape;
    const changedEyes = (['left', 'right'] as const).filter(side => explicitEyes.includes(side) || transition?.eyeSides?.includes(side) || next.eyes[side].weights.smile !== previous.eyes[side].weights.smile || next.eyes[side].weights.blink !== previous.eyes[side].weights.blink);
    const immediate = this.immediateMotion();
    const requested = transition ?? { shape: validateShapeMotionOptions({}), eyes: validateMotionOptions({}), eyeSides: changedEyes };
    const timing = { ...requested, equipmentImmediate: this.playbackCommand, shape: { ...requested.shape, duration: immediate ? 0 : requested.shape.duration }, eyes: { ...requested.eyes, duration: immediate ? 0 : requested.eyes.duration } };
    if (!this.behaviorCommand) this.setEyeControl(changedEyes, true, timing.eyes);
    let shapeRequest: number | undefined, eyeRequest: number | undefined;
    if (shapeChanged && timing) shapeRequest = this.request<MotionResult>('shape').id;
    if (changedEyes.length) {
      this.validator.pose = structuredClone(this.currentPose); this.validator.setEyes({ left: next.eyes.left, right: next.eyes.right }, changedEyes);
      if (!timing || immediate || timing.eyes.duration === 0) {
        for (const side of changedEyes) this.currentPose.eyes[side] = { ...this.validator.pose.eyes[side] };
        if (changedEyes.length === 2 && !timing) this.currentPose.openness = 1;
      }
      if (timing) eyeRequest = this.request<MotionResult>('motion').id;
    }
    const removed = previous.accessories.filter(a => !next.accessories.some(part => part.id === a.id)).map(a => a.id);
    if (removed.length) { this.validator.removeAccessories(removed); for (const id of removed) delete this.currentPose.accessories[id]; }
    this.configuration = next;
    this.send({ kind: 'design', design: next, transition: timing, shapeRequest, eyeRequest });
    this.poseRevision = this.bridge?.revision ?? 0;
    if (!this.bridge) { if (shapeRequest !== undefined) this.resolveRequest(shapeRequest, { finished: true }); if (eyeRequest !== undefined) this.resolveRequest(eyeRequest, { finished: true }); }
    this.emit('sidekick-design-change', { design: this.design });
  }
  /** Persist a shape target now, while moving directly from the currently visible outline. */
  setShape(shape: MaterialShapeName, options: ShapeMotionOptions = {}): Promise<ShapeMotionResult> {
    const timing = validateShapeMotionOptions(options);
    const next = parseDesign({ ...this.configuration, body: { ...this.configuration.body, shape } });
    if (!this.playbackCommand) this.playback.cancelTransition();
    const pending = this.request<ShapeMotionResult>('shape');
    this.configuration = next;
    this.send({ kind: 'shape', shape, options: { ...timing, duration: this.immediateMotion() ? 0 : timing.duration }, request: pending.id });
    if (!this.bridge) this.resolveRequest(pending.id, { finished: true });
    this.emit('sidekick-design-change', { design: this.design });
    return pending.promise;
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
    validateMotionOptions(options);
    this.interruptBehavior();
    if (!this.playbackCommand) this.playback.cancelTransition();
    const result = this.motion.to({ eyes }, options);
    // The whole command is validated before changing the persisted design.
    this.configuration = next;
    this.send({ kind: 'persist-design', design: next });
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
    this.reflectAttribute('render-style', 'flat');
  }
  get activity(): Activity { return this.currentActivity; }
  setActivity(value: Activity): void {
    if (!ACTIVITIES.includes(value)) throw new TypeError('지원하지 않는 activity입니다.');
    this.interruptBehavior();
    if (!this.playbackCommand) this.playback.cancelPlayback();
    this.reflectAttribute('activity', value);
  }
  get paused(): boolean { return this.pausedState; }
  set paused(value: boolean) {
    if (typeof value !== 'boolean') throw new TypeError('paused must be a boolean');
    this.reflectAttribute('paused', value ? '' : null);
  }
  /** Legacy enabled flag. An explicit tracking-mode always takes precedence. */
  get mouseTracking(): boolean { return this.trackingModeState !== 'off'; }
  set mouseTracking(value: boolean) {
    if (typeof value !== 'boolean') throw new TypeError('mouseTracking must be a boolean');
    this.reflectAttribute('mouse-tracking', value ? '' : 'false');
  }
  get trackingMode(): TrackingMode { return this.trackingModeState; }
  set trackingMode(value: TrackingMode) { const next = parseTrackingMode(value); this.interruptBehavior(); this.reflectAttribute('tracking-mode', next); }
  /** Clear transient cursor reaction immediately, for explicit scene resets/imports. */
  resetTracking(): void {
    this.lastTrackedPointer = undefined; this.pendingPointer = undefined; this.trackedGaze = undefined;
    this.gazeTarget = [...this.manualGaze]; this.currentPose.gaze = [...this.manualGaze];
    this.syncState(); this.send({ kind: 'reset-tracking' }); this.poseRevision = this.bridge?.revision ?? 0;
  }
  get interaction(): 'none' | 'box' { return this.interactionState; }
  set interaction(value: 'none' | 'box') {
    if (value !== 'none' && value !== 'box') throw new TypeError('interaction은 none 또는 box입니다.');
    this.reflectAttribute('interaction', value);
  }
  get ready(): boolean { return this.readyState; }
  /** Last acknowledged worker pose; configuration and body orientation getters are immediate. */
  get pose(): Pose { return structuredClone(this.currentPose); }
  get diagnostics(): { travel?: TravelPresentation; ready: boolean; running: boolean; frames: number; drawCalls: number; buffers: number; backend: 'worker' | 'main' | 'none'; generation: number; revision: number; acknowledgedRevision: number; time: number; renderCpu: { lastMs: number; totalMs: number; maxMs: number }; renderedRotation: Pose['rotation'] } {
    return { travel: this.snapshotState?.travel ? structuredClone(this.snapshotState.travel) : undefined, ready: this.ready, running: this.ready && (this.snapshotState?.running ?? false), frames: this.snapshotState?.frames ?? 0, drawCalls: this.snapshotState?.drawCalls ?? 0, buffers: this.ready ? this.snapshotState?.buffers ?? 0 : 0, backend: this.bridge?.backend ?? 'none', generation: this.generation, revision: this.bridge?.revision ?? 0, acknowledgedRevision: this.acknowledgedRevision, time: this.snapshotState?.time ?? this.elapsed, renderCpu: { ...(this.snapshotState?.renderCpu ?? { lastMs: 0, totalMs: 0, maxMs: 0 }) }, renderedRotation: [...(this.snapshotState?.renderedRotation ?? [0, 0, 0])] };
  }
  /** Body-facing angles in degrees. Reads return an independent snapshot. */
  get bodyOrientation(): BodyOrientation { return { ...this.orientationState }; }
  set bodyOrientation(value: BodyOrientation) { this.setBodyOrientation(value); }
  setBodyOrientation(angles: Partial<BodyOrientation>): void {
    const next = patchBodyOrientation(this.orientationState, angles);
    this.interruptBehavior();
    if (next.yaw === this.orientationState.yaw && next.pitch === this.orientationState.pitch && next.roll === this.orientationState.roll) return;
    this.orientationState = next;
    this.send({ kind: 'state', state: { bodyOrientation: this.bodyOrientation } });
    this.emit('sidekick-body-orientation-change', { bodyOrientation: this.bodyOrientation });
  }
  setBodyOrientationPreset(preset: BodyOrientationPreset): void { this.setBodyOrientation(bodyOrientationPreset(preset)); }
  resetBodyOrientation(): void { this.clearDrag(); this.setBodyOrientation(createBodyOrientation()); }
  get zoom(): number { return this.zoomState; }
  set zoom(value: number) {
    if (typeof value !== 'number') throw new TypeError('zoom must be a number between 0.5 and 3');
    const next = createZoom(value);
    if (next === this.zoomState) return;
    this.zoomState = next;
    this.send({ kind: 'state', state: { zoom: next } }); this.emit('sidekick-zoom-change', { zoom: next });
  }
  lookAt(target: { space: 'view'; x: number; y: number }): void {
    if (target.space !== 'view') throw new TypeError('시선 좌표계는 view입니다.');
    const gaze: Vec2 = [finite(target.x, -1, 1, 'gaze.x'), finite(target.y, -1, 1, 'gaze.y')];
    this.interruptBehavior(); this.manualGaze = gaze;
    this.setGazeTarget(this.manualGaze);
  }
  seek(seconds: number): void { this.elapsed = finite(seconds, 0, 86400, 'time'); this.send({ kind: 'state', state: { time: this.elapsed } }); this.timeRevision = this.bridge?.revision ?? 0; }
  /**
   * Worker mode reads the latest browser-presented bitmap without flushing commands.
   * Use capturePixelsAsync() when fresh ordered GPU output is required. Rows are bottom-up.
   */
  capturePixels(): PixelBuffer {
    if (!this.bridge || !this.canvas || !this.ready) throw new Error('아바타가 렌더링 준비 상태가 아닙니다.');
    if (this.bridge.capture) { this.pendingResize = true; this.flushInput(); return this.bridge.capture(); }
    const source = this.canvas, output = this.captureCanvas ??= this.ownerDocument.createElement('canvas');
    const width = this.snapshotState?.width ?? source.width, height = this.snapshotState?.height ?? source.height;
    if (output.width !== width) output.width = width;
    if (output.height !== height) output.height = height;
    const context = output.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas readback is unavailable');
    context.clearRect(0, 0, output.width, output.height); context.drawImage(source, 0, 0, width, height);
    const rgba = context.getImageData(0, 0, output.width, output.height).data, pixels = new Uint8Array(rgba.length), stride = output.width * 4;
    for (let y = 0; y < output.height; y++) pixels.set(rgba.subarray(y * stride, (y + 1) * stride), (output.height - 1 - y) * stride);
    // Match raw WebGL readback's premultiplied RGBA convention.
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3]! < 255) for (let channel = 0; channel < 3; channel++) pixels[i + channel] = Math.round(pixels[i + channel]! * pixels[i + 3]! / 255);
    return { width: output.width, height: output.height, pixels };
  }
  /** Render and read a fresh frame after every preceding command and pending input. */
  async capturePixelsAsync(): Promise<PixelBuffer> {
    this.flushAttributes();
    if (!this.bridge || !this.connected) throw new Error('아바타가 렌더링 준비 상태가 아닙니다.');
    this.pendingResize = true; this.flushInput(); const pending = this.request<PixelBuffer>('capture'); this.send({ kind: 'capture', request: pending.id }); return pending.promise;
  }
  async snapshot(options: SnapshotOptions = {}): Promise<Blob> {
    const validated = validateSnapshotOptions(options);
    this.flushAttributes();
    if (!this.bridge || !this.connected) throw new Error('아바타가 렌더링 준비 상태가 아닙니다.');
    this.pendingResize = true; this.flushInput(); const pending = this.request<Blob>('snapshot'); this.send({ kind: 'snapshot', request: pending.id, options: validated }); return pending.promise;
  }
  connectedCallback(): void {
    if (this.connected) return;
    this.connected = true;
    this.flushAttributes();
    this.upgradeProperties();
    if (this.pendingBehavior !== undefined) this.behavior = this.pendingBehavior;
    if (!this.connected || !this.isConnected) return;
    if (!this.shadowRoot) {
      const shadow = this.attachShadow({ mode: 'open' });
      shadow.innerHTML = `<style>
        :host{visibility:var(--sidekick-visibility,visible);display:inline-block;position:var(--sidekick-position,relative);left:var(--sidekick-inset,auto);top:var(--sidekick-inset,auto);translate:var(--sidekick-x,0px) var(--sidekick-y,0px);width:200px;height:200px;contain:layout style;pointer-events:none;vertical-align:middle}
        :host{pointer-events:var(--sidekick-pointer-events,none);cursor:var(--sidekick-cursor,auto);touch-action:auto}
        :host(:focus-visible){outline:2px solid currentColor;outline-offset:3px;border-radius:12px}
        canvas{touch-action:var(--sidekick-touch-action,auto);display:block;width:100%;height:100%;object-fit:contain;background:transparent}
        span{position:absolute;inset:0;display:grid;place-items:center;padding:16px;text-align:center;font:13px/1.5 system-ui;color:currentColor}
        [hidden]{display:none!important}
      </style><canvas part="canvas" aria-hidden="true" hidden></canvas><span part="fallback" hidden></span>`;
      this.canvas = shadow.querySelector('canvas')!;
      this.fallback = shadow.querySelector('span')!;
    }
    if (this.transferred) this.replaceCanvas();
    this.updateInteraction(); this.updatePlacement();
    this.ownerDocument.defaultView?.addEventListener('resize', this.onViewportResize);
    if (!this.hasAttribute('aria-label')) this.setAttribute('aria-label', 'Sidekick 아바타');
    this.media = matchMedia('(prefers-reduced-motion: reduce)'); this.reduced = this.media.matches;
    this.media.addEventListener('change', this.onMotionPreference);
    this.ownerDocument.addEventListener('visibilitychange', this.onVisibility);
    this.addEventListener('keydown', this.onKey);
    this.attachCanvasListeners();
    this.sizeObserver = new ResizeObserver(this.resize); this.sizeObserver.observe(this);
    this.visibilityObserver = new IntersectionObserver(entries => {
      const entry = entries.at(-1);
      this.visible = Boolean(entry?.isIntersecting && entry.intersectionRect.width > 0 && entry.intersectionRect.height > 0);
      this.updateMouseTracking();
      this.syncState();
    }, { threshold: [0, Number.EPSILON] });
    this.visibilityObserver.observe(this);
    this.initializeRenderer();
  }
  disconnectedCallback(): void {
    this.emotionController.cancel('disconnected');
    this.behaviorController.cancel('disconnected');
    this.connected = false; this.releaseAnchor(false);
    this.presence.cancel(); this.playback.disconnect(); this.movement.disconnect();
    this.ownerDocument.defaultView?.removeEventListener('resize', this.onViewportResize);
    this.connected = false; this.readyState = false; this.cancelInput(); this.detachMouseTracking(); this.clearDrag();
    this.disposeBridge(new Error('Avatar disconnected')); this.resetEyes(); this.snapshotState = undefined;
    this.sizeObserver?.disconnect(); this.visibilityObserver?.disconnect(); this.sizeObserver = undefined; this.visibilityObserver = undefined;
    this.media?.removeEventListener('change', this.onMotionPreference); this.media = undefined;
    this.ownerDocument.removeEventListener('visibilitychange', this.onVisibility);
    this.removeEventListener('keydown', this.onKey); this.detachCanvasListeners(); this.captureCanvas = undefined;
  }
  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    if (old === value) return;
    if (name === 'render-style' && value === '3d') { this.setAttribute('render-style', 'flat'); return; }
    this.pendingAttributes.set(name, value);
    if (!this.attributesQueued) {
      this.attributesQueued = true;
      queueMicrotask(() => { this.attributesQueued = false; this.flushAttributes(); });
    }
  }
  /** Imperative setters commit independently of an unrelated rejected HTML batch. */
  private reflectAttribute(name: string, value: string | null): void {
    const deferred = this.pendingAttributes;
    this.pendingAttributes = new Map();
    if (value === null) this.toggleAttribute(name, false); else this.setAttribute(name, value);
    // Reflection may repeat the existing raw value after a rejected transaction.
    this.pendingAttributes.set(name, value);
    this.flushAttributes();
    deferred.delete(name);
    for (const [key, text] of deferred) if (!this.pendingAttributes.has(key)) this.pendingAttributes.set(key, text);
  }
  /** A synchronous group of DOM writes is one validated transaction. */
  private flushAttributes(): void {
    if (!this.pendingAttributes.size) return;
    const pending = this.pendingAttributes; this.pendingAttributes = new Map();
    const candidate = new Map(this.acceptedAttributes);
    for (const [name, value] of pending) { if (value === null) candidate.delete(name); else candidate.set(name, value); }
    try {
      const resolved = resolveSidekickAttributes(candidate);
      const behavior = pending.has('behavior') && candidate.has('behavior') ? validateBehavior(JSON.parse(candidate.get('behavior')!), this.ownerDocument) : null;
      const touched = (...names: string[]): boolean => names.some(name => pending.has(name));
      const allDesign = touched('design');
      const next = this.design;
      if (allDesign || touched('shape')) next.body.shape = resolved.design.body.shape;
      if (allDesign || touched('body-color')) next.body.color = resolved.design.body.color;
      if (allDesign || touched('eye-color')) next.eyes.color = resolved.design.eyes.color;
      for (const side of ['left', 'right'] as const) {
        if (allDesign || touched('expression', `${side}-expression`)) next.eyes[side] = resolved.design.eyes[side];
        for (const weight of ['smile', 'blink'] as const) {
          if (allDesign || touched('expression', `${side}-expression`, weight, `${side}-${weight}`)) next.eyes[side].weights[weight] = resolved.design.eyes[side].weights[weight];
        }
      }
      if (allDesign || touched('accessories')) next.accessories = resolved.design.accessories;
      else for (const [prefix, slot] of Object.entries(ACCESSORY_ATTRIBUTE_SLOTS)) {
        if (!touched(`${prefix}-accessory`, `${prefix}-color`)) continue;
        const selected = resolved.design.accessories.find(item => item.slot === slot);
        const index = next.accessories.findIndex(item => item.slot === slot);
        if (touched(`${prefix}-accessory`)) {
          if (selected) { if (index === -1) next.accessories.push(selected); else next.accessories[index] = selected; }
          else if (index !== -1) next.accessories.splice(index, 1);
        } else if (index !== -1) {
          const current = next.accessories[index]!;
          current.color = candidate.get(`${prefix}-color`)?.toLowerCase() ?? selected?.color ?? createAccessory(current.preset, { slot: current.slot }).color;
        }
      }
      const validated = parseDesign(next);
      let target: MotionTarget | undefined;
      if (touched('motion')) {
        target = resolved.motion ?? {
          body: { rotation: [0, 0, 0] }, face: { uv: [0, 0] },
          eyes: { openness: 1, left: { weights: validated.eyes.left.weights }, right: { weights: validated.eyes.right.weights } },
          accessories: Object.fromEntries(validated.accessories.map(item => [item.id, { rotation: [0, 0, 0] as [number, number, number] }])),
        };
        for (const id of Object.keys(target.accessories ?? {})) if (!validated.accessories.some(item => item.id === id)) throw new SidekickAttributeError('motion', candidate.get('motion') ?? null, `unknown accessory: ${id}`);
        void new MotionTimeline({ left: validated.eyes.left, right: validated.eyes.right }).to(target, { duration: 0 });
      }
      // Validation is complete before any live state, request or listener changes.
      if (touched('activity', 'mouse-tracking', 'tracking-mode', 'expression', 'left-expression', 'right-expression', 'smile', 'blink', 'left-smile', 'right-smile', 'left-blink', 'right-blink', 'design', 'motion')) this.interruptBehavior();
      this.batch(() => {
      this.acceptedAttributes = candidate;
      if (touched('paused')) { this.pausedState = resolved.paused; if (resolved.paused) this.movement.finish(); this.playback.policyChanged(); }
      if (touched('placement', 'movement-bounds')) {
        this.placementState = resolved.placement; this.boundsState = resolved.movementBounds;
        const revision = this.presence.reveal();
        if (this.presence.owns(revision)) { this.movement.cancel(true); this.presence.recovered(revision); }
        this.updatePlacement();
      }
      if (touched('position-x', 'position-y')) void this.moveTo({ x: touched('position-x') ? resolved.position.x : this.position.x, y: touched('position-y') ? resolved.position.y : this.position.y }, resolved.moveOptions);
      if (touched('activity')) { if (!this.playbackCommand) this.playback.cancelPlayback(); this.currentActivity = resolved.activity; }
      if (touched('interaction')) { this.interactionState = resolved.interaction; this.clearDrag(); if (this.isConnected) this.updateInteraction(); }
      if (!this.playbackCommand && (allDesign || touched('shape', 'expression', 'left-expression', 'right-expression', 'accessories', ...Object.keys(ACCESSORY_ATTRIBUTE_SLOTS).map(slot => `${slot}-accessory`)))) this.playback.cancelTransition();
      const eyeSides = (['left', 'right'] as const).filter(side => allDesign || touched('expression', `${side}-expression`, 'smile', 'blink', `${side}-smile`, `${side}-blink`));
      if (eyeSides.length || JSON.stringify(validated) !== JSON.stringify(this.configuration)) this.applyDesign(validated, { shape: resolved.shapeOptions, eyes: resolved.motionOptions, eyeSides });
      if (touched('body-orientation')) this.setBodyOrientation(resolved.bodyOrientation);
      else {
        const orientation: Partial<BodyOrientation> = {};
        for (const axis of ['yaw', 'pitch', 'roll'] as const) if (touched(`body-${axis}`)) orientation[axis] = resolved.bodyOrientation[axis];
        if (Object.keys(orientation).length) this.setBodyOrientation(orientation);
      }
      if (touched('zoom')) this.zoom = resolved.zoom;
      if (touched('gaze-x', 'gaze-y')) this.lookAt({ space: 'view', x: touched('gaze-x') ? resolved.gaze[0] : this.manualGaze[0], y: touched('gaze-y') ? resolved.gaze[1] : this.manualGaze[1] });
      if (touched('mouse-tracking', 'tracking-mode')) { this.trackingModeState = resolved.trackingMode; this.updateTrackingBody(); this.updateMouseTracking(); }
      if (touched('time')) this.seek(resolved.time);
      if (target) void this.motion.to(target, resolved.motionOptions);
      if (touched('emotion', 'emotion-intensity')) this.setEmotion(touched('emotion') ? resolved.emotion.emotion : this.emotion, { intensity: touched('emotion-intensity') ? resolved.emotion.intensity : this.emotionIntensity });
      this.syncState();
      });
      if (touched('behavior')) this.behavior = behavior;
    } catch (error) {
      // Keep rejected writes together: repairing one field retries the original batch.
      for (const [name, value] of pending) if (!this.pendingAttributes.has(name)) this.pendingAttributes.set(name, value);
      this.emit('sidekick-error', { message: error instanceof Error ? error.message : String(error), ...(error instanceof SidekickAttributeError ? { attribute: error.attribute, value: error.value } : {}) });
    }
  }
  private upgradeProperties(): void {
    if (this.propertiesUpgraded) return;
    this.propertiesUpgraded = true;
    for (const name of ['behavior', 'placement', 'movementBounds', 'design', 'emotion', 'emotionIntensity', 'bodyOrientation', 'zoom', 'renderStyle', 'paused', 'interaction', 'mouseTracking', 'trackingMode'] as const) {
      if (!Object.prototype.hasOwnProperty.call(this, name)) continue;
      const value: unknown = this[name];
      Reflect.deleteProperty(this, name);
      try { Reflect.set(this, name, value); }
      catch (error) { this.emit('sidekick-error', { message: error instanceof Error ? error.message : String(error) }); }
    }
  }
  private immediateMotion(): boolean { return this.paused || this.reduced || !this.isConnected || !this.ready; }
  private initializeRenderer(forceMain = false): void {
    if (!this.connected || !this.canvas) return;
    const generation = ++this.generation;
    this.canvas.hidden = true;
    this.readyState = false; this.snapshotState = undefined; this.acknowledgedRevision = 0; this.poseRevision = 0; this.timeRevision = 0;
    const callbacks = {
      ready: (snapshot: RuntimeSnapshot, revision: number): void => {
        if (!this.connected || generation !== this.generation) return;
        this.acceptSnapshot(snapshot, revision);
        this.presentInitialFrame(generation);
      },
      event: (event: RuntimeEvent, revision: number): void => {
        if (!this.connected || generation !== this.generation) return;
        if ('snapshot' in event) this.acceptSnapshot(event.snapshot, revision);
        if (event.kind === 'complete') this.resolveRequest(event.request, event.result);
        else if (event.kind === 'pixels') this.resolveRequest(event.request, event.image);
        else if (event.kind === 'snapshot') this.resolveRequest(event.request, event.blob);
        else if (event.kind === 'request-error') { const pending = this.requests.get(event.request); this.requests.delete(event.request); pending?.reject(new Error(event.message)); }
        else if (event.kind === 'error') this.runtimeFailure(new Error(event.message), generation);
      },
      failed: (error: Error): void => this.runtimeFailure(error, generation),
    };
    const attemptWorker = !forceMain && supportsRenderWorker(this.canvas);
    try {
      this.bridge = attemptWorker ? new WorkerRenderBridge(this.canvas, generation, callbacks) : new LocalRenderBridge(this.canvas, generation, callbacks);
      this.bridge.start(this.runtimeState()); this.transferred ||= this.bridge?.transferred ?? false;
    } catch (error) { this.runtimeFailure(error instanceof Error ? error : new Error(String(error)), generation, attemptWorker); }
  }
  private presentInitialFrame(generation: number): void {
    if (!this.connected || generation !== this.generation || !this.bridge) return;
    this.flushAttributes();
    const request = this.request<MotionResult>('barrier');
    this.bridge.send({ kind: 'present', request: request.id });
    const revision = this.bridge.revision;
    void request.promise.then(() => {
      if (!this.connected || generation !== this.generation || !this.bridge) return;
      // A newer configuration can arrive while the worker processes the fence.
      // Never reveal its obsolete frame; acknowledge and draw the latest one.
      this.flushAttributes();
      if (this.bridge.revision !== revision) { this.presentInitialFrame(generation); return; }
      this.readyState = true;
      this.canvas!.hidden = false; this.fallback!.hidden = true;
      this.updateMouseTracking(); this.emit('sidekick-ready', {});
    }).catch(() => { /* Disconnect/fallback owns cancellation and error reporting. */ });
  }
  private runtimeFailure(error: Error, generation: number, wasWorker = this.bridge?.backend === 'worker'): void {
    if (!this.connected || generation !== this.generation) return;
    this.readyState = false; this.cancelInput(); this.detachMouseTracking(); this.clearDrag(); this.disposeBridge(error); this.resetEyes();
    this.emit('sidekick-error', { message: error.message, recoverable: wasWorker });
    // An error listener may synchronously disconnect or reconnect this element.
    if (!this.connected || generation !== this.generation) return;
    if (wasWorker) { this.replaceCanvas(); this.attachCanvasListeners(); this.initializeRenderer(true); }
    else { this.canvas!.hidden = true; this.fallback!.hidden = false; this.fallback!.textContent = error.message; }
  }
  private acceptSnapshot(snapshot: RuntimeSnapshot, revision: number): void {
    if (revision < this.acknowledgedRevision || (revision === this.acknowledgedRevision && snapshot.frames < (this.snapshotState?.frames ?? 0))) return;
    this.snapshotState = snapshot; this.acknowledgedRevision = revision;
    if (revision >= this.timeRevision) this.elapsed = snapshot.time;
    if (revision >= this.poseRevision) this.currentPose = structuredClone(snapshot.pose);
  }
  private disposeBridge(reason: Error): void {
    const bridge = this.bridge; this.bridge = undefined;
    this.transferred ||= bridge?.transferred ?? false; bridge?.dispose();
    for (const [id, pending] of this.requests) {
      if (pending.kind === 'motion' || pending.kind === 'shape') this.resolveRequest(id, { finished: false });
      else { this.requests.delete(id); pending.reject(reason); }
    }
  }
  private request<T>(kind: 'motion' | 'shape' | 'capture' | 'snapshot' | 'barrier'): { id: number; promise: Promise<T> } {
    const id = ++this.nextRequest;
    const promise = new Promise<T>((resolve, reject) => this.requests.set(id, { kind, resolve: value => resolve(value as T), reject }));
    if (kind === 'motion' || kind === 'shape') void promise.then(detail => this.emit(kind === 'motion' ? 'sidekick-motion-end' : 'sidekick-shape-end', detail));
    return { id, promise };
  }
  private resolveRequest(id: number, result: unknown): void { const pending = this.requests.get(id); this.requests.delete(id); pending?.resolve(result); }
  private send(command: RuntimeCommand): void { if (this.commandBatch) this.commandBatch.push(command); else this.bridge?.send(command); }
  private batch(action: () => void): void {
    const outer = this.commandBatch; this.commandBatch = [];
    try { action(); } finally {
      const commands = this.commandBatch; this.commandBatch = outer;
      if (commands.length) this.send({ kind: 'batch', commands });
      this.poseRevision = this.bridge?.revision ?? 0; this.timeRevision = this.bridge?.revision ?? 0;
    }
  }
  private runtimeState(): RuntimeState {
    const rect = this.getBoundingClientRect();
    return { emotionEyeOverrides: { ...this.emotionEyeOverrides }, emotion: { emotion: this.emotionState.emotion, intensity: this.emotionState.intensity }, attention: this.behaviorAttention, travel: this.travelPresentation, design: this.design, bodyOrientation: this.bodyOrientation, zoom: this.zoom, pose: this.pose, activity: this.activity, paused: this.paused, reduced: this.reduced, active: this.connected && !this.presenceHidden && this.visible && !this.ownerDocument.hidden, time: this.elapsed, gaze: [...this.gazeTarget], trackingMode: this.trackingMode, trackedGaze: this.gesturing ? undefined : this.trackedGaze, width: rect.width, height: rect.height, dpr: this.ownerDocument.defaultView?.devicePixelRatio ?? 1 };
  }
  private syncState(): void {
    this.send({ kind: 'state', state: { attention: this.behaviorAttention, activity: this.activity, paused: this.paused, reduced: this.reduced, active: this.connected && !this.presenceHidden && this.visible && !this.ownerDocument.hidden, gaze: [...this.gazeTarget], trackingMode: this.trackingMode, trackedGaze: this.gesturing ? undefined : this.trackedGaze } });
    if (this.paused || this.reduced) { this.currentPose.gaze = [...this.gazeTarget]; this.poseRevision = this.bridge?.revision ?? 0; }
  }
  private attachCanvasListeners(): void {
    this.canvas!.addEventListener('pointerdown', this.onPointerDown); this.canvas!.addEventListener('pointermove', this.onPointerMove);
    this.canvas!.addEventListener('pointerup', this.onPointerUp); this.canvas!.addEventListener('pointercancel', this.onPointerCancel);
    this.canvas!.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas!.addEventListener('lostpointercapture', this.onLostPointerCapture);
    this.canvas!.addEventListener('webglcontextrestored', this.onContextRestored);
  }
  private detachCanvasListeners(): void {
    this.canvas?.removeEventListener('pointerdown', this.onPointerDown); this.canvas?.removeEventListener('pointermove', this.onPointerMove);
    this.canvas?.removeEventListener('pointerup', this.onPointerUp); this.canvas?.removeEventListener('pointercancel', this.onPointerCancel);
    this.canvas?.removeEventListener('wheel', this.onWheel);
    this.canvas?.removeEventListener('lostpointercapture', this.onLostPointerCapture);
    this.canvas?.removeEventListener('webglcontextrestored', this.onContextRestored);
  }
  private replaceCanvas(): void {
    this.detachCanvasListeners();
    const canvas = this.ownerDocument.createElement('canvas'); canvas.setAttribute('part', 'canvas'); canvas.setAttribute('aria-hidden', 'true');
    this.canvas?.replaceWith(canvas); this.canvas = canvas; this.transferred = false; this.captureCanvas = undefined;
  }
  private updateInteraction(): void {
    this.setAttribute('role', this.interaction === 'box' ? 'button' : 'img'); this.tabIndex = this.interaction === 'box' ? 0 : -1;
    this.style.setProperty('--sidekick-pointer-events', this.interaction === 'box' ? 'auto' : 'none');
    this.style.setProperty('--sidekick-touch-action', this.interaction === 'box' ? 'none' : 'auto');
    this.style.setProperty('--sidekick-cursor', this.interaction === 'box' ? 'grab' : 'auto');
  }
  private resize = (): void => { this.measureMovementBox(); if (this.presence?.bypassBounds) this.presence.resize(); else this.movement.resize(); this.pendingResize = true; this.queueInput(); };
  private queueInput(): void { if (!this.inputFrame && this.connected) this.inputFrame = requestAnimationFrame(this.flushInput); }
  private cancelInput(): void { if (this.inputFrame) cancelAnimationFrame(this.inputFrame); this.inputFrame = 0; this.pendingResize = false; this.pendingPointer = undefined; this.pendingDrag = undefined; this.pendingZoom = undefined; this.pendingPinchDistance = undefined; }
  private flushInput = (): void => {
    if (this.inputFrame) cancelAnimationFrame(this.inputFrame); this.inputFrame = 0;
    if (!this.connected) return;
    const dragged = this.pendingDrag; this.pendingDrag = undefined;
    const orientation: Partial<BodyOrientation> = {};
    if (dragged && this.drag) Object.assign(orientation, { yaw: clamp(this.drag.bodyOrientation.yaw + (dragged.x - this.drag.x) * .01 * 180 / Math.PI, -360, 360), pitch: clamp(this.drag.bodyOrientation.pitch + (dragged.y - this.drag.y) * .007 * 180 / Math.PI, -90, 90) });
    const pinch = this.pinch, distance = this.pendingPinchDistance; this.pendingPinchDistance = undefined;
    let zoom = this.pendingZoom; this.pendingZoom = undefined;
    if (pinch && distance !== undefined) zoom = pinchZoom(zoom ?? pinch.zoom, pinch.distance, distance);
    if (Object.keys(orientation).length) this.setBodyOrientation(orientation);
    if (zoom !== undefined) this.zoom = zoom;
    if (pinch && this.pinch === pinch && distance !== undefined) {
      pinch.distance = distance; pinch.zoom = this.zoom;
    }
    const pointer = this.pendingPointer; this.pendingPointer = undefined;
    if (this.pendingResize || pointer) {
      const rect = this.getBoundingClientRect();
      if (this.pendingResize) { this.pendingResize = false; this.send({ kind: 'resize', width: rect.width, height: rect.height, dpr: this.ownerDocument.defaultView?.devicePixelRatio ?? 1 }); }
      if (pointer && this.trackingDocument && !this.gesturing && rect.width > 0 && rect.height > 0) {
        this.trackedGaze = [clamp((pointer.x - rect.left - rect.width / 2) / (rect.width / 2), -1, 1), clamp((rect.top + rect.height / 2 - pointer.y) / (rect.height / 2), -1, 1)];
        this.setGazeTarget(this.trackedGaze);
      }
    }
  };
  private emit(name: keyof SidekickEventMap, detail: unknown): void { this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true })); }
  private resetEyes(): void { this.validator.pose = structuredClone(this.currentPose); this.validator.setEyes({ left: this.configuration.eyes.left, right: this.configuration.eyes.right }); this.currentPose = structuredClone(this.validator.pose); }
  private onMotionPreference = (): void => { this.reduced = this.media?.matches ?? false; if (this.reduced) this.movement.finish(); this.playback.policyChanged(); this.syncState(); };
  private onVisibility = (): void => { if (this.anchorState) this.movement.suspend(this.ownerDocument.hidden || this.anchorSleeping); this.updateMouseTracking(); this.syncState(); };
  private setGazeTarget(target: Vec2): void { this.gazeTarget = [...target]; this.syncState(); }
  private updateMouseTracking(): void {
    const enabled = this.mouseTracking && !this.presenceHidden && this.isConnected && this.ready && this.visible && !this.ownerDocument.hidden;
    if (!enabled) { this.detachMouseTracking(); return; }
    if (this.trackingDocument === this.ownerDocument) return;
    this.detachMouseTracking();
    this.trackingDocument = this.ownerDocument;
    this.trackingDocument.addEventListener('pointermove', this.onTrackedPointerMove, { passive: true });
    this.trackingDocument.addEventListener('pointerleave', this.onTrackingLeave);
    this.trackingDocument.addEventListener('pointerout', this.onTrackingOut);
    this.trackingDocument.defaultView?.addEventListener('blur', this.onTrackingBlur);
  }
  private detachMouseTracking(): void {
    this.trackingDocument?.removeEventListener('pointermove', this.onTrackedPointerMove);
    this.trackingDocument?.removeEventListener('pointerleave', this.onTrackingLeave);
    this.trackingDocument?.removeEventListener('pointerout', this.onTrackingOut);
    this.trackingDocument?.defaultView?.removeEventListener('blur', this.onTrackingBlur);
    this.trackingDocument = undefined;
    this.restoreManualTracking();
  }
  private updateTrackingBody(): void { this.syncState(); }
  private restoreManualTracking(): void { this.lastTrackedPointer = undefined; this.pendingPointer = undefined; this.trackedGaze = undefined; this.setGazeTarget(this.manualGaze); }
  private onTrackingBlur = (): void => { this.clearDrag(); this.restoreManualTracking(); };
  private onTrackingLeave = (event: PointerEvent): void => { if (event.pointerType && event.pointerType !== 'mouse') return; this.restoreManualTracking(); };
  private onTrackingOut = (event: PointerEvent): void => { if (event.relatedTarget === null) this.onTrackingLeave(event); };
  private onTrackedPointerMove = (event: PointerEvent): void => {
    if (!this.trackingDocument || !this.mouseTracking || this.gesturing || (event.pointerType && event.pointerType !== 'mouse')) return;
    this.lastTrackedPointer = { x: event.clientX, y: event.clientY }; this.pendingPointer = { ...this.lastTrackedPointer }; this.queueInput();
  };
  private get gesturing(): boolean { return this.pointers.size > 0 || this.wheelGesture; }
  private clearDrag(): void {
    this.pendingDrag = undefined; this.pendingZoom = undefined; this.pendingPinchDistance = undefined; this.drag = undefined; this.pinch = undefined;
    const ids = [...this.pointers.keys()]; this.pointers.clear();
    for (const id of ids) if (this.canvas?.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
    if (this.wheelTimer !== undefined) clearTimeout(this.wheelTimer);
    this.wheelTimer = undefined; this.wheelGesture = false;
    this.restoreManualTracking();
  }
  /** Rebase at each pointer-count transition, after flushing the previous gesture. */
  private rebasePointers(moved = true): void {
    this.pendingDrag = undefined; this.pendingPinchDistance = undefined; this.pinch = undefined; this.drag = undefined;
    const entries = [...this.pointers.entries()];
    if (entries.length === 1) {
      const [id, point] = entries[0]!;
      this.drag = { id, x: point.x, y: point.y, bodyOrientation: this.bodyOrientation, moved };
    } else if (entries.length === 2) {
      const a = entries[0]![1], b = entries[1]![1];
      this.pinch = { distance: Math.hypot(b.x - a.x, b.y - a.y), zoom: this.zoom };
    }
  }
  private onKey = (event: KeyboardEvent): void => {
    if (this.interaction === 'box' && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); this.emit('sidekick-activate', {}); }
  };
  private onWheel = (event: WheelEvent): void => {
    // Read the unit before the delta (some browsers adapt legacy wheel units).
    const mode = event.deltaMode, delta = event.deltaY;
    if (this.interaction !== 'box' || !this.connected || !Number.isFinite(delta) || delta === 0) return;
    event.preventDefault();
    if (!this.gesturing) this.resetTracking();
    this.wheelGesture = true;
    if (this.wheelTimer !== undefined) clearTimeout(this.wheelTimer);
    this.wheelTimer = setTimeout(() => { this.wheelTimer = undefined; this.wheelGesture = false; }, 150);
    this.pendingZoom = wheelZoom(this.pendingZoom ?? this.zoom, delta, mode, this.getBoundingClientRect().height);
    this.queueInput();
  };
  private onPointerDown = (event: PointerEvent): void => {
    if (this.interaction !== 'box' || event.button !== 0 || this.pointers.has(event.pointerId) || this.pointers.size >= 2) return;
    // A second pointer participates only in a two-finger touch gesture.
    if (this.pointers.size && (event.pointerType !== 'touch' || [...this.pointers.values()].some(point => point.type !== 'touch'))) return;
    const generation = this.generation, canvas = this.canvas;
    this.flushInput();
    // Orientation/zoom listeners may disconnect, reconnect or disable interaction.
    if (!this.connected || this.generation !== generation || this.canvas !== canvas || this.interaction !== 'box') return;
    const first = this.pointers.size === 0;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType ?? 'mouse' });
    this.rebasePointers(!first);
    if (first) this.resetTracking();
    this.canvas!.setPointerCapture(event.pointerId);
  };
  private onPointerMove = (event: PointerEvent): void => {
    const point = this.pointers.get(event.pointerId); if (!point) return;
    point.x = event.clientX; point.y = event.clientY;
    if (this.pinch) {
      const [a, b] = [...this.pointers.values()];
      // Both finger events contribute before clamping. Translating the centroid
      // at either limit must not turn sequential events into a scale change.
      this.pendingPinchDistance = Math.hypot(b!.x - a!.x, b!.y - a!.y);
    } else if (this.drag) {
      if (Math.hypot(point.x - this.drag.x, point.y - this.drag.y) > 4) this.drag.moved = true;
      this.pendingDrag = { x: point.x, y: point.y };
    }
    this.queueInput();
  };
  private onPointerUp = (event: PointerEvent): void => {
    if (!this.pointers.has(event.pointerId)) return;
    this.flushInput();
    const activate = this.pointers.size === 1 && this.drag && !this.drag.moved;
    // Remove before releasing: lostpointercapture may dispatch synchronously.
    this.pointers.delete(event.pointerId); this.rebasePointers();
    if (this.canvas?.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    if (activate) this.emit('sidekick-activate', {});
    if (!this.pointers.size) this.restoreManualTracking();
  };
  private onPointerCancel = (): void => { this.clearDrag(); };
  private onLostPointerCapture = (event: PointerEvent): void => { if (this.pointers.has(event.pointerId)) this.clearDrag(); };
  private onContextRestored = (): void => { if (this.connected && !this.ready && this.bridge?.backend !== 'worker') { this.disposeBridge(new Error('Graphics context restored')); this.initializeRenderer(true); } };

}
export function defineSidekick(tagName = 'sidekick-avatar'): void {
  if (typeof customElements === 'undefined') return;
  if (!customElements.get(tagName)) customElements.define(tagName, tagName === 'sidekick-avatar' ? SidekickAvatar : class extends SidekickAvatar {});
}
declare global { interface HTMLElementTagNameMap { 'sidekick-avatar': SidekickAvatar } }
