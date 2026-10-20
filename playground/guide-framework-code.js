import { getFramework } from './site-framework.js';
// One scoped stylesheet is used by the live preview and both copyable frameworks.
// Reserve space for the whole avatar, including targets on the first/last line.
export const exampleStyles = `
#demo-app {
  --demo-bot-size: clamp(64px, 20vw, 120px);
  --behavior-gap: 6px;
  --example-padding: 12px;
  --example-ink: #172033;
  --example-muted: #667085;
  --example-border: #e0e5ec;
  position: relative; isolation: isolate; width: 100%; min-width: 0;
  min-height: 240px; box-sizing: border-box;
  padding: max(20px, calc(var(--demo-bot-size) / 2)) var(--example-padding);
  padding-left: calc(var(--demo-bot-size) + var(--behavior-gap) + var(--example-padding));
  font: 14px/1.55 system-ui, sans-serif; color: var(--example-ink);
  background: #f5f7fa; overflow-wrap: anywhere;
}
#demo-app *, #demo-app *::before, #demo-app *::after { box-sizing: border-box; }
#demo-app [hidden] { display: none !important; }
#demo-app[data-side="left"] { padding-left: calc(var(--demo-bot-size) + var(--behavior-gap) + var(--example-padding)); padding-right: var(--example-padding); }
#demo-app[data-side="right"] { padding-left: var(--example-padding); padding-right: calc(var(--demo-bot-size) + var(--behavior-gap) + var(--example-padding)); }
#demo-app[data-side="above"] { padding: calc(var(--demo-bot-size) + var(--behavior-gap) + var(--example-padding)) max(var(--example-padding), calc(var(--demo-bot-size) / 2)) var(--example-padding); }
#demo-app[data-side="below"] { padding: var(--example-padding) max(var(--example-padding), calc(var(--demo-bot-size) / 2)) calc(var(--demo-bot-size) + var(--behavior-gap) + var(--example-padding)); }
#demo-app > .demo-bot { position: absolute; left: 0; top: 0; width: var(--demo-bot-size); height: var(--demo-bot-size); pointer-events: none; z-index: 3; }
#demo-app .app-card { min-width: 0; border: 1px solid var(--example-border); border-radius: 12px; padding: 18px; background: #fff; box-shadow: 0 2px 5px #17203305; }
#demo-app h3 { font-size: 15px; font-weight: 650; line-height: 1.45; letter-spacing: -.015em; margin: 0 0 16px; }
#demo-app p { margin: 12px 0; font-size: 13px; line-height: 1.65; color: #526075; }
#demo-app .app-card > :last-child { margin-bottom: 0; }
#demo-app .app-card > p:empty { margin: 0; }
#demo-app label { display: block; min-width: 0; font-size: 12px; font-weight: 600; color: #475467; }
#demo-app button, #demo-app input { font: inherit; color: inherit; }
#demo-app button { min-width: 0; max-width: 100%; min-height: 40px; border: 1px solid #cfd6e0; border-radius: 8px; padding: 10px 14px; background: #fff; color: var(--example-ink); font-size: 13px; line-height: 1.4; font-weight: 600; cursor: pointer; white-space: normal; overflow-wrap: anywhere; transition: background-color .15s, border-color .15s; }
#demo-app button:where(:hover):not(:disabled) { background: #f5f7fa; border-color: #aeb9c8; }
#demo-app button:disabled { cursor: default; opacity: .5; }
#demo-app button:focus-visible, #demo-app input:focus-visible { outline: 3px solid #dca610; outline-offset: 3px; }
#demo-app .app-card > button:not(.target-item), #demo-app .app-actions > #app-next { background: var(--example-ink); border-color: var(--example-ink); color: #fff; }
#demo-app .app-card > button:not(.target-item):hover:not(:disabled), #demo-app .app-actions > #app-next:hover:not(:disabled) { background: #344054; border-color: #344054; }
#demo-app .app-card > button:not(.target-item) { margin-top: 12px; }
#demo-app input { display: block; width: 100%; min-width: 0; max-width: 100%; min-height: 42px; margin-top: 6px; padding: 10px 12px; border: 1px solid #cfd6e0; border-radius: 8px; background: #fff; color: var(--example-ink); font-size: 14px; font-weight: 400; line-height: 1.5; }
#demo-app input::placeholder { color: var(--example-muted); opacity: 1; }
#demo-app .target-item { display: block; width: 100%; min-width: 0; text-align: left; padding: 12px; margin: 8px 0; border: 1px solid var(--example-border); border-radius: 9px; background: #fff; color: var(--example-ink); font-size: 13px; line-height: 1.5; }
#demo-app h3 + .target-item { margin-top: 0; }
#demo-app .target-item[aria-current="true"], #demo-app .target-item[data-active] { border-color: #d9b64d; background: #fffbeb; box-shadow: inset 3px 0 #dca610; }
#demo-app .target-item small { display: block; margin-top: 4px; color: var(--example-muted); font-size: 12px; line-height: 1.5; font-weight: 400; }
#demo-app .target-item p { margin: 6px 0 0; }
#demo-app #loading-indicator { display: flex; align-items: center; gap: 10px; min-height: 48px; font-size: 13px; color: #526075; }
#demo-app .spinner { flex: 0 0 auto; width: 22px; height: 22px; border: 2px solid var(--example-border); border-top-color: #c99816; border-radius: 50%; animation: example-spin 1s linear infinite; }
#demo-app #progress-label { display: block; font-size: 13px; font-weight: 500; font-variant-numeric: tabular-nums; color: #526075; }
#demo-app .progress-track { height: 8px; border-radius: 99px; background: #e9edf2; overflow: hidden; margin: 14px 0 4px; }
#demo-app .progress-track i { display: block; background: #d6aa22; height: 100%; border-radius: inherit; transition: width .3s; }
#demo-app [aria-valuenow="100"] .progress-track i { background: #258358; }
#demo-app #search-results { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--example-border); color: var(--example-muted); font-size: 13px; }
#demo-app #search-results > :first-child { margin-top: 0; }
#demo-app #review-result { font-variant-numeric: tabular-nums; }
#demo-app .app-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 16px; }
#demo-app .emotion-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 16px; }
#demo-app .emotion-actions button { margin: 0; padding: 10px 12px; font-size: 12px; min-height: 42px; text-align: left; }
#demo-app .emotion-scene > #emotion-feedback { margin: 12px 0 0; color: var(--example-muted); font-size: 12px; }
#demo-app .app-card p[data-outcome], #demo-app #loading-indicator[data-outcome] { padding: 10px 12px; border: 1px solid var(--outcome-border, var(--example-border)); border-radius: 8px; }
#demo-app .app-card [data-outcome="pending"] { --outcome-border: #dce3ed; border-color: var(--outcome-border); background: #f5f7fa; color: #475467; }
#demo-app .app-card [data-outcome="success"] { --outcome-border: #b8dec9; border-color: var(--outcome-border); background: #f0faf4; color: #1f6b45; }
#demo-app .app-card [data-outcome="error"] { --outcome-border: #efc1bd; border-color: var(--outcome-border); background: #fff5f4; color: #a12d27; }
#demo-app .target-item[data-active][data-outcome="pending"] { border-color: #d9b64d; background: #fffbeb; }
#demo-app #progress-label[data-outcome] { background: transparent; }
#demo-app #progress-label[data-outcome="success"] { color: #1f6b45; }
#demo-app input[aria-invalid="true"] { border-color: #c84840; background: #fffbfa; }
#demo-app .target-item .workflow-review-status { display: inline-block; margin-top: 8px; padding: 2px 7px; border-radius: 5px; background: #f0f2f5; color: #526075; font-size: 11px; font-weight: 600; }
#demo-app .target-item[data-outcome="pending"] .workflow-review-status { background: #fff1bd; color: #7c5b0b; }
#demo-app .target-item[data-outcome="success"] .workflow-review-status { background: #dbf0e3; color: #1f6b45; }
#demo-app .target-item[data-outcome="success"]::before { content: '✓ '; color: #1f6b45; }
@keyframes example-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  #demo-app .spinner { animation: none; }
  #demo-app .progress-track i, #demo-app button { transition: none; }
}
@media (max-width: 700px) {
  #demo-app .app-card { padding: 14px; }
  #demo-app input { font-size: 16px; }
  /* Buttons use the full width below the companion/target pair. */
  #demo-app:has(.emotion-scene) { padding-left: var(--example-padding); padding-right: var(--example-padding); }
  #demo-app .emotion-card { margin-left: calc(var(--demo-bot-size) + var(--behavior-gap)); min-height: var(--demo-bot-size); }
  #demo-app[data-side="right"] .emotion-card { margin-left: 0; margin-right: calc(var(--demo-bot-size) + var(--behavior-gap)); }
  #demo-app[data-side="above"] .emotion-card, #demo-app[data-side="below"] .emotion-card { margin-inline: 0; }
}
`.trim();

