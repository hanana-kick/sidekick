import { contourDistanceOutline, contourSignedDistance, shapeContour } from './contours.js';
import { contourVolumeHeight, contourVolumeNormal, VOLUME_CURVATURE } from './body-volume.js';
import { add, cross, dot, normalize, scale, frameMatrix, multiply, transform } from './math.js';
import { accessoryMountAnchor, accessoryMountProfile, resolveShapeProfile } from './shape-profiles.js';
/** Fixed catalog XY size plus the nominal square depth; actual Z comes from its profile. */
export const BODY_SIZE = Object.freeze([1.18, 1.18, 0.90]);
/** Current rounded height field, independent of mesh topology and frame history. */
export function contourSurfacePoint(contour, x, y, front = true) {
    return [x, y, contourVolumeHeight(contour, x, y) * (front ? 1 : -1)];
}
/** Body deformations are shared by the renderer and attachment/point APIs. */
export function deformBodyPoint(body, point, squash = 1, profileOverride) {
    const [x, y, z] = point, stretch = 1 / Math.sqrt(squash);
    const profile = profileOverride ?? resolveShapeProfile(body.shape);
    return [x * BODY_SIZE[0] * 0.5 * stretch, y * BODY_SIZE[1] * 0.5 * squash, z * profile.depth * 0.5 * stretch];
}
const hits = new WeakMap();
/** First positive intersection with the current XY outline. */
function rayBoundary(contour, x, y) {
    let wall = Infinity;
    if (Math.hypot(x, y) <= 1e-12)
        return wall;
    const points = contourDistanceOutline(contour);
    for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length], dx = b[0] - a[0], dy = b[1] - a[1], determinant = x * dy - y * dx;
        if (Math.abs(determinant) < 1e-14)
            continue;
        const t = (a[0] * dy - a[1] * dx) / determinant, u = (a[0] * y - a[1] * x) / determinant;
        if (t > 1e-10 && u >= -1e-10 && u <= 1 + 1e-10)
            wall = Math.min(wall, t);
    }
    return wall;
}
/**
 * First positive exit from the inflated field, including non-star-shaped lobes.
 * On a ray, being inside is equivalent to d(t) >= c*r(t)^2*z(t)^2/(1-z(t)^2).
 * The right side is monotone. Signed distance is 1-Lipschitz, so each interval
 * can be certified entirely inside using its midpoint and XY travel radius.
 * Visit unresolved intervals left-first: a concave dip cannot be skipped by a
 * bisection that happens to select a later exit. The final uncertainty is below
 * 1e-10 canonical units and does not depend on a frame's prior result.
 */
