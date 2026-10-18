/** Orthographic magnification; independent of body direction. */
export declare const ZOOM_RANGE: Readonly<{
    min: 0.5;
    max: 3;
    default: 1;
}>;
export declare function createZoom(value?: number): number;
/** Normalize wheel units to CSS pixels; page deltas use the preview height. */
export declare function wheelZoom(zoom: number, deltaY: number, deltaMode?: number, pageHeight?: number): number;
/** Distance-only pinch scale. The centroid never changes camera translation. */
export declare function pinchZoom(zoom: number, previousDistance: number, distance: number): number;
