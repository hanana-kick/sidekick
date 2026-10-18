/** Real production shader/body-facing regression via native EGL, no browser required.
 * node --import tsx scripts/body-orientation-qa.mjs
 * Requires cc and system EGL/GLES3. Output stays in a temporary directory.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { recordGL } from './crown-qa/recorder.mjs';
import { AvatarRenderer } from '../src/renderer/webgl.ts';
import { createDesign } from '../src/core/design.ts';
import { initialPose } from '../src/core/motion.ts';
const size = 320, root = fileURLToPath(new URL('../', import.meta.url));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'sidekick-body-facing-'));
const capture = recordGL(), renderer = new AvatarRenderer({ width: size, height: size, getContext: () => capture.gl });
function binary(draws) {
  const parts = [Buffer.from(new Uint32Array([draws.length]).buffer)];
  for (const draw of draws) {
    parts.push(Buffer.from(new Uint32Array([draw.vertices.length / 24, draw.indices.length / 2, draw.uniforms.size, Number(!!draw.directions)]).buffer), draw.vertices);
    if (draw.directions) parts.push(draw.directions);
    parts.push(draw.indices);
    for (const [name, uniform] of draw.uniforms) {
      const label = Buffer.alloc(64); label.write(name);
      const values = new Float32Array(16); values.set(uniform.values);
      parts.push(label, Buffer.from(new Uint32Array([uniform.kind]).buffer), Buffer.from(values.buffer));
    }
  }
  return Buffer.concat(parts);
}
try {
  const native = path.join(temp, 'renderer');
  execFileSync(process.env.CC ?? 'cc', [root + 'scripts/native-preview-renderer.c', '-O2', '-ldl', '-o', native]);
  const shaders = ['vertex', 'fragment'].map((name, index) => {
    const file = path.join(temp, name + '.glsl');
    fs.writeFileSync(file, capture.shaders.find(shader => shader.type === [35633, 35632][index]).source); return file;
  });
  const design = createDesign({ body: { shape: 'square', color: '#ffffff' }, eyes: { color: '#000000' } });
  const samples = {};
  for (const [name, yaw, pitch, roll, zoom] of [
    ['front', 0, 0, 0, 1], ['right', 35, 0, 0, 1], ['left', -35, 0, 0, 1],
    ['tilt', 0, 30, 0, 1], ['untilt', 0, -30, 0, 1], ['roll', 0, 0, 45, 1], ['unroll', 0, 0, -45, 1], ['zoom', 0, 0, 0, 1.25],
  ]) {
    renderer.render(design, { pose: initialPose(), eyeMotion: { left: false, right: false }, activity: 'still', time: 0, delta: 0, reduced: true, style: 'flat', bodyOrientation: { yaw, pitch, roll }, zoom });
    const input = path.join(temp, name + '.bin'), output = path.join(temp, name + '.pam');
    fs.writeFileSync(input, binary(capture.draws));
    execFileSync(native, [...shaders, input, output], { env: { ...process.env, SIDEKICK_SIZE: String(size), MESA_SHADER_CACHE_DIR: path.join(temp, 'cache') } });
    const pam = fs.readFileSync(output), pixels = pam.subarray(pam.indexOf('ENDHDR\n') + 7);
    assert.equal(pixels.length, size * size * 4);
    let xSum = 0, ySum = 0, count = 0, alpha = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (pixels[i + 3] > 200) {
        alpha++;
        if (pixels[i] < 32 && pixels[i + 1] < 32 && pixels[i + 2] < 32) { xSum += x; ySum += size - 1 - y; count++; }
      }
    }
    samples[name] = { x: xSum / count - size / 2, y: ySum / count - size / 2, count, alpha };
    assert.ok(count > 10, `${name} must contain visible eyes`);
  }
  assert.ok(samples.right.x > samples.front.x + 5 && samples.left.x < samples.front.x - 5, 'Positive yaw faces screen right');
  assert.ok(samples.tilt.y < samples.untilt.y - 5, 'Positive pitch tilts the top toward the viewer');
  assert.ok(samples.roll.x < samples.unroll.x - 5, 'Positive roll turns counterclockwise');
  assert.ok(samples.zoom.alpha > samples.front.alpha * 1.4, 'Separate zoom enlarges the real silhouette');
  console.log(JSON.stringify({ result: 'passed', method: 'Unmodified production shaders replayed through native EGL/GLES3', samples }, null, 2));
} finally { renderer.dispose(); fs.rmSync(temp, { recursive: true, force: true }); }
