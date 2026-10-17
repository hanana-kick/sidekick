import { contourSignedDistanceExact } from '../core/contours.js';
import { VOLUME_CURVATURE } from '../core/body-volume.js';
import { transform } from '../core/math.js';
import { viewPoint } from './eye-projection.js';
const SIDES = 8;
const WRAP_RINGS = 40;
const CLEARANCE = .002;
const empty = () => ({ points: [], indices: [], mainIndexCount: 0 });
/** A rounded, closed cloth cross-section; its thickness does not depend on the body. */
function ribbon(mesh, rings, vertical = false) {
    const start = mesh.points.length;
    for (let i = 0; i < rings.length; i++) {
        const ring = rings[i], before = rings[Math.max(0, i - 1)].center, after = rings[Math.min(rings.length - 1, i + 1)].center;
        const dx = after[0] - before[0], dy = after[1] - before[1], length = Math.hypot(dx, dy);
        const across = vertical ? [1, 0] : [-dy / length, dx / length];
        for (let j = 0; j < SIDES; j++) {
            const angle = j / SIDES * Math.PI * 2, u = Math.cos(angle), v = Math.sin(angle);
            mesh.points.push([ring.center[0] + across[0] * ring.width * u, ring.center[1] + across[1] * ring.width * u,
                ring.center[2] + ring.thickness * v + ring.fold * (u * u - .5)]);
        }
    }
    for (let i = 0; i < rings.length - 1; i++)
        for (let j = 0; j < SIDES; j++) {
            const a = start + i * SIDES + j, b = a + SIDES, c = start + i * SIDES + (j + 1) % SIDES, d = c + SIDES;
            mesh.indices.push(a, c, b, c, d, b);
        }
    const first = mesh.points.push([...rings[0].center]) - 1, last = mesh.points.push([...rings[rings.length - 1].center]) - 1;
    for (let j = 0; j < SIDES; j++)
        mesh.indices.push(first, start + (j + 1) % SIDES, start + j, last, start + (rings.length - 1) * SIDES + j, start + (rings.length - 1) * SIDES + (j + 1) % SIDES);
}
function append(mesh, part) {
    const offset = mesh.points.length;
    mesh.points.push(...part.points);
    mesh.indices.push(...part.indices.map(index => index + offset));
}
/**
 * Exact fixed-direction supports of the raw equator under the smooth band
 * falloff. A narrow lobe cannot disappear between interior grid samples.
 * Endpoints and weighted-linear stationary points cover each entire edge;
 * the global tangent polygon is invariant to cyclic order/collinear splitting.
 */
function perimeterSection(contour, scales, pivot, pose, size) {
    const lower = -.085 * size, upper = .055 * size, strength = 18 / size, count = 16, delta = Math.PI * 2 / count;
    const normals = Array.from({ length: count }, (_, i) => [Math.sin(i * delta), Math.cos(i * delta)]);
    const supports = Array(count).fill(-Infinity);
    const projected = contour.points.map(([px, py]) => {
        const x = px * scales[0] - pivot[0], y = py * scales[1] - pivot[1];
        return [x * pose[0] + y * pose[1], x * pose[4] + y * pose[5], x * pose[8] + y * pose[9]];
    });
    for (let i = 0; i < projected.length; i++) {
        const a = projected[i], b = projected[(i + 1) % projected.length], dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
        const cuts = [0, 1];
        if (Math.abs(dy) > 1e-12)
            for (const edge of [lower, upper]) {
                const t = (edge - a[1]) / dy;
                if (t > 0 && t < 1)
                    cuts.push(t);
            }
        cuts.sort((a, b) => a - b);
        for (let interval = 0; interval < cuts.length - 1; interval++) {
            const from = cuts[interval], to = cuts[interval + 1], middleY = a[1] + dy * (from + to) / 2;
            const rate = middleY < lower ? strength * dy : middleY > upper ? -strength * dy : 0;
            const weight = (t) => Math.exp(-strength * Math.max(0, lower - a[1] - dy * t, a[1] + dy * t - upper));
            const fromWeight = weight(from), toWeight = weight(to);
            for (let j = 0; j < count; j++) {
                const [nx, nz] = normals[j], origin = a[0] * nx + a[2] * nz, slope = dx * nx + dz * nz;
                let maximum = Math.max((origin + slope * from) * fromWeight, (origin + slope * to) * toWeight);
                if (Math.abs(rate * slope) > 1e-14) {
                    const t = -(slope + rate * origin) / (rate * slope);
                    if (t > from && t < to)
                        maximum = Math.max(maximum, (origin + slope * t) * weight(t));
                }
                supports[j] = Math.max(supports[j], maximum);
            }
        }
    }
    return normals.map(([nx, nz], i) => {
        const next = (i + 1) % count, [mx, mz] = normals[next], determinant = nx * mz - nz * mx;
        return [(supports[i] * mz - supports[next] * nz) / determinant, (nx * supports[next] - mx * supports[i]) / determinant];
    });
}
/**
 * Fixed analytic chart, independent of adaptive body tessellation and history.
 * Outside samples shrink continuously toward the wrap axis; a smooth vertical
 * falloff lets tensioned cloth bridge notches without selecting a body lobe.
 * 49 x 49 analytic samples and 40 directions are a strict, small work bound.
 */
