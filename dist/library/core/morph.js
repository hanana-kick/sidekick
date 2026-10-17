import { contourSnapshot, shapeContour, simplifyContourPoints } from './contours.js';
const measurements = new WeakMap();
const plans = new WeakMap();
const wrap = (n) => ((n % 1) + 1) % 1;
function measure(contour) {
    const old = measurements.get(contour);
    if (old)
        return old;
    const points = contour.points, distances = [0];
    for (let i = 1; i <= points.length; i++)
        distances.push(distances[i - 1] + Math.hypot(points[i % points.length][0] - points[i - 1][0], points[i % points.length][1] - points[i - 1][1]));
    const total = distances.pop(), result = { points, progress: distances.map(v => v / total) };
    measurements.set(contour, result);
    return result;
}
function pointAt(outline, amount) {
    const p = wrap(amount), count = outline.points.length;
    let lo = 0, hi = count;
    while (lo + 1 < hi) {
        const mid = (lo + hi) >>> 1;
        if (outline.progress[mid] <= p)
            lo = mid;
        else
            hi = mid;
    }
    const start = outline.progress[lo], end = lo + 1 === count ? 1 : outline.progress[lo + 1], t = (p - start) / (end - start);
    const a = outline.points[lo], b = outline.points[(lo + 1) % count];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
/** Keep repeated interrupted transitions bounded without visible approximation. */
export const MAX_MORPH_POINTS = 8192;
export const MORPH_SNAPSHOT_TOLERANCE = 0.000001;
function boundedSnapshot(points) {
    if (points.length <= MAX_MORPH_POINTS)
        return contourSnapshot(points);
    let tolerance = MORPH_SNAPSHOT_TOLERANCE, reduced = simplifyContourPoints(points, tolerance);
    while (reduced.length > MAX_MORPH_POINTS) {
        tolerance *= 2;
        reduced = simplifyContourPoints(points, tolerance);
    }
    return contourSnapshot(reduced);
}
const MATCH_SAMPLES = 256;
/** Minimize actual movement, without rotating or scaling either endpoint geometry. */
function bestPhase(from, to) {
    const a = Array.from({ length: MATCH_SAMPLES }, (_, i) => pointAt(from, i / MATCH_SAMPLES));
    const b = Array.from({ length: MATCH_SAMPLES }, (_, i) => pointAt(to, i / MATCH_SAMPLES));
    let minimum = Infinity, phase = 0;
    for (let shift = 0; shift < MATCH_SAMPLES; shift++) {
        let cost = 0;
        for (let i = 0; i < MATCH_SAMPLES; i++) {
            const p = a[i], q = b[(i + shift) % MATCH_SAMPLES];
            cost += (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
        }
        if (cost < minimum - 1e-12) {
            minimum = cost;
            phase = shift / MATCH_SAMPLES;
        }
    }
    const cost = (offset) => a.reduce((sum, p, i) => { const q = pointAt(to, i / MATCH_SAMPLES + offset); return sum + (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2; }, 0);
    let step = 1 / MATCH_SAMPLES / 2;
    for (let i = 0; i < 10; i++, step /= 2) {
        const before = cost(phase - step), after = cost(phase + step);
        if (before < minimum && before <= after) {
            phase -= step;
            minimum = before;
        }
        else if (after < minimum) {
            phase += step;
            minimum = after;
        }
    }
    return wrap(phase);
}
function checked(progress) { if (!Number.isFinite(progress) || progress < 0 || progress > 1)
    throw new RangeError('Morph progress must be a finite number from 0 to 1.'); }
function asContour(value, roundness) {
    if (typeof value === 'string' || value.kind !== 'contour')
        return shapeContour(value, roundness);
    return Object.isFrozen(value) && Object.isFrozen(value.points) && value.points.every(Object.isFrozen) ? value : contourSnapshot(value.points);
}
/**
 * Match whole oriented perimeters, then merge BOTH sets of boundary breakpoints.
 * Every original corner remains present. Points move directly to their matches;
 * there is no intermediate shape, implicit ellipse, rotation, or radius blending.
 * A displayed snapshot can be used as the source of any later transition.
 */
export function buildMorph(fromShape, toShape, roundness = 0.5) {
    const from = asContour(fromShape, roundness), to = asContour(toShape, roundness);
    let targets = plans.get(from);
    if (!targets) {
        targets = new WeakMap();
        plans.set(from, targets);
    }
    const previous = targets.get(to);
    if (previous)
        return previous;
    if (from === to) {
        const result = Object.freeze({ from, to, sample(progress) { checked(progress); return from; } });
        targets.set(to, result);
        return result;
    }
    const a = measure(from), b = measure(to), phase = bestPhase(a, b);
    const knots = [...a.progress, ...b.progress.map(p => wrap(p - phase)), 0].sort((x, y) => x - y).filter((p, i, ps) => !i || p - ps[i - 1] > 1e-12);
    const source = knots.map(p => pointAt(a, p)), target = knots.map(p => pointAt(b, p + phase));
    const result = Object.freeze({ from, to, sample(progress) {
            checked(progress);
            if (progress === 0)
                return from;
            if (progress === 1)
                return to;
            return boundedSnapshot(source.map((p, i) => { const q = target[i]; return [p[0] + (q[0] - p[0]) * progress, p[1] + (q[1] - p[1]) * progress]; }));
        } });
    targets.set(to, result);
    let reversed = plans.get(to);
    if (!reversed) {
        reversed = new WeakMap();
        plans.set(to, reversed);
    }
    reversed.set(from, Object.freeze({ from: to, to: from, sample(progress) { checked(progress); return result.sample(1 - progress); } }));
    return result;
}
