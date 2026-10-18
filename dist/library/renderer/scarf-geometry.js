import { contourSignedDistanceExact } from '../core/contours.js';
import { VOLUME_CURVATURE } from '../core/body-volume.js';
const SIDES = 8;
const WRAP_RINGS = 40;
const empty = () => ({ points: [], indices: [], mainIndexCount: 0 });
/** A rounded, closed cloth cross-section; its thickness does not depend on the body. */
function ribbon(mesh, rings, vertical = false, surface) {
    const start = mesh.points.length;
    for (let i = 0; i < rings.length; i++) {
        const ring = rings[i], before = rings[Math.max(0, i - 1)].center, after = rings[Math.min(rings.length - 1, i + 1)].center;
        const dx = after[0] - before[0], dy = after[1] - before[1], length = Math.hypot(dx, dy);
        const across = vertical ? [1, 0] : [-dy / length, dx / length];
        for (let j = 0; j < SIDES; j++) {
            const angle = j / SIDES * Math.PI * 2, u = Math.cos(angle), v = Math.sin(angle);
            const twist = ring.twist ?? 0, c = Math.cos(twist), s = Math.sin(twist);
            const x = ring.center[0] + across[0] * ring.width * u * c, y = ring.center[1] + across[1] * ring.width * u;
            const z = Math.max(ring.center[2] + ring.width * u * s + ring.fold * (u * u - .5), (surface?.(x, y) ?? -Infinity) + ring.thickness + .003);
            mesh.points.push([x - ring.thickness * v * s, y, z + ring.thickness * v * c]);
        }
    }
    for (let i = 0; i < rings.length - 1; i++)
        for (let j = 0; j < SIDES; j++) {
            const a = start + i * SIDES + j, b = a + SIDES, c = start + i * SIDES + (j + 1) % SIDES, d = c + SIDES;
            mesh.indices.push(a, c, b, c, d, b);
        }
    const cap = (offset) => [0, 1, 2].map(k => mesh.points.slice(offset, offset + SIDES).reduce((sum, p) => sum + p[k], 0) / SIDES);
    const first = mesh.points.push(cap(start)) - 1, last = mesh.points.push(cap(start + (rings.length - 1) * SIDES)) - 1;
    for (let j = 0; j < SIDES; j++)
        mesh.indices.push(first, start + (j + 1) % SIDES, start + j, last, start + (rings.length - 1) * SIDES + j, start + (rings.length - 1) * SIDES + (j + 1) % SIDES);
}
const CLOTH_LENGTH = 2.05;
const CLOTH_WIDTH = .15;
const CLOTH_THICKNESS = .012;
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const lengthOf = (points, closed = false) => points.reduce((sum, p, i) => sum + (i || closed ? distance(p, points[(i + points.length - 1) % points.length]) : 0), 0);
/** An actual body section; only its placement changes to accommodate the same
 * finite scarf. No section perimeter is used as an accessory scale. */
function bodySection(contour, scales, angle, level, garmentScale, bounds, samples = 64) {
    const c = Math.cos(angle), s = Math.sin(angle), delta = Math.PI * 2 / WRAP_RINGS;
    const points = [];
    const [left, right] = bounds;
    points.push([left, 0], [right, 0]);
    for (let i = 0; i <= samples; i++) {
        const x = left + (right - left) * i / samples, wx = c * x - s * level, wy = s * x + c * level;
        const px = wx / scales[0], py = wy / scales[1], d = contourSignedDistanceExact(contour, px, py);
        if (d < 0)
            continue;
        const z = d > 0 ? Math.sqrt(d / (d + VOLUME_CURVATURE * (px * px + py * py))) * scales[2] : 0;
        points.push([x, z], [x, -z]);
    }
    const supports = Array.from({ length: WRAP_RINGS }, (_, i) => {
        const angle = (i + .5) * delta, nx = Math.sin(angle), nz = Math.cos(angle);
        return Math.max(...points.map(p => p[0] * nx + p[1] * nz)) + (CLOTH_THICKNESS / 2 + .001) * garmentScale;
    });
    const polygon = Array.from({ length: WRAP_RINGS }, (_, i) => {
        const before = (i - .5) * delta, after = (i + .5) * delta, a = supports[(i + WRAP_RINGS - 1) % WRAP_RINGS], b = supports[i];
        const determinant = Math.sin(before - after);
        const x = (a * Math.cos(after) - b * Math.cos(before)) / determinant;
        const z = (Math.sin(before) * b - Math.sin(after) * a) / determinant;
        return [c * x - s * level, s * x + c * level, z];
    });
    const center = [c * (left + right) / 2 - s * level, s * (left + right) / 2 + c * level, 0];
    return { points: polygon, length: lengthOf(polygon, true), center };
}
/** Push a cloth sample out along the actual implicit surface normal. This
 * preserves side contact at the vertical equator instead of lifting in Z. */
