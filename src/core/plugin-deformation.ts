import type { Vec2, Vec3 } from './design.js';
import type { AccessoryPluginMaterial } from './accessory-plugins.js';
import { cross, normalize, sub } from './math.js';

/** Small, data-only operations. No expression interpreter or catalog selector. */
export const ACCESSORY_PLUGIN_DEFORMATION_LIMITS = Object.freeze({ maxVertices: 2048, maxTriangles: 4096, maxChannels: 8, maxConnectors: 4, maxRings: 32, maxSides: 32, maxCoefficient: 16 });

/** Neutral fitted body-local landmarks, independent of camera, gaze and blink. */
export interface AccessoryPluginEyeMeasurements { left: Vec2; right: Vec2; size: Vec2 }
export interface PairedAffineChannel {
  measurement: 'eye-size';
  combine: 'min' | 'max';
  factors: Vec2;
  /** Three coefficients per vertex, in the authored front-plane axes. */
  coefficients: Float64Array;
}
export interface PairedAffineDeformation {
  kind: 'paired-affine';
  /** Per-vertex interpolation between the supplied left and right landmarks. */
  eyeBlend: Float64Array;
  basePositions: Float64Array;
  channels: PairedAffineChannel[];
}
/** A capped, circular tube appended AFTER the author's rigid mesh is seated. */
export interface AccessoryPluginSurfaceConnector {
  kind: 'surface-tube';
  /** Endpoint in the authored rigid mesh's local coordinate system. */
  to: Vec3;
  radius: number;
  rings: number;
  sides: number;
  clearance?: number;
  material?: AccessoryPluginMaterial;
}
export interface PairedAffineAuthorChannel { combine: 'min' | 'max'; factors: Readonly<Vec2> }
export interface PairedAffineAuthorVertex {
  eyeBlend: number;
  basePosition?: Readonly<Vec3>;
  coefficients?: Readonly<Record<string, Readonly<Vec3>>>;
}
export interface PairedAffineAuthoring {
  channels: Readonly<Record<string, PairedAffineAuthorChannel>>;
  vertices: readonly PairedAffineAuthorVertex[];
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object.`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${label} must be a plain object.`);
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  if (Reflect.ownKeys(value).some(key => typeof key !== 'string' || !allowed.includes(key))) throw new TypeError(`${label} contains unsupported fields.`);
}
function bounded(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new RangeError(`${label} must be finite and between ${min} and ${max}.`);
  return value;
}
function integer(value: unknown, min: number, max: number, label: string): number {
  const result = bounded(value, min, max, label);
  if (!Number.isSafeInteger(result)) throw new RangeError(`${label} must be an integer.`);
  return result;
}
function vector(value: unknown, length: number, min: number, max: number, label: string): number[] {
  if (!Array.isArray(value) || value.length !== length) throw new TypeError(`${label} requires ${length} coordinates.`);
  return Array.from(value, item => bounded(item, min, max, label));
}
function array(value: unknown, length: number, min: number, max: number, label: string): Float64Array {
  if (!(value instanceof Float64Array) || !(value.buffer instanceof ArrayBuffer) || value.length !== length) throw new TypeError(`${label} requires a non-shared Float64Array of length ${length}.`);
  const result = new Float64Array(value);
  for (const item of result) bounded(item, min, max, label);
  return result;
}
function reduction(value: unknown): 'min' | 'max' {
  if (value !== 'min' && value !== 'max') throw new TypeError('Affine channel combine must be min or max.');
  return value;
}
function material(value: unknown): AccessoryPluginMaterial {
  const source = object(value, 'Connector material'); keys(source, ['color', 'multiplier'], 'Connector material');
  const result: AccessoryPluginMaterial = {};
  if (source.color !== undefined) {
    if (typeof source.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(source.color)) throw new TypeError('Connector material color must be #RRGGBB.');
    result.color = source.color.toLowerCase();
  }
  if (source.multiplier !== undefined) result.multiplier = bounded(source.multiplier, 0, 4, 'Connector material multiplier');
  return result;
}

/** Exact public landmark contract; malformed arrays must never produce a NaN frame. */
export function validateAccessoryPluginEyeMeasurements(value: unknown): AccessoryPluginEyeMeasurements {
  const source = object(value, 'Neutral eye measurements'); keys(source, ['left', 'right', 'size'], 'Neutral eye measurements');
  return { left: vector(source.left, 2, -16, 16, 'Left eye landmark') as Vec2, right: vector(source.right, 2, -16, 16, 'Right eye landmark') as Vec2, size: vector(source.size, 2, .000001, 16, 'Neutral eye size') as Vec2 };
}

