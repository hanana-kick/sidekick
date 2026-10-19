import type { AccessoryDesign } from './design.js';
export interface AccessoryPresentation<T> {
    accessory: T;
    opacity: number;
}
/** One visible mesh per slot. Replacement is made only at zero coverage. */
export declare class AccessoryTransition<T extends AccessoryDesign> {
    private slots;
    private initialized;
    get active(): boolean;
    /** Includes outgoing and requested mounts for conservative framing. */
    get envelope(): T[];
    sample(target: readonly T[], delta: number, instant?: boolean): AccessoryPresentation<T>[];
}
