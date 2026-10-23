import { validateSkinBinding } from './rigging.js';
import { ACCESSORY_SLOTS } from './design.js';
import { MATERIAL_SHAPE_NAMES } from './shapes.js';
import { validateAccessoryPluginDeformation, validateAccessoryPluginSurfaceConnectors } from './plugin-deformation.js';
export const ACCESSORY_PLUGIN_LIMITS = Object.freeze({ maxVertices: 16384, maxTriangles: 32768, maxCoordinate: 16, maxParts: 32, maxFittedVertices: 2048, maxFittedTriangles: 4096, maxEquipped: 6, maxEquippedSkinnedVertices: 16384, maxEquippedSkinnedTriangles: 32768, maxEquippedFittedVertices: 4096, maxEquippedFittedTriangles: 8192 });
/** Exact contact is opt-in and deliberately lower complexity than static geometry. */
export function assertAccessoryPluginFitGeometry(geometry) {
    const skinField = geometry && Object.getOwnPropertyDescriptor(geometry, 'skin');
    if (skinField && !Object.hasOwn(skinField, 'value'))
        throw new TypeError('Skin must be a data field.');
    if (skinField?.value)
        throw new TypeError('Skinned geometry uses slot attachment, not a fitted attachment recipe.');
    if (!geometry || !(geometry.vertices instanceof Float32Array) || !(geometry.indices instanceof Uint16Array))
        throw new TypeError('Fitted accessory geometry requires typed vertex and index buffers.');
    const counts = accessoryPluginGeometryCounts(geometry);
    if (counts.vertices > ACCESSORY_PLUGIN_LIMITS.maxFittedVertices || counts.triangles > ACCESSORY_PLUGIN_LIMITS.maxFittedTriangles)
        throw new RangeError('Fitted accessory geometry exceeds the 2048 vertex / 4096 triangle composed contact limits.');
    if (geometry.surfaceConnectors)
        validateAccessoryPluginSurfaceConnectors(geometry.surfaceConnectors, geometry.vertices.length / 6, geometry.indices.length);
}
/** Includes all append-only procedural topology, never just the authored prefix. */
export function accessoryPluginGeometryCounts(geometry) {
    let vertices = geometry.vertices.length / 6, triangles = geometry.indices.length / 3;
    for (const connector of geometry.surfaceConnectors ?? []) {
        vertices += connector.rings * connector.sides + 2;
        triangles += connector.rings * connector.sides * 2;
    }
    return { vertices, triangles };
}
/** Atomic equipment budget, shared by controller commits and direct renderer payloads. */
export function assertAccessoryPluginEquipmentBudget(items) {
    if (items.length > ACCESSORY_PLUGIN_LIMITS.maxEquipped || new Set(items.map(item => item.slot)).size !== items.length || items.some(item => !ACCESSORY_SLOTS.includes(item.slot)))
        throw new RangeError('Plugin equipment requires at most six unique valid slots.');
    let skinVertices = 0, skinTriangles = 0;
    for (const item of items)
        if (item.asset.geometry.skin) {
            skinVertices += item.asset.geometry.vertices.length / 6;
            skinTriangles += item.asset.geometry.indices.length / 3;
        }
    if (skinVertices > ACCESSORY_PLUGIN_LIMITS.maxEquippedSkinnedVertices || skinTriangles > ACCESSORY_PLUGIN_LIMITS.maxEquippedSkinnedTriangles)
        throw new RangeError('Equipped skins exceed the combined 16384 vertex / 32768 triangle budget.');
    let vertices = 0, triangles = 0;
    for (const item of items)
        if (item.asset.attachment) {
            assertAccessoryPluginFitGeometry(item.asset.geometry);
            const count = accessoryPluginGeometryCounts(item.asset.geometry);
            vertices += count.vertices;
            triangles += count.triangles;
        }
    if (vertices > ACCESSORY_PLUGIN_LIMITS.maxEquippedFittedVertices || triangles > ACCESSORY_PLUGIN_LIMITS.maxEquippedFittedTriangles)
        throw new RangeError('Equipped fitted accessories exceed the combined 4096 vertex / 8192 triangle budget.');
}
function bounded(value, min, max, name) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
        throw new RangeError(`${name} must be finite and between ${min} and ${max}.`);
    return value;
}
function vector(value, count, min, max, name) {
    if (!Array.isArray(value) || value.length !== count)
        throw new TypeError(`${name} requires ${count} coordinates.`);
    return Array.from(value, item => bounded(item, min, max, name));
}
/** Validate and own a serializable, asset-authored fitting recipe. */
export function validateAccessoryPluginAttachment(value) {
    if (!value || typeof value !== 'object')
        throw new TypeError('Accessory attachment is required.');
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
        throw new TypeError('Accessory attachment must be a plain object.');
    const input = value;
    if (!['contained-front', 'crown-envelope', 'perimeter-front', 'eye-plane'].includes(input.mode))
        throw new TypeError('Unsupported accessory attachment mode.');
    const allowed = ['mode', 'mounts', 'clearance', 'follow', 'followAxis', 'followSign', 'geometryScale',
        ...(input.mode === 'perimeter-front' ? ['region', 'perimeterInset', 'containmentClearance'] : input.mode === 'eye-plane' ? ['referenceUv'] : [])];
    if (Reflect.ownKeys(input).some(key => typeof key !== 'string' || !allowed.includes(key)))
        throw new TypeError(`Unsupported fields for ${input.mode} attachment.`);
    if (input.mode === 'perimeter-front' && input.region !== 'left' && input.region !== 'right')
        throw new TypeError('Perimeter-front attachment requires a left or right region.');
    if (input.region !== undefined && input.region !== 'left' && input.region !== 'right')
        throw new TypeError('Attachment region must be left or right.');
    if (input.followAxis !== undefined && !['x', 'y', 'z'].includes(input.followAxis))
        throw new TypeError('Attachment followAxis must be x, y or z.');
    if (input.followSign !== undefined && input.followSign !== -1 && input.followSign !== 1)
        throw new TypeError('Attachment followSign must be -1 or 1.');
    if (!input.mounts || typeof input.mounts !== 'object' || Array.isArray(input.mounts) || Object.keys(input.mounts).length !== MATERIAL_SHAPE_NAMES.length)
        throw new TypeError('Accessory mounts must contain every material shape.');
    const mounts = {};
    for (const shape of MATERIAL_SHAPE_NAMES) {
        if (!Object.hasOwn(input.mounts, shape))
            throw new TypeError(`Accessory mount is missing ${shape}.`);
        const mount = input.mounts[shape];
        if (!mount || typeof mount !== 'object' || Array.isArray(mount) || ![Object.prototype, null].includes(Object.getPrototypeOf(mount)) || Reflect.ownKeys(mount).some(key => typeof key !== 'string' || !['uv', 'offset', 'rotation', 'scale'].includes(key)))
            throw new TypeError(`Accessory mount ${shape} is invalid.`);
        mounts[shape] = { uv: vector(mount.uv, 2, -1, 1, 'Mount UV'), offset: bounded(mount.offset, 0, .25, 'Mount offset'), rotation: vector(mount.rotation, 3, -Math.PI, Math.PI, 'Mount rotation'), scale: bounded(mount.scale, .001, 8, 'Mount scale') };
    }
    const common = { mounts, clearance: bounded(input.clearance ?? .002, 0, .25, 'Attachment clearance'), follow: bounded(input.follow ?? 0, 0, 1, 'Attachment follow'),
        ...(input.followAxis === undefined ? {} : { followAxis: input.followAxis }), ...(input.followSign === undefined ? {} : { followSign: input.followSign }),
        ...(input.geometryScale === undefined ? {} : { geometryScale: bounded(input.geometryScale, .001, 8, 'Geometry scale') }),
    };
    if (input.mode === 'perimeter-front')
        return { ...common, mode: input.mode, region: input.region,
            ...(input.perimeterInset === undefined ? {} : { perimeterInset: bounded(input.perimeterInset, 0, 1, 'Perimeter inset') }),
            ...(input.containmentClearance === undefined ? {} : { containmentClearance: bounded(input.containmentClearance, 0, .25, 'Containment clearance') }),
        };
    if (input.mode === 'eye-plane')
        return { ...common, mode: input.mode, ...(input.referenceUv === undefined ? {} : { referenceUv: vector(input.referenceUv, 2, -1, 1, 'Reference UV') }) };
    return { ...common, mode: input.mode };
}
function parts(value, count) {
    if (!Array.isArray(value) || !value.length || value.length > ACCESSORY_PLUGIN_LIMITS.maxParts)
        throw new RangeError('Accessory parts must be a nonempty bounded list.');
    let next = 0;
    const output = Array.from(value, (part) => {
        if (!part || typeof part !== 'object' || !Number.isSafeInteger(part.indexStart) || part.indexStart !== next || !Number.isSafeInteger(part.indexCount) || part.indexCount < 3 || part.indexCount % 3 || part.indexStart + part.indexCount > count)
            throw new RangeError('Accessory parts must be ordered, contiguous triangle ranges.');
        next += part.indexCount;
        const result = { indexStart: part.indexStart, indexCount: part.indexCount };
        if (part.material !== undefined) {
            const material = part.material;
            if (!material || typeof material !== 'object' || Array.isArray(material))
                throw new TypeError('Accessory material must be an object.');
            result.material = {};
            if (material.color !== undefined) {
                if (typeof material.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(material.color))
                    throw new TypeError('Accessory material color must be #RRGGBB.');
                result.material.color = material.color.toLowerCase();
            }
            if (material.multiplier !== undefined)
                result.material.multiplier = bounded(material.multiplier, 0, 4, 'Material multiplier');
        }
        return result;
    });
    if (next !== count)
        throw new RangeError('Accessory parts must cover the complete index buffer.');
    return output;
}
function pluginId(value) {
    if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,127}$/.test(value))
        throw new TypeError('Accessory plugin id must be 1–128 ASCII letters, numbers, dots, underscores, slashes or hyphens.');
    return value;
}
function slots(value) {
    if (!Array.isArray(value) || value.length < 1 || value.length > ACCESSORY_SLOTS.length || value.some(item => !ACCESSORY_SLOTS.includes(item)) || new Set(value).size !== value.length)
        throw new TypeError('Accessory plugin slots must be a nonempty list of unique equipment slots.');
    return [...value];
}
function plugin(value, expected) {
    if (!value || typeof value !== 'object')
        throw new TypeError('An accessory plugin object is required.');
    const candidate = value;
    const id = pluginId(candidate.id);
    if (expected !== undefined && id !== expected)
        throw new TypeError(`Accessory plugin id mismatch: expected ${expected}, received ${id}.`);
    if (candidate.apiVersion !== 1)
        throw new TypeError('Accessory plugin apiVersion must be 1.');
    if (typeof candidate.createMesh !== 'function')
        throw new TypeError('Accessory plugin createMesh must be a function.');
    // Capture author metadata and function at registration, not after asynchronous loading.
    return { apiVersion: 1, id, slots: slots(candidate.slots), createMesh: candidate.createMesh.bind(candidate), ...(candidate.attachment === undefined ? {} : { attachment: validateAccessoryPluginAttachment(candidate.attachment) }) };
}
/** Validate and copy before worker transport or renderer use. Shared buffers are forbidden. */
export function validateAccessoryPluginGeometry(value) {
    if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
        throw new TypeError('Accessory plugin geometry must be a plain data object.');
    const fields = Object.create(null);
    for (const key of Reflect.ownKeys(value)) {
        const field = Object.getOwnPropertyDescriptor(value, key);
        if (typeof key !== 'string' || !['vertices', 'indices', 'parts', 'skin', 'deformation', 'surfaceConnectors', 'normalPrecision'].includes(key) || !field.enumerable || !Object.hasOwn(field, 'value'))
            throw new TypeError('Accessory plugin geometry contains unsupported or accessor data.');
        fields[key] = field.value;
    }
    const { vertices, indices } = fields;
    if (!(vertices instanceof Float32Array) || !(indices instanceof Uint16Array) || !(vertices.buffer instanceof ArrayBuffer) || !(indices.buffer instanceof ArrayBuffer))
        throw new TypeError('Accessory geometry requires non-shared Float32Array vertices and Uint16Array indices.');
    if (vertices.length < 18 || vertices.length % 6 !== 0 || vertices.length / 6 > ACCESSORY_PLUGIN_LIMITS.maxVertices)
        throw new RangeError('Accessory geometry vertex count exceeds the supported limits.');
    if (indices.length < 3 || indices.length % 3 !== 0 || indices.length / 3 > ACCESSORY_PLUGIN_LIMITS.maxTriangles)
        throw new RangeError('Accessory geometry triangle count exceeds the supported limits.');
    // Copy first so validation and output refer to the same snapshot.
    const ownedVertices = new Float32Array(vertices), ownedIndices = new Uint16Array(indices);
    for (let i = 0; i < ownedVertices.length; i += 6) {
        for (let axis = 0; axis < 3; axis++) {
            const coordinate = ownedVertices[i + axis];
            if (!Number.isFinite(coordinate) || Math.abs(coordinate) > ACCESSORY_PLUGIN_LIMITS.maxCoordinate)
                throw new RangeError('Accessory vertex positions must be finite and within ±16 model units.');
        }
        const length = Math.hypot(ownedVertices[i + 3], ownedVertices[i + 4], ownedVertices[i + 5]);
        if (!Number.isFinite(length) || Math.abs(length - 1) > .001)
            throw new RangeError('Accessory vertex normals must be finite unit vectors.');
    }
    const count = ownedVertices.length / 6;
    for (const index of ownedIndices)
        if (index >= count)
            throw new RangeError('Accessory triangle index is outside the vertex array.');
    const input = fields;
    if (input.normalPrecision !== undefined && input.normalPrecision !== 'float32' && input.normalPrecision !== 'float64')
        throw new TypeError('Normal precision must be float32 or float64.');
    if (input.skin && (input.deformation || input.surfaceConnectors))
        throw new TypeError('Skinning cannot be combined with paired deformation or surface connectors.');
    const skin = input.skin === undefined ? undefined : validateSkinBinding(input.skin, count);
    const connectors = input.surfaceConnectors === undefined ? undefined : validateAccessoryPluginSurfaceConnectors(input.surfaceConnectors, count, ownedIndices.length);
    const ranges = input.parts === undefined ? undefined : parts(input.parts, ownedIndices.length);
    if ((ranges?.length ?? 1) + (connectors?.length ?? 0) > ACCESSORY_PLUGIN_LIMITS.maxParts)
        throw new RangeError('Composed accessory material ranges exceed the supported limits.');
    return { vertices: ownedVertices, indices: ownedIndices, ...(skin ? { skin } : {}), ...(ranges ? { parts: ranges } : {}),
        ...(input.deformation === undefined ? {} : { deformation: validateAccessoryPluginDeformation(input.deformation, count) }),
        ...(connectors ? { surfaceConnectors: connectors } : {}), ...(input.normalPrecision === undefined ? {} : { normalPrecision: input.normalPrecision }),
    };
}
function copyAsset(asset) {
    return { pluginId: asset.pluginId, slots: [...asset.slots], geometry: validateAccessoryPluginGeometry(asset.geometry), ...(asset.attachment ? { attachment: validateAccessoryPluginAttachment(asset.attachment) } : {}) };
}
/**
 * One module/factory invocation per registered id. Failed loads stay failed until retry().
 * Own a registry at application scope to share a load across bots. dispose() releases its
 * cache and invalidates pending results; it cannot cancel application dynamic imports.
 */
