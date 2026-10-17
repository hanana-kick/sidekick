/** Internal renderer descriptors. Never exported by the package's public entry points. */
import type { AccessoryDesign, AvatarDesign, BodyDesign, Vec2, Vec3 } from './design.js';
import type { EyeState } from './expressions.js';
export type Region = 'face' | 'crown' | 'left' | 'right';
export interface Anchor {
    region: Region;
    uv: Vec2;
    offset: number;
}
export interface EyeShapeTargets {
    smile: {
        radius: number;
        thickness: number;
    };
    blink: {
        thickness: number;
    };
}
export interface ResolvedEyeState extends EyeState {
    targets: EyeShapeTargets;
}
export interface ResolvedEyeDesign {
    shape: 'capsule';
    width: number;
    height: number;
    left: ResolvedEyeState;
    right: ResolvedEyeState;
    anchor: Anchor;
    spacing: number;
    scale: number;
    color: string;
}
export interface ResolvedAccessoryDesign extends AccessoryDesign {
    anchor: Anchor;
    scale: number;
    rotation: Vec3;
    follow: number;
}
export interface ResolvedAvatarDesign {
    version: 7;
    body: BodyDesign;
    eyes: ResolvedEyeDesign;
    accessories: ResolvedAccessoryDesign[];
}
/** New descriptors on every resolution; caller-owned designs never gain hidden geometry. */
export declare function resolveDesign(design: AvatarDesign): ResolvedAvatarDesign;
