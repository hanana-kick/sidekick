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
/** Height-local support envelopes of the actual inflated contour. Their smooth
 * vertical footprint bridges notches like tensioned cloth and remains continuous
 * through morphs. Analytic raw-equator extrema retain even sub-grid-width lobes. */
function perimeterSection(contour, scales, pivot, pose, size, y, precise) {
    const footprint = precise ? .005 : .065;
    const flat = Math.abs(pose[8]) + Math.abs(pose[9]) < 1e-12;
    const count = flat ? 2 : WRAP_RINGS, delta = Math.PI * 2 / count;
    const lower = y - footprint * size, upper = y + footprint * size, strength = (precise ? 100 : 18) / size;
    // The unrotated equator is a line in each XZ section. Solve its two signed
    // X supports once, rather than repeating the same extrema in 40 directions.
    const normals = flat ? [[1, 0], [-1, 0]] : Array.from({ length: count }, (_, i) => [Math.sin((i + .5) * delta), Math.cos((i + .5) * delta)]);
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
    if (flat)
        return Array.from({ length: WRAP_RINGS }, (_, i) => {
            const nx = Math.sin((i + .5) / WRAP_RINGS * Math.PI * 2);
            return Math.abs(nx) * supports[nx >= 0 ? 0 : 1];
        });
    return supports;
}
function wrapSupports(chart, boundary, y, size, precise) {
    const footprint = precise ? .005 : .065;
    const supports = [...boundary], lower = y - footprint * size, upper = y + footprint * size;
    const normals = Array.from({ length: WRAP_RINGS }, (_, i) => {
        const angle = (i + .5) / WRAP_RINGS * Math.PI * 2;
        return [Math.sin(angle), Math.cos(angle)];
    });
    for (const p of chart) {
        const weight = Math.exp(-(precise ? 100 : 18) * Math.max(0, lower - p[1], p[1] - upper) / size);
        for (let i = 0; i < WRAP_RINGS; i++)
            supports[i] = Math.max(supports[i], weight * (p[0] * normals[i][0] + p[2] * normals[i][1]));
    }
    return supports;
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
/** Broad, thin cloth with a fitted section at every height, and a closed rear. */
function wrap(mesh, sections, size, precise) {
    const centers = [], delta = Math.PI * 2 / WRAP_RINGS;
    const heights = [1, .9, 0, -.9, -1, -.9, 0, .9];
    const thickness = [0, 1, 1, 1, 0, -1, -1, -1];
    for (let i = 0; i < WRAP_RINGS; i++) {
        const angle = i * delta;
        for (let j = 0; j < SIDES; j++) {
            const fittedHeight = heights[j] - 1.06 * Math.pow(Math.max(0, Math.cos(angle)), 4);
            const section = (height, k) => {
                const index = Math.max(0, Math.min(sections.length - 1.000001, (height + 2.75) * 4));
                const lo = Math.floor(index), t = index - lo;
                return sections[lo][k] * (1 - t) + sections[lo + 1][k] * t;
            };
            const padding = precise ? .004 + .004 * size : .019 + .008 * size;
            let radius = Infinity;
            for (let k = 0; k < WRAP_RINGS; k++) {
                const cosine = Math.cos((k + .5) * delta - angle);
                if (cosine > 1e-6) {
                    let support = section(fittedHeight, k);
                    if (thickness[j] !== 0)
                        support = Math.max(support, section(fittedHeight - .42, k), section(fittedHeight + .42, k));
                    radius = Math.min(radius, (support + padding) / cosine);
                }
            }
            radius += thickness[j] > 0 ? .014 * size + .003 : thickness[j] < 0 ? -.004 * size : 0;
            const x = radius * Math.sin(angle), z = radius * Math.cos(angle);
            mesh.points.push([x, size * (.095 * fittedHeight - .015), z]);
        }
        const outer = mesh.points[i * SIDES + 2], inner = mesh.points[i * SIDES + 6];
        centers.push([(outer[0] + inner[0]) / 2, outer[1], (outer[2] + inner[2]) / 2]);
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
    const pivot = [center[0], center[1] + .025 * size, 0], pose = transform(pivot, rotation);
    const chart = [];
    const local = (px, py, z) => {
        const x = px * scales[0] - pivot[0], y = py * scales[1] - pivot[1];
        return [x * pose[0] + y * pose[1] + z * pose[2], x * pose[4] + y * pose[5] + z * pose[6], x * pose[8] + y * pose[9] + z * pose[10]];
    };
    for (let row = 0; row <= 48; row++)
        for (let col = 0; col <= 48; col++) {
            const px = (col / 48 * 2 - 1) * 1.02, py = (row / 48 * 2 - 1) * 1.02, distance = contourSignedDistanceExact(contour, px, py);
            const d = Math.max(0, distance), height = d > 0 ? Math.sqrt(d / (d + VOLUME_CURVATURE * (px * px + py * py))) * scales[2] : 0;
            const weight = Math.exp(-24 * Math.max(0, -distance));
            for (const z of [height, -height]) {
                const p = local(px, py, z);
                chart.push([p[0] * weight, p[1], p[2] * weight]);
            }
        }
    const precise = rotation.every(value => Math.abs(value) < 1e-10);
    const sections = Array.from({ length: 18 }, (_, index) => {
        const y = size * (.095 * (index / 4 - 2.75) - .015);
        let sectionChart = chart;
        if (precise) {
            sectionChart = [];
            const py = (y + pivot[1]) / scales[1];
            for (let i = 0; i <= 96; i++) {
                const px = i / 48 - 1, d = contourSignedDistanceExact(contour, px, py);
                if (d < 0)
                    continue;
                const z = d > 0 ? Math.sqrt(d / (d + VOLUME_CURVATURE * (px * px + py * py))) * scales[2] : 0;
                sectionChart.push(local(px, py, z), local(px, py, -z));
            }
        }
        return wrapSupports(sectionChart, perimeterSection(contour, scales, pivot, pose, size, y, precise), y, size, precise);
    });
    const initial = empty(), centers = wrap(initial, sections, size, precise);
    const [joinX, joinY, joinZ] = centers[2];
    const tails = empty();
    for (const [offset, length, drift, phase] of [[-.058, .32, -.035, 0], [.060, .38, .020, 1]]) {
        ribbon(tails, Array.from({ length: 13 }, (_, i) => {
            const v = i / 12;
            return { center: [joinX + size * (offset + drift * v + .008 * Math.sin(Math.PI * v)), joinY + size * (.015 - length * v),
                    joinZ + size * (.018 + .008 * phase + .030 * v + .014 * Math.sin(Math.PI * v))],
                width: size * (.067 - .009 * v + .003 * Math.sin(Math.PI * v)), thickness: .010 * size, fold: size * (.010 + .008 * Math.sin(Math.PI * v + phase)) };
        }), true);
    }
    const knot = empty();
    ribbon(knot, Array.from({ length: 7 }, (_, i) => {
        const v = i / 6, bulge = Math.sin(Math.PI * v);
        return { center: [joinX, joinY + size * (.045 - .097 * v), joinZ + size * (.017 + .010 * bulge)],
            width: size * (.075 + .012 * bulge), thickness: size * (.014 + .006 * bulge), fold: .006 * size };
    }), true);
    const hanging = empty();
    append(hanging, tails);
    append(hanging, knot);
    const lift = hangingLift(hanging.points, chart);
    const mesh = initial;
    // The cloth gathers locally into the knot. Unlike a front-wide envelope
    // extension this leaves the rest of the band seated against the actual body.
    for (let ring = 0; ring < WRAP_RINGS; ring++) {
        const distance = Math.min(Math.abs(ring - 2), WRAP_RINGS - Math.abs(ring - 2));
        const gather = Math.exp(-distance * distance / 8);
        for (let j = 0; j < SIDES; j++)
            mesh.points[ring * SIDES + j][2] += lift * gather;
    }
    for (const part of [tails, knot])
        for (const point of part.points)
            point[2] += lift;
    append(mesh, tails);
    mesh.mainIndexCount = mesh.indices.length;
    append(mesh, knot);
    mesh.points = mesh.points.map(point => viewPoint(pose, point));
    return mesh;
}