/** Validate once at the registry/worker boundary and own every coefficient buffer. */
export function validateAccessoryPluginDeformation(value: unknown, vertexCount: number): PairedAffineDeformation {
  integer(vertexCount, 1, ACCESSORY_PLUGIN_DEFORMATION_LIMITS.maxVertices, 'Affine vertex count');
  const source = object(value, 'Accessory deformation'); keys(source, ['kind', 'eyeBlend', 'basePositions', 'channels'], 'Accessory deformation');
  if (source.kind !== 'paired-affine') throw new TypeError('Accessory deformation kind must be paired-affine.');
  if (!Array.isArray(source.channels) || source.channels.length < 1 || source.channels.length > ACCESSORY_PLUGIN_DEFORMATION_LIMITS.maxChannels) throw new RangeError('Affine channels must contain between 1 and 8 measurements.');
  const channels = Array.from(source.channels, item => {
    const channel = object(item, 'Affine channel'); keys(channel, ['measurement', 'combine', 'factors', 'coefficients'], 'Affine channel');
    if (channel.measurement !== 'eye-size') throw new TypeError('Affine channel measurement must be eye-size.');
    return { measurement: 'eye-size' as const, combine: reduction(channel.combine), factors: vector(channel.factors, 2, 0, 8, 'Affine measurement factors') as Vec2, coefficients: array(channel.coefficients, vertexCount * 3, -16, 16, 'Affine coefficients') };
  });
  return { kind: 'paired-affine', eyeBlend: array(source.eyeBlend, vertexCount, 0, 1, 'Affine eye blend'), basePositions: array(source.basePositions, vertexCount * 3, -16, 16, 'Affine base positions'), channels };
}

/** Named coefficients keep authoring readable; names do not enter the runtime recipe. */
export function createPairedAffineDeformation(value: PairedAffineAuthoring): PairedAffineDeformation {
  const source = object(value, 'Affine authoring'); keys(source, ['channels', 'vertices'], 'Affine authoring');
  const named = object(source.channels, 'Named affine channels'), names = Object.keys(named);
  keys(named, names, 'Named affine channels');
  if (names.length < 1 || names.length > ACCESSORY_PLUGIN_DEFORMATION_LIMITS.maxChannels || names.some(name => !/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(name))) throw new TypeError('Provide 1–8 short named affine channels.');
  if (!Array.isArray(source.vertices)) throw new TypeError('Affine authoring vertices must be an array.');
  const count = integer(source.vertices.length, 1, ACCESSORY_PLUGIN_DEFORMATION_LIMITS.maxVertices, 'Affine vertex count');
  const channels: PairedAffineChannel[] = names.map(name => {
    const channel = object(named[name], 'Named affine channel'); keys(channel, ['combine', 'factors'], 'Named affine channel');
    return { measurement: 'eye-size', combine: reduction(channel.combine), factors: vector(channel.factors, 2, 0, 8, 'Affine measurement factors') as Vec2, coefficients: new Float64Array(count * 3) };
  });
  const eyeBlend = new Float64Array(count), basePositions = new Float64Array(count * 3);
  for (let index = 0; index < count; index++) {
    const item = source.vertices[index];
    const vertex = object(item, 'Affine authored vertex'); keys(vertex, ['eyeBlend', 'basePosition', 'coefficients'], 'Affine authored vertex');
    eyeBlend[index] = bounded(vertex.eyeBlend, 0, 1, 'Affine eye blend');
    if (vertex.basePosition !== undefined) basePositions.set(vector(vertex.basePosition, 3, -16, 16, 'Affine base position'), index * 3);
    if (vertex.coefficients === undefined) continue;
    const coefficients = object(vertex.coefficients, 'Named vertex coefficients'); keys(coefficients, names, 'Named vertex coefficients');
    names.forEach((name, channelIndex) => {
      if (Object.hasOwn(coefficients, name) && coefficients[name] !== undefined) channels[channelIndex]!.coefficients.set(vector(coefficients[name], 3, -16, 16, 'Affine coefficient'), index * 3);
    });
  }
  return { kind: 'paired-affine', eyeBlend, basePositions, channels };
}

