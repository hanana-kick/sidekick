import test from 'node:test';
import assert from 'node:assert/strict';
import { triangles, intersections } from './intersections.mjs';

function mesh(a, b) {
  return {
    vertices: new Float32Array([...a, ...b].flatMap(p => [...p, 0, 0, 1])),
    indices: new Uint16Array([0, 1, 2, 3, 4, 5]),
  };
}
const base = [[0, 0, 0], [1, 0, 0], [0, 1, 0]];

test('intersection helper detects strict nonadjacent interior crossing', () => {
  assert.equal(intersections(triangles(mesh(base, [[.2, .2, -1], [.2, .2, 1], [.7, .2, .3]]))).count, 1);
});
test('intersection helper excludes disjoint triangles', () => {
  assert.equal(intersections(triangles(mesh(base, [[.2, .2, 1], [.2, .2, 2], [.7, .2, 1.3]]))).count, 0);
});
test('intersection helper excludes shared vertex contact without interior crossing', () => {
  const m = mesh(base, [[.2, .2, -1], [.2, .2, 1], [.7, .2, .3]]);
  m.indices[3] = 0;
  assert.equal(intersections(triangles(m)).count, 0);
});
test('intersection helper still detects an interior crossing when triangles share a vertex', () => {
  const m = mesh(base, [[0, 0, 0], [.2, .2, -1], [.7, .2, 1]]);
  m.indices[3] = 0;
  assert.equal(intersections(triangles(m)).count, 1);
});
test('intersection helper excludes touching parallel triangles', () => {
  assert.equal(intersections(triangles(mesh(base, [[0, 0, 0], [-1, 0, 0], [0, -1, 0]]))).count, 0);
});
test('intersection helper detects coplanar positive-area overlap', () => {
  assert.equal(intersections(triangles(mesh(base, [[.1, .1, 0], [.5, .1, 0], [.1, .5, 0]]))).count, 1);
});
test('intersection helper excludes coplanar opposite-side adjacent triangles', () => {
  assert.equal(intersections(triangles(mesh(base, [[0, 0, 0], [1, 0, 0], [0, -1, 0]]))).count, 0);
});
test('intersection helper detects a doubled coplanar surface with reversed winding', () => {
  assert.equal(intersections(triangles(mesh(base, [base[2], base[1], base[0]]))).count, 1);
});
