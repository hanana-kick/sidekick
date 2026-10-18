import { shapeContour } from '../core/contours.js';
import { resolveShapeProfile } from '../core/shape-profiles.js';
import { transform } from '../core/math.js';
import { bodyGeometry } from './body-geometry.js';
const SEGMENTS = 64;
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function hull(points) {
    points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (points.length < 3)
        return points;
    const lower = [], upper = [];
    for (const p of points) {
        while (lower.length > 1 && cross(lower.at(-2), lower.at(-1), p) <= 0)
            lower.pop();
        lower.push(p);
    }
    for (let i = points.length - 1; i >= 0; i--) {
        const p = points[i];
        while (upper.length > 1 && cross(upper.at(-2), upper.at(-1), p) <= 0)
            upper.pop();
        upper.push(p);
    }
    lower.pop();
    upper.pop();
    return lower.concat(upper);
}
function radial(section, cx, angle) {
    const dx = Math.cos(angle), dz = Math.sin(angle);
    let radius = 0;
    for (let i = 0; i < section.length; i++) {
        const a = section[i], b = section[(i + 1) % section.length], ex = b[0] - a[0], ez = b[1] - a[1];
        const det = dx * ez - dz * ex;
        if (Math.abs(det) < 1e-12)
            continue;
        const r = ((a[0] - cx) * ez - a[1] * ex) / det, t = ((a[0] - cx) * dz - a[1] * dx) / det;
        if (r >= 0 && t >= 0 && t <= 1)
            radius = Math.max(radius, r);
    }
    return radius;
}
/**
 * Family-specific tilted supports put a lobe or point inside a compact crown.
 * The asymmetric free hem hangs below the support instead of enlarging the
 * hat to a full-body cross-section. Concealed inner seam overlap is intentional.
 */
