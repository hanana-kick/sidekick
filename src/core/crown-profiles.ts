import type { MaterialShapeName } from './shapes.js';

/** A rigid open circlet: select a support and move/rotate the whole crown.
 * Size is uniform, never per-axis scaling or a deformation of the metal shell.
 * Coordinates name a specific summit/lobe in canonical body XY. */
export type CrownSupport = readonly [x: number, y: number, tiltDegrees: number, scale: number, yawDegrees?: number];
export const CROWN_SUPPORTS: Readonly<Record<MaterialShapeName, CrownSupport>> = Object.freeze({
  circle: [0, 1, 0, 1.45],
  square: [-0.3, 1, -8, 1.3],
  slanted: [-0.37, 0.92, -10, 1.18],
  arch: [-0.12, 1, -7, 1.28],
  fan: [-0.68, 0.98, -19.5, 1.12],
  arrow: [0, 0.83, 0, 1.01, 90],
  semiCircle: [-.10, .625, -8, 1.25],
  oval: [0.44, 0.97, 8, 1.18],
  pill: [0.1, 1, 0, 1.28],
  triangle: [0, 0.84, 0, 0.95, -90],
  diamond: [0, 0.98, 0, 0.95, -90],
  clamShell: [-.40, .67, -12, 1.20],
  pentagon: [-0.24, 0.91, -18, 1.18],
  gem: [-0.16, 1, -14, 1.11],
  verySunny: [0, .96, 0, 1.00],
  sunny: [0, 0.99, 1, 1.12],
  cookie4Sided: [0.386, 0.876, 5, 1.1],
  cookie6Sided: [-0.16, 0.95, -12, 1.14],
  cookie7Sided: [-0.08, 0.95, -6, 1.05],
  cookie9Sided: [0.02, 0.97, 1, 1.01],
  cookie12Sided: [-0.18, 0.99, -9, 1.12],
  ghostish: [0, 1, 0, 1.45],
  clover4Leaf: [0.435, 0.944, 9, 1.12],
  clover8Leaf: [0.36, 0.926, 22, 1],
  burst: [-0.18, 1, -5, 0.98],
  softBurst: [0.12, 0.98, -4, 1.06],
  boom: [0.32, 0.99, 35, 0.95, 90],
  softBoom: [0.18, 1, 15, 1.05],
  flower: [-0.08, 1, -13, 1.04, 90],
  puffy: [0, 0.793, 0, 1.43, 90],
  puffyDiamond: [0, 1, -1, 1.03, -90],
  pixelCircle: [-0.34, 1, -18, 1.11],
  pixelTriangle: [-0.35, 0.9, 8, 1.12],
  bun: [-0.55, 1, -17, 1.22],
  heart: [0.49, 0.837, -6, 1.28, -90],
});
for (const support of Object.values(CROWN_SUPPORTS)) Object.freeze(support);
