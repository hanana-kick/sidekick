import type { AvatarPosition, MoveOptions } from './movement.js';
export type HorizontalAlignment = 'left' | 'center' | 'right';
export type VerticalAlignment = 'top' | 'center' | 'bottom';
/** Align matching points of the target and avatar border-boxes, then add CSS-pixel offsets. */
export interface MoveToElementOptions extends MoveOptions {
    /** Keep the matching border-box anchors aligned after arrival. Default false. */
    anchor?: boolean;
    x?: number;
    y?: number;
    alignX?: HorizontalAlignment;
    alignY?: VerticalAlignment;
}
/** Read layout once. No observers or persistent reference to the target are retained. */
export declare function resolveElementTarget(avatar: HTMLElement, position: AvatarPosition, target: Element, options?: MoveToElementOptions): {
    position: AvatarPosition;
    options: MoveOptions;
};
