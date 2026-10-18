import { transform } from '../core/math.js';
import { bodyGeometry } from './body-geometry.js';
const SEGMENTS = 64;
/**
 * One continuous shell, from the interior dome around a rolled opening, up the
 * narrow band and underfold, across a soft sloping crown, into its cabillou.
 * An inner dome gives a pointed head somewhere to go: fitting must not turn a
 * beret into a broad solid puck perched on a single semantic anchor.
 */
function makeGarment() {
    const ring = (rx, ry, x, z, slope = 0, y = 0.012) => ({ rx, ry, x, y, z, slope });
    const rings = [
        ring(0, 0, -0.065, 0.210),
        ring(0.085, 0.068, -0.058, 0.200),
        ring(0.160, 0.126, -0.038, 0.175),
        ring(0.250, 0.200, -0.014, 0.130),
        ring(0.292, 0.234, 0, 0.065),
        ring(0.300, 0.240, 0, 0.005),
        ring(0.300, 0.240, 0, -0.025),
        ring(0.304, 0.244, 0, -0.035),
        ring(0.314, 0.252, 0, -0.037),
        ring(0.323, 0.260, 0, -0.030),
        ring(0.325, 0.262, 0, -0.018),
        ring(0.325, 0.262, 0, 0.006),
        ring(0.330, 0.268, 0.004, 0.016),
        ring(0.340, 0.275, 0.018, 0.018, -0.004),
        ring(0.355, 0.280, 0.036, 0.024, -0.010),
        ring(0.380, 0.290, 0.047, 0.038, -0.016),
        ring(0.391, 0.298, 0.049, 0.059, -0.022),
        ring(0.387, 0.296, 0.040, 0.084, -0.030),
        ring(0.368, 0.280, 0.022, 0.112, -0.038),
        ring(0.331, 0.254, -0.003, 0.145, -0.041),
        ring(0.278, 0.215, -0.029, 0.175, -0.033),
        ring(0.214, 0.166, -0.050, 0.196, -0.022),
        ring(0.142, 0.112, -0.064, 0.210, -0.011),
        ring(0.077, 0.061, -0.070, 0.216, -0.004),
        ring(0.028, 0.025, -0.072, 0.217),
        ring(0.017, 0.017, -0.072, 0.221),
        ring(0.015, 0.015, -0.073, 0.231),
        ring(0.014, 0.014, -0.077, 0.249, 0, 0.014),
        ring(0.012, 0.012, -0.081, 0.263, 0, 0.016),
        ring(0.008, 0.008, -0.083, 0.269, 0, 0.017),
        ring(0, 0, -0.083, 0.272, 0, 0.017),
    ];
    const points = [], indices = [], starts = [];
    for (const [j, r] of rings.entries()) {
        starts.push(points.length);
        const count = r.rx === 0 ? 1 : SEGMENTS;
        for (let i = 0; i < count; i++) {
            const angle = i / SEGMENTS * Math.PI * 2, c = Math.cos(angle), s = Math.sin(angle);
            // Broad, gentle felt irregularity. The band and stem retain clean structure.
            const cloth = j >= 13 && j <= 23 ? Math.sin((j - 13) / 10 * Math.PI) : 0;
            const fullness = 1 + cloth * (0.018 * Math.cos(2 * angle + 0.5) + 0.010 * Math.sin(3 * angle - 0.6));
            const loft = Math.max(0, Math.min(1, (j - 12) / 9));
            const roundness = .055 * loft * loft * (3 - 2 * loft);
            points.push([r.x + r.rx * c * fullness, r.y + r.ry * s * fullness, r.z + roundness + r.slope * c + cloth * 0.0035 * Math.sin(2 * angle - 0.4)]);
        }
    }
    let bandIndexCount = 0;
    for (let j = 0; j < rings.length - 1; j++) {
        const start = starts[j], next = starts[j + 1];
        for (let i = 0; i < SEGMENTS; i++) {
            const k = (i + 1) % SEGMENTS;
            // The profile proceeds from the inward-facing dome to the opening and
            // then upward on the exterior, so the same winding works throughout.
            if (j === 0)
                indices.push(start, next + k, next + i);
            else if (j === rings.length - 2)
                indices.push(start + i, start + k, next);
            else
                indices.push(start + i, start + k, next + i, start + k, next + k, next + i);
        }
        if (j === 11)
            bandIndexCount = indices.length;
    }
    const vertices = new Float32Array(points.length * 6);
    points.forEach((point, i) => vertices.set(point, i * 6));
    accumulateNormals(vertices, indices);
    return { geometry: { vertices, indices: new Uint16Array(indices) }, bandIndexCount };
}
function accumulateNormals(vertices, indices) {
    for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i] * 6, b = indices[i + 1] * 6, c = indices[i + 2] * 6;
        const ux = vertices[b] - vertices[a], uy = vertices[b + 1] - vertices[a + 1], uz = vertices[b + 2] - vertices[a + 2];
        const vx = vertices[c] - vertices[a], vy = vertices[c + 1] - vertices[a + 1], vz = vertices[c + 2] - vertices[a + 2];
        const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
        for (const p of [a, b, c])
            for (let k = 0; k < 3; k++)
                vertices[p + 3 + k] += n[k];
    }
    for (let i = 0; i < vertices.length; i += 6) {
        const length = Math.hypot(vertices[i + 3], vertices[i + 4], vertices[i + 5]);
        for (let k = 3; k < 6; k++)
            vertices[i + k] /= length || 1;
    }
}
const garment = makeGarment();
const SIZE = .72;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// Conservative clearance envelope inside the physical lining. A strictly tapered
// clearance through the straight band avoids a grazing vertex switching between
// the two ends of an exactly cylindrical contact surface during tiny rotations.
const inner = [
    [0, 0, -.065, .210], [.085, .068, -.058, .200], [.160, .126, -.038, .175],
    [.250, .200, -.014, .130], [.292, .234, 0, .065], [.296, .236, 0, .005],
    [.300, .240, 0, -.025], [.304, .244, 0, -.035], [.314, .252, 0, -.037],
].map(([rx, rz, x, y]) => [rx * SIZE, rz * SIZE, x * SIZE, (y + .037) * SIZE]);
function cavity(y) {
    if (y > inner[0][3])
        return;
    for (let i = 0; i < inner.length - 1; i++) {
        const a = inner[i], b = inner[i + 1];
        if (y >= b[3]) {
            const t = (y - b[3]) / (a[3] - b[3]);
            return [b[0] + (a[0] - b[0]) * t, b[1] + (a[1] - b[1]) * t, b[2] + (a[2] - b[2]) * t];
        }
    }
    return inner.at(-1).slice(0, 3);
}
const fittedCache = new WeakMap();
/** One positive radial coordinate map is shared by lining, rim and crown.
 * No ring can be independently displaced through its neighbours. */
