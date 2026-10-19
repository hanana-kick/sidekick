import type { AvatarPosition } from './movement.js';
export declare const POSITION_PLACEMENTS: readonly ["top-left", "top-center", "top-right", "center-left", "center", "center-right", "bottom-left", "bottom-center", "bottom-right"];
export type PositionPlacement = typeof POSITION_PLACEMENTS[number];
/** Viewport placements are inset. Element placements are outside the named edge/corner. */
export interface Positioning {
    target: 'viewport' | string | Element;
    placement?: PositionPlacement;
    gap?: number;
    offset?: {
        x?: number;
        y?: number;
    };
    /** Pursue layout changes with inertia. False samples once. Default true. */
    follow?: boolean;
}
export interface ResolvedPositioning extends Positioning {
    placement: PositionPlacement;
    gap: number;
    offset: {
        x: number;
        y: number;
    };
    follow: boolean;
}
export declare function validatePositioning(value: unknown, document: Document): ResolvedPositioning;
export declare function samePositioning(a: Positioning | null, b: Positioning | null): boolean;
export declare function copyPositioning(value: Positioning | null): Positioning | null;
/** Pure CSS-pixel geometry, shared by initial positioning, entrance and pursuit. */
export declare function positioningPoint(config: ResolvedPositioning, own: {
    width: number;
    height: number;
}, target: {
    left: number;
    top: number;
    width: number;
    height: number;
}, viewport: boolean): AvatarPosition;
export declare function resolvePositioning(avatar: HTMLElement, position: AvatarPosition, config: ResolvedPositioning): {
    position: AvatarPosition;
    target: Element | null;
};
