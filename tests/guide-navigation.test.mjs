import test from 'node:test';
import assert from 'node:assert/strict';
import { guideIds, readGuideContext, readGuideSource, validateGuideContext, guideHref, technicalHref, lessonDestinations, navigationText } from '../playground/guide-navigation.js';
import { scenarios } from '../playground/scenario-catalog.js';
import { lessons } from '../playground/guide-lessons.js';
for(const language of ['ko','en','zh-CN','ja'])test(`all 26 sections and progressive levels preserve typed context: ${language}`,()=>{
 assert.equal(guideIds.length,26);
 for(const id of guideIds)for(const level of [1,2,3,4]){
  const context={id,level,side:'right',gap:28,dwell:2300,intensity:0.3,duration:1700,event:0,scroll:640};
  const url=guideHref(context,language,true);assert.deepEqual(readGuideContext(url),context);assert.deepEqual(readGuideSource(url),context);
  assert.equal(new URL(url,'https://test.invalid/').searchParams.get('lang'),language);
 }
 for(const lesson of lessons){const destination=new URL(technicalHref(lesson.id,language,{id:lesson.id,level:1,scroll:640}),'https://test.invalid/');assert.equal(readGuideSource(destination.href).id,lesson.id);assert.equal(readGuideSource(destination.href).scroll,640);const map=lessonDestinations[lesson.id];if(map.id)assert.equal(destination.hash,'#'+map.id);else if(map.preset)assert.equal(destination.searchParams.get('lesson'),map.preset);else assert.equal(destination.pathname,'/index.html');}
 assert.deepEqual(Object.keys(navigationText[language]).sort(),Object.keys(navigationText.ko).sort());
});
test('untrusted context cannot carry methods, scripts, arbitrary selectors or navigation',()=>{
 assert.equal(readGuideContext('https://test/?context=%7B'),null);
 assert.equal(validateGuideContext({id:'missing'}),null);
 assert.equal(readGuideContext('https://test/?context='+encodeURIComponent('x'.repeat(3001))),null);
 const clean=validateGuideContext({id:'loading',level:99,method:'remove',target:'body',url:'javascript:alert(1)',event:0.5,gap:Infinity,events:['unknown']});assert.deepEqual(clean,{id:'loading',level:1});
 assert.ok(!guideHref({id:'loading',method:'remove'},'en',true).includes('remove'));
});
