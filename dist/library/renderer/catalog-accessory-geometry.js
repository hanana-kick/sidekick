import { shapeContour } from '../core/contours.js';
import { contourVolumeHeight } from '../core/body-volume.js';
import { accessoryMountProfile, resolveShapeProfile } from '../core/shape-profiles.js';
import { BODY_SIZE, sampleAccessorySurface } from '../core/surface.js';
import { cross, normalize, sub, transform } from '../core/math.js';
import { viewPoint } from './eye-projection.js';
import { drapedFrontLifts, rigidFrontLift } from './rigid-contact.js';
import { drapedScarf } from './scarf-geometry.js';
export const CATALOG_ACCESSORY_CLEARANCE = 0.002;
/** Conservative local extents used by shape-independent camera framing. */
export const CATALOG_ACCESSORY_EXTENT = Object.freeze({ moustache: .24, goatee: .20, bowTie: .26, scarf: .47, necklace: .38, earring: .23, starEarring: .23 });
/** Small ear-clipped 2D patterns keep the silhouette deliberate and concave. */
function triangulate(points) {
    const remaining = points.map((_, i) => i), triangles = [];
    const area = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    while (remaining.length > 3) {
        let clipped = false;
        for (let i = 0; i < remaining.length; i++) {
            const a = remaining[(i + remaining.length - 1) % remaining.length], b = remaining[i], c = remaining[(i + 1) % remaining.length];
            if (area(points[a], points[b], points[c]) <= 1e-12)
                continue;
            if (remaining.some(index => index !== a && index !== b && index !== c && area(points[a], points[b], points[index]) >= -1e-12 && area(points[b], points[c], points[index]) >= -1e-12 && area(points[c], points[a], points[index]) >= -1e-12))
                continue;
            triangles.push(a, b, c);
            remaining.splice(i, 1);
            clipped = true;
            break;
        }
        if (!clipped)
            throw new Error('Accessory pattern must be a simple polygon.');
    }
    triangles.push(...remaining);
    return triangles;
}
function empty() { return { points: [], indices: [], mainIndexCount: 0 }; }
function prism(mesh, pattern, back, front) {
    let polygon = [...pattern];
    const signed = polygon.reduce((sum, p, i) => { const q = polygon[(i + 1) % polygon.length]; return sum + p[0] * q[1] - q[0] * p[1]; }, 0);
    if (signed < 0)
        polygon = polygon.reverse();
    const start = mesh.points.length, count = polygon.length, faces = triangulate(polygon);
    for (const z of [back, front])
        for (const [x, y] of polygon)
            mesh.points.push([x, y, z]);
    for (let i = 0; i < faces.length; i += 3) {
        const a = faces[i], b = faces[i + 1], c = faces[i + 2];
        mesh.indices.push(start + a, start + c, start + b, start + count + a, start + count + b, start + count + c);
    }
    for (let i = 0; i < count; i++) {
        const a = start + i, b = start + (i + 1) % count;
        mesh.indices.push(a, b, a + count, b, b + count, a + count);
    }
}
function cubic(a, b, c, d, steps = 6) {
    return Array.from({ length: steps }, (_, i) => {
        const t = (i + 1) / steps, s = 1 - t;
        return [s ** 3 * a[0] + 3 * s * s * t * b[0] + 3 * s * t * t * c[0] + t ** 3 * d[0], s ** 3 * a[1] + 3 * s * s * t * b[1] + 3 * s * t * t * c[1] + t ** 3 * d[1]];
    });
}
function moustachePattern() {
    const mesh = empty(), top = [0, .018], bottom = [0, -.014];
    const right = [top,
        ...cubic(top, [.027, .056], [.061, .056], [.091, .021]),
        ...cubic([.091, .021], [.126, -.009], [.160, .003], [.190, .047]),
        ...cubic([.190, .047], [.180, -.023], [.126, -.067], [.079, -.052]),
        ...cubic([.079, -.052], [.038, -.040], [.015, -.015], bottom),
    ];
    // One continuous two-lobe outline: tapered lifted tips and a center cleft.
    prism(mesh, [...right, ...right.slice(1, -1).reverse().map(([x, y]) => [-x, y])], 0, .034);
    mesh.mainIndexCount = mesh.indices.length;
    return mesh;
}
function goateePattern() {
    const mesh = empty();
    // A soft split upper edge and a tapered point read as a small, tailored beard.
    const top = [-.059, .019];
    const outline = [top, ...cubic(top, [-.040, .040], [-.015, .035], [0, .018]),
        ...cubic([0, .018], [.015, .035], [.040, .040], [.059, .019]),
        ...cubic([.059, .019], [.058, -.025], [.028, -.062], [0, -.082]),
        ...cubic([0, -.082], [-.028, -.062], [-.058, -.025], top).slice(0, -1)];
    prism(mesh, outline, 0, .032);
    mesh.mainIndexCount = mesh.indices.length;
    return mesh;
}
function bowTiePattern() {
    const mesh = empty();
    const loop = [[.026, .028], [.145, .083], [.171, .073], [.181, .045], [.181, -.045], [.163, -.075], [.140, -.080], [.026, -.028]];
    prism(mesh, loop, 0, .040);
    prism(mesh, loop.map(([x, y]) => [-x, y]), 0, .040);
    mesh.mainIndexCount = mesh.indices.length;
    // A separate chamfered knot overlaps the loop roots and carries the fold color.
    prism(mesh, [[-.031, -.034], [-.022, -.044], [.022, -.044], [.031, -.034], [.031, .034], [.022, .044], [-.022, .044], [-.031, .034]], .004, .058);
    return mesh;
}
/** Circular-section metal along a connected path. Closed paths have no seam. */
function tube(mesh, path, radius, closed = false, sides = 8) {
    const start = mesh.points.length, count = path.length;
    for (let i = 0; i < count; i++) {
        const previous = path[closed ? (i + count - 1) % count : Math.max(0, i - 1)], next = path[closed ? (i + 1) % count : Math.min(count - 1, i + 1)];
        const tangent = normalize(sub(next, previous)), helper = Math.abs(tangent[2]) < .95 ? [0, 0, 1] : [0, 1, 0];
        const a = normalize(cross(tangent, helper)), b = cross(tangent, a);
        for (let j = 0; j < sides; j++) {
            const angle = j / sides * Math.PI * 2, c = Math.cos(angle), s = Math.sin(angle), p = path[i];
            mesh.points.push([p[0] + radius * (a[0] * c + b[0] * s), p[1] + radius * (a[1] * c + b[1] * s), p[2] + radius * (a[2] * c + b[2] * s)]);
        }
    }
    for (let i = 0; i < count - (closed ? 0 : 1); i++)
        for (let j = 0; j < sides; j++) {
            const a = start + i * sides + j, b = start + ((i + 1) % count) * sides + j, c = start + i * sides + (j + 1) % sides, d = start + ((i + 1) % count) * sides + (j + 1) % sides;
            mesh.indices.push(a, c, b, c, d, b);
        }
    if (!closed) {
        const first = mesh.points.push([...path[0]]) - 1, last = mesh.points.push([...path[count - 1]]) - 1;
        for (let j = 0; j < sides; j++)
            mesh.indices.push(first, start + (j + 1) % sides, start + j, last, start + (count - 1) * sides + j, start + (count - 1) * sides + (j + 1) % sides);
    }
}
function earringPattern(side) {
    const mesh = empty(), centerX = side * .044, centerY = -.050, radius = .044;
    tube(mesh, Array.from({ length: 36 }, (_, i) => { const a = i / 36 * Math.PI * 2; return [centerX + radius * Math.cos(a), centerY + radius * Math.sin(a), .012]; }), .0085, true);
    // A small tapered drop shares the bottom of the hoop, rather than floating.
    prism(mesh, [[centerX, -.089], [centerX + .018, -.116], [centerX, -.145], [centerX - .018, -.116]], .004, .021);
    mesh.mainIndexCount = mesh.indices.length;
    return mesh;
}
function starEarringPattern(side) {
    const mesh = empty(), centerX = side * .044;
    // A small connecting ring and one full five-point star, joined at its top tip.
    tube(mesh, Array.from({ length: 24 }, (_, i) => { const a = i / 24 * Math.PI * 2; return [centerX + .022 * Math.cos(a), -.028 + .022 * Math.sin(a), .012]; }), .0075, true);
    const star = Array.from({ length: 10 }, (_, i) => { const a = Math.PI / 2 + i / 10 * Math.PI * 2, radius = i % 2 ? .023 : .051; return [centerX + radius * Math.cos(a), -.095 + radius * Math.sin(a)]; });
    prism(mesh, star, .004, .027);
    mesh.mainIndexCount = mesh.indices.length;
    return mesh;
}
const patterns = { goatee: goateePattern(), leftStarEarring: starEarringPattern(-1), rightStarEarring: starEarringPattern(1), moustache: moustachePattern(), bowTie: bowTiePattern(), leftEarring: earringPattern(-1), rightEarring: earringPattern(1) };
function necklacePattern(center, size, height) {
    const mesh = empty(), [x, y] = center, radius = .0095 * size;
    // A fine curved chain settles across the lower shoulder, with a centered drop.
    tube(mesh, Array.from({ length: 41 }, (_, i) => {
        const t = i / 40 * 2 - 1, px = x + .255 * size * t, py = y + size * (.085 * t * t - .020);
        return [px, py, 0];
    }), radius);
    // Author the tube in XY before draping its columns. A steep body shoulder
    // cannot flip the tube frame or make its projected underside self-intersect.
    for (const p of mesh.points)
        p[2] += height(p[0], p[1]) + radius + CATALOG_ACCESSORY_CLEARANCE;
    mesh.mainIndexCount = mesh.indices.length;
    const pendant = empty();
    prism(pendant, [[0, -.014], [.034, -.052], [0, -.103], [-.034, -.052]].map(([px, py]) => [x + px * size, y + py * size]), 0, .024 * size);
    // Each pendant face remains a plane; the chain may drape independently.
    const lift = Math.max(...pendant.points.map(p => height(p[0], p[1]))) + CATALOG_ACCESSORY_CLEARANCE;
    for (const p of pendant.points)
        p[2] += lift;
    const start = mesh.points.length;
    mesh.points.push(...pendant.points);
    mesh.indices.push(...pendant.indices.map(i => i + start));
    return mesh;
}
function geometry(mesh, attachment, seating) {
    const vertices = new Float32Array(mesh.points.length * 6);
    mesh.points.forEach((p, i) => vertices.set(p, i * 6));
    for (let i = 0; i < mesh.indices.length; i += 3) {
        const a = mesh.indices[i], b = mesh.indices[i + 1], c = mesh.indices[i + 2], n = cross(sub(mesh.points[b], mesh.points[a]), sub(mesh.points[c], mesh.points[a]));
        for (const index of [a, b, c])
            for (let k = 0; k < 3; k++)
                vertices[index * 6 + 3 + k] += n[k];
    }
    for (let i = 0; i < vertices.length; i += 6) {
        const n = normalize([vertices[i + 3], vertices[i + 4], vertices[i + 5]]);
        vertices.set(n, i + 3);
    }
    return { vertices, indices: new Uint16Array(mesh.indices), mainIndexCount: mesh.mainIndexCount, detailIndexCount: mesh.indices.length - mesh.mainIndexCount, attachment, seating };
}
/**
 * Bounded low-poly catalog geometry in body-local coordinates. Rigid pieces
 * retain their authored silhouettes and receive one exact front clearance
 * translation. The scarf has its own full-volume closed-wrap fitting.
 * Camera, gaze, eye expression, color and frame history never enter the fit.
 */
