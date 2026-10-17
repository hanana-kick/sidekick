import type { MaterialShapeName } from './shapes.js';
export { MATERIAL_SHAPE_NAMES } from './shapes.js';
export type { MaterialShapeName } from './shapes.js';
import type { EyeState, EyeStateInputPatch } from './expressions.js';
export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type BodyShape = MaterialShapeName;
export type AccessoryPreset = 'beret' | 'halo' | 'crown' | 'glasses' | 'sunglasses' | 'moustache' | 'goatee' | 'bowTie' | 'scarf' | 'necklace' | 'earring' | 'starEarring';
export type AccessorySlot = 'head' | 'eyes' | 'mouth' | 'neck' | 'leftEar' | 'rightEar';
export type EarringSlot = Extract<AccessorySlot, 'leftEar' | 'rightEar'>;
export type SideAccessoryPreset = 'earring' | 'starEarring';
export type SingleSlotAccessoryPreset = Exclude<AccessoryPreset, SideAccessoryPreset>;
export interface AccessoryOptions {
    id?: string;
    slot?: AccessorySlot;
}
export interface EarringAccessoryOptions extends AccessoryOptions {
    slot: EarringSlot;
}
/** Flat color is the only public rendering style. Legacy runtime '3d' normalizes to flat. */
export type RenderStyle = 'flat';
export type Activity = 'idle' | 'thinking' | 'listening' | 'speaking' | 'celebrating' | 'still';
/** Public appearance is catalog selection and color only. Geometry is curated internally. */
export interface BodyDesign {
    shape: MaterialShapeName;
    color: string;
}
/** Eye appearance is one color; left/right weights are independent animation state. */
export interface EyeDesign {
    color: string;
    left: EyeState;
    right: EyeState;
}
/** IDs and exclusive slots identify equipment; transforms are never persisted. */
export interface AccessoryDesign {
    id: string;
    preset: AccessoryPreset;
    slot: AccessorySlot;
    color: string;
}
export interface AvatarDesign {
    version: 7;
    body: BodyDesign;
    eyes: EyeDesign;
    accessories: AccessoryDesign[];
}
export interface DesignPatch {
    body?: Partial<BodyDesign>;
    eyes?: {
        color?: string;
        left?: EyeStateInputPatch;
        right?: EyeStateInputPatch;
    };
    accessories?: AccessoryDesign[];
}
/** Alias of the complete, immutable Material shape catalog. */
export declare const BODY_SHAPES: readonly MaterialShapeName[];
export declare const ACCESSORY_PRESETS: readonly AccessoryPreset[];
/** Equipment slots are exclusive, regardless of an accessory's surface anchor. */
export declare const ACCESSORY_SLOTS: readonly AccessorySlot[];
/** Unambiguous preset defaults. Earrings deliberately have no default side. */
export declare const ACCESSORY_SLOT_BY_PRESET: Readonly<Record<SingleSlotAccessoryPreset, AccessorySlot>>;
/** All legal slots, including the two independently occupied earring sides. */
export declare const ACCESSORY_SLOTS_BY_PRESET: Readonly<Record<AccessoryPreset, readonly AccessorySlot[]>>;
export declare const ACCESSORY_LABELS: Readonly<Record<AccessoryPreset, string>>;
export declare const ACTIVITIES: readonly Activity[];
export declare function finite(value: unknown, min: number, max: number, path: string): number;
/** Migration is intentionally lossy: custom bodies become the nearest catalog outline. */
export interface DesignMigration {
    design: AvatarDesign;
    warnings: string[];
}
/** Validate old geometry before discarding it; canonical v7 never accepts calibration. */
export declare function migrateDesign(input: unknown): DesignMigration;
/** Parse canonical v7 or deterministically migrate saved v1–v6 documents. */
export declare function parseDesign(input: unknown): AvatarDesign;
/** Atomic patch of selections/colors and independent expression weights only. */
export declare function patchDesign(design: AvatarDesign, patch: DesignPatch): AvatarDesign;
export declare function createDesign(patch?: DesignPatch): AvatarDesign;
/** Fixed-slot presets infer their slot; an earring always names its side explicitly. */
export declare function createAccessory(preset: SideAccessoryPreset, options: EarringAccessoryOptions): AccessoryDesign;
export declare function createAccessory(preset: SingleSlotAccessoryPreset, idOrOptions?: string | AccessoryOptions): AccessoryDesign;
export declare function createAccessory<P extends AccessoryPreset>(preset: P, options: P extends SideAccessoryPreset ? EarringAccessoryOptions : AccessoryOptions & {
    slot: AccessorySlot;
}): AccessoryDesign;
/**
 * Returns an isolated design with accessory equipped, replacing its slot's occupant in place.
 * Vacant slots append; other slots retain their order and values. Neither input is mutated.
 * Invalid source designs, invalid accessories, and IDs already used in another slot reject.
 */
export declare function equipAccessory(design: AvatarDesign, accessory: AccessoryDesign): AvatarDesign;
/** Remove exactly one instance by ID, preserving every other slot and input. */
export declare function removeAccessory(design: AvatarDesign, id: string): AvatarDesign;
export declare function serializeDesign(design: AvatarDesign): string;