function raySurface(contour, direction) {
    const [x, y, z] = direction, key = direction.join(',');
    let cached = hits.get(contour);
    if (!cached) {
        cached = new Map();
        hits.set(contour, cached);
    }
    const previous = cached.get(key);
    if (previous)
        return previous;
    const xySpeed = Math.hypot(x, y), zSquared = z * z;
    let extent = Math.min(Math.abs(z) > 1e-12 ? 1 / Math.abs(z) : Infinity, rayBoundary(contour, x, y));
    if (!Number.isFinite(extent))
        throw new Error('Cannot intersect an empty body volume.');
    if (xySpeed > 1e-12 && Math.abs(z) > 1e-12) {
        const requiredDistance = (t) => {
            const square = t * t, denominator = 1 - square * zSquared;
            return denominator <= 0 ? Infinity : VOLUME_CURVATURE * xySpeed * xySpeed * zSquared * square * square / denominator;
        };
        const firstExit = (low, high) => {
            const middle = (low + high) / 2, distance = contourSignedDistance(contour, x * middle, y * middle);
            if (distance - xySpeed * (high - low) / 2 > requiredDistance(high))
                return undefined;
            if (high - low <= 1e-10)
                return middle;
            return firstExit(low, middle) ?? firstExit(middle, high);
        };
        extent = firstExit(0, extent) ?? extent;
    }
    const point = [x * extent, y * extent, z * extent];
    const result = { point, normal: contourVolumeNormal(contour, point[0], point[1], z >= 0) };
    if (cached.size >= 8192)
        cached.clear();
    cached.set(key, result);
    return result;
}
/** Physical ray intersection, with the same rounded field used by mesh vertices. */
export function bodyPoint(body, direction, squash = 1, contourOverride, profileOverride) {
    const contour = contourOverride ?? shapeContour({ kind: 'material', name: body.shape });
    return deformBodyPoint(body, raySurface(contour, normalize(direction)).point, squash, profileOverride);
}
export function bodyNormal(body, direction, squash = 1, contourOverride, profileOverride) {
    const contour = contourOverride ?? shapeContour({ kind: 'material', name: body.shape });
    const normal = raySurface(contour, normalize(direction)).normal;
    return deformBodyNormal(body, normal, squash, profileOverride);
}
/** Inverse-transpose counterpart of deformBodyPoint. */
export function deformBodyNormal(body, normal, squash = 1, profileOverride) {
    const stretch = 1 / Math.sqrt(squash);
    const profile = profileOverride ?? resolveShapeProfile(body.shape);
    return normalize([normal[0] / (BODY_SIZE[0] * stretch), normal[1] / (BODY_SIZE[1] * squash), normal[2] / (profile.depth * stretch)]);
}
/**
 * Direct XY surface query for rigid front-plane ink and calibrated cap mounts.
 * Unlike a physical ray this preserves XY spacing as the body inflates. Callers
 * choose contained XY coordinates; exterior coordinates land on the z=0 plane.
 */
export function sampleSurfaceAtXY(body, x, y, squash = 1, contourOverride, profileOverride, front = true) {
    const contour = contourOverride ?? shapeContour({ kind: 'material', name: body.shape });
    const position = deformBodyPoint(body, contourSurfacePoint(contour, x, y, front), squash, profileOverride);
    const normal = deformBodyNormal(body, contourVolumeNormal(contour, x, y, front), squash, profileOverride);
    let tangent = normalize(cross([0, 1, 0], normal));
    if (Math.abs(normal[1]) > 0.99)
        tangent = normalize(cross([1, 0, 0], normal));
    const bitangent = normalize(cross(normal, tangent));
    return { position, normal, tangent, bitangent, matrix: frameMatrix(position, tangent, bitangent, normal) };
}
function directionAt(anchor) {
    const [u, v] = anchor.uv;
    const x = Math.sin(u * 1.05) * Math.cos(v * 0.9), y = Math.sin(v * 0.9), z = Math.cos(u * 1.05) * Math.cos(v * 0.9);
    if (anchor.region === 'crown')
        return [x, z, -y];
    if (anchor.region === 'left')
        return [-z, y, x];
    if (anchor.region === 'right')
        return [z, y, -x];
    return [x, y, z];
}
export function sampleSurface(body, anchor, squash = 1, contourOverride, profileOverride) {
    const direction = directionAt(anchor), normal = bodyNormal(body, direction, squash, contourOverride, profileOverride);
    const helper = anchor.region === 'crown' ? [0, 0, -1] : [0, 1, 0];
    let tangent = normalize(cross(helper, normal));
    if (Math.abs(dot(helper, normal)) > 0.99)
        tangent = normalize(cross([1, 0, 0], normal));
    const bitangent = normalize(cross(normal, tangent));
    const position = add(bodyPoint(body, direction, squash, contourOverride, profileOverride), scale(normal, anchor.offset));
    return { position, normal, tangent, bitangent, matrix: frameMatrix(position, tangent, bitangent, normal) };
}
const mountCharts = new WeakMap();
/**
 * Arc-length phase comes from the exact first complex perimeter harmonic:
 * integral z(s) exp(-2 pi i s) ds, with normalized counter-clockwise length s.
 * Integrating each linear edge analytically makes cyclic reindexing and extra
 * collinear vertices immaterial. It never selects a discrete support vertex.
 */
