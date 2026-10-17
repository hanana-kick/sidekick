import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccessory, createDesign, patchDesign, serializeDesign } from '../dist/src/core/design.js';
import { resolveDesign } from '../dist/src/core/resolved-design.js';
import { MATERIAL_SHAPE_NAMES } from '../dist/src/core/shapes.js';
import { DEFAULT_SHAPE_PROFILES, EYE_PROFILE_SCALE_RANGE, EYE_PROFILE_OFFSET_Y_RANGE, parseShapeProfiles, resolveShapeProfile, resolveShapeEyeGeometry, sameShapeProfile, interpolateShapeProfile } from '../dist/src/core/shape-profiles.js';
import { ShapeTimeline } from '../dist/src/core/shape-motion.js';
import { SidekickAvatar } from '../dist/src/element/avatar.js';
import { createResolvedFixture } from './internal-fixtures.mjs';
const copy = value => structuredClone(value);
const near = (a,b,e=1e-12) => assert.ok(Math.abs(a-b)<=e, `${a} != ${b}`);
const keys=['width','height','spacing','offsetY'];
const withEyes=(shape,eyes)=>({...copy(resolveShapeProfile(shape)),eyes:{...resolveShapeProfile(shape).eyes,...eyes}});
const legacyProfile=p=>({depth:p.depth,mounts:copy(p.mounts),eyes:copy(p.eyes)});
function avatarForTest(){
  const avatar = new SidekickAvatar();
  const attributes = new Map();
  avatar.hasAttribute = name => attributes.has(name);
  avatar.setAttribute = (name, value) => { const old = attributes.get(name) ?? null; attributes.set(name, String(value)); avatar.attributeChangedCallback(name, old, String(value)); };
  avatar.toggleAttribute = (name, enabled) => { const old = attributes.get(name) ?? null; if (enabled) attributes.set(name, ''); else attributes.delete(name); avatar.attributeChangedCallback(name, old, enabled ? '' : null); };
  avatar.isConnected = true; avatar.dispatchEvent = () => true; return avatar;
}

