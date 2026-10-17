/** Avatar value types. An `AvatarItem` is plain JSON so it can be stored or sent over the wire. */

import type { NumericPalette } from './palette.js';

export type AvatarMode = '2d' | '3d';

export type BodyShapeKind =
  | 'blob'
  | 'capsule'
  | 'rounded-box'
  | 'disc'
  | 'hexagon'
  | 'diamond'
  | 'star'
  | 'teardrop'
  // Custom kinds registered through `defineBodyShape()` stay assignable.
  | (string & {});

export type EyeKind =
  'dot' | 'oval' | 'happy' | 'sleepy' | 'star' | 'spiral' | 'cyclops' | 'goggle' | (string & {});

export type MouthKind = 'smile' | 'flat' | 'open' | 'cat' | 'grin' | 'dot' | (string & {});

export type AccessoryKind =
  | 'antenna'
  | 'headphones'
  | 'cap'
  | 'beanie'
  | 'visor'
  | 'glasses'
  | 'bowtie'
  | 'propeller'
  | 'crown'
  | 'horns'
  | 'ears'
  | 'scarf'
  | 'badge'
  | 'halo'
  | (string & {});

/** Where an accessory attaches relative to the body. */
export type AccessorySlot = 'top' | 'back' | 'front' | 'face' | 'neck' | 'side-left' | 'side-right';

export interface Palette {
  hue: number;
  saturation: number;
  lightness: number;
  /** Resolved css colors, all derived from the three components above. */
  base: string;
  light: string;
  dark: string;
  accent: string;
  outline: string;
  eye: string;
  cheek: string;
  background: string;
}

export interface BodySpec {
  shape: BodyShapeKind;
  /** Relative to the drawing box (1 = fills it). */
  scale: number;
  /** width / height. */
  aspect: number;
  /** Corner roundness 0..1 for box-like shapes. */
  radius: number;
  /** Polygon resolution for star/hexagon shapes. */
  segments: number;
  /** Primitive the 3D renderer substitutes for this silhouette. */
  mesh3d?: Primitive3D['kind'];
}

export interface EyeSpec {
  kind: EyeKind;
  /** Distance between eye centres, in body-width units. */
  spacing: number;
  size: number;
  /** Vertical offset from the body centre, negative is up. */
  y: number;
  color: string;
  highlight: boolean;
  /** Phase offset so a pair does not blink in perfect lockstep when `0` is not used. */
  blinkPhase: number;
  independentBlink: boolean;
}

export interface MouthSpec {
  kind: MouthKind;
  width: number;
  y: number;
  color: string;
}

export interface AccessorySpec {
  kind: AccessoryKind;
  slot: AccessorySlot;
  color: string;
  /** `color` resolved to 0..1 rgb for WebGL. Derived, never authored. */
  colorNumeric?: [number, number, number];
  scale: number;
  /** Extra rotation in radians. */
  angle: number;
}

/** Tunables that make motion look alive rather than linear. */
export interface RigSpec {
  breathRate: number;
  breathDepth: number;
  bobRate: number;
  bobDepth: number;
  swayRate: number;
  swayDepth: number;
  /** Average seconds between blinks. */
  blinkInterval: number;
  blinkDuration: number;
  /** Spring stiffness (higher = snappier). */
  tension: number;
  /** Spring damping (2 * sqrt(tension) = critically damped). */
  damping: number;
  /** Radians of idle yaw drift, 3D only. */
  yawDrift: number;
  /** Radians of idle roll. */
  roll: number;
}

export interface AvatarFeatures {
  blush: boolean;
  shine: boolean;
  seam: boolean;
  spots: number;
  outline: boolean;
}

export interface AvatarItem {
  version: 1;
  /** Original string the item was generated from. */
  seed: string;
  /** Stable hex derived from `seed`. */
  hash: string;
  mode: AvatarMode;
  palette: Palette;
  /** `palette` resolved to 0..1 rgb for WebGL. Derived, never authored. */
  paletteNumeric: NumericPalette;
  body: BodySpec;
  eyes: EyeSpec[];
  mouth: MouthSpec;
  accessories: AccessorySpec[];
  rig: RigSpec;
  features: AvatarFeatures;
  meta?: Record<string, unknown>;
}

export type ChannelName =
  | 'breath'
  | 'bob'
  | 'sway'
  | 'tilt'
  | 'lid'
  | 'pupilX'
  | 'pupilY'
  | 'mouthOpen'
  | 'mouthWidth'
  | 'smile'
  | 'brow'
  | 'swing'
  | 'glow'
  | 'yaw'
  | 'roll'
  | 'scale';

export type Channels = Record<ChannelName, number>;

/** Default rest values. */
export const REST_CHANNELS: Channels = {
  breath: 0,
  bob: 0,
  sway: 0,
  tilt: 0,
  lid: 0,
  pupilX: 0,
  pupilY: 0,
  mouthOpen: 0,
  mouthWidth: 1,
  smile: 0.35,
  brow: 0,
  swing: 0,
  glow: 0,
  yaw: 0,
  roll: 0,
  scale: 1,
};

export const CHANNEL_NAMES = Object.keys(REST_CHANNELS) as ChannelName[];

/** A drawing primitive used by both renderers; the 3D renderer maps these to meshes. */
export type Vec3Tuple = [number, number, number];

/** One drawable primitive in character-local space (body radius = 1). */
export interface Primitive3D {
  kind: 'sphere' | 'box' | 'capsule' | 'cylinder' | 'cone' | 'torus' | 'disc';
  position: Vec3Tuple;
  rotation: Vec3Tuple;
  scale: Vec3Tuple;
  /** Linear 0..1 RGB — the 3D pipeline never parses CSS strings. */
  color: Vec3Tuple;
  emissive?: Vec3Tuple;
  opacity?: number;
  /** Tessellation hint for the mesh cache. */
  segments?: number;
}

export interface AvatarRendererOptions {
  canvas: HTMLCanvasElement;
  size: number;
  dpr?: number;
  antialias?: boolean;
  alpha?: boolean;
  reducedMotion?: boolean;
}

export interface AvatarRenderer {
  readonly mode: AvatarMode;
  /** Logical (CSS-pixel) size of the last resize. */
  readonly width: number;
  readonly height: number;
  /** Draws one frame. `channels` are read-only to the renderer. */
  render(item: AvatarItem, channels: Channels, time: number): void;
  resize(width: number, height: number, dpr: number): void;
  destroy(): void;
}
