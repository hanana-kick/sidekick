import { createAccessory, createDesign, equipAccessory, migrateDesign, parseDesign, patchDesign, serializeDesign } from '../src/core/design.js';
import type { AccessoryPreset, AccessorySlot, Activity, AvatarDesign, DesignPatch } from '../src/core/design.js';
import { CAMERA_PRESETS } from '../src/core/camera.js';
import type { CameraAngles, CameraPreset } from '../src/core/camera.js';
import { eyeExpressionWeights } from '../src/core/expressions.js';
import type { EyeExpression } from '../src/core/expressions.js';
import type { MaterialShapeName } from '../src/core/shapes.js';
import type { SidekickAvatar } from '../src/element/avatar.js';

export const STORAGE_KEY = 'sidekick.design.v7';
export const LEGACY_STORAGE_KEYS = [6, 5, 4, 3, 2, 1].map(version => `sidekick.design.v${version}`);
export const ACCESSORY_NAMES: Record<AccessoryPreset, string> = { beret: '베레모', halo: '헤일로', glasses: '안경', moustache: '콧수염', bowTie: '보타이', scarf: '스카프', earring: '귀걸이' };
export const SLOT_NAMES: Record<AccessorySlot, string> = { head: '머리', eyes: '눈', mouth: '입', neck: '목', leftEar: '왼쪽 귀', rightEar: '오른쪽 귀' };
export const EQUIPMENT_GROUPS: readonly { slot: AccessorySlot; presets: readonly AccessoryPreset[] }[] = [
  { slot: 'head', presets: ['beret', 'halo'] }, { slot: 'eyes', presets: ['glasses'] },
  { slot: 'mouth', presets: ['moustache'] }, { slot: 'neck', presets: ['bowTie', 'scarf'] },
  { slot: 'leftEar', presets: ['earring'] }, { slot: 'rightEar', presets: ['earring'] },
];
// Keep the previous Studio starting design. New equipment is always opt-in.
export const defaultStudioDesign = (): AvatarDesign => createDesign({ body: { shape: 'square' }, accessories: [createAccessory('beret', 'hat')] });
export interface StoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void }
export type AvatarPort = Pick<SidekickAvatar, 'design' | 'camera' | 'paused' | 'updateDesign' | 'setShape' | 'setExpression' | 'setEyeWeights' | 'setCamera' | 'setCameraPreset' | 'resetCamera' | 'setActivity' | 'lookAt' | 'seek' | 'motion' | 'snapshot' | 'addEventListener' | 'removeEventListener'>;
export interface SavedRecovery { raw: string; key: string; error: string }
export interface StudioState {
  design: AvatarDesign;
  camera: CameraAngles;
  duration: number;
  easing: 'smooth' | 'linear';
  activity: Activity;
  paused: boolean;
  movedFace: boolean;
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
    this.state = {
      design, camera: { ...CAMERA_PRESETS.front }, duration: 450, easing: 'smooth', activity: 'idle', paused: false,
      movedFace: false, background: 'checker', jsonDraft: recovery?.raw ?? serializeDesign(design),
      jsonError: recovery?.error ?? '', warnings, recovery, recoverySaved: false,
      status: recovery ? '저장된 원본을 보존했습니다. JSON에서 수정하거나 내려받으세요.' : storageError ? '브라우저 저장소를 읽을 수 없습니다. JSON으로 내보내세요.' : '모든 변경은 이 브라우저에 저장됩니다.',
      statusError: !!recovery || storageError,
    };
  }
  getSnapshot = (): StudioState => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<StudioState>): void { this.state = { ...this.state, ...patch }; for (const listener of this.listeners) listener(); }
  report = (status: string, statusError = false): void => this.update({ status, statusError });
  private watch(result: Promise<unknown> | undefined): void { void result?.catch(error => this.report(errorMessage(error), true)); }
  bindAvatar(avatar: AvatarPort): () => void {
    this.avatar = avatar;
    const cameraChanged = (): void => this.update({ camera: { ...avatar.camera } });
    const failed = (event: Event): void => this.report((event as CustomEvent<{ message: string }>).detail.message, true);
    avatar.addEventListener('sidekick-camera-change', cameraChanged);
    avatar.addEventListener('sidekick-error', failed);
    if (!this.initialized.has(avatar)) {
      avatar.design = this.state.design;
      this.initialized.add(avatar);
      if (!this.state.recovery) this.persist();
    }
    cameraChanged();
    return () => {
      avatar.removeEventListener('sidekick-camera-change', cameraChanged);
      avatar.removeEventListener('sidekick-error', failed);
      if (this.avatar === avatar) this.avatar = undefined;
    };
  }
  private persist(message = '디자인이 이 브라우저에 저장되었습니다.'): void {
    try {
      if (!this.storage) throw new Error('Storage unavailable');
      // Never overwrite the only copy of invalid data. The recovery write must succeed first.
      if (this.state.recovery) this.storage.setItem(`${this.state.recovery.key}.recovery`, this.state.recovery.raw);
      this.storage.setItem(STORAGE_KEY, serializeDesign(this.state.design));
      if (this.state.recovery) this.update({ recoverySaved: true });
      this.report(message);
    } catch {
      this.report(this.state.recovery ? '저장 원본을 보호하기 위해 자동 저장하지 않았습니다. 수정한 디자인은 JSON으로 내보내세요.' : '브라우저 저장소를 사용할 수 없습니다. JSON으로 내보내세요.', true);
    }
  }
  private commit(design: AvatarDesign, message?: string): void {
    this.update({ design, jsonDraft: serializeDesign(design), jsonError: '' });
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
  setDuration = (duration: number): void => this.update({ duration });
  setEasing = (easing: 'smooth' | 'linear'): void => this.update({ easing });
  setBackground = (background: StudioState['background']): void => this.update({ background });
  setEquipment = (slot: AccessorySlot, preset: AccessoryPreset | ''): void => {
    if (!preset) { this.patch({ accessories: this.state.design.accessories.filter(item => item.slot !== slot) }); return; }
    const current = this.state.design.accessories.find(item => item.slot === slot);
    if (current?.preset === preset) return;
    const base = preset === 'earring' ? `${slot === 'leftEar' ? 'left' : 'right'}-earring` : preset === 'beret' ? 'hat' : preset === 'bowTie' ? 'bow-tie' : preset;
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
    this.commit(next);
  };
  setWeight = (side: 'left' | 'right', key: 'smile' | 'blink', weight: number): void => {
    const next = patchDesign(this.state.design, { eyes: { [side]: { weights: { [key]: weight } } } });
    this.watch(this.avatar?.setEyeWeights(side, { [key]: weight }, { duration: 0 }));
    this.commit(next);
  };
  setCamera = (patch: Partial<CameraAngles>): void => { this.avatar?.setCamera(patch); if (this.avatar) this.update({ camera: { ...this.avatar.camera } }); };
  setCameraPreset = (preset: CameraPreset): void => { this.avatar?.setCameraPreset(preset); if (this.avatar) this.update({ camera: { ...this.avatar.camera } }); };
  resetCamera = (): void => { this.avatar?.resetCamera(); if (this.avatar) this.update({ camera: { ...this.avatar.camera } }); };
  setActivity = (activity: Activity): void => { this.avatar?.setActivity(activity); this.update({ activity }); };
  togglePause = (): void => { const paused = !this.state.paused; if (this.avatar) this.avatar.paused = paused; this.update({ paused }); };
  look = (x: number): void => this.avatar?.lookAt({ space: 'view', x, y: 0 });
  toggleFace = (): void => { const movedFace = !this.state.movedFace; this.watch(this.avatar?.motion.to({ face: { uv: movedFace ? [0.23, 0.13] : [0, 0] } }, { duration: 650 })); this.update({ movedFace }); };
  editJSON = (jsonDraft: string): void => this.update({ jsonDraft });
  importJSON = (): boolean => {
    try {
      const migrated = migrateDesign(this.state.jsonDraft);
      if (this.avatar) { this.avatar.design = migrated.design; this.watch(this.avatar.setShape(migrated.design.body.shape, { duration: 0 })); }
      this.update({ warnings: migrated.warnings });
      this.commit(migrated.design, 'JSON 디자인을 적용했습니다.');
      return true;
    } catch (error) { this.update({ jsonError: errorMessage(error) }); return false; }
  };
  reset = (): void => {
    const avatar = this.avatar;
    if (avatar) {
      avatar.paused = false; avatar.motion.cancel();
      this.watch(avatar.motion.to({ body: { rotation: [0, 0, 0] }, face: { uv: [0, 0] }, eyes: { openness: 1, left: { weights: { smile: 0, blink: 0 } }, right: { weights: { smile: 0, blink: 0 } } } }, { duration: 0 }));
      avatar.lookAt({ space: 'view', x: 0, y: 0 }); avatar.resetCamera(); avatar.seek(0); avatar.setActivity('idle');
      avatar.design = defaultStudioDesign(); this.watch(avatar.setShape('square', { duration: 0 }));
    }
    this.update({ duration: 450, easing: 'smooth', paused: false, activity: 'idle', movedFace: false, warnings: [], camera: { ...CAMERA_PRESETS.front } });
    this.commit(defaultStudioDesign(), '기본 디자인으로 초기화했습니다.');
  };
  exportJSON = (): string => serializeDesign(parseDesign(this.state.design));
  snapshot = (): Promise<Blob> => this.avatar ? this.avatar.snapshot() : Promise.reject(new Error('미리보기가 아직 준비되지 않았습니다.'));
}
