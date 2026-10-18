function positionCount(positions, stride) {
    if (ArrayBuffer.isView(positions)) {
        if (positions.length % stride)
            throw new RangeError('Position buffer length must be divisible by its stride.');
        return positions.length / stride;
    }
    return positions.length;
}
function position(positions, index, stride, out) {
    if (ArrayBuffer.isView(positions)) {
        const offset = index * stride;
        out[0] = positions[offset];
        out[1] = positions[offset + 1];
        out[2] = positions[offset + 2];
    }
    else {
        const p = positions[index];
        out[0] = p[0];
        out[1] = p[1];
        out[2] = p[2];
    }
}
function validPoint(p) { return Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2]); }
function validIndex(index, count) { return Number.isInteger(index) && index >= 0 && index < count; }
function include(bounds, other) {
    bounds.minX = Math.min(bounds.minX, other.minX);
    bounds.minY = Math.min(bounds.minY, other.minY);
    bounds.minZ = Math.min(bounds.minZ, other.minZ);
    bounds.maxX = Math.max(bounds.maxX, other.maxX);
    bounds.maxY = Math.max(bounds.maxY, other.maxY);
    bounds.maxZ = Math.max(bounds.maxZ, other.maxZ);
}
function compareCenters(a, b, axis) {
    const difference = axis === 0 ? (a.minX + a.maxX) - (b.minX + b.maxX)
        : axis === 1 ? (a.minY + a.maxY) - (b.minY + b.maxY) : (a.minZ + a.maxZ) - (b.minZ + b.maxZ);
    return difference || a.index - b.index;
}
function partitionSpatial(triangles, begin, end, axis, split) {
    let left = begin, right = end - 1;
    while (left <= right) {
        const triangle = triangles[left], center = axis === 0 ? triangle.minX + triangle.maxX : axis === 1 ? triangle.minY + triangle.maxY : triangle.minZ + triangle.maxZ;
        if (center < split)
            left++;
        else {
            triangles[left] = triangles[right];
            triangles[right--] = triangle;
        }
    }
    return left;
}
/** In-place median selection; no sorted slices or allocation at each BVH node. */
function partitionMedian(triangles, begin, end, middle, axis) {
    let low = begin, high = end - 1;
    while (low < high) {
        const mid = (low + high) >>> 1;
        // A deterministic median-of-three pivot avoids the sorted-input worst case.
        let a = triangles[low], b = triangles[mid], c = triangles[high];
        if (compareCenters(a, b, axis) > 0) {
            const swap = a;
            a = b;
            b = swap;
        }
        if (compareCenters(b, c, axis) > 0) {
            const swap = b;
            b = c;
            c = swap;
        }
        if (compareCenters(a, b, axis) > 0)
            b = a;
        const pivot = b;
        let left = low, right = high;
        while (left <= right) {
            while (compareCenters(triangles[left], pivot, axis) < 0)
                left++;
            while (compareCenters(triangles[right], pivot, axis) > 0)
                right--;
            if (left <= right) {
                const swap = triangles[left];
                triangles[left++] = triangles[right];
                triangles[right--] = swap;
            }
        }
        if (middle <= right)
            high = right;
        else if (middle >= left)
            low = left;
        else
            return;
    }
}
/** Squared lower bound used to prune nearest-point traversal. */
function boundsDistance(bounds, p) {
    const x = Math.max(bounds.minX - p[0], 0, p[0] - bounds.maxX);
    const y = Math.max(bounds.minY - p[1], 0, p[1] - bounds.maxY);
    const z = Math.max(bounds.minZ - p[2], 0, p[2] - bounds.maxZ);
    return x * x + y * y + z * z;
}
/** Continuous height barrier: zero above minZ, diverging at minZ - radius. */
function supportHeightPenalty(maxZ, minZ, radius) {
    if (maxZ >= minZ)
        return 0;
    const fraction = (minZ - maxZ) / radius;
    return fraction >= 1 ? Infinity : -radius * Math.log1p(-fraction * fraction);
}
function boundsOverlap(a, b, epsilon) {
    return a.minX <= b.maxX + epsilon && a.maxX >= b.minX - epsilon
        && a.minY <= b.maxY + epsilon && a.maxY >= b.minY - epsilon
        && a.minZ <= b.maxZ + epsilon && a.maxZ >= b.minZ - epsilon;
}
/** Separating-axis test with projections relative to A's origin for stability. */
function separatesOnAxis(a, b, x, y, z, epsilon) {
    if (x === 0 && y === 0 && z === 0)
        return false;
    const a1 = x * a.ab[0] + y * a.ab[1] + z * a.ab[2], a2 = x * a.ac[0] + y * a.ac[1] + z * a.ac[2];
    const b0 = x * (b.a[0] - a.a[0]) + y * (b.a[1] - a.a[1]) + z * (b.a[2] - a.a[2]);
    const b1 = x * (b.b[0] - a.a[0]) + y * (b.b[1] - a.a[1]) + z * (b.b[2] - a.a[2]);
    const b2 = x * (b.c[0] - a.a[0]) + y * (b.c[1] - a.a[1]) + z * (b.c[2] - a.a[2]);
    const tolerance = epsilon * Math.hypot(x, y, z);
    return Math.max(0, a1, a2) < Math.min(b0, b1, b2) - tolerance
        || Math.max(b0, b1, b2) < Math.min(0, a1, a2) - tolerance;
}
/**
 * Convex triangle SAT: both plane normals and all nine edge cross-products.
 * In-plane edge normals additionally distinguish disjoint coplanar triangles,
 * for which the ordinary 3D axes collapse to the shared plane normal. Extra
 * separating axes are also valid in the noncoplanar case. No point sampling.
 */