function mountChart(contour) {
    const previous = mountCharts.get(contour);
    if (previous)
        return previous;
    const points = contour.points, distances = [0];
    let faceRadius = Infinity;
    for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        const dx = b[0] - a[0], dy = b[1] - a[1], lengthSquared = dx * dx + dy * dy;
        distances.push(distances[i] + Math.sqrt(lengthSquared));
        const closest = Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / lengthSquared));
        faceRadius = Math.min(faceRadius, Math.hypot(a[0] + closest * dx, a[1] + closest * dy));
    }
    const perimeter = distances[points.length], tau = Math.PI * 2;
    let real = 0, imaginary = 0;
    for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        const from = distances[i] / perimeter, to = distances[i + 1] / perimeter;
        const dx = (b[0] - a[0]) / (to - from), dy = (b[1] - a[1]) / (to - from);
        const realDelta = Math.cos(tau * to) - Math.cos(tau * from);
        const imaginaryDelta = Math.sin(tau * from) - Math.sin(tau * to);
        real += dx * realDelta - dy * imaginaryDelta;
        imaginary += dx * imaginaryDelta + dy * realDelta;
    }
    // Keep at least .001 interior clearance after the renderer's .00075 boundary
    // approximation, so an extreme face calibration still samples the front.
    const result = Object.freeze({ distances: Object.freeze(distances), perimeter, phase: Math.atan2(imaginary, real), magnitude: Math.hypot(real, imaginary) / (tau * tau), faceRadius: Math.max(0, faceRadius - 0.002) });
    mountCharts.set(contour, result);
    return result;
}
/** Diagnostics for the continuous, nonzero phase invariant used by mount charts. */
export function accessoryChartDiagnostics(contour) {
    const chart = mountChart(contour);
    return Object.freeze({ phase: chart.phase, magnitude: chart.magnitude });
}
function perimeterMountPoint(contour, direction) {
    const chart = mountChart(contour), angle = Math.atan2(direction[1], direction[0]);
    const progress = (((angle - chart.phase) / (2 * Math.PI) % 1) + 1) % 1;
    const distance = progress * chart.perimeter, points = contour.points;
    let low = 0, high = points.length;
    while (low + 1 < high) {
        const middle = (low + high) >>> 1;
        if (chart.distances[middle] <= distance)
            low = middle;
        else
            high = middle;
    }
    const start = chart.distances[low], end = chart.distances[low + 1];
    const amount = (distance - start) / (end - start), a = points[low], b = points[(low + 1) % points.length];
    const x = a[0] + (b[0] - a[0]) * amount, y = a[1] + (b[1] - a[1]) * amount;
    // A rounded rim has no vertical wall. Retain meaningful front/back accessory
    // placement as bounded calibration around that stable rim, rather than
    // falsely treating the second coordinate as an exact physical surface UV.
    const z = direction[2] * Math.hypot(x, y) / Math.max(1e-12, Math.hypot(direction[0], direction[1]));
    return [x, y, Math.max(-1, Math.min(1, z))];
}
/**
 * A finite Lipschitz walk from the known interior center. Every step is bounded
 * by signed-distance clearance, so it cannot cross a thin intervening notch.
 * Fixed iteration count plus continuous min/max avoids the branch switch of a
 * first-ray-hit solver and also avoids choosing a nearest boundary vertex.
 */
