import { studioSceneAttributes, seedStudioSession } from '../playground/studio-session.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createScene } from '../src/core/scene.ts';
import { createDesign } from '../src/core/design.ts';
import { SIDEKICK_ATTRIBUTES } from '../src/element/attributes.ts';
import { ALL_STATE_FIELDS, STATE_FIELDS, FIELD_BY_KEY, fieldDefault, validateStateValue, compileReferenceAttributes, referenceSource, referenceReactProps } from '../playground/state-reference-schema.js';
const scene=createScene();
test('all public attributes have one control with a real React prop',()=>{
 assert.deepEqual(ALL_STATE_FIELDS.map(x=>x.attribute).sort(),[...SIDEKICK_ATTRIBUTES].sort());
 assert.equal(new Set(ALL_STATE_FIELDS.map(x=>x.attribute)).size,ALL_STATE_FIELDS.length);
 const react=readFileSync(new URL('../src/react.ts',import.meta.url),'utf8').split('export interface SidekickAvatarProps')[1].split('const tagName')[0];
 for(const item of ALL_STATE_FIELDS)assert.ok(react.includes(item.prop+'?:'),item.prop);
 assert.equal(Object.keys(STATE_FIELDS).length,8);
});
test('schema defaults validate and Studio shape/color/eyes remain inherited',()=>{
 const document=new JSDOM().window.document;
 for(const item of ALL_STATE_FIELDS){const value=fieldDefault(item,scene);assert.doesNotThrow(()=>validateStateValue(item,value,scene,document),item.attribute);}
 const custom=createScene({design:createDesign({body:{shape:'heart',color:'#123456'}}),zoom:1.6,trackingMode:'off',paused:true,bodyOrientation:{yaw:35,pitch:7,roll:-12}});
 const attributes=compileReferenceAttributes(custom,{'emotion-intensity':.4});
 assert.equal(attributes.design.body.color,'#123456');assert.equal(attributes.zoom,1.6);assert.equal(attributes['body-yaw'],35);assert.equal(attributes.paused,true);assert.equal(attributes['tracking-mode'],'off');
 assert.equal(fieldDefault(FIELD_BY_KEY.get('shape'),custom),'heart');
 assert.equal(referenceReactProps(attributes).emotionIntensity,.4);
});
test('preset overrides inherited orientation but explicit axes win, without mutating scene',()=>{
 const input=createScene({bodyOrientation:{yaw:25,pitch:5,roll:3}});
 const attrs=compileReferenceAttributes(input,{'body-orientation':'side','body-pitch':12});
 assert.equal(attrs['body-yaw'],undefined);assert.equal(attrs['body-roll'],undefined);assert.equal(attrs['body-pitch'],12);assert.equal(input.bodyOrientation.yaw,25);
});
test('numeric booleans and JSON are validated; invalid mutations are not applied',()=>{
 const doc=new JSDOM().window.document;
 for(const [key,value]of [['emotion','fake'],['paused','false'],['position-x',Infinity],['zoom',10],['emotion-intensity',-1],['body-color','red'],['design',{}],['motion',{eyes:{left:{weights:{smile:2}}}}],['behavior',{type:'attention'}],['behavior',{type:'wait',target:'['}],['accessories',[{id:'broken'}]]])assert.throws(()=>validateStateValue(FIELD_BY_KEY.get(key),value,scene,doc),key);
 assert.equal(validateStateValue(FIELD_BY_KEY.get('paused'),false,scene,doc),false);
 assert.equal(validateStateValue(FIELD_BY_KEY.get('behavior'),null,scene,doc),null);
});
test('selected-only full source embeds exact config, explicit false, no code evaluation',()=>{
 const edits={paused:false,'tracking-mode':'off',emotion:'curious','emotion-intensity':.35};
 const html=referenceSource(scene,edits,'element'),react=referenceSource(scene,edits,'react');
 assert.match(html,/paused="false"/);assert.match(html,/emotion-intensity="0.35"/);assert.doesNotMatch(html,/<SidekickAvatar/);
 assert.match(react,/"paused": false/);assert.match(react,/"emotionIntensity": 0.35/);assert.match(react,/SidekickAvatar id="reference-bot"/);assert.doesNotMatch(react,/<sidekick-avatar/);
 const props=JSON.parse(react.split('const avatarProps = ')[1].split(';\n\nexport')[0]);assert.deepEqual(props,referenceReactProps(compileReferenceAttributes(scene,edits)));
});

test('numeric control seeds satisfy native HTML step constraints',()=>{
 const dom=new JSDOM();try{for(const field of ALL_STATE_FIELDS.filter(item=>item.kind==='number')){const input=dom.window.document.createElement('input');input.type='number';input.min=String(field.min);input.max=String(field.max);input.step=String(field.step);input.value=String(fieldDefault(field,scene));assert.equal(input.checkValidity(),true,field.attribute);}}finally{dom.window.close();}
});