function makeWornBeret(contour, scales, shape) {
    const mesh = bodyGeometry(contour), v = mesh.vertices, points = [];
    const tilt = (shape === 'heart' ? -18 : shape === 'triangle' || shape === 'pixelTriangle' ? -10 : shape === 'boom' ? -32 : -20) * Math.PI / 180;
    const co = Math.cos(tilt), si = Math.sin(tilt);
    let top = -Infinity, bottom = Infinity;
    for (let i = 0; i < v.length; i += 6) {
        const p = [v[i] * scales[0], v[i + 1] * scales[1], v[i + 2] * scales[2]];
        const x = p[0], y = p[1];
        p[0] = co * x + si * y;
        p[1] = -si * x + co * y;
        points.push(p);
        top = Math.max(top, p[1]);
        bottom = Math.min(bottom, p[1]);
    }
    const hanger = shape === 'triangle' || shape === 'pixelTriangle' || shape === 'boom';
    const crownLift = hanger ? .025 : shape === 'circle' ? .12 : .065;
    const slouch = shape === 'triangle' || shape === 'pixelTriangle' ? .12 : .085;
    const height = top - bottom, bandHeight = height * .030;
    const insertion = shape === 'triangle' || shape === 'pixelTriangle' ? .18 : shape === 'boom' ? .115 : shape === 'heart' ? .12 : .085;
    const cut = top - height * insertion;
    const lobe = shape === 'heart', pointed = shape === 'boom';
    const supportX = points.reduce((a, b) => a[1] > b[1] ? a : b)[0];
    const minX = lobe ? .025 : pointed ? supportX - .16 : -Infinity;
    const maxX = pointed ? supportX + .24 : Infinity;
    // Deduplicate mesh edges once; section samples only visit their Y interval.
    const edges = [], seen = new Set();
    for (let i = 0; i < mesh.indices.length; i += 3)
        for (let j = 0; j < 3; j++) {
            const ai = mesh.indices[i + j], bi = mesh.indices[i + (j + 1) % 3];
            const a = points[ai], b = points[bi];
            if (Math.max(a[1], b[1]) < cut - .15)
                continue;
            const key = Math.min(ai, bi) + ':' + Math.max(ai, bi);
            if (seen.has(key))
                continue;
            seen.add(key);
            if (Math.abs(a[1] - b[1]) > 1e-10)
                edges.push({ a, b, low: Math.min(a[1], b[1]), high: Math.max(a[1], b[1]) });
        }
    const sectionAt = (y) => {
        const result = [];
        for (const { a, b, low, high } of edges) {
            if (y < low || y >= high)
                continue;
            const t = (y - a[1]) / (b[1] - a[1]);
            result.push([a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t]);
        }
        let section = hull(result);
        for (const [edge, sign] of [[minX, 1], [maxX, -1]]) {
            if (!Number.isFinite(edge))
                continue;
            const clipped = [];
            for (let i = 0; i < section.length; i++) {
                const a = section[i], b = section[(i + 1) % section.length];
                const insideA = sign * (a[0] - edge) >= 0, insideB = sign * (b[0] - edge) >= 0;
                if (insideA)
                    clipped.push(a);
                if (insideA !== insideB)
                    clipped.push([edge, a[1] + (b[1] - a[1]) * (edge - a[0]) / (b[0] - a[0])]);
            }
            section = clipped;
        }
        return section;
    };
    const base = sectionAt(cut), cx = (Math.min(...base.map(p => p[0])) + Math.max(...base.map(p => p[0]))) / 2;
    const bandEnvelope = hull([...base, ...sectionAt(cut + bandHeight), ...points.filter(p => p[1] >= cut && p[1] <= cut + bandHeight && (p[0] >= minX && p[0] <= maxX)).map((p) => [p[0], p[2]])]);
    const bandRadius = Array.from({ length: SEGMENTS }, (_, i) => radial(bandEnvelope, cx, i / SEGMENTS * Math.PI * 2));
    const baseRadius = Array.from({ length: SEGMENTS }, (_, i) => radial(base, cx, i / SEGMENTS * Math.PI * 2));
    const radiusX = Math.max(...baseRadius), pad = .008;
    const fullnessScale = 1;
    const vertices = [], indices = [];
    const sections = Array.from({ length: 81 }, (_, i) => sectionAt(cut - .15 + (top + .16 - cut) * i / 80));
    const atHeight = (y) => sections[Math.max(0, Math.min(80, Math.floor((y - cut + .15) / (top + .16 - cut) * 80)))];
    // A turned lower hem, a broad dark cuff, then the asymmetric felt crown.
    const rings = [
        { y: cut + .010, puff: -.005, blend: 1, shift: 0 },
        { y: cut - .004, puff: .006, blend: 1, shift: 0 },
        { y: cut + .006, puff: .015, blend: 1, shift: 0 },
        { y: cut + bandHeight, puff: .012, blend: 1, shift: 0 },
        ...Array.from({ length: 12 }, (_, j) => {
            const t = j / 11;
            return { y: cut + bandHeight + .008 + (top + crownLift - cut - bandHeight) * t,
                puff: .025 + radiusX * .19 * Math.sin(Math.PI * t), blend: Math.sqrt(Math.max(0, 1 - t * t)) * (1 + .05 * Math.sin(Math.PI * t)), shift: -slouch * Math.sin(Math.PI * t * (hanger ? 1 : .5)) };
        }),
    ];
    const cuffEdge = [];
    for (let ring = 0; ring < rings.length; ring++) {
        const r = rings[ring], center = cx + r.shift;
        for (let i = 0; i < SEGMENTS; i++) {
            const a = i / SEGMENTS * Math.PI * 2;
            const actualY = r.y - (hanger ? .13 : .065) * Math.pow(Math.max(0, -Math.cos(a)), 2) * (1 - (ring / (rings.length - 1)) ** 2);
            const body = radial(atHeight(actualY), center, a);
            const authored = (hanger ? Math.max(baseRadius[i], .085) : baseRadius[i]) * r.blend * fullnessScale + r.puff;
            const radius = ring < 4 ? Math.max(body, bandRadius[i], cuffEdge[i] ?? 0) + (ring === 0 ? r.puff : Math.max(r.puff, .025))
                : Math.max(body + (hanger ? .022 : pad), authored, (cuffEdge[i] + .033) * Math.max(0, 1 - ((ring - 4) / 11) ** 2));
            if (ring < 4)
                cuffEdge[i] = radius - (ring === 0 ? r.puff : Math.max(r.puff, .025));
            // Low-frequency felt fullness, not high-frequency folds or a rigid disk.
            const fullness = ring < 4 ? 0 : .006 * Math.sin(a * 2 + .4) * Math.sin((ring - 3) / (rings.length - 3) * Math.PI);
            vertices.push(center + (radius + fullness) * Math.cos(a), actualY, (radius + fullness) * Math.sin(a), 0, 0, 0);
        }
    }
    for (let ring = 0; ring < rings.length - 1; ring++)
        for (let i = 0; i < SEGMENTS; i++) {
            const a = ring * SEGMENTS + i, b = ring * SEGMENTS + (i + 1) % SEGMENTS, c = a + SEGMENTS, d = b + SEGMENTS;
            indices.push(a, c, b, b, c, d);
        }
    const cap = vertices.length / 6;
    vertices.push(cx - (hanger ? 0 : slouch), top + crownLift + .006, 0, 0, 1, 0);
    for (let i = 0; i < SEGMENTS; i++)
        indices.push((rings.length - 1) * SEGMENTS + i, cap, (rings.length - 1) * SEGMENTS + (i + 1) % SEGMENTS);
    // Small fabric stem, part of the same mesh and draw range.
    const stem = vertices.length / 6;
    for (let ring = 0; ring < 3; ring++)
        for (let i = 0; i < 12; i++) {
            const a = i / 12 * Math.PI * 2, radius = ring === 2 ? .002 : .012;
            vertices.push(cx - (hanger ? 0 : slouch) - ring * .004 + radius * Math.cos(a), top + crownLift + .005 + ring * .014, radius * Math.sin(a), 0, 0, 0);
        }
    for (let ring = 0; ring < 2; ring++)
        for (let i = 0; i < 12; i++) {
            const a = stem + ring * 12 + i, b = stem + ring * 12 + (i + 1) % 12;
            indices.push(a, a + 12, b, b, a + 12, b + 12);
        }
    for (let i = 1; i < 11; i++) {
        indices.push(stem, stem + i, stem + i + 1);
        indices.push(stem + 24, stem + 24 + i + 1, stem + 24 + i);
    }
    const output = new Float32Array(vertices);
    for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i] * 6, b = indices[i + 1] * 6, c = indices[i + 2] * 6;
        const u = [output[b] - output[a], output[b + 1] - output[a + 1], output[b + 2] - output[a + 2]];
        const w = [output[c] - output[a], output[c + 1] - output[a + 1], output[c + 2] - output[a + 2]];
        const normal = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
        for (const p of [a, b, c])
            for (let k = 0; k < 3; k++)
                output[p + 3 + k] += normal[k];
    }
    for (let i = 0; i < output.length; i += 6) {
        const n = Math.hypot(output[i + 3], output[i + 4], output[i + 5]);
        for (let k = 3; k < 6; k++)
            output[i + k] /= n || 1;
    }
    // Return from the intentionally inclined wearing plane into body space.
    for (let i = 0; i < output.length; i += 6)
        for (const off of [0, 3]) {
            const x = output[i + off], y = output[i + off + 1];
            output[i + off] = co * x - si * y;
            output[i + off + 1] = si * x + co * y;
        }
    const bandIndexCount = 3 * SEGMENTS * 6;
    return { mesh: { vertices: output, indices: new Uint16Array(indices), bandIndexCount, crownIndexCount: indices.length - bandIndexCount, seating: cut - top }, pivot: [co * cx - si * cut, si * cx + co * cut, 0] };
}
// Heart supplies the visual proportions. Local felt deformation adapts the
// opening to each support without growing a full-body envelope.
const REFERENCE_TILT = -18 * Math.PI / 180;
let canonical;
function referenceHat() {
    if (canonical)
        return canonical;
    const contour = shapeContour({ kind: 'material', name: 'heart' });
    const depth = resolveShapeProfile('heart').depth * .5;
    const { mesh, pivot } = makeWornBeret(contour, [.59, .59, depth], 'heart');
    const co = Math.cos(REFERENCE_TILT), si = Math.sin(REFERENCE_TILT);
    const vertices = new Float32Array(mesh.vertices);
    for (let i = 0; i < vertices.length; i += 6)
        for (const offset of [0, 3]) {
            const x = vertices[i + offset] - (offset === 0 ? pivot[0] : 0), y = vertices[i + offset + 1] - (offset === 0 ? pivot[1] : 0);
            vertices[i + offset] = co * x + si * y;
            vertices[i + offset + 1] = -si * x + co * y;
        }
    let top = [0, -Infinity, 0];
    for (const p of contour.points) {
        const x = p[0] * .59, y = p[1] * .59;
        if (-si * x + co * y > top[1])
            top = [co * x + si * y, -si * x + co * y, 0];
    }
    const localPivot = [co * pivot[0] + si * pivot[1], -si * pivot[0] + co * pivot[1], 0];
    canonical = { mesh: { ...mesh, vertices }, pivot, support: [top[0] - localPivot[0], top[1] - localPivot[1], 0] };
    return canonical;
}
const DRAPED_FAMILIES = ['flower', 'cookie12Sided', 'puffy', 'slanted', 'softBurst', 'sunny', 'verySunny', 'clover8Leaf', 'softBoom'];
const flexibleCache = new WeakMap();
/** Bounded contact shaping in the wearing frame, not global body scaling. */
function flexibleFelt(contour, scales, shape, co, si, px, py) {
    const ref = referenceHat().mesh, draped = DRAPED_FAMILIES.includes(shape);
    if (shape === 'heart')
        return ref.vertices;
    let cache = flexibleCache.get(contour);
    if (!cache) {
        cache = new Map();
        flexibleCache.set(contour, cache);
    }
    const key = [shape, ...scales, px, py].join(':');
    const cached = cache.get(key);
    if (cached)
        return cached;
    const body = bodyGeometry(contour), points = [];
    for (let i = 0; i < body.vertices.length; i += 6) {
        const x = body.vertices[i] * scales[0], y = body.vertices[i + 1] * scales[1];
        points.push([co * x + si * y - px, -si * x + co * y - py, body.vertices[i + 2] * scales[2]]);
    }
    const edges = [];
    const seen = new Set(), count = points.length;
    for (let i = 0; i < body.indices.length; i += 3)
        for (let j = 0; j < 3; j++) {
            const ai = body.indices[i + j], bi = body.indices[i + (j + 1) % 3], key = Math.min(ai, bi) * count + Math.max(ai, bi);
            if (seen.has(key))
                continue;
            seen.add(key);
            const a = points[ai], b = points[bi], low = Math.min(a[1], b[1]), high = Math.max(a[1], b[1]);
            if (high >= -.12 && low <= .40 && high - low > 1e-9)
                edges.push({ a, b, low, high });
        }
    const vertices = new Float32Array(ref.vertices);
    const clamp = (v, limit) => Math.max(-limit, Math.min(limit, v));
    for (let ring = 0; ring < 16; ring++) {
        const start = ring * SEGMENTS;
        let cy = 0, cx = 0, minY = Infinity, maxY = -Infinity;
        for (let j = 0; j < SEGMENTS; j++) {
            cx += vertices[(start + j) * 6] / SEGMENTS;
            cy += vertices[(start + j) * 6 + 1] / SEGMENTS;
            minY = Math.min(minY, vertices[(start + j) * 6 + 1]);
            maxY = Math.max(maxY, vertices[(start + j) * 6 + 1]);
        }
        const section = [];
        for (const level of (['softBoom', 'square', 'bun', 'arch', 'flower', 'softBurst'].includes(shape) ? [minY, cy, maxY] : [cy]))
            for (const { a, b, low, high } of edges) {
                if (level >= low && level < high) {
                    const t = (level - a[1]) / (b[1] - a[1]);
                    section.push([a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t]);
                }
            }
        const boundary = hull(section), deltas = [];
        for (let j = 0; j < SEGMENTS; j++) {
            const i = (start + j) * 6, x = vertices[i] - cx, z = vertices[i + 2], r = Math.hypot(x, z), angle = Math.atan2(z, x);
            const support = radial(boundary, cx, angle), falloff = Math.max(0, 1 - (Math.max(0, ring - 3) / 12) ** 2);
            // The cuff can compress to meet the body. The crown retains its volume,
            // yielding only locally where the supported body would press into felt.
            const softness = shape === 'boom' ? .055 : draped ? .070 : .035;
            const lowerFlex = ring < 4 ? 1 : draped ? Math.max(0, 1 - (ring - 3) / 5) : 0;
            const change = ring < 4 ? Math.max(-softness, Math.min(.035, support + .018 - r)) :
                Math.max(0, clamp(support + .018 - r, .030)) * falloff + Math.min(0, clamp(support + .018 - r, softness)) * lowerFlex;
            deltas.push(change);
        }
        for (let j = 0; j < SEGMENTS; j++) {
            const i = (start + j) * 6, x = vertices[i] - cx, z = vertices[i + 2], r = Math.hypot(x, z);
            const delta = (deltas[(j + 63) % 64] + deltas[j] * 2 + deltas[(j + 1) % 64]) / 4;
            if (r > 1e-7) {
                vertices[i] = cx + x * (1 + delta / r);
                vertices[i + 2] = z * (1 + delta / r);
            }
            if (shape === 'boom') {
                const free = Math.max(0, -x / (r || 1));
                vertices[i + 1] -= .038 * free * free * Math.max(0, 1 - ring / 13);
            }
        }
    }
    // Recompute smooth normals after the local felt deformation.
    for (let i = 0; i < vertices.length; i += 6)
        vertices.fill(0, i + 3, i + 6);
    for (let i = 0; i < ref.indices.length; i += 3) {
        const a = ref.indices[i] * 6, b = ref.indices[i + 1] * 6, c = ref.indices[i + 2] * 6;
        const ux = vertices[b] - vertices[a], uy = vertices[b + 1] - vertices[a + 1], uz = vertices[b + 2] - vertices[a + 2];
        const vx = vertices[c] - vertices[a], vy = vertices[c + 1] - vertices[a + 1], vz = vertices[c + 2] - vertices[a + 2];
        for (const p of [a, b, c]) {
            vertices[p + 3] += uy * vz - uz * vy;
            vertices[p + 4] += uz * vx - ux * vz;
            vertices[p + 5] += ux * vy - uy * vx;
        }
    }
    for (let i = 0; i < vertices.length; i += 6) {
        const n = Math.hypot(vertices[i + 3], vertices[i + 4], vertices[i + 5]) || 1;
        for (let k = 3; k < 6; k++)
            vertices[i + k] /= n;
    }
    if (cache.size >= 8)
        cache.delete(cache.keys().next().value);
    cache.set(key, vertices);
    return vertices;
}
/** Felt is a shell, not a one-sided surface. Keep the head aperture open while
 * lining the crown and joining both skins around its turned lower edge. */
