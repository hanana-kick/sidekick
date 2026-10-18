import type { AccessoryPreset, AccessorySlot, Vec2, Vec3 } from './design.js';
import type { Anchor, ResolvedAccessoryDesign, ResolvedEyeDesign } from './resolved-design.js';
import type { MaterialShapeName } from './shapes.js';
/** Maximum world-unit volume depth. XY retains the Material catalog outline. */
export declare const BODY_DEPTH_RANGE: readonly [0.08, 1.2];
export declare const MOUNT_UV_RANGE: readonly [-0.65, 0.65];
export declare const MOUNT_OFFSET_RANGE: readonly [0, 0.25];
/** Per-shape multipliers of the global neutral eye dimensions and spacing. */
export declare const EYE_PROFILE_SCALE_RANGE: readonly [0.5, 1.5];
/** Additive surface-chart V adjustment, independent of expression weights. */
export declare const EYE_PROFILE_OFFSET_Y_RANGE: readonly [-0.35, 0.35];
/** Additive calibration of an accessory's existing surface anchor, in its own region. */
export interface ShapeMount {
    uv: Vec2;
    offset: number;
}
/** Shape calibration never contains smile/blink weights or expression targets. */
export interface ShapeEyeProfile {
    width: number;
    height: number;
    spacing: number;
    offsetY: number;
}
/** Internal equipment fit. Position and model orientation are deliberately independent.
 * Crown UV chooses a lobe by perimeter phase; rotation describes the cap band /
 * halo plane in an upright crown frame, never the radial direction to that lobe.
 */
export interface CuratedAccessoryMount {
    anchor: Anchor;
    rotation: Vec3;
    scale: number;
}
export type CuratedAccessoryKey = Exclude<AccessoryPreset, 'earring' | 'starEarring'> | 'leftEarring' | 'rightEarring' | 'leftStarEarring' | 'rightStarEarring';
/** Legacy calibration is validated on import, never used as a public slot map. */
export type ScarfSupportFit = readonly [angle: number, level: number, left: number, right: number];
export interface ShapeProfile {
    scarfFit: ScarfSupportFit;
    depth: number;
    mounts: Record<'head' | 'face', ShapeMount>;
    eyes: ShapeEyeProfile;
    accessories: Record<CuratedAccessoryKey, CuratedAccessoryMount>;
}
/** Older saved depth/mount overrides may omit eyes; resolution fills shape defaults. */
export type ShapeProfileInput = Omit<ShapeProfile, 'eyes' | 'accessories' | 'scarfFit'> & {
    eyes?: ShapeEyeProfile;
};
export type ShapeProfiles = Partial<Record<MaterialShapeName, ShapeProfileInput>>;
export type ResolvedShapeProfiles = Partial<Record<MaterialShapeName, ShapeProfile>>;
export type ShapeEyeGeometry = Pick<ResolvedEyeDesign, 'width' | 'height' | 'spacing' | 'anchor'>;
/**
 * Curated fit for every catalog outline. Rounded and pointed crowns use their
 * actual top; split crowns choose a broad neighboring lobe. Each beret's band
 * has its own deliberately chosen plane instead of inheriting its lobe's radial
 * angle. In particular the heart uses the right lobe summit and a level band.
 * Halo placement is independently centered over the current crown envelope.
 * Glasses use neutral eye calibration in one rigid front plane with shared clearance.
 * None of these internal choices changes the Material catalog XY contour.
 */
export declare const DEFAULT_SHAPE_PROFILES: Readonly<Record<MaterialShapeName, ShapeProfile>>;
/** Validate isolated overrides, filling only omitted legacy eyes from the registry. */
export declare function parseShapeProfiles(value: unknown, path?: string): ResolvedShapeProfiles;
/** Returns an immutable snapshot, never a mutable reference into a saved design. */
export declare function resolveShapeProfile(shape: MaterialShapeName, profiles?: ShapeProfiles): ShapeProfile;
export declare function sameShapeProfile(a: ShapeProfile, b: ShapeProfile): boolean;
/** Body volume, eye calibration and equipment use the same transition progress. */
export declare function interpolateShapeProfile(from: ShapeProfile, to: ShapeProfile, progress: number): ShapeProfile;
/**
 * Apply the displayed shape profile once to the global neutral eye baseline.
 * The existing renderer still owns scale, expression targets/weights and fitting.
 * Neither input is mutated, and the returned anchor is an independent copy.
 */
export declare function resolveShapeEyeGeometry(eyes: ShapeEyeGeometry, profile: ShapeProfile): ShapeEyeGeometry;
/** Internal calibrated position. Public designs contain no placement controls. */
export declare function accessoryMountProfile(accessory: Pick<ResolvedAccessoryDesign, 'preset'> & {
    slot?: AccessorySlot;
}, profile: ShapeProfile): CuratedAccessoryMount;
export declare function accessoryMountAnchor(accessory: Pick<ResolvedAccessoryDesign, 'preset'> & {
    slot?: AccessorySlot;
}, profile: ShapeProfile): Anchor;
