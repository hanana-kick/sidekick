import {workflowIds,workflowRows,workflowSource} from '../playground/application-workflows.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';
import * as framework from '../playground/site-framework.js';
import { reactExample, scenarioCode, lessonCode } from '../playground/guide-framework-code.js';
import { scenarios } from '../playground/scenario-catalog.js';
import { lessons, lessonById } from '../playground/guide-lessons.js';
import { emotionFlowById, emotionMarkup, emotionCode } from '../playground/emotion-scenarios.js';
const source=readFileSync(new URL('../playground/use-cases.js',import.meta.url),'utf8');
const extract=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end));
const getMarkup=new Function('emotionFlowById','emotionMarkup','t', `const card=content=>'<div class="app-card">'+content+'</div>'; const row=(id,title,description='')=>'<button id="'+id+'" class="target-item">'+title+description+'</button>';${extract('function applicationMarkup(', 'function declarationFor(')};return applicationMarkup;`)(emotionFlowById,emotionMarkup,key=>key);
const getDeclaration=new Function('emotionFlowById',extract('function declarationFor(', 'function eventCode(')+';return declarationFor;')(emotionFlowById);
const getEvents=new Function('emotionFlowById','emotionCode','workflowIds','workflowRows','workflowSource','t',extract('function eventCode(', 'function declare(')+';return eventCode;')(emotionFlowById,emotionCode,workflowIds,workflowRows,workflowSource,key=>key);
const dom=new JSDOM('<!doctype html>');globalThis.document=dom.window.document;
test('framework validation and links preserve route, locale, bounded context and hash',()=>{
 assert.equal(framework.normalizeFramework('React'),null);assert.equal(framework.getFramework(),'element');
 const href=framework.frameworkHref('./guide.html?lang=ja&context=%7B%22id%22%3A%22loading%22%7D#loading','react');
 const url=new URL(href,'https://example.com');assert.equal(url.searchParams.get('framework'),'react');assert.equal(url.searchParams.get('lang'),'ja');assert.equal(url.hash,'#loading');
 assert.throws(()=>framework.setFramework('invalid'),RangeError);
 let count=0;const stop=framework.subscribeFramework(()=>count++);framework.setFramework('react');framework.setFramework('react');framework.setFramework('element');stop();assert.equal(count,2);
});
for(const item of scenarios)test(`selected framework has compilable complete ${item.id} source`,async()=>{
 const flow=emotionFlowById(item.id),markup=getMarkup(item.id),declaration=flow?emotionCode(flow):`const bot = document.querySelector('#demo-bot');\nbot.behavior = ${JSON.stringify(getDeclaration(item))};`;
 for(const source of [declaration,declaration+'\n'+getEvents(item.id)]){
  framework.setFramework('react');const react=scenarioCode(source,markup);assert.match(react,/<SidekickAvatar ref=/);assert.match(react,/useEffect/);assert.match(react,/cleanup.forEach/);assert.doesNotMatch(react,/<sidekick-avatar/);
  await transform(react,{loader:'jsx',format:'esm'});
  framework.setFramework('element');const html=scenarioCode(source,markup);assert.match(html,/<sidekick-avatar/);assert.doesNotMatch(html,/<SidekickAvatar/);const js=html.match(/<script type="module">([\s\S]+)<\/script>/)[1];await transform(js,{loader:'js',format:'esm'});
 }
});
for(const lesson of lessons.filter(x=>!x.id.startsWith('state-')))test(`direct lesson ${lesson.id} respects framework mode`,async()=>{
 framework.setFramework('react');const source=lessonCode(lesson,lessonById('html-start'));assert.match(source,/<SidekickAvatar/);assert.doesNotMatch(source,/<sidekick-avatar/);await transform(source,{loader:'tsx',format:'esm'});
 framework.setFramework('element');const element=lessonCode(lesson,lessonById('html-start'));assert.doesNotMatch(element,/<SidekickAvatar/);
});
test('JSX serialization handles styling, inputs and removes translation metadata',async()=>{
 const text=reactExample('bot.paused = true;','<label for="a">Name<input id="a" value="hello" autocomplete="off" style="max-width:100%" data-guide-label="name"></label>');
 assert.match(text,/htmlFor/);assert.match(text,/defaultValue/);assert.match(text,/maxWidth/);assert.doesNotMatch(text,/data-guide/);await transform(text,{loader:'jsx'});
});
test('URL preference, storage, invalid query fallback and cross-tab changes preserve context',async()=>{
 const page=new JSDOM('',{url:'https://example.com/guide.html?lang=ja&framework=react&context=%7B%22id%22%3A%22loading%22%7D#loading'});
 const keys=['window','location','history','localStorage'],previous=keys.map(key=>globalThis[key]);
 for(const key of keys)globalThis[key]=page.window[key]??page.window;
 try {
  const module=await import('../playground/site-framework.js?preference-test');
  assert.equal(module.getFramework(),'react');assert.equal(localStorage.getItem(module.FRAMEWORK_STORAGE_KEY),'react');
  let n=0;module.subscribeFramework(()=>n++);module.setFramework('element');
  assert.equal(location.hash,'#loading');assert.equal(new URL(location.href).searchParams.get('lang'),'ja');assert.equal(new URL(location.href).searchParams.get('context'),'{"id":"loading"}');
  page.window.dispatchEvent(new page.window.StorageEvent('storage',{key:module.FRAMEWORK_STORAGE_KEY,newValue:'react'}));assert.equal(module.getFramework(),'react');assert.equal(n,2);
  history.replaceState(null,'','?framework=invalid#loading');const fallback=await import('../playground/site-framework.js?invalid-query-test');assert.equal(fallback.getFramework(),'element');
 } finally {keys.forEach((key,i)=>{if(previous[i]===undefined)delete globalThis[key];else globalThis[key]=previous[i];});page.window.close();}
});
