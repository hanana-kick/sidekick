import { multiply } from '../core/math.js';
const clamp = (x, low, high) => Math.min(high, Math.max(low, x));
const mix = (a, b, t) => a + (b - a) * t;
/** Port of the analytic glyph SDF; does not approximate expressions with paths. */
export function softwareEyeDistance(x, y, openness, smile, size, targets) {
    const open = clamp(openness, 0, 1), happy = clamp(smile, 0, 1), unit = Math.min(size[0], size[1]);
    const smileHeight = unit * targets[2];
    const height = mix(unit * targets[3], mix(size[1], smileHeight, happy), open);
    const width = mix(size[0], 2 * size[0] * targets[0] + smileHeight, happy * open);
    const radius = Math.min(width, height) * .5, halfSpan = Math.max(width - height, 0) * .5;
    if (halfSpan <= 0) {
        const qx = Math.abs(x) - width * .5 + radius, qy = Math.abs(y) - height * .5 + radius;
        return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
    }
    x = Math.abs(x);
    const bend = happy * open, offset = halfSpan * (1 - bend * bend) * .5, scaledY = bend * y + offset;
    if (scaledY * halfSpan < x * offset)
        return Math.hypot(x - halfSpan, y) - radius;
    const scaledRadius = halfSpan * (1 + bend * bend) * .5;
    return Math.abs((bend * (x * x + y * y - halfSpan * halfSpan) + 2 * y * offset) / (Math.hypot(bend * x, scaledY) + scaledRadius)) - radius;
}
const edge = (ax, ay, bx, by, x, y) => (bx - ax) * (y - ay) - (by - ay) * (x - ax);
const topLeft = (ax, ay, bx, by) => by > ay || (by === ay && bx < ax);
/** Orthographic, depth-tested CPU triangle backend. Canvas2D only presents its pixels.
 * Geometry, face chart, culling, depth writes and premultiplied blending agree with
 * the GPU backend. GPU multisample coverage and derivative quads are not emulated.
 */
