import type { MaterialShapeName } from './shapes.js';

/** A rigid open circlet: select a support and move/rotate the whole crown.
 * Size is uniform, never per-axis scaling or a deformation of the metal shell.
 * Coordinates name a specific summit/lobe in canonical body XY. */
export type CrownSupport = readonly [x: number, y: number, tiltDegrees: number, scale: number];
export const CROWN_SUPPORTS: Readonly<Record<MaterialShapeName, CrownSupport>> = Object.freeze({
  circle: [0, 1, 0, 1.45],
  square: [-0.3, 1, -8, 1.3],
  slanted: [-0.37, 0.92, -10, 1.18],
  arch: [-0.12, 1, -7, 1.28],
  fan: [-0.68, 0.98, -19.5, 1.12],
  arrow: [0, .83, 0, 1.10],
  semiCircle: [-.10, .625, -8, 1.25],
  oval: [0.44, 0.97, 5, 1.18],
  pill: [0.1, 1, 0, 1.28],
  triangle: [0, .84, 0, 1.04],
  diamond: [0, .98, 0, 1.04],
  clamShell: [-.40, .67, -12, 1.20],
  pentagon: [-.10, .91, -12, 1.18],
  gem: [0, 1, -8, 1.23],
  verySunny: [0, .96, 0, 1.00],
  sunny: [0, 0.99, 1, 1.12],
  cookie4Sided: [.426, .876, 14, 1.10],
  cookie6Sided: [0, .95, -6, 1.14],
  cookie7Sided: [0, .95, -6, 1.14],
  cookie9Sided: [0.06, 0.97, 1, 1.1],
  cookie12Sided: [-0.18, 0.99, -9, 1.12],
  ghostish: [0, 1, 0, 1.45],
  clover4Leaf: [0.435, 0.944, 9, 1.12],
  clover8Leaf: [0.36, 0.926, 22, 1],
  burst: [-0.18, 1, -5, 0.98],
  softBurst: [0.12, 0.98, -4, 1.06],
  boom: [-0.09, 0.99, 0, 0.98],
  softBoom: [0.18, 1, 15, 1.05],
  flower: [0, 1, -4, 1.10],
  puffy: [0, .793, 0, 1.40],
  puffyDiamond: [0, 1, -4, 1.12],
  pixelCircle: [-0.3, 1, -18, 1.2],
  pixelTriangle: [-0.47, 0.9, 8, 1.18],
  bun: [-0.55, 1, -17, 1.22],
  heart: [.49, .837, 0, 1.28],
});
for (const support of Object.values(CROWN_SUPPORTS)) Object.freeze(support);
