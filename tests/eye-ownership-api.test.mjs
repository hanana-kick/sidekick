import test from 'node:test';import assert from 'node:assert/strict';
import {SidekickAvatar,createDesign} from '../dist/src/index.js';
import {RenderEngine} from '../dist/src/runtime/render-engine.js';
import {bareAvatarFixture} from './helpers/render-runtime.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const setup=()=>{const f=bareAvatarFixture(SidekickAvatar,RenderEngine,true);f.avatar.paused=true;f.avatar.flushAttributes();return f;};
for(const emotion of ['neutral','happy','sad','curious','surprised','concerned','excited'])test(`manual eyes override ${emotion}, other eye and body remain emotional`,async()=>{
 const f=setup(),a=f.avatar,r=f.runtime;
 try{a.setEmotion(emotion);const baseline=structuredClone(r.render());
  for(const side of ['left','right','both'])for(const expression of ['neutral','smile','blink']){
   a.setEmotion(emotion);await a.setExpression(side,expression,{duration:0});const frame=r.render();
   for(const eye of ['left','right'])if(side==='both'||eye===side){near(frame.pose.eyes[eye].smile,expression==='smile'?1:0);near(frame.pose.eyes[eye].openness,expression==='blink'?0:1);}else assert.deepEqual(frame.pose.eyes[eye],baseline.pose.eyes[eye]);
   assert.deepEqual(frame.activityFrame,baseline.activityFrame);assert.equal(a.emotion,emotion);
   await a.setExpression('both','neutral',{duration:0});
  }
 }finally{r.engine.dispose();}
});
test('same-value eye patches, attributes and invalid commands preserve explicit ownership',async()=>{
 const f=setup(),a=f.avatar,r=f.runtime;
 try{a.setEmotion('happy');await a.updateDesign({eyes:{left:{weights:{smile:0,blink:0}}}});near(r.render().pose.eyes.left.smile,0);near(r.render().pose.eyes.right.smile,.85);
  a.setEmotion('happy');a.setAttribute('left-expression','blink');a.flushAttributes();near(r.render().pose.eyes.left.openness,0);
  assert.throws(()=>a.setEmotion('sad',{intensity:2}));assert.throws(()=>a.reactTo('sad',{duration:-1}));near(r.render().pose.eyes.left.openness,0);
  a.setEmotion('happy');near(r.render().pose.eyes.left.smile,.85);
  await a.motion.to({eyes:{openness:.3,left:{weights:{smile:.4,blink:0}}}},{duration:0});near(r.render().pose.openness,.3);near(r.render().pose.eyes.left.smile,.4);
  await a.setExpression('both','neutral',{duration:0});near(r.render().pose.openness,.3); // deliberate legacy multiplier remains independent
 }finally{r.engine.dispose();}
});
test('reaction end and cancel preserve the latest manual eyes; new reaction reclaims them',async()=>{
 const f=setup(),a=f.avatar,r=f.runtime;
 try{a.setEmotion('happy');let reaction=a.reactTo('sad',{duration:0});await a.setExpression('left','blink',{duration:0});await reaction;near(r.render().pose.eyes.left.openness,0);near(r.render().pose.eyes.right.smile,.85);
  reaction=a.reactTo('surprised',{duration:60000});near(r.render().pose.eyes.left.openness,1);await a.setExpression('right','blink',{duration:0});a.cancelReaction();await reaction;near(r.render().pose.eyes.right.openness,0);near(r.render().pose.eyes.left.smile,.85);
 }finally{a.cancelReaction();r.engine.dispose();}
});
