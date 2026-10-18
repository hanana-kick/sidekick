import test from 'node:test';
import assert from 'node:assert/strict';
import { createDesign, createAccessory, parseDesign, migrateDesign, patchDesign, serializeDesign } from '../dist/src/core/design.js';
import { createEyeState, parseEyeState, patchEyeState, migrateEyeState, eyeExpressionWeights, expressionPose, EYE_EXPRESSIONS, EYE_STATE_DEFAULTS, EYE_STATE_RANGES } from '../dist/src/core/expressions.js';
import { resolveDesign } from '../dist/src/core/resolved-design.js';
import { legacyDesign, legacyAccessory } from './legacy-fixtures.mjs';

const near = (a,b) => assert.ok(Math.abs(a-b)<1e-12, `${a} != ${b}`);
const frozen = value => { assert.ok(Object.isFrozen(value)); for(const child of Object.values(value)) if(child && typeof child === 'object') frozen(child); };

test('v7 stores selections/colors and independent weights with no appearance geometry', () => {
  const design = createDesign({accessories:[createAccessory('beret'),createAccessory('glasses')]});
  assert.equal(design.version,7);
  assert.deepEqual(Object.keys(design.body).sort(),['color','shape']);
  assert.deepEqual(Object.keys(design.eyes).sort(),['color','left','right']);
  assert.deepEqual(design.eyes.left,{weights:{smile:0,blink:0}});
  assert.deepEqual(design.eyes.right,design.eyes.left);
  for(const accessory of design.accessories) assert.deepEqual(Object.keys(accessory).sort(),['color','id','preset','slot']);
  assert.deepEqual(parseDesign(serializeDesign(design)),design);
  assert.deepEqual(migrateDesign(design),{design,warnings:[]});
});

test('all expression presets assign exact independent weights without geometry', () => {
  const source=createEyeState({weights:{smile:.3,blink:.8}});
  for(const [preset,weights] of [['neutral',{smile:0,blink:0}],['smile',{smile:1,blink:0}],['blink',{smile:0,blink:1}]]) {
    assert.deepEqual(eyeExpressionWeights(preset),weights);
    assert.deepEqual(patchEyeState(source,{weights}),{weights});
  }
  assert.throws(()=>eyeExpressionWeights('angry'));
  const weights=eyeExpressionWeights('smile');weights.smile=0;
  assert.equal(eyeExpressionWeights('smile').smile,1);
});

test('weight ranges/defaults are immutable; public and resolved state do not alias', () => {
  frozen(EYE_STATE_DEFAULTS);frozen(EYE_STATE_RANGES);frozen(EYE_EXPRESSIONS);
  assert.equal('targets' in EYE_STATE_DEFAULTS,false);assert.equal('targets' in EYE_STATE_RANGES,false);
  const a=createEyeState(),b=createEyeState();a.weights.smile=.7;assert.deepEqual(b,EYE_STATE_DEFAULTS);
  const design=createDesign(),before=structuredClone(design),resolved=resolveDesign(design),other=resolveDesign(design);
  resolved.eyes.left.targets.smile.radius=1.2;resolved.eyes.anchor.uv[0]=.5;resolved.eyes.left.weights.blink=1;
  assert.deepEqual(design,before);assert.equal(other.eyes.left.targets.smile.radius,.75);
  assert.equal(other.eyes.anchor.uv[0],0);assert.equal(other.eyes.left.weights.blink,0);
});

test('atomic partial weights preserve omitted channels and isolate all state', () => {
  const source=createDesign({eyes:{left:{weights:{smile:.4}},right:{weights:{blink:.7}}}}),snapshot=structuredClone(source);
  const changed=patchDesign(source,{eyes:{left:{weights:{blink:.6}}}});
  assert.deepEqual(changed.eyes.left.weights,{smile:.4,blink:.6});assert.deepEqual(changed.eyes.right,source.eyes.right);
  changed.eyes.right.weights.blink=0;changed.eyes.left.weights.smile=1;
  assert.deepEqual(source,snapshot);
  const parsed=parseEyeState(source.eyes.left);parsed.weights.smile=1;assert.equal(source.eyes.left.weights.smile,.4);
});

