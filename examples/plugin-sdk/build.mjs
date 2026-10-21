// Validate once and emit a standalone ESM asset with no SDK/runtime dependency.
import { mkdir, writeFile } from 'node:fs/promises';
import plugin, { badgeAnimation } from './badge.js';
import { validateAccessoryPluginGeometry, validatePartAnimation } from '@hanana-kick/sidekick-plugin-sdk';
const mesh = validateAccessoryPluginGeometry(await plugin.createMesh());
const clip = validatePartAnimation(badgeAnimation);
const output = new URL('./generated/', import.meta.url);
await mkdir(output, { recursive: true });
await writeFile(new URL('badge.js', output), `export default {apiVersion:1,id:${JSON.stringify(plugin.id)},slots:${JSON.stringify(plugin.slots)},createMesh(){return {vertices:new Float32Array(${JSON.stringify([...mesh.vertices])}),indices:new Uint16Array(${JSON.stringify([...mesh.indices])})}}};\nexport const badgeAnimation=${JSON.stringify(clip)};\n`);
console.log('Built examples/generated/badge.js. Import it eagerly or lazily from your application.');