function fit(contour, depth, rotation, tilt, center) {
    let cache = fittedCache.get(contour);
    if (!cache) {
        cache = new Map();
        fittedCache.set(contour, cache);
    }
    const key = [depth, tilt, ...rotation, ...center ?? []].join(':');
    const hit = cache.get(key);
    if (hit)
        return hit;
    const co = Math.cos(tilt), si = Math.sin(tilt), m = transform([0, 0, 0], rotation);
    const basis = [0, 4, 8].map(i => [co * m[i] - si * m[i + 2], si * m[i] + co * m[i + 2], -m[i + 1]]);
    const body = bodyGeometry(contour), points = [];
    let top = -Infinity, neutralTop = -Infinity;
    for (let i = 0; i < body.vertices.length; i += 6) {
        const p = [body.vertices[i] * .59, body.vertices[i + 1] * .59, body.vertices[i + 2] * depth];
        const q = basis.map(v => dot(v, p));
        points.push(q);
        top = Math.max(top, q[2]);
        neutralTop = Math.max(neutralTop, -si * p[0] + co * p[1]);
    }
    // A smooth support neighbourhood avoids discrete argmax jumps during turns.
    let sx = 0, sz = 0, total = 0;
    for (const p of points) {
        const w = Math.max(0, 1 - (top - p[2]) / .018) ** 3;
        sx += p[0] * w;
        sz += p[1] * w;
        total += w;
    }
    sx = center?.[0] ?? sx / total;
    sz = center?.[1] ?? sz / total;
    if (center && rotation.some(value => value !== 0)) {
        // The curated point belongs to the body, not to the rotating garment.
        // Reproject it into the current wearing frame so a turn cannot sweep
        // the opening away from its support and force a sudden upward reseat.
        const support = [co * center[0] - si * neutralTop, si * center[0] + co * neutralTop, -center[1]];
        sx = dot(basis[0], support);
        sz = dot(basis[1], support);
    }
    const px = sx + .065 * SIZE, pz = sz - .012 * SIZE;
    const edges = [];
    const seen = new Set(), n = points.length;
    for (let i = 0; i < body.indices.length; i += 3)
        for (let j = 0; j < 3; j++) {
            const a = body.indices[i + j], b = body.indices[i + (j + 1) % 3], k = Math.min(a, b) * n + Math.max(a, b);
            if (seen.has(k))
                continue;
            seen.add(k);
            const low = Math.min(points[a][2], points[b][2]), high = Math.max(points[a][2], points[b][2]);
            if (high > top - .145)
                edges.push({ a: points[a], b: points[b], low, high });
        }
    const fieldAt = (insertion) => {
        const py = top - insertion, field = Array(SEGMENTS).fill(.95);
        // Smooth support weights vanish at the vertical window boundaries.
        // Hard horizontal slices let a grazing lobe suddenly widen a whole
        // sector; this continuous field only controls bounded cloth fullness.
        // Collision clearance remains governed by the independent inner envelope.
        for (const point of points) {
            const height = point[2] - py, v = (height - .015) / .045;
            const verticalWeight = Math.max(0, 1 - v * v) ** 2;
            if (verticalWeight === 0)
                continue;
            const x = point[0] - px, z = point[1] - pz;
            const angle = (Math.atan2(z, x) + Math.PI * 2) % (Math.PI * 2), bin = angle / (Math.PI * 2) * SEGMENTS;
            const c = Math.cos(angle), s = Math.sin(angle), r = 1 / Math.sqrt((c / (.300 * SIZE)) ** 2 + (s / (.240 * SIZE)) ** 2);
            const required = clamp((Math.hypot(x, z) + .005) / r, .95, 1.10);
            for (let k = -4; k <= 4; k++) {
                const j = (Math.floor(bin) + k + SEGMENTS) % SEGMENTS;
                const d = Math.min(Math.abs(j - bin), SEGMENTS - Math.abs(j - bin)) / 4;
                const w = Math.max(0, 1 - d * d) ** 2;
                field[j] = Math.max(field[j], .95 + (required - .95) * w * verticalWeight);
            }
        }
        for (let pass = 0; pass < 6; pass++) {
            const copy = [...field];
            for (let i = 0; i < SEGMENTS; i++)
                field[i] = (copy[(i + 63) % 64] + copy[i] * 2 + copy[(i + 1) % 64]) / 4;
        }
        return field;
    };
    const scaleAt = (field, x, z, y) => {
        const a = ((Math.atan2(z, x) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * SEGMENTS, i = Math.floor(a), t = a - i;
        const amount = field[i] * (1 - t) + field[(i + 1) % SEGMENTS] * t;
        const h = clamp((y - .03) / .12, 0, 1), weight = 1 - h * h * (3 - 2 * h);
        return 1 + (amount - 1) * weight;
    };
    const fits = (insertion) => {
        const py = top - insertion, minimumField = .95;
        let lastY = NaN, s = 0, rx = 0, rz = 0, cx = 0, valid = false;
        const contains = (x, z, y) => {
            if (y !== lastY) {
                lastY = y;
                const room = cavity(y);
                valid = !!room;
                if (room) {
                    // Keep this safety envelope nested. The actual cloth map
                    // relaxes toward scale 1 above the cuff; including that
                    // relaxation here can create expanding contact sections.
                    s = minimumField;
                    rx = room[0] - .003;
                    rz = room[1] - .003;
                    cx = room[2];
                    valid = rx > 0 && rz > 0;
                }
            }
            if (!valid)
                return false;
            x /= s;
            z /= s;
            return ((x - cx) / rx) ** 2 + ((z - .012 * SIZE) / rz) ** 2 <= 1;
        };
        for (const p of points) {
            const y = p[2] - py;
            if (y >= 0 && !contains(p[0] - px, p[1] - pz, y))
                return false;
        }
        // Vertices alone miss triangles passing through the opening between mesh
        // rows. Include exact body-edge sections throughout the complete inner wall.
        const levels = new Set([0, ...inner.map(r => r[3]).filter(y => y >= 0 && y <= insertion)]);
        for (let y = 0; y <= insertion; y += .004)
            levels.add(y);
        for (const p of points) {
            const y = p[2] - py;
            if (y >= 0 && y <= insertion)
                levels.add(y);
        }
        for (const y of levels)
            for (const { a, b, low, high } of edges) {
                const level = py + y;
                if (level < low || level >= high || high - low < 1e-10)
                    continue;
                const t = (level - a[2]) / (b[2] - a[2]);
                if (!contains(a[0] + (b[0] - a[0]) * t - px, a[1] + (b[1] - a[1]) * t - pz, y))
                    return false;
            }
        return true;
    };
    let lo = 0, hi = .145;
    for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid))
            lo = mid;
        else
            hi = mid;
    }
    const insertion = lo, field = fieldAt(insertion), py = top - insertion;
    const vertices = new Float32Array(garment.geometry.vertices.length);
    for (let i = 0; i < vertices.length; i += 6) {
        let x = garment.geometry.vertices[i] * SIZE, z = garment.geometry.vertices[i + 1] * SIZE;
        const y = (garment.geometry.vertices[i + 2] + .037) * SIZE;
        const s = scaleAt(field, x, z, y);
        x = x * s + px;
        z = z * s + pz;
        const q = [x, z, y + py];
        for (let k = 0; k < 3; k++)
            vertices[i + k] = basis[0][k] * q[0] + basis[1][k] * q[1] + basis[2][k] * q[2];
    }
    accumulateNormals(vertices, Array.from(garment.geometry.indices));
    const result = { vertices, indices: garment.geometry.indices, bandIndexCount: garment.bandIndexCount, crownIndexCount: garment.geometry.indices.length - garment.bandIndexCount, seating: -insertion };
    if (cache.size >= 8)
        cache.delete(cache.keys().next().value);
    cache.set(key, result);
    return result;
}
export function wornBeret(contour, scales, shape, rotation = [0, 0, 0], tilt = (shape === 'cookie6Sided' ? -40 : shape === 'heart' ? -18 : shape === 'triangle' || shape === 'pixelTriangle' ? -14 : shape === 'boom' ? -32 : shape === 'square' || shape === 'bun' ? -42 : -30) * Math.PI / 180, center) {
    const squash = scales[1] / .59, stretch = 1 / Math.sqrt(squash), base = fit(contour, scales[2] / stretch, rotation, tilt, center);
    const vertices = new Float32Array(base.vertices);
    for (let i = 0; i < vertices.length; i += 6) {
        vertices[i] *= stretch;
        vertices[i + 1] *= squash;
        vertices[i + 2] *= stretch;
        vertices[i + 3] /= stretch;
        vertices[i + 4] /= squash;
        vertices[i + 5] /= stretch;
        const n = Math.hypot(vertices[i + 3], vertices[i + 4], vertices[i + 5]) || 1;
        for (let k = 3; k < 6; k++)
            vertices[i + k] /= n;
    }
    return { ...base, vertices };
}
