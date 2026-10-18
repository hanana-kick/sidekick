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
 * A hat is an open garment, not an object resting on the tallest triangle.
 * Horizontal sections define its fitted opening; the upper body occupies the
 * opaque crown. Hidden penetration at the inner turned hem is intentional.
 */
function makeWornBeret(contour, scales, shape) {
    const mesh = bodyGeometry(contour), v = mesh.vertices, points = [];
    let top = -Infinity, bottom = Infinity;
    for (let i = 0; i < v.length; i += 6) {
        const p = [v[i] * scales[0], v[i + 1] * scales[1], v[i + 2] * scales[2]];
        points.push(p);
        top = Math.max(top, p[1]);
        bottom = Math.min(bottom, p[1]);
    }
    const height = top - bottom, bandHeight = height * .055;
    let cut = top - height * .255;
    const lobe = shape === 'heart';
    const sectionAt = (y) => {
        const result = [];
        for (let i = 0; i < mesh.indices.length; i += 3) {
            const triangle = [points[mesh.indices[i]], points[mesh.indices[i + 1]], points[mesh.indices[i + 2]]];
            for (let j = 0; j < 3; j++) {
                const a = triangle[j], b = triangle[(j + 1) % 3];
                if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
                    const t = (y - a[1]) / (b[1] - a[1]);
                    result.push([a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t]);
                }
            }
        }
        const section = hull(result);
        if (!lobe)
            return section;
        const clipped = [];
        for (let i = 0; i < section.length; i++) {
            const a = section[i], b = section[(i + 1) % section.length];
            if (a[0] >= .025)
                clipped.push(a);
            if ((a[0] < .025) !== (b[0] < .025))
                clipped.push([.025, a[1] + (b[1] - a[1]) * (.025 - a[0]) / (b[0] - a[0])]);
        }
        return clipped;
    };
    const fullWidth = Math.max(...points.map(p => p[0])) - Math.min(...points.map(p => p[0]));
    if (!lobe)
        for (let i = 0; i < 5; i++) {
            const section = sectionAt(cut), width = Math.max(...section.map(p => p[0])) - Math.min(...section.map(p => p[0]));
            if (width >= fullWidth * .64 || cut <= top - height * .36)
                break;
            cut -= height * .025;
        }
    const base = sectionAt(cut), cx = (Math.min(...base.map(p => p[0])) + Math.max(...base.map(p => p[0]))) / 2;
    const bandEnvelope = hull([...base, ...sectionAt(cut + bandHeight), ...points.filter(p => p[1] >= cut && p[1] <= cut + bandHeight && (!lobe || p[0] >= .025)).map((p) => [p[0], p[2]])]);
    const bandRadius = Array.from({ length: SEGMENTS }, (_, i) => radial(bandEnvelope, cx, i / SEGMENTS * Math.PI * 2));
    const baseRadius = Array.from({ length: SEGMENTS }, (_, i) => radial(base, cx, i / SEGMENTS * Math.PI * 2));
    const radiusX = Math.max(...baseRadius), pad = .008;
    const fullnessScale = Math.max(1, Math.min(1.40, (top - cut) / radiusX * 1.05));
    const vertices = [], indices = [];
    // A turned lower hem, a broad dark cuff, then the asymmetric felt crown.
    const rings = [
        { y: cut + .010, puff: -.005, blend: 1, shift: 0 },
        { y: cut - .004, puff: .006, blend: 1, shift: 0 },
        { y: cut + .006, puff: .015, blend: 1, shift: 0 },
        { y: cut + bandHeight, puff: .012, blend: 1, shift: 0 },
        ...Array.from({ length: 12 }, (_, j) => {
            const t = j / 11;
            return { y: cut + bandHeight + .008 + (top + .075 - cut - bandHeight) * t,
                puff: .055 + radiusX * .34 * Math.sin(Math.PI * t), blend: Math.sqrt(Math.max(0, 1 - t * t)) * (1 + .12 * Math.sin(Math.PI * t)), shift: -.105 * t };
        }),
    ];
    for (let ring = 0; ring < rings.length; ring++) {
        const r = rings[ring], section = sectionAt(r.y), center = cx + r.shift;
        for (let i = 0; i < SEGMENTS; i++) {
            const a = i / SEGMENTS * Math.PI * 2;
            const body = radial(section, center, a);
            const authored = baseRadius[i] * r.blend * fullnessScale + r.puff;
            const radius = ring < 4 ? Math.max(body, bandRadius[i]) + r.puff : Math.max(body + pad, authored);
            // Low-frequency felt fullness, not high-frequency folds or a rigid disk.
            const fullness = ring < 4 ? 0 : .006 * Math.sin(a * 2 + .4) * Math.sin((ring - 3) / (rings.length - 3) * Math.PI);
            vertices.push(center + (radius + fullness) * Math.cos(a), r.y + (ring > 3 ? -.018 * Math.cos(a) * (ring - 3) / (rings.length - 3) : 0), (radius + fullness) * Math.sin(a), 0, 0, 0);
        }
    }
    for (let ring = 0; ring < rings.length - 1; ring++)
        for (let i = 0; i < SEGMENTS; i++) {
            const a = ring * SEGMENTS + i, b = ring * SEGMENTS + (i + 1) % SEGMENTS, c = a + SEGMENTS, d = b + SEGMENTS;
            indices.push(a, c, b, b, c, d);
        }
    const cap = vertices.length / 6;
    vertices.push(cx - .105, top + .081, 0, 0, 1, 0);
    for (let i = 0; i < SEGMENTS; i++)
        indices.push((rings.length - 1) * SEGMENTS + i, cap, (rings.length - 1) * SEGMENTS + (i + 1) % SEGMENTS);
    // Small fabric stem, part of the same mesh and draw range.
    const stem = vertices.length / 6;
    for (let ring = 0; ring < 3; ring++)
        for (let i = 0; i < 12; i++) {
            const a = i / 12 * Math.PI * 2, radius = ring === 2 ? .002 : .012;
            vertices.push(cx - .105 - ring * .004 + radius * Math.cos(a), top + .08 + ring * .019, radius * Math.sin(a), 0, 0, 0);
        }
    for (let ring = 0; ring < 2; ring++)
        for (let i = 0; i < 12; i++) {
            const a = stem + ring * 12 + i, b = stem + ring * 12 + (i + 1) % 12;
            indices.push(a, a + 12, b, b, a + 12, b + 12);
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
    const bandIndexCount = 3 * SEGMENTS * 6;
    return { mesh: { vertices: output, indices: new Uint16Array(indices), bandIndexCount, crownIndexCount: indices.length - bandIndexCount, seating: cut - top }, pivot: [cx, cut, 0] };
}
// Shape morphs own short-lived contours; WeakMap entries disappear with them.
// Breathing/squash and explicitly animated cap poses reuse the fitted garment.
const fitted = new WeakMap();
export function wornBeret(contour, scales, shape, rotation = [0, 0, 0]) {
    const squash = scales[1] / .59, stretch = 1 / Math.sqrt(squash), depth = scales[2] / stretch;
    const key = shape + ':' + depth.toFixed(10);
    let cached = fitted.get(contour);
    if (!cached || cached.key !== key) {
        cached = { key, ...makeWornBeret(contour, [.59, .59, depth], shape) };
        fitted.set(contour, cached);
    }
    if (squash === 1 && rotation.every(value => value === 0))
        return cached.mesh;
    const output = new Float32Array(cached.mesh.vertices), matrix = transform([0, 0, 0], rotation);
    const cx = cached.pivot[0] * stretch, cut = cached.pivot[1] * squash;
    for (let i = 0; i < output.length; i += 6) {
        output[i] *= stretch;
        output[i + 1] *= squash;
        output[i + 2] *= stretch;
        output[i + 3] /= stretch;
        output[i + 4] /= squash;
        output[i + 5] /= stretch;
        const norm = Math.hypot(output[i + 3], output[i + 4], output[i + 5]);
        for (let k = 3; k < 6; k++)
            output[i + k] /= norm || 1;
        for (const normal of [false, true]) {
            const offset = i + (normal ? 3 : 0);
            const x = output[offset] - (normal ? 0 : cx), y = -output[offset + 2], z = output[offset + 1] - (normal ? 0 : cut);
            const rx = matrix[0] * x + matrix[4] * y + matrix[8] * z;
            const ry = matrix[1] * x + matrix[5] * y + matrix[9] * z;
            const rz = matrix[2] * x + matrix[6] * y + matrix[10] * z;
            output[offset] = rx + (normal ? 0 : cx);
            output[offset + 1] = rz + (normal ? 0 : cut);
            output[offset + 2] = -ry;
        }
    }
    return { ...cached.mesh, vertices: output, seating: cached.mesh.seating * squash };
}
