/** Avatar engine: shape generation, rig, animation and the canvas renderers. */

export type {
  AccessoryKind,
  AccessorySlot,
  AccessorySpec,
  AvatarFeatures,
  AvatarItem,
  AvatarMode,
  AvatarRenderer,
  AvatarRendererOptions,
  BodyShapeKind,
  BodySpec,
  ChannelName,
  Channels,
  EyeKind,
  EyeSpec,
  MouthKind,
  MouthSpec,
  Palette,
  Primitive3D,
  RigSpec,
} from './avatar/types.js';
export { CHANNEL_NAMES, REST_CHANNELS } from './avatar/types.js';

export {
  avatarFromHash,
  createAvatar,
  deserializeAvatar,
  isAvatarItem,
  normalizeAvatarItem,
  randomAvatar,
  serializeAvatar,
  type AvatarFromHashOptions,
  type CreateAvatarInput,
} from './avatar/generator.js';

export {
  defineAccessory,
  defineBodyShape,
  defineEye,
  defineMouth,
  getAccessoryDef,
  getBodyShape,
  getEyeDef,
  getMouthDef,
  isAccessoryKind,
  isBodyShape,
  isEyeKind,
  isMouthKind,
  listAccessories,
  listBodyShapes,
  listEyes,
  listMouths,
  customAccessoryDrawer,
  customBodyDrawer,
  customEyeDrawer,
  customAccessoryBuilder,
  type AccessoryDef,
  type BodyShapeDef,
  type DrawBox,
  type EyeDef,
  type MouthDef,
} from './avatar/catalog.js';

export {
  createPalette,
  parseColor,
  toNumericPalette,
  type HarmonyScheme,
  type NumericPalette,
} from './avatar/palette.js';
export {
  createRandom,
  hashString,
  hashStringWide,
  randomSeed,
  smoothNoise,
  type Random,
} from './avatar/random.js';
export { AvatarAnimator, type AnimatorOptions } from './avatar/rig/animator.js';
export { poseFor, moodAdjust, POSES, type Pose } from './avatar/rig/channels.js';
export { AvatarEngine, createAvatarEngine, type AvatarEngineOptions } from './avatar/engine.js';
export { Canvas2DRenderer } from './avatar/render/canvas2d.js';
export { WebGL3DRenderer, type WebGL3DOptions } from './avatar/render/webgl/renderer3d.js';
export { buildParts } from './avatar/render/webgl/parts.js';