function trianglesOverlap(a, b, epsilon) {
    const an = a.normal, bn = b.normal;
    if (separatesOnAxis(a, b, an[0], an[1], an[2], epsilon) || separatesOnAxis(a, b, bn[0], bn[1], bn[2], epsilon))
        return false;
    for (let i = 0; i < 3; i++) {
        const ax = i === 0 ? a.ab[0] : i === 1 ? a.ac[0] - a.ab[0] : -a.ac[0];
        const ay = i === 0 ? a.ab[1] : i === 1 ? a.ac[1] - a.ab[1] : -a.ac[1];
        const az = i === 0 ? a.ab[2] : i === 1 ? a.ac[2] - a.ab[2] : -a.ac[2];
        if (separatesOnAxis(a, b, an[1] * az - an[2] * ay, an[2] * ax - an[0] * az, an[0] * ay - an[1] * ax, epsilon))
            return false;
        const bx = i === 0 ? b.ab[0] : i === 1 ? b.ac[0] - b.ab[0] : -b.ac[0];
        const by = i === 0 ? b.ab[1] : i === 1 ? b.ac[1] - b.ab[1] : -b.ac[1];
        const bz = i === 0 ? b.ab[2] : i === 1 ? b.ac[2] - b.ab[2] : -b.ac[2];
        if (separatesOnAxis(a, b, bn[1] * bz - bn[2] * by, bn[2] * bx - bn[0] * bz, bn[0] * by - bn[1] * bx, epsilon))
            return false;
        for (let j = 0; j < 3; j++) {
            const x = j === 0 ? b.ab[0] : j === 1 ? b.ac[0] - b.ab[0] : -b.ac[0];
            const y = j === 0 ? b.ab[1] : j === 1 ? b.ac[1] - b.ab[1] : -b.ac[1];
            const z = j === 0 ? b.ab[2] : j === 1 ? b.ac[2] - b.ab[2] : -b.ac[2];
            if (separatesOnAxis(a, b, ay * z - az * y, az * x - ax * z, ax * y - ay * x, epsilon))
                return false;
        }
    }
    return true;
}
/** Continuous overlap interval on one fixed separating axis under translation. */
function overlapTimeOnAxis(a, b, direction, x, y, z, epsilon, interval) {
    if (x === 0 && y === 0 && z === 0)
        return true;
    const a1 = x * a.ab[0] + y * a.ab[1] + z * a.ab[2], a2 = x * a.ac[0] + y * a.ac[1] + z * a.ac[2];
    const b0 = x * (b.a[0] - a.a[0]) + y * (b.a[1] - a.a[1]) + z * (b.a[2] - a.a[2]);
    const b1 = x * (b.b[0] - a.a[0]) + y * (b.b[1] - a.a[1]) + z * (b.b[2] - a.a[2]);
    const b2 = x * (b.c[0] - a.a[0]) + y * (b.c[1] - a.a[1]) + z * (b.c[2] - a.a[2]);
    const tolerance = epsilon * Math.hypot(x, y, z), speed = x * direction[0] + y * direction[1] + z * direction[2];
    const low = Math.min(b0, b1, b2) - tolerance - Math.max(0, a1, a2);
    const high = Math.max(b0, b1, b2) + tolerance - Math.min(0, a1, a2);
    if (speed === 0)
        return low <= 0 && high >= 0;
    const entry = low / speed, exit = high / speed;
    interval[0] = Math.max(interval[0], Math.min(entry, exit));
    interval[1] = Math.min(interval[1], Math.max(entry, exit));
    return interval[0] <= interval[1];
}
/** Complete triangle SAT axes stay fixed during rigid translation. */
function sweptTrianglesEntry(a, b, direction, limit, epsilon, interval) {
    interval[0] = 0;
    interval[1] = limit;
    const an = a.normal, bn = b.normal;
    if (!overlapTimeOnAxis(a, b, direction, an[0], an[1], an[2], epsilon, interval)
        || !overlapTimeOnAxis(a, b, direction, bn[0], bn[1], bn[2], epsilon, interval))
        return Infinity;
    for (let i = 0; i < 3; i++) {
        const ax = i === 0 ? a.ab[0] : i === 1 ? a.ac[0] - a.ab[0] : -a.ac[0];
        const ay = i === 0 ? a.ab[1] : i === 1 ? a.ac[1] - a.ab[1] : -a.ac[1];
        const az = i === 0 ? a.ab[2] : i === 1 ? a.ac[2] - a.ab[2] : -a.ac[2];
        if (!overlapTimeOnAxis(a, b, direction, an[1] * az - an[2] * ay, an[2] * ax - an[0] * az, an[0] * ay - an[1] * ax, epsilon, interval))
            return Infinity;
        const bx = i === 0 ? b.ab[0] : i === 1 ? b.ac[0] - b.ab[0] : -b.ac[0];
        const by = i === 0 ? b.ab[1] : i === 1 ? b.ac[1] - b.ab[1] : -b.ac[1];
        const bz = i === 0 ? b.ab[2] : i === 1 ? b.ac[2] - b.ab[2] : -b.ac[2];
        if (!overlapTimeOnAxis(a, b, direction, bn[1] * bz - bn[2] * by, bn[2] * bx - bn[0] * bz, bn[0] * by - bn[1] * bx, epsilon, interval))
            return Infinity;
        for (let j = 0; j < 3; j++) {
            const x = j === 0 ? b.ab[0] : j === 1 ? b.ac[0] - b.ab[0] : -b.ac[0];
            const y = j === 0 ? b.ab[1] : j === 1 ? b.ac[1] - b.ab[1] : -b.ac[1];
            const z = j === 0 ? b.ab[2] : j === 1 ? b.ac[2] - b.ab[2] : -b.ac[2];
            if (!overlapTimeOnAxis(a, b, direction, ay * z - az * y, az * x - ax * z, ax * y - ay * x, epsilon, interval))
                return Infinity;
        }
    }
    return interval[0];
}
/** Swept AABB/slab entry, including intermediate positions and negative speeds. */
function sweptBoundsEntry(moving, fixed, direction, limit, epsilon) {
    let low = 0, high = limit;
    for (let axis = 0; axis < 3; axis++) {
        const minA = axis === 0 ? moving.minX : axis === 1 ? moving.minY : moving.minZ;
        const maxA = axis === 0 ? moving.maxX : axis === 1 ? moving.maxY : moving.maxZ;
        const minB = axis === 0 ? fixed.minX : axis === 1 ? fixed.minY : fixed.minZ;
        const maxB = axis === 0 ? fixed.maxX : axis === 1 ? fixed.maxY : fixed.maxZ;
        const speed = direction[axis], entry = minB - epsilon - maxA, exit = maxB + epsilon - minA;
        if (speed === 0) {
            if (entry > 0 || exit < 0)
                return Infinity;
        }
        else {
            const a = entry / speed, b = exit / speed;
            low = Math.max(low, Math.min(a, b));
            high = Math.min(high, Math.max(a, b));
            if (low > high)
                return Infinity;
        }
    }
    return low;
}
/** Segment/slab entry time; Infinity means no overlap. Includes face boundaries. */
function boundsEntry(bounds, p, d, limit, epsilon) {
    let low = 0, high = limit;
    for (let axis = 0; axis < 3; axis++) {
        const min = (axis === 0 ? bounds.minX : axis === 1 ? bounds.minY : bounds.minZ) - epsilon;
        const max = (axis === 0 ? bounds.maxX : axis === 1 ? bounds.maxY : bounds.maxZ) + epsilon;
        const origin = p[axis], direction = d[axis];
        if (direction === 0) {
            if (origin < min || origin > max)
                return Infinity;
        }
        else {
            const a = (min - origin) / direction, b = (max - origin) / direction;
            low = Math.max(low, Math.min(a, b));
            high = Math.min(high, Math.max(a, b));
            if (low > high)
                return Infinity;
        }
    }
    return low;
}
/** Closest point on a nondegenerate triangle, including its edges and corners. */
function nearestOnTriangle(p, triangle, out) {
    const { a, b, c, ab, ac } = triangle;
    const apx = p[0] - a[0], apy = p[1] - a[1], apz = p[2] - a[2];
    const d1 = ab[0] * apx + ab[1] * apy + ab[2] * apz, d2 = ac[0] * apx + ac[1] * apy + ac[2] * apz;
    let u = 0, v = 0;
    if (!(d1 <= 0 && d2 <= 0)) {
        const bpx = p[0] - b[0], bpy = p[1] - b[1], bpz = p[2] - b[2];
        const d3 = ab[0] * bpx + ab[1] * bpy + ab[2] * bpz, d4 = ac[0] * bpx + ac[1] * bpy + ac[2] * bpz;
        if (d3 >= 0 && d4 <= d3)
            u = 1;
        else {
            const vc = d1 * d4 - d3 * d2;
            if (vc <= 0 && d1 >= 0 && d3 <= 0)
                u = d1 / (d1 - d3);
            else {
                const cpx = p[0] - c[0], cpy = p[1] - c[1], cpz = p[2] - c[2];
                const d5 = ab[0] * cpx + ab[1] * cpy + ab[2] * cpz, d6 = ac[0] * cpx + ac[1] * cpy + ac[2] * cpz;
                if (d6 >= 0 && d5 <= d6)
                    v = 1;
                else {
                    const vb = d5 * d2 - d1 * d6;
                    if (vb <= 0 && d2 >= 0 && d6 <= 0)
                        v = d2 / (d2 - d6);
                    else {
                        const va = d3 * d6 - d5 * d4;
                        if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
                            v = (d4 - d3) / (d4 - d3 + d5 - d6);
                            u = 1 - v;
                        }
                        else {
                            const inverse = 1 / (va + vb + vc);
                            u = vb * inverse;
                            v = vc * inverse;
                        }
                    }
                }
            }
        }
    }
    out[0] = a[0] + u * ab[0] + v * ac[0];
    out[1] = a[1] + u * ab[1] + v * ac[1];
    out[2] = a[2] + u * ab[2] + v * ac[2];
}
/**
 * Immutable snapshot of body triangles, accelerated with a spatial BVH whose
 * median fallback bounds split imbalance for degenerate point distributions.
 * Reuse this object for all cloth queries while body positions stay unchanged;
 * rebuild after changing body geometry/transforms. Input arrays are never changed.
 * Degenerate triangles are omitted. Outward winding is required to distinguish
 * leaving versus entering a face when a trajectory begins within epsilon of it.
 */
