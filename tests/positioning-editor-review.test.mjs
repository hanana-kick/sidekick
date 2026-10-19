import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import * as schema from '../playground/state-reference-schema.js';
import * as framework from '../playground/site-framework.js';
import {guideHref} from '../playground/guide-navigation.js';
import {stateLessons} from '../playground/guide-state-lessons.js';
import {stateCopy} from '../playground/state-reference-copy.js';
import {guideTranslations} from '../playground/guide-translations.js';
import {createScene} from '../src/core/scene.ts';
function mount(){
 const dom=new JSDOM('<main></main><div id="reference-target"></div><div class="reference-item"></div>',{url:'https://example.test/guide.html#state-position',runScripts:'outside-only'}),w=dom.window;
 Object.assign(w,schema,framework,{guideHref,stateLessons,stateCopy,guideTranslations,structuredClone,getSiteLocale:()=> 'en',subscribeSiteLocale:()=>()=>{}});
 w.IntersectionObserver=class{observe(){}disconnect(){}};
 const script=readFileSync(new URL('../playground/state-reference.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/export /g,'');
 const fn=w.eval('(function(){'+script+';return mountStateReference;})()');const dispose=fn(w.document.querySelector('main'),'state-position',{session:{scene:createScene()}});
 const get=selector=>w.document.querySelector(selector),field=key=>get(`[data-state-control="${key}"]`),enabled=key=>get(`[data-state-enable="${key}"]`),control=key=>get(`[data-positioning-control="${key}"]`),change=el=>el.dispatchEvent(new w.Event('change',{bubbles:true}));
 const values=()=>JSON.parse(new URL(w.location.href).searchParams.get('state')).values;
 return{w,get,field,enabled,control,change,values,close(){dispose();dom.window.close();}};
}
test('positioning custom JSON target survives subsequent simple-control edits',()=>{
 const x=mount();try{
  x.enabled('positioning').checked=true;x.change(x.enabled('positioning'));
  x.field('positioning').value=JSON.stringify({target:'.reference-item',placement:'center-right',gap:20,offset:{x:3,y:4},follow:false});
  x.get('[data-state-field="positioning"] button').click();
  assert.equal(x.values().positioning.target,'.reference-item');
  x.control('gap').value='24';x.change(x.control('gap'));
  assert.equal(x.values().positioning.gap,24,'simple gap editing should not reject accepted target');
  assert.equal(x.values().positioning.target,'.reference-item');
  assert.deepEqual(x.values().positioning.offset,{x:3,y:4});
 }finally{x.close();}
});
test('positioning and coordinate controls exclude each other and reset to neutral source',()=>{
 const x=mount();try{
  x.enabled('positioning').checked=true;x.change(x.enabled('positioning'));
  x.enabled('position-x').checked=true;x.field('position-x').value='30';x.change(x.enabled('position-x'));
  assert.equal(x.values()['position-x'],30);assert.equal(x.values().positioning,undefined);assert.equal(x.enabled('positioning').checked,false);
  x.enabled('positioning').checked=true;x.change(x.enabled('positioning'));
  assert.equal(x.values()['position-x'],undefined);assert.equal(x.enabled('position-x').checked,false);
  x.get('[data-state-text="reset"]').click();assert.deepEqual(x.values(),{});assert.equal(x.control('target').value,'viewport');assert.equal(x.control('gap').value,'16');
 }finally{x.close();}
});
test('positioning simple controls follow the explicit enable checkbox and reset',()=>{
 const x=mount();try{
  assert.equal(x.field('position-x').disabled,true);assert.equal(x.field('position-y').disabled,true);
  assert.doesNotMatch(x.get('.state-lab-source-panel').textContent,/JSX/);
  const disabled=value=>{for(const key of ['target','placement','gap','follow'])assert.equal(x.control(key).disabled,value,key);};
  disabled(true);x.enabled('positioning').checked=true;x.change(x.enabled('positioning'));disabled(false);
  x.enabled('positioning').checked=false;x.change(x.enabled('positioning'));disabled(true);
  x.enabled('positioning').checked=true;x.change(x.enabled('positioning'));disabled(false);
  x.enabled('position-x').checked=true;x.change(x.enabled('position-x'));disabled(true);
  x.enabled('positioning').checked=true;x.change(x.enabled('positioning'));disabled(false);
  x.get('[data-state-text="reset"]').click();disabled(true);
 }finally{x.close();}
});