function containedFrontPoint(contour, x, y, clearance) {
    const extent = Math.hypot(x, y), dx = x / Math.max(extent, 1e-12), dy = y / Math.max(extent, 1e-12);
    let traveled = 0;
    for (let i = 0; i < 24; i++)
        traveled += Math.min(extent - traveled, Math.max(0, contourSignedDistance(contour, dx * traveled, dy * traveled) - clearance));
    return contourSurfacePoint(contour, dx * traveled, dy * traveled);
}
/** Generic contained front chart with an independently authored rigid plane. */
export function sampleContainedFrontSurface(body, mount, squash = 1, contourOverride, profileOverride) {
    const contour = contourOverride ?? shapeContour({ kind: 'material', name: body.shape });
    const direction = directionAt({ region: 'face', uv: [...mount.uv], offset: mount.offset });
    const point = containedFrontPoint(contour, direction[0] / direction[2], direction[1] / direction[2], .012);
    const orientation = transform([0, 0, 0], mount.rotation), stretch = 1 / Math.sqrt(squash);
    const normal = normalize([orientation[8] / stretch, orientation[9] / squash, orientation[10] / stretch]);
    const deformedTangent = [orientation[0] * stretch, orientation[1] * squash, orientation[2] * stretch];
    const bitangent = normalize(cross(normal, deformedTangent)), tangent = normalize(cross(bitangent, normal));
    const position = add(deformBodyPoint(body, point, squash, profileOverride), scale(normal, mount.offset));
    return { position, normal, tangent, bitangent, matrix: frameMatrix(position, tangent, bitangent, normal) };
}
/** Generic calibrated chart; contains no catalog accessory selection or geometry. */
export function sampleCalibratedSurface(body, mount, chart, options = {}, squash = 1, contourOverride, profileOverride) {
    const contour = contourOverride ?? shapeContour({ kind: 'material', name: body.shape });
    const region = chart === 'crown-envelope' ? 'crown' : chart === 'perimeter-front' ? options.region ?? 'left' : 'face';
    const anchor = { region, uv: [...mount.uv], offset: mount.offset }, direction = directionAt(anchor);
    const canonicalNormal = directionAt({ ...anchor, uv: [0, 0] }), helper = region === 'crown' ? [0, 0, -1] : [0, 1, 0];
    const baseTangent = normalize(cross(helper, canonicalNormal)), baseBitangent = normalize(cross(canonicalNormal, baseTangent));
    const orientation = multiply(frameMatrix([0, 0, 0], baseTangent, baseBitangent, canonicalNormal), transform([0, 0, 0], mount.rotation));
    const stretch = 1 / Math.sqrt(squash), normal = normalize([orientation[8] / stretch, orientation[9] / squash, orientation[10] / stretch]);
    const bitangent = normalize(cross(normal, [orientation[0] * stretch, orientation[1] * squash, orientation[2] * stretch])), tangent = normalize(cross(bitangent, normal));
    let point;
    if (chart === 'crown-envelope')
        point = [mount.uv[0], Math.max(...contour.points.map(p => p[1])) + mount.uv[1], 0];
    else if (chart === 'perimeter-front') {
        const perimeter = perimeterMountPoint(contour, direction), inset = options.perimeterInset ?? .96;
        point = containedFrontPoint(contour, perimeter[0] * inset, perimeter[1] * inset, options.containmentClearance ?? .006);
    }
    else {
        const x = direction[0] / direction[2], y = direction[1] / direction[2], fit = Math.min(1, mountChart(contour).faceRadius / Math.max(Math.hypot(x, y), 1e-12));
        point = contourSurfacePoint(contour, x * fit, y * fit);
    }
    const position = add(deformBodyPoint(body, point, squash, profileOverride), scale(normal, mount.offset));
    return { position, normal, tangent, bitangent, matrix: frameMatrix(position, tangent, bitangent, normal) };
}
/**
 * A curated junction, independent of the angular ray used to choose its location.
 * The position follows the current contour's phase-locked perimeter continuously;
 * the fixed regional frame is rotated by the shape/accessory's chosen band plane.
 * A heart's right lobe therefore does not inherit the radial tilt from the notch.
 * Halo height uses the current top envelope and stays centered even on split crowns.
 * Neither orientation nor placement selects a nearest vertex or carries frame history.
 */
