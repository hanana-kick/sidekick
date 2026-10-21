/**
 * Mirrored original Sidekick earrings, including author-owned 35-shape fits.
 * Copyright (c) 2026 the respective Sidekick authors and rights holders.
 * Sidekick Library and Character License 1.0. See LICENSE in this directory.
 */
import { defineAccessoryPlugin, definePartAnimation } from '@hanana-kick/sidekick-plugin-sdk';
import { createEarringGeometry } from './earring-geometry.js';

// [left perimeter phase, right perimeter phase, scale]. This is independent
// author calibration data, not a link into built-in accessory profiles.
const earFits = {
  circle: [-.2, -.2, 1], square: [-.3, -.3, 1],
  slanted: [-.5, -.2, .95], arch: [.2, .2, 1],
  fan: [-.3, -.3, .90], arrow: [-.3, -.3, .85],
  semiCircle: [-.3, -.3, .86], oval: [-.4, -.3, .90],
  pill: [-.1, -.2, .94], triangle: [-.4, -.4, .90],
  diamond: [-.2, -.2, .90], clamShell: [-.2, -.2, .88],
  pentagon: [-.1, -.1, .96], gem: [-.3, -.3, .96],
  verySunny: [-.2, -.2, .88], sunny: [-.2, -.2, .94],
  cookie4Sided: [.1, .1, .92], cookie6Sided: [-.3, -.3, .96],
  cookie7Sided: [-.2, -.2, .94], cookie9Sided: [-.2, -.2, .94],
  cookie12Sided: [-.2, -.2, .96], ghostish: [-.2, -.2, .96],
  clover4Leaf: [.1, .1, .88], clover8Leaf: [-.3, -.3, .94],
  burst: [-.2, -.2, .84], softBurst: [-.3, -.3, .90],
  boom: [-.2, -.2, .76], softBoom: [0, 0, .82],
  flower: [-.2, -.2, .90], puffy: [-.2, -.2, .94],
  puffyDiamond: [-.2, -.2, .90], pixelCircle: [-.3, -.3, .96],
  pixelTriangle: [-.3, -.2, .82], bun: [.2, .2, .90],
  heart: [-.5, -.5, .92],
};
function earring(side) {
  const left = side === -1;
  return defineAccessoryPlugin({
    apiVersion: 1,
    id: left ? 'catalog/earring-left' : 'catalog/earring-right',
    slots: [left ? 'leftEar' : 'rightEar'],
    attachment: {
      mode: 'perimeter-front', region: left ? 'left' : 'right',
      perimeterInset: .96, containmentClearance: .006, clearance: .002, follow: .35,
      mounts: Object.fromEntries(Object.entries(earFits).map(([shape, fit]) => [shape, {
        uv: [0, fit[left ? 0 : 1]], offset: 0, rotation: [0, left ? Math.PI / 2 : -Math.PI / 2, 0], scale: fit[2],
      }])),
    },
    createMesh() { return createEarringGeometry(side); },
  });
}

export const leftEarring = earring(-1);
export const rightEarring = earring(1);
export default leftEarring;

// Equipped instance IDs, not plugin IDs. Translation/scale intentionally apply
// after seating in the public slot frame, just as for the original accessories.
export const earringAnimation = definePartAnimation({
  duration: 2, loop: true,
  tracks: [
    { target: { accessory: 'plugin-earring-left' }, channel: 'rotation', interpolation: 'smooth',
      keyframes: [{ time: 0, value: [0, 0, -.12] }, { time: 1, value: [0, 0, .12] }, { time: 2, value: [0, 0, -.12] }] },
    { target: { accessory: 'plugin-earring-left' }, channel: 'position', interpolation: 'smooth',
      keyframes: [{ time: 0, value: [0, 0, 0] }, { time: 1, value: [.008, .008, .004] }, { time: 2, value: [0, 0, 0] }] },
    { target: { accessory: 'plugin-earring-right' }, channel: 'rotation', interpolation: 'smooth',
      keyframes: [{ time: 0, value: [0, 0, .12] }, { time: 1, value: [0, 0, -.12] }, { time: 2, value: [0, 0, .12] }] },
    { target: { accessory: 'plugin-earring-right' }, channel: 'scale', interpolation: 'smooth',
      keyframes: [{ time: 0, value: [1, 1, 1] }, { time: 1, value: [1.04, .97, 1] }, { time: 2, value: [1, 1, 1] }] },
  ],
});