test('all 35 internally curated eye profiles are explicit varied bounded and immutable',()=>{
 assert.equal(MATERIAL_SHAPE_NAMES.length,35); assert.deepEqual(EYE_PROFILE_SCALE_RANGE,[.5,1.5]); assert.deepEqual(EYE_PROFILE_OFFSET_Y_RANGE,[-.35,.35]);
 assert.ok(new Set(MATERIAL_SHAPE_NAMES.map(n=>JSON.stringify(resolveShapeProfile(n).eyes))).size>=25);
 for(const name of MATERIAL_SHAPE_NAMES){const p=resolveShapeProfile(name);assert.ok(Object.isFrozen(p.eyes));assert.deepEqual(Object.keys(p.eyes).sort(),[...keys].sort());for(const k of keys){const r=k==='offsetY'?EYE_PROFILE_OFFSET_Y_RANGE:EYE_PROFILE_SCALE_RANGE;assert.ok(p.eyes[k]>=r[0]&&p.eyes[k]<=r[1]);}assert.throws(()=>{p.eyes.width=1;});}
 assert.ok(DEFAULT_SHAPE_PROFILES.boom.eyes.width<DEFAULT_SHAPE_PROFILES.circle.eyes.width);
 assert.ok(DEFAULT_SHAPE_PROFILES.clamShell.eyes.height<DEFAULT_SHAPE_PROFILES.square.eyes.height);
});
test('legacy profile parser fills missing eyes only for validation without exposing overrides',()=>{
 for(const name of MATERIAL_SHAPE_NAMES){const old=legacyProfile(resolveShapeProfile(name));delete old.eyes;old.depth=.23;old.mounts.head.uv=[.12,-.15];const saved={[name]:old},before=copy(saved),parsed=parseShapeProfiles(saved);assert.deepEqual(saved,before);assert.deepEqual(parsed[name].eyes,DEFAULT_SHAPE_PROFILES[name].eyes);assert.equal(parsed[name].depth,.23);assert.throws(()=>createDesign({body:{profiles:saved}}));}
});
test('legacy eye calibration validation rejects unsafe and out of range discarded values',()=>{
 const p=legacyProfile(resolveShapeProfile('square'));
 for(const eyes of [undefined,null,[],new Date(),{}, {...p.eyes,extra:0},{...p.eyes,weights:{}},Object.create(p.eyes)])assert.throws(()=>parseShapeProfiles({square:{...p,eyes}}));
 for(const k of keys){const range=k==='offsetY'?EYE_PROFILE_OFFSET_Y_RANGE:EYE_PROFILE_SCALE_RANGE;for(const value of [undefined,null,true,'1',NaN,Infinity,range[0]-.001,range[1]+.001])assert.throws(()=>parseShapeProfiles({square:{...p,eyes:{...p.eyes,[k]:value}}}));}
 let reads=0;const eyes={...p.eyes};Object.defineProperty(eyes,'width',{enumerable:true,get(){reads++;return 1;}});assert.throws(()=>parseShapeProfiles({square:{...p,eyes}}));assert.equal(reads,0);
});
test('public colors and weights remain isolated from fixed internal eye geometry',()=>{
 const d=createDesign({eyes:{color:'#123456',left:{weights:{smile:.8,blink:.3}}}}),a=resolveDesign(d),b=resolveDesign(d);a.eyes.width=99;a.eyes.left.targets.smile.radius=99;
 assert.equal(b.eyes.width,.16);assert.equal(b.eyes.left.targets.smile.radius,.75);assert.deepEqual(Object.keys(d.eyes).sort(),['color','left','right']);assert.deepEqual(Object.keys(d.eyes.left),['weights']);
 assert.throws(()=>patchDesign(d,{eyes:{width:.2}}));assert.throws(()=>patchDesign(d,{eyes:{left:{targets:{smile:{radius:1}}}}}));assert.doesNotMatch(serializeDesign(d),/targets|profiles|spacing|anchor/);
});
test('internal eye geometry multiplies the baseline once without changing expression weights',()=>{
 const d=createResolvedFixture({eyes:{width:.2,height:.4,spacing:.8,scale:1.4,left:{weights:{smile:.8,blink:.3}}}}),p=withEyes('square',{width:.75,height:1.1,spacing:.8,offsetY:-.2}),before=copy(d),geometry=resolveShapeEyeGeometry(d.eyes,p);
 near(geometry.width,.15);near(geometry.height,.44);near(geometry.spacing,.64);near(geometry.anchor.uv[1],-.1);assert.deepEqual(d,before);geometry.anchor.uv[0]=.4;assert.equal(d.eyes.anchor.uv[0],0);
 for(const name of MATERIAL_SHAPE_NAMES){const p=resolveShapeProfile(name),g=resolveShapeEyeGeometry(d.eyes,p);near(g.width,d.eyes.width*p.eyes.width);near(g.height,d.eyes.height*p.eyes.height);near(g.spacing,d.eyes.spacing*p.eyes.spacing);assert.deepEqual(d.eyes.left,before.eyes.left);}
 for(const sign of[-1,1]){const e=copy(d.eyes);e.anchor.uv[1]=sign*.8;near(resolveShapeEyeGeometry(e,withEyes('square',{offsetY:sign*.35})).anchor.uv[1],sign*.85);}
});
test('curated eye calibration shares contour easing and exact interrupted snapshots',async()=>{
 for(const easing of['linear','smooth']){const t=new ShapeTimeline('square'),initial=t.snapshot,first=t.to('heart',{duration:1000,easing});t.advance(250);const amount=easing==='linear'?.25:.15625,target=resolveShapeProfile('heart');assert.deepEqual(t.profile,interpolateShapeProfile(initial.profile,target,amount));for(const k of keys)near(t.profile.eyes[k],initial.profile.eyes[k]+(target.eyes[k]-initial.profile.eyes[k])*amount);
 const visible=t.snapshot,eyes=resolveShapeEyeGeometry(createResolvedFixture().eyes,visible.profile),next=t.to('boom',{duration:600,easing:'linear'});assert.deepEqual(await first,{finished:false});assert.strictEqual(t.snapshot,visible);assert.deepEqual(resolveShapeEyeGeometry(createResolvedFixture().eyes,t.profile),eyes);t.advance(0);assert.deepEqual(t.snapshot,visible);t.advance(300);for(const k of keys)near(t.profile.eyes[k],(visible.profile.eyes[k]+resolveShapeProfile('boom').eyes[k])/2);t.finish();assert.deepEqual(await next,{finished:true});}
});
test('internal profile comparison includes every eye field',()=>{
 for(const k of keys){const p=withEyes('square',{[k]:k==='offsetY'?.2:.7});assert.equal(sameShapeProfile(resolveShapeProfile('square'),p),false);const mixed=interpolateShapeProfile(resolveShapeProfile('square'),p,.25);near(mixed.eyes[k],resolveShapeProfile('square').eyes[k]*.75+p.eyes[k]*.25);}
});
test('color and equipment edits preserve the active morph and independent expression clocks',async()=>{
 const a=avatarForTest(),left=a.setEyeWeights('left',{smile:.8,blink:.4},{duration:1000,easing:'linear'}),right=a.setEyeWeights('right',{smile:.6,blink:.8},{duration:600,easing:'linear'});a.timeline.advance(200);const pose=a.pose,shape=a.setShape('heart',{duration:800,easing:'linear'});a.shapeTimeline.advance(200);const visible=a.shapeTimeline.snapshot,target=a.shapeTimeline.targetProfile;
 await a.updateDesign({body:{color:'#abcdef'},eyes:{color:'#123456'},accessories:[createAccessory('beret')]});assert.strictEqual(a.shapeTimeline.snapshot,visible);assert.strictEqual(a.shapeTimeline.targetProfile,target);assert.equal(a.shapeTimeline.remainingDuration,600);assert.deepEqual(a.pose,pose);
 a.timeline.advance(400);assert.deepEqual(await right,{finished:true});near(a.pose.eyes.left.smile,.48);near(a.pose.eyes.left.openness,.76);a.shapeTimeline.advance(600);assert.deepEqual(await shape,{finished:true});assert.deepEqual(a.shapeTimeline.profile,resolveShapeProfile('heart'));a.timeline.advance(400);assert.deepEqual(await left,{finished:true});near(a.pose.eyes.left.smile,.8);assert.deepEqual(Object.keys(a.design.eyes.left),['weights']);
});
test('paused shape changes select curated eye geometry without touching persisted weights',async()=>{
 const a=avatarForTest();a.design=createDesign({eyes:{left:{weights:{smile:.4}}}});const eyes=a.design.eyes;a.paused=true;assert.deepEqual(await a.setShape('boom'),{finished:true});assert.deepEqual(a.shapeTimeline.profile.eyes,DEFAULT_SHAPE_PROFILES.boom.eyes);assert.deepEqual(a.design.eyes,eyes);
});
test('equipment exposes color and identity while its baseline transform is internally resolved',()=>{
 for(const preset of['beret','halo','glasses']){const a=createAccessory(preset);assert.deepEqual(Object.keys(a).sort(),['color','id','preset','slot']);const d=createDesign({accessories:[a]}),r=resolveDesign(d).accessories[0];assert.ok(r.anchor&&r.rotation&&r.scale);assert.equal('anchor'in d.accessories[0],false);}
});
