import { wornBeret } from './worn-beret.js';
import { shapeContour } from '../core/contours.js';
import { resolveShapeProfile } from '../core/shape-profiles.js';
import { BODY_SIZE, sampleAccessorySurface } from '../core/surface.js';
import { transform } from '../core/math.js';
import { bodyGeometry } from './body-geometry.js';
/** Historical v5 stand-off, retained only for legacy import/regression diagnostics. */
export const BERET_SEATING_OFFSET = 0.035;
/** A small clearance for the rendered triangles, rather than a visible hover gap. */
export const BERET_CLEARANCE = 0.001;
const SEGMENTS = 64;
/**
 * One continuous shell, from the interior dome around a rolled opening, up the
 * narrow band and underfold, across a soft sloping crown, into its cabillou.
 * An inner dome gives a pointed head somewhere to go: fitting must not turn a
 * beret into a broad solid puck perched on a single semantic anchor.
 */
function makeShell() {
    const ring = (rx, ry, x, z, slope = 0, y = 0.012) => ({ rx, ry, x, y, z, slope });
    const rings = [
        ring(0, 0, -0.065, 0.177),
        ring(0.075, 0.060, -0.058, 0.173, -0.010),
        ring(0.140, 0.110, -0.038, 0.153, -0.022),
        ring(0.190, 0.148, -0.014, 0.112, -0.020),
        ring(0.210, 0.165, 0, 0.058, -0.010),
        ring(0.213, 0.168, 0, 0.005),
        ring(0.213, 0.168, 0, -0.025),
        ring(0.217, 0.172, 0, -0.035),
        ring(0.227, 0.180, 0, -0.037),
        ring(0.236, 0.188, 0, -0.030),
        ring(0.238, 0.190, 0, -0.018),
        ring(0.238, 0.190, 0, 0.006),
        ring(0.245, 0.196, 0.004, 0.016),
        ring(0.274, 0.216, 0.018, 0.018, -0.004),
        ring(0.325, 0.251, 0.036, 0.024, -0.010),
        ring(0.371, 0.282, 0.047, 0.038, -0.016),
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
            points.push([r.x + r.rx * c * fullness, r.y + r.ry * s * fullness, r.z + r.slope * c + cloth * 0.0035 * Math.sin(2 * angle - 0.4)]);
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
function makeTriangle(a, b, c) {
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (Math.abs(area) < 1e-12)
        return undefined;
    const zx = ((b[2] - a[2]) * (c[1] - a[1]) - (c[2] - a[2]) * (b[1] - a[1])) / area;
    const zy = ((b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2])) / area;
    return { a, b, c, minX: Math.min(a[0], b[0], c[0]), maxX: Math.max(a[0], b[0], c[0]), minY: Math.min(a[1], b[1], c[1]), maxY: Math.max(a[1], b[1], c[1]), minZ: Math.min(a[2], b[2], c[2]), zx, zy, z0: a[2] - zx * a[0] - zy * a[1], area };
}
/** Five-point open circlet. The lower rolled band is structurally darker. */
function makeCrownShell() {
    const segments = 80, points = [], indices = [];
    // Walk a closed wall section from the inner bottom, around the outer band,
    // over the pointed top and back down the inner wall. There is no solid lid.
    for (let ring = 0; ring < 7; ring++)
        for (let i = 0; i < segments; i++) {
            const angle = i / segments * Math.PI * 2 - Math.PI / 2;
            const phase = (i / segments * 5) % 1, peak = 1 - Math.abs(phase * 2 - 1);
            const outer = ring >= 1 && ring <= 3, rx = outer ? .255 : .231, ry = outer ? .196 : .172;
            const z = ring <= 1 || ring === 6 ? -.030 : ring === 2 || ring === 5 ? .034 : .104 + .132 * peak;
            points.push([rx * Math.cos(angle), ry * Math.sin(angle), z]);
        }
    let bandIndexCount = 0;
    for (let ring = 0; ring < 6; ring++) {
        for (let i = 0; i < segments; i++) {
            const next = (i + 1) % segments, a = ring * segments + i, b = ring * segments + next, c = (ring + 1) * segments + i, d = (ring + 1) * segments + next;
            indices.push(a, b, c, b, d, c);
        }
        if (ring === 1)
            bandIndexCount = indices.length;
    }
    // Weld the repeated inner-bottom ring to keep the shell topologically closed.
    for (let i = 0; i < indices.length; i++)
        if (indices[i] >= 6 * segments)
            indices[i] -= 6 * segments;
    points.length = 6 * segments;
    const vertices = new Float32Array(points.length * 6);
    points.forEach((p, i) => vertices.set(p, i * 6));
    accumulateNormals(vertices, indices);
    return { geometry: { vertices, indices: new Uint16Array(indices) }, bandIndexCount };
}
const shells = { beret: makeShell(), crown: makeCrownShell() };
// One bounded CPU cache. Shape/depth/squash edits reuse the same rotated shell;
// rotations replace this entry instead of accumulating animation snapshots.
let projectedKey = '';
let projectedShell;
function projectShell(rotation, preset) {
    const shell = shells[preset], key = preset + rotation.join(',');
    if (projectedKey === key && projectedShell)
        return projectedShell;
    const matrix = transform([0, 0, 0], rotation), vertices = new Float32Array(shell.geometry.vertices.length), points = [];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity;
    for (let i = 0; i < vertices.length; i += 6) {
        for (let k = 0; k < 3; k++) {
            vertices[i + k] = matrix[k] * shell.geometry.vertices[i] + matrix[4 + k] * shell.geometry.vertices[i + 1] + matrix[8 + k] * shell.geometry.vertices[i + 2];
            vertices[i + 3 + k] = matrix[k] * shell.geometry.vertices[i + 3] + matrix[4 + k] * shell.geometry.vertices[i + 4] + matrix[8 + k] * shell.geometry.vertices[i + 5];
        }
        const p = [vertices[i], vertices[i + 1], vertices[i + 2]];
        points.push(p);
        minX = Math.min(minX, p[0]);
        maxX = Math.max(maxX, p[0]);
        minY = Math.min(minY, p[1]);
        maxY = Math.max(maxY, p[1]);
        minZ = Math.min(minZ, p[2]);
    }
    const lower = [], grid = new Map(), indices = shell.geometry.indices;
    for (let i = 0; i < indices.length; i += 3) {
        const triangle = makeTriangle(points[indices[i]], points[indices[i + 1]], points[indices[i + 2]]);
        // A closed consistently wound shell's lowest envelope is always downward
        // facing in this frame. This includes the crown/stem when the hat is flipped.
        if (!triangle || triangle.area >= 0)
            continue;
        const index = lower.push(triangle) - 1;
        for (let x = Math.floor(triangle.minX * 32); x <= Math.floor(triangle.maxX * 32); x++)
            for (let y = Math.floor(triangle.minY * 32); y <= Math.floor(triangle.maxY * 32); y++) {
                const cell = `${x},${y}`, list = grid.get(cell) ?? [];
                list.push(index);
                grid.set(cell, list);
            }
    }
    projectedKey = key;
    projectedShell = { vertices, lower, grid, minX, maxX, minY, maxY, minZ };
    return projectedShell;
}
function contains(t, p) {
    const a = t.a, b = t.b, c = t.c, sign = Math.sign(t.area);
    return ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) * sign >= -1e-10
        && ((c[0] - b[0]) * (p[1] - b[1]) - (c[1] - b[1]) * (p[0] - b[0])) * sign >= -1e-10
        && ((a[0] - c[0]) * (p[1] - c[1]) - (a[1] - c[1]) * (p[0] - c[0])) * sign >= -1e-10;
}
/** Maximum of two linear height fields over their exact triangle intersection. */
function separation(body, hat, current) {
    const evaluate = (x, y) => { current = Math.max(current, (body.zx - hat.zx) * x + (body.zy - hat.zy) * y + body.z0 - hat.z0); };
    if (contains(hat, body.a))
        evaluate(body.a[0], body.a[1]);
    if (contains(hat, body.b))
        evaluate(body.b[0], body.b[1]);
    if (contains(hat, body.c))
        evaluate(body.c[0], body.c[1]);
    if (contains(body, hat.a))
        evaluate(hat.a[0], hat.a[1]);
    if (contains(body, hat.b))
        evaluate(hat.b[0], hat.b[1]);
    if (contains(body, hat.c))
        evaluate(hat.c[0], hat.c[1]);
    for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) {
            const a = i === 0 ? body.a : i === 1 ? body.b : body.c, b = i === 0 ? body.b : i === 1 ? body.c : body.a;
            const c = j === 0 ? hat.a : j === 1 ? hat.b : hat.c, d = j === 0 ? hat.b : j === 1 ? hat.c : hat.a;
            const ux = b[0] - a[0], uy = b[1] - a[1], vx = d[0] - c[0], vy = d[1] - c[1], determinant = ux * vy - uy * vx;
            if (Math.abs(determinant) < 1e-12)
                continue;
            const dx = c[0] - a[0], dy = c[1] - a[1], t = (dx * vy - dy * vx) / determinant, u = (dx * uy - dy * ux) / determinant;
            if (t >= -1e-9 && t <= 1 + 1e-9 && u >= -1e-9 && u <= 1 + 1e-9)
                evaluate(a[0] + t * ux, a[1] + t * uy);
        }
    return current;
}
/**
 * Fit the immutable shell to the already-cached body triangles. A parallel-axis
 * height comparison across triangle intersections gives the smallest rigid
 * seating translation, including intervening peaks on concave outlines. The
 * fit axis is always the curated band frame's outward normal, so even a 180-degree
 * cap rotation stays on the chosen side of the body. The requested rotation is
 * preserved; there is no angular fallback threshold or previous-frame state.
 * Internal clearance is added after the neutral fit once. The curated model
 * frame is already independent from its chosen lobe's perimeter location.
 */
