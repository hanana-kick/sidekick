import test from 'node:test';
import assert from 'node:assert/strict';
import { getAccessoryPluginEyeMeasurements } from '../src/plugin-sdk.js';
import { createDesign } from '../src/core/design.js';
import { resolveDesign } from '../src/core/resolved-design.js';
import { projectEyes } from '../src/renderer/eye-projection.js';
import { identity } from '../src/core/math.js';
import { ShapeTimeline } from '../src/core/shape-motion.js';

test('public neutral eye measurements share exact core fitting and follow face motion, not gaze or expression', () => {
  const design = createDesign({ body: { shape: 'heart' } });
  const timeline = new ShapeTimeline('circle'); void timeline.to('heart', { duration: 1000 }); timeline.advance(417);
  const options = { face: [.06, -.035] as [number, number], squash: .93, contour: timeline.snapshot.contour, profile: timeline.snapshot.profile };
  const measured = getAccessoryPluginEyeMeasurements(design, options), projected = projectEyes(resolveDesign(design), identity(), options.face, [0, 0], options.squash, options.contour, options.profile);
  assert.deepEqual(measured, { left: projected.left.localCenter.slice(0, 2), right: projected.right.localCenter.slice(0, 2), size: projected.size });
  assert.notDeepEqual(measured, getAccessoryPluginEyeMeasurements(design, { ...options, face: [0, 0] }));
  const animated = structuredClone(design); animated.eyes.left.weights.smile = 1; animated.eyes.right.weights.blink = 1;
  assert.deepEqual(getAccessoryPluginEyeMeasurements(animated, options), measured);
  assert.throws(() => getAccessoryPluginEyeMeasurements(design, { squash: NaN }), /measurement pose/);
});
