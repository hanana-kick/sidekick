import { studioText } from './studio-locales.js';
import { createAccessory, createDesign, migrateDesign } from '../src/core/design.js';
import { createScene, parseScene } from '../src/core/scene.js';
import type { SidekickScene } from '../src/core/scene.js';
import type { SidekickAvatar } from '../src/element/avatar.js';

/** Studio alone writes this scene. Playground commands are intentionally temporary. */
export const STUDIO_SESSION_KEY = 'sidekick.studio.scene.v3';
export const STUDIO_DESIGN_KEY = 'sidekick.design.v7';
export const defaultStudioDesign = () => createDesign({ body: { shape: 'square' }, accessories: [createAccessory('beret', 'hat')] });
export interface SessionStorage { getItem(key: string): string | null }
export interface StudioSession {
  scene: SidekickScene;
  source: 'saved' | 'default' | 'invalid' | 'unavailable';
  message: string;
  invalid?: { raw: string; key: string; error: string };
}
export function loadStudioSession(storage?: SessionStorage): StudioSession {
  const fallback = createScene({ design: defaultStudioDesign(), interaction: 'box' });
  if (!storage) return { scene: fallback, source: 'unavailable', get message() { return studioText('브라우저 저장소를 사용할 수 없어 기본 봇을 표시합니다.'); } };
  let raw: string | null = null, key = STUDIO_SESSION_KEY;
  try {
    raw = storage.getItem(key);
    if (raw !== null) return { scene: parseScene(raw), source: 'saved', get message() { return studioText('Studio에서 설정한 봇입니다. 여기서 실행한 명령은 Studio 설정을 바꾸지 않습니다.'); } };
    key = STUDIO_DESIGN_KEY; raw = storage.getItem(key);
    if (raw !== null) return { scene: createScene({ design: migrateDesign(raw).design, interaction: 'box' }), source: 'saved', get message() { return studioText('Studio에서 저장한 디자인입니다. 여기서 실행한 명령은 Studio 설정을 바꾸지 않습니다.'); } };
    return { scene: fallback, source: 'default', get message() { return studioText('아직 저장된 Studio 설정이 없어 기본 봇을 표시합니다.'); } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return raw === null
      ? { scene: fallback, source: 'unavailable', get message() { return studioText('브라우저 저장소를 읽을 수 없어 기본 봇을 표시합니다.'); } }
      : { scene: fallback, source: 'invalid', get message() { return studioText('저장된 Studio 설정을 읽을 수 없어 기본 봇을 표시합니다. 원본은 보존됩니다. Studio의 JSON 탭에서 수정하세요.'); }, invalid: { raw, key, error: message } };
  }
}
export type SessionAvatar = Pick<SidekickAvatar, 'design' | 'trackingMode' | 'paused' | 'resetTracking' | 'motion' | 'setBodyOrientation' | 'zoom' | 'lookAt' | 'seek' | 'setActivity' | 'interaction'>;
/** Applies appearance and scene only, leaving page placement and movement ownership alone. */
export function applyStudioSession(avatar: SessionAvatar, input: SidekickScene): Promise<unknown> {
  const scene = parseScene(input);
  avatar.trackingMode = 'off'; avatar.paused = true; avatar.resetTracking(); avatar.motion.cancel();
  avatar.design = scene.design;
  void avatar.motion.to({ body: { rotation: [0, 0, 0] }, face: { uv: [0, 0] },
    eyes: { openness: 1, left: { weights: scene.design.eyes.left.weights }, right: { weights: scene.design.eyes.right.weights } },
    accessories: Object.fromEntries(scene.design.accessories.map(item => [item.id, { rotation: [0, 0, 0] as [number, number, number] }])) }, { duration: 0 });
  const motion = avatar.motion.to(scene.motion, { duration: 0 });
  avatar.setBodyOrientation(scene.bodyOrientation); avatar.zoom = scene.zoom;
  avatar.lookAt({ space: 'view', ...scene.gaze }); avatar.seek(scene.time); avatar.setActivity(scene.activity);
  avatar.interaction = scene.interaction; avatar.paused = scene.paused; avatar.trackingMode = scene.trackingMode;
  return motion;
}