/** Validate complete composed sizes BEFORE runtime allocates any derived geometry. */
export function validateAccessoryPluginSurfaceConnectors(value: unknown, baseVertexCount: number, baseIndexCount: number): AccessoryPluginSurfaceConnector[] {
  integer(baseVertexCount, 1, ACCESSORY_PLUGIN_DEFORMATION_LIMITS.maxVertices, 'Connector base vertex count');
  integer(baseIndexCount, 3, ACCESSORY_PLUGIN_DEFORMATION_LIMITS.maxTriangles * 3, 'Connector base index count');
  if (baseIndexCount % 3) throw new RangeError('Connector base indices must contain complete triangles.');
  if (!Array.isArray(value) || value.length < 1 || value.length > ACCESSORY_PLUGIN_DEFORMATION_LIMITS.maxConnectors) throw new RangeError('Surface connectors must contain between 1 and 4 tubes.');
  let vertices = baseVertexCount, indices = baseIndexCount;
  return Array.from(value, item => {
    const source = object(item, 'Surface connector'); keys(source, ['kind', 'to', 'radius', 'rings', 'sides', 'clearance', 'material'], 'Surface connector');
    if (source.kind !== 'surface-tube') throw new TypeError('Surface connector kind must be surface-tube.');
    const rings = integer(source.rings, 2, ACCESSORY_PLUGIN_DEFORMATION_LIMITS.maxRings, 'Connector rings'), sides = integer(source.sides, 3, ACCESSORY_PLUGIN_DEFORMATION_LIMITS.maxSides, 'Connector sides');
    vertices += rings * sides + 2; indices += rings * sides * 6;
    if (vertices > ACCESSORY_PLUGIN_DEFORMATION_LIMITS.maxVertices || indices > ACCESSORY_PLUGIN_DEFORMATION_LIMITS.maxTriangles * 3) throw new RangeError('Composed accessory geometry exceeds the 2048 vertex / 4096 triangle contact limits.');
    return { kind: 'surface-tube' as const, to: vector(source.to, 3, -16, 16, 'Connector endpoint') as Vec3, radius: bounded(source.radius, .000001, 1, 'Connector radius'), rings, sides, clearance: bounded(source.clearance ?? .002, 0, .25, 'Connector clearance'), ...(source.material === undefined ? {} : { material: material(source.material) }) };
  });
}

/** Evaluate a validated recipe. Only landmark position and supplied dimensions vary. */
export function evaluatePairedAffineDeformation(recipe: PairedAffineDeformation, eyes: AccessoryPluginEyeMeasurements, mountScale = 1): Vec3[] {
  // Effective scale is the product of two independently bounded [.001, 8] scales.
  bounded(mountScale, .000001, 64, 'Affine mount scale');
  const { left, right, size } = validateAccessoryPluginEyeMeasurements(eyes);
  const count = integer(recipe.eyeBlend.length, 1, ACCESSORY_PLUGIN_DEFORMATION_LIMITS.maxVertices, 'Affine vertex count');
  if (recipe.kind !== 'paired-affine' || recipe.basePositions.length !== count * 3 || recipe.channels.length < 1 || recipe.channels.length > ACCESSORY_PLUGIN_DEFORMATION_LIMITS.maxChannels) throw new TypeError('Invalid affine recipe dimensions.');
  const values = recipe.channels.map(channel => {
    if (channel.measurement !== 'eye-size' || channel.coefficients.length !== count * 3) throw new TypeError('Invalid affine measurement dimensions.');
    const factors = vector(channel.factors, 2, 0, 8, 'Affine measurement factors'), a = size[0]! * factors[0]!, b = size[1]! * factors[1]!;
    return reduction(channel.combine) === 'min' ? Math.min(a, b) : Math.max(a, b);
  });
  return Array.from({ length: count }, (_, index): Vec3 => {
    const blend = bounded(recipe.eyeBlend[index], 0, 1, 'Affine eye blend');
    const point: Vec3 = [left[0]! + (right[0]! - left[0]!) * blend, left[1]! + (right[1]! - left[1]!) * blend, 0];
    for (let axis = 0; axis < 3; axis++) {
      const at = index * 3 + axis;
      let offset = bounded(recipe.basePositions[at], -16, 16, 'Affine base position');
      recipe.channels.forEach((channel, channelIndex) => { offset += bounded(channel.coefficients[at], -16, 16, 'Affine coefficient') * values[channelIndex]!; });
      point[axis] = bounded(point[axis]! + offset * mountScale, -16, 16, 'Derived accessory position');
    }
    return point;
  });
}

