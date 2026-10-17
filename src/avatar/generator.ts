import {
  accessoryPool,
  bodyShapePool,
  eyePool,
  getAccessoryDef,
  getBodyShape,
  getEyeDef,
  isAccessoryKind,
  isBodyShape,
  isEyeKind,
  isMouthKind,
  listAccessories,
  mouthPool,
} from './catalog.js';
import { createPalette, parseColor, toNumericPalette, type HarmonyScheme } from './palette.js';
import { createRandom, hashStringWide, randomSeed } from './random.js';
import type {
  AccessoryKind,
  AccessorySpec,
  AvatarFeatures,
  AvatarItem,
  AvatarMode,
  BodyShapeKind,
  BodySpec,
  EyeKind,
  EyeSpec,
  MouthKind,
  MouthSpec,
  Palette,
  RigSpec,
} from './types.js';

export const DEFAULT_RIG: RigSpec = {
  breathRate: 0.24,
  breathDepth: 0.035,
  bobRate: 0.42,
  bobDepth: 0.07,
  swayRate: 0.17,
  swayDepth: 0.05,
  blinkInterval: 3.8,
  blinkDuration: 0.17,
  tension: 190,
  damping: 21,
  yawDrift: 0.2,
  roll: 0.035,
};

const DEFAULT_BODY: BodySpec = {
  shape: 'blob',
  scale: 0.9,
  aspect: 1,
  radius: 0.34,
  segments: 5,
};

const DEFAULT_MOUTH: MouthSpec = { kind: 'smile', width: 0.3, y: 0.26, color: '' };

const clamp = (v: number, min: number, max: number): number => (v < min ? min : v > max ? max : v);
const num = (v: number | undefined, fallback: number): number =>
  Number.isFinite(v) ? (v as number) : fallback;

const ACCENT_ACCESSORY_COLORS = ['#f7c948', '#ef5b5b', '#4cc9f0', '#f4f5f7', '#2f3437', '#9b5de5'] as const;

function resolveEye(kind: EyeKind, overrides: Partial<EyeSpec>, palette: Palette, seed: string): EyeSpec {
  const def = getEyeDef(kind);
  const rng = createRandom(`${seed}:eye:${kind}`);
  return {
    kind,
    spacing: clamp(num(overrides.spacing, 0.34), 0.16, 0.6),
    size: clamp(num(overrides.size, def?.defaultSize ?? 0.15), 0.04, 0.45),
    y: clamp(num(overrides.y, -0.06), -0.5, 0.5),
    color: overrides.color || palette.eye,
    highlight: overrides.highlight ?? true,
    blinkPhase: overrides.blinkPhase ?? rng.range(0, 0.35),
    independentBlink: overrides.independentBlink ?? false,
  };
}

function resolveAccessory(
  kind: AccessoryKind,
  overrides: Partial<AccessorySpec>,
  palette: Palette,
  index: number,
  seed: string,
): AccessorySpec {
  const def = getAccessoryDef(kind);
  const rng = createRandom(`${seed}:acc:${kind}:${index}`);
  const slot =
    overrides.slot && def?.slots.includes(overrides.slot) ? overrides.slot : (def?.slots[0] ?? 'top');
  const neutral = slot === 'neck' || slot === 'face';
  const color =
    overrides.color ||
    (neutral
      ? palette.accent
      : ACCENT_ACCESSORY_COLORS[Math.floor(rng.next() * ACCENT_ACCESSORY_COLORS.length)]);
  return {
    kind,
    slot,
    color,
    colorNumeric: parseColor(color),
    scale: clamp(num(overrides.scale, 1), 0.4, 2),
    angle: num(overrides.angle, rng.range(-0.06, 0.06)),
  };
}

export interface CreateAvatarInput {
  seed?: string;
  mode?: AvatarMode;
  /** Simple shape name, or a partial body spec. */
  shape?: BodyShapeKind | Partial<BodySpec>;
  hue?: number;
  saturation?: number;
  lightness?: number;
  scheme?: HarmonyScheme;
  palette?: Palette;
  eyes?: EyeKind | Partial<EyeSpec>;
  mouth?: MouthKind | Partial<MouthSpec>;
  accessories?: readonly (AccessoryKind | Partial<AccessorySpec>)[];
  rig?: Partial<RigSpec>;
  features?: Partial<AvatarFeatures>;
  meta?: Record<string, unknown>;
}

