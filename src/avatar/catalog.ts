import type {
  AccessoryKind,
  AccessorySlot,
  AccessorySpec,
  AvatarItem,
  BodyShapeKind,
  BodySpec,
  Channels,
  EyeKind,
  EyeSpec,
  MouthKind,
  Primitive3D,
} from './types.js';

/** Geometry box the 2D drawers work in: origin is the body centre, `radius` = half size. */
export interface DrawBox {
  cx: number;
  cy: number;
  radius: number;
  size: number;
}

export interface AccessoryDraw2DArgs {
  ctx: CanvasRenderingContext2D;
  spec: AccessorySpec;
  box: DrawBox;
  channels: Channels;
  item: AvatarItem;
}

export type AccessoryDraw2D = (args: AccessoryDraw2DArgs) => void;
export type AccessoryBuild3D = (spec: AccessorySpec, item: AvatarItem) => Primitive3D[];
export type BodyDraw2D = (
  ctx: CanvasRenderingContext2D,
  body: BodySpec,
  box: DrawBox,
  channels: Channels,
) => void;
export type EyeDraw2D = (
  ctx: CanvasRenderingContext2D,
  eye: EyeSpec,
  box: DrawBox,
  channels: Channels,
  x: number,
) => void;

export interface BodyShapeDef {
  kind: BodyShapeKind;
  /** Primitive the 3D renderer substitutes for this silhouette. */
  mesh3d: Primitive3D['kind'];
  weight: number;
}

export interface EyeDef {
  kind: EyeKind;
  defaultSize: number;
  /** Eyes that are already "closed" shapes do not need a lid animation. */
  blinkable: boolean;
  count: 1 | 2;
  weight: number;
}

export interface MouthDef {
  kind: MouthKind;
  weight: number;
}

export interface AccessoryDef {
  kind: AccessoryKind;
  slots: AccessorySlot[];
  weight: number;
}

const BODY_SHAPES = new Map<BodyShapeKind, BodyShapeDef>();
const EYES = new Map<EyeKind, EyeDef>();
const MOUTHS = new Map<MouthKind, MouthDef>();
const ACCESSORIES = new Map<AccessoryKind, AccessoryDef>();

/** Extension points for user-provided art. */
const CUSTOM_BODY_2D = new Map<string, BodyDraw2D>();
const CUSTOM_EYE_2D = new Map<string, EyeDraw2D>();
const CUSTOM_ACCESSORY_2D = new Map<AccessoryKind, AccessoryDraw2D>();
const CUSTOM_ACCESSORY_3D = new Map<AccessoryKind, AccessoryBuild3D>();

export function defineBodyShape(def: BodyShapeDef, draw2d?: BodyDraw2D): void {
  BODY_SHAPES.set(def.kind, def);
  if (draw2d) CUSTOM_BODY_2D.set(def.kind, draw2d);
}

export function defineEye(def: EyeDef, draw2d?: EyeDraw2D): void {
  EYES.set(def.kind, def);
  if (draw2d) CUSTOM_EYE_2D.set(def.kind, draw2d);
}

export function defineMouth(def: MouthDef): void {
  MOUTHS.set(def.kind, def);
}

export function defineAccessory(
  def: AccessoryDef,
  impl: { draw2d?: AccessoryDraw2D; build3d?: AccessoryBuild3D } = {},
): void {
  ACCESSORIES.set(def.kind, def);
  if (impl.draw2d) CUSTOM_ACCESSORY_2D.set(def.kind, impl.draw2d);
  if (impl.build3d) CUSTOM_ACCESSORY_3D.set(def.kind, impl.build3d);
}

export const isBodyShape = (v: unknown): v is BodyShapeKind =>
  typeof v === 'string' && BODY_SHAPES.has(v as BodyShapeKind);
export const isEyeKind = (v: unknown): v is EyeKind => typeof v === 'string' && EYES.has(v as EyeKind);
export const isMouthKind = (v: unknown): v is MouthKind =>
  typeof v === 'string' && MOUTHS.has(v as MouthKind);
export const isAccessoryKind = (v: unknown): v is AccessoryKind =>
  typeof v === 'string' && ACCESSORIES.has(v as AccessoryKind);

export const getBodyShape = (kind: BodyShapeKind): BodyShapeDef | undefined => BODY_SHAPES.get(kind);
export const getEyeDef = (kind: EyeKind): EyeDef | undefined => EYES.get(kind);
export const getMouthDef = (kind: MouthKind): MouthDef | undefined => MOUTHS.get(kind);
export const getAccessoryDef = (kind: AccessoryKind): AccessoryDef | undefined => ACCESSORIES.get(kind);

