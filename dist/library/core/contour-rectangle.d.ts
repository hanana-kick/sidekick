import type { ShapeContour } from './contours.js';
/**
 * Whether a closed, axis-aligned rectangle is inside the current simplified
 * contour and at least `margin` from every boundary segment, in Euclidean XY.
 * `bottom` and `top` are offsets from `centerY`; all dimensions and the margin
 * are in the same normalized coordinates as contourDistanceOutline. Boundary
 * contact is allowed at zero margin. Invalid/non-finite bounds return false.
 *
 * Unlike perimeter sampling, this catches long crossing edges, narrow concave
 * notches, and minima between samples. One inside query plus segment/box tests
 * is sufficient: a connected rectangle cannot leave the interior without
 * crossing its boundary. No extra approximation or fitting tolerance is used.
 */
export declare function containsRectangleWithMargin(contour: ShapeContour, centerX: number, centerY: number, halfWidth: number, bottom: number, top: number, margin: number): boolean;
