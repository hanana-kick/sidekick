import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { transform } from 'esbuild';
import { setFramework } from '../playground/site-framework.js';
import { exampleStyles, installExampleStyles, installExampleLayout, scenarioCode } from '../playground/guide-framework-code.js';
import { scenarios } from '../playground/scenario-catalog.js';
import { emotionFlowById, emotionMarkup } from '../playground/emotion-scenarios.js';
const controller=readFileSync(new URL('../playground/use-cases.js',import.meta.url),'utf8');
const section=(start,end)=>controller.slice(controller.indexOf(start),controller.indexOf(end));
const markupFor=new Function('emotionFlowById','emotionMarkup','t',`const card=content=>'<div class="app-card">'+content+'</div>';const row=(id,title,description='')=>'<button class="target-item" id="'+id+'">'+title+'<small>'+description+'</small></button>';${section('function applicationMarkup(', 'function declarationFor(')};return applicationMarkup;`)(emotionFlowById,emotionMarkup,key=>key);

test('live examples install one scoped stylesheet, with no separate stale avatar dimensions',()=>{
 const dom=new JSDOM('<!doctype html><head></head><body><label id="outside">Outside</label><div id="demo-app"><label id="inside">Name<input></label></div></body>');
 try {
  assert.equal(installExampleStyles(dom.window.document),installExampleStyles(dom.window.document));
  assert.equal(dom.window.document.querySelectorAll('#sidekick-example-styles').length,1);
  assert.equal(dom.window.document.querySelector('style').textContent,exampleStyles);
  assert.equal(dom.window.getComputedStyle(dom.window.document.querySelector('#inside')).display,'block');
  assert.notEqual(dom.window.getComputedStyle(dom.window.document.querySelector('#outside')).display,'block');
  assert.match(exampleStyles,/--demo-bot-size: clamp\(64px, 20vw, 120px\)/);
  const chrome=readFileSync(new URL('../playground/use-cases.css',import.meta.url),'utf8');
  assert.doesNotMatch(chrome,/[.#](?:demo-app|demo-bot|app-card|emotion-card)\s*\{/);
 }finally{dom.window.close();}
});

test('copied examples follow applied geometry and retain their rail after completion',()=>{
 const dom=new JSDOM('<div id="demo-app" data-side="left"><sidekick-avatar></sidekick-avatar></div>');
 const bot=dom.window.document.querySelector('sidekick-avatar'),app=bot.parentElement;
 const stop=installExampleLayout(bot);
 for(const side of ['left','right','above','below']){
  bot.behavior={type:'guide',target:'#field',side,gap:28};bot.dispatchEvent(new dom.window.Event('sidekick-behavior-change'));
  assert.equal(app.dataset.side,side);assert.equal(app.style.getPropertyValue('--behavior-gap'),'28px');
 }
 bot.behavior={type:'celebrate'};bot.dispatchEvent(new dom.window.Event('sidekick-behavior-change'));assert.equal(app.dataset.side,'below');
 stop();bot.behavior={type:'guide',target:'#field',side:'right'};bot.dispatchEvent(new dom.window.Event('sidekick-behavior-change'));assert.equal(app.dataset.side,'below');dom.window.close();
});

for(const item of scenarios)test(`${item.id} includes identical standalone layout in both frameworks`,async()=>{
 const dom=new JSDOM('<!doctype html>');globalThis.document=dom.window.document;
 try{
  setFramework('element');
  const source=scenarioCode("bot.behavior = {type:'wait',target:'#target',side:'right',gap:28};",markupFor(item.id),{layout:{side:'right',gap:28}});
  const html=new JSDOM(source),root=html.window.document.querySelector('#demo-app');
  assert.equal(html.window.document.querySelector('style').textContent.trim(),exampleStyles);
  assert.equal(root.dataset.side,'right');assert.equal(root.style.getPropertyValue('--behavior-gap'),'28px');
  assert.equal(root.querySelector('sidekick-avatar').className,'demo-bot');assert.equal(root.querySelector('sidekick-avatar').style.width,'');
  assert.ok(root.querySelector('.app-card'));assert.match(source,/observer\.disconnect\(\)/);html.window.close();
  setFramework('react');const react=scenarioCode('bot.paused = true;',markupFor(item.id),{layout:{side:'right',gap:28}});
  assert.ok(react.includes(JSON.stringify(exampleStyles)));assert.match(react,/data-side="right"/);assert.match(react,/className="demo-bot"/);assert.doesNotMatch(react,/width: 140/);
  await transform(react,{loader:'jsx',format:'esm'});
 }finally{setFramework('element');dom.window.close();delete globalThis.document;}
});

test('removing a copied example during async scene setup cannot install an orphan workflow',async()=>{
 setFramework('element');
 const source=scenarioCode("const disposeWorkflow = (() => { window.workflowStarts++; return () => window.workflowStops++; })();",'<div class="app-card">Example</div>',{scene:{design:{},motion:{},gaze:{}}});
 const dom=new JSDOM(source,{runScripts:'outside-only'}),w=dom.window,bot=w.document.querySelector('#demo-bot');
 let finishMotion;bot.ready=true;w.workflowStarts=0;w.workflowStops=0;
 for(const name of ['setBodyOrientation','lookAt','seek','setActivity','stopBehavior','cancelMove','cancelReaction','detachAnchor'])bot[name]=()=>{};
 bot.motion={to:()=>new Promise(resolve=>{finishMotion=resolve;})};
 try{
  w.eval(w.document.querySelector('script').textContent.replace(/^import .*;\n/m,''));
  bot.parentElement.remove();await Promise.resolve();finishMotion();await Promise.resolve();await Promise.resolve();
  assert.equal(w.workflowStarts,0);assert.equal(w.workflowStops,0);
 }finally{w.close();}
});
