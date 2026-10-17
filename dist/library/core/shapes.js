/** All 35 official Material Design expressive shapes, using camelCase API names. */
export const MATERIAL_SHAPE_NAMES = Object.freeze(["circle", "square", "slanted", "arch", "fan", "arrow", "semiCircle", "oval", "pill", "triangle", "diamond", "clamShell", "pentagon", "gem", "verySunny", "sunny", "cookie4Sided", "cookie6Sided", "cookie7Sided", "cookie9Sided", "cookie12Sided", "ghostish", "clover4Leaf", "clover8Leaf", "burst", "softBurst", "boom", "softBoom", "flower", "puffy", "puffyDiamond", "pixelCircle", "pixelTriangle", "bun", "heart"]);
export const MATERIAL_SHAPE_LABELS = Object.freeze({
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
/** At most four nested morph operations and 31 total recipe nodes. */
export const MAX_SHAPE_DEPTH = 4;
export const MAX_SHAPE_NODES = 31;
const presetNames = ['orb', 'rounded-box', 'droplet'];
function bounded(value, min, max, path) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
        throw new RangeError(`${path}: expected a finite number from ${min} to ${max}.`);
    }
    return value;
}
function object(value, path) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new TypeError(`${path}: expected a shape object.`);
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
        throw new TypeError(`${path}: expected a plain shape object.`);
    if (Object.getOwnPropertySymbols(value).length)
        throw new TypeError(`${path}: symbol keys are unsupported.`);
    return value;
}
function keys(value, allowed, path) {
    for (const key of Object.keys(value))
        if (!allowed.includes(key))
            throw new TypeError(`${path}.${key}: unsupported shape field.`);
}
function materialName(value, path) {
    if (typeof value !== 'string' || !MATERIAL_SHAPE_NAMES.includes(value))
        throw new TypeError(`${path}: expected a supported Material shape name.`);
    return value;
}
function preset(value, path) {
    if (typeof value !== 'string' || !presetNames.includes(value))
        throw new TypeError(`${path}: expected orb, rounded-box, or droplet.`);
    return value;
}
/**
 * Validate an untrusted shape recipe and return a deeply isolated copy.
 * Legacy strings are converted to preset objects. Unknown fields, arbitrary paths,
 * non-finite numbers, cycles, and excessive composition are rejected.
 */
export function parseShape(input) {
    let count = 0;
    function visit(value, depth, path) {
        if (depth > MAX_SHAPE_DEPTH || ++count > MAX_SHAPE_NODES)
            throw new RangeError(`${path}: shape composition is too deep or large.`);
        if (typeof value === 'string')
            return { kind: 'preset', name: preset(value, path) };
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
                if (!Number.isInteger(sides))
                    throw new RangeError(`${path}.sides: expected an integer.`);
                return {
                    kind: 'rounded-polygon', sides,
                    rounding: bounded(shape.rounding, 0, 1, `${path}.rounding`),
                    rotation: bounded(shape.rotation, -Math.PI, Math.PI, `${path}.rotation`),
                };
            }
            case 'morph':
                keys(shape, ['kind', 'from', 'to', 'progress'], path);
                if (depth >= MAX_SHAPE_DEPTH)
                    throw new RangeError(`${path}: at most ${MAX_SHAPE_DEPTH} nested morph operations are supported.`);
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
    ellipse() { return { kind: 'ellipse' }; },
    material(name) { return { kind: 'material', name: materialName(name, 'shape.name') }; },
    preset(name) { return { kind: 'preset', name: preset(name, 'shape.name') }; },
    roundedPolygon(sides, options = {}) {
        const checked = object(options, 'shape.options');
        keys(checked, ['rounding', 'rotation'], 'shape.options');
        return parseShape({ kind: 'rounded-polygon', sides, rounding: options.rounding === undefined ? 0.25 : options.rounding, rotation: options.rotation === undefined ? Math.PI / 2 : options.rotation });
    },
    morph(from, to, progress) {
        return parseShape({ kind: 'morph', from, to, progress });
    },
});