export function catalogAccessoryGeometry(body, accessory, squash = 1, contourOverride, profileOverride, rotation = accessory.rotation) {
    if (!['moustache', 'goatee', 'bowTie', 'scarf', 'necklace', 'earring', 'starEarring'].includes(accessory.preset))
        throw new TypeError('Expected a lower-body catalog accessory.');
    const contour = contourOverride ?? shapeContour({ kind: 'material', name: body.shape }), profile = profileOverride ?? resolveShapeProfile(body.shape), mount = accessoryMountProfile(accessory, profile);
    const frame = sampleAccessorySurface(body, accessory, squash, contour, profile), size = mount.scale * accessory.scale, stretch = 1 / Math.sqrt(squash);
    const scales = [BODY_SIZE[0] * .5 * stretch, BODY_SIZE[1] * .5 * squash, profile.depth * .5 * stretch];
    const height = (x, y) => contourVolumeHeight(contour, x / scales[0], y / scales[1]) * scales[2];
    let mesh;
    if (accessory.preset === 'scarf') {
        mesh = drapedScarf(frame.position, size, contour, scales, rotation);
    }
    else if (accessory.preset === 'necklace') {
        mesh = necklacePattern(frame.position, size, height);
        const posed = transform(frame.position, rotation);
        mesh.points = mesh.points.map(point => viewPoint(posed, sub(point, frame.position)));
    }
    else {
        const left = accessory.slot === 'leftEar';
        const pattern = accessory.preset === 'earring' ? patterns[left ? 'leftEarring' : 'rightEarring'] : accessory.preset === 'starEarring' ? patterns[left ? 'leftStarEarring' : 'rightStarEarring'] : patterns[accessory.preset];
        const posed = transform([0, 0, 0], rotation, [size, size, size]);
        mesh = { points: pattern.points.map(point => viewPoint(frame.matrix, viewPoint(posed, point))), indices: [...pattern.indices], mainIndexCount: pattern.mainIndexCount };
    }
    const seating = accessory.preset === 'scarf' ? 0 : rigidFrontLift(mesh.points, mesh.indices, contour, scales, CATALOG_ACCESSORY_CLEARANCE);
    for (const point of mesh.points)
        point[2] += seating;
    if (accessory.preset === 'earring' || accessory.preset === 'starEarring') {
        const sign = accessory.slot === 'leftEar' ? -1 : 1, posed = transform([0, 0, 0], rotation, [size, size, size]);
        const end = viewPoint(frame.matrix, viewPoint(posed, [sign * .044, -.006, .012]));
        end[2] += seating;
        const radius = .0085 * size, start = [frame.position[0], frame.position[1], frame.position[2] + radius + CATALOG_ACCESSORY_CLEARANCE];
        const path = Array.from({ length: 8 }, (_, i) => {
            const t = i / 7, p = start.map((value, k) => value + (end[k] - value) * t);
            p[2] = Math.max(p[2], height(p[0], p[1]) + radius + CATALOG_ACCESSORY_CLEARANCE);
            return p;
        });
        const wire = empty();
        tube(wire, path, radius);
        const lifts = drapedFrontLifts(wire.points, wire.indices, contour, scales);
        // Keep every wire cross-section circular. The maximum exact correction at
        // either neighboring face raises the complete ring instead of stretching
        // individual tube vertices. The contact end retains its own short seating.
        for (let ring = 0; ring < path.length; ring++) {
            let lift = 0;
            for (let j = 0; j < 8; j++)
                lift = Math.max(lift, lifts[ring * 8 + j]);
            if (ring === 0)
                lift = Math.max(lift, lifts[path.length * 8]);
            if (ring === path.length - 1)
                lift = Math.max(lift, lifts[path.length * 8 + 1]);
            for (let j = 0; j < 8; j++)
                wire.points[ring * 8 + j][2] += lift;
            if (ring === 0)
                wire.points[path.length * 8][2] += lift;
            if (ring === path.length - 1)
                wire.points[path.length * 8 + 1][2] += lift;
        }
        const startIndex = mesh.points.length;
        mesh.points.push(...wire.points);
        mesh.indices.push(...wire.indices.map(index => index + startIndex));
        mesh.mainIndexCount = mesh.indices.length;
    }
    return geometry(mesh, [...frame.position], seating);
}
/** Derived fold/knot color remains a solid, camera-independent material. */
export function accessoryDetailColor(color) {
    const value = parseInt(color.slice(1), 16);
    return '#' + [16, 8, 0].map(shift => Math.round(((value >> shift) & 255) * .78).toString(16).padStart(2, '0')).join('');
}
