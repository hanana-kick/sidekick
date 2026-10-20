/** Run: node --import tsx scripts/benchmark-canvas-renderer.mts
 * CPU-only benchmark: includes scene geometry, rasterization and ImageData copy;
 * excludes browser compositing/putImageData cost. No hardware performance promise.
 */
import { AvatarRenderer } from '../src/renderer/webgl.js';
import type { RenderState } from '../src/renderer/webgl.js';
import { createDesign, createAccessory } from '../src/core/design.js';
import type { Activity } from '../src/core/design.js';
import { initialPose } from '../src/core/motion.js';
const equipment = [createAccessory('beret'), createAccessory('glasses'), createAccessory('moustache'), createAccessory('scarf'), createAccessory('earring', { slot: 'leftEar', id: 'left' }), createAccessory('starEarring', { slot: 'rightEar', id: 'right' })];
const activities: Activity[] = ['still', 'idle', 'speaking', 'celebrating'];
const measurements: object[] = [];
for (const equipped of [false, true]) for (const activity of activities) for (const size of [128, 192, 256, 384]) {
  const context = {
    createImageData: (width: number, height: number) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
    putImageData: () => {},
  };
  const canvas = { width: size, height: size, getContext: (kind: string) => kind === '2d' ? context : null } as unknown as HTMLCanvasElement;
  const renderer = new AvatarRenderer(canvas);
  const design = createDesign({ body: { shape: 'puffy' }, accessories: equipped ? equipment : [] });
  const state: RenderState = { pose: initialPose(), time: 0, delta: 1 / 60, activity, reduced: false, style: 'flat' };
  renderer.resize(size, size, 1);
  for (let i = 0; i < 10; i++) { state.time = i / 60; renderer.render(design, state); }
  const start = performance.now();
  for (let i = 0; i < 60; i++) { state.time = (i + 10) / 60; renderer.render(design, state); }
  measurements.push({ equipped, activity, size, averageCpuMs: Number(((performance.now() - start) / 60).toFixed(3)) });
  renderer.dispose();
}
console.log(JSON.stringify({ node: process.version, platform: process.platform, frames: 60, warmupFrames: 10, shape: 'puffy', dpr: 1, excludesBrowserPresentation: true, measurements }, null, 2));
