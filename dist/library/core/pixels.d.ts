/** RGBA bytes in row order. Row orientation is preserved by the pure crop helper. */
export interface PixelBuffer {
    width: number;
    height: number;
    pixels: Uint8Array | Uint8ClampedArray;
}
export interface AlphaBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface SnapshotOptions {
    crop?: boolean;
    padding?: number;
}
export declare function validateSnapshotOptions(options?: SnapshotOptions): Required<SnapshotOptions>;
/** Include every nonzero-alpha pixel, including barely visible antialiased edges. */
export declare function alphaBounds(image: PixelBuffer): AlphaBounds | null;
/** Exact byte copy with transparent padding; an empty crop is transparent 1 × 1. */
export declare function cropPixels(image: PixelBuffer, options?: SnapshotOptions): PixelBuffer & {
    bounds: AlphaBounds | null;
};