test('every weight validates finite inclusive limits at parse/create/patch', () => {
  for(const key of ['smile','blink']) {
    for(const value of [0,1]) {
      const state=createEyeState();state.weights[key]=value;
      assert.deepEqual(parseEyeState(state),state);assert.deepEqual(createEyeState(state),state);
    }
    for(const value of [NaN,Infinity,-Infinity,-.001,1.001,'0.5',null,undefined]) {
      const source=createEyeState(),snapshot=structuredClone(source),state=createEyeState();state.weights[key]=value;
      assert.throws(()=>parseEyeState(state));assert.throws(()=>createEyeState(state));assert.throws(()=>patchEyeState(source,state));
      assert.deepEqual(source,snapshot);
    }
  }
});

test('unknown, accessor, inherited, missing, mixed and removed-target fields reject', () => {
  const invalid=[null,[],'smile',{typo:1},{weights:null},{weights:[]},{weights:{grin:1}},
    {targets:{}},{targets:{smile:{radius:.75}}},{weights:{[Symbol('smile')]:1}},
    {weights:Object.defineProperty({},'smile',{value:NaN})},
    {weights:{get smile(){throw new Error('Getter must not run.');}}},
    Object.assign(Object.create({inherited:true}),{weights:{}}),
    {expression:'smile',weights:{smile:.5}},{openness:.6,targets:{smile:{radius:1}}},
  ];
  for(const patch of invalid) {
    const state=createEyeState(),snapshot=structuredClone(state);
    assert.throws(()=>createEyeState(patch));assert.throws(()=>patchEyeState(state,patch));
    assert.throws(()=>createDesign({eyes:{left:patch}}));assert.deepEqual(state,snapshot);
  }
  for(const missing of [{},{weights:{}},{weights:{smile:0}},{weights:{blink:0}}]) assert.throws(()=>parseEyeState(missing));
});

test('all removed body, eye and accessory geometry rejects through current API and JSON', () => {
  const cases=[
    ...Object.entries({profiles:{},size:[1,1,1],roundness:.5,depth:.8,anchor:{},rotation:[0,0,0]}).map(([key,value])=>({body:{[key]:value}})),
    ...Object.entries({shape:'capsule',width:.16,height:.34,spacing:.64,scale:1,anchor:{region:'face',uv:[0,0],offset:0},targets:{}}).map(([key,value])=>({eyes:{[key]:value}})),
    ...Object.entries({anchor:{region:'crown',uv:[0,0],offset:0},scale:1,rotation:[0,0,0],follow:.5,profiles:{}}).map(([key,value])=>({accessories:[{...createAccessory('beret'),[key]:value}]})),
    {eyes:{left:{targets:{smile:{radius:.75}}}}},
  ];
  for(const patch of cases) {
    const source=createDesign(),snapshot=structuredClone(source);
    assert.throws(()=>createDesign(patch));assert.throws(()=>patchDesign(source,patch));
    const raw={...source,body:{...source.body,...patch.body},eyes:{...source.eyes,...patch.eyes},accessories:patch.accessories??[]};
    assert.throws(()=>parseDesign(raw));assert.throws(()=>parseDesign(JSON.stringify(raw)));assert.deepEqual(source,snapshot);
  }
});

test('legacy selector conveniences normalize to weights without a second authority', () => {
  const design=createDesign({eyes:{left:{expression:'smile',openness:.7},right:{expression:'blink',openness:.9}}});
  assert.equal(design.eyes.left.weights.smile,1);near(design.eyes.left.weights.blink,.3);
  assert.deepEqual(design.eyes.right.weights,{smile:0,blink:1});
  assert.deepEqual(Object.keys(design.eyes.left),['weights']);
  assert.deepEqual(patchEyeState(design.eyes.left,{openness:.25}),{weights:{smile:1,blink:.75}});
  for(const state of [{expression:'smile',weights:{smile:.5}},{openness:.6,targets:{}}]) {
    assert.throws(()=>parseEyeState(state));assert.throws(()=>migrateEyeState(state));assert.throws(()=>expressionPose(state));
  }
});