function wrapSupports(chart, size, boundary) {
    const lower = -.085 * size, upper = .055 * size, section = [...boundary];
    let left = 0, right = 0, depth = 0;
    for (const p of chart) {
        const weight = Math.exp(-18 * Math.max(0, lower - p[1], p[1] - upper) / size), x = p[0] * weight, z = p[2] * weight;
        section.push([x, z]);
        left = Math.min(left, x);
        right = Math.max(right, x);
        depth = Math.max(depth, Math.abs(z));
    }
    for (const p of boundary) {
        left = Math.min(left, p[0]);
        right = Math.max(right, p[0]);
        depth = Math.max(depth, Math.abs(p[1]));
    }
    const cx = (left + right) / 2, rx = Math.max(.025, (right - left) / 2), rz = Math.max(.025, depth);
    // A single rounded enclosing section, rather than differentiating a sampled
    // polygon's support function. This prevents tiny chart changes being amplified
    // into large tangential cloth motion at a newly exposed lobe.
    let enclosure = 1;
    for (const p of section)
        enclosure = Math.max(enclosure, Math.hypot((p[0] - cx) / rx, p[1] / rz));
    return Array.from({ length: WRAP_RINGS }, (_, i) => {
        const angle = (i + .5) / WRAP_RINGS * Math.PI * 2;
        return cx * Math.sin(angle) + enclosure * Math.hypot(rx * Math.sin(angle), rz * Math.cos(angle));
    });
}
/** One continuous rigid offset for both free ends and their knot. */
function hangingLift(points, chart) {
    const minX = Math.min(...points.map(p => p[0])), maxX = Math.max(...points.map(p => p[0]));
    const minY = Math.min(...points.map(p => p[1])), maxY = Math.max(...points.map(p => p[1]));
    const minZ = Math.min(...points.map(p => p[2]));
    let front = -Infinity;
    for (const p of chart) {
        const distance = Math.max(0, minX - p[0], p[0] - maxX) + Math.max(0, minY - p[1], p[1] - maxY);
        front = Math.max(front, p[2] - 3 * distance);
    }
    return Math.max(0, front + .014 - minZ) + CLEARANCE;
}
/** Closed cloth loop, with a rounded vertical section and no rear seam/cap. */
function wrap(mesh, supports, y, size, frontLift = 0) {
    const centers = [], delta = Math.PI * 2 / WRAP_RINGS, padding = .015 * size + .012 + CLEARANCE;
    const support = (index, angle) => supports[(index + WRAP_RINGS) % WRAP_RINGS] + padding + frontLift * Math.max(0, Math.cos(angle));
    for (let i = 0; i < WRAP_RINGS; i++) {
        const angle = i * delta, before = angle - delta / 2, after = angle + delta / 2;
        const a = support(i - 1, before), b = support(i, after), determinant = Math.sin(before - after);
        const x = (a * Math.cos(after) - b * Math.cos(before)) / determinant;
        const z = (Math.sin(before) * b - Math.sin(after) * a) / determinant;
        const cy = y - .015 * size * (1 + Math.cos(angle));
        centers.push([x, cy, z]);
        for (let j = 0; j < SIDES; j++) {
            const theta = j / SIDES * Math.PI * 2, u = Math.cos(theta), v = Math.sin(theta);
            mesh.points.push([x + .015 * size * v * Math.sin(angle), cy + .055 * size * u, z + .015 * size * v * Math.cos(angle)]);
        }
    }
    for (let i = 0; i < WRAP_RINGS; i++)
        for (let j = 0; j < SIDES; j++) {
            const a = i * SIDES + j, b = ((i + 1) % WRAP_RINGS) * SIDES + j;
            const c = i * SIDES + (j + 1) % SIDES, d = ((i + 1) % WRAP_RINGS) * SIDES + (j + 1) % SIDES;
            mesh.indices.push(a, c, b, c, d, b);
        }
    return centers;
}
/**
 * One cloth loop actually encircles the lower body, including both sides and
 * rear. Its convex support envelope bridges concave notches like tensioned
 * fabric. Two free tails retain their authored gravity drape and volume;
 * their clearance is one shared rigid translation, never vertex body-hugging.
 */