export class AccessoryPluginRegistry {
    entries = new Map();
    disposed = false;
    register(value) {
        this.assertLive();
        const captured = plugin(value);
        this.add(captured.id, () => captured);
    }
    registerLazy(id, loader) {
        this.assertLive();
        pluginId(id);
        if (typeof loader !== 'function')
            throw new TypeError('Accessory plugin loader must be a function.');
        this.add(id, loader);
    }
    has(id) { return !this.disposed && this.entries.has(id); }
    async load(id) {
        this.assertLive();
        pluginId(id);
        const entry = this.entries.get(id);
        if (!entry)
            throw new Error(`Accessory plugin is not registered: ${id}.`);
        if (!entry.promise) {
            entry.status = 'loading';
            entry.promise = Promise.resolve().then(() => { this.assertLive(); return entry.loader(); }).then(async (loaded) => {
                this.assertLive();
                const resolved = plugin(loaded && typeof loaded === 'object' && 'default' in loaded ? loaded.default : loaded, id);
                const authoredGeometry = await resolved.createMesh();
                const geometry = validateAccessoryPluginGeometry(authoredGeometry);
                if (resolved.attachment)
                    assertAccessoryPluginFitGeometry(geometry);
                if ((geometry.deformation || geometry.surfaceConnectors?.length) && !resolved.attachment)
                    throw new TypeError('Deformation and surface connectors require an attachment recipe.');
                if (geometry.deformation && resolved.attachment?.mode !== 'eye-plane')
                    throw new TypeError('Paired-affine deformation requires an eye-plane attachment.');
                if (geometry.surfaceConnectors?.length && resolved.attachment?.mode === 'crown-envelope')
                    throw new TypeError('Surface connectors require a front-facing attachment, not crown-envelope.');
                this.assertLive();
                entry.status = 'ready';
                return { pluginId: id, slots: [...resolved.slots], geometry, ...(resolved.attachment ? { attachment: resolved.attachment } : {}) };
            }).catch((error) => { entry.status = 'failed'; throw error; });
        }
        const asset = await entry.promise;
        this.assertLive();
        return copyAsset(asset);
    }
    /** Explicitly retry a failed load. In-flight and successful loads remain deduplicated. */
    retry(id) {
        this.assertLive();
        const entry = this.entries.get(id);
        if (entry?.status === 'failed') {
            entry.promise = undefined;
            entry.status = 'registered';
        }
        return this.load(id);
    }
    dispose() { this.disposed = true; this.entries.clear(); }
    add(id, loader) {
        if (this.entries.has(id))
            throw new Error(`Accessory plugin is already registered: ${id}.`);
        this.entries.set(id, { loader, status: 'registered' });
    }
    assertLive() { if (this.disposed)
        throw new Error('Accessory plugin registry is disposed.'); }
}
