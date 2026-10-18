import type { MaterialShapeName } from './shapes.js';

/** A rigid open circlet: select a support and move/rotate the whole crown.
 * Size is uniform, never per-axis scaling or a deformation of the metal shell.
 * Coordinates name a specific summit/lobe in canonical body XY. */
export type CrownSupport = readonly [x: number, y: number, tiltDegrees: number, scale: number];
export const CROWN_SUPPORTS: Readonly<Record<MaterialShapeName, CrownSupport>> = Object.freeze({
  circle: [0, 1, 0, 1.45],
  square: [-.12, 1, -8, 1.30],
  slanted: [-.31, .92, 10, 1.18],
  arch: [0, 1, -7, 1.28],
  fan: [-.62, .98, -17, 1.12],
  arrow: [0, .83, 0, 1.10],
  semiCircle: [-.10, .625, -8, 1.25],
  oval: [.32, .97, -15, 1.18],
  pill: [.10, 1, -10, 1.28],
  triangle: [0, .84, 0, 1.04],
  diamond: [0, .98, 0, 1.04],
  clamShell: [-.40, .67, -12, 1.20],
  pentagon: [-.10, .91, -12, 1.18],
  gem: [0, 1, -8, 1.23],
  verySunny: [0, .96, 0, 1.00],
  sunny: [0, .99, -4, 1.12],
  cookie4Sided: [.426, .876, 14, 1.10],
  cookie6Sided: [0, .95, -6, 1.14],
  cookie7Sided: [0, .95, -6, 1.14],
  cookie9Sided: [0, .97, -4, 1.10],
  cookie12Sided: [0, .99, -4, 1.12],
  ghostish: [0, 1, 0, 1.45],
  clover4Leaf: [.375, .944, 14, 1.12],
  clover8Leaf: [.36, .926, 12, 1.00],
  burst: [0, 1, 0, .98],
  softBurst: [0, .98, -4, 1.06],
  boom: [0, .99, 0, .98],
  softBoom: [0, 1, 0, 1.05],
  flower: [0, 1, -4, 1.10],
  puffy: [0, .793, 0, 1.40],
  puffyDiamond: [0, 1, -4, 1.12],
  pixelCircle: [-.12, 1, -8, 1.20],
  pixelTriangle: [-.50, .90, 18, 1.18],
  bun: [-.37, 1, -12, 1.22],
  heart: [.49, .837, 0, 1.28],
});
for (const support of Object.values(CROWN_SUPPORTS)) Object.freeze(support);