export class BodyTriangleBVH {
    triangles = [];
    nodes = [];
    stack = [];
    triangleCount;
    constructor(points, indices, options = {}) {
        const stride = options.stride ?? 3, count = positionCount(points, stride);
        if (indices.length % 3)
            throw new RangeError('Body indices must contain complete triangles.');
        // Share immutable vertex snapshots between triangles instead of allocating
        // three position arrays for every face of the same indexed mesh.
        const vertices = new Array(count);
        for (let i = 0; i < count; i++) {
            const p = [0, 0, 0];
            position(points, i, stride, p);
            if (!validPoint(p))
                throw new RangeError('Body positions must be finite.');
            vertices[i] = p;
        }
        for (let i = 0; i < indices.length; i += 3) {
            const ia = indices[i], ib = indices[i + 1], ic = indices[i + 2];
            if (!validIndex(ia, count) || !validIndex(ib, count) || !validIndex(ic, count))
                throw new RangeError('Body index is outside its position buffer.');
            const a = vertices[ia], b = vertices[ib], c = vertices[ic];
            const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
            const normal = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
            const length = Math.hypot(...normal);
            if (length <= Number.EPSILON * Math.hypot(...ab) * Math.hypot(...ac))
                continue;
            normal[0] /= length;
            normal[1] /= length;
            normal[2] /= length;
            this.triangles.push({ a, b, c, ab, ac, normal, area: length * .5, index: i / 3,
                minX: Math.min(a[0], b[0], c[0]), minY: Math.min(a[1], b[1], c[1]), minZ: Math.min(a[2], b[2], c[2]),
                maxX: Math.max(a[0], b[0], c[0]), maxY: Math.max(a[1], b[1], c[1]), maxZ: Math.max(a[2], b[2], c[2]) });
        }
        this.triangleCount = this.triangles.length;
        if (this.triangleCount)
            this.build(0, this.triangleCount);
    }
    build(begin, end) {
        const node = { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity, begin, end, left: -1, right: -1 }, id = this.nodes.length;
        this.nodes.push(node);
        for (let i = begin; i < end; i++)
            include(node, this.triangles[i]);
        if (end - begin <= 8)
            return id;
        const width = node.maxX - node.minX, height = node.maxY - node.minY, depth = node.maxZ - node.minZ;
        const axis = width >= height && width >= depth ? 0 : height >= depth ? 1 : 2;
        const split = axis === 0 ? node.minX + node.maxX : axis === 1 ? node.minY + node.maxY : node.minZ + node.maxZ;
        let middle = partitionSpatial(this.triangles, begin, end, axis, split);
        // Spatial midpoint needs only one pass. Bound imbalance to avoid pathological
        // depth for coincident centers or heavily skewed/disconnected surfaces.
        if (Math.min(middle - begin, end - middle) < (end - begin) / 8) {
            middle = (begin + end) >>> 1;
            partitionMedian(this.triangles, begin, end, middle, axis);
        }
        node.left = this.build(begin, middle);
        node.right = this.build(middle, end);
        return id;
    }
    /**
     * Static surface intersection, including coplanar overlap and face/edge/vertex
     * touching within epsilon. Tests complete triangles, not sampled trajectories.
     * Degenerate triangles are ignored. This does not detect complete containment
     * without a surface intersection, self-intersections, or collision during motion.
     * Returns on the first intersecting triangle pair; does not modify either mesh.
     */
    intersectsMesh(points, indices, options = {}) {
        const stride = options.stride ?? 3, epsilon = options.epsilon ?? 1e-8, count = positionCount(points, stride);
        if (!Number.isFinite(epsilon) || epsilon < 0)
            throw new RangeError('Intersection epsilon must be finite and nonnegative.');
        if (indices.length % 3)
            throw new RangeError('Cloth indices must contain complete triangles.');
        if (!this.nodes.length)
            return false;
        const a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0], ab = [0, 0, 0], ac = [0, 0, 0], normal = [0, 0, 0];
        const query = { a, b, c, ab, ac, normal, area: 0, index: 0, minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 };
        const stack = this.stack;
        for (let i = 0; i < indices.length; i += 3) {
            const ia = indices[i], ib = indices[i + 1], ic = indices[i + 2];
            if (!validIndex(ia, count) || !validIndex(ib, count) || !validIndex(ic, count))
                throw new RangeError('Cloth index is outside its position buffer.');
            position(points, ia, stride, a);
            position(points, ib, stride, b);
            position(points, ic, stride, c);
            if (!validPoint(a) || !validPoint(b) || !validPoint(c))
                throw new RangeError('Cloth positions must be finite.');
            query.minX = Math.min(a[0], b[0], c[0]);
            query.minY = Math.min(a[1], b[1], c[1]);
            query.minZ = Math.min(a[2], b[2], c[2]);
            query.maxX = Math.max(a[0], b[0], c[0]);
            query.maxY = Math.max(a[1], b[1], c[1]);
            query.maxZ = Math.max(a[2], b[2], c[2]);
            if (!boundsOverlap(query, this.nodes[0], epsilon))
                continue;
            for (let axis = 0; axis < 3; axis++) {
                ab[axis] = b[axis] - a[axis];
                ac[axis] = c[axis] - a[axis];
            }
            normal[0] = ab[1] * ac[2] - ab[2] * ac[1];
            normal[1] = ab[2] * ac[0] - ab[0] * ac[2];
            normal[2] = ab[0] * ac[1] - ab[1] * ac[0];
            const length = Math.hypot(...normal);
            if (length <= Number.EPSILON * Math.hypot(...ab) * Math.hypot(...ac))
                continue;
            normal[0] /= length;
            normal[1] /= length;
            normal[2] /= length;
            stack.length = 0;
            stack.push(0);
            while (stack.length) {
                const node = this.nodes[stack.pop()];
                if (!boundsOverlap(query, node, epsilon))
                    continue;
                if (node.left >= 0)
                    stack.push(node.left, node.right);
                else
                    for (let j = node.begin; j < node.end; j++) {
                        const triangle = this.triangles[j];
                        if (boundsOverlap(query, triangle, epsilon) && trianglesOverlap(query, triangle, epsilon))
                            return true;
                    }
            }
        }
        return false;
    }
    /**
     * Earliest surface contact over a rigid translation along direction, normalized
     * internally. maxDistance and the result are physical model-space distances.
     * Solves continuous SAT intervals for complete triangle pairs, including
     * coplanar sliding and zero axis velocities; no discrete motion samples.
     * Initial intersection/touching returns 0. A zero direction tests only the
     * initial mesh. Epsilon expands projection intervals in physical units.
     *
     * Valid only for one constant translation: no rotation, scaling, deformation,
     * or moving body. Degenerate faces and containment without surface contact
     * are excluded, as in intersectsMesh. Does not modify either input mesh.
     */
    firstMeshHit(points, indices, direction, maxDistance, options = {}) {
        const stride = options.stride ?? 3, epsilon = options.epsilon ?? 1e-8, count = positionCount(points, stride);
        if (!validPoint(direction) || !Number.isFinite(maxDistance) || maxDistance < 0 || !Number.isFinite(epsilon) || epsilon < 0)
            throw new RangeError('Translation, distance, and nonnegative epsilon must be finite.');
        if (indices.length % 3)
            throw new RangeError('Cloth indices must contain complete triangles.');
        if (!this.nodes.length)
            return undefined;
        const magnitude = Math.hypot(...direction);
        if (!Number.isFinite(magnitude))
            throw new RangeError('Translation direction magnitude must be finite.');
        if (magnitude === 0 || maxDistance === 0)
            return this.intersectsMesh(points, indices, options) ? 0 : undefined;
        const velocity = [direction[0] / magnitude, direction[1] / magnitude, direction[2] / magnitude];
        const a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0], ab = [0, 0, 0], ac = [0, 0, 0], normal = [0, 0, 0];
        const query = { a, b, c, ab, ac, normal, area: 0, index: 0, minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 };
        const stack = this.stack, interval = [0, maxDistance];
        let limit = maxDistance, result;
        for (let i = 0; i < indices.length; i += 3) {
            const ia = indices[i], ib = indices[i + 1], ic = indices[i + 2];
            if (!validIndex(ia, count) || !validIndex(ib, count) || !validIndex(ic, count))
                throw new RangeError('Cloth index is outside its position buffer.');
            position(points, ia, stride, a);
            position(points, ib, stride, b);
            position(points, ic, stride, c);
            if (!validPoint(a) || !validPoint(b) || !validPoint(c))
                throw new RangeError('Cloth positions must be finite.');
            query.minX = Math.min(a[0], b[0], c[0]);
            query.minY = Math.min(a[1], b[1], c[1]);
            query.minZ = Math.min(a[2], b[2], c[2]);
            query.maxX = Math.max(a[0], b[0], c[0]);
            query.maxY = Math.max(a[1], b[1], c[1]);
            query.maxZ = Math.max(a[2], b[2], c[2]);
            if (sweptBoundsEntry(query, this.nodes[0], velocity, limit, epsilon) === Infinity)
                continue;
            for (let axis = 0; axis < 3; axis++) {
                ab[axis] = b[axis] - a[axis];
                ac[axis] = c[axis] - a[axis];
            }
            normal[0] = ab[1] * ac[2] - ab[2] * ac[1];
            normal[1] = ab[2] * ac[0] - ab[0] * ac[2];
            normal[2] = ab[0] * ac[1] - ab[1] * ac[0];
            const length = Math.hypot(...normal);
            if (length <= Number.EPSILON * Math.hypot(...ab) * Math.hypot(...ac))
                continue;
            normal[0] /= length;
            normal[1] /= length;
            normal[2] /= length;
            stack.length = 0;
            stack.push(0);
            while (stack.length) {
                const node = this.nodes[stack.pop()];
                if (sweptBoundsEntry(query, node, velocity, limit, epsilon) === Infinity)
                    continue;
                if (node.left >= 0) {
                    const left = sweptBoundsEntry(query, this.nodes[node.left], velocity, limit, epsilon), right = sweptBoundsEntry(query, this.nodes[node.right], velocity, limit, epsilon);
                    if (left < right) {
                        if (right !== Infinity)
                            stack.push(node.right);
                        if (left !== Infinity)
                            stack.push(node.left);
                    }
                    else {
                        if (left !== Infinity)
                            stack.push(node.left);
                        if (right !== Infinity)
                            stack.push(node.right);
                    }
                }
                else
                    for (let j = node.begin; j < node.end; j++) {
                        const triangle = this.triangles[j];
                        if (sweptBoundsEntry(query, triangle, velocity, limit, epsilon) === Infinity)
                            continue;
                        const hit = sweptTrianglesEntry(query, triangle, velocity, limit, epsilon, interval);
                        if (hit === Infinity)
                            continue;
                        if (hit === 0)
                            return 0;
                        result = limit = hit;
                    }
            }
        }
        return result;
    }
    /** minZ excludes whole triangles below that height; it does not clip triangles. */
    closestPoint(p, options = {}) {
        if (!validPoint(p))
            throw new RangeError('Query point must be finite.');
        if (!this.nodes.length)
            return undefined;
        const minZ = options.minZ ?? -Infinity, stack = this.stack, candidate = [0, 0, 0];
        let best = Infinity, bestIndex = Infinity, result;
        stack.length = 0;
        stack.push(0);
        while (stack.length) {
            const node = this.nodes[stack.pop()];
            if (node.maxZ < minZ || boundsDistance(node, p) > best)
                continue;
            if (node.left >= 0) {
                const left = boundsDistance(this.nodes[node.left], p), right = boundsDistance(this.nodes[node.right], p);
                if (left < right)
                    stack.push(node.right, node.left);
                else
                    stack.push(node.left, node.right);
            }
            else
                for (let i = node.begin; i < node.end; i++) {
                    const triangle = this.triangles[i];
                    if (triangle.maxZ < minZ || boundsDistance(triangle, p) > best)
                        continue;
                    nearestOnTriangle(p, triangle, candidate);
                    const distance = (candidate[0] - p[0]) ** 2 + (candidate[1] - p[1]) ** 2 + (candidate[2] - p[2]) ** 2;
                    if (distance < best || (distance === best && triangle.index < bestIndex)) {
                        best = distance;
                        bestIndex = triangle.index;
                        if (!result)
                            result = [0, 0, 0];
                        result[0] = candidate[0];
                        result[1] = candidate[1];
                        result[2] = candidate[2];
                    }
                }
        }
        return result;
    }
    /**
     * Area-weighted drape guidance from triangles within blendRadius (default
     * .003) of the closest distance. Cubic weights vanish smoothly at the band
     * edge. Area weighting reduces, but cannot eliminate, tessellation bias.
     * The average can lie between disconnected surfaces; NEVER use it as an
     * actual surface point, penetration correction, or clearance certificate.
     *
     * With minZ, eligible triangles fade through a smooth distance penalty over
     * the band [minZ - blendRadius, minZ] instead of switching off at minZ.
     * Continuity is conditional on retaining at least one eligible triangle and
     * continuous geometry; this does not smooth discrete topology changes.
     * A zero radius delegates to the unchanged exact closestPoint query.
     */
    blendedClosestPoint(p, options = {}) {
        const radius = options.blendRadius ?? .003, minZ = options.minZ ?? -Infinity;
        if (!validPoint(p) || !Number.isFinite(radius) || radius < 0 || Number.isNaN(minZ))
            throw new RangeError('Support point and nonnegative blend radius must be finite.');
        if (radius === 0)
            return this.closestPoint(p, { minZ });
        if (!this.nodes.length)
            return undefined;
        const stack = this.stack, candidate = [0, 0, 0];
        const lowerBound = (bounds) => Math.sqrt(boundsDistance(bounds, p)) + supportHeightPenalty(bounds.maxZ, minZ, radius);
        let best = Infinity, bestIndex = Infinity, nearest;
        stack.length = 0;
        stack.push(0);
        // Find the minimum distance (plus optional continuous height penalty).
        while (stack.length) {
            const node = this.nodes[stack.pop()], lower = lowerBound(node);
            if (!Number.isFinite(lower) || lower > best)
                continue;
            if (node.left >= 0) {
                const left = lowerBound(this.nodes[node.left]), right = lowerBound(this.nodes[node.right]);
                if (left < right)
                    stack.push(node.right, node.left);
                else
                    stack.push(node.left, node.right);
            }
            else
                for (let i = node.begin; i < node.end; i++) {
                    const triangle = this.triangles[i], lower = lowerBound(triangle);
                    if (!Number.isFinite(lower) || lower > best)
                        continue;
                    nearestOnTriangle(p, triangle, candidate);
                    const distance = Math.hypot(candidate[0] - p[0], candidate[1] - p[1], candidate[2] - p[2]) + supportHeightPenalty(triangle.maxZ, minZ, radius);
                    if (distance < best || (distance === best && triangle.index < bestIndex)) {
                        best = distance;
                        bestIndex = triangle.index;
                        if (!nearest)
                            nearest = [0, 0, 0];
                        nearest[0] = candidate[0];
                        nearest[1] = candidate[1];
                        nearest[2] = candidate[2];
                    }
                }
        }
        if (!nearest)
            return undefined;
        const limit = best + radius;
        let total = 0, x = 0, y = 0, z = 0;
        stack.length = 0;
        stack.push(0);
        while (stack.length) {
            const node = this.nodes[stack.pop()];
            if (lowerBound(node) >= limit)
                continue;
            if (node.left >= 0)
                stack.push(node.left, node.right);
            else
                for (let i = node.begin; i < node.end; i++) {
                    const triangle = this.triangles[i];
                    if (lowerBound(triangle) >= limit)
                        continue;
                    nearestOnTriangle(p, triangle, candidate);
                    const distance = Math.hypot(candidate[0] - p[0], candidate[1] - p[1], candidate[2] - p[2]) + supportHeightPenalty(triangle.maxZ, minZ, radius);
                    const fraction = Math.max(0, (distance - best) / radius);
                    if (fraction >= 1)
                        continue;
                    const weight = triangle.area * (1 - fraction * fraction * (3 - 2 * fraction));
                    total += weight;
                    x += weight * candidate[0];
                    y += weight * candidate[1];
                    z += weight * candidate[2];
                }
        }
        return total > 0 ? [x / total, y / total, z / total] : nearest;
    }
    /** Two-sided crossing test; initially touching outward/tangent paths are allowed. */
    firstHit(start, end, epsilon = 1e-7) {
        if (!validPoint(start) || !validPoint(end) || !Number.isFinite(epsilon) || epsilon < 0)
            throw new RangeError('Segment and nonnegative epsilon must be finite.');
        const d = [end[0] - start[0], end[1] - start[1], end[2] - start[2]], length = Math.hypot(...d);
        if (!this.nodes.length || length === 0)
            return undefined;
        const stack = this.stack;
        stack.length = 0;
        stack.push(0);
        let result, limit = 1;
        while (stack.length) {
            const node = this.nodes[stack.pop()];
            if (boundsEntry(node, start, d, limit, epsilon) === Infinity)
                continue;
            if (node.left >= 0) {
                const left = boundsEntry(this.nodes[node.left], start, d, limit, epsilon), right = boundsEntry(this.nodes[node.right], start, d, limit, epsilon);
                if (left < right) {
                    if (right !== Infinity)
                        stack.push(node.right);
                    if (left !== Infinity)
                        stack.push(node.left);
                }
                else {
                    if (left !== Infinity)
                        stack.push(node.left);
                    if (right !== Infinity)
                        stack.push(node.right);
                }
            }
            else
                for (let i = node.begin; i < node.end; i++) {
                    const t = this.triangles[i], n = t.normal, normalDelta = n[0] * d[0] + n[1] * d[1] + n[2] * d[2];
                    if (Math.abs(normalDelta) <= length * 1e-14)
                        continue;
                    const sx = start[0] - t.a[0], sy = start[1] - t.a[1], sz = start[2] - t.a[2];
                    const distance = n[0] * sx + n[1] * sy + n[2] * sz;
                    // At contact, ignore outward motion (and tiny tangent jitter), but stop
                    // inward motion at zero rather than discarding all near-zero hits.
                    if (Math.abs(distance) <= epsilon && normalDelta >= -epsilon)
                        continue;
                    let fraction = -distance / normalDelta;
                    if (Math.abs(distance) <= epsilon && normalDelta < -epsilon)
                        fraction = 0;
                    if (fraction < 0 || fraction > limit)
                        continue;
                    // Moller-Trumbore barycentrics, retaining edge/vertex hits.
                    const hx = d[1] * t.ac[2] - d[2] * t.ac[1], hy = d[2] * t.ac[0] - d[0] * t.ac[2], hz = d[0] * t.ac[1] - d[1] * t.ac[0];
                    const determinant = t.ab[0] * hx + t.ab[1] * hy + t.ab[2] * hz;
                    const u = (sx * hx + sy * hy + sz * hz) / determinant;
                    const qx = sy * t.ab[2] - sz * t.ab[1], qy = sz * t.ab[0] - sx * t.ab[2], qz = sx * t.ab[1] - sy * t.ab[0];
                    const v = (d[0] * qx + d[1] * qy + d[2] * qz) / determinant;
                    if (u < -1e-10 || v < -1e-10 || u + v > 1 + 1e-10)
                        continue;
                    if (!result || fraction < limit || (fraction === limit && t.index < result.triangleIndex)) {
                        limit = fraction;
                        result = { fraction, normalSpeed: Math.abs(normalDelta), triangleIndex: t.index };
                    }
                }
        }
        return result;
    }
}
const topologyCache = new WeakMap();
function topology(indices, count) {
    const cached = topologyCache.get(indices);
    if (cached && cached.count === count && cached.triangles.length === indices.length)
        return cached;
    if (indices.length % 3)
        throw new RangeError('Cloth indices must contain complete triangles.');
    const edges = [], seen = new Set(), triangles = new Uint32Array(indices.length);
    for (let i = 0; i < indices.length; i++) {
        const index = indices[i];
        if (!validIndex(index, count))
            throw new RangeError('Cloth index is outside its position buffer.');
        triangles[i] = index;
    }
    for (let i = 0; i < triangles.length; i += 3)
        for (let side = 0; side < 3; side++) {
            const a = triangles[i + side], b = triangles[i + (side + 1) % 3], low = Math.min(a, b), high = Math.max(a, b), key = low * count + high;
            if (low !== high && !seen.has(key)) {
                seen.add(key);
                edges.push(low, high);
            }
        }
    const result = { count, edges: new Uint32Array(edges), triangles };
    topologyCache.set(indices, result);
    return result;
}
/**
 * Return one scalar for start + scalar * (end - start), preserving the shared
 * deformation field. Tests every vertex, unique edge midpoint, and triangle
 * centroid trajectory against the fixed body. No random samples or per-vertex
 * corrections. Pass immutable indices to reuse the cached sampling topology.
 *
 * This is a sampled displacement limiter, NOT continuous triangle/triangle
 * collision detection: unsampled face/edge crossings, existing intersections,
 * self-intersections, and coplanar sliding are not resolved. Start must already
 * be a valid, clear garment. It guarantees no sampled transverse crossing up to
 * the returned fraction within numerical tolerances, not a global separation
 * distance. Clearance backs away along each trajectory, capped at 2% of its
 * displacement so a near-tangent hit cannot impose unbounded normal-distance
 * backoff on the whole garment. This does not guarantee a normal clearance gap
 * or temporal continuity when which trajectory hits changes, and cannot create
 * clearance where the starting garment has none.
 */
