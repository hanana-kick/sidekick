import '../src/index.ts';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { SidekickAvatar } from '../src/react.ts';
import { parseScene } from '../src/core/scene.ts';
import { FIELD_BY_KEY, compileReferenceAttributes, validateStateValue, attributeText, referenceReactProps, REFERENCE_CSS, REFERENCE_TARGET_HTML } from './state-reference-schema.js';
const style=document.createElement('style');style.textContent=REFERENCE_CSS;document.head.append(style);
const root=document.getElementById('reference-root');
root.innerHTML=REFERENCE_TARGET_HTML;
const mount=document.createElement('div');root.append(mount);
let currentRevision=0;
let reactRoot=null, bot=null, framework=null, last={}, generation=0, suspended=false, intendedPaused=false;
const notify=(type,data={})=>parent.postMessage({type,...data},location.origin);
function remove(){generation++;if(reactRoot){reactRoot.unmount();reactRoot=null;}bot?.remove();bot=null;last={};}
function apply(message){
 currentRevision=message.revision;
 const scene=parseScene(message.scene), edits={};
 if(!message.values||typeof message.values!=='object'||Array.isArray(message.values))throw new TypeError('Invalid fields');
 for(const [key,value] of Object.entries(message.values)){const field=FIELD_BY_KEY.get(key);if(!field)throw new TypeError('Unknown field');edits[key]=validateStateValue(field,value,scene,document);}
 const attributes=compileReferenceAttributes(scene,edits),nextMode=message.framework==='react'?'react':'element';
 intendedPaused=attributes.paused===true;
 if(framework!==nextMode||message.restart||Object.keys(last).some(key=>!Object.hasOwn(attributes,key))){remove();framework=nextMode;}
 const token=++generation;
 if(framework==='react'){
  if(!reactRoot)reactRoot=createRoot(mount);
  flushSync(()=>reactRoot.render(createElement(SidekickAvatar,{id:'reference-bot',...referenceReactProps(attributes),onError:e=>{if(token===generation)notify('state-reference-error',{message:e.detail.message,revision:message.revision});},onReady:()=>{if(token===generation)notify('state-reference-ready',{revision:message.revision});}})));
  bot=mount.querySelector('sidekick-avatar');
 }else{
  if(!bot){bot=document.createElement('sidekick-avatar');bot.id='reference-bot';bot.addEventListener('sidekick-error',e=>{if(e.currentTarget===bot)notify('state-reference-error',{message:e.detail.message,revision:currentRevision});});}
  for(const key of Object.keys(last))if(!Object.hasOwn(attributes,key))bot.removeAttribute(key);
  for(const [key,value]of Object.entries(attributes)){
   if(key==='behavior'&&value===null){bot.removeAttribute(key);bot.stopBehavior();continue;}
   const text=attributeText(value);if(bot.getAttribute(key)!==text)bot.setAttribute(key,text);
  }
  if(!bot.isConnected)mount.append(bot);
 }
 last=attributes;
 const ready=()=>{if(token!==generation)return;if(suspended)bot.paused=true;notify('state-reference-ready',{revision:message.revision});};
 if(bot.ready)ready();else bot.addEventListener('sidekick-ready',ready,{once:true});
}
window.addEventListener('message',event=>{
 if(event.source!==parent||event.origin!==location.origin||!event.data||typeof event.data!=='object')return;
 try{
  if(event.data.type==='state-reference-config')apply(event.data);
  if(event.data.type==='state-reference-visibility'){suspended=!event.data.visible;if(bot)bot.paused=suspended||intendedPaused;}
 }catch(error){notify('state-reference-error',{message:error.message,revision:event.data.revision??currentRevision});}
});
window.addEventListener('pagehide',remove);
notify('state-reference-mounted');
