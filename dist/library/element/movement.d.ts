import type { MotionOptions } from '../core/motion.js';
export type AvatarPlacement = 'inline' | 'viewport';
export type MovementBounds = 'viewport' | 'none';
export interface AvatarPosition {
    x: number;
    y: number;
}
export interface MoveOptions extends MotionOptions {
    travel?: 'natural' | 'none';
}
export interface MoveResult {
    finished: boolean;
    position: AvatarPosition;
}
export interface MovementState {
    phase: 'idle' | 'takeoff' | 'flight' | 'landing' | 'settling';
    /** Elapsed fraction of the requested duration; held at the interruption point while settling. */
    progress: number;
    position: AvatarPosition;
    /** Velocity of the constrained CSS position, in CSS pixels per second. */
    velocity: AvatarPosition;
}
export interface MovementPresentation {
    /** Unit screen-space heading (positive y is down), or [0, 0] while idle. */
    direction: [number, number];
    strength: number;
    /** Renderer-space lift, bounded to 0.06. */
    lift: number;
    /** Signed renderer bank, bounded to ±0.12 radians; negative leans right. */
    bank: number;
}
export interface MovementHost {
    now(): number;
    immediate(): boolean;
    constrain(point: AvatarPosition): AvatarPosition;
    render(point: AvatarPosition): void;
    complete(result: MoveResult): void | Promise<void>;
    progress?(state: MovementState): void;
    presentation?(presentation: MovementPresentation): void;
    requestFrame(callback: FrameRequestCallback): number;
    cancelFrame(id: number): void;
}
export declare function validatePosition(point: AvatarPosition): AvatarPosition;
/** Keep movement options as strict as pose-motion options, without passing travel to that validator. */
export declare function validateMoveOptions(options?: MoveOptions): Required<MoveOptions>;
/** DOM translation has a separate clock from the renderer and never resizes its surface. */
export declare class AvatarMovement {
    private readonly host;
    private point;
    private velocity;
    private phase;
    private progress;
    private presentation;
    private frame;
    private revision;
    private sampling;
    private reporting;
    private track?;
    constructor(host: MovementHost);
    get position(): AvatarPosition;
    get state(): MovementState;
    to(point: AvatarPosition, options?: MoveOptions): Promise<MoveResult>;
    by(delta: AvatarPosition, options?: MoveOptions): Promise<MoveResult>;
    /** Freeze travel, then lower the presentation gently. Lifecycle callers may request an immediate reset. */
    cancel(immediate?: boolean): void;
    /** Disconnect must not leave a detached element scheduling a presentation-only landing. */
    disconnect(): void;
    /** Clamp both current point and remaining target after viewport/element resizing, without restarting the clock. */
    resize(): void;
    /** Reduced motion snaps to the target; an already cancelled request remains cancelled. */
    finish(): void;
    private finishCurrent;
    private write;
    private report;
    private present;
    private reset;
    private stopFrame;
    private schedule;
    private complete;
    private result;
    /** A host may acknowledge an ordered worker render before completion becomes observable. */
    private notify;
    private travelFraction;
    private sample;
    private sampleTrack;
    private tick;
}
