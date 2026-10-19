import './state-reference.css';
import { getFramework, subscribeFramework } from './site-framework.js';
import { getSiteLocale, subscribeSiteLocale } from './site-i18n.js';
import { guideHref } from './guide-navigation.js';
import { STATE_FIELDS, STATE_IDS, FIELD_BY_KEY, READ_ONLY_STATE, fieldDefault, validateStateValue, compileReferenceAttributes, referenceSource } from './state-reference-schema.js';
import { stateLessons } from './guide-state-lessons.js';
import { guideTranslations } from './guide-translations.js';
import { stateCopy } from './state-reference-copy.js';
const saved=new Map(), MAX_CONTEXT=16384;
const encode=values=>JSON.stringify(values);
export function readStateReferenceContext(url, scene, document) {
 try{
  const raw=new URL(url).searchParams.get('state');if(!raw||raw.length>MAX_CONTEXT)return null;
  const data=JSON.parse(raw);if(!data||!STATE_IDS.includes(data.id)||!data.values||typeof data.values!=='object'||Array.isArray(data.values)||Object.keys(data).some(key=>!['id','values'].includes(key)))return null;
  const values={};for(const [key,value]of Object.entries(data.values)){const item=STATE_FIELDS[data.id].find(f=>f.attribute===key);if(!item)return null;values[key]=validateStateValue(item,value,scene,document);}
  compileReferenceAttributes(scene,values);return {id:data.id,values};
 }catch{return null;}
}
export function mountStateReference(host,id,{session}){
 const fields=STATE_FIELDS[id];if(!fields)return ()=>{};
 const scene=structuredClone(session.scene),controller=new AbortController(),signal=controller.signal;
 const copy=key=>stateCopy(key,getSiteLocale());
 const incoming=readStateReferenceContext(location.href,scene,document);
 let edits=structuredClone(incoming?.id===id?incoming.values:saved.get(id)??{}),revision=0,mounted=false,visible=true,disposed=false;
 const lesson=stateLessons.find(item=>item.id===id);
 const translate=value=>guideTranslations[getSiteLocale()]?.[value]??value;
 const section=document.createElement('section');section.className='state-lab';section.dataset.stateReference=id;host.append(section);
 const make=(tag,className,parent=section)=>{const el=document.createElement(tag);if(className)el.className=className;parent.append(el);return el;};
 const bindText=(el,key)=>{el.dataset.stateText=key;el.textContent=copy(key);return el;};
 bindText(make('h2'),'title');bindText(make('p'),'intro');
 const toolbar=make('div','state-lab-tools');const reset=bindText(make('button','',toolbar),'reset');reset.type='button';
 const rerun=bindText(make('button','',toolbar),'run');rerun.type='button';
 const grid=make('div','state-lab-grid');const controls=make('div','state-lab-controls',grid);controls.setAttribute('aria-label',copy('controls'));
 const preview=make('div','state-lab-preview',grid);bindText(make('h3','',preview),'preview');
 const frame=make('iframe','',preview);frame.title=copy('preview');frame.src='./state-preview.html';frame.setAttribute('sandbox','allow-scripts allow-same-origin');
 bindText(make('p','',preview),'scope');const status=make('p','state-lab-status',preview);status.setAttribute('role','status');status.textContent=copy('waiting');
 if(id==='state-position'||id==='state-behavior')bindText(make('p'),'targetNote');
 const details=make('details','state-lab-details');bindText(make('summary','',details),'controls');
 const tableWrap=make('div','state-table-wrap',details);tableWrap.tabIndex=0;const table=make('table','state-reference',tableWrap);bindText(make('caption','',table),'controls');const head=table.createTHead().insertRow();
 for(const key of ['parameter','type','initial','effect'])bindText(make('th','',head),key).scope='col';
 const body=table.createTBody();
 const sourceHeading=bindText(make('h3'),'source');const tools=make('div','state-lab-tools');const copyButton=bindText(make('button','',tools),'copy');copyButton.type='button';const tryLink=bindText(make('a','state-try',tools),'try');tryLink.dataset.stateTry='';const copyStatus=make('span','',tools);copyStatus.setAttribute('role','status');
 bindText(make('p'),'sourceNote');const source=make('pre','state-lab-source');source.tabIndex=0;source.dataset.stateSource='';
 bindText(make('h3'),'readOnly');bindText(make('p'),'readOnlyNote');make('p','state-lab-readonly').textContent=READ_ONLY_STATE.join(' · ');
 const names=[];
 function fieldType(item){return item.values?.join(' | ')??(item.kind==='number'?`number · ${item.min}…${item.max} ${item.unit}`:item.kind==='json'?`JSON${item.nullable?' | null':''}`:item.kind);}
 function error(message){status.setAttribute('role','alert');status.textContent=copy('invalid')+' '+message;}
 function updateSource(){
  const mode=getFramework();source.dataset.framework=mode;source.textContent=referenceSource(scene,edits,mode);sourceHeading.textContent=copy('source')+' · '+(mode==='react'?'React':'Custom Element');
  for(const [el,item]of names)el.textContent=mode==='react'?item.prop:item.attribute;
  for(const [index,item]of fields.entries())body.rows[index].cells[0].textContent=mode==='react'?item.prop:item.attribute;
  saved.set(id,structuredClone(edits));
  const state=encode({id,values:edits}),url=new URL(location.href);
  if(state.length<=MAX_CONTEXT){url.searchParams.set('state',state);history.replaceState(history.state,'',url);const target=new URL(guideHref({id,level:1},getSiteLocale(),true,{id,level:1}),location.href);target.searchParams.set('state',state);target.searchParams.set('framework',mode);tryLink.href=target.href;tryLink.removeAttribute('aria-disabled');tryLink.title='';}
  else {tryLink.removeAttribute('href');tryLink.setAttribute('aria-disabled','true');tryLink.title=copy('truncated');}
 }
 function send(restart=false){updateSource();if(!mounted)return;revision++;status.setAttribute('role','status');status.textContent=copy('waiting');frame.contentWindow.postMessage({type:'state-reference-config',scene,values:edits,framework:getFramework(),revision,restart},location.origin);}
 function set(item,value){try{const valid=validateStateValue(item,value,scene,document);const next={...edits,[item.attribute]:valid};compileReferenceAttributes(scene,next);edits=next;send();}catch(err){error(err.message);}}
 for(const item of fields){
  const row=make('div','state-field',controls);row.dataset.stateField=item.attribute;
  const label=make('label','state-field-title',row),toggle=make('input','',label);toggle.type='checkbox';toggle.checked=Object.hasOwn(edits,item.attribute);toggle.dataset.stateEnable=item.attribute;toggle.setAttribute('aria-label',copy('enabled')+' '+item.attribute);
  const name=make('span','',label);names.push([name,item]);
  const semantic=lesson.parameters.find(entry=>entry[0].split(' / ')[0].split(', ').includes(item.attribute));
  if(semantic){const description=make('small','',row);description.dataset.stateDescription=semantic[3];description.textContent=translate(semantic[3]);}
  const info=make('small','',row);info.textContent=fieldType(item)+(item.legacy?' · '+copy('legacy'):'');
  let input;
  if(item.kind==='select'||item.kind==='boolean'){
   input=make('select','',row);for(const value of item.kind==='boolean'?[false,true]:item.values){const option=make('option','',input);option.value=String(value);option.textContent=String(value);}
  }else if(item.kind==='json'){
   if(item.attribute==='behavior'){
    const preset=make('select','state-json-preset',row);preset.dataset.behaviorPreset='';preset.setAttribute('aria-label',copy('preset'));
    for(const type of ['wait','follow','guide','review','idle','celebrate','error']){const option=make('option','',preset);option.value=type;option.textContent=type;}
    preset.addEventListener('change',()=>{const type=preset.value,value=type==='review'?{type,targets:'.reference-item',dwell:1000}:['wait','follow','guide'].includes(type)?{type,target:'#reference-target',side:'right',gap:16}:{type};input.value=JSON.stringify(value,null,2);toggle.checked=true;input.disabled=false;set(item,value);},{signal});
   }
   input=make('textarea','',row);input.spellcheck=false;
  }else{input=make('input','',row);input.type=item.kind;if(item.kind==='number'){input.required=true;input.min=String(item.min);input.max=String(item.max);input.step=String(item.step);}}
  const initial=Object.hasOwn(edits,item.attribute)?edits[item.attribute]:fieldDefault(item,scene);
  const showValue=value=>{input.value=item.kind==='json'?JSON.stringify(value,null,2):String(value);};showValue(initial);
  input.dataset.stateControl=item.attribute;input.setAttribute('aria-label',item.attribute);input.disabled=!toggle.checked;
  const read=()=>item.kind==='json'?JSON.parse(input.value):item.kind==='number'?Number(input.value):item.kind==='boolean'?input.value==='true':input.value;
  const apply=()=>{if(input.checkValidity&&!input.checkValidity()){input.reportValidity();return;}try{set(item,read());}catch(err){error(err.message);}};
  if(item.kind==='json'){const applyButton=bindText(make('button','',row),'jsonApply');applyButton.type='button';applyButton.addEventListener('click',()=>{if(toggle.checked)apply();},{signal});bindText(make('small','',row),'help');}
  else input.addEventListener('change',apply,{signal});
  toggle.addEventListener('change',()=>{input.disabled=!toggle.checked;if(toggle.checked)apply();else{delete edits[item.attribute];send();}},{signal});
  const tr=body.insertRow();make('th','',tr).scope='row';make('td','',tr).textContent=fieldType(item);make('td','',tr).textContent=id==='state-appearance'?copy('inherited'):item.attribute==='behavior'?'null':JSON.stringify(item.initial);const effect=make('td','',tr);if(semantic){effect.dataset.stateDescription=semantic[3];effect.textContent=translate(semantic[3]);}else effect.textContent=item.legacy?copy('legacy'):'—';
 }
 reset.addEventListener('click',()=>{edits={};for(const item of fields){const input=controls.querySelector(`[data-state-control="${item.attribute}"]`);controls.querySelector(`[data-state-enable="${item.attribute}"]`).checked=false;input.disabled=true;input.value=item.kind==='json'?JSON.stringify(fieldDefault(item,scene),null,2):String(fieldDefault(item,scene));}send(true);},{signal});
 rerun.addEventListener('click',()=>send(true),{signal});
 copyButton.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(source.textContent);copyStatus.textContent=copy('copied');}catch{copyStatus.textContent=copy('copyFailed');}},{signal});
 window.addEventListener('message',event=>{
  if(event.source!==frame.contentWindow||event.origin!==location.origin||disposed)return;
  if(event.data?.type==='state-reference-mounted'){mounted=true;send();frame.contentWindow.postMessage({type:'state-reference-visibility',visible},location.origin);}
  if(event.data?.type==='state-reference-ready'&&event.data.revision===revision){status.setAttribute('role','status');status.textContent=copy(visible?'ready':'inactive');section.dataset.configured='true';}
  if(event.data?.type==='state-reference-error')error(event.data.message);
 },{signal});
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(mounted)frame.contentWindow.postMessage({type:'state-reference-visibility',visible},location.origin);if(!visible)status.textContent=copy('inactive');});observer.observe(frame);
 const unsubscribeFramework=subscribeFramework(()=>send(true));
 const unsubscribeLocale=subscribeSiteLocale(()=>{for(const el of section.querySelectorAll('[data-state-text]'))el.textContent=copy(el.dataset.stateText);for(const el of section.querySelectorAll('[data-state-description]'))el.textContent=translate(el.dataset.stateDescription);frame.title=copy('preview');updateSource();});
 updateSource();
 return ()=>{disposed=true;controller.abort();observer.disconnect();unsubscribeFramework();unsubscribeLocale();frame.remove();section.remove();};
}
