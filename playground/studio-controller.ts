import { STUDIO_SESSION_KEY, loadStudioSession, applyStudioSession, defaultStudioDesign } from './studio-session.js';
export { defaultStudioDesign } from './studio-session.js';
import { createAccessory, equipAccessory, migrateDesign, patchDesign, serializeDesign, ACCESSORY_PRESETS, ACCESSORY_SLOTS_BY_PRESET, ACCESSORY_LABELS } from '../src/core/design.js';
import type { AccessoryPreset, AccessorySlot, Activity, AvatarDesign, DesignPatch } from '../src/core/design.js';
import { createBodyOrientation } from '../src/core/body-orientation.js';
import type { BodyOrientation, BodyOrientationPreset } from '../src/core/body-orientation.js';
import { eyeExpressionWeights } from '../src/core/expressions.js';
import type { EyeExpression } from '../src/core/expressions.js';
import type { MaterialShapeName } from '../src/core/shapes.js';
import type { SidekickAvatar } from '../src/element/avatar.js';
import { createScene, migrateScene, serializeScene, MAX_SCENE_BYTES } from '../src/core/scene.js';
import type { SidekickScene } from '../src/core/scene.js';
import { parseTrackingMode } from '../src/core/tracking.js';
import type { TrackingMode } from '../src/core/tracking.js';
import type { MotionTarget } from '../src/core/motion.js';

export const STORAGE_KEY = 'sidekick.design.v7';
export const LEGACY_STORAGE_KEYS = [6, 5, 4, 3, 2, 1].map(version => `sidekick.design.v${version}`);
export const ACCESSORY_NAMES = ACCESSORY_LABELS;
export const SLOT_NAMES: Record<AccessorySlot, string> = { head: '머리', eyes: '눈', mouth: '입', neck: '목', leftEar: '왼쪽 귀', rightEar: '오른쪽 귀' };
export const EQUIPMENT_GROUPS: readonly { slot: AccessorySlot; presets: readonly AccessoryPreset[] }[] = (Object.keys(SLOT_NAMES) as AccessorySlot[]).map(slot => ({ slot, presets: ACCESSORY_PRESETS.filter(preset => ACCESSORY_SLOTS_BY_PRESET[preset].includes(slot)) }));
// Keep the previous Studio starting design. New equipment is always opt-in.

export interface StoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void }
export type AvatarPort = Pick<SidekickAvatar, 'design' | 'bodyOrientation' | 'zoom' | 'paused' | 'trackingMode' | 'resetTracking' | 'interaction' | 'updateDesign' | 'setShape' | 'setExpression' | 'setEyeWeights' | 'setBodyOrientation' | 'setBodyOrientationPreset' | 'setActivity' | 'lookAt' | 'seek' | 'motion' | 'snapshot' | 'addEventListener' | 'removeEventListener'>;
export interface SavedRecovery { raw: string; key: string; error: string }
export interface StudioState {
  design: AvatarDesign;
  bodyOrientation: BodyOrientation;
  zoom: number;
  duration: number;
  easing: 'smooth' | 'linear';
  activity: Activity;
  paused: boolean;
  trackingMode: TrackingMode;
  movedFace: boolean;
  gaze: { x: number; y: number };
  time: number;
  motion: MotionTarget;
  motionDuration: number;
  motionEasing: 'smooth' | 'linear';
  interaction: 'none' | 'box';
  background: 'checker' | 'light' | 'dark';
  jsonDraft: string;
  jsonError: string;
  warnings: readonly string[];
  recovery: SavedRecovery | undefined;
  recoverySaved: boolean;
  status: string;
  statusError: boolean;
}
const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

