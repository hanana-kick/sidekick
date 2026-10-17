import { MATERIAL_SHAPE_NAMES, MAX_SHAPE_DEPTH, MAX_SHAPE_NODES, parseShape } from './shapes.js';
import { shapeContour } from './contours.js';
export { MATERIAL_SHAPE_NAMES } from './shapes.js';
import { createEyeState, migrateEyeState, migrateV4EyeState, migrateV5EyeState, parseEyeState, patchEyeState } from './expressions.js';
import { parseShapeProfiles } from './shape-profiles.js';
/** Alias of the complete, immutable Material shape catalog. */
export const BODY_SHAPES = MATERIAL_SHAPE_NAMES;
export const ACCESSORY_PRESETS = Object.freeze(['beret', 'halo', 'crown', 'glasses', 'sunglasses', 'moustache', 'goatee', 'bowTie', 'scarf', 'necklace', 'earring', 'starEarring']);
/** Equipment slots are exclusive, regardless of an accessory's surface anchor. */
export const ACCESSORY_SLOTS = Object.freeze(['head', 'eyes', 'mouth', 'neck', 'leftEar', 'rightEar']);
/** Unambiguous preset defaults. Earrings deliberately have no default side. */
export const ACCESSORY_SLOT_BY_PRESET = Object.freeze({ beret: 'head', halo: 'head', crown: 'head', glasses: 'eyes', sunglasses: 'eyes', moustache: 'mouth', goatee: 'mouth', bowTie: 'neck', scarf: 'neck', necklace: 'neck' });
/** All legal slots, including the two independently occupied earring sides. */
export const ACCESSORY_SLOTS_BY_PRESET = Object.freeze({
    beret: Object.freeze(['head']), halo: Object.freeze(['head']), crown: Object.freeze(['head']), glasses: Object.freeze(['eyes']), sunglasses: Object.freeze(['eyes']),
    moustache: Object.freeze(['mouth']), goatee: Object.freeze(['mouth']), bowTie: Object.freeze(['neck']), scarf: Object.freeze(['neck']), necklace: Object.freeze(['neck']),
    earring: Object.freeze(['leftEar', 'rightEar']), starEarring: Object.freeze(['leftEar', 'rightEar']),
});
export const ACCESSORY_LABELS = Object.freeze({ beret: 'Beret', halo: 'Halo', crown: 'Crown', glasses: 'Glasses', sunglasses: 'Sunglasses', moustache: 'Moustache', goatee: 'Goatee', bowTie: 'Bow tie', scarf: 'Scarf', necklace: 'Necklace', earring: 'Drop earring', starEarring: 'Star earring' });
const LEGACY_ACCESSORY_PRESETS = ['beret', 'halo', 'glasses'];
const LEGACY_ACCESSORY_SLOTS = ['head', 'face'];
export const ACTIVITIES = Object.freeze(['idle', 'thinking', 'listening', 'speaking', 'celebrating', 'still']);
const regions = ['face', 'crown', 'left', 'right'];
const defaults = {
    version: 7,
    body: { shape: 'square', color: '#ffcc37' },
    eyes: { color: '#24242c', left: createEyeState(), right: createEyeState() },
    accessories: [],
};
function record(value, path, keys) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new TypeError(`${path}: 객체가 필요합니다.`);
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
        throw new TypeError(`${path}: 일반 객체가 필요합니다.`);
    for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== 'string' || !keys.includes(key))
            throw new TypeError(`${path}.${String(key)}: 지원하지 않는 항목입니다.`);
        const field = Object.getOwnPropertyDescriptor(value, key);
        if (!field.enumerable || !Object.hasOwn(field, 'value'))
            throw new TypeError(`${path}.${key}: 일반 데이터 항목이 필요합니다.`);
    }
    return value;
}
export function finite(value, min, max, path) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
        throw new RangeError(`${path}: ${min}~${max}의 유한한 숫자가 필요합니다.`);
    return value;
}
function choice(value, choices, path) {
    if (typeof value !== 'string' || !choices.includes(value))
        throw new TypeError(`${path}: ${choices.join(', ')} 중 하나여야 합니다.`);
    return value;
}
/** Array holes, getters, symbols and extra properties are not JSON data. */
function dataArray(value, size, path) {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length !== size)
        throw new TypeError(`${path}: 길이가 ${size}인 일반 배열이 필요합니다.`);
    const allowed = new Set(['length', ...Array.from({ length: size }, (_, i) => String(i))]);
    for (const key of Reflect.ownKeys(value))
        if (typeof key !== 'string' || !allowed.has(key))
            throw new TypeError(`${path}.${String(key)}: 지원하지 않는 항목입니다.`);
    for (let i = 0; i < size; i++) {
        const field = Object.getOwnPropertyDescriptor(value, String(i));
        if (!field || !field.enumerable || !Object.hasOwn(field, 'value'))
            throw new TypeError(`${path}[${i}]: 일반 데이터 항목이 필요합니다.`);
    }
    return value;
}
function vector(value, size, min, max, path) {
    return dataArray(value, size, path).map((item, i) => finite(item, min, max, `${path}[${i}]`));
}
/** Guard legacy descriptor reads before the contour parser examines recipe fields. */
function validateLegacyShapeData(value) {
    let count = 0;
    const ancestors = new Set();
    function visit(input, depth, path) {
        if (depth > MAX_SHAPE_DEPTH || ++count > MAX_SHAPE_NODES)
            throw new RangeError(`${path}: shape composition is too deep or large.`);
        if (typeof input === 'string')
            return;
        const shape = record(input, path, ['kind', 'name', 'sides', 'rounding', 'rotation', 'from', 'to', 'progress']);
        if (ancestors.has(shape))
            throw new TypeError(`${path}: cyclic shape recipe.`);
        ancestors.add(shape);
        for (const key of ['from', 'to'])
            if (Object.hasOwn(shape, key))
                visit(shape[key], depth + 1, `${path}.${key}`);
        ancestors.delete(shape);
    }
    visit(value, 0, 'body.shape');
}
function color(value) {
    if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value))
        throw new TypeError('color: #RRGGBB 형식이 필요합니다.');
    return value.toLowerCase();
}
function anchor(value) {
    const a = record(value, 'anchor', ['region', 'uv', 'offset']);
    return { region: choice(a.region, regions, 'anchor.region'), uv: vector(a.uv, 2, -0.85, 0.85, 'anchor.uv'), offset: finite(a.offset, 0, 0.5, 'anchor.offset') };
}
const LEGACY_BODY_KEYS = ['shape', 'size', 'roundness', 'taper', 'bulge', 'bend', 'color'];
const OUTLINE_SAMPLES = 128;
const catalogSamples = new Map();
const migrationCache = new Map();
/** Uniform-size normalization preserves aspect ratio and orientation, but removes position. */
function perimeterSamples(points) {
    const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
    const scale = 2 / Math.max(maxX - minX, maxY - minY);
    const normalized = points.map(([x, y]) => [(x - centerX) * scale, (y - centerY) * scale]);
    const cumulative = [0];
    for (let i = 0; i < normalized.length; i++) {
        const a = normalized[i], b = normalized[(i + 1) % normalized.length];
        cumulative.push(cumulative[i] + Math.hypot(a[0] - b[0], a[1] - b[1]));
    }
    const perimeter = cumulative[normalized.length];
    if (!Number.isFinite(perimeter) || perimeter <= 0)
        throw new RangeError('body.shape: 윤곽선이 유효하지 않습니다.');
    let edge = 0;
    return Array.from({ length: OUTLINE_SAMPLES }, (_, i) => {
        const distance = i / OUTLINE_SAMPLES * perimeter;
        while (edge + 1 < normalized.length && cumulative[edge + 1] <= distance)
            edge++;
        const a = normalized[edge], b = normalized[(edge + 1) % normalized.length];
        const length = cumulative[edge + 1] - cumulative[edge];
        const t = length ? (distance - cumulative[edge]) / length : 0;
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    });
}
/** Compare all perimeter phases; catalog order breaks ties deterministically. */
function closestCatalogShape(points) {
    const source = perimeterSamples(points);
    let bestName = MATERIAL_SHAPE_NAMES[0], bestError = Infinity;
    for (const name of MATERIAL_SHAPE_NAMES) {
        let target = catalogSamples.get(name);
        if (!target) {
            target = perimeterSamples(shapeContour({ kind: 'material', name }).points);
            catalogSamples.set(name, target);
        }
        for (let phase = 0; phase < OUTLINE_SAMPLES; phase++) {
            let error = 0;
            for (let i = 0; i < OUTLINE_SAMPLES && error < bestError; i++) {
                const a = source[i], b = target[(i + phase) % OUTLINE_SAMPLES];
                error += (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
            }
            if (error < bestError - 1e-12) {
                bestError = error;
                bestName = name;
            }
        }
    }
    return bestName;
}
function migrateBody(body) {
    validateLegacyShapeData(body.shape);
    const recipe = parseShape(body.shape);
    const size = vector(body.size, 3, 0.4, 2, 'body.size');
    const roundness = finite(body.roundness, 0.15, 1, 'body.roundness');
    const taper = finite(body.taper, -0.45, 0.45, 'body.taper');
    const bulge = finite(body.bulge, -0.2, 0.4, 'body.bulge');
    const bend = finite(body.bend, -0.35, 0.35, 'body.bend');
    const key = JSON.stringify([recipe, size[0], size[1], roundness, taper, bulge, bend]);
    let shape = migrationCache.get(key);
    // A saved catalog selection remains authoritative; deformation is discarded.
    if (recipe.kind === 'material')
        shape = recipe.name;
    if (!shape) {
        const points = shapeContour(recipe, roundness).points.map(([x, y]) => {
            const width = (1 - taper * y) * (1 + bulge * Math.exp(-(((y + 0.2) / 0.55) ** 2)));
            // Uniform new XY sizing leaves catalog proportions unchanged. Legacy depth
            // does not affect the visible XY outline and is deliberately discarded.
            return [(x * width + bend * y * y) * size[0], y * size[1]];
        });
        shape = closestCatalogShape(points);
        if (migrationCache.size >= 64)
            migrationCache.delete(migrationCache.keys().next().value);
        migrationCache.set(key, shape);
    }
    return { shape, color: color(body.color) };
}
/** Validate old geometry before discarding it; canonical v7 never accepts calibration. */
export function migrateDesign(input) {
    if (typeof input === 'string') {
        if (input.length > 65536)
            throw new RangeError('디자인 JSON은 64 KiB 이하여야 합니다.');
        input = JSON.parse(input);
    }
    const d = record(input, 'design', ['version', 'body', 'eyes', 'accessories']);
    if (![1, 2, 3, 4, 5, 6, 7].includes(d.version))
        throw new TypeError('지원하는 디자인 버전은 1/2/3/4/5/6(가져오기), 7입니다.');
    const legacy = d.version !== 7, legacyGeometry = d.version <= 5;
    const b = record(d.body, 'body', d.version === 4 || d.version === 5 ? ['shape', 'color', 'profiles'] : d.version === 1 || d.version === 2 ? LEGACY_BODY_KEYS : ['shape', 'color']);
    const e = record(d.eyes, 'eyes', !legacyGeometry ? ['color', 'left', 'right'] : d.version === 1 ? ['preset', 'anchor', 'spacing', 'scale', 'color'] : ['shape', 'width', 'height', 'left', 'right', 'anchor', 'spacing', 'scale', 'color']);
    const body = d.version === 1 || d.version === 2 ? migrateBody(b) : { shape: choice(b.shape, MATERIAL_SHAPE_NAMES, 'body.shape'), color: color(b.color) };
    if (Object.hasOwn(b, 'profiles'))
        parseShapeProfiles(b.profiles, 'body.profiles');
    let left, right;
    if (legacyGeometry) {
        const oldAnchor = anchor(e.anchor);
        if (oldAnchor.region !== 'face')
            throw new TypeError('눈의 장착 영역은 face여야 합니다.');
        if (d.version !== 1 && oldAnchor.offset !== 0)
            throw new RangeError('eyes.anchor.offset은 0이어야 합니다.');
        finite(e.spacing, 0.2, 1, 'eyes.spacing');
        finite(e.scale, 0.4, 1.8, 'eyes.scale');
        if (d.version === 1) {
            const preset = choice(e.preset, ['capsule', 'round', 'arc'], 'eyes.preset');
            const state = { expression: preset === 'arc' ? 'smile' : 'neutral', openness: 1 };
            left = migrateEyeState(state, 'eyes.left');
            right = migrateEyeState(state, 'eyes.right');
        }
        else {
            choice(e.shape, ['capsule'], 'eyes.shape');
            finite(e.width, 0.04, 0.24, 'eyes.width');
            finite(e.height, 0.08, 0.45, 'eyes.height');
            const parse = d.version === 5 ? migrateV5EyeState : d.version === 4 ? migrateV4EyeState : migrateEyeState;
            left = parse(e.left, 'eyes.left');
            right = parse(e.right, 'eyes.right');
        }
    }
    else {
        left = parseEyeState(e.left, 'eyes.left');
        right = parseEyeState(e.right, 'eyes.right');
    }
    const eyes = { color: color(e.color), left, right };
    if (!Array.isArray(d.accessories) || d.accessories.length > ACCESSORY_SLOTS.length)
        throw new RangeError(`액세서리는 슬롯당 1개, 최대 ${ACCESSORY_SLOTS.length}개입니다.`);
    const ids = new Set(), slots = new Set();
    const accessories = dataArray(d.accessories, d.accessories.length, 'accessories').map((item) => {
        const a = record(item, 'accessory', legacyGeometry ? ['id', 'preset', 'slot', 'anchor', 'color', 'scale', 'rotation', 'follow'] : ['id', 'preset', 'slot', 'color']);
        if (typeof a.id !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(a.id) || ids.has(a.id))
            throw new TypeError('액세서리 id는 중복 없는 영문 소문자/숫자/하이픈이어야 합니다.');
        ids.add(a.id);
        const preset = choice(a.preset, legacy ? LEGACY_ACCESSORY_PRESETS : ACCESSORY_PRESETS, 'accessory.preset');
        let slot;
        if (legacy) {
            const oldSlot = legacyGeometry && !Object.hasOwn(a, 'slot')
                ? (preset === 'glasses' ? 'face' : 'head')
                : choice(a.slot, LEGACY_ACCESSORY_SLOTS, 'accessory.slot');
            slot = oldSlot === 'face' ? 'eyes' : oldSlot;
        }
        else
            slot = choice(a.slot, ACCESSORY_SLOTS, 'accessory.slot');
        if (!ACCESSORY_SLOTS_BY_PRESET[preset].includes(slot))
            throw new TypeError(`accessory.slot: ${preset}의 슬롯은 ${ACCESSORY_SLOTS_BY_PRESET[preset].join(', ')} 중 하나여야 합니다.`);
        if (slots.has(slot))
            throw new TypeError(`accessory.slot: ${slot} 슬롯에는 액세서리를 하나만 장착할 수 있습니다.`);
        slots.add(slot);
        if (legacyGeometry) {
            anchor(a.anchor);
            finite(a.scale, 0.3, 2, 'accessory.scale');
            vector(a.rotation, 3, -Math.PI, Math.PI, 'accessory.rotation');
            finite(a.follow, 0, 1, 'accessory.follow');
        }
        return { id: a.id, preset, slot, color: color(a.color) };
    });
    const warnings = !legacy ? [] : legacyGeometry ? [
        `Imported v${d.version} as v7 with Material shape "${body.shape}". Preserved colors, equipment IDs, and independent expression weights; renamed the face equipment slot to eyes. Discarded eye dimensions, anchors, spacing, scale, expression target geometry, body profile overrides, and accessory anchors/scale/rotation/follow; curated geometry now applies.${d.version === 1 || d.version === 2 ? ' Legacy non-catalog outlines were approximated; size, roundness, taper, bulge, and bend are no longer stored.' : ''}`,
    ] : ['Imported v6 as v7. Renamed the face equipment slot to eyes; preserved shape, colors, equipment IDs, and independent expression weights.'];
    return { design: { version: 7, body, eyes, accessories }, warnings };
}
/** Parse canonical v7 or deterministically migrate saved v1–v6 documents. */
export function parseDesign(input) { return migrateDesign(input).design; }
/** Atomic patch of selections/colors and independent expression weights only. */
export function patchDesign(design, patch) {
    const current = parseDesign(design);
    const change = record(patch, 'patch', ['body', 'eyes', 'accessories']);
    if (Object.hasOwn(change, 'body'))
        current.body = { ...current.body, ...record(change.body, 'body', ['shape', 'color']) };
    if (Object.hasOwn(change, 'eyes')) {
        const eyes = record(change.eyes, 'eyes', ['color', 'left', 'right']);
        if (Object.hasOwn(eyes, 'color'))
            current.eyes.color = color(eyes.color);
        if (Object.hasOwn(eyes, 'left'))
            current.eyes.left = patchEyeState(current.eyes.left, eyes.left, 'eyes.left');
        if (Object.hasOwn(eyes, 'right'))
            current.eyes.right = patchEyeState(current.eyes.right, eyes.right, 'eyes.right');
    }
    if (Object.hasOwn(change, 'accessories'))
        current.accessories = change.accessories;
    return parseDesign(current);
}
export function createDesign(patch = {}) { return patchDesign(defaults, patch); }
export function createAccessory(preset, idOrOptions) {
    const selected = choice(preset, ACCESSORY_PRESETS, 'accessory.preset');
    const options = typeof idOrOptions === 'string' ? { id: idOrOptions } : idOrOptions === undefined ? {} : record(idOrOptions, 'accessory.options', ['id', 'slot']);
    const slot = Object.hasOwn(options, 'slot') ? choice(options.slot, ACCESSORY_SLOTS, 'accessory.slot')
        : selected === 'earring' || selected === 'starEarring' ? undefined : ACCESSORY_SLOT_BY_PRESET[selected];
    if (slot === undefined)
        throw new TypeError(`accessory.slot: ${selected}의 슬롯은 leftEar 또는 rightEar로 명시해야 합니다.`);
    const defaultID = selected === 'earring' || selected === 'starEarring' ? `${selected === 'starEarring' ? 'star-earring' : 'earring'}-${slot === 'leftEar' ? 'left' : 'right'}` : selected === 'bowTie' ? 'bow-tie' : selected;
    const colors = { beret: '#b84742', halo: '#f7cc5b', crown: '#e5ad35', glasses: '#31323d', sunglasses: '#31323d', moustache: '#31323d', goatee: '#31323d', bowTie: '#b84742', scarf: '#b84742', necklace: '#9b6c2a', earring: '#f7cc5b', starEarring: '#a66a22' };
    const accessory = { id: Object.hasOwn(options, 'id') ? options.id : defaultID, preset: selected, slot, color: colors[selected] };
    return parseDesign({ ...defaults, accessories: [accessory] }).accessories[0];
}
/**
 * Returns an isolated design with accessory equipped, replacing its slot's occupant in place.
 * Vacant slots append; other slots retain their order and values. Neither input is mutated.
 * Invalid source designs, invalid accessories, and IDs already used in another slot reject.
 */
export function equipAccessory(design, accessory) {
    const current = parseDesign(design);
    const equipped = parseDesign({ ...defaults, accessories: [accessory] }).accessories[0];
    const index = current.accessories.findIndex(item => item.slot === equipped.slot);
    if (index === -1)
        current.accessories.push(equipped);
    else
        current.accessories[index] = equipped;
    return parseDesign(current);
}
/** Remove exactly one instance by ID, preserving every other slot and input. */
export function removeAccessory(design, id) {
    const current = parseDesign(design);
    if (typeof id !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(id))
        throw new TypeError('잘못된 액세서리 id입니다.');
    const index = current.accessories.findIndex(accessory => accessory.id === id);
    if (index === -1)
        throw new RangeError(`액세서리 ${id}가 없습니다.`);
    current.accessories.splice(index, 1);
    return current;
}
export function serializeDesign(design) { return JSON.stringify(parseDesign(design), null, 2); }