export function beretGeometry(body, accessory, squash = 1, contourOverride, profileOverride, rotation = accessory.rotation) {
    const contour = contourOverride ?? shapeContour({ kind: 'material', name: body.shape });
    const profile = profileOverride ?? resolveShapeProfile(body.shape);
    if (accessory.preset === "beret") {
        const stretch = 1 / Math.sqrt(squash);
        return wornBeret(contour, [BODY_SIZE[0] * .5 * stretch, BODY_SIZE[1] * .5 * squash, profile.depth * .5 * stretch], body.shape, rotation);
    }
    const preset = accessory.preset === 'crown' ? 'crown' : 'beret', shell = shells[preset];
    const mount = profile.accessories[preset];
    const neutralProfile = { ...profile, accessories: { ...profile.accessories, [preset]: { ...mount, anchor: { ...mount.anchor, offset: 0 } } } };
    const frame = sampleAccessorySurface(body, accessory, squash, contour, neutralProfile);
    const size = accessory.scale * mount.scale, projected = projectShell(rotation, preset);
    const axes = [frame.tangent, frame.bitangent, frame.normal];
    const stretch = 1 / Math.sqrt(squash), scales = [BODY_SIZE[0] * 0.5 * stretch, BODY_SIZE[1] * 0.5 * squash, profile.depth * 0.5 * stretch];
    const surface = bodyGeometry(contour), local = [];
    for (let i = 0; i < surface.vertices.length; i += 6) {
        const p = [surface.vertices[i] * scales[0] - frame.position[0], surface.vertices[i + 1] * scales[1] - frame.position[1], surface.vertices[i + 2] * scales[2] - frame.position[2]];
        local.push(axes.map(axis => (axis[0] * p[0] + axis[1] * p[1] + axis[2] * p[2]) / size));
    }
    let seating = -Infinity;
    // Seed the exact fit from mesh vertices. Once a valid support exists, the
    // shell's fixed lowest point rejects almost every lower-body triangle before
    // any projected-triangle allocation or overlap work.
    for (const p of local) {
        if (p[2] - projected.minZ <= seating)
            continue;
        for (const index of projected.grid.get(`${Math.floor(p[0] * 32)},${Math.floor(p[1] * 32)}`) ?? []) {
            const hat = projected.lower[index];
            if (p[2] - hat.minZ > seating && contains(hat, p))
                seating = Math.max(seating, p[2] - hat.zx * p[0] - hat.zy * p[1] - hat.z0);
        }
    }
    const seen = new Int32Array(projected.lower.length);
    let serial = 0;
    for (let i = 0; i < surface.indices.length; i += 3) {
        const a = local[surface.indices[i]], b = local[surface.indices[i + 1]], c = local[surface.indices[i + 2]];
        const maxZ = Math.max(a[2], b[2], c[2]);
        if (maxZ - projected.minZ <= seating)
            continue;
        const triangle = makeTriangle(a, b, c);
        if (!triangle || triangle.area <= 0 || triangle.maxX < projected.minX || triangle.minX > projected.maxX || triangle.maxY < projected.minY || triangle.minY > projected.maxY)
            continue;
        serial++;
        for (let x = Math.max(Math.floor(projected.minX * 32), Math.floor(triangle.minX * 32)); x <= Math.min(Math.floor(projected.maxX * 32), Math.floor(triangle.maxX * 32)); x++)
            for (let y = Math.max(Math.floor(projected.minY * 32), Math.floor(triangle.minY * 32)); y <= Math.min(Math.floor(projected.maxY * 32), Math.floor(triangle.maxY * 32)); y++) {
                for (const index of projected.grid.get(`${x},${y}`) ?? []) {
                    if (seen[index] === serial)
                        continue;
                    seen[index] = serial;
                    const hat = projected.lower[index];
                    if (maxZ - hat.minZ <= seating || triangle.maxX < hat.minX || triangle.minX > hat.maxX || triangle.maxY < hat.minY || triangle.minY > hat.maxY)
                        continue;
                    seating = separation(triangle, hat, seating);
                }
            }
    }
    if (!Number.isFinite(seating))
        seating = 0;
    // Clearance comes from the internal fit only; legacy user placement is never
    // allowed to reintroduce a gap or pull a correctly fitted shell into the body.
    const standOff = mount.anchor.offset;
    const vertices = new Float32Array(shell.geometry.vertices.length);
    for (let i = 0; i < vertices.length; i += 6) {
        const x = projected.vertices[i] * size, y = projected.vertices[i + 1] * size, z = (projected.vertices[i + 2] + seating) * size + BERET_CLEARANCE;
        for (let k = 0; k < 3; k++) {
            vertices[i + k] = frame.position[k] + axes[0][k] * x + axes[1][k] * y + axes[2][k] * z + frame.normal[k] * standOff;
            vertices[i + 3 + k] = axes[0][k] * projected.vertices[i + 3] + axes[1][k] * projected.vertices[i + 4] + axes[2][k] * projected.vertices[i + 5];
        }
    }
    return { vertices, indices: shell.geometry.indices, bandIndexCount: shell.bandIndexCount, crownIndexCount: shell.geometry.indices.length - shell.bandIndexCount, seating };
}
/** A structural band, not a directional lighting model; every region is flat. */
export function beretBandColor(color) {
    const value = parseInt(color.slice(1), 16);
    return '#' + [16, 8, 0].map(shift => Math.round(((value >> shift) & 255) * 0.72).toString(16).padStart(2, '0')).join('');
}
