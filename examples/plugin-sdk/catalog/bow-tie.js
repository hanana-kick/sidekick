// Original Sidekick character accessory port. See LICENSE for source/artwork terms.
import { defineAccessoryPlugin } from '@hanana-kick/sidekick-plugin-sdk';
import { createBowTieGeometry } from './geometry.js';
import { bowTieAttachment } from './mounts.js';

export default defineAccessoryPlugin({
  apiVersion: 1,
  id: 'catalog/bow-tie',
  slots: ['neck'],
  attachment: bowTieAttachment,
  createMesh: createBowTieGeometry,
});