function exterior(point, contour, scales, clearance) {
    const p = [...point], h = .008;
    let direction;
    for (let iteration = 0; iteration < 4; iteration++) {
        const x = p[0] / scales[0], y = p[1] / scales[1], z = p[2] / scales[2];
        const d = contourSignedDistanceExact(contour, x, y);
        if (d <= 0)
            break;
        const square = z * z, f = square * (d + VOLUME_CURVATURE * (x * x + y * y)) - d;
        const dx = (contourSignedDistanceExact(contour, x + h, y) - contourSignedDistanceExact(contour, x - h, y)) / (2 * h);
        const dy = (contourSignedDistanceExact(contour, x, y + h) - contourSignedDistanceExact(contour, x, y - h)) / (2 * h);
        const g = [(dx * (square - 1) + 2 * VOLUME_CURVATURE * x * square) / scales[0], (dy * (square - 1) + 2 * VOLUME_CURVATURE * y * square) / scales[1], 2 * z * (d + VOLUME_CURVATURE * (x * x + y * y)) / scales[2]];
        const magnitude = Math.hypot(...g);
        const target = clearance * Math.min(1, d / .015);
        if (magnitude < .00001 || f / magnitude >= target)
            break;
        direction ??= g.map(v => v / Math.max(.1, magnitude));
        const step = Math.min(.06, target - f / magnitude);
        for (let k = 0; k < 3; k++)
            p[k] += step * direction[k];
    }
    return p;
}
/** A consistent visual cloth width and finite hanging surplus, with bounded
 * local wrap adaptation. Camera and frame history never affect placement. */
