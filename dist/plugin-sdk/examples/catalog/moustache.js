// Original Sidekick character accessory port. See LICENSE for source/artwork terms.
import { defineAccessoryPlugin } from '@hanana-kick/sidekick-plugin-sdk';
import { createMoustacheGeometry } from './geometry.js';
import { moustacheAttachment } from './mounts.js';

export default defineAccessoryPlugin({
  apiVersion: 1,
  id: 'catalog/moustache',
  slots: ['mouth'],
  attachment: moustacheAttachment,
  createMesh: createMoustacheGeometry,
});
