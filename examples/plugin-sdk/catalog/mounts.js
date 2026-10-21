/**
 * Plugin-owned shape calibration, authored from the original catalog fit.
 * Copyright (c) 2026 the respective Sidekick authors and rights holders.
 * Sidekick Library and Character License 1.0. See LICENSE.
 *
 * These are data, not references to built-in presets. Each plugin carries all
 * 35 fits through the registry/worker boundary. UV values, not canonical Y,
 * interpolate during a morph, including when a morph is interrupted.
 */

// [mouth Y, neck Y, scale, mouth tilt, neck tilt], in model units/radians.
const fits = {
  circle: [-.30, -.69, 1, .26, .76], square: [-.30, -.72, 1, .23, .73],
  slanted: [-.30, -.65, .95, .24, .70], arch: [-.34, -.72, 1, .27, .73],
  fan: [-.32, -.68, .92, .23, .64], arrow: [-.32, -.53, .78, .38, .89],
  semiCircle: [-.27, -.49, .82, .40, 1.03], oval: [-.29, -.66, .85, .28, .82],
  pill: [-.30, -.68, .94, .26, .75], triangle: [-.44, -.69, .82, .42, .85],
  diamond: [-.33, -.69, .86, .26, .59], clamShell: [-.27, -.53, .85, .37, 1.02],
  pentagon: [-.33, -.67, .94, .28, .76], gem: [-.31, -.70, .96, .23, .67],
  verySunny: [-.29, -.65, .84, .19, .43], sunny: [-.31, -.68, .92, .21, .53],
  cookie4Sided: [-.29, -.60, .86, .30, .90], cookie6Sided: [-.30, -.68, .96, .22, .67],
  cookie7Sided: [-.30, -.65, .94, .24, .76], cookie9Sided: [-.30, -.68, .96, .21, .72],
  cookie12Sided: [-.30, -.69, .98, .20, .56], ghostish: [-.29, -.61, .92, .36, 1.09],
  clover4Leaf: [-.30, -.62, .84, .33, .92], clover8Leaf: [-.30, -.65, .92, .25, .79],
  burst: [-.29, -.61, .78, .21, .45], softBurst: [-.30, -.65, .86, .23, .51],
  boom: [-.24, -.42, .60, .46, 1.21], softBoom: [-.33, -.61, .68, .70, .25],
  flower: [-.30, -.63, .84, .34, .52], puffy: [-.26, -.56, .88, .50, 1.23],
  puffyDiamond: [-.31, -.65, .82, .39, .50], pixelCircle: [-.30, -.71, .98, .19, .63],
  pixelTriangle: [-.31, -.53, .68, .55, .76], bun: [-.32, -.70, .82, .25, .76],
  heart: [-.36, -.65, .82, .47, .82],
};
// Raised bow-tie junctions bridge lower notches instead of falling into them.
const bowTieOverrides = {
  oval: [-.52, .85, .50], cookie4Sided: [-.54, .86, .70],
  ghostish: [-.53, .92, .80], clover4Leaf: [-.52, .84, .60], clover8Leaf: [-.55, .92, .50],
  boom: [-.38, .48, 1.00], puffy: [-.48, .80, .80],
};
const front = (y, scale, tilt) => ({ uv: [0, Math.atan(y) / .9], offset: 0, rotation: [tilt, 0, 0], scale });

export const moustacheAttachment = {
  mode: 'contained-front', clearance: .002, follow: 0,
  mounts: Object.fromEntries(Object.entries(fits).map(([shape, [mouthY, , size, mouthTilt]]) => [shape, front(mouthY, size, mouthTilt)])),
};
export const bowTieAttachment = {
  mode: 'contained-front', clearance: .002, follow: .15,
  mounts: Object.fromEntries(Object.entries(fits).map(([shape, [, neckY, size, , neckTilt]]) => [shape, front(...(bowTieOverrides[shape] ?? [neckY, size, neckTilt]))])),
};