export function drapedScarf(_center, scale, contour, scales, rotation = [0, 0, 0], fit = [0, -.65, -.35, .35]) {
    const [canonicalAngle, canonicalLevel, left, right] = fit;
    const nc = Math.cos(canonicalAngle), ns = Math.sin(canonicalAngle);
    const normalLength = Math.hypot(ns / scales[0], nc / scales[1]);
    const angle = Math.atan2(ns / scales[0], nc / scales[1]), level = canonicalLevel / normalLength;
    const localX = (x) => Math.cos(angle) * (nc * x - ns * canonicalLevel) * scales[0] + Math.sin(angle) * (ns * x + nc * canonicalLevel) * scales[1];
    const section = bodySection(contour, scales, angle, level, scale, [localX(left), localX(right)]), mesh = empty();
    const middle = section.points;
    const radialAt = (phase) => [Math.cos(angle) * Math.sin(phase), Math.sin(angle) * Math.sin(phase), Math.cos(phase)];
    // A worn loop stays seated. Internal pose rotation flexes the free cloth
    // around its sewn root, rather than spinning a fitted loop through the body.
    const bendX = .12 * Math.sin(rotation[2]), bendZ = .10 * Math.sin(rotation[1]);
    const twistPose = .35 * Math.sin(rotation[0]) + .25 * Math.sin(rotation[2]);
    const heights = [1, .5, 0, -.5, -1, -.5, 0, .5], thickness = [0, 1, 1, 1, 0, -1, -1, -1];
    const norm = (v) => { const d = Math.hypot(...v) || 1; return v.map(x => x / d); };
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    for (let i = 0; i < WRAP_RINGS; i++) {
        const p = middle[i], previous = middle[(i + WRAP_RINGS - 1) % WRAP_RINGS], next = middle[(i + 1) % WRAP_RINGS];
        const tangent = norm(next.map((v, k) => v - previous[k]));
        const x = p[0] / scales[0], y = p[1] / scales[1], z = p[2] / scales[2], h = .008;
        const d = Math.max(0, contourSignedDistanceExact(contour, x, y));
        const dx = (contourSignedDistanceExact(contour, x + h, y) - contourSignedDistanceExact(contour, x - h, y)) / (2 * h);
        const dy = (contourSignedDistanceExact(contour, x, y + h) - contourSignedDistanceExact(contour, x, y - h)) / (2 * h);
        const gradient = [(dx * (z * z - 1) + 2 * VOLUME_CURVATURE * x * z * z) / scales[0], (dy * (z * z - 1) + 2 * VOLUME_CURVATURE * y * z * z) / scales[1], 2 * z * (d + VOLUME_CURVATURE * (x * x + y * y)) / scales[2]];
        const phase = i / WRAP_RINGS * Math.PI * 2;
        const radial = radialAt(phase);
        const radialGradient = gradient.reduce((sum, v, k) => sum + v * radial[k], 0);
        const bias = Math.max(.02, .2 * Math.hypot(...gradient) - radialGradient);
        const outward = norm(gradient.map((v, k) => v + bias * radial[k]));
        const across = norm(cross(outward, tangent));
        for (let j = 0; j < SIDES; j++) {
            const q = exterior(p.map((v, k) => v + across[k] * CLOTH_WIDTH / 2 * scale * heights[j]), contour, scales, .009 * scale);
            mesh.points.push(q.map((v, k) => v + outward[k] * CLOTH_THICKNESS / 2 * scale * thickness[j]));
        }
    }
    for (let i = 0; i < WRAP_RINGS; i++)
        for (let j = 0; j < SIDES; j++) {
            const a = i * SIDES + j, b = ((i + 1) % WRAP_RINGS) * SIDES + j, c = i * SIDES + (j + 1) % SIDES, d = ((i + 1) % WRAP_RINGS) * SIDES + (j + 1) % SIDES;
            mesh.indices.push(a, c, b, c, d, b);
        }
    const surface = (wx, wy) => {
        const x = wx / scales[0], y = wy / scales[1], d = contourSignedDistanceExact(contour, x, y);
        return d > 0 ? Math.sqrt(d / (d + VOLUME_CURVATURE * (x * x + y * y))) * scales[2] : -Infinity;
    };
    const join = middle[1], free = Math.max(.68 * scale, Math.min(.85 * scale, CLOTH_LENGTH * scale - lengthOf(middle, true)));
    for (const [offset, fraction, phase] of [[-.028, .44, 0], [.028, .56, 1]]) {
        const path = Array.from({ length: 13 }, (_, i) => { const v = i / 12; return [(phase ? .13 : -.10) * v + .025 * Math.sin(Math.PI * v) + bendX * v * v, -v, .12 * v + .04 * Math.sin(Math.PI * v) + bendZ * v * v]; });
        const unit = lengthOf(path), length = free * fraction;
        ribbon(mesh, path.map((p, i) => ({ center: [join[0] + offset * scale + p[0] * length / unit, join[1] + .006 * scale + p[1] * length / unit, join[2] + .013 * scale + p[2] * length / unit],
            width: CLOTH_WIDTH / 2 * scale * (1 - .08 * i / 12), thickness: CLOTH_THICKNESS / 2 * scale, fold: .006 * scale, twist: ((phase ? -.36 : .32) + twistPose) * Math.sin(i / 12 * Math.PI / 2) })), true, surface);
    }
    mesh.mainIndexCount = mesh.indices.length;
    ribbon(mesh, Array.from({ length: 7 }, (_, i) => { const v = i / 6; return { center: [join[0], join[1] + (.035 - .07 * v) * scale, join[2] + .012 * scale], width: (.048 + .009 * Math.sin(Math.PI * v)) * scale, thickness: .016 * scale, fold: .003 * scale }; }), true, surface);
    return mesh;
}
