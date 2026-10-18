import type { Activity } from './design.js';
import type { ActivityFrame } from './motion.js';
/** Crossfade only the established activity transform layer; geometry stays untouched. */
export declare class ActivityBlend {
    private activity;
    private readonly duration;
    private source?;
    private elapsed;
    private current;
    constructor(activity: Activity, time?: number, reduced?: boolean, duration?: number);
    get active(): boolean;
    set(activity: Activity, immediate?: boolean): void;
    advance(milliseconds: number): void;
    finish(): void;
    sample(time: number, reduced?: boolean): ActivityFrame;
}
