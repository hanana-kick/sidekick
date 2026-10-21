/**
 * DOM-independent authoring helpers for accessory plugins and part animations.
 * Importing this entrypoint does not register plugins or custom elements, create
 * a renderer, or execute mesh factories. Application registration stays explicit.
 */
import type { AccessoryPlugin, AccessoryPluginGeometry } from './core/accessory-plugins.cjs';
import type { PartAnimationClip } from './core/part-animation.cjs';
export { ACCESSORY_PLUGIN_LIMITS, validateAccessoryPluginGeometry, validateAccessoryPluginAttachment } from './core/accessory-plugins.cjs';
export type { AccessoryPlugin, AccessoryPluginGeometry, AccessoryPluginMaterial, AccessoryPluginPart, AccessoryPluginMount, AccessoryPluginAttachment, AccessoryPluginLoader, AccessoryPluginModule, PluginAccessoryAsset, } from './core/accessory-plugins.cjs';
export { resolveAccessoryPluginMount, getAccessoryPluginAttachmentFrame } from './core/plugin-attachment.cjs';
export type { ShapeWeights, AccessoryPluginAttachmentFrameOptions } from './core/plugin-attachment.cjs';
export { getAccessoryPluginEyeMeasurements } from './core/plugin-eye-measurements.cjs';
export type { AccessoryPluginEyeMeasurementOptions } from './core/plugin-eye-measurements.cjs';
export { ACCESSORY_PLUGIN_DEFORMATION_LIMITS, createPairedAffineDeformation, validateAccessoryPluginDeformation, validateAccessoryPluginSurfaceConnectors, validateAccessoryPluginEyeMeasurements } from './core/plugin-deformation.cjs';
export type { AccessoryPluginEyeMeasurements, PairedAffineDeformation, PairedAffineChannel, PairedAffineAuthoring, PairedAffineAuthorChannel, PairedAffineAuthorVertex, AccessoryPluginSurfaceConnector } from './core/plugin-deformation.cjs';
export { ACCESSORY_SLOTS } from './core/design.cjs';
export type { AccessorySlot, BodyDesign, MaterialShapeName, Vec2, Vec3 } from './core/design.cjs';
export { ACCESSORY_ATTACHMENT_POINTS, getAccessoryAttachmentFrame, getAccessoryAttachmentFrames, attachmentPointToBody, } from './core/accessory-attachments.cjs';
export type { AccessoryAttachmentPoint, AccessoryAttachmentFrame, AttachmentFrameOptions, } from './core/accessory-attachments.cjs';
export type { SurfaceFrame } from './core/surface.cjs';
export type { ShapeContour, ContourPoint } from './core/contours.cjs';
export type { ShapeProfile } from './core/shape-profiles.cjs';
export { PART_ANIMATION_LIMITS, validatePartAnimation, samplePartAnimation } from './core/part-animation.cjs';
export type { PartKeyframe, PartAnimationTrack, PartAnimationClip, PartAccessorySample, PartAnimationSample, } from './core/part-animation.cjs';
/**
 * Type-check a plugin definition while preserving its inferred ID, slots, custom
 * fields and synchronous/asynchronous factory return type. This is an identity
 * helper: it returns the same object without validation, copying, freezing,
 * registration, or calling createMesh. The runtime registry validates metadata
 * when registering/loading the plugin and validates the produced geometry.
 */
export declare function defineAccessoryPlugin<const T extends AccessoryPlugin>(plugin: T): T;
/**
 * Validate author-supplied mesh data with the runtime's geometry contract and
 * return independently owned vertex/index buffers. The input is not modified.
 * Vertices are [x, y, z, nx, ny, nz] in attachment-local model units.
 */
export declare function defineAccessoryGeometry(geometry: AccessoryPluginGeometry): AccessoryPluginGeometry;
/**
 * Validate a clip with the runtime's animation contract and return an owned data
 * snapshot. The input is not modified. Duration and keyframe times are seconds.
 */
export declare function definePartAnimation(clip: PartAnimationClip): PartAnimationClip;