export class SoftwareRasterizer {
    width = 0;
    height = 0;
    pixels = new Uint8ClampedArray(0);
    depth = new Float64Array(0);
    rgba = new Float32Array(0);
    projected = new Float64Array(0);
    clear(width, height) {
        if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1)
            throw new RangeError('Raster dimensions must be positive integers.');
        if (width !== this.width || height !== this.height) {
            this.width = width;
            this.height = height;
            this.pixels = new Uint8ClampedArray(width * height * 4);
            this.rgba = new Float32Array(width * height * 4);
            this.depth = new Float64Array(width * height);
        }
        else {
            this.pixels.fill(0);
            this.rgba.fill(0);
        }
        this.depth.fill(1);
    }
    draw(geometry, model, projection, hex, count = geometry.indices.length, indexOffset = 0, opacity = 1, eyes) {
        if (!this.width || !this.height || opacity <= 0)
            return;
        const vertices = geometry.vertices, indices = geometry.indices, matrix = multiply(projection, model);
        const vertexCount = vertices.length / 6;
        if (this.projected.length < vertexCount * 3)
            this.projected = new Float64Array(vertexCount * 3);
        const points = this.projected;
        for (let v = 0; v < vertexCount; v++) {
            const i = v * 6, o = v * 3, x = vertices[i], y = vertices[i + 1], z = vertices[i + 2];
            const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
            points[o] = ((matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) / w + 1) * this.width * .5;
            points[o + 1] = (1 - (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / w) * this.height * .5;
            points[o + 2] = ((matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) / w + 1) * .5;
        }
        const value = parseInt(hex.slice(1), 16), red = ((value >> 16) & 255) / 255, green = ((value >> 8) & 255) / 255, blue = (value & 255) / 255;
        const alpha = eyes ? 1 : clamp(opacity, 0, 1);
        const maxAA = eyes ? Math.min(eyes.size[0], eyes.size[1]) * .2 : 0;
        // Reject far-away body pixels before evaluating six analytic distances. The
        // bound covers the neutral capsule and every intermediate circular arc.
        const eyeBounds = eyes ? [0, 1].map(eye => {
            const targets = eye ? eyes.rightTargets : eyes.leftTargets;
            const open = clamp(eyes.states[eye * 2], 0, 1), happy = clamp(eyes.states[eye * 2 + 1], 0, 1);
            const unit = Math.min(eyes.size[0], eyes.size[1]), smileHeight = unit * targets[2];
            const height = mix(unit * targets[3], mix(eyes.size[1], smileHeight, happy), open);
            const width = mix(eyes.size[0], 2 * eyes.size[0] * targets[0] + smileHeight, happy * open);
            return [width * .5 + maxAA, Math.max(height * .5, width * .5) + maxAA];
        }) : [];
        const end = Math.min(indices.length, indexOffset + count);
        for (let i = indexOffset; i + 2 < end; i += 3) {
            const ia = indices[i], ib = indices[i + 1], ic = indices[i + 2];
            const a = ia * 3, b = ib * 3, c = ic * 3;
            const ax = points[a], ay = points[a + 1], bx = points[b], by = points[b + 1], cx = points[c], cy = points[c + 1];
            const area = edge(ax, ay, bx, by, cx, cy);
            // WebGL CCW front faces become clockwise after the top-down Y conversion.
            if (!(area < -1e-12))
                continue;
            const minX = Math.max(0, Math.ceil(Math.min(ax, bx, cx) - .5)), maxX = Math.min(this.width - 1, Math.floor(Math.max(ax, bx, cx) - .5));
            const minY = Math.max(0, Math.ceil(Math.min(ay, by, cy) - .5)), maxY = Math.min(this.height - 1, Math.floor(Math.max(ay, by, cy) - .5));
            if (minX > maxX || minY > maxY)
                continue;
            const ab = topLeft(ax, ay, bx, by), bc = topLeft(bx, by, cx, cy), ca = topLeft(cx, cy, ax, ay);
            const za = points[a + 2], zb = points[b + 2], zc = points[c + 2];
            const va = ia * 6, vb = ib * 6, vc = ic * 6;
            const sx = eyes?.faceScale[0] ?? 1, sy = eyes?.faceScale[1] ?? 1;
            const xa = vertices[va] * sx, xb = vertices[vb] * sx, xc = vertices[vc] * sx;
            const ya = vertices[va + 1] * sy, yb = vertices[vb + 1] * sy, yc = vertices[vc + 1] * sy;
            const dxX = ((by - cy) * xa + (cy - ay) * xb + (ay - by) * xc) / area;
            const dxY = ((by - cy) * ya + (cy - ay) * yb + (ay - by) * yc) / area;
            const dyX = ((cx - bx) * xa + (ax - cx) * xb + (bx - ax) * xc) / area;
            const dyY = ((cx - bx) * ya + (ax - cx) * yb + (bx - ax) * yc) / area;
            for (let y = minY; y <= maxY; y++)
                for (let x = minX; x <= maxX; x++) {
                    const e0 = edge(bx, by, cx, cy, x + .5, y + .5), e1 = edge(cx, cy, ax, ay, x + .5, y + .5), e2 = edge(ax, ay, bx, by, x + .5, y + .5);
                    if (e0 > 0 || (e0 === 0 && !bc) || e1 > 0 || (e1 === 0 && !ca) || e2 > 0 || (e2 === 0 && !ab))
                        continue;
                    const wa = e0 / area, wb = e1 / area, wc = e2 / area, z = wa * za + wb * zb + wc * zc, pixel = y * this.width + x;
                    if (z < 0 || z > 1 || z >= this.depth[pixel])
                        continue;
                    this.depth[pixel] = z;
                    let r = red, g = green, bl = blue;
                    if (eyes && wa * vertices[va + 5] + wb * vertices[vb + 5] + wc * vertices[vc + 5] >= .00001) {
                        const fx = wa * xa + wb * xb + wc * xc, fy = wa * ya + wb * yb + wc * yc;
                        let mask = 0;
                        for (let eye = 0; eye < 2; eye++) {
                            const ex = fx - eyes.centers[eye * 2], ey = fy - eyes.centers[eye * 2 + 1];
                            if (Math.abs(ex) > eyeBounds[eye][0] || Math.abs(ey) > eyeBounds[eye][1])
                                continue;
                            const targets = eye ? eyes.rightTargets : eyes.leftTargets, open = eyes.states[eye * 2], smile = eyes.states[eye * 2 + 1];
                            const d = softwareEyeDistance(ex, ey, open, smile, eyes.size, targets);
                            const aa = clamp(Math.abs(softwareEyeDistance(ex + dxX, ey + dxY, open, smile, eyes.size, targets) - d) + Math.abs(softwareEyeDistance(ex + dyX, ey + dyY, open, smile, eyes.size, targets) - d), .0001, maxAA);
                            const t = clamp((d + aa) / (2 * aa), 0, 1);
                            mask = Math.max(mask, 1 - t * t * (3 - 2 * t));
                        }
                        r = mix(red, eyes.color[0], mask);
                        g = mix(green, eyes.color[1], mask);
                        bl = mix(blue, eyes.color[2], mask);
                    }
                    const p = pixel * 4, remain = 1 - alpha;
                    const outAlpha = alpha + this.rgba[p + 3] * remain;
                    this.rgba[p] = r * alpha + this.rgba[p] * remain;
                    this.rgba[p + 1] = g * alpha + this.rgba[p + 1] * remain;
                    this.rgba[p + 2] = bl * alpha + this.rgba[p + 2] * remain;
                    this.rgba[p + 3] = outAlpha;
                    this.pixels[p] = this.rgba[p] / outAlpha * 255;
                    this.pixels[p + 1] = this.rgba[p + 1] / outAlpha * 255;
                    this.pixels[p + 2] = this.rgba[p + 2] / outAlpha * 255;
                    this.pixels[p + 3] = outAlpha * 255;
                }
        }
    }
    dispose() {
        this.width = 0;
        this.height = 0;
        this.pixels = new Uint8ClampedArray(0);
        this.rgba = new Float32Array(0);
        this.depth = new Float64Array(0);
        this.projected = new Float64Array(0);
    }
    /** WebGL readPixels convention: bottom-up rows and premultiplied RGBA. */
    readPixels() {
        const result = new Uint8Array(this.rgba.length), stride = this.width * 4;
        for (let y = 0; y < this.height; y++)
            for (let x = 0; x < stride; x++)
                result[(this.height - 1 - y) * stride + x] = Math.round(this.rgba[y * stride + x] * 255);
        return result;
    }
}
