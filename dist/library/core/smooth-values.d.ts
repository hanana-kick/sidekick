/** Worker-owned critically damped channels. Retargeting preserves position and velocity. */
export declare class SmoothValues {
    private readonly omega;
    private readonly epsilon;
    readonly values: number[];
    private velocities;
    constructor(initial: readonly number[], omega?: number, epsilon?: number);
    moving(target: readonly number[]): boolean;
    set(target: readonly number[]): void;
    advance(target: readonly number[], dt: number): void;
}
