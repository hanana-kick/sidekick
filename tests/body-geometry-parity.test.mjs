import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.env.SIDEKICK_BODY_MODULE_ROOT;
const load = name => import(root ? pathToFileURL(join(resolve(root), name + '.js')).href : new URL('../dist/src/' + name + '.js', import.meta.url).href);
const [{ bodyGeometry }, { shapeContour, contourSnapshot }, { buildMorph }] = await Promise.all(['renderer/body-geometry', 'core/contours', 'core/morph'].map(load));
const reference = JSON.parse(await readFile(new URL('./fixtures/body-geometry-parity.json', import.meta.url), 'utf8'));
const catalog = name => shapeContour({ kind: 'material', name });
const plans = new Map();

test('body allocation/query cleanup preserves every reference vertex, normal and index', () => {
  const combined = [];
  for (const expected of reference.cases) {
    const [kind, from, to, finalOrStep, interruptedStep] = expected.name.split(':');
    let contour;
    if (kind === 'static') contour = catalog(from);
    else {
      const key = expected.group;
      if (!plans.has(key)) plans.set(key, kind === 'direct' ? buildMorph(catalog(from), catalog(to)) : buildMorph(buildMorph(catalog(from), catalog(to)).sample(.413), catalog(finalOrStep)));
      const [numerator, denominator] = (kind === 'direct' ? finalOrStep : interruptedStep).split('/').map(Number);
      contour = plans.get(key).sample(numerator / denominator);
    }
    const geometry = bodyGeometry(contourSnapshot(contour.points));
    assert.equal(geometry.vertices.length / 6, expected.vertices, `${expected.name}: vertex count`);
    assert.equal(geometry.indices.length, expected.indices, `${expected.name}: index count`);
    const digest = createHash('sha256').update(new Uint8Array(geometry.vertices.buffer, geometry.vertices.byteOffset, geometry.vertices.byteLength)).update(new Uint8Array(geometry.indices.buffer, geometry.indices.byteOffset, geometry.indices.byteLength)).digest('hex');
    assert.equal(digest, expected.bytes, `${expected.name}: exact positions, normals and topology`);
    combined.push(`${expected.name}:${digest}`);
  }
  assert.equal(createHash('sha256').update(combined.join('\n')).digest('hex'), reference.combinedGeometryHash);
});
