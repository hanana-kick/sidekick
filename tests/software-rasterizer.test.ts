import test from 'node:test';
import assert from 'node:assert/strict';
import { SoftwareRasterizer, softwareEyeDistance } from '../src/renderer/software-rasterizer.js';
import { transform } from '../src/core/math.js';
import type { Geometry } from '../src/renderer/geometry.js';
const identity = transform();
function quad(z = 0, front = 1): Geometry {
  return { vertices: new Float32Array([-1,-1,z,0,0,front, 1,-1,z,0,0,front, 1,1,z,0,0,front, -1,1,z,0,0,front]), indices: new Uint16Array([0,1,2,0,2,3]) };
}
test('CPU rasterizer covers a quad without diagonal seams, clears and culls back faces', () => {
  const raster = new SoftwareRasterizer(); raster.clear(16, 16);
  raster.draw(quad(), identity, identity, '#ff0000');
  for (let i = 0; i < raster.pixels.length; i += 4) assert.deepEqual(Array.from(raster.pixels.slice(i, i + 4)), [255,0,0,255]);
  raster.clear(16,16); const back = quad(); back.indices = new Uint16Array([2,1,0,3,2,0]);
  raster.draw(back, identity, identity, '#ffffff'); assert.ok(raster.pixels.every(v => v === 0));
});
test('LESS depth, index ranges, alpha and bottom-up premultiplied readback agree with GL semantics', () => {
  const raster = new SoftwareRasterizer(); raster.clear(4,4);
  raster.draw(quad(.5), identity, identity, '#ff0000');
  raster.draw(quad(-.5), identity, identity, '#0000ff', 6, 0, .5);
  raster.draw(quad(.7), identity, identity, '#00ff00');
  assert.deepEqual(Array.from(raster.pixels.slice(0,4)), [128,0,128,255]);
  raster.clear(4,4); raster.draw(quad(), identity, identity, '#ff0000', 3, 0, .5);
  const read = raster.readPixels();
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const p = (y * 4 + x) * 4, q = ((3-y) * 4 + x) * 4;
    assert.equal(read[q + 3], raster.pixels[p + 3]);
    assert.equal(read[q], raster.pixels[p + 3] ? 128 : 0);
  }
});
test('front-cap eye ink follows body-local chart and never changes silhouette alpha', () => {
  const raster = new SoftwareRasterizer();
  const eyes = {color:[0,0,0], centers:[-.3,0,.3,0], size:[.2,.5], states:[1,0,1,0], leftTargets:[1,0,.2,.1], rightTargets:[1,0,.2,.1], faceScale:[1,1]};
  raster.clear(64,64); raster.draw(quad(),identity,identity,'#ffffff',6,0,1,eyes);
  assert.equal(raster.pixels[(32 * 64 + 22)*4],0);
  assert.equal(raster.pixels[(32 * 64 + 32)*4],255);
  assert.ok(Array.from(raster.pixels).filter((_,i) => i%4===3).every(a => a===255));
  raster.clear(64,64); raster.draw(quad(0,-1),identity,identity,'#ffffff',6,0,1,eyes);
  assert.ok(raster.pixels.every(v => v===255));
});
test('analytic eye distance has capsule, blink and smile behavior', () => {
  const size=[.2,.5], targets=[1,0,.2,.1];
  assert.ok(softwareEyeDistance(0,0,1,0,size,targets)<0);
  assert.ok(softwareEyeDistance(0,.1,0,0,size,targets)>0);
  assert.ok(softwareEyeDistance(0,.1,1,0,size,targets)<0);
  assert.equal(softwareEyeDistance(.1,.1,0,0,size,targets),softwareEyeDistance(.1,.1,0,1,size,targets));
});

test('offscreen and depth-clipped triangles cannot leak or wrap; dispose releases retained arrays', () => {
  const raster = new SoftwareRasterizer(); raster.clear(16, 8);
  raster.draw(quad(), transform([5, 0, 0]), identity, '#ffffff');
  raster.draw(quad(3), identity, identity, '#ffffff');
  raster.draw(quad(-3), identity, identity, '#ffffff');
  assert.ok(raster.pixels.every(v => v === 0));
  raster.draw(quad(), transform([1, 0, 0]), identity, '#ffffff');
  for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) assert.equal(raster.pixels[(y * 16 + x) * 4 + 3], x < 8 ? 0 : 255);
  raster.dispose(); assert.equal(raster.pixels.length, 0); assert.equal(raster.readPixels().length, 0);
  raster.clear(4,4); raster.draw(quad(),identity,identity,'#ffffff'); assert.ok(raster.pixels.every(v=>v===255));
});
