/** Internal renderer descriptors. Never exported by the package's public entry points. */
import type { AccessoryDesign, AvatarDesign, BodyDesign, Vec2, Vec3 } from './design.js';
import type { EyeState } from './expressions.js';
export type Region = 'face' | 'crown' | 'left' | 'right';
export interface Anchor { region: Region; uv: Vec2; offset: number }
export interface EyeShapeTargets { smile: { radius: number; thickness: number }; blink: { thickness: number } }
export interface ResolvedEyeState extends EyeState { targets: EyeShapeTargets }
export interface ResolvedEyeDesign {
  shape: 'capsule'; width: number; height: number; left: ResolvedEyeState; right: ResolvedEyeState;
  anchor: Anchor; spacing: number; scale: number; color: string;
}
export interface ResolvedAccessoryDesign extends AccessoryDesign { anchor: Anchor; scale: number; rotation: Vec3; follow: number }
export interface ResolvedAvatarDesign { version: 7; body: BodyDesign; eyes: ResolvedEyeDesign; accessories: ResolvedAccessoryDesign[] }
const targets = (): EyeShapeTargets => ({ smile: { radius: 0.75, thickness: 0.22 }, blink: { thickness: 0.16 } });
/** New descriptors on every resolution; caller-owned designs never gain hidden geometry. */
export function resolveDesign(design: AvatarDesign): ResolvedAvatarDesign {
  return {
    version: 7,
    body: { ...design.body },
    eyes: {
      shape: 'capsule', width: 0.16, height: 0.34, anchor: { region: 'face', uv: [0, 0.1], offset: 0 }, spacing: 0.64, scale: 1, color: design.eyes.color,
      left: { weights: { ...design.eyes.left.weights }, targets: targets() },
      right: { weights: { ...design.eyes.right.weights }, targets: targets() },
    },
    accessories: design.accessories.map(accessory => {
      let anchor: Anchor, follow: number;
      if ((accessory.preset === 'earring' || accessory.preset === 'starEarring')) {
        anchor = { region: accessory.slot === 'leftEar' ? 'left' : 'right', uv: [0, -0.15], offset: 0 }; follow = 0.35;
      } else if ((accessory.preset === 'moustache' || accessory.preset === 'goatee')) {
        anchor = { region: 'face', uv: [0, -0.23], offset: 0 }; follow = 0;
      } else if (accessory.preset === 'bowTie' || accessory.preset === 'scarf' || accessory.preset === 'necklace') {
        anchor = { region: 'face', uv: [0, -0.55], offset: 0 }; follow = 0.15;
      } else {
        anchor = { region: (accessory.preset === 'glasses' || accessory.preset === 'sunglasses') ? 'face' : 'crown', uv: [0, (accessory.preset === 'glasses' || accessory.preset === 'sunglasses') ? 0.1 : 0], offset: accessory.preset === 'halo' ? 0.22 : (accessory.preset === 'glasses' || accessory.preset === 'sunglasses') ? 0 : 0.035 };
        follow = (accessory.preset === 'glasses' || accessory.preset === 'sunglasses') ? 0 : 0.5;
      }
      return { ...accessory, anchor, scale: 1, rotation: [0, 0, 0], follow };
    }),
  };
}
