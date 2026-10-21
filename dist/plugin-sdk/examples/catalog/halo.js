/**
 * Original Sidekick halo, ported to an external plugin author.
 * Copyright (c) 2026 the respective Sidekick authors and rights holders.
 * Sidekick Library and Character License 1.0. See LICENSE.
 */
import { defineAccessoryGeometry, defineAccessoryPlugin } from '@hanana-kick/sidekick-plugin-sdk';

// Author-owned crown clearance, in model units. Split crowns use the current
// top envelope, not a sampled lobe or the eventual morph destination.
const heights = {
  circle: .22, square: .22, slanted: .22, arch: .22, fan: .22,
  arrow: .22, semiCircle: .22, oval: .22, pill: .22, triangle: .22,
  diamond: .22, clamShell: .22, pentagon: .22, gem: .22, verySunny: .24,
  sunny: .22, cookie4Sided: .22, cookie6Sided: .22, cookie7Sided: .22,
  cookie9Sided: .22, cookie12Sided: .22, ghostish: .22, clover4Leaf: .22,
  clover8Leaf: .22, burst: .24, softBurst: .22, boom: .24, softBoom: .24,
  flower: .22, puffy: .22, puffyDiamond: .22, pixelCircle: .22,
  pixelTriangle: .22, bun: .22, heart: .22,
};

export const haloAttachment = {
  mode: 'crown-envelope', geometryScale: .34,
  follow: .5, followAxis: 'y', followSign: -1,
  mounts: Object.fromEntries(Object.entries(heights).map(([shape, offset]) => [shape, {
    uv: [0, 0], offset, rotation: [0, 0, 0], scale: 1,
  }])),
};

/** Retain the original 48-segment, 10-side torus and its unscaled vertex buffer. */
export function createHaloGeometry() {
  const vertices = [], indices = [], segments = 48, sides = 10, tube = .055, arc = Math.PI * 2;
  for (let i = 0; i <= segments; i++) for (let j = 0; j <= sides; j++) {
    const a = i / segments * arc, b = j / sides * Math.PI * 2;
    const normal = [Math.cos(a) * Math.cos(b), Math.sin(a) * Math.cos(b), Math.sin(b)];
    vertices.push(Math.cos(a) + tube * normal[0], Math.sin(a) + tube * normal[1], tube * normal[2], ...normal);
  }
  for (let i = 0; i < segments; i++) for (let j = 0; j < sides; j++) {
    const a = i * (sides + 1) + j, b = a + sides + 1;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  return defineAccessoryGeometry({ vertices: new Float32Array(vertices), indices: new Uint16Array(indices) });
}

export default defineAccessoryPlugin({
  apiVersion: 1, id: 'catalog/halo', slots: ['head'],
  attachment: haloAttachment, createMesh: createHaloGeometry,
});
