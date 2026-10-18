import type { MotionOptions } from '../core/motion.js';
export type AvatarPlacement = 'inline' | 'viewport';
export type MovementBounds = 'viewport' | 'none';
export interface AvatarPosition {
    x: number;
    y: number;
}
export interface MoveResult {
    finished: boolean;
    position: AvatarPosition;
}
export interface MovementHost {
    now(): number;
    immediate(): boolean;
    constrain(point: AvatarPosition): AvatarPosition;
    render(point: AvatarPosition): void;
    complete(result: MoveResult): void;
    requestFrame(callback: FrameRequestCallback): number;
    cancelFrame(id: number): void;
}
export declare function validatePosition(point: AvatarPosition): AvatarPosition;
/** DOM translation has a separate clock from the renderer and never resizes its surface. */
export declare class AvatarMovement {
    private readonly host;
    private point;
    private frame;
    private track?;
    constructor(host: MovementHost);
    get position(): AvatarPosition;
    to(point: AvatarPosition, options?: MotionOptions): Promise<MoveResult>;
    by(delta: AvatarPosition, options?: MotionOptions): Promise<MoveResult>;
    cancel(): void;
    /** Clamp both current point and remaining target after viewport/element resizing. */
    resize(): void;
    finish(): void;
    private write;
    private settle;
    private sample;
    private tick;
}