export function clothDisplacementFactor(body, start, end, indices, options = {}) {
    const stride = options.stride ?? 3, clearance = options.clearance ?? 1e-4, epsilon = options.epsilon ?? 1e-7;
    if (!Number.isFinite(clearance) || clearance < 0 || !Number.isFinite(epsilon) || epsilon < 0)
        throw new RangeError('Cloth clearance and epsilon must be finite and nonnegative.');
    const count = positionCount(start, stride);
    if (positionCount(end, stride) !== count)
        throw new RangeError('Start and end must have the same number of positions.');
    const samples = topology(indices, count), from = [0, 0, 0], to = [0, 0, 0];
    const a = [0, 0, 0], b = [0, 0, 0];
    let factor = 1;
    const check = () => {
        const hit = body.firstHit(from, to, epsilon);
        if (hit) {
            const length = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
            const backoff = Math.min(.02, clearance / length);
            factor = Math.min(factor, Math.max(0, hit.fraction - backoff));
        }
    };
    for (let i = 0; i < count; i++) {
        position(start, i, stride, from);
        position(end, i, stride, to);
        check();
        if (factor === 0)
            return 0;
    }
    const checkBarycenter = (ids, width) => {
        for (let i = 0; i < ids.length && factor > 0; i += width) {
            from[0] = from[1] = from[2] = to[0] = to[1] = to[2] = 0;
            for (let j = 0; j < width; j++) {
                position(start, ids[i + j], stride, a);
                position(end, ids[i + j], stride, b);
                for (let axis = 0; axis < 3; axis++) {
                    from[axis] += a[axis] / width;
                    to[axis] += b[axis] / width;
                }
            }
            check();
        }
    };
    checkBarycenter(samples.edges, 2);
    checkBarycenter(samples.triangles, 3);
    return factor;
}