export const listBodyShapes = (): BodyShapeDef[] => [...BODY_SHAPES.values()];
export const listEyes = (): EyeDef[] => [...EYES.values()];
export const listMouths = (): MouthDef[] => [...MOUTHS.values()];
export const listAccessories = (): AccessoryDef[] => [...ACCESSORIES.values()];

export const customBodyDrawer = (kind: string): BodyDraw2D | undefined => CUSTOM_BODY_2D.get(kind);
export const customEyeDrawer = (kind: string): EyeDraw2D | undefined => CUSTOM_EYE_2D.get(kind);
export const customAccessoryDrawer = (kind: string): AccessoryDraw2D | undefined =>
  CUSTOM_ACCESSORY_2D.get(kind as AccessoryKind);
export const customAccessoryBuilder = (kind: string): AccessoryBuild3D | undefined =>
  CUSTOM_ACCESSORY_3D.get(kind as AccessoryKind);

/** Weighted pools used by the hash generator. */
export const bodyShapePool = (): { value: BodyShapeKind; weight: number }[] =>
  listBodyShapes().map((d) => ({ value: d.kind, weight: d.weight }));
export const eyePool = (): { value: EyeKind; weight: number }[] =>
  listEyes().map((d) => ({ value: d.kind, weight: d.weight }));
export const mouthPool = (): { value: MouthKind; weight: number }[] =>
  listMouths().map((d) => ({ value: d.kind, weight: d.weight }));
export const accessoryPool = (): { value: AccessoryKind; weight: number }[] =>
  listAccessories().map((d) => ({ value: d.kind, weight: d.weight }));

// ---------------------------------------------------------------------------
// Built-in catalogue
// ---------------------------------------------------------------------------

for (const def of [
  { kind: 'blob', mesh3d: 'sphere', weight: 10 },
  { kind: 'capsule', mesh3d: 'capsule', weight: 8 },
  { kind: 'rounded-box', mesh3d: 'box', weight: 9 },
  { kind: 'disc', mesh3d: 'disc', weight: 6 },
  { kind: 'hexagon', mesh3d: 'cylinder', weight: 5 },
  { kind: 'diamond', mesh3d: 'cone', weight: 4 },
  { kind: 'star', mesh3d: 'sphere', weight: 3 },
  { kind: 'teardrop', mesh3d: 'sphere', weight: 4 },
] satisfies BodyShapeDef[]) {
  defineBodyShape(def);
}

for (const def of [
  { kind: 'dot', defaultSize: 0.14, blinkable: true, count: 2, weight: 12 },
  { kind: 'oval', defaultSize: 0.17, blinkable: true, count: 2, weight: 10 },
  { kind: 'happy', defaultSize: 0.16, blinkable: false, count: 2, weight: 7 },
  { kind: 'sleepy', defaultSize: 0.15, blinkable: false, count: 2, weight: 5 },
  { kind: 'star', defaultSize: 0.18, blinkable: true, count: 2, weight: 3 },
  { kind: 'spiral', defaultSize: 0.16, blinkable: true, count: 2, weight: 2 },
  { kind: 'cyclops', defaultSize: 0.3, blinkable: true, count: 1, weight: 4 },
  { kind: 'goggle', defaultSize: 0.2, blinkable: true, count: 2, weight: 5 },
] satisfies EyeDef[]) {
  defineEye(def);
}

for (const def of [
  { kind: 'smile', weight: 12 },
  { kind: 'flat', weight: 5 },
  { kind: 'open', weight: 8 },
  { kind: 'cat', weight: 5 },
  { kind: 'grin', weight: 4 },
  { kind: 'dot', weight: 3 },
] satisfies MouthDef[]) {
  defineMouth(def);
}

for (const def of [
  { kind: 'antenna', slots: ['top'], weight: 9 },
  { kind: 'headphones', slots: ['side-left', 'side-right', 'top'], weight: 7 },
  { kind: 'cap', slots: ['top'], weight: 8 },
  { kind: 'beanie', slots: ['top'], weight: 5 },
  { kind: 'visor', slots: ['face'], weight: 4 },
  { kind: 'glasses', slots: ['face'], weight: 6 },
  { kind: 'bowtie', slots: ['neck'], weight: 4 },
  { kind: 'propeller', slots: ['top'], weight: 3 },
  { kind: 'crown', slots: ['top'], weight: 3 },
  { kind: 'horns', slots: ['top'], weight: 5 },
  { kind: 'ears', slots: ['top'], weight: 6 },
  { kind: 'scarf', slots: ['neck'], weight: 4 },
  { kind: 'badge', slots: ['side-left'], weight: 4 },
  { kind: 'halo', slots: ['top'], weight: 2 },
] satisfies AccessoryDef[]) {
  defineAccessory(def);
}

/** Only one head-worn item at a time — the generator uses this to avoid stacking hats. */
export const HEAD_SLOTS: readonly AccessorySlot[] = ['top'];