test('saved scene seed is complete before a preview element is inserted',()=>{
 const saved=createScene({design:createDesign({body:{shape:'heart',color:'#123456'}}),zoom:1.4,bodyOrientation:{yaw:23,pitch:12,roll:4}});
 const dom=new JSDOM();try{const element=dom.window.document.createElement('sidekick-avatar');seedStudioSession(element,saved);assert.equal(element.isConnected,false);assert.deepEqual(JSON.parse(element.getAttribute('design')),saved.design);assert.equal(element.getAttribute('zoom'),'1.4');assert.equal(element.getAttribute('body-yaw'),'23');assert.deepEqual(studioSceneAttributes(saved),compileReferenceAttributes(saved,{}));}finally{dom.window.close();}
});

test('standalone state pages and target-based pages emit matching preview layouts',()=>{
 for(const framework of ['element','react']){
  const standalone=referenceSource(scene,{},framework,'state-appearance');
  assert.match(standalone,/#reference-target,#reference-list\{display:none\}/);
  const positional=referenceSource(scene,{},framework,'state-position');
  assert.doesNotMatch(positional,/#reference-target,#reference-list\{display:none\}/);
  assert.match(positional,/height:calc\(100vh - 32px\)/);
 }
});

test('entrance schema validates the public declaration and emits exact selected-framework values',()=>{
 const field=FIELD_BY_KEY.get('entrance');
 assert.equal(field.prop,'entrance');
 assert.deepEqual(fieldDefault(field,scene),{source:'element',target:'#reference-target',direction:'right',at:0.5,gap:16});
 for(const declaration of [{source:'viewport',edge:'left',at:.3,inset:24},{source:'element',target:'#reference-target',direction:'top',at:.75,gap:16},null]){
  assert.deepEqual(validateStateValue(field,declaration,scene),declaration);
  const attributes=compileReferenceAttributes(scene,{entrance:declaration});
  if(declaration)assert.equal(attributes.placement,'viewport');
  const html=referenceSource(scene,{entrance:declaration},'element','state-entrance');
  const dom=new JSDOM(html);
  assert.deepEqual(JSON.parse(dom.window.document.querySelector('sidekick-avatar').getAttribute('entrance')),declaration);
  assert.match(html,/#reference-target\{box-sizing:border-box/);assert.match(html,/background:#e2e8f0/);assert.match(html,/width:min\(72px,18vw\)/);
  assert.doesNotMatch(html,/\.enter\(/);assert.doesNotMatch(html,/<SidekickAvatar/);
  const react=referenceSource(scene,{entrance:declaration},'react','state-entrance');
  const props=JSON.parse(react.split('const avatarProps = ')[1].split(';\n\nexport')[0]);
  assert.deepEqual(props.entrance,declaration);assert.doesNotMatch(react,/<sidekick-avatar/);assert.doesNotMatch(react,/useEffect|\.enter\(/);
  dom.window.close();
 }
 for(const declaration of [{source:'viewport',edge:'above'},{source:'viewport',edge:'left',at:2},{source:'element',target:'',direction:'right'},{source:'element',target:'#reference-target',direction:'right',gap:-1},{source:'viewport',edge:'left',gap:10}])assert.throws(()=>validateStateValue(field,declaration,scene));
});

test('lifecycle reference validates public JSON and preserves matching typed React props',()=>{
 const document=new JSDOM().window.document;
 const valid={presence:{visible:false},task:{id:'save-1',status:'pending',behavior:{type:'wait',target:'#reference-target'}},home:{positioning:{target:'viewport',placement:'bottom-right'},rest:{gaze:{target:'#reference-target'}},returnOn:['success','error','cancelled']}};
 for(const [key,value]of Object.entries(valid))assert.deepEqual(validateStateValue(FIELD_BY_KEY.get(key),value,scene,document),value);
 for(const [key,value]of [['presence',{visible:'false'}],['task',{id:1,status:'complete'}],['home',{positioning:{target:'viewport'},rest:{behavior:{type:'follow',target:'#reference-target'}}}]])assert.throws(()=>validateStateValue(FIELD_BY_KEY.get(key),value,scene,document));
 const attributes=compileReferenceAttributes(scene,valid);assert.equal(attributes.placement,'viewport');
 const props=referenceReactProps(attributes);for(const key of ['presence','task','home'])assert.deepEqual(props[key],valid[key]);
 const html=referenceSource(scene,valid,'element','state-lifecycle'),dom=new JSDOM(html);
 for(const key of ['presence','task','home'])assert.deepEqual(JSON.parse(dom.window.document.querySelector('sidekick-avatar').getAttribute(key)),valid[key]);
 assert.match(html,/sidekick@v0\.15\.0/);dom.window.close();
});
