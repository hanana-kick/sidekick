/** All 35 official Material Design expressive shapes, using camelCase API names. */
export const MATERIAL_SHAPE_NAMES = Object.freeze(["circle","square","slanted","arch","fan","arrow","semiCircle","oval","pill","triangle","diamond","clamShell","pentagon","gem","verySunny","sunny","cookie4Sided","cookie6Sided","cookie7Sided","cookie9Sided","cookie12Sided","ghostish","clover4Leaf","clover8Leaf","burst","softBurst","boom","softBoom","flower","puffy","puffyDiamond","pixelCircle","pixelTriangle","bun","heart"] as const);
export type MaterialShapeName = typeof MATERIAL_SHAPE_NAMES[number];
export const MATERIAL_SHAPE_LABELS: Readonly<Record<MaterialShapeName, string>> = Object.freeze({
  circle: "Circle",
  square: "Square",
  slanted: "Slanted",
  arch: "Arch",
  fan: "Fan",
  arrow: "Arrow",
  semiCircle: "Semi Circle",
  oval: "Oval",
  pill: "Pill",
  triangle: "Triangle",
  diamond: "Diamond",
  clamShell: "Clam Shell",
  pentagon: "Pentagon",
  gem: "Gem",
  verySunny: "Very Sunny",
  sunny: "Sunny",
  cookie4Sided: "4-sided cookie",
  cookie6Sided: "6-sided cookie",
  cookie7Sided: "7-sided cookie",
  cookie9Sided: "9-sided cookie",
  cookie12Sided: "12-sided cookie",
  ghostish: "Ghostish",
  clover4Leaf: "4-leaf clover",
  clover8Leaf: "8-leaf clover",
  burst: "Burst",
  softBurst: "Soft Burst",
  boom: "Boom",
  softBoom: "Soft Boom",
  flower: "Flower",
  puffy: "Puffy",
  puffyDiamond: "Puffy Diamond",
  pixelCircle: "Pixel Circle",
  pixelTriangle: "Pixel Triangle",
  bun: "Bun",
  heart: "Heart",
});
/** An official normalized 2D outline, retained as an internal contour descriptor. */
export interface MaterialShape { kind: 'material'; name: MaterialShapeName }

/** Legacy recipe names are retained only for migration and internal contour evaluation. */
export type BodyShape = 'orb' | 'rounded-box' | 'droplet';

/** An internal unit ellipse outline used when migrating legacy recipes. */
export interface EllipseShape { kind: 'ellipse' }
/** An internal centered, convex regular polygon outline for legacy migration. */
export interface RoundedPolygonShape {
  kind: 'rounded-polygon';
  /** Integer vertex count, from 3 to 12. */
  sides: number;
  /** 0 is a sharp polygon; 1 is a circle. Intermediate values use circular corners. */
  rounding: number;
  /** Angle of the first vertex in the XY plane, in radians, from -π to π. */
  rotation: number;
}
/** A legacy shape embedded in a composable recipe. */
export interface PresetShape { kind: 'preset'; name: BodyShape }
/**
 * Interpolate aligned closed contours directly, including different side counts.
 * Every endpoint feature is preserved; there is no ellipse or other waypoint.
 */
export interface MorphShape { kind: 'morph'; from: ShapeSpec; to: ShapeSpec; progress: number }
export type ShapeSpec = EllipseShape | RoundedPolygonShape | PresetShape | MaterialShape | MorphShape;
export type ShapeInput = BodyShape | ShapeSpec;
export interface RoundedPolygonOptions { rounding?: number; rotation?: number }

