import { getFramework } from './site-framework.js';
// One scoped stylesheet is used by the live preview and both copyable frameworks.
// Reserve space for the whole avatar, including targets on the first/last line.
export const exampleStyles = `
#demo-app {
  --demo-bot-size: clamp(64px, 20vw, 120px);
  --behavior-gap: 6px;
  --example-padding: 12px;
  position: relative; isolation: isolate; width: 100%; min-width: 0;
  min-height: 280px; box-sizing: border-box;
  padding: max(20px, calc(var(--demo-bot-size) / 2)) var(--example-padding);
  padding-left: calc(var(--demo-bot-size) + var(--behavior-gap) + var(--example-padding));
  font: 14px/1.5 system-ui, sans-serif; color: #0f172a;
  overflow-wrap: anywhere;
}
#demo-app *, #demo-app *::before, #demo-app *::after { box-sizing: border-box; }
#demo-app [hidden] { display: none !important; }
#demo-app[data-side="left"] { padding-left: calc(var(--demo-bot-size) + var(--behavior-gap) + var(--example-padding)); padding-right: var(--example-padding); }
#demo-app[data-side="right"] { padding-left: var(--example-padding); padding-right: calc(var(--demo-bot-size) + var(--behavior-gap) + var(--example-padding)); }
#demo-app[data-side="above"] { padding: calc(var(--demo-bot-size) + var(--behavior-gap) + var(--example-padding)) max(var(--example-padding), calc(var(--demo-bot-size) / 2)) var(--example-padding); }
#demo-app[data-side="below"] { padding: var(--example-padding) max(var(--example-padding), calc(var(--demo-bot-size) / 2)) calc(var(--demo-bot-size) + var(--behavior-gap) + var(--example-padding)); }
#demo-app > .demo-bot { position: absolute; left: 0; top: 0; width: var(--demo-bot-size); height: var(--demo-bot-size); pointer-events: none; z-index: 3; }
#demo-app .app-card { min-width: 0; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; background: #f8fafc; }
#demo-app h3 { font-size: 15px; line-height: 1.5; margin: 0 0 12px; }
#demo-app p { margin: 12px 0; font-size: 13px; }
#demo-app label { display: block; min-width: 0; }
#demo-app button, #demo-app input { font: inherit; color: inherit; }
#demo-app button { min-width: 0; max-width: 100%; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; background: #fff; cursor: pointer; white-space: normal; overflow-wrap: anywhere; }
#demo-app button:hover { background: #f1f5f9; }
#demo-app button:disabled { cursor: default; opacity: .5; }
#demo-app button:focus-visible, #demo-app input:focus-visible { outline: 3px solid #eab308; outline-offset: 3px; }
#demo-app .app-card > button { margin-top: 12px; }
#demo-app input { display: block; width: 100%; min-width: 0; max-width: 100%; margin-top: 4px; padding: 9px; border: 1px solid #cbd5e1; border-radius: 7px; background: #fff; }
#demo-app .target-item { display: block; width: 100%; min-width: 0; text-align: left; padding: 10px 12px; margin: 8px 0; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; }
#demo-app .target-item[aria-current="true"], #demo-app .target-item[data-active] { border-color: #eab308; background: #fefce8; }
#demo-app .target-item small { display: block; color: #64748b; font-size: 11px; }
#demo-app .target-item p { margin: 5px 0; }
#demo-app .spinner { width: 28px; height: 28px; border: 3px solid #e2e8f0; border-top-color: #eab308; border-radius: 50%; animation: example-spin 1s linear infinite; margin: 15px 0; }
#demo-app .progress-track { height: 8px; border-radius: 8px; background: #e2e8f0; overflow: hidden; margin: 14px 0; }
#demo-app .progress-track i { display: block; background: #eab308; height: 100%; transition: width .3s; }
#demo-app .app-actions { display: flex; gap: 8px; flex-wrap: wrap; }
#demo-app .emotion-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 14px; }
#demo-app .emotion-actions button { margin: 0; padding: 9px; font-size: 12px; min-height: 40px; text-align: left; }
#demo-app .emotion-scene > #emotion-feedback { margin-bottom: 0; }
#demo-app .app-card [data-outcome="success"] { border-color: #86efac; background: #f0fdf4; color: #166534; }
#demo-app .app-card [data-outcome="error"] { border-color: #fca5a5; background: #fef2f2; color: #991b1b; }
#demo-app .app-card p[data-outcome], #demo-app #loading-indicator[data-outcome] { padding: 10px; border: 1px solid; border-radius: 6px; }
#demo-app input[aria-invalid="true"] { border-color: #dc2626; }
#demo-app .workflow-review-status { font-weight: 600; }
#demo-app .target-item[data-outcome="success"]::before { content: '✓ '; color: #15803d; }
@keyframes example-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  #demo-app .spinner { animation: none; }
  #demo-app .progress-track i { transition: none; }
}
@media (max-width: 700px) {
  #demo-app .app-card { padding: 12px; }
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
 return `import { useEffect, useRef } from 'react';\nimport { SidekickAvatar } from '@hanana-kick/sidekick/react';\n${design?`\nconst design = ${JSON.stringify(design,null,2)};\n`:''}\nconst exampleStyles = ${JSON.stringify(exampleStyles)};\n\n${installExampleLayout.toString()}\n\nexport default function ${name}() {\n  const ref = useRef(null);\n  const appRef = useRef(null);\n  useEffect(() => {\n    const bot = ref.current;\n    const root = appRef.current;\n    if (!bot || !root) return;\n    let disposed = false, started = false;\n    const cleanup = [installExampleLayout(bot)];\n    function listen(target, type, listener) {\n      target?.addEventListener(type, listener);\n      cleanup.push(() => target?.removeEventListener(type, listener));\n    }\n    async function start() {\n      if (disposed || started) return;\n      started = true;\n${indent(body,6)}${body.includes('const disposeWorkflow =')?'\n      cleanup.push(disposeWorkflow);':''}\n    }\n    const ready = () => { void start().catch(console.error); };\n    if (bot.ready) ready();\n    else listen(bot, 'sidekick-ready', ready);\n    return () => {\n      disposed = true;\n      cleanup.forEach(remove => remove());\n      bot.stopBehavior();\n      bot.cancelMove();\n      bot.cancelReaction();\n      bot.detachAnchor();\n    };\n  }, []);\n  return <div ref={appRef} id="demo-app" data-side=${JSON.stringify(side)} style={{ '--behavior-gap': '${gap}px' }}>\n    <style>{exampleStyles}</style>\n${indent(jsx,4)}\n    <SidekickAvatar ref={ref} id="demo-bot" className="demo-bot" placement="inline" movementBounds="none" interaction="none"${design?' design={design}':''} />\n  </div>;\n}`;
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
 return `<style>\n${exampleStyles}\n</style>\n<div id="demo-app" data-side="${side}" style="--behavior-gap:${gap}px">\n${markup}\n  <sidekick-avatar id="demo-bot" class="demo-bot" placement="inline" movement-bounds="none" interaction="none"></sidekick-avatar>\n</div>\n<script type="module">\nimport 'https://cdn.jsdelivr.net/gh/hanana-kick/sidekick@v0.14.1/dist/browser/sidekick.js';\nconst bot = document.querySelector('#demo-bot');\n${options?.design?'bot.design = '+JSON.stringify(options.design,null,2)+';\n':''}${installExampleLayout.toString()}\nconst cleanup = [installExampleLayout(bot)];\nlet disposed = false, started = false;\nasync function start() {\n  if (disposed || started) return;\n  started = true;\n${indent(body,2)}${body.includes('const disposeWorkflow =')?'\n  cleanup.push(disposeWorkflow);':''}\n}\nconst ready = () => { void start().catch(console.error); };\nfunction disposeExample() {\n  if (disposed) return;\n  disposed = true;\n  observer.disconnect();\n  bot.removeEventListener('sidekick-ready', ready);\n  window.removeEventListener('pagehide', disposeExample);\n  cleanup.forEach(remove => remove());\n  bot.stopBehavior();\n  bot.cancelMove();\n  bot.cancelReaction();\n  bot.detachAnchor();\n}\nconst observer = new MutationObserver(() => { if (!bot.isConnected) disposeExample(); });\nobserver.observe(document, { childList: true, subtree: true });\nwindow.addEventListener('pagehide', disposeExample, { once: true });\nif (bot.ready) ready();\nelse bot.addEventListener('sidekick-ready', ready, { once: true });\n</script>`;
}
const reactLessons={
 'html-start': `import { useState } from 'react';\nimport { SidekickAvatar } from '@hanana-kick/sidekick/react';\n\nexport default function LoadingCompanion() {\n  const [done, setDone] = useState(false);\n  return <>\n    <div id="loading">{done ? 'Done' : 'Loading'}</div>\n    <SidekickAvatar placement="viewport" behavior={done\n      ? { type: 'celebrate' }\n      : { type: 'wait', target: '#loading' }} />\n    <button onClick={() => setDone(true)}>Complete</button>\n  </>;\n}`,
 appearance:`import { SidekickAvatar } from '@hanana-kick/sidekick/react';\nimport scene from './my-sidekick-scene.json';\n\nexport default function Example() {\n  return <>\n    <button id="next-action">Next</button>\n    <SidekickAvatar design={scene.design}\n      behavior={{ type: 'guide', target: '#next-action' }} />\n  </>;\n}`,
 placement:`import { useRef } from 'react';\nimport { SidekickAvatar } from '@hanana-kick/sidekick/react';\n\nexport default function Example() {\n  const ref = useRef(null);\n  return <>\n    <SidekickAvatar placement="viewport" positionX={24} positionY={120} />\n    <section style={{ position:'relative', minHeight:400, overflow:'hidden' }}>\n      <SidekickAvatar ref={ref} placement="inline"\n        style={{ position:'absolute', left:0, top:0, width:140, height:140 }} />\n      <button onClick={() => ref.current?.moveTo({ x:120, y:80 })}>Move</button>\n    </section>\n  </>;\n}`,
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
