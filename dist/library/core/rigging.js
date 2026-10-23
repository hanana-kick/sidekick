import { identity, multiply, transform } from './math.js';
/** CPU skinning is intentionally bounded and data-only; scale is not supported. */
export const RIGGING_LIMITS = Object.freeze({ maxBones: 32, maxVertices: 16384, maxCoordinate: 16, maxRotation: 16 * Math.PI, influences: 4, weightTolerance: 1e-5 });
const reservedIds = new Set([...Object.getOwnPropertyNames(Object.prototype), 'prototype']);
/** Shared by animation track validation; never allow prototype keys as bone identities. */
export function isBoneId(value) {
    return typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._/:-]{0,127}$/.test(value) && !reservedIds.has(value);
}
function boneId(value, label) {
    if (!isBoneId(value))
        throw new TypeError(`${label} must be a safe 1–128 character bone id.`);
    return value;
}
function record(value, label, allowed) {
    if (!value || typeof value !== 'object' || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null))
        throw new TypeError(`${label} must be a plain data object.`);
    const result = Object.create(null);
    for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== 'string' || reservedIds.has(key) || (allowed && !allowed.includes(key)))
            throw new TypeError(`${label} contains an unsupported field.`);
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value'))
            throw new TypeError(`${label}.${key} must be an enumerable data field, not an accessor.`);
        result[key] = descriptor.value;
    }
    return result;
}
function bounded(value, min, max, label) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
        throw new RangeError(`${label} must be finite and between ${min} and ${max}.`);
    return value;
}
function vertexCount(value) {
    if (!Number.isSafeInteger(value) || value < 1 || value > RIGGING_LIMITS.maxVertices)
        throw new RangeError('Skin vertex count must be between 1 and 16384.');
}
function dataArray(value, min, max, label) {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype)
        throw new TypeError(`${label} must be a plain array.`);
    if (value.length < min || value.length > max)
        throw new RangeError(`${label} must contain between ${min} and ${max} entries.`);
    if (Reflect.ownKeys(value).length !== value.length + 1)
        throw new TypeError(`${label} must be dense and contain no extra fields.`);
    const result = [];
    for (let i = 0; i < value.length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
        if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value'))
            throw new TypeError(`${label}[${i}] must be a data entry, not an accessor or hole.`);
        result.push(descriptor.value);
    }
    return result;
}
function vector(value, bound, label) {
    return dataArray(value, 3, 3, label).map(item => bounded(item, -bound, bound, label));
}
function boneTransform(source, label) {
    const result = {};
    if (source.position !== undefined)
        result.position = vector(source.position, RIGGING_LIMITS.maxCoordinate, `${label} position`);
    if (source.rotation !== undefined)
        result.rotation = vector(source.rotation, RIGGING_LIMITS.maxRotation, `${label} rotation`);
    return result;
}
/** Validate and clone. Input order is retained, including when parents follow children. */
export function validateSkeleton(value) {
    const source = record(value, 'Skeleton', ['bones']);
    const bones = dataArray(source.bones, 1, RIGGING_LIMITS.maxBones, 'Skeleton bones').map(value => {
        const source = record(value, 'Bone', ['id', 'parent', 'position', 'rotation']);
        const result = { id: boneId(source.id, 'Bone id'), ...boneTransform(source, 'Bone bind') };
        if (source.parent !== undefined)
            result.parent = boneId(source.parent, 'Parent bone id');
        return result;
    });
    const indices = new Map();
    bones.forEach((bone, index) => {
        if (indices.has(bone.id))
            throw new TypeError(`Duplicate bone id: ${bone.id}.`);
        indices.set(bone.id, index);
    });
    const visited = new Set(), visiting = new Set();
    function visit(bone) {
        if (visited.has(bone.id))
            return;
        if (visiting.has(bone.id))
            throw new TypeError('Skeleton hierarchy must not contain a cycle.');
        visiting.add(bone.id);
        if (bone.parent !== undefined) {
            const index = indices.get(bone.parent);
            if (index === undefined)
                throw new TypeError(`Unknown parent bone: ${bone.parent}.`);
            visit(bones[index]);
        }
        visiting.delete(bone.id);
        visited.add(bone.id);
    }
    bones.forEach(visit);
    return { bones };
}
function poseForSkeleton(value, skeleton) {
    const source = record(value, 'Bone pose', skeleton.bones.map(bone => bone.id));
    const result = {};
    for (const id of Object.keys(source))
        result[id] = boneTransform(record(source[id], `Bone pose ${id}`, ['position', 'rotation']), `Bone pose ${id}`);
    return result;
}
/** Unknown bones, scale, executable properties, and unbounded values are rejected. */
export function validateBonePose(value, skeleton) {
    return poseForSkeleton(value, validateSkeleton(skeleton));
}
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const typedLength = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'length').get;
const typedBuffer = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'buffer').get;
function typedArray(value, constructor, length, label) {
    if (!value || Object.getPrototypeOf(value) !== constructor.prototype)
        throw new TypeError(`${label} requires a plain ${constructor.name}.`);
    // Intrinsic getters avoid invoking a hostile own `length` or `buffer` accessor.
    const size = typedLength.call(value);
    const buffer = typedBuffer.call(value);
    if (!(buffer instanceof ArrayBuffer))
        throw new TypeError(`${label} requires a non-shared buffer.`);
    if (size > RIGGING_LIMITS.maxVertices * 6 || (length !== undefined && size !== length))
        throw new RangeError(`${label} has an invalid length.`);
    // Numeric typed-array elements cannot be accessors; reject every other own field.
    const keys = Reflect.ownKeys(value);
    if (keys.length !== size || keys.some((key, i) => key !== String(i)))
        throw new TypeError(`${label} must not contain extra fields or accessors.`);
    return value;
}
/** Own all rig data before registration, worker transport, or repeated evaluation. */
export function validateSkinBinding(value, count) {
    vertexCount(count);
    const source = record(value, 'Skin binding', ['skeleton', 'joints', 'weights']);
    const skeleton = validateSkeleton(source.skeleton);
    const joints = new Uint8Array(typedArray(source.joints, Uint8Array, count * 4, 'Skin joints'));
    const weights = new Float32Array(typedArray(source.weights, Float32Array, count * 4, 'Skin weights'));
    for (let vertex = 0; vertex < count; vertex++) {
        let sum = 0;
        for (let influence = 0; influence < 4; influence++) {
            const index = vertex * 4 + influence;
            if (joints[index] >= skeleton.bones.length)
                throw new RangeError('Skin joint index is outside the skeleton, including zero-weight entries.');
            sum += bounded(weights[index], 0, 1, 'Skin weight');
        }
        if (Math.abs(sum - 1) > RIGGING_LIMITS.weightTolerance)
            throw new RangeError('Skin weights for each vertex must sum to 1.');
    }
    return { skeleton, joints, weights };
}
/** Inverse of rigid T*R: transpose the rotation, then apply -R^T*t. */
function inverseRigid(matrix) {
    const result = identity();
    for (let col = 0; col < 3; col++)
        for (let row = 0; row < 3; row++)
            result[col * 4 + row] = matrix[row * 4 + col];
    for (let row = 0; row < 3; row++)
        result[12 + row] = -(result[row] * matrix[12] + result[4 + row] * matrix[13] + result[8 + row] * matrix[14]);
    return result;
}
function worldMatrices(local, parents) {
    const world = new Array(local.length);
    function visit(index) {
        if (world[index])
            return world[index];
        const parent = parents[index];
        const result = parent < 0 ? new Float32Array(local[index]) : multiply(visit(parent), local[index]);
        world[index] = result;
        return result;
    }
    local.forEach((_, index) => visit(index));
    return world;
}
function compileSkeleton(skeleton) {
    const indices = new Map(skeleton.bones.map((bone, index) => [bone.id, index]));
    const parents = skeleton.bones.map(bone => bone.parent === undefined ? -1 : indices.get(bone.parent));
    const bindLocal = skeleton.bones.map(bone => transform(bone.position, bone.rotation));
    const bindWorld = worldMatrices(bindLocal, parents);
    return { skeleton, parents, bindLocal, bindWorld, inverseBind: bindWorld.map(inverseRigid) };
}
function neutralPose(pose) {
    return Object.values(pose).every(value => (!value.position || value.position.every(v => v === 0)) && (!value.rotation || value.rotation.every(v => v === 0)));
}
function posedMatrices(compiled, pose) {
    const neutral = neutralPose(pose);
    const local = compiled.skeleton.bones.map((bone, index) => {
        const delta = pose[bone.id];
        return !delta || neutral ? new Float32Array(compiled.bindLocal[index]) : multiply(compiled.bindLocal[index], transform(delta.position, delta.rotation));
    });
    const world = worldMatrices(local, compiled.parents);
    // Avoid float32 inverse-bind drift for the neutral pose.
    const deformation = world.map((matrix, index) => neutral ? identity() : multiply(matrix, compiled.inverseBind[index]));
    return { local, world, bindWorld: compiled.bindWorld, inverseBind: compiled.inverseBind, deformation };
}
/** All arrays retain the authored bone order. Matrices are column-major, matching math.ts. */
export function computeBoneMatrices(skeleton, pose = {}) {
    const owned = validateSkeleton(skeleton);
    return posedMatrices(compileSkeleton(owned), poseForSkeleton(pose, owned));
}
/** World means skeleton/model-local space, before the accessory or avatar model matrix. */
export function getBoneTransform(skeleton, id, pose = {}, space = 'world') {
    if (space !== 'world' && space !== 'local')
        throw new TypeError('Bone transform space must be world or local.');
    boneId(id, 'Bone id');
    const owned = validateSkeleton(skeleton), index = owned.bones.findIndex(bone => bone.id === id);
    if (index < 0)
        throw new TypeError(`Unknown bone: ${id}.`);
    return posedMatrices(compileSkeleton(owned), poseForSkeleton(pose, owned))[space][index];
}
function ownVertices(value) {
    const input = typedArray(value, Float32Array, undefined, 'Skin vertices');
    if (input.length % 6 !== 0)
        throw new RangeError('Skin vertices require a position/normal stride of 6.');
    vertexCount(input.length / 6);
    const vertices = new Float32Array(input);
    for (let index = 0; index < vertices.length; index += 6) {
        for (let axis = 0; axis < 3; axis++)
            bounded(vertices[index + axis], -RIGGING_LIMITS.maxCoordinate, RIGGING_LIMITS.maxCoordinate, 'Skin vertex position');
        const normalLength = Math.hypot(vertices[index + 3], vertices[index + 4], vertices[index + 5]);
        if (!Number.isFinite(normalLength) || Math.abs(normalLength - 1) > .001)
            throw new RangeError('Skin vertex normals must be finite unit vectors.');
    }
    return vertices;
}
function deformVertices(vertices, binding, matrices, out) {
    for (let index = 0, vertex = 0; index < vertices.length; index += 6, vertex++) {
        const x = vertices[index], y = vertices[index + 1], z = vertices[index + 2];
        const nx = vertices[index + 3], ny = vertices[index + 4], nz = vertices[index + 5];
        let px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0, total = 0;
        let strongest = -1, fallbackX = nx, fallbackY = ny, fallbackZ = nz;
        for (let influence = 0; influence < 4; influence++) {
            const slot = vertex * 4 + influence, weight = binding.weights[slot];
            if (weight === 0)
                continue;
            const matrix = matrices[binding.joints[slot]];
            px += weight * (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]);
            py += weight * (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]);
            pz += weight * (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]);
            const tx = matrix[0] * nx + matrix[4] * ny + matrix[8] * nz;
            const ty = matrix[1] * nx + matrix[5] * ny + matrix[9] * nz;
            const tz = matrix[2] * nx + matrix[6] * ny + matrix[10] * nz;
            rx += weight * tx;
            ry += weight * ty;
            rz += weight * tz;
            total += weight;
            if (weight > strongest) {
                strongest = weight;
                fallbackX = tx;
                fallbackY = ty;
                fallbackZ = tz;
            }
        }
        let normalLength = Math.hypot(rx, ry, rz);
        // Opposing influences can cancel a normal. Use the strongest influence deterministically.
        if (normalLength < 1e-8) {
            rx = fallbackX;
            ry = fallbackY;
            rz = fallbackZ;
            normalLength = Math.hypot(rx, ry, rz);
        }
        out[index] = px / total;
        out[index + 1] = py / total;
        out[index + 2] = pz / total;
        out[index + 3] = rx / normalLength;
        out[index + 4] = ry / normalLength;
        out[index + 5] = rz / normalLength;
    }
    return out;
}
/** Validate once and cache the owned neutral mesh, binding, inverse bind, and output buffer. */
export function createSkinDeformer(vertices, binding) {
    const neutral = ownVertices(vertices), owned = validateSkinBinding(binding, neutral.length / 6);
    const compiled = compileSkeleton(owned.skeleton), output = new Float32Array(neutral.length);
    return {
        deform(pose = {}, out = output) {
            const checkedPose = poseForSkeleton(pose, owned.skeleton);
            if (out !== output)
                typedArray(out, Float32Array, neutral.length, 'Skin output');
            if (typedLength.call(out) !== neutral.length)
                throw new RangeError('Skin output has an invalid or detached length.');
            if (neutralPose(checkedPose)) {
                Float32Array.prototype.set.call(out, neutral);
                return out;
            }
            return deformVertices(neutral, owned, posedMatrices(compiled, checkedPose).deformation, out);
        },
    };
}
/** One-shot safe skinning; use createSkinDeformer for repeated animation frames. */
export function skinVertices(vertices, binding, pose = {}, out) {
    return createSkinDeformer(vertices, binding).deform(pose, out);
}