/** Fills every field with valid defaults; unknown kinds fall back to the catalogue default. */
export function normalizeAvatarItem(input: CreateAvatarInput & { seed: string }): AvatarItem {
  const seed = input.seed;
  const hash = hashStringWide(seed);

  const shapeKind: BodyShapeKind =
    typeof input.shape === 'string'
      ? isBodyShape(input.shape)
        ? input.shape
        : DEFAULT_BODY.shape
      : isBodyShape(input.shape?.shape)
        ? input.shape.shape
        : DEFAULT_BODY.shape;
  const shapeOverride: Partial<BodySpec> = typeof input.shape === 'object' && input.shape ? input.shape : {};
  const shapeDef = getBodyShape(shapeKind);

  const palette: Palette =
    input.palette ??
    createPalette({
      hue: num(input.hue, parseInt(hash.slice(0, 4), 16) % 360),
      saturation: input.saturation,
      lightness: input.lightness,
      scheme: input.scheme,
    });

  const eyeKind: EyeKind =
    typeof input.eyes === 'string'
      ? isEyeKind(input.eyes)
        ? input.eyes
        : 'dot'
      : isEyeKind(input.eyes?.kind)
        ? (input.eyes as EyeSpec).kind
        : 'dot';
  const eyeOverrides: Partial<EyeSpec> = typeof input.eyes === 'object' && input.eyes ? input.eyes : {};
  const eyeCount = getEyeDef(eyeKind)?.count ?? 2;
  const primaryEye = resolveEye(eyeKind, eyeOverrides, palette, seed);
  const eyes: EyeSpec[] =
    eyeCount === 1
      ? [{ ...primaryEye, spacing: 0 }]
      : [
          primaryEye,
          {
            ...primaryEye,
            blinkPhase: primaryEye.independentBlink ? primaryEye.blinkPhase + 0.5 : primaryEye.blinkPhase,
          },
        ];

  const mouthKind: MouthKind =
    typeof input.mouth === 'string'
      ? isMouthKind(input.mouth)
        ? input.mouth
        : 'smile'
      : isMouthKind(input.mouth?.kind)
        ? (input.mouth as MouthSpec).kind
        : 'smile';
  const mouthOverrides: Partial<MouthSpec> =
    typeof input.mouth === 'object' && input.mouth ? input.mouth : {};
  const mouth: MouthSpec = {
    kind: mouthKind,
    width: clamp(num(mouthOverrides.width, DEFAULT_MOUTH.width), 0.08, 0.7),
    y: clamp(num(mouthOverrides.y, DEFAULT_MOUTH.y), -0.5, 0.6),
    color: mouthOverrides.color || palette.outline,
  };

  const accessories: AccessorySpec[] = [];
  const seenHead = { taken: false };
  (input.accessories ?? []).forEach((entry, index) => {
    const kind = typeof entry === 'string' ? entry : entry.kind;
    if (!kind || !isAccessoryKind(kind)) return;
    const overrides: Partial<AccessorySpec> = typeof entry === 'object' ? entry : {};
    const spec = resolveAccessory(kind, overrides, palette, index, seed);
    // Avoid two items fighting for the top of the head.
    if (spec.slot === 'top') {
      if (seenHead.taken) return;
      seenHead.taken = true;
    }
    accessories.push(spec);
  });

  return {
    version: 1,
    seed,
    hash,
    mode: input.mode === '3d' ? '3d' : '2d',
    palette,
    paletteNumeric: toNumericPalette(palette),
    body: {
      shape: shapeKind,
      scale: clamp(num(shapeOverride.scale, DEFAULT_BODY.scale), 0.4, 1.2),
      aspect: clamp(num(shapeOverride.aspect, DEFAULT_BODY.aspect), 0.5, 2),
      radius: clamp(num(shapeOverride.radius, DEFAULT_BODY.radius), 0, 0.5),
      segments: Math.max(3, Math.round(num(shapeOverride.segments, 5))),
      mesh3d: shapeOverride.mesh3d ?? shapeDef?.mesh3d ?? 'sphere',
    },
    eyes,
    mouth,
    accessories,
    rig: { ...DEFAULT_RIG, ...input.rig },
    features: {
      blush: input.features?.blush ?? false,
      shine: input.features?.shine ?? true,
      seam: input.features?.seam ?? false,
      spots: Math.max(0, Math.round(num(input.features?.spots, 0))),
      outline: input.features?.outline ?? true,
    },
    meta: input.meta,
  };
}

/** Explicit construction: `createAvatar({ shape: 'capsule', eyes: 'happy', accessories: ['antenna'] })`. */
export function createAvatar(input: CreateAvatarInput = {}): AvatarItem {
  return normalizeAvatarItem({ ...input, seed: input.seed ?? 'sidekick' });
}

export interface AvatarFromHashOptions extends Omit<
  CreateAvatarInput,
  'seed' | 'shape' | 'eyes' | 'mouth' | 'accessories'
> {
  /** Restrict the silhouettes the generator may choose from. */
  shapes?: readonly BodyShapeKind[];
  eyes?: readonly EyeKind[];
  mouths?: readonly MouthKind[];
  /** `'auto'` (default) picks 0-2, a number forces a count, an array fixes the set. */
  accessories?: 'auto' | number | readonly AccessoryKind[];
}

/**
 * Deterministic avatar generation: the same hash always yields the same item.
 * `seed` is any string (user id, room name, ...).
 */
