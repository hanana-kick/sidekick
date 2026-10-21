import { assertAccessoryPluginFitGeometry } from './accessory-plugins.js';
import { shapeContour } from './contours.js';
import { getAccessoryPluginAttachmentFrame, resolveAccessoryPluginMount } from './plugin-attachment.js';
export { resolveAccessoryPluginMount } from './plugin-attachment.js';
import { resolveShapeProfile } from './shape-profiles.js';
import { BODY_SIZE } from './surface.js';
import { contourVolumeHeight } from './body-volume.js';
import { createSurfaceTubeTopology, evaluatePairedAffineDeformation, sweepSurfaceTube, geometryFromPluginPoints, validateAccessoryPluginEyeMeasurements } from './plugin-deformation.js';
import { identity, multiply, transform } from './math.js';
import { rigidFrontLift, drapedFrontLifts } from '../renderer/rigid-contact.js';
/** Solid material resolution shared by every backend. */
export function accessoryPluginMaterialColor(color, material) {
    const source = material?.color ?? color, multiplier = material?.multiplier ?? 1;
    if (multiplier === 1)
        return source;
    const value = parseInt(source.slice(1), 16);
    return '#' + [16, 8, 0].map(shift => Math.min(255, Math.round(((value >> shift) & 255) * multiplier)).toString(16).padStart(2, '0')).join('');
}
/** Renderer-owned fit cache. Author buffers stay immutable; only changed derived meshes upload. */
export class AccessoryPluginFitter {
    asset;
    points;
    indices;
    composedIndices;
    connectors;
    parts;
    contour;
    weights;
    key = '';
    result;
    constructor(asset) {
        this.asset = asset;
        if (!asset.attachment)
            throw new TypeError('A fitted accessory needs an attachment recipe.');
        assertAccessoryPluginFitGeometry(asset.geometry);
        this.points = Array.from({ length: asset.attachment.mode === 'crown-envelope' ? 0 : asset.geometry.vertices.length / 6 }, () => [0, 0, 0]);
        this.indices = Array.from(asset.geometry.indices);
        const combined = [...this.indices];
        let vertexStart = asset.geometry.vertices.length / 6;
        const ranges = asset.geometry.parts?.map(part => ({ ...part })) ?? [{ indexStart: 0, indexCount: combined.length }];
        this.connectors = (asset.geometry.surfaceConnectors ?? []).map(recipe => {
            const indices = Array.from(createSurfaceTubeTopology(recipe.rings, recipe.sides));
            const indexStart = combined.length;
            for (const index of indices)
                combined.push(index + vertexStart);
            vertexStart += recipe.rings * recipe.sides + 2;
            const last = ranges.at(-1);
            if ((last.material?.color ?? '') === (recipe.material?.color ?? '') && (last.material?.multiplier ?? 1) === (recipe.material?.multiplier ?? 1))
                last.indexCount += indices.length;
            else
                ranges.push({ indexStart, indexCount: indices.length, ...(recipe.material ? { material: recipe.material } : {}) });
            return { recipe, indices };
        });
        this.composedIndices = this.connectors.length ? new Uint16Array(combined) : asset.geometry.indices;
        this.parts = this.connectors.length ? ranges : asset.geometry.parts;
    }
    sample(body, options = {}) {
        const contour = options.contour ?? shapeContour({ kind: 'material', name: body.shape });
        const depth = options.depth ?? resolveShapeProfile(body.shape).depth, squash = options.squash ?? 1, rotation = options.rotation ?? [0, 0, 0];
        if (!Number.isFinite(depth) || depth <= 0 || depth > 16 || !Number.isFinite(squash) || squash < .25 || squash > 4 || rotation.length !== 3 || !rotation.every(Number.isFinite))
            throw new RangeError('Invalid accessory fitting body pose.');
        const eyes = options.eyes === undefined ? undefined : validateAccessoryPluginEyeMeasurements(options.eyes);
        const key = `${body.shape}:${depth}:${squash}:${rotation.join(',')}:${eyes ? [...eyes.left, ...eyes.right, ...eyes.size].join(',') : ''}`;
        if (this.result && this.contour === contour && this.weights === options.shapeWeights && this.key === key)
            return this.result;
        const attachment = this.asset.attachment, mount = resolveAccessoryPluginMount(attachment, body.shape, options.shapeWeights);
        const frame = getAccessoryPluginAttachmentFrame(body, attachment, { ...options, contour, depth, squash });
        const localScale = mount.scale * (attachment.geometryScale ?? 1);
        const posed = transform([0, 0, 0], rotation, [localScale, localScale, localScale]);
        let matrix = multiply(frame.matrix, posed), geometry, seating = 0;
        if (attachment.mode === 'crown-envelope') {
            // Keep authored geometry scale as the final Float32 matrix stage.
            matrix = multiply(frame.matrix, transform([0, 0, 0], rotation));
            matrix = multiply(matrix, transform([0, 0, 0], [0, 0, 0], [mount.scale, mount.scale, mount.scale]));
            const geometryScale = attachment.geometryScale ?? 1;
            matrix = multiply(matrix, transform([0, 0, 0], [0, 0, 0], [geometryScale, geometryScale, geometryScale]));
        }
        if (attachment.mode !== 'crown-envelope') {
            if (this.asset.geometry.deformation) {
                if (!eyes)
                    throw new TypeError('Paired-affine geometry requires neutral eye measurements.');
                const authored = evaluatePairedAffineDeformation(this.asset.geometry.deformation, eyes, localScale);
                const orientation = multiply(transform([0, 0, 0], mount.rotation), transform([0, 0, 0], rotation));
                const centerX = (eyes.left[0] + eyes.right[0]) / 2, centerY = (eyes.left[1] + eyes.right[1]) / 2;
                for (let i = 0; i < authored.length; i++) {
                    const point = authored[i], local = [point[0] - centerX, point[1] - centerY, point[2]], output = this.points[i];
                    for (let axis = 0; axis < 3; axis++)
                        output[axis] = frame.position[axis] + orientation[axis] * local[0] + orientation[4 + axis] * local[1] + orientation[8 + axis] * local[2];
                }
            }
            else {
                const vertices = this.asset.geometry.vertices;
                for (let i = 0; i < this.points.length; i++) {
                    const at = i * 6, x = vertices[at], y = vertices[at + 1], z = vertices[at + 2];
                    const px = posed[0] * x + posed[4] * y + posed[8] * z, py = posed[1] * x + posed[5] * y + posed[9] * z, pz = posed[2] * x + posed[6] * y + posed[10] * z;
                    const point = this.points[i], f = frame.matrix;
                    point[0] = f[0] * px + f[4] * py + f[8] * pz + f[12];
                    point[1] = f[1] * px + f[5] * py + f[9] * pz + f[13];
                    point[2] = f[2] * px + f[6] * py + f[10] * pz + f[14];
                }
            }
            const stretch = 1 / Math.sqrt(squash), scales = [BODY_SIZE[0] * .5 * stretch, BODY_SIZE[1] * .5 * squash, depth * .5 * stretch];
            seating = rigidFrontLift(this.points, this.indices, contour, scales, (attachment.clearance ?? .002) + (attachment.mode === 'eye-plane' ? mount.offset : 0));
            matrix[14] += seating;
            if (this.asset.geometry.deformation || this.connectors.length) {
                for (const point of this.points)
                    point[2] += seating;
                const allPoints = [...this.points];
                const height = (x, y) => contourVolumeHeight(contour, x / scales[0], y / scales[1]) * scales[2];
                for (const { recipe, indices } of this.connectors) {
                    const radius = recipe.radius * localScale, clearance = recipe.clearance ?? .002;
                    const start = [frame.position[0], frame.position[1], frame.position[2] + radius + clearance];
                    const local = recipe.to, end = [0, 0, 0];
                    // Keep the same two-stage authored transform used for the rigid body.
                    const p = [posed[0] * local[0] + posed[4] * local[1] + posed[8] * local[2], posed[1] * local[0] + posed[5] * local[1] + posed[9] * local[2], posed[2] * local[0] + posed[6] * local[1] + posed[10] * local[2]];
                    for (let axis = 0; axis < 3; axis++)
                        end[axis] = frame.matrix[axis] * p[0] + frame.matrix[4 + axis] * p[1] + frame.matrix[8 + axis] * p[2] + frame.matrix[12 + axis] + (axis === 2 ? seating : 0);
                    const path = Array.from({ length: recipe.rings }, (_, i) => {
                        const t = i / (recipe.rings - 1), point = start.map((value, axis) => value + (end[axis] - value) * t);
                        point[2] = Math.max(point[2], height(point[0], point[1]) + radius + clearance);
                        return point;
                    });
                    const wire = sweepSurfaceTube(path, radius, recipe.sides), lifts = drapedFrontLifts(wire, indices, contour, scales);
                    for (let ring = 0; ring < recipe.rings; ring++) {
                        let lift = 0;
                        for (let side = 0; side < recipe.sides; side++)
                            lift = Math.max(lift, lifts[ring * recipe.sides + side]);
                        if (ring === 0)
                            lift = Math.max(lift, lifts[recipe.rings * recipe.sides]);
                        if (ring === recipe.rings - 1)
                            lift = Math.max(lift, lifts[recipe.rings * recipe.sides + 1]);
                        for (let side = 0; side < recipe.sides; side++)
                            wire[ring * recipe.sides + side][2] += lift;
                        if (ring === 0)
                            wire[recipe.rings * recipe.sides][2] += lift;
                        if (ring === recipe.rings - 1)
                            wire[recipe.rings * recipe.sides + 1][2] += lift;
                    }
                    allPoints.push(...wire);
                }
                geometry = { vertices: geometryFromPluginPoints(allPoints, this.composedIndices, this.asset.geometry.normalPrecision ?? 'float64'), indices: this.composedIndices, ...(this.parts ? { parts: this.parts } : {}) };
                matrix = identity();
            }
        }
        this.contour = contour;
        this.weights = options.shapeWeights;
        this.key = key;
        return this.result = { matrix, frame, mount, seating, ...(geometry ? { geometry } : {}) };
    }
}
/** Stateless fitting helper for author previews and geometry parity tests. */
export function fitAccessoryPlugin(asset, body, options = {}) {
    return new AccessoryPluginFitter(asset).sample(body, options);
}
