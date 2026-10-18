import type { MaterialShapeName } from './shapes.js';
/** A rigid open circlet: select a support and move/rotate the whole crown.
 * Size is uniform, never per-axis scaling or a deformation of the metal shell.
 * Coordinates name a specific summit/lobe in canonical body XY. */
export type CrownSupport = readonly [x: number, y: number, tiltDegrees: number, scale: number, yawDegrees?: number];
export declare const CROWN_SUPPORTS: Readonly<Record<MaterialShapeName, CrownSupport>>;