export function avatarFromHash(seed: string, options: AvatarFromHashOptions = {}): AvatarItem {
  const source = String(seed ?? '');
  const rng = createRandom(source);
  const paletteRng = rng.fork('palette');

  const schemes: HarmonyScheme[] = ['analogous', 'complementary', 'triadic', 'mono'];
  const shape = options.shapes?.length
    ? rng.pick(options.shapes, 'blob')
    : (rng.weighted(bodyShapePool()) ?? 'blob');
  const eyeKind = options.eyes?.length ? rng.pick(options.eyes, 'dot') : (rng.weighted(eyePool()) ?? 'dot');
  const mouthKind = options.mouths?.length
    ? rng.pick(options.mouths, 'smile')
    : (rng.weighted(mouthPool()) ?? 'smile');

  const accessoryCount =
    typeof options.accessories === 'number'
      ? options.accessories
      : Array.isArray(options.accessories)
        ? options.accessories.length
        : (rng.weighted([
            { value: 0, weight: 12 },
            { value: 1, weight: 45 },
            { value: 2, weight: 33 },
            { value: 3, weight: 10 },
          ]) ?? 1);

  let accessories: AccessoryKind[];
  if (Array.isArray(options.accessories)) {
    accessories = options.accessories.filter(isAccessoryKind);
  } else {
    const restricted = Array.isArray(options.accessories)
      ? accessoryPool().filter((p) => (options.accessories as readonly AccessoryKind[]).includes(p.value))
      : accessoryPool();
    const candidates: AccessoryKind[] = (restricted.length ? restricted : listAccessories()).map((entry) =>
      'value' in entry ? entry.value : entry.kind,
    );
    const picked = rng.sample(candidates, accessoryCount);
    accessories = picked;
  }

  const tension = rng.range(140, 260);
  const rig: Partial<RigSpec> = {
    breathRate: rng.range(0.16, 0.34),
    breathDepth: rng.range(0.02, 0.055),
    bobRate: rng.range(0.3, 0.6),
    bobDepth: rng.range(0.04, 0.1),
    swayRate: rng.range(0.1, 0.26),
    swayDepth: rng.range(0.03, 0.08),
    blinkInterval: rng.range(2.4, 5.6),
    blinkDuration: rng.range(0.12, 0.22),
    tension,
    // Slightly under-damped so the avatar overshoots a little, like a real head.
    damping: 2 * Math.sqrt(tension) * rng.range(0.62, 0.92),
    yawDrift: rng.range(0.08, 0.32),
    roll: rng.range(0, 0.07),
  };

  return normalizeAvatarItem({
    seed: source,
    mode: options.mode,
    shape: {
      shape,
      scale: rng.range(0.82, 0.98),
      aspect: rng.range(0.86, 1.16),
      radius: rng.range(0.14, 0.44),
      segments: rng.int(4, 7),
    },
    hue: options.hue ?? paletteRng.int(0, 359),
    saturation: options.saturation ?? paletteRng.range(46, 78),
    lightness: options.lightness ?? paletteRng.range(54, 70),
    scheme: options.scheme ?? paletteRng.pick(schemes, 'analogous'),
    eyes: { kind: eyeKind, spacing: rng.range(0.28, 0.42), size: undefined, y: rng.range(-0.14, 0.02) },
    mouth: { kind: mouthKind, width: rng.range(0.22, 0.38), y: rng.range(0.2, 0.34) },
    accessories,
    rig: { ...rig, ...options.rig },
    features: {
      blush: rng.chance(0.4),
      shine: rng.chance(0.75),
      seam: rng.chance(0.22),
      spots: rng.chance(0.25) ? rng.int(1, 4) : 0,
      outline: rng.chance(0.7),
    },
    meta: options.meta,
  });
}

export function serializeAvatar(item: AvatarItem): string {
  return JSON.stringify(item);
}

export function isAvatarItem(value: unknown): value is AvatarItem {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Partial<AvatarItem>;
  return (
    item.version === 1 &&
    typeof item.seed === 'string' &&
    typeof item.body?.shape === 'string' &&
    Array.isArray(item.eyes) &&
    Array.isArray(item.accessories) &&
    typeof item.mouth?.kind === 'string'
  );
}

/** Rehydrates JSON, re-validating every field against the catalogue. */
export function deserializeAvatar(json: string | AvatarItem): AvatarItem {
  let parsed: unknown;
  try {
    parsed = typeof json === 'string' ? JSON.parse(json) : json;
  } catch {
    return createAvatar({ seed: 'fallback' });
  }
  if (!isAvatarItem(parsed)) return createAvatar({ seed: 'fallback' });
  return normalizeAvatarItem({
    seed: parsed.seed,
    mode: parsed.mode,
    shape: parsed.body,
    palette: parsed.palette,
    eyes: parsed.eyes[0],
    mouth: parsed.mouth,
    accessories: parsed.accessories,
    rig: parsed.rig,
    features: parsed.features,
    meta: parsed.meta,
  });
}

/** Convenience for "give me something new" buttons. */
export function randomAvatar(options: AvatarFromHashOptions = {}): AvatarItem {
  return avatarFromHash(randomSeed(), options);
}
