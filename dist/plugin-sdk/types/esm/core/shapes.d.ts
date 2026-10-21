/** All 35 official Material Design expressive shapes, using camelCase API names. */
export declare const MATERIAL_SHAPE_NAMES: readonly ["circle", "square", "slanted", "arch", "fan", "arrow", "semiCircle", "oval", "pill", "triangle", "diamond", "clamShell", "pentagon", "gem", "verySunny", "sunny", "cookie4Sided", "cookie6Sided", "cookie7Sided", "cookie9Sided", "cookie12Sided", "ghostish", "clover4Leaf", "clover8Leaf", "burst", "softBurst", "boom", "softBoom", "flower", "puffy", "puffyDiamond", "pixelCircle", "pixelTriangle", "bun", "heart"];
export type MaterialShapeName = typeof MATERIAL_SHAPE_NAMES[number];
export declare const MATERIAL_SHAPE_LABELS: Readonly<Record<MaterialShapeName, string>>;
/** An official normalized 2D outline, retained as an internal contour descriptor. */
export interface MaterialShape {
    kind: 'material';
    name: MaterialShapeName;
}
/** Legacy recipe names are retained only for migration and internal contour evaluation. */
export type BodyShape = 'orb' | 'rounded-box' | 'droplet';
/** An internal unit ellipse outline used when migrating legacy recipes. */
export interface EllipseShape {
    kind: 'ellipse';
}
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
export interface PresetShape {
    kind: 'preset';
    name: BodyShape;
}
/**
 * Interpolate aligned closed contours directly, including different side counts.
 * Every endpoint feature is preserved; there is no ellipse or other waypoint.
 */
export interface MorphShape {
    kind: 'morph';
    from: ShapeSpec;
    to: ShapeSpec;
    progress: number;
}
export type ShapeSpec = EllipseShape | RoundedPolygonShape | PresetShape | MaterialShape | MorphShape;
export type ShapeInput = BodyShape | ShapeSpec;
export interface RoundedPolygonOptions {
    rounding?: number;
    rotation?: number;
}
/** At most four nested morph operations and 31 total recipe nodes. */
export declare const MAX_SHAPE_DEPTH = 4;
export declare const MAX_SHAPE_NODES = 31;
/**
 * Validate an untrusted shape recipe and return a deeply isolated copy.
 * Legacy strings are converted to preset objects. Unknown fields, arbitrary paths,
 * non-finite numbers, cycles, and excessive composition are rejected.
 */
export declare function parseShape(input: unknown): ShapeSpec;
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
export declare const shapes: Readonly<{
    ellipse(): EllipseShape;
    material(name: MaterialShapeName): MaterialShape;
    preset(name: BodyShape): PresetShape;
    roundedPolygon(sides: number, options?: RoundedPolygonOptions): RoundedPolygonShape;
    morph(from: ShapeInput, to: ShapeInput, progress: number): MorphShape;
}>;