function linedFelt(outer, mesh) {
    const skinCount = 16 * SEGMENTS + 1, offset = outer.length / 6, thickness = .006;
    const vertices = new Float32Array(outer.length + skinCount * 6);
    vertices.set(outer);
    for (let i = 0; i < skinCount; i++)
        for (let k = 0; k < 3; k++) {
            vertices[(offset + i) * 6 + k] = outer[i * 6 + k] - outer[i * 6 + 3 + k] * thickness;
            vertices[(offset + i) * 6 + 3 + k] = -outer[i * 6 + 3 + k];
        }
    const band = Array.from(mesh.indices.subarray(0, mesh.bandIndexCount));
    // Interior felt uses the cuff material, making the opening read as a lined
    // cavity even when the outer skin is back-facing from a low camera.
    const skinIndexCount = 15 * SEGMENTS * 6 + SEGMENTS * 3;
    for (let i = 0; i < skinIndexCount; i += 3)
        band.push(mesh.indices[i] + offset, mesh.indices[i + 2] + offset, mesh.indices[i + 1] + offset);
    for (let i = 0; i < SEGMENTS; i++) {
        const j = (i + 1) % SEGMENTS;
        band.push(i, j, offset + i, j, offset + j, offset + i);
    }
    const indices = new Uint16Array(band.length + mesh.indices.length - mesh.bandIndexCount);
    indices.set(band);
    indices.set(mesh.indices.subarray(mesh.bandIndexCount), band.length);
    return { ...mesh, vertices, indices, bandIndexCount: band.length, crownIndexCount: mesh.indices.length - mesh.bandIndexCount };
}
export function wornBeret(contour, scales, shape, rotation = [0, 0, 0]) {
    const ref = referenceHat();
    const tilt = (shape === 'heart' ? -18 : shape === 'triangle' || shape === 'pixelTriangle' ? -14 : shape === 'boom' ? -32 : shape === 'square' || shape === 'bun' ? -42 : -30) * Math.PI / 180;
    const co = Math.cos(tilt), si = Math.sin(tilt);
    let sx = 0, sy = -Infinity;
    for (const p of contour.points) {
        const x = p[0] * scales[0], y = p[1] * scales[1], py = -si * x + co * y;
        if (py > sy) {
            sx = co * x + si * y;
            sy = py;
        }
    }
    const deeplySeated = DRAPED_FAMILIES.includes(shape);
    const insertion = shape === 'heart' ? ref.support[1] : shape === 'triangle' || shape === 'pixelTriangle' ? .13 : shape === 'boom' ? .11 : shape === 'square' || shape === 'bun' ? .115 : shape === 'softBoom' ? .075 : deeplySeated ? .100 : .055;
    const px = sx - ref.support[0], py = sy - insertion;
    const pivot = [co * px - si * py, si * px + co * py, 0];
    const lined = linedFelt(flexibleFelt(contour, scales, shape, co, si, px, py), ref.mesh);
    const vertices = lined.vertices, matrix = transform([0, 0, 0], rotation);
    for (let i = 0; i < vertices.length; i += 6)
        for (const offset of [0, 3]) {
            const x = vertices[i + offset], y = -vertices[i + offset + 2], z = vertices[i + offset + 1];
            const rx = matrix[0] * x + matrix[4] * y + matrix[8] * z;
            const ry = matrix[1] * x + matrix[5] * y + matrix[9] * z;
            const rz = matrix[2] * x + matrix[6] * y + matrix[10] * z;
            vertices[i + offset] = co * rx - si * rz + (offset === 0 ? pivot[0] : 0);
            vertices[i + offset + 1] = si * rx + co * rz + (offset === 0 ? pivot[1] : 0);
            vertices[i + offset + 2] = -ry;
        }
    return { ...lined, vertices, seating: -insertion };
}
