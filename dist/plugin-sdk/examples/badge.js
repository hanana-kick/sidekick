import { defineAccessoryPlugin, defineAccessoryGeometry, definePartAnimation } from '@hanana-kick/sidekick-plugin-sdk';

export default defineAccessoryPlugin({
  apiVersion: 1,
  id: 'starter/badge',
  slots: ['mouth'],
  createMesh() {
    // Attachment-local coordinates: +X tangent, +Y bitangent, +Z outward.
    return defineAccessoryGeometry({
      vertices: new Float32Array([
        -.12, -.08, .015, 0, 0, 1, .12, -.08, .015, 0, 0, 1,
        .12, .08, .015, 0, 0, 1, -.12, .08, .015, 0, 0, 1,
      ]),
      indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
    });
  },
});

export const badgeAnimation = definePartAnimation({
  duration: 2, loop: true,
  tracks: [{ target: { accessory: 'starter-badge' }, channel: 'rotation',
    keyframes: [{ time: 0, value: [0, 0, -.15] }, { time: 1, value: [0, 0, .15] }, { time: 2, value: [0, 0, -.15] }] }],
});