export function installExampleStyles(document) {
 let style=document.getElementById('sidekick-example-styles');
 if(!style){style=document.createElement('style');style.id='sidekick-example-styles';style.textContent=exampleStyles;document.head.append(style);}
 return style;
}

// A target change may also change sides. Keep the reserved rail in sync in copied apps.
export function installExampleLayout(bot) {
 const app=bot.parentElement;
 const update=()=>{
  const behavior=bot.behavior;
  if(!behavior||!('target' in behavior||'targets' in behavior))return;
  const side=behavior.side??'right',gap=`${behavior.gap??16}px`;
  if(app.dataset.side!==side)app.dataset.side=side;
  if(app.style.getPropertyValue('--behavior-gap')!==gap)app.style.setProperty('--behavior-gap',gap);
 };
 bot.addEventListener('sidekick-behavior-change',update);update();
 return ()=>bot.removeEventListener('sidekick-behavior-change',update);
}

const layoutAttributes = layout => ({
 side:['left','right','above','below'].includes(layout?.side)?layout.side:'left',
 gap:Number.isFinite(layout?.gap)?Math.max(0,Math.min(48,layout.gap)):6,
});

const indent = (text, spaces=4) => text.split('\n').map(line=>' '.repeat(spaces)+line).join('\n');
/** Produce actual JSX from the example's static application DOM, not a second hidden framework block. */
export function markupToJsx(markup) {
 const template=document.createElement('template');template.innerHTML=markup;
 const serialize=node=>{
  if(node.nodeType===3)return node.textContent.trim()?`{${JSON.stringify(node.textContent)}}`:'';
  if(node.nodeType!==1||node.tagName.toLowerCase()==='sidekick-avatar')return '';
  const tag=node.tagName.toLowerCase();const attrs=[];
  for(const {name,value} of node.attributes){
   if(name.startsWith('data-guide-'))continue;
   if(name==='style'){const style={};for(const key of Array.from(node.style))style[key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=node.style.getPropertyValue(key);attrs.push(`style={${JSON.stringify(style)}}`);continue;}
   const key=({class:'className',for:'htmlFor',tabindex:'tabIndex',autocomplete:'autoComplete',value:'defaultValue',checked:'defaultChecked'})[name]??name;
   attrs.push(['hidden','disabled','required','multiple','checked'].includes(name)?`${key}={true}`:`${key}=${JSON.stringify(value)}`);
  }
  return `<${tag}${attrs.length?' '+attrs.join(' '):''}${['input','br','hr','img'].includes(tag)?' />':`>${[...node.childNodes].map(serialize).join('')}</${tag}>`}`;
 };
 return [...template.content.childNodes].map(serialize).join('\n');
}
export function reactExample(source, markup='', {design, name='Example', layout}={}) {
 // Source is authored documentation, not user input. Listener registration is paired with cleanup.
 let body=source.replace(/const bot = document\.querySelector\(['"]#demo-bot['"]\);\s*/g,'').replace(/const bot = document\.querySelector\(['"]sidekick-avatar['"]\);\s*/g,'');
 body=body.replace(/(document\.querySelector\([^\n]+?\)|item|bot)\.addEventListener\(/g,'listen($1, ');
 body=body.replaceAll('document.querySelector','root.querySelector');
 const jsx=markupToJsx(markup),{side,gap}=layoutAttributes(layout);
 return `import { useEffect, useRef, useState } from 'react';\nimport { SidekickAvatar } from '@hanana-kick/sidekick/react';\n${design?`\nconst design = ${JSON.stringify(design,null,2)};\n`:''}\nconst exampleStyles = ${JSON.stringify(exampleStyles)};\n\nconst installExampleLayout = ${installExampleLayout.toString()};\n\nexport default function ${name}() {\n  const [bot, setBot] = useState(null);\n  const appRef = useRef(null);\n  useEffect(() => {\n    const root = appRef.current;\n    if (!bot || !root) return;\n    let disposed = false, started = false;\n    const cleanup = [installExampleLayout(bot)];\n    function listen(target, type, listener) {\n      target?.addEventListener(type, listener);\n      cleanup.push(() => target?.removeEventListener(type, listener));\n    }\n    async function start() {\n      if (disposed || started) return;\n      started = true;\n${indent(body,6)}${body.includes('const disposeWorkflow =')?'\n      cleanup.push(disposeWorkflow);':''}\n    }\n    const ready = () => { void start().catch(console.error); };\n    if (bot.ready) ready();\n    else listen(bot, 'sidekick-ready', ready);\n    return () => {\n      disposed = true;\n      cleanup.forEach(remove => remove());\n      bot.stopBehavior();\n      bot.cancelMove();\n      bot.cancelReaction();\n      bot.detachAnchor();\n    };\n  }, [bot]);\n  return <div ref={appRef} id="demo-app" data-side=${JSON.stringify(side)} style={{ '--behavior-gap': '${gap}px' }}>\n    <style>{exampleStyles}</style>\n${indent(jsx,4)}\n    <SidekickAvatar ref={setBot} id="demo-bot" className="demo-bot" placement="inline" movementBounds="none" interaction="none"${design?' design={design}':''} />\n  </div>;\n}`;
}
export function scenarioCode(source, markup, options) {
 if(options?.document&&options?.translate){const template=options.document.createElement('template');template.innerHTML=markup;for(const element of template.content.querySelectorAll('[data-guide-i18n]'))element.textContent=options.translate(element.dataset.guideI18n);for(const element of template.content.querySelectorAll('[data-guide-placeholder]'))element.setAttribute('placeholder',options.translate(element.dataset.guidePlaceholder));markup=template.innerHTML;}
 if(options?.scene?.design)source='const scene = '+JSON.stringify(options.scene,null,2)+';\n'+[
  'bot.design = scene.design;', 'bot.setBodyOrientation(scene.bodyOrientation);', 'bot.zoom = scene.zoom;',
  "bot.lookAt({ space:'view', ...scene.gaze });", 'bot.seek(scene.time);', 'bot.setActivity(scene.activity);',
  'bot.trackingMode = scene.trackingMode;', 'bot.paused = scene.paused;', 'await bot.motion.to(scene.motion, { duration:0 });', 'if (disposed) return;',
 ].join('\n')+'\n'+source;

 if(getFramework()==='react')return reactExample(source,markup,options);
 const body=source.replace(/const bot = document\.querySelector\(['"]#demo-bot['"]\);\s*/g,''),{side,gap}=layoutAttributes(options?.layout);
 return `<style>\n${exampleStyles}\n</style>\n<div id="demo-app" data-side="${side}" style="--behavior-gap:${gap}px">\n${markup}\n  <sidekick-avatar id="demo-bot" class="demo-bot" placement="inline" movement-bounds="none" interaction="none"></sidekick-avatar>\n</div>\n<script type="module">\nimport 'https://cdn.jsdelivr.net/gh/hanana-kick/sidekick@v0.16.0/dist/browser/sidekick.js';\nconst bot = document.querySelector('#demo-bot');\n${options?.design?'bot.design = '+JSON.stringify(options.design,null,2)+';\n':''}const installExampleLayout = ${installExampleLayout.toString()};\nconst cleanup = [installExampleLayout(bot)];\nlet disposed = false, started = false;\nasync function start() {\n  if (disposed || started) return;\n  started = true;\n${indent(body,2)}${body.includes('const disposeWorkflow =')?'\n  cleanup.push(disposeWorkflow);':''}\n}\nconst ready = () => { void start().catch(console.error); };\nfunction disposeExample() {\n  if (disposed) return;\n  disposed = true;\n  observer.disconnect();\n  bot.removeEventListener('sidekick-ready', ready);\n  window.removeEventListener('pagehide', disposeExample);\n  cleanup.forEach(remove => remove());\n  bot.stopBehavior();\n  bot.cancelMove();\n  bot.cancelReaction();\n  bot.detachAnchor();\n}\nconst observer = new MutationObserver(() => { if (!bot.isConnected) disposeExample(); });\nobserver.observe(document, { childList: true, subtree: true });\nwindow.addEventListener('pagehide', disposeExample, { once: true });\nif (bot.ready) ready();\nelse bot.addEventListener('sidekick-ready', ready, { once: true });\n</script>`;
}
const reactLessons={
 'html-start': `import { useState } from 'react';\nimport { SidekickAvatar } from '@hanana-kick/sidekick/react';\n\nexport default function LoadingCompanion() {\n  const [done, setDone] = useState(false);\n  return <>\n    <div id="loading">{done ? 'Done' : 'Loading'}</div>\n    <SidekickAvatar placement="viewport" behavior={done\n      ? { type: 'celebrate' }\n      : { type: 'wait', target: '#loading' }} />\n    <button onClick={() => setDone(true)}>Complete</button>\n  </>;\n}`,
 appearance:`import { SidekickAvatar } from '@hanana-kick/sidekick/react';\nimport scene from './my-sidekick-scene.json';\n\nexport default function Example() {\n  return <>\n    <button id="next-action">Next</button>\n    <SidekickAvatar design={scene.design}\n      behavior={{ type: 'guide', target: '#next-action' }} />\n  </>;\n}`,
 placement:`import { useRef } from 'react';\nimport { SidekickAvatar } from '@hanana-kick/sidekick/react';\n\nexport default function Example() {\n  const ref = useRef(null);\n  return <>\n    <SidekickAvatar placement="viewport" positionX={24} positionY={120} />\n    <section style={{ position:'relative', minHeight:400, overflow:'hidden' }}>\n      <SidekickAvatar ref={ref} placement="inline" size={140}\n        style={{ position:'absolute', left:0, top:0 }} />\n      <button onClick={() => ref.current?.moveTo({ x:120, y:80 })}>Move</button>\n    </section>\n  </>;\n}`,
 'element-anchor':`import { useRef } from 'react';\nimport { SidekickAvatar } from '@hanana-kick/sidekick/react';\n\nexport default function Example() {\n  const botRef = useRef(null), targetRef = useRef(null);\n  return <>\n    <article ref={targetRef}>Target</article>\n    <SidekickAvatar ref={botRef} placement="viewport" movementBounds="none" />\n    <button onClick={() => botRef.current?.moveToElement(targetRef.current, {\n      alignX:'right', alignY:'center', x:16, y:0, anchor:true\n    })}>Follow</button>\n    <button onClick={() => botRef.current?.detachAnchor()}>Detach</button>\n  </>;\n}`,
 lifecycle:`import { useEffect, useRef } from 'react';\nimport { SidekickAvatar } from '@hanana-kick/sidekick/react';\n\nexport default function Review() {\n  const ref = useRef(null);\n  useEffect(() => {\n    const bot = ref.current;\n    const controller = new AbortController();\n    async function start() {\n      try {\n        const result = await bot.perform({ type:'review', targets:'.result-item',\n          dwell:1000, timeout:5000 }, { signal:controller.signal });\n        console.log(result.status, result.completedItems);\n      } catch (error) { console.error(error); }\n    }\n    if (bot.ready) void start();\n    else bot.addEventListener('sidekick-ready', start, { once:true });\n    return () => { controller.abort(); bot.removeEventListener('sidekick-ready', start); bot.stopBehavior(); };\n  }, []);\n  return <>\n    <div className="result-item">First item</div>\n    <div className="result-item">Second item</div>\n    <SidekickAvatar ref={ref} placement="viewport" />\n  </>;\n}`,
 performance:`import { useState } from 'react';\nimport { SidekickAvatar } from '@hanana-kick/sidekick/react';\n\nexport default function Example() {\n  const [visible, setVisible] = useState(true);\n  const [paused, setPaused] = useState(false);\n  return <>\n    {visible && <SidekickAvatar paused={paused} />}\n    <button onClick={() => setPaused(value => !value)}>Toggle pause</button>\n    <button onClick={() => setVisible(value => !value)}>Mount / unmount</button>\n  </>;\n}`,
};
export function lessonCode(lesson, htmlLesson) {
 if(getFramework()==='react') {
  if(lesson.id==='react-start') return lesson.code;
  if(reactLessons[lesson.id]) return reactLessons[lesson.id];
  if(lesson.id==='manual-motion')return reactExample(lesson.code,'<div id="loading">Loading</div>');
 }
 if(lesson.id==='react-start'&&getFramework()==='element')return htmlLesson.code;
 return lesson.code;
}
