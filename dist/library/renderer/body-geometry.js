import { shapeContour, contourBoundaryPoints, contourSignedDistance } from '../core/contours.js';
import { contourVolumeHeight } from '../core/body-volume.js';
import { VolumeTriangulation } from './volume-triangulation.js';
const cache = new WeakMap();
/** Interior height refinement target. This is sampled, not an analytic bound. */
export const BODY_HEIGHT_TOLERANCE = 0.006;
/** Sampled edge/triangle-plane distance refinement target in canonical space. */
export const BODY_SURFACE_TOLERANCE = 0.010;
/** Strict budget, including the mirrored half, stays below WebGL Uint16 limits. */
export const BODY_VOLUME_MAX_POINTS = 12000;
/** Geometry follows the actual current contour, not only its endpoint recipes. */
export function bodyGeometryKey(shape) { return JSON.stringify(shape); }
/**
 * Rounded, watertight double-height surface. Constrained Delaunay triangles
 * preserve every boundary segment; interior samples need no radial/star-shape
 * assumption. Shared-edge midpoint subdivision concentrates samples where the
 * continuous dome bends, with bounded passes/work. No intermediate planar caps.
 */
export function bodyGeometry(input, roundness = 0.5) {
    const contour = typeof input !== 'string' && input.kind === 'contour' ? input : shapeContour(input, roundness);
    const previous = cache.get(contour);
    if (previous)
        return previous;
    const boundary = contourBoundaryPoints(contour), boundaryCount = boundary.length;
    if (boundaryCount >= BODY_VOLUME_MAX_POINTS / 2)
        throw new RangeError('Body contour exceeds the WebGL mesh budget.');
    const mesh = new VolumeTriangulation(boundary);
    const insert = (x, y) => {
        if (contourSignedDistance(contour, x, y) > 1e-7)
            mesh.insert([x, y]);
    };
    const spacing = 0.1;
    for (let row = -10; row <= 10; row++)
        for (let col = -10; col <= 10; col++)
            insert(col * spacing + (row % 2) * spacing / 2, row * spacing);
    insert(0, 0);
    const heights = mesh.points.map((p, i) => i < boundaryCount ? 0 : contourVolumeHeight(contour, p[0], p[1]));
    let triangles = mesh.triangles.filter(t => t.live).map(t => t.ids);
    const edgeKey = (a, b) => a < b ? a * 32768 + b : b * 32768 + a;
    const boundaryEdges = new Set(boundary.map((_, i) => edgeKey(i, (i + 1) % boundaryCount)));
    const edgeSamples = new Map();
    const sampleEdge = (a, b) => {
        const key = edgeKey(a, b), cached = edgeSamples.get(key);
        if (cached)
            return cached;
        const pa = mesh.points[a], pb = mesh.points[b], point = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
        const height = boundaryEdges.has(key) ? 0 : contourVolumeHeight(contour, point[0], point[1]);
        const xySquared = (pa[0] - pb[0]) ** 2 + (pa[1] - pb[1]) ** 2, hz = heights[a] - heights[b];
        const delta = height - (heights[a] + heights[b]) / 2;
        const errorSquared = delta * delta * xySquared / (xySquared + hz * hz);
        const faceErrorSquared = point[0] * point[0] + point[1] * point[1] < 0.1225 ? delta * delta : 0;
        const result = { point, height, errorSquared, faceErrorSquared };
        edgeSamples.set(key, result);
        return result;
    };
    const settled = new Set();
    // Red/green shared-edge subdivision is linear in the mesh size. Every split
    // is shared by its neighbor, so it cannot introduce T junctions or overlaps.
    for (let round = 0; round < 8 && mesh.points.length < BODY_VOLUME_MAX_POINTS; round++) {
        const splits = new Map();
        const split = (a, b) => {
            const key = edgeKey(a, b);
            if (splits.has(key) || mesh.points.length >= BODY_VOLUME_MAX_POINTS)
                return;
            const sample = sampleEdge(a, b), id = mesh.points.length;
            mesh.points.push(sample.point);
            heights.push(sample.height);
            splits.set(key, id);
            if (boundaryEdges.delete(key)) {
                boundaryEdges.add(edgeKey(a, id));
                boundaryEdges.add(edgeKey(id, b));
            }
        };
        for (const triangle of triangles) {
            if (settled.has(triangle))
                continue;
            const [a, b, c] = triangle;
            // Most early failures are visible at an edge. Avoid a redundant center
            // distance query until the three edge tests already satisfy the budget.
            let needsSplit = false;
            for (const [i, j] of [[a, b], [b, c], [c, a]]) {
                const edge = sampleEdge(i, j);
                if (edge.errorSquared > BODY_SURFACE_TOLERANCE * BODY_SURFACE_TOLERANCE || edge.faceErrorSquared > BODY_HEIGHT_TOLERANCE * BODY_HEIGHT_TOLERANCE) {
                    split(i, j);
                    needsSplit = true;
                }
            }
            if (needsSplit)
                continue;
            const pa = mesh.points[a], pb = mesh.points[b], pc = mesh.points[c];
            const ha = heights[a], hb = heights[b], hc = heights[c];
            const ux = pb[0] - pa[0], uy = pb[1] - pa[1], uz = hb - ha, vx = pc[0] - pa[0], vy = pc[1] - pa[1], vz = hc - ha;
            const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
            const nzSquared = nz * nz / (nx * nx + ny * ny + nz * nz);
            const x = (pa[0] + pb[0] + pc[0]) / 3, y = (pa[1] + pb[1] + pc[1]) / 3;
            const centerDelta = contourVolumeHeight(contour, x, y) - (ha + hb + hc) / 3, errorSquared = centerDelta * centerDelta;
            if (errorSquared * nzSquared > BODY_SURFACE_TOLERANCE * BODY_SURFACE_TOLERANCE || (x * x + y * y < 0.1225 && errorSquared > BODY_HEIGHT_TOLERANCE * BODY_HEIGHT_TOLERANCE)) {
                const ab = ux * ux + uy * uy, ac = vx * vx + vy * vy, bc = (ux - vx) ** 2 + (uy - vy) ** 2;
                if (ab >= ac && ab >= bc)
                    split(a, b);
                else if (ac >= bc)
                    split(c, a);
                else
                    split(b, c);
            }
            else
                settled.add(triangle);
        }
        if (!splits.size)
            break;
        const refined = [];
        for (const triangle of triangles) {
            const [a, b, c] = triangle;
            const ab = splits.get(edgeKey(a, b)), bc = splits.get(edgeKey(b, c)), ca = splits.get(edgeKey(c, a));
            const mask = (ab === undefined ? 0 : 1) | (bc === undefined ? 0 : 2) | (ca === undefined ? 0 : 4);
            switch (mask) {
                case 0:
                    refined.push(triangle);
                    break;
                case 1:
                    refined.push([a, ab, c], [ab, b, c]);
                    break;
                case 2:
                    refined.push([b, bc, a], [bc, c, a]);
                    break;
                case 4:
                    refined.push([c, ca, b], [ca, a, b]);
                    break;
                case 3:
                    refined.push([b, bc, ab], [a, ab, c], [ab, bc, c]);
                    break;
                case 5:
                    refined.push([a, ab, ca], [ab, b, c], [ab, c, ca]);
                    break;
                case 6:
                    refined.push([c, ca, bc], [a, b, ca], [b, bc, ca]);
                    break;
                case 7:
                    refined.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
                    break;
            }
        }
        triangles = refined;
    }
    const count = mesh.points.length, rim = new Set();
    for (const edge of boundaryEdges) {
        rim.add(Math.floor(edge / 32768));
        rim.add(edge % 32768);
    }
    const backIds = new Uint16Array(count);
    let total = count;
    for (let i = 0; i < count; i++)
        backIds[i] = rim.has(i) ? i : total++;
    const vertices = new Float32Array(total * 6), indices = new Uint16Array(triangles.length * 6);
    for (let i = 0; i < count; i++) {
        const [x, y] = mesh.points[i], h = heights[i], front = i * 6, back = backIds[i] * 6;
        vertices[front] = x;
        vertices[front + 1] = y;
        vertices[front + 2] = h;
        if (back !== front) {
            vertices[back] = x;
            vertices[back + 1] = y;
            vertices[back + 2] = -h;
        }
    }
    // The two halves are exact reflections. Accumulate each front normal once,
    // then reflect it for the back; shared equator normals have no Z component.
    for (let i = 0; i < triangles.length; i++) {
        const [ia, ib, ic] = triangles[i], base = i * 6;
        indices[base] = ia;
        indices[base + 1] = ib;
        indices[base + 2] = ic;
        indices[base + 3] = backIds[ic];
        indices[base + 4] = backIds[ib];
        indices[base + 5] = backIds[ia];
        const a = ia * 6, b = ib * 6, c = ic * 6;
        const ux = vertices[b] - vertices[a], uy = vertices[b + 1] - vertices[a + 1], uz = vertices[b + 2] - vertices[a + 2];
        const vx = vertices[c] - vertices[a], vy = vertices[c + 1] - vertices[a + 1], vz = vertices[c + 2] - vertices[a + 2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        vertices[a + 3] += nx;
        vertices[a + 4] += ny;
        vertices[a + 5] += nz;
        vertices[b + 3] += nx;
        vertices[b + 4] += ny;
        vertices[b + 5] += nz;
        vertices[c + 3] += nx;
        vertices[c + 4] += ny;
        vertices[c + 5] += nz;
    }
    for (let i = 0; i < count; i++) {
        const front = i * 6, back = backIds[i] * 6;
        if (front === back)
            vertices[front + 5] = 0;
        const nx = vertices[front + 3], ny = vertices[front + 4], nz = vertices[front + 5];
        const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (length > 0) {
            vertices[front + 3] = vertices[back + 3] = nx / length;
            vertices[front + 4] = vertices[back + 4] = ny / length;
            vertices[front + 5] = nz / length;
            if (front !== back)
                vertices[back + 5] = -nz / length;
        }
    }
    const result = { vertices, indices };
    cache.set(contour, result);
    return result;
}
