import { contourSignedDistance } from '../core/contours.js';
import { drapedFrontLifts, rigidFrontLift } from './rigid-contact.js';
const SIDES = 8;
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
/** Continuous interior walk keeps each shoulder support on its current lobe. */
function shoulder(center, target, contour, scales, height) {
    const from = [center[0] / scales[0], center[1] / scales[1]], to = [target[0] / scales[0], target[1] / scales[1]];
    const dx = to[0] - from[0], dy = to[1] - from[1], length = Math.hypot(dx, dy);
    let travel = 0;
    for (let i = 0; i < 24; i++) {
        const fraction = travel / length, distance = contourSignedDistance(contour, from[0] + dx * fraction, from[1] + dy * fraction);
        travel += Math.min(length - travel, Math.max(0, distance - .018));
    }
    const x = (from[0] + dx * travel / length) * scales[0], y = (from[1] + dy * travel / length) * scales[1];
    return [x, y, height(x, y)];
}
/**
 * A loose scarf is supported only at its two shoulder folds. The collar and
 * both hanging tails are authored in space, then receive ONE rigid clearance
 * offset. Only the short shoulder folds adapt locally to make real contact.
 * In particular neither the collar nor the free ends sample the body height
 * at their vertices. Gravity is body-local, so camera movement cannot refit it.
 */
export function drapedScarf(center, size, contour, scales, height) {
    const [x, y, z] = center;
    const left = shoulder(center, [x - .31 * size, y + .105 * size], contour, scales, height);
    const right = shoulder(center, [x + .31 * size, y + .105 * size], contour, scales, height);
    // Depth bends more slowly than the downward sag: the collar rolls down at
    // its forward edge instead of making a straight shelf in exact side views.
    const rings = Array.from({ length: 25 }, (_, i) => {
        const u = i / 24, t = u * 2 - 1;
        return { center: [left[0] * (1 - u) + right[0] * u + .012 * size * -t, y + size * (.072 * t * t - .035), z + size * (.095 - .115 * t ** 4)],
            width: .042 * size, thickness: .013 * size, fold: .010 * size * (1 - t * t) };
    });
    const collar = empty();
    ribbon(collar, rings);
    // Tie the knot to an actual interior section of the supported collar. A
    // fixed body-relative X can miss an asymmetric collar (PixelTriangle).
    // The knot back overlaps this section, and both tail roots overlap the knot.
    const [joinX, joinY, joinZ] = rings[16].center;
    const tails = empty();
    // Staggered free hems and gentle longitudinal folds give the ends weight.
    // Their depth changes slowly down the fall, independently of body curvature.
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
    const suspended = empty();
    append(suspended, collar);
    append(suspended, tails);
    append(suspended, knot);
    const lift = rigidFrontLift(suspended.points, suspended.indices, contour, scales, CLEARANCE);
    for (const ring of rings)
        ring.center[2] += lift;
    for (const part of [tails, knot])
        for (const point of part.points)
            point[2] += lift;
    // Each end turns up and back onto a small supported shoulder fold. There is
    // one continuous collar mesh from the left contact through to the right one.
    const support = (contact, end, reverse) => Array.from({ length: 4 }, (_, i) => {
        const u = (reverse ? 3 - i : i) / 4, smooth = u * u * (3 - 2 * u);
        return { center: [contact[0] + (end.center[0] - contact[0]) * u, contact[1] + (end.center[1] - contact[1]) * u,
                contact[2] + .016 * size + (end.center[2] - contact[2] - .016 * size) * smooth],
            width: size * (.023 + .019 * u), thickness: .013 * size, fold: .003 * size * u };
    });
    const supported = [...support(left, rings[0], false), ...rings, ...support(right, rings[rings.length - 1], true)];
    const mesh = empty();
    ribbon(mesh, supported);
    // Local correction is limited to the eight contact-fold rings. Move each
    // complete rounded section together; never stretch cloth thickness or normals.
    const corrections = drapedFrontLifts(mesh.points, mesh.indices, contour, scales);
    for (let ring = 0; ring < supported.length; ring++) {
        if (ring >= 4 && ring <= 28)
            continue;
        let correction = 0;
        for (let j = 0; j < SIDES; j++)
            correction = Math.max(correction, corrections[ring * SIDES + j]);
        if (ring === 0)
            correction = Math.max(correction, corrections[supported.length * SIDES]);
        if (ring === supported.length - 1)
            correction = Math.max(correction, corrections[supported.length * SIDES + 1]);
        for (let j = 0; j < SIDES; j++)
            mesh.points[ring * SIDES + j][2] += correction;
        if (ring === 0)
            mesh.points[supported.length * SIDES][2] += correction;
        if (ring === supported.length - 1)
            mesh.points[supported.length * SIDES + 1][2] += correction;
    }
    append(mesh, tails);
    mesh.mainIndexCount = mesh.indices.length;
    append(mesh, knot);
    return mesh;
}
