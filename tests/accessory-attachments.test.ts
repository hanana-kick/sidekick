import test from 'node:test';
import assert from 'node:assert/strict';
import { createDesign, MATERIAL_SHAPE_NAMES } from '../src/core/design.js';
import { ACCESSORY_ATTACHMENT_POINTS, getAccessoryAttachmentFrame, getAccessoryAttachmentFrames, attachmentPointToBody } from '../src/core/accessory-attachments.js';
import { cross, dot } from '../src/core/math.js';
import { ShapeTimeline } from '../src/core/shape-motion.js';

test('all body shapes and mount points provide finite right-handed orthonormal frames through squash', () => {
  for (const shape of MATERIAL_SHAPE_NAMES) for (const point of ACCESSORY_ATTACHMENT_POINTS) for (const squash of [.8, 1, 1.2]) {
    const frame = getAccessoryAttachmentFrame(createDesign({ body: { shape } }).body, point, { squash });
    assert.ok([...frame.position, ...frame.matrix].every(Number.isFinite), `${shape}/${point}`);
    for (const basis of [frame.normal, frame.tangent, frame.bitangent]) assert.ok(Math.abs(Math.hypot(...basis)-1) < 1e-6);
    assert.ok(Math.abs(dot(frame.normal, frame.tangent)) < 1e-6);
    assert.ok(dot(cross(frame.tangent, frame.bitangent), frame.normal) > .999999);
    assert.deepEqual(attachmentPointToBody(frame, [0,0,0]), frame.position);
    assert.equal(frame.scale, 1);
  }
});
test('multi-point queries agree with individual frames and current morph override is honored', () => {
  const body = createDesign().body;
  const points = ['leftEye','rightEye'] as const;
  assert.deepEqual(getAccessoryAttachmentFrames(body, points), points.map(point => getAccessoryAttachmentFrame(body, point)));
  const timeline = new ShapeTimeline('square');
  // The renderer supplies its current shape sample, not the target's catalog name.
  void timeline.to('circle', {duration:1000}); timeline.advance(.5);
  const sample = timeline.snapshot;
  const a = getAccessoryAttachmentFrame(body, 'head', { contour: sample.contour, profile: sample.profile });
  const b = getAccessoryAttachmentFrame(body, 'head');
  assert.notDeepEqual(a.position, b.position);
  assert.ok(a.matrix.every(Number.isFinite));
});
test('invalid attachment and squash are rejected', () => {
  const body=createDesign().body;
  assert.throws(()=>getAccessoryAttachmentFrame(body, 'unknown' as any));
  for(const squash of [0,NaN,Infinity,5]) assert.throws(()=>getAccessoryAttachmentFrame(body,'head',{squash}));
});