test('v1–v5 validate and discard geometry, preserving colors, equipment and expression weights', () => {
  for(const version of [1,2,3,4,5]) {
    const old=legacyDesign(version);old.body.color='#ABCDEF';old.eyes.color='#FEDCBA';
    if(version<3) old.body.shape={kind:'material',name:'heart'};else old.body.shape='heart';
    old.accessories=[legacyAccessory('beret','hat'),legacyAccessory('glasses','specs')];
    old.accessories[0].scale=1.9;old.accessories[0].rotation=[.4,.8,-.2];old.accessories[0].anchor.uv=[.3,-.4];
    old.accessories[1].follow=.9;old.accessories[1].color='#abcdef';
    if(version===1)old.eyes.preset='arc';
    else {
      old.eyes.width=.22;old.eyes.height=.11;old.eyes.scale=1.7;old.eyes.anchor.uv=[.5,-.4];
      if(version<4) {old.eyes.left={expression:'smile',openness:.7};old.eyes.right={expression:'blink',openness:.5};}
      else {old.eyes.left.weights={smile:.3,blink:.8};old.eyes.right.weights={smile:.9,blink:.1};}
    }
    if(version>=4)old.body.profiles={heart:{depth:.4,mounts:{head:{uv:[.4,.2],offset:.1},face:{uv:[.1,.2],offset:.2}},eyes:{width:1.4,height:.6,spacing:.7,offsetY:.1}}};
    const before=structuredClone(old),{design,warnings}=migrateDesign(old);
    assert.equal(design.version,7);assert.deepEqual(design.body,{shape:'heart',color:'#abcdef'});assert.equal(design.eyes.color,'#fedcba');
    assert.deepEqual(design.accessories,old.accessories.map(({id,preset,slot,color})=>({id,preset,slot:slot==='face'?'eyes':slot,color})));
    if(version===1)assert.deepEqual(design.eyes.left.weights,{smile:1,blink:0});
    else if(version<4){near(design.eyes.left.weights.blink,.3);assert.deepEqual(design.eyes.right.weights,{smile:0,blink:1});}
    else {assert.deepEqual(design.eyes.left.weights,old.eyes.left.weights);assert.deepEqual(design.eyes.right.weights,old.eyes.right.weights);}
    assert.equal(warnings.length,1);assert.match(warnings[0],new RegExp(`v${version}.*v7`));assert.match(warnings[0],/Discarded.*geometry.*profile.*rotation/);
    assert.deepEqual(migrateDesign(design),{design,warnings:[]});assert.deepEqual(parseDesign(serializeDesign(design)),design);assert.deepEqual(old,before);
  }
});

test('discarded legacy geometry still strictly validates, including v4/v5 target schemas', () => {
  for(const version of [1,2,3,4,5]) for(const change of [
    d=>d.eyes.scale=NaN,d=>d.eyes.anchor.uv=[0,Infinity],d=>d.accessories[0].rotation=[0,0,4],
    d=>d.accessories[0].scale=0,d=>d.accessories[0].follow=Infinity,d=>d.accessories[0].anchor.offset=-1,
  ]) {const old=legacyDesign(version);old.accessories=[legacyAccessory()];change(old);assert.throws(()=>parseDesign(old));}
  for(const version of [4,5]) for(const change of [
    s=>s.thickness=0,s=>s.extra=1,s=>delete s.thickness,
    s=>{if(version===4)s.arc=NaN;else s.radius=Infinity;},
    s=>{if(version===4)s.radius=.75;else s.arc=.3;},
  ]) {const old=legacyDesign(version);change(old.eyes.left.targets.smile);assert.throws(()=>parseDesign(old));}
  for(const bad of [NaN,0,1.3]) {const old=legacyDesign(5);old.body.profiles={square:{depth:bad,mounts:{head:{uv:[0,0],offset:0},face:{uv:[0,0],offset:0}}}};assert.throws(()=>parseDesign(old));}
  const v7=createDesign();v7.eyes.left={expression:'smile',openness:1};assert.throws(()=>parseDesign(v7));
});