export function sampleAccessorySurface(body, accessory, squash = 1, contourOverride, profileOverride) {
    const profile = profileOverride ?? resolveShapeProfile(body.shape);
    const contour = contourOverride ?? shapeContour({ kind: 'material', name: body.shape });
    const mount = accessoryMountProfile(accessory, profile), anchor = accessoryMountAnchor(accessory, profile), direction = directionAt(anchor);
    if (anchor.region === 'face' && ['moustache', 'goatee', 'bowTie', 'scarf', 'necklace'].includes(accessory.preset))
        return sampleContainedFrontSurface(body, { ...mount, uv: anchor.uv, offset: anchor.offset }, squash, contour, profile);
    const canonicalNormal = directionAt({ ...anchor, uv: [0, 0] });
    const helper = anchor.region === 'crown' ? [0, 0, -1] : [0, 1, 0];
    const baseTangent = normalize(cross(helper, canonicalNormal)), baseBitangent = normalize(cross(canonicalNormal, baseTangent));
    // Crown opening yaw is local: align its oval first, then lean the whole circlet.
    // A world-space yaw after leaning would rotate the support direction as well.
    const mountRotation = accessory.preset === 'crown'
        ? multiply(transform([0, 0, 0], [mount.rotation[0], mount.rotation[1], 0]), transform([0, 0, 0], [0, 0, mount.rotation[2]]))
        : transform([0, 0, 0], mount.rotation);
    const orientation = multiply(frameMatrix([0, 0, 0], baseTangent, baseBitangent, canonicalNormal), mountRotation);
    const stretch = 1 / Math.sqrt(squash);
    // A band's plane follows the body deformation by inverse-transpose, while the
    // orthonormalized frame keeps the accessory itself rigid rather than squashing it.
    const normal = normalize([orientation[8] / stretch, orientation[9] / squash, orientation[10] / stretch]);
    const deformedTangent = [orientation[0] * stretch, orientation[1] * squash, orientation[2] * stretch];
    const bitangent = normalize(cross(normal, deformedTangent)), tangent = normalize(cross(bitangent, normal));
    let point;
    if (accessory.preset === 'crown') {
        // Crown support is authored in canonical XY, not perimeter arc phase.
        // Concave outlines have very different arc lengths; a phase cannot name
        // the same summit reliably. The rigid seating solver determines depth.
        point = [anchor.uv[0], anchor.uv[1], 0];
    }
    else if (accessory.preset === 'halo') {
        point = [0, Math.max(...contour.points.map(p => p[1])), 0];
    }
    else if (anchor.region === 'face') {
        const x = direction[0] / direction[2], y = direction[1] / direction[2], radius = Math.hypot(x, y);
        // Lower-front mounts are individually curated contained XY junctions. The
        // historical glasses chart retains its conservative central-disk fitting.
        const lowerFront = accessory.preset === 'moustache' || accessory.preset === 'goatee' || accessory.preset === 'bowTie' || accessory.preset === 'scarf' || accessory.preset === 'necklace';
        const fit = lowerFront ? 1 : Math.min(1, mountChart(contour).faceRadius / Math.max(radius, 1e-12));
        point = lowerFront ? containedFrontPoint(contour, x, y, .012) : contourSurfacePoint(contour, x * fit, y * fit);
    }
    else {
        point = perimeterMountPoint(contour, direction);
        if (accessory.preset === 'earring' || accessory.preset === 'starEarring') {
            // A tiny inset lands the stud on the rounded front shoulder. Position
            // follows the continuous perimeter chart; the hoop plane stays upright.
            point = containedFrontPoint(contour, point[0] * .96, point[1] * .96, .006);
        }
    }
    const position = add(deformBodyPoint(body, point, squash, profile), scale(normal, anchor.offset));
    return { position, normal, tangent, bitangent, matrix: frameMatrix(position, tangent, bitangent, normal) };
}