/** Framework-independent state and persistence. UI rerenders never reapply designs. */
export class StudioController {
  private state: StudioState;
  private readonly listeners = new Set<() => void>();
  private readonly initialized = new WeakSet<AvatarPort>();
  private avatar: AvatarPort | undefined;
  private importGeneration = 0;
  private applyingSession = false;
  constructor(private readonly storage?: StoragePort) {
    let design = defaultStudioDesign(), recovery: SavedRecovery | undefined;
    let warnings: string[] = [], storageError = false;
    try {
      const key = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS].find(candidate => storage?.getItem(candidate) != null);
      const raw = key ? storage?.getItem(key) : undefined;
      if (key && raw != null) {
        try { const migrated = migrateDesign(raw); design = migrated.design; warnings = migrated.warnings; }
        catch (error) { recovery = { raw, key, error: errorMessage(error) }; }
      }
    } catch { storageError = true; }
    const saved = loadStudioSession(storage);
    if (saved.invalid) recovery = saved.invalid;
    if (saved.source === 'saved') { design = saved.scene.design; recovery = undefined; }
    this.state = {
      design, bodyOrientation: createBodyOrientation(), zoom: 1, duration: 450, easing: 'smooth', activity: 'idle', paused: false, trackingMode: 'eyes-and-body',
      movedFace: false, gaze: { x: 0, y: 0 }, time: 0, motion: {}, motionDuration: 400, motionEasing: 'smooth', interaction: 'box', background: 'checker', jsonDraft: recovery?.raw ?? serializeScene(createScene({ design, interaction: 'box' })),
      jsonError: recovery?.error ?? '', warnings, recovery, recoverySaved: false,
      status: recovery ? '저장된 설정을 읽을 수 없습니다. JSON에서 오류를 수정하거나 초기화하세요. 원본은 보존됩니다.' : storageError ? '브라우저 저장소를 읽을 수 없습니다. JSON으로 내보내세요.' : '디자인 변경은 이 브라우저에 저장됩니다.',
      statusError: !!recovery || storageError,
    };
    if (saved.source === 'saved') {
      const scene = saved.scene;
      this.state = { ...this.state, design: scene.design, bodyOrientation: scene.bodyOrientation, zoom: scene.zoom,
        activity: scene.activity, paused: scene.paused, trackingMode: scene.trackingMode, interaction: scene.interaction,
        gaze: scene.gaze, time: scene.time, motion: scene.motion, duration: scene.shapeDuration, easing: scene.shapeEasing,
        motionDuration: scene.motionDuration, motionEasing: scene.motionEasing, movedFace: !!scene.motion.face?.uv.some(value => value !== 0), jsonDraft: serializeScene(scene) };
    }
  }
  getSnapshot = (): StudioState => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<StudioState>): void { this.state = { ...this.state, ...patch }; for (const listener of this.listeners) listener(); }
  report = (status: string, statusError = false): void => this.update({ status, statusError });
  private watch(result: Promise<unknown> | undefined): void { void result?.catch(error => this.report(errorMessage(error), true)); }
  bindAvatar(avatar: AvatarPort): () => void {
    this.avatar = avatar;
    const bodyOrientationChanged = (): void => this.runtime({ bodyOrientation: { ...avatar.bodyOrientation } });
    const zoomChanged = (): void => this.runtime({ zoom: avatar.zoom });
    const failed = (event: Event): void => this.report((event as CustomEvent<{ message: string }>).detail.message, true);
    avatar.addEventListener('sidekick-body-orientation-change', bodyOrientationChanged);
    avatar.addEventListener('sidekick-zoom-change', zoomChanged);
    avatar.addEventListener('sidekick-error', failed);
    if (!this.initialized.has(avatar)) {
      this.applyingSession = true;
      try { this.watch(applyStudioSession(avatar, this.scene())); } finally { this.applyingSession = false; }
      this.initialized.add(avatar);
      if (!this.state.recovery) this.persist();
    }
    avatar.trackingMode = this.state.trackingMode;
    avatar.interaction = this.state.interaction;
    bodyOrientationChanged(); zoomChanged();
    return () => {
      avatar.removeEventListener('sidekick-body-orientation-change', bodyOrientationChanged);
      avatar.removeEventListener('sidekick-zoom-change', zoomChanged);
      avatar.removeEventListener('sidekick-error', failed);
      if (this.avatar === avatar) { this.avatar = undefined; this.importGeneration++; }
    };
  }
  private persist(message = '디자인이 이 브라우저에 저장되었습니다.'): void {
    try {
      if (!this.storage) throw new Error('Storage unavailable');
      // Never overwrite the only copy of invalid data. The recovery write must succeed first.
      if (this.state.recovery) this.storage.setItem(`${this.state.recovery.key}.recovery`, this.state.recovery.raw);
      this.storage.setItem(STORAGE_KEY, serializeDesign(this.state.design));
      this.storage.setItem(STUDIO_SESSION_KEY, serializeScene(this.scene()));
      if (this.state.recovery) this.update({ recoverySaved: true });
      this.report(message);
    } catch {
      this.report(this.state.recovery ? '저장 원본을 보호하기 위해 자동 저장하지 않았습니다. 수정한 디자인은 JSON으로 내보내세요.' : '브라우저 저장소를 사용할 수 없습니다. JSON으로 내보내세요.', true);
    }
  }
  private scene(state = this.state): SidekickScene {
    return createScene({ design: state.design, bodyOrientation: state.bodyOrientation, zoom: state.zoom, activity: state.activity, paused: state.paused, trackingMode: state.trackingMode,
      interaction: state.interaction, gaze: state.gaze, time: state.time, motion: state.motion,
      shapeDuration: state.duration, shapeEasing: state.easing, motionDuration: state.motionDuration, motionEasing: state.motionEasing });
  }
  private runtime(patch: Partial<StudioState>): void {
    if (this.applyingSession) return;
    const next = { ...this.state, ...patch };
    this.update({ ...patch, jsonDraft: this.state.recovery && !this.state.recoverySaved ? this.state.jsonDraft : serializeScene(this.scene(next)) });
    if (!this.state.recovery || this.state.recoverySaved) this.persist();
  }
  private commit(design: AvatarDesign, message?: string): void {
    const motion = { ...this.state.motion };
    if (motion.accessories) motion.accessories = Object.fromEntries(Object.entries(motion.accessories).filter(([id]) => design.accessories.some(item => item.id === id)));
    this.update({ design, motion, jsonDraft: serializeScene(this.scene({ ...this.state, design, motion })), jsonError: '' });
    this.persist(message);
  }
  patch = (patch: DesignPatch): void => {
    const next = patchDesign(this.state.design, patch);
    this.watch(this.avatar?.updateDesign(patch));
    this.commit(next);
  };
  selectShape = (shape: MaterialShapeName): void => {
    const next = patchDesign(this.state.design, { body: { shape } });
    // setShape samples the live contour before the target state is published.
    // Do not assign avatar.design here or in a React effect.
    this.watch(this.avatar?.setShape(shape, { duration: this.state.duration, easing: this.state.easing }));
    this.commit(next, '선택한 도형으로 부드럽게 전환합니다.');
  };
  setDuration = (duration: number): void => this.runtime({ duration });
  setEasing = (easing: 'smooth' | 'linear'): void => this.runtime({ easing });
  setBackground = (background: StudioState['background']): void => this.update({ background });
  setEquipment = (slot: AccessorySlot, preset: AccessoryPreset | ''): void => {
    if (!preset) { this.patch({ accessories: this.state.design.accessories.filter(item => item.slot !== slot) }); return; }
    const current = this.state.design.accessories.find(item => item.slot === slot);
    if (current?.preset === preset) return;
    const base = (preset === 'earring' || preset === 'starEarring') ? `${slot === 'leftEar' ? 'left' : 'right'}-earring` : preset === 'beret' ? 'hat' : preset === 'bowTie' ? 'bow-tie' : preset;
    const used = new Set(this.state.design.accessories.filter(item => item.slot !== slot).map(item => item.id));
    let id = base, suffix = 2;
    while (used.has(id)) id = `${base}-${suffix++}`;
    const item = createAccessory(preset, { slot, id });
    const next = equipAccessory(this.state.design, item);
    this.patch({ accessories: next.accessories });
  };
  colorAccessory = (id: string, color: string): void => this.patch({ accessories: this.state.design.accessories.map(item => item.id === id ? { ...item, color } : item) });
  setExpression = (side: 'left' | 'right', expression: EyeExpression): void => {
    const next = patchDesign(this.state.design, { eyes: { [side]: { weights: eyeExpressionWeights(expression) } } });
    this.watch(this.avatar?.setExpression(side, expression));
    if (this.state.motion.eyes) { const eyes = { ...this.state.motion.eyes }; delete eyes[side]; this.update({ motion: { ...this.state.motion, eyes } }); }
    this.commit(next);
  };
  setWeight = (side: 'left' | 'right', key: 'smile' | 'blink', weight: number): void => {
    const next = patchDesign(this.state.design, { eyes: { [side]: { weights: { [key]: weight } } } });
    this.watch(this.avatar?.setEyeWeights(side, { [key]: weight }, { duration: 0 }));
    if (this.state.motion.eyes) { const eyes = { ...this.state.motion.eyes }; delete eyes[side]; this.update({ motion: { ...this.state.motion, eyes } }); }
    this.commit(next);
  };
  setBodyOrientation = (patch: Partial<BodyOrientation>): void => { this.avatar?.setBodyOrientation(patch); if (this.avatar) this.runtime({ bodyOrientation: { ...this.avatar.bodyOrientation } }); };
  setBodyOrientationPreset = (preset: BodyOrientationPreset): void => { this.avatar?.setBodyOrientationPreset(preset); if (this.avatar) this.runtime({ bodyOrientation: { ...this.avatar.bodyOrientation } }); };
  resetBodyOrientation = (): void => this.setBodyOrientation(createBodyOrientation());
  setZoom = (zoom: number): void => { if (this.avatar) { this.avatar.zoom = zoom; this.runtime({ zoom: this.avatar.zoom }); } };
  resetZoom = (): void => this.setZoom(1);
  setActivity = (activity: Activity): void => { this.avatar?.setActivity(activity); this.runtime({ activity }); };
  setTrackingMode = (value: TrackingMode): void => { const trackingMode = parseTrackingMode(value); if (this.avatar) this.avatar.trackingMode = trackingMode; this.runtime({ trackingMode }); };
  setMouseTracking = (enabled: boolean): void => { this.setTrackingMode(enabled ? 'eyes' : 'off'); };
  togglePause = (): void => { const paused = !this.state.paused; if (this.avatar) this.avatar.paused = paused; this.runtime({ paused }); };
  look = (x: number): void => { this.avatar?.lookAt({ space: 'view', x, y: 0 }); this.runtime({ gaze: { x, y: 0 } }); };
  toggleFace = (): void => { const movedFace = !this.state.movedFace; this.watch(this.avatar?.motion.to({ face: { uv: movedFace ? [0.23, 0.13] : [0, 0] } }, { duration: 650 })); this.runtime({ movedFace, motion: { ...this.state.motion, face: { uv: movedFace ? [0.23, 0.13] : [0, 0] } } }); };
  editJSON = (jsonDraft: string): void => { this.importGeneration++; this.update({ jsonDraft }); };
  importJSON = (raw = this.state.jsonDraft): boolean => {
    this.importGeneration++;
    try {
      // Parse every field before touching the renderer, animation clocks or persistence.
      const migrated = migrateScene(raw), scene = migrated.legacyDesign ? createScene({ design: migrated.scene.design, interaction: 'box' }) : migrated.scene;
      const avatar = this.avatar;
      if (avatar) {
        avatar.trackingMode = 'off'; avatar.paused = true; avatar.resetTracking(); avatar.motion.cancel();
        avatar.design = scene.design;
        this.watch(avatar.setShape(scene.design.body.shape, { duration: 0 }));
        this.watch(avatar.motion.to({ body: { rotation: [0, 0, 0] }, face: { uv: [0, 0] }, eyes: { openness: 1, left: { weights: scene.design.eyes.left.weights }, right: { weights: scene.design.eyes.right.weights } }, accessories: Object.fromEntries(scene.design.accessories.map(item => [item.id, { rotation: [0, 0, 0] as [number, number, number] }])) }, { duration: 0 }));
        this.watch(avatar.motion.to(scene.motion, { duration: 0 }));
        avatar.setBodyOrientation(scene.bodyOrientation); avatar.zoom = scene.zoom; avatar.lookAt({ space: 'view', ...scene.gaze }); avatar.seek(scene.time); avatar.setActivity(scene.activity);
        avatar.interaction = scene.interaction; avatar.paused = scene.paused; avatar.trackingMode = scene.trackingMode;
      }
      this.update({ design: scene.design, bodyOrientation: scene.bodyOrientation, zoom: scene.zoom, duration: scene.shapeDuration, easing: scene.shapeEasing,
        activity: scene.activity, paused: scene.paused, trackingMode: scene.trackingMode, interaction: scene.interaction,
        gaze: scene.gaze, time: scene.time, motion: scene.motion, motionDuration: scene.motionDuration, motionEasing: scene.motionEasing,
        movedFace: !!scene.motion.face?.uv.some(value => value !== 0), warnings: migrated.warnings,
        jsonDraft: serializeScene(scene), jsonError: '' });
      this.persist(migrated.legacyDesign ? '디자인 JSON을 가져왔습니다. 미리보기 설정은 기본값입니다.' : '장면 JSON과 미리보기 설정을 적용했습니다.');
      return true;
    } catch (error) { this.update({ jsonError: errorMessage(error) }); return false; }
  };
  importFile = async (file: Pick<File, 'size' | 'text'>): Promise<boolean> => {
    const generation = ++this.importGeneration;
    try {
      if (file.size > MAX_SCENE_BYTES) throw new RangeError('장면 JSON 파일은 64 KiB 이하여야 합니다.');
      const raw = await file.text();
      if (generation !== this.importGeneration) return false;
      return this.importJSON(raw);
    } catch (error) { if (generation === this.importGeneration) this.update({ jsonError: errorMessage(error) }); return false; }
  };
  reset = (): void => {
    this.importGeneration++;
    const avatar = this.avatar;
    if (avatar) {
      avatar.paused = false; avatar.trackingMode = 'eyes-and-body'; avatar.resetTracking(); avatar.interaction = 'box'; avatar.motion.cancel();
      this.watch(avatar.motion.to({ body: { rotation: [0, 0, 0] }, face: { uv: [0, 0] }, eyes: { openness: 1, left: { weights: { smile: 0, blink: 0 } }, right: { weights: { smile: 0, blink: 0 } } } }, { duration: 0 }));
      avatar.lookAt({ space: 'view', x: 0, y: 0 }); avatar.setBodyOrientation(createBodyOrientation()); avatar.zoom = 1; avatar.seek(0); avatar.setActivity('idle');
      avatar.design = defaultStudioDesign(); this.watch(avatar.setShape('square', { duration: 0 }));
    }
    this.update({ duration: 450, easing: 'smooth', paused: false, trackingMode: 'eyes-and-body', activity: 'idle', movedFace: false, gaze: { x: 0, y: 0 }, time: 0, motion: {}, motionDuration: 400, motionEasing: 'smooth', interaction: 'box', warnings: [], bodyOrientation: createBodyOrientation(), zoom: 1 });
    this.commit(defaultStudioDesign(), '기본 디자인으로 초기화했습니다.');
  };
  exportScene = (): SidekickScene => this.scene();
  exportJSON = (): string => serializeScene(this.scene());
  snapshot = (): Promise<Blob> => this.avatar ? this.avatar.snapshot() : Promise.reject(new Error('미리보기가 아직 준비되지 않았습니다.'));
}
