// Test-only numerical fixtures. These are not public customization APIs.
import { createAccessory, createDesign } from '../dist/src/core/design.js';
import { resolveDesign } from '../dist/src/core/resolved-design.js';

const clone = value => structuredClone(value);
function merge(base, patch) {
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) base[key] = merge(base[key] ?? {}, value);
    else base[key] = clone(value);
  }
  return base;
}
/** Deliberately permits internal geometry stress cases without weakening v7 validation. */
export function createResolvedFixture(patch = {}) {
  const design = resolveDesign(createDesign());
  return merge(design, patch);
}
export function createResolvedAccessory(preset, id = preset) {
  return resolveDesign(createDesign({ accessories: [createAccessory(preset, id)] })).accessories[0];
}
