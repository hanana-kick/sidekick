import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import { lifecycleDefaults, lifecycleMarkup, lifecycleLabels, lifecycleCSS, lifecycleSource, installLifecycleExample, refreshLifecycleLabels } from '../playground/lifecycle-example.js';
import { codeForAction, executeAction } from '../playground/playground-actions.js';
import { guideTranslations } from '../playground/guide-translations.js';
import { lifecycleLesson } from '../playground/guide-lifecycle-lesson.js';
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
 const dom=new JSDOM(`<div id="root">${lifecycleMarkup('en')}</div>`);
 const root=dom.window.document.querySelector('#root'), bot=new dom.window.EventTarget();
 Object.assign(bot, {home:structuredClone(lifecycleDefaults.home),presence:{visible:true},lifecycleState:{phase:'resting',taskId:null,taskStatus:null}});
 const tasks=[];
 Object.defineProperty(bot,'task',{get:()=>tasks.at(-1),set:value=>tasks.push(value)});
 const cleanup=installLifecycleExample(bot,root,lifecycleLabels.en);
 const click=action=>root.querySelector(`[data-lifecycle-action="${action}"]`).click();
 return {dom,root,bot,tasks,cleanup,click};
}
test('app owns async completion, cancellation and newest-id protection with no manual return commands',async()=>{
 const f=fixture();try{
  assert.equal(f.tasks.length,0);
  f.click('wait');assert.deepEqual(f.bot.task,{id:1,status:'pending',behavior:{type:'wait',target:'#reference-target',side:'left',gap:8}});
  await tick();assert.equal(f.bot.task.status,'pending','a timer cannot invent app success');
  f.click('success');f.click('follow');await tick();assert.equal(f.bot.task.id,2);assert.equal(f.bot.task.status,'pending');assert.equal(f.tasks.some(t=>t.id===1&&t.status==='success'),false);
  f.click('cancel');await tick();assert.deepEqual(f.bot.task,{id:2,status:'cancelled'});
  f.click('wait');f.click('error');await tick();assert.deepEqual(f.bot.task,{id:3,status:'error'});
  f.click('wait');f.click('success');await tick();assert.deepEqual(f.bot.task,{id:4,status:'success'});
  f.click('follow');assert.equal(f.bot.task.id,5,'new work can begin while the runtime returns home');
  f.cleanup();f.click('success');await tick();assert.equal(f.bot.task.status,'pending','disposed work never writes a stale terminal state');
 }finally{f.dom.window.close();}
});
test('presence and moving/remounted home controls declare intent without coordinate arithmetic',()=>{
 const f=fixture();try{
  f.click('visible');assert.deepEqual(f.bot.presence,{visible:false});f.click('visible');assert.deepEqual(f.bot.presence,{visible:true});
  const home=f.root.querySelector('#reference-home');f.click('move-home');assert.equal(home.hasAttribute('data-moved'),true);
  f.click('mount-home');assert.equal(home.isConnected,false);f.click('mount-home');assert.equal(home.isConnected,true);assert.equal(f.bot.home.positioning.target,'#reference-home[data-lifecycle-mount="1"]');
  f.click('wait');refreshLifecycleLabels(f.root,'ja');assert.equal(f.root.querySelector('#lifecycle-app-status').textContent,lifecycleLabels.ja[11]);
 }finally{f.cleanup();f.dom.window.close();}
});
for(const locale of ['ko','en','zh-CN','ja'])test(`lifecycle guide and complete generated HTML/React stay localized and runnable: ${locale}`,()=>{
 for(const value of [lifecycleLesson.title,lifecycleLesson.sentence,lifecycleLesson.hint,...lifecycleLesson.paragraphs,...lifecycleLesson.parameters.map(row=>row[3])])assert.ok(guideTranslations[locale][value],value);
 const attributes={placement:'viewport',...lifecycleDefaults,task:null};
 for(const framework of ['element','react']){
  const source=lifecycleSource(attributes,lifecycleCSS,framework,locale);
  assert.ok(source.includes(lifecycleLabels[locale][2]));
  assert.doesNotMatch(source,/\.moveTo\(|\.moveToElement\(|\.reactTo\(|getBoundingClientRect|setTimeout/);
  if(framework==='react'){
   assert.match(source,/presence=\{presence\} task=\{task\} home=\{home\}/);
   const result=ts.transpileModule(source,{fileName:'example.tsx',reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
   assert.deepEqual(result.diagnostics?.filter(item=>item.category===ts.DiagnosticCategory.Error),[]);
  }else{
   const dom=new JSDOM(source);const avatar=dom.window.document.querySelector('sidekick-avatar');
   assert.deepEqual(JSON.parse(avatar.getAttribute('home')),lifecycleDefaults.home);
   const script=dom.window.document.querySelector('script').textContent.replace(/^import .*;$/m,'');assert.doesNotThrow(()=>new Function(script));dom.window.close();
  }
 }
});
test('API playground lifecycle action executes the declarations shown by both source generators',()=>{
 const declarations={home:lifecycleDefaults.home,presence:lifecycleDefaults.presence,task:null};
 const action={lifecycle:true,locale:'en',steps:Object.entries(declarations).map(([property,value])=>({property,value}))};
 const bot={};executeAction(bot,action);assert.deepEqual(bot,declarations);
 for(const format of ['javascript','react']){const source=codeForAction(action,format);assert.match(source,/installLifecycleExample/);assert.match(source,/status: 'success'/);assert.match(source,/status: 'cancelled'/);}
});
