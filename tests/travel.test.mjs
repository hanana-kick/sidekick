import test from 'node:test';
import assert from 'node:assert/strict';
import { travelMatrix, travelPose, travelActivity } from '../dist/src/core/travel.js';
import { bodyOrientationMatrix } from '../dist/src/core/body-orientation.js';
import { initialPose, activityFrame } from '../dist/src/core/motion.js';
import { multiply, transform } from '../dist/src/core/math.js';
const neutral = { direction: [0,0], strength: 0, lift: 0, bank: 0 };
test('travel presentation leaves baseline pose and matrix byte-identical when neutral',()=>{
 const pose=initialPose(), base=bodyOrientationMatrix({yaw:45,pitch:20,roll:90});
 assert.equal(travelPose(pose,neutral),pose); assert.equal(travelMatrix(base,neutral),base);
 const activity=activityFrame('thinking',1,false); assert.equal(travelActivity(activity,neutral),activity);
});
test('direction gaze is conjugate screen-space, bounded and does not mutate authored pose',()=>{
 const pose=initialPose();pose.gaze=[.3,-.2]; const saved=structuredClone(pose);
 for(const direction of [[1,0],[-1,0],[0,1],[0,-1],[Math.SQRT1_2,Math.SQRT1_2]]){
  const result=travelPose(pose,{...neutral,direction,strength:1});
  assert.deepEqual(result.gaze,[direction[0]*.75,-direction[1]*.75]);
  assert.equal(result.eyes,pose.eyes); assert.deepEqual(pose,saved);
 }
});
test('flight yaw pitch and lift are composed in view space for every bodyOrientation',()=>{
 for(const yaw of [0,45,90,180])for(const roll of [-90,0,90]){
  const base=bodyOrientationMatrix({yaw,pitch:25,roll});const travel={direction:[.6,.8],strength:.7,lift:.06,bank:-.07};
  const expected=multiply(transform([0,.06,0],[.8*.24*.7,.6*.45*.7,-.07]),base);
  assert.deepEqual(travelMatrix(base,travel),expected);
 }
});
test('flight replaces competing activity motion but preserves expression, blink and squash',()=>{
 const frame={bob:.1,roll:.3,squash:1.04,blink:.2,gaze:[.4,.5]};
 assert.deepEqual(travelActivity(frame,{...neutral,strength:1}),{...frame,bob:0,roll:0,gaze:[0,0]});
 assert.equal(frame.roll,.3);
});
