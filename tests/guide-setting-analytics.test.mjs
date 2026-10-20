import test from 'node:test';
import assert from 'node:assert/strict';
import { guideSettingCategories } from '../playground/guide-setting-analytics.js';
test('Guide accepted controls project only fixed categories and numeric buckets', () => {
 assert.deepEqual(guideSettingCategories('size', 200), [{setting_key:'size',value_category:'medium'}]);
 assert.deepEqual(guideSettingCategories('positioning', {target:'.private-email',gap:-20,placement:'center',follow:true,offset:{x:123,y:456}}), [
  {setting_key:'positioning_placement',value_category:'center'}, {setting_key:'positioning_gap',value_category:'negative'}, {setting_key:'positioning_follow',value_category:'true'}]);
 assert.deepEqual(guideSettingCategories('behavior', {type:'follow',target:'#private',side:'right',gap:16}), [
  {setting_key:'behavior_type',value_category:'follow'}, {setting_key:'behavior_side',value_category:'right'}, {setting_key:'behavior_gap',value_category:'medium'}]);
 assert.deepEqual(guideSettingCategories('entrance', {source:'element',target:'.secret',direction:'left',gap:20}), [
  {setting_key:'entrance_source',value_category:'element'}, {setting_key:'entrance_side',value_category:'left'}, {setting_key:'entrance_distance',value_category:'medium'}]);
});
test('Guide rejects freeform, unknown, invalid and accessor values without invoking code', () => {
 for (const key of ['design','accessories','color','gaze-x','position-x','target','__proto__']) assert.deepEqual(guideSettingCategories(key,'secret'), []);
 for (const value of [NaN,Infinity,-1,'200',50000]) assert.deepEqual(guideSettingCategories('size',value), []);
 assert.deepEqual(guideSettingCategories('behavior', {get type(){throw Error('read getter')}}), []);
 assert.deepEqual(guideSettingCategories('positioning',null), []);
});

import * as framework from '../playground/site-framework.js';
import { guideHref } from '../playground/guide-navigation.js';
import { guideTranslations } from '../playground/guide-translations.js';
import { JSDOM } from 'jsdom';
import { installStateReferenceHarness } from './state-reference-harness.mjs';
import { createScene } from '../src/core/scene.ts';
test('real Guide controls report only accepted explicit changes, not initial/default/rerun', () => {
 const dom=new JSDOM('<main></main>',{url:'https://sidekick.hananakick.cc/guide.html#state-facing',runScripts:'outside-only'}),win=dom.window;
 Object.assign(win,framework,{guideHref,guideTranslations,getSiteLocale:()=>'en',subscribeSiteLocale:()=>()=>{}});
 installStateReferenceHarness(win);
 const calls=[];win.recordGuideSetting=(_win,section,key,value,source)=>calls.push({section,key,value,source});
 const dispose=win.mountStateReference(win.document.querySelector('main'),'state-facing',{session:{scene:createScene()}});
 try {
  assert.equal(calls.length,0);
  const input=win.document.querySelector('[data-state-control="size"]'),enabled=win.document.querySelector('[data-state-enable="size"]');
  enabled.checked=true;enabled.dispatchEvent(new win.Event('change',{bubbles:true}));
  assert.equal(calls.length,1);assert.equal(calls[0].key,'size');assert.equal(calls[0].value,200);
  input.value='-1';input.dispatchEvent(new win.Event('change',{bubbles:true}));assert.equal(calls.length,1);
  input.value='300';input.dispatchEvent(new win.Event('change',{bubbles:true}));assert.equal(calls.length,2);assert.equal(calls[1].value,300);
  win.document.querySelector('[data-state-text="reset"]').click();assert.equal(calls.length,2);
 } finally {dispose();win.close();}
});

test('Guide color controls project families only and drop invalid color strings', () => {
 for (const [attribute,key] of [['body-color','body_color_family'],['eye-color','eye_color_family'],['left-ear-color','accessory_left_ear_color_family']]) {
  assert.deepEqual(guideSettingCategories(attribute,'#FF0000'),[{setting_key:key,value_category:'red'}]);
  for(const value of ['secret','#fff','#ffffffff','rgb(255,0,0)',null]) assert.deepEqual(guideSettingCategories(attribute,value),[]);
 }
});
