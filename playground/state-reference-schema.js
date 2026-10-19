import { MATERIAL_SHAPE_NAMES } from '../src/core/shapes.ts';
import { EYE_EXPRESSIONS } from '../src/core/expressions.ts';
import { EMOTIONS } from '../src/core/emotion.ts';
import { ACTIVITIES, parseDesign } from '../src/core/design.ts';
import { parseScene } from '../src/core/scene.ts';
import { validateBehavior } from '../src/element/behavior.ts';
import { resolveSidekickAttributes } from '../src/element/attributes.ts';
import { MotionTimeline } from '../src/core/motion.ts';

// One finite schema feeds controls, tables, validators and both source generators.
// Values omitted from an example inherit the Studio scene or the public default.
const camel = name => name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
const field = (attribute, kind, initial, options = {}) => ({ attribute, prop: camel(attribute), kind, initial, ...options });
const select = (key, initial, values, extra = {}) => field(key, 'select', initial, { values, ...extra });
const number = (key, initial, min, max, step = 1, unit = '') => field(key, 'number', initial, { min, max, step, unit });
const weight = key => number(key, 0, 0, 1, 0.05);
const duration = (key, initial) => number(key, initial, 0, 60000, 50, 'ms');
const color = key => field(key, 'color', key === 'body-color' ? '#FFCC37' : '#202020');
const json = (key, initial, extra = {}) => field(key, 'json', initial, extra);
export const STATE_FIELDS = Object.freeze({
 'state-emotion': [select('emotion', 'neutral', EMOTIONS), number('emotion-intensity', 1, 0, 1, 0.05)],
 'state-position': [select('placement', 'inline', ['inline', 'viewport']), number('position-x', 0, -10000000, 10000000, 1, 'px'), number('position-y', 0, -10000000, 10000000, 1, 'px'), select('movement-bounds', 'viewport', ['viewport', 'none'])],
 'state-behavior': [json('behavior', { type: 'wait', target: '#reference-target', side: 'right', gap: 16 }, { nullable: true })],
 'state-facing': [select('tracking-mode', 'eyes-and-body', ['off', 'eyes', 'eyes-and-body']), number('gaze-x', 0, -1, 1, 0.05), number('gaze-y', 0, -1, 1, 0.05), select('body-orientation', 'front', ['front', 'three-quarter', 'side']), number('body-yaw', 0, -360, 360, 1, 'deg'), number('body-pitch', 0, -90, 90, 1, 'deg'), number('body-roll', 0, -180, 180, 1, 'deg'), number('zoom', 1, 0.5, 3, 0.05), field('mouse-tracking', 'boolean', false, { legacy: true })],
 'state-appearance': [json('design', null), select('shape', 'square', MATERIAL_SHAPE_NAMES), color('body-color'), color('eye-color'), ...['expression', 'left-expression', 'right-expression'].map(key => select(key, 'neutral', EYE_EXPRESSIONS)), ...['smile', 'blink', 'left-smile', 'right-smile', 'left-blink', 'right-blink'].map(weight), json('accessories', []), ...Object.entries({head: ['beret', 'halo', 'crown'], eyes: ['glasses', 'sunglasses'], mouth: ['moustache', 'goatee'], neck: ['bowTie', 'scarf', 'necklace'], 'left-ear': ['earring', 'starEarring'], 'right-ear': ['earring', 'starEarring']}).flatMap(([slot, values]) => [select(`${slot}-accessory`, 'none', ['none', ...values]), color(`${slot}-color`)])],
 'state-execution': [select('activity', 'idle', ACTIVITIES), number('move-max-speed', 1350, 1, 100000, 10, 'px/s'), number('move-acceleration', 1800, 1, 100000, 10, 'px/s²'), number('move-deceleration', 2200, 1, 100000, 10, 'px/s²'), duration('move-duration', 0), select('move-travel', 'natural', ['natural', 'none']), select('move-easing', 'smooth', ['smooth', 'linear']), duration('shape-duration', 450), select('shape-easing', 'smooth', ['smooth', 'linear']), duration('motion-duration', 400), select('motion-easing', 'smooth', ['smooth', 'linear']), json('motion', {}), field('paused', 'boolean', false), select('interaction', 'none', ['none', 'box']), number('time', 0, 0, 86400, 0.1, 's'), select('render-style', 'flat', ['flat', '3d'], { legacy: true })],
});
export const STATE_IDS = Object.freeze(Object.keys(STATE_FIELDS));
export const ALL_STATE_FIELDS = Object.freeze(Object.values(STATE_FIELDS).flat());
export const FIELD_BY_KEY = new Map(ALL_STATE_FIELDS.map(item => [item.attribute, item]));
export const READ_ONLY_STATE = Object.freeze(['behaviorState', 'emotionState', 'movementState']);
export const REFERENCE_TARGET_HTML = '<div id="reference-target">Target</div><ol id="reference-list"><li class="reference-item">Item 1</li><li class="reference-item">Item 2</li><li class="reference-item">Item 3</li></ol>';
export const REFERENCE_CSS = `html,body{margin:0;min-height:100%;font:14px system-ui;color:#334155}body{padding:16px;box-sizing:border-box;background:#f8fafc}#reference-root{position:relative;min-height:280px}#reference-target{margin-left:16px;width:84px;padding:10px;border:1px solid #cbd5e1;border-radius:6px}#reference-list{position:absolute;right:8px;top:70px;width:100px;padding:0;list-style:none}.reference-item{margin:6px 0;padding:8px;border:1px solid #cbd5e1;border-radius:6px}#reference-bot{display:block;width:144px;height:144px;margin:48px 0 0 12px}`;

