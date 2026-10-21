import type { ShapeContour } from './contours.js';
import type { MotionOptions, MotionResult } from './motion.js';
import type { MaterialShapeName } from './shapes.js';
import type { ShapeProfile } from './shape-profiles.js';
import type { ShapeWeights } from './plugin-attachment.js';
export type ShapeMotionOptions = MotionOptions;
export type ShapeMotionResult = MotionResult;
export type { ShapeWeights } from './plugin-attachment.js';
export interface ShapeSnapshot {
    readonly contour: ShapeContour;
    readonly profile: ShapeProfile;
    readonly shapeWeights: ShapeWeights;
}
/** Validate before applying accessibility overrides, including immediate/no-op requests. */
export declare function validateShapeMotionOptions(options?: ShapeMotionOptions): Required<ShapeMotionOptions>;
/**
 * A runtime contour/depth/eyes/mount snapshot is separate from the serializable catalog target. Interruptions
 * match from the exact visible snapshot, so no nested recipe or old endpoint leaks
 * into the next transition. All public snapshots are immutable.
 */
export declare class ShapeTimeline {
    private current;
    private destinationProfile;
    private targetShape;
    private atTarget;
    private transition?;
    constructor(shape?: MaterialShapeName);
    get active(): boolean;
    get contour(): ShapeContour;
    get profile(): ShapeProfile;
    get snapshot(): ShapeSnapshot;
    get targetProfile(): ShapeProfile;
    get remainingDuration(): number;
    get easing(): NonNullable<ShapeMotionOptions['easing']>;
    get target(): MaterialShapeName;
    /** Immediately replace a design baseline; settle any superseded request. */
    set(shape: MaterialShapeName): void;
    to(shape: MaterialShapeName, options?: ShapeMotionOptions): Promise<ShapeMotionResult>;
    advance(ms: number): void;
    /** Accessibility/paused changes complete the persisted target immediately. */
    finish(): void;
    /** Canceling freezes the visible contour and full profile; set() replaces both. */
    cancel(): void;
}
