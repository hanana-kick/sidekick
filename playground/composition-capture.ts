import type { SidekickAvatar } from '../src/element/avatar.js';
import type { SidekickScene } from '../src/core/scene.js';
import { StudioController } from './studio-controller';
/** A short-lived, independent native renderer. Never stretches the active preview bitmap. */
export async function captureCompositionAvatar(scene: SidekickScene, size = 2048): Promise<Blob> {
  const avatar = document.createElement('sidekick-avatar') as SidekickAvatar;
  avatar.style.cssText = `position:fixed;left:-10000px;top:0;width:${size}px;height:${size}px;opacity:0;pointer-events:none;`;
  avatar.setAttribute('aria-hidden', 'true'); avatar.setAttribute('paused', ''); avatar.setAttribute('tracking-mode', 'off');
  let cleanup: (() => void) | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      const dispose = (): void => { clearTimeout(timeout); avatar.removeEventListener('sidekick-ready', ready); avatar.removeEventListener('sidekick-error', error); };
      const ready = (): void => { dispose(); resolve(); };
      const error = (event: Event): void => { dispose(); reject(new Error((event as CustomEvent<{message:string}>).detail?.message ?? '장면 렌더러 초기화 실패')); };
      const timeout = setTimeout(() => { dispose(); reject(new Error('장면 렌더러 준비 시간이 초과되었습니다.')); }, 15000);
      avatar.addEventListener('sidekick-ready', ready); avatar.addEventListener('sidekick-error', error); document.body.append(avatar);
    });
    const renderer = new StudioController(); cleanup = renderer.bindAvatar(avatar);
    // Capture the selected scene at its saved time, without live pointer or random advancing motion.
    if (!renderer.importJSON(JSON.stringify({ ...scene, paused: true, trackingMode: 'off', interaction: 'none' }))) throw new Error(renderer.getSnapshot().jsonError);
    return await avatar.snapshot();
  } finally { cleanup?.(); avatar.remove(); }
}