export function drapedScarf(center, size, contour, scales, rotation = [0, 0, 0]) {
    const pivot = [center[0], center[1] - .045 * size, 0], pose = transform(pivot, rotation);
    const chart = [];
    for (let row = 0; row <= 48; row++)
        for (let col = 0; col <= 48; col++) {
            const px = (col / 48 * 2 - 1) * 1.02, py = (row / 48 * 2 - 1) * 1.02, distance = contourSignedDistanceExact(contour, px, py);
            const d = Math.max(0, distance), height = d > 0 ? Math.sqrt(d / (d + VOLUME_CURVATURE * (px * px + py * py))) * scales[2] : 0;
            const weight = Math.exp(-24 * Math.max(0, -distance));
            for (const z of [height, -height]) {
                const x = px * scales[0] - pivot[0], y = py * scales[1] - pivot[1];
                chart.push([(x * pose[0] + y * pose[1] + z * pose[2]) * weight,
                    x * pose[4] + y * pose[5] + z * pose[6], (x * pose[8] + y * pose[9] + z * pose[10]) * weight]);
            }
        }
    const supports = wrapSupports(chart, size, perimeterSection(contour, scales, pivot, pose, size)), initial = empty();
    const centers = wrap(initial, supports, 0, size);
    const [joinX, joinY, joinZ] = centers[2];
    const tails = empty();
    for (const [offset, length, drift, phase] of [[-.036, .285, -.026, 0], [.038, .335, .012, 1]]) {
        ribbon(tails, Array.from({ length: 13 }, (_, i) => {
            const v = i / 12;
            return { center: [joinX + size * (offset + drift * v + .008 * Math.sin(Math.PI * v)), joinY + size * (.015 - length * v),
                    joinZ + size * (.018 + .008 * phase + .030 * v + .014 * Math.sin(Math.PI * v))],
                width: size * (.041 - .007 * v + .002 * Math.sin(Math.PI * v)), thickness: .010 * size, fold: size * (.010 + .008 * Math.sin(Math.PI * v + phase)) };
        }), true);
    }
    const knot = empty();
    ribbon(knot, Array.from({ length: 7 }, (_, i) => {
        const v = i / 6, bulge = Math.sin(Math.PI * v);
        return { center: [joinX, joinY + size * (.045 - .097 * v), joinZ + size * (.017 + .010 * bulge)],
            width: size * (.045 + .009 * bulge), thickness: size * (.014 + .006 * bulge), fold: .006 * size };
    }), true);
    const hanging = empty();
    append(hanging, tails);
    append(hanging, knot);
    const lift = hangingLift(hanging.points, chart);
    // A Minkowski extension of just the front envelope preserves the closed wrap
    // and its rear contact when the free tails need extra room over a lower lobe.
    const mesh = empty();
    wrap(mesh, supports, 0, size, lift);
    for (const part of [tails, knot])
        for (const point of part.points)
            point[2] += lift;
    append(mesh, tails);
    mesh.mainIndexCount = mesh.indices.length;
    append(mesh, knot);
    mesh.points = mesh.points.map(point => viewPoint(pose, point));
    return mesh;
}
