import type { BodyDesign, Vec3 } from './design.js';
import type { AccessoryPluginAttachment, AccessoryPluginMount } from './accessory-plugins.js';
import { MATERIAL_SHAPE_NAMES } from './shapes.js';
import type { MaterialShapeName } from './shapes.js';
import type { ShapeContour } from './contours.js';
import type { AccessoryAttachmentFrame } from './accessory-attachments.js';
import { sampleContainedFrontSurface, sampleCalibratedSurface } from './surface.js';
import { transform, frameMatrix } from './math.js';
import type { AccessoryPluginEyeMeasurements } from './plugin-deformation.js';
import { validateAccessoryPluginEyeMeasurements } from './plugin-deformation.js';

export type ShapeWeights = Readonly<Partial<Record<MaterialShapeName, number>>>;
export interface AccessoryPluginAttachmentFrameOptions {
  contour?: ShapeContour;
  depth?: number;
  squash?: number;
  shapeWeights?: ShapeWeights;
  eyes?: AccessoryPluginEyeMeasurements;
}

/** Blend only asset-owned calibration data, including interrupted morph provenance. */
export function resolveAccessoryPluginMount(attachment: AccessoryPluginAttachment, shape: MaterialShapeName, weights?: ShapeWeights): AccessoryPluginMount {
  if (!weights) {
    const mount = attachment.mounts[shape];
    if (!mount) throw new TypeError(`Accessory mount is missing ${shape}.`);
    return { ...mount, uv: [...mount.uv], rotation: [...mount.rotation] };
  }
  const result: AccessoryPluginMount = { uv: [0, 0], rotation: [0, 0, 0], offset: 0, scale: 0 };
  let total = 0;
  for (const name of Object.keys(weights) as MaterialShapeName[]) {
    const weight = weights[name];
    if (!MATERIAL_SHAPE_NAMES.includes(name) || typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0 || weight > 1) throw new RangeError('Shape weights must be finite catalog-shape weights between zero and one.');
    const mount = attachment.mounts[name];
    if (!mount) throw new TypeError(`Accessory mount is missing ${name}.`);
    total += weight;
    for (let i = 0; i < 2; i++) result.uv[i]! += mount.uv[i]! * weight;
    for (let i = 0; i < 3; i++) result.rotation[i]! += mount.rotation[i]! * weight;
    result.offset += mount.offset * weight; result.scale += mount.scale * weight;
  }
  if (Math.abs(total - 1) > 1e-6) throw new RangeError('Shape weights must sum to one.');
  return result;
}

/** Neutral calibrated frame BEFORE mesh clearance. Matrix is orthonormal; scale is separate.
 * Explicit part-animation translation/scale continue to use the public slot frame.
 */
export function getAccessoryPluginAttachmentFrame(body: BodyDesign, attachment: AccessoryPluginAttachment, options: AccessoryPluginAttachmentFrameOptions = {}): AccessoryAttachmentFrame {
  const squash = options.squash ?? 1;
  if (!Number.isFinite(squash) || squash < .25 || squash > 4 || options.depth !== undefined && (!Number.isFinite(options.depth) || options.depth <= 0 || options.depth > 16)) throw new RangeError('Invalid accessory attachment body pose.');
  const mount = resolveAccessoryPluginMount(attachment, body.shape, options.shapeWeights);
  const profile = options.depth === undefined ? undefined : { depth: options.depth }, scale = mount.scale * (attachment.geometryScale ?? 1);
  if (attachment.mode === 'contained-front') return { ...sampleContainedFrontSurface(body, mount, squash, options.contour, profile), scale };
  if (attachment.mode === 'crown-envelope' || attachment.mode === 'perimeter-front') return { ...sampleCalibratedSurface(body, mount, attachment.mode, attachment, squash, options.contour, profile), scale };
  const eyes = validateAccessoryPluginEyeMeasurements(options.eyes);
  const calibrated = sampleCalibratedSurface(body, mount, 'central-front', {}, squash, options.contour, profile);
  const reference = sampleCalibratedSurface(body, { uv: attachment.referenceUv ?? [0, .1], offset: 0, rotation: [0, 0, 0] }, 'central-front', {}, squash, options.contour, profile);
  const position: Vec3 = [(eyes.left[0] + eyes.right[0]) / 2 + calibrated.position[0] - reference.position[0], (eyes.left[1] + eyes.right[1]) / 2 + calibrated.position[1] - reference.position[1], 0];
  const orientation = transform([0, 0, 0], mount.rotation), tangent: Vec3 = [orientation[0]!, orientation[1]!, orientation[2]!], bitangent: Vec3 = [orientation[4]!, orientation[5]!, orientation[6]!], normal: Vec3 = [orientation[8]!, orientation[9]!, orientation[10]!];
  return { position, tangent, bitangent, normal, matrix: frameMatrix(position, tangent, bitangent, normal), scale };
}