test('render poses derive openness from blink for every independent combined weight', () => {
  for(const smile of [0,.2,1])for(const blink of [0,.5,1])assert.deepEqual(expressionPose(createEyeState({weights:{smile,blink}})),{openness:1-blink,smile});
});

test('root exports expose no profile, target-geometry or renderer calibration entry points', async () => {
  const api=await import('../dist/src/index.js');
  for(const key of ['AvatarRenderer','ShapeTimeline','resolveDesign','resolveShapeProfile','parseShapeProfiles','resolveShapeEyeGeometry','accessoryMountAnchor','DEFAULT_SHAPE_PROFILES','BODY_DEPTH_RANGE','EYE_PROFILE_SCALE_RANGE','EYE_PRESETS'])assert.equal(key in api,false,key);
  for(const key of ['SidekickAvatar','createDesign','parseDesign','migrateDesign','patchDesign','createAccessory','createEyeState','eyeExpressionWeights','MotionTimeline','createBodyOrientation'])assert.equal(typeof api[key],'function',key);
});

test('legacy sparse arrays and accessor payloads reject without invoking getters', () => {
  let invoked=0;const getter=()=>{invoked++;throw new Error('Getter was invoked');};
  const array=()=>Object.defineProperty([0,0,0],'0',{get:getter,enumerable:true});
  const object=(key)=>Object.defineProperty({},key,{get:getter,enumerable:true});
  for(const version of [1,2,3,4,5]) for(const change of [
    d=>d.eyes.anchor.uv=new Array(2),d=>d.accessories=new Array(1),
    d=>d.eyes.anchor.uv=Object.defineProperty([0,0],'0',{get:getter,enumerable:true}),
    d=>d.accessories[0].rotation=new Array(3),d=>d.accessories[0].rotation=array(),
    d=>d.accessories=Object.defineProperty([legacyAccessory()],'0',{get:getter,enumerable:true}),
    d=>d.eyes.anchor=object('region'),
  ]) {const raw=legacyDesign(version);raw.accessories=[legacyAccessory()];change(raw);assert.throws(()=>parseDesign(raw));}
  for(const shape of [object('kind'),{kind:'morph',from:object('kind'),to:{kind:'ellipse'},progress:.5}]){
    const raw=legacyDesign(2);raw.body.shape=shape;assert.throws(()=>parseDesign(raw));
  }
  const raw=legacyDesign(2);raw.body.size=new Array(3);assert.throws(()=>parseDesign(raw));
  for(const version of [4,5])for(const uv of [new Array(2),Object.defineProperty([0,0],'0',{get:getter,enumerable:true}),Object.assign([0,0],{extra:true}),Object.assign([0,0],{[Symbol('custom')]:true}),Object.setPrototypeOf([0,0],null)]) {
    const saved=legacyDesign(version);saved.body.profiles={square:{depth:.8,mounts:{head:{uv,offset:0},face:{uv:[0,0],offset:0}}}};
    assert.throws(()=>parseDesign(saved));
  }
  assert.equal(invoked,0);
});

test('published root and core declarations reject geometry and internal package imports', async () => {
  const ts=(await import('typescript')).default;
  const fixture=new URL('./public-contract.fixture.mts',import.meta.url).pathname;
  const program=ts.createProgram([fixture],{noEmit:true,strict:true,skipLibCheck:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,lib:['lib.es2022.d.ts','lib.dom.d.ts']});
  const diagnostics=ts.getPreEmitDiagnostics(program);
  assert.deepEqual(diagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')),[]);
});
