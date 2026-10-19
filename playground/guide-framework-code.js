import { getFramework } from './site-framework.js';
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
export function reactExample(source, markup='', {design, name='Example'}={}) {
 // Source is authored documentation, not user input. Listener registration is paired with cleanup.
 let body=source.replace(/const bot = document\.querySelector\(['"]#demo-bot['"]\);\s*/g,'').replace(/const bot = document\.querySelector\(['"]sidekick-avatar['"]\);\s*/g,'');
 body=body.replace(/(document\.querySelector\([^\n]+?\)|item|bot)\.addEventListener\(/g,'listen($1, ');
 body=body.replaceAll('document.querySelector','root.querySelector');
 const jsx=markupToJsx(markup);
 return `import { useEffect, useRef } from 'react';\nimport { SidekickAvatar } from '@hanana-kick/sidekick/react';\n${design?`\nconst design = ${JSON.stringify(design,null,2)};\n`:''}\nexport default function ${name}() {\n  const ref = useRef(null);\n  const appRef = useRef(null);\n  useEffect(() => {\n    const bot = ref.current;\n    const root = appRef.current;\n    if (!bot || !root) return;\n    let disposed = false;\n    const cleanup = [];\n    function listen(target, type, listener) {\n      target?.addEventListener(type, listener);\n      cleanup.push(() => target?.removeEventListener(type, listener));\n    }\n    async function start() {\n      if (disposed) return;\n${indent(body,6)}\n    }\n    const ready = () => { void start().catch(console.error); };\n    if (bot.ready) ready();\n    else listen(bot, 'sidekick-ready', ready);\n    return () => {\n      disposed = true;\n      cleanup.forEach(remove => remove());\n      bot.stopBehavior();\n      bot.cancelMove();\n      bot.cancelReaction();\n      bot.detachAnchor();\n    };\n  }, []);\n  return <div ref={appRef} id="demo-app" style={{ position: 'relative', minHeight: 360 }}>\n${indent(jsx,4)}\n    <SidekickAvatar ref={ref} placement="inline" movementBounds="none"${design?' design={design}':''}\n      style={{ width: 140, height: 140, position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }} />\n  </div>;\n}`;
}
export function scenarioCode(source, markup, options) {
 if(getFramework()==='react')return reactExample(source,markup,options);
 const body=source.replace(/const bot = document\.querySelector\(['"]#demo-bot['"]\);\s*/g,'');
 return `<div id="demo-app" style="position:relative;min-height:360px">\n${markup}\n  <sidekick-avatar id="demo-bot" placement="inline" movement-bounds="none"\n    style="position:absolute;left:0;top:0;width:140px;height:140px"></sidekick-avatar>\n</div>\n<script type="module">\nimport 'https://cdn.jsdelivr.net/gh/hanana-kick/sidekick@v0.11.3/dist/browser/sidekick.js';\nconst bot = document.querySelector('#demo-bot');\n${options?.design?'bot.design = '+JSON.stringify(options.design,null,2)+';\n':''}async function start() {\n${indent(body,2)}\n}\nif (bot.ready) void start();\nelse bot.addEventListener('sidekick-ready', start, { once:true });\n</script>`;

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