/** Outward-wound capped tube topology, with two cap-center vertices at the end. */
export function createSurfaceTubeTopology(rings: number, sides: number): Uint16Array {
  integer(rings, 2, ACCESSORY_PLUGIN_DEFORMATION_LIMITS.maxRings, 'Tube rings'); integer(sides, 3, ACCESSORY_PLUGIN_DEFORMATION_LIMITS.maxSides, 'Tube sides');
  const indices: number[] = [];
  for (let ring = 0; ring < rings - 1; ring++) for (let side = 0; side < sides; side++) {
    const a = ring * sides + side, b = (ring + 1) * sides + side, c = ring * sides + (side + 1) % sides, d = (ring + 1) * sides + (side + 1) % sides;
    indices.push(a, c, b, c, d, b);
  }
  const first = rings * sides, last = first + 1;
  for (let side = 0; side < sides; side++) indices.push(first, (side + 1) % sides, side, last, (rings - 1) * sides + side, (rings - 1) * sides + (side + 1) % sides);
  return new Uint16Array(indices);
}

/** Generic finite-difference circular sweep; contact and path authoring stay separate. */
export function sweepSurfaceTube(path: readonly Vec3[], radius: number, sides: number): Vec3[] {
  integer(path.length, 2, ACCESSORY_PLUGIN_DEFORMATION_LIMITS.maxRings, 'Tube rings'); integer(sides, 3, ACCESSORY_PLUGIN_DEFORMATION_LIMITS.maxSides, 'Tube sides'); bounded(radius, 1e-12, 64, 'Tube radius');
  for (const point of path) vector(point, 3, -16, 16, 'Tube path point');
  const points: Vec3[] = [];
  for (let ring = 0; ring < path.length; ring++) {
    const previous = path[Math.max(0, ring - 1)]!, next = path[Math.min(path.length - 1, ring + 1)]!, tangent = normalize(sub(next, previous));
    const helper: Vec3 = Math.abs(tangent[2]) < .95 ? [0, 0, 1] : [0, 1, 0], a = normalize(cross(tangent, helper)), b = cross(tangent, a), center = path[ring]!;
    for (let side = 0; side < sides; side++) {
      const angle = side / sides * Math.PI * 2, c = Math.cos(angle), s = Math.sin(angle);
      points.push(center.map((value, axis) => bounded(value + radius * (a[axis]! * c + b[axis]! * s), -16, 16, 'Derived tube position')) as Vec3);
    }
  }
  points.push([...path[0]!], [...path[path.length - 1]!]);
  return points;
}

/** Smooth indexed normals. Precision selects the source of triangle differences, not shading. */
export function geometryFromPluginPoints(points: readonly Vec3[], indices: readonly number[] | Uint16Array, normalPrecision: 'float32' | 'float64' = 'float64'): Float32Array {
  integer(points.length, 1, ACCESSORY_PLUGIN_DEFORMATION_LIMITS.maxVertices, 'Derived vertex count'); integer(indices.length, 3, ACCESSORY_PLUGIN_DEFORMATION_LIMITS.maxTriangles * 3, 'Derived index count');
  if (indices.length % 3 || normalPrecision !== 'float32' && normalPrecision !== 'float64') throw new TypeError('Invalid derived geometry topology or normal precision.');
  const vertices = new Float32Array(points.length * 6);
  points.forEach((point, index) => vertices.set(vector(point, 3, -16, 16, 'Derived accessory position'), index * 6));
  for (let i = 0; i < indices.length; i += 3) {
    const a = integer(indices[i], 0, points.length - 1, 'Derived triangle index'), b = integer(indices[i + 1], 0, points.length - 1, 'Derived triangle index'), c = integer(indices[i + 2], 0, points.length - 1, 'Derived triangle index');
    const point = (index: number): Vec3 => normalPrecision === 'float64' ? points[index]! : [vertices[index * 6]!, vertices[index * 6 + 1]!, vertices[index * 6 + 2]!];
    const normal = cross(sub(point(b), point(a)), sub(point(c), point(a)));
    for (const index of [a, b, c]) for (let axis = 0; axis < 3; axis++) vertices[index * 6 + 3 + axis]! += normal[axis]!;
  }
  for (let index = 0; index < points.length; index++) {
    const at = index * 6, normal = normalize([vertices[at + 3]!, vertices[at + 4]!, vertices[at + 5]!]);
    if (!normal.every(Number.isFinite)) throw new RangeError('Derived accessory normals must be finite.');
    vertices.set(normal, at + 3);
  }
  return vertices;
}
