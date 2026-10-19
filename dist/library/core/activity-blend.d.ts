import type { Activity } from './design.js';
import type { ActivityFrame } from './motion.js';
/** Fade a pose/velocity correction to the running activity, preserving its phase. */
export declare class ActivityBlend {
    private activity;
    private time;
    private readonly duration;
    private source?;
    private offset;
    private slope;
    private elapsed;
    private current;
    private currentVelocity;
    private reduced;
    constructor(activity: Activity, time?: number, reduced?: boolean, duration?: number);
    get active(): boolean;
    set(activity: Activity, immediate?: boolean): void;
    advance(milliseconds: number): void;
    finish(): void;
    sample(time: number, reduced?: boolean): ActivityFrame;
}