/** At most four nested morph operations and 31 total recipe nodes. */
export const MAX_SHAPE_DEPTH = 4;
export const MAX_SHAPE_NODES = 31;
const presetNames: readonly BodyShape[] = ['orb', 'rounded-box', 'droplet'];
function bounded(value: unknown, min: number, max: number, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${path}: expected a finite number from ${min} to ${max}.`);
  }
  return value;
}
function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${path}: expected a shape object.`);
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${path}: expected a plain shape object.`);
  if (Object.getOwnPropertySymbols(value).length) throw new TypeError(`${path}: symbol keys are unsupported.`);
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new TypeError(`${path}.${key}: unsupported shape field.`);
}
function materialName(value: unknown, path: string): MaterialShapeName {
  if (typeof value !== 'string' || !(MATERIAL_SHAPE_NAMES as readonly string[]).includes(value)) throw new TypeError(`${path}: expected a supported Material shape name.`);
  return value as MaterialShapeName;
}
function preset(value: unknown, path: string): BodyShape {
  if (typeof value !== 'string' || !presetNames.includes(value as BodyShape)) throw new TypeError(`${path}: expected orb, rounded-box, or droplet.`);
  return value as BodyShape;
}

/**
 * Validate an untrusted shape recipe and return a deeply isolated copy.
 * Legacy strings are converted to preset objects. Unknown fields, arbitrary paths,
 * non-finite numbers, cycles, and excessive composition are rejected.
 */
export function parseShape(input: unknown): ShapeSpec {
  let count = 0;
  function visit(value: unknown, depth: number, path: string): ShapeSpec {
    if (depth > MAX_SHAPE_DEPTH || ++count > MAX_SHAPE_NODES) throw new RangeError(`${path}: shape composition is too deep or large.`);
    if (typeof value === 'string') return { kind: 'preset', name: preset(value, path) };
    const shape = object(value, path);
    switch (shape.kind) {
      case 'ellipse':
        keys(shape, ['kind'], path);
        return { kind: 'ellipse' };
      case 'material':
        keys(shape, ['kind', 'name'], path);
        return { kind: 'material', name: materialName(shape.name, `${path}.name`) };
      case 'preset':
        keys(shape, ['kind', 'name'], path);
        return { kind: 'preset', name: preset(shape.name, `${path}.name`) };
      case 'rounded-polygon': {
        keys(shape, ['kind', 'sides', 'rounding', 'rotation'], path);
        const sides = bounded(shape.sides, 3, 12, `${path}.sides`);
        if (!Number.isInteger(sides)) throw new RangeError(`${path}.sides: expected an integer.`);
        return {
          kind: 'rounded-polygon', sides,
          rounding: bounded(shape.rounding, 0, 1, `${path}.rounding`),
          rotation: bounded(shape.rotation, -Math.PI, Math.PI, `${path}.rotation`),
        };
      }
      case 'morph':
        keys(shape, ['kind', 'from', 'to', 'progress'], path);
        if (depth >= MAX_SHAPE_DEPTH) throw new RangeError(`${path}: at most ${MAX_SHAPE_DEPTH} nested morph operations are supported.`);
        return {
          kind: 'morph',
          from: visit(shape.from, depth + 1, `${path}.from`),
          to: visit(shape.to, depth + 1, `${path}.to`),
          progress: bounded(shape.progress, 0, 1, `${path}.progress`),
        };
      default:
        throw new TypeError(`${path}.kind: expected ellipse, rounded-polygon, material, preset, or morph.`);
    }
  }
  return visit(input, 0, 'shape');
}

/**
 * Internal JSON-serializable recipes for legacy migration and contour evaluation.
 * The public body API accepts only the 35 Material catalog names. Material cubics
 * are generated from AndroidX; shallow extrusion and direct perimeter matching
 * are Sidekick-specific, not AndroidX Morph. No arbitrary path input.
 *
 * Ellipse and polygon outlines have a centered unit circumradius and consistent
 * angular samples. Catalog outlines retain official aspect-preserving normalized
 * bounds, mapped from [0,1] to centered [-1,1] coordinates. Legacy presets retain
 * their original 2D proportions during migration. Current catalog bodies share
 * one fixed, shallow extrusion.
 *
 * @example
 * shapes.morph(shapes.ellipse(), shapes.roundedPolygon(5, { rounding: 0.3 }), 0.6)
 */
export const shapes = Object.freeze({
  ellipse(): EllipseShape { return { kind: 'ellipse' }; },
  material(name: MaterialShapeName): MaterialShape { return { kind: 'material', name: materialName(name, 'shape.name') }; },
  preset(name: BodyShape): PresetShape { return { kind: 'preset', name: preset(name, 'shape.name') }; },
  roundedPolygon(sides: number, options: RoundedPolygonOptions = {}): RoundedPolygonShape {
    const checked = object(options, 'shape.options');
    keys(checked, ['rounding', 'rotation'], 'shape.options');
    return parseShape({ kind: 'rounded-polygon', sides, rounding: options.rounding === undefined ? 0.25 : options.rounding, rotation: options.rotation === undefined ? Math.PI / 2 : options.rotation }) as RoundedPolygonShape;
  },
  morph(from: ShapeInput, to: ShapeInput, progress: number): MorphShape {
    return parseShape({ kind: 'morph', from, to, progress }) as MorphShape;
  },
});