export function stateBaseAttributes(input) {
 const scene = parseScene(input);
 return { design: scene.design, 'body-yaw': scene.bodyOrientation.yaw, 'body-pitch': scene.bodyOrientation.pitch, 'body-roll': scene.bodyOrientation.roll, zoom: scene.zoom, activity: scene.activity, paused: scene.paused, 'tracking-mode': scene.trackingMode, interaction: scene.interaction, 'render-style': scene.renderStyle, 'gaze-x': scene.gaze.x, 'gaze-y': scene.gaze.y, time: scene.time, motion: scene.motion, 'shape-duration': scene.shapeDuration, 'shape-easing': scene.shapeEasing, 'motion-duration': scene.motionDuration, 'motion-easing': scene.motionEasing };
}
export function fieldDefault(item, scene) {
 const base=stateBaseAttributes(scene);
 if(Object.hasOwn(base,item.attribute)) return structuredClone(base[item.attribute]);
 const design=scene.design, key=item.attribute;
 if(key==='shape')return design.body.shape;
 if(key==='body-color')return design.body.color;
 if(key==='eye-color')return design.eyes.color;
 if(key==='accessories')return structuredClone(design.accessories);
 const weights=key.match(/^(left|right)-(smile|blink)$/);
 if(weights)return design.eyes[weights[1]].weights[weights[2]];
 return structuredClone(item.initial);
}
export function validateStateValue(item, value, scene, document) {
 if(item.kind==='number') { if(typeof value!=='number'||!Number.isFinite(value)||value<item.min||value>item.max)throw new RangeError(`${item.attribute}: ${item.min}…${item.max}`); }
 else if(item.kind==='select'){if(!item.values.includes(value))throw new TypeError(`${item.attribute}: ${item.values.join(' | ')}`);}
 else if(item.kind==='boolean'){if(typeof value!=='boolean')throw new TypeError(`${item.attribute}: boolean`);}
 else if(item.kind==='color'){if(typeof value!=='string'||!/^#[\da-f]{6}$/i.test(value))throw new TypeError(`${item.attribute}: #RRGGBB`);}
 else if(item.kind==='json'){
  const encoded=JSON.stringify(value);if(!encoded||encoded.length>65536)throw new RangeError('JSON: ≤65536 characters');
  if(item.attribute==='design')parseDesign(value);
  if(item.attribute==='accessories')parseDesign({...scene.design,accessories:value});
  if(item.attribute==='behavior'&&value!==null){if(!document)throw new Error('Document required');validateBehavior(value,document);}
  if(item.attribute==='motion'){const timeline=new MotionTimeline({left:scene.design.eyes.left,right:scene.design.eyes.right});void timeline.to(value,{duration:0});}
 }
 return structuredClone(value);
}
export function compileReferenceAttributes(scene, edits) {
 const attributes=stateBaseAttributes(scene);
 // A preset has precedence over inherited angles, while explicitly enabled angles win.
 if(Object.hasOwn(edits,'mouse-tracking')&&!Object.hasOwn(edits,'tracking-mode'))delete attributes['tracking-mode'];
 if(Object.hasOwn(edits,'body-orientation'))for(const axis of ['yaw','pitch','roll'])delete attributes[`body-${axis}`];
 for(const [key,value] of Object.entries(edits)){if(value===undefined)continue;if(!FIELD_BY_KEY.has(key))throw new TypeError(`Unknown state field: ${key}`);attributes[key]=structuredClone(value);}
 const resolved=resolveSidekickAttributes(new Map(Object.entries(attributes).filter(([key,value])=>key!=='behavior'&&value!==undefined).map(([key,value])=>[key,attributeText(value)])));
 if(attributes.motion?.accessories){
  const available=new Set(resolved.design.accessories.map(item=>item.id));
  if(Object.hasOwn(edits,'motion')){for(const id of Object.keys(attributes.motion.accessories))if(!available.has(id))throw new TypeError(`Unknown accessory: ${id}`);}
  else attributes.motion.accessories=Object.fromEntries(Object.entries(attributes.motion.accessories).filter(([id])=>available.has(id)));
 }
 return attributes;
}
export function referenceReactProps(attributes){return Object.fromEntries(Object.entries(attributes).filter(([,value])=>value!==undefined).map(([key,value])=>[FIELD_BY_KEY.get(key)?.prop??camel(key),value]));}
export const attributeText = value => typeof value==='object'?JSON.stringify(value):String(value);
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const safeJSON = value => JSON.stringify(value,null,2).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
export function referenceSource(scene, edits, framework='element') {
 const attributes=compileReferenceAttributes(scene,edits);
 if(framework==='react')return `import { SidekickAvatar } from '@hanana-kick/sidekick/react';\n\nconst avatarProps = ${safeJSON(referenceReactProps(attributes))};\n\nexport default function StateExample() {\n  return (\n    <>\n      <style>{${JSON.stringify(REFERENCE_CSS)}}<\/style>\n      <div id="reference-root">\n        <div id="reference-target">Target</div>\n        <ol id="reference-list">\n          {[1, 2, 3].map(item => <li className="reference-item" key={item}>Item {item}</li>)}\n        </ol>\n        <SidekickAvatar id="reference-bot" {...avatarProps} />\n      </div>\n    </>\n  );\n}`;
 return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<style>${REFERENCE_CSS}</style>\n<script type="module">\n  import '@hanana-kick/sidekick/auto';\n<\/script>\n</head>\n<body>\n<div id="reference-root">\n  ${REFERENCE_TARGET_HTML}\n  <sidekick-avatar id="reference-bot"\n${Object.entries(attributes).filter(([key,value])=>!(key==='behavior'&&value===null)).map(([key,value])=>`    ${key}="${escape(attributeText(value))}"`).join('\n')}>\n  </sidekick-avatar>\n</div>\n</body>\n</html>`;
}
