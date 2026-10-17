import test from 'node:test';
import assert from 'node:assert/strict';
import { alphaBounds, cropPixels, validateSnapshotOptions } from '../dist/src/core/pixels.js';
const fixture = (width, height) => ({ width, height, pixels: new Uint8Array(width * height * 4) });
const pixel = (image, x, y, rgba) => image.pixels.set(rgba, (y * image.width + x) * 4);

test('alpha bounds include alpha 1 edges and disjoint accessories at opposite extremes', () => {
  const image = fixture(8, 6); pixel(image, 2, 1, [1, 2, 3, 1]); pixel(image, 6, 4, [4, 5, 6, 255]);
  assert.deepEqual(alphaBounds(image), { x: 2, y: 1, width: 5, height: 4 });
});
test('crop preserves exact RGBA bytes, row order, transparent interior and input', () => {
  const image = fixture(4, 4); pixel(image, 1, 1, [10, 20, 30, 1]); pixel(image, 2, 2, [90, 80, 70, 255]);
  const before = image.pixels.slice(), result = cropPixels(image);
  assert.equal(result.width, 2); assert.equal(result.height, 2);
  assert.deepEqual([...result.pixels], [10, 20, 30, 1, 0, 0, 0, 0, 0, 0, 0, 0, 90, 80, 70, 255]);
  assert.deepEqual(image.pixels, before);
});
test('padding is transparent outside the original bounds, including at image edges', () => {
  const image = fixture(2, 2); pixel(image, 0, 0, [255, 0, 0, 255]);
  const result = cropPixels(image, { padding: 2 }); assert.equal(result.width, 5); assert.equal(result.height, 5);
  assert.deepEqual([...result.pixels.slice(48, 52)], [255, 0, 0, 255]);
  assert.equal([...result.pixels].filter(x => x !== 0).length, 2);
});
test('fully transparent data exports one clear pixel even if transparent RGB bytes are nonzero', () => {
  const image = fixture(3, 2); pixel(image, 1, 1, [200, 100, 50, 0]);
  assert.equal(alphaBounds(image), null);
  const result = cropPixels(image); assert.equal(result.width, 1); assert.equal(result.height, 1); assert.deepEqual([...result.pixels], [0, 0, 0, 0]);
  assert.equal(cropPixels(image, { padding: 1 }).width, 3);
});
test('crop false keeps full dimensions and every byte', () => {
  const image = fixture(4, 3); pixel(image, 1, 1, [10, 20, 30, 128]);
  const result = cropPixels(image, { crop: false }); assert.equal(result.width, 4); assert.equal(result.height, 3); assert.deepEqual(result.pixels, image.pixels);
});
test('crop validates dimensions, byte count, and bounded integer padding', () => {
  for (const image of [fixture(0, 1), { width: 2, height: 2, pixels: new Uint8Array(3) }, { width: 1.5, height: 1, pixels: new Uint8Array(6) }]) assert.throws(() => alphaBounds(image));
  for (const options of [{ padding: -1 }, { padding: .5 }, { padding: 4097 }, { padding: NaN }, { crop: 'false' }, { unknown: true }, null]) assert.throws(() => validateSnapshotOptions(options));
  assert.deepEqual(validateSnapshotOptions(), { crop: true, padding: 0 });
});
