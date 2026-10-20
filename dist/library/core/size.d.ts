/** Nominal square companion footprint in CSS pixels, independent of zoom. */
export declare const SIZE_RANGE: Readonly<{
    min: 1;
    max: 2048;
    default: 200;
}>;
export declare function validateSize(value: unknown): number;
