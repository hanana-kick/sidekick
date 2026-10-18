import { finite } from './design.js';
import { clamp } from './math.js';
/** Orthographic magnification; independent of body direction. */
export const ZOOM_RANGE = Object.freeze({ min: 0.5, max: 3, default: 1 });
export function createZoom(value: number = 1): number { return finite(value, ZOOM_RANGE.min, ZOOM_RANGE.max, 'zoom'); }

/** Normalize wheel units to CSS pixels; page deltas use the preview height. */
export function wheelZoom(zoom: number, deltaY: number, deltaMode = 0, pageHeight = 200): number {
  if (!Number.isFinite(deltaY)) return zoom;
  const pixels = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? Math.max(1, pageHeight) : 1);
  return clamp(zoom * Math.exp(clamp(-pixels * .002, -20, 20)), ZOOM_RANGE.min, ZOOM_RANGE.max);
}

/** Distance-only pinch scale. The centroid never changes camera translation. */
export function pinchZoom(zoom: number, previousDistance: number, distance: number): number {
  if (!Number.isFinite(distance) || !Number.isFinite(previousDistance) || previousDistance <= 0 || distance <= 0) return zoom;
  return clamp(zoom * distance / previousDistance, ZOOM_RANGE.min, ZOOM_RANGE.max);
}
