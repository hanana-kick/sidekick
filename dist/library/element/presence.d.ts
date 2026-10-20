import type { AvatarPosition, MoveOptions, MoveResult } from './movement.js';
export type PresenceEdge = 'left' | 'right' | 'top' | 'bottom';
export type PresenceState = 'visible' | 'hidden' | 'entering' | 'exiting';
export interface EnterOptions extends MoveOptions {
    from?: PresenceEdge;
}
export interface ExitOptions extends MoveOptions {
    to?: PresenceEdge;
}
export interface PresenceResult extends MoveResult {
    presence: PresenceState;
}
export interface PresenceGeometry {
    width: number;
    height: number;
    viewportWidth: number;
    viewportHeight: number;
    offsetX: number;
    offsetY: number;
}
export interface PresenceHost {
    assertViewport(): void;
    position(): AvatarPosition;
    geometry(): PresenceGeometry;
    constrain(point: AvatarPosition): AvatarPosition;
    move(point: AvatarPosition, options: MoveOptions): Promise<MoveResult>;
    stage(point: AvatarPosition): void;
    visibility(hidden: boolean): void;
    complete(kind: 'enter' | 'exit', result: PresenceResult): void;
}
export declare function validatePresenceOptions(value: EnterOptions | ExitOptions, key: 'from' | 'to'): {
    edge: PresenceEdge;
    motion: MoveOptions;
};
/** Coordinates are layout-viewport CSS pixels, just like viewport moveTo. */
export declare function outsidePosition(edge: PresenceEdge, point: AvatarPosition, box: PresenceGeometry): AvatarPosition;
/** Owns presence, not appearance/activity settings. Physical integration stays in AvatarMovement. */
export declare class AvatarPresence {
    private readonly host;
    private revision;
    private recovery;
    private state;
    private operation?;
    get current(): PresenceState;
    get destination(): AvatarPosition | undefined;
    /** Visibility-only declarations retain their layout position. */
    setVisible(visible: boolean): void;
    get bypassBounds(): boolean;
    constructor(host: PresenceHost);
    enter(point: AvatarPosition, input?: EnterOptions, start?: AvatarPosition, continueFlight?: boolean): Promise<PresenceResult>;
    exit(input?: ExitOptions): Promise<PresenceResult>;
    /** Superseding normal moves reveal the bot without restarting its activity or resetting momentum. */
    reveal(): number;
    owns(revision: number): boolean;
    recovered(revision: number): void;
    interrupt(): number;
    cancel(): void;
    retarget(point: AvatarPosition): void;
    resize(): void;
    private run;
    private finish;
}
