import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { sourceRanges, eventRanges, validSourceEvent, sourceEvents } from '../playground/example-source-map.js';
import { mountExampleSource, sourceScrollTop } from '../playground/example-source-viewer.js';
import { emitSourceEvent } from '../playground/example-source-event.js';
const read = path => readFile(new URL('../'+path, import.meta.url),'utf8');
async function actualFiles(site) {
 return Promise.all(['api-demo.html',`playground/demos/${site}.js`,`playground/demos/${site}.css`,'playground/demo-scenarios.js','playground/company-presentation.js','playground/api-demo.js','playground/api-demo.css'].map(async path=>{const text=await read(path);return {path,text,ranges:sourceRanges(text)};}));
}
const module = { loadExampleSource: actualFiles, eventRanges };
const tick = () => new Promise(resolve=>setTimeout(resolve,15));
function setup(loader=async()=>module) {
 const dom=new JSDOM('<div id="preview-surface"><iframe></iframe></div>',{url:'https://example.test/api-playground.html'}),doc=dom.window.document;
 let locale='en';const viewer=mountExampleSource(doc,{locale:()=>locale,loader});
 const frame=doc.querySelector('iframe');const context={frame,origin:dom.window.location.origin,site:'company',generation:'1'};viewer.setContext(context);
 const send=(id,changes={})=>dom.window.dispatchEvent(new dom.window.MessageEvent('message',{source:frame.contentWindow,origin:context.origin,data:{type:'sidekick-example-source',site:context.site,generation:context.generation,id,...changes}}));
 return {dom,doc,viewer,context,send,language:value=>{locale=value;viewer.refreshLabels();},open:async()=>{doc.querySelector('details').open=true;await tick();await tick();}};
}
test('all bounded events map to authored, exact source ranges in actual files',async()=>{
 for(const [site,events] of Object.entries(sourceEvents)){
  const files=await actualFiles(site);
  for(const id of events){const matches=files.flatMap(file=>eventRanges(site,id,file).map(range=>({file,range})));assert.ok(matches.length >= (site==='community'&&!id.endsWith('-present')?1:2));
   for(const {file,range} of matches){const lines=file.text.split('\n');assert.match(lines[range.start-2],/@source-start/);assert.match(lines[range.end],/@source-end/);assert.ok(range.end>=range.start);}
  }
 }
 const files=await actualFiles('shop');const snippets=files.flatMap(f=>eventRanges('shop','shop-cheaper',f).map(r=>f.text.split('\n').slice(r.start-1,r.end).join('\n'))).join('\n');assert.match(snippets,/p.price>item.price/);assert.match(snippets,/bot.say/);assert.match(snippets,/emitSourceEvent/);
 assert.throws(()=>sourceRanges('// @source-start unfinished'),/Unclosed/);
});
test('only matching frame, origin, selected site, generation and authored ID are accepted',()=>{
 const frame={contentWindow:{}},context={frame,origin:'https://example.test',site:'company',generation:'2'};
 const event={source:frame.contentWindow,origin:context.origin,data:{type:'sidekick-example-source',site:'company',generation:'2',id:'nova-design'}};
 assert.equal(validSourceEvent(event,context),true);
 for(const patch of [{source:{}},{origin:'https://evil.test'},{data:{...event.data,generation:'1'}},{data:{...event.data,site:'shop'}},{data:{...event.data,id:'arbitrary'}}])assert.ok(!validSourceEvent({...event,...patch},context));
});
test('emitter sends only bounded metadata to same origin, never source or speech',()=>{
 let sent;const win={location:{href:'https://example.test/api-demo.html?site=shop&sourceGeneration=3',origin:'https://example.test'},parent:{postMessage:(...args)=>sent=args}};emitSourceEvent('shop-cheaper',win);assert.deepEqual(sent,[{type:'sidekick-example-source',id:'shop-cheaper',site:'shop',generation:'3'},'https://example.test']);
});
test('viewer loads lazily; real event highlights; manual reading disables follow; keyboard tabs and copy preserve exact bytes',async()=>{
 let calls=0,copied;const s=setup(async()=>{calls++;return module;});try{
 assert.equal(calls,0);s.send('nova-design');await s.open();assert.equal(calls,1);assert.ok(s.doc.querySelectorAll('.is-highlighted').length>0);assert.match(s.doc.querySelector('.source-path').textContent,/demo-scenarios/);
 Object.defineProperty(s.dom.window.navigator,'clipboard',{value:{writeText:async text=>{copied=text;}}});s.doc.querySelector('.source-copy').click();await tick();assert.equal(copied,await read('playground/demo-scenarios.js'));
 const pre=s.doc.querySelector('pre');pre.dispatchEvent(new s.dom.window.Event('wheel'));assert.equal(s.doc.querySelector('input').checked,false);
 const tabs=s.doc.querySelectorAll('[role=tab]');tabs[0].click();tabs[0].dispatchEvent(new s.dom.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(s.doc.activeElement.id,'example-source-tab-1');
 s.send('nova-sound');assert.match(s.doc.querySelector('.source-path').textContent,/company.js/);assert.equal(s.doc.querySelector('input').checked,false);
 for(const lang of ['ko','ja','zh-CN']){s.language(lang);assert.notEqual(s.doc.querySelector('summary').textContent,'Example source');}
 }finally{s.viewer.dispose();s.dom.window.close();}
});
test('load failures retry; reset/switch clear events and reject stale resolutions/messages',async()=>{
 let calls=0;const s=setup(async()=>{if(++calls===1)throw Error('offline');return module;});try{
 await s.open();assert.equal(s.doc.querySelector('.source-retry').hidden,false);s.doc.querySelector('.source-retry').click();await tick();await tick();assert.ok(s.doc.querySelectorAll('.source-line').length);
 s.send('nova-design');assert.ok(s.doc.querySelector('.is-highlighted'));
 s.viewer.setContext({...s.context,site:'shop',generation:'2'});s.send('nova-design');await tick();await tick();assert.equal(s.doc.querySelector('.is-highlighted'),null);assert.match(s.doc.querySelectorAll('[role=tab]')[1].textContent,/shop.js/);
 s.viewer.setContext(null);assert.equal(s.doc.querySelectorAll('.source-line').length,0);
 }finally{s.viewer.dispose();s.dom.window.close();}
 let resolve;const x=setup(()=>new Promise(r=>{resolve=r;}));await x.open();x.viewer.setContext(null);resolve(module);await tick();assert.equal(x.doc.querySelectorAll('.source-line').length,0);x.viewer.dispose();x.dom.window.close();
});
test('source is text, not HTML; mobile disclosure never invokes scenario pause or adds motion loop',async()=>{
 const s=setup(async()=>({eventRanges:()=>[],loadExampleSource:async()=>[{path:'safe.js',text:'<img src=x onerror=alert(1)>',ranges:{}}]}));await s.open();assert.equal(s.doc.querySelector('pre img'),null);assert.match(s.doc.querySelector('pre').textContent,/<img/);s.viewer.dispose();s.dom.window.close();
 const source=await read('playground/example-source-viewer.js'),css=await read('playground/example-source-viewer.css');assert.doesNotMatch(source,/pauseScenarios|requestAnimationFrame|recordSiteEvent|recordSettingChange|eval\(/);assert.match(css,/@media\(max-width:999px\)/);assert.match(css,/grid-template-columns:minmax\(0,1.15fr\) minmax\(0,1fr\)/);
});

test('production API graph ships byte-identical authored sources, not reconstructed snippets',async()=>{
 const ts=(await import('typescript')).default;
 const html=await read('dist/api-playground.html');
 const entry=html.match(/<script[^>]+src="([^"]+)"/)[1];
 const queue=[new URL('../dist/'+entry.replace(/^\.\//,''),import.meta.url)],seen=new Set(),literals=new Set();
 while(queue.length){const url=queue.pop();if(seen.has(url.href))continue;seen.add(url.href);const text=await readFile(url,'utf8');const tree=ts.createSourceFile(url.pathname,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const visit=node=>{if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)){literals.add(node.text);if(/^\.\.?\/[^\n]+\.js$/.test(node.text))queue.push(new URL(node.text,url));}ts.forEachChild(node,visit);};visit(tree);
 }
 for(const site of Object.keys(sourceEvents))for(const file of await actualFiles(site))assert.ok(literals.has(file.text),`${file.path}: exact UTF-8 source text must be reachable from production API entry`);
 assert.ok([...seen].some(path=>path.includes('example-source-bundle-')));
});


test('auto-follow scroll uses pane-relative geometry regardless of page position or offset parent',()=>{
 const pane={scrollTop:304,clientTop:1,offsetTop:410,getBoundingClientRect:()=>({top:210})};
 // Line at content Y=1060, currently viewed through a pane scrolled to 304.
 const row={offsetTop:1060,getBoundingClientRect:()=>({top:210+1+1060-304})};
 assert.equal(sourceScrollTop(pane,row),1010);
 // Scrolling the surrounding document must not change the pane-relative target.
 pane.getBoundingClientRect=()=>({top:10});row.getBoundingClientRect=()=>({top:10+1+1060-304});
 assert.equal(sourceScrollTop(pane,row),1010);
 assert.equal(pane.scrollTop,304,'calculation does not mutate parent or pane');
 row.getBoundingClientRect=()=>({top:10+1+20-304});assert.equal(sourceScrollTop(pane,row),0);
});


test('same-file events retain source nodes; closed disclosure defers DOM work until reopened',async()=>{
 const s=setup();try{
  s.send('nova-design');await s.open();const row=s.doc.querySelector('.source-line'),tab=s.doc.querySelector('[role=tab]');
  s.send('nova-sound');assert.equal(s.doc.querySelector('.source-line'),row);assert.equal(s.doc.querySelector('[role=tab]'),tab);
  const details=s.doc.querySelector('details');details.open=false;await tick();const status=s.doc.querySelector('.source-status').textContent;
  let mutations=0;const observer=new s.dom.window.MutationObserver(records=>{mutations+=records.length;});observer.observe(details,{subtree:true,childList:true,attributes:true,characterData:true});
  s.send('nova-compare');await tick();assert.equal(mutations,0);assert.equal(s.doc.querySelector('.source-status').textContent,status);observer.disconnect();
  details.open=true;await tick();assert.match(s.doc.querySelector('.source-status').textContent,/nova-compare/);assert.equal(s.doc.querySelector('.source-line'),row);
 }finally{s.viewer.dispose();s.dom.window.close();}
});
