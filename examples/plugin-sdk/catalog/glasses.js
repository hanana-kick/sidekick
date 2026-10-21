/** Original circular rims and bridge, authored as reusable affine measurements.
 * Sidekick Library and Character License 1.0. See LICENSE.
 */
import { defineAccessoryPlugin, defineAccessoryGeometry, createPairedAffineDeformation } from '@hanana-kick/sidekick-plugin-sdk';

const shapes = ['circle','square','slanted','arch','fan','arrow','semiCircle','oval','pill','triangle','diamond','clamShell','pentagon','gem','verySunny','sunny','cookie4Sided','cookie6Sided','cookie7Sided','cookie9Sided','cookie12Sided','ghostish','clover4Leaf','clover8Leaf','burst','softBurst','boom','softBoom','flower','puffy','puffyDiamond','pixelCircle','pixelTriangle','bun','heart'];
const mounts = Object.fromEntries(shapes.map(shape => [shape, { uv: [0, .1], offset: 0, rotation: [0, 0, 0], scale: shape === 'pixelTriangle' ? .86 : 1 }]));

export function createGlassesGeometry() {
  const authored = [], indices = [];
  const ringSegments = 64, tubeSides = 8, bridgeSegments = 24;
  function strip(base, segments, reverse = false) {
    for (let i = 0; i < segments; i++) for (let j = 0; j < tubeSides; j++) {
      const a = base + i * (tubeSides + 1) + j, b = a + tubeSides + 1;
      if (reverse) indices.push(a, a + 1, b, b, a + 1, b + 1);
      else indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  for (const eyeBlend of [0, 1]) {
    const base = authored.length;
    for (let i = 0; i <= ringSegments; i++) {
      const angle = i / ringSegments * Math.PI * 2, c = Math.cos(angle), s = Math.sin(angle);
      for (let j = 0; j <= tubeSides; j++) {
        const tubeAngle = j / tubeSides * Math.PI * 2;
        authored.push({ eyeBlend, coefficients: { radius: [c, s, 0], tube: [c * Math.cos(tubeAngle), s * Math.cos(tubeAngle), Math.sin(tubeAngle)] } });
      }
    }
    strip(base, ringSegments);
  }
  const bridge = authored.length;
  for (let i = 0; i <= bridgeSegments; i++) {
    const t = i / bridgeSegments;
    for (let j = 0; j <= tubeSides; j++) {
      const angle = j / tubeSides * Math.PI * 2;
      authored.push({ eyeBlend: t, coefficients: { radius: [1 - 2 * t, 0, 0], tube: [0, Math.cos(angle), Math.sin(angle)] } });
    }
  }
  strip(bridge, bridgeSegments, true);
  // A valid neutral preview mesh accompanies the typed measurement recipe.
  // Runtime uses current face-following, gaze-independent eye measurements.
  const vertices = new Float32Array(authored.length * 6);
  authored.forEach((vertex, i) => {
    const { radius, tube } = vertex.coefficients;
    vertices.set([-.15 + .3 * vertex.eyeBlend + radius[0] * .1 + tube[0] * .01, radius[1] * .1 + tube[1] * .01, radius[2] * .1 + tube[2] * .01], i * 6);
  });
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 6, b = indices[i + 1] * 6, c = indices[i + 2] * 6;
    const u = [vertices[b] - vertices[a], vertices[b + 1] - vertices[a + 1], vertices[b + 2] - vertices[a + 2]];
    const v = [vertices[c] - vertices[a], vertices[c + 1] - vertices[a + 1], vertices[c + 2] - vertices[a + 2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (const at of [a, b, c]) for (let k = 0; k < 3; k++) vertices[at + 3 + k] += n[k];
  }
  for (let i = 0; i < vertices.length; i += 6) {
    const length = Math.hypot(vertices[i + 3], vertices[i + 4], vertices[i + 5]);
    if (!length) vertices[i + 5] = 1;
    else for (let k = 3; k < 6; k++) vertices[i + k] /= length;
  }
  const deformation = createPairedAffineDeformation({
    channels: { radius: { combine: 'max', factors: [1.28, .64] }, tube: { combine: 'min', factors: [.0845, .0845] } },
    vertices: authored,
  });
  return defineAccessoryGeometry({ vertices, indices: new Uint16Array(indices), deformation, normalPrecision: 'float32' });
}

export default defineAccessoryPlugin({
  apiVersion: 1, id: 'catalog/glasses', slots: ['eyes'],
  attachment: { mode: 'eye-plane', mounts, referenceUv: [0, .1], clearance: .009, follow: 0 },
  createMesh: createGlassesGeometry,
});
