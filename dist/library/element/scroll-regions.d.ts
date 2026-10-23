import type { SidekickAvatar } from './avatar.js';
import type { HorizontalAlignment, VerticalAlignment } from './element-target.js';
import type { MoveOptions } from './movement.js';
export interface ScrollRegion {
    id: string;
    region: Element;
    target?: Element;
    /** Viewport top-left CSS pixels, or an element whose matching edges are aligned. */
    waitAt?: {
        x: number;
        y: number;
    } | {
        element: Element;
        alignX?: HorizontalAlignment;
        alignY?: VerticalAlignment;
        x?: number;
        y?: number;
    };
}
export interface ActiveScrollRegion {
    id: string;
    region: Element;
    target: Element;
}
export interface ScrollRegionsOptions {
    regions: readonly ScrollRegion[];
    root?: Element;
    activationLine?: number;
    hysteresis?: number;
    movement?: MoveOptions;
    onChange?: (active: ActiveScrollRegion | null) => void;
}
export interface ScrollRegionsController {
    readonly activeRegion: string | null;
    readonly paused: boolean;
    pause(): void;
    resume(): void;
    refresh(): void;
    dispose(): void;
}
/** One owned anchor, retargeted without restarting its natural movement track. */
export declare function createScrollRegions(bot: SidekickAvatar, options: ScrollRegionsOptions): ScrollRegionsController;
