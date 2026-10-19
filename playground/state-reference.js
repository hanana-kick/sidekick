import { lifecycleDefaults } from './lifecycle-example.js';
import './state-reference.css';
import { getFramework, subscribeFramework } from './site-framework.js';
import { getSiteLocale, subscribeSiteLocale } from './site-i18n.js';
import { guideHref } from './guide-navigation.js';
import { POSITION_PLACEMENTS, STATE_FIELDS, JSON_FIELDS, STATE_IDS, FIELD_BY_KEY, READ_ONLY_STATE, fieldDefault, validateStateValue, compileReferenceAttributes, referenceSource } from './state-reference-schema.js';
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
 let edits=structuredClone(incoming?.id===id?incoming.values:saved.get(id)??(id==='state-lifecycle'?lifecycleDefaults:id==='state-entrance'?{entrance:fieldDefault(fields[0],scene)}:{})),revision=0,mounted=false,visible=true,disposed=false;
 const lesson=stateLessons.find(item=>item.id===id);
 const translate=value=>guideTranslations[getSiteLocale()]?.[value]??value;
 const section=document.createElement('section');section.className='state-lab';section.dataset.stateReference=id;host.append(section);
 const make=(tag,className,parent=section)=>{const el=document.createElement(tag);if(className)el.className=className;parent.append(el);return el;};
 const bindText=(el,key)=>{el.dataset.stateText=key;el.textContent=copy(key);return el;};
 bindText(make('h2'),'title');bindText(make('p'),'intro');
 const toolbar=make('div','state-lab-tools');const reset=bindText(make('button','',toolbar),'reset');reset.type='button';
 const rerun=bindText(make('button','',toolbar),'run');rerun.type='button';
 const grid=make('div','state-lab-grid');const controlPanel=make('div','state-lab-control-panel',grid);bindText(make('h3','',controlPanel),'controls');const controls=make('div','state-lab-controls',controlPanel);controls.setAttribute('aria-label',copy('controls'));
 const preview=make('div','state-lab-preview',grid);bindText(make('h3','',preview),'preview');
 const frame=make('iframe','',preview);frame.title=copy('preview');frame.src='./state-preview.html';frame.setAttribute('sandbox','allow-scripts allow-same-origin');
 bindText(make('p','',preview),'scope');const status=make('p','state-lab-status',preview);status.setAttribute('role','status');status.textContent=copy('waiting');
 if(id==='state-position'||id==='state-behavior')bindText(make('p'),'targetNote');
 if(id==='state-entrance')bindText(make('p'),'entranceNote');
 const details=make('details','state-lab-details');bindText(make('summary','',details),'controls');
 const tableWrap=make('div','state-table-wrap',details);tableWrap.tabIndex=0;const table=make('table','state-reference',tableWrap);bindText(make('caption','',table),'controls');const head=table.createTHead().insertRow();
 for(const key of ['parameter','type','initial','effect'])bindText(make('th','',head),key).scope='col';
 const body=table.createTBody();
 const sourcePanel=make('details','state-lab-source-panel',preview);sourcePanel.open=(window.matchMedia?.('(min-width: 1051px)').matches ?? true);const sourceHeading=bindText(make('summary','',sourcePanel),'source');const tools=make('div','state-lab-tools',sourcePanel);const copyButton=bindText(make('button','',tools),'copy');copyButton.type='button';const tryLink=bindText(make('a','state-try',tools),'try');tryLink.dataset.stateTry='';const copyStatus=make('span','',tools);copyStatus.setAttribute('role','status');
 const sourceNote=make('p','',sourcePanel);const source=make('pre','state-lab-source',sourcePanel);source.tabIndex=0;source.dataset.stateSource='';
 bindText(make('h3'),'readOnly');bindText(make('p'),'readOnlyNote');make('p','state-lab-readonly').textContent=READ_ONLY_STATE.join(' · ');
 const names=[];
 function fieldType(item){return item.values?.join(' | ')??(item.kind==='number'?`number · ${item.min}…${item.max} ${item.unit}`:item.kind==='json'?`JSON${item.nullable?' | null':''}`:item.kind);}
 function error(message){status.setAttribute('role','alert');status.textContent=copy('invalid')+' '+message;}
 function updateSource(){
  const mode=getFramework();sourceNote.textContent=copy(mode==='react'?'sourceNoteReact':id==='state-lifecycle'?'sourceNoteLifecycleElement':'sourceNoteElement');source.dataset.framework=mode;source.textContent=referenceSource(scene,edits,mode,id,getSiteLocale());sourceHeading.textContent=copy('source')+' · '+(mode==='react'?'React':'Custom Element');
  for(const [el,item]of names){const name=mode==='react'?item.prop:item.attribute;el.textContent=name;controls.querySelector(`[data-state-control="${item.attribute}"]`)?.setAttribute('aria-label',name);controls.querySelector(`[data-state-enable="${item.attribute}"]`)?.setAttribute('aria-label',copy('enabled')+' '+name);}
  for(const [index,item]of fields.entries())body.rows[index].cells[0].textContent=mode==='react'?item.prop:item.attribute;
  saved.set(id,structuredClone(edits));
  const state=encode({id,values:edits}),url=new URL(location.href);
  if(state.length<=MAX_CONTEXT){url.searchParams.set('state',state);history.replaceState(history.state,'',url);const target=new URL(guideHref({id,level:1},getSiteLocale(),true,{id,level:1}),location.href);target.searchParams.set('state',state);target.searchParams.set('framework',mode);tryLink.href=target.href;tryLink.removeAttribute('aria-disabled');tryLink.title='';}
  else {tryLink.removeAttribute('href');tryLink.setAttribute('aria-disabled','true');tryLink.title=copy('truncated');}
 }
 function send(restart=false){updateSource();if(!mounted)return;revision++;delete section.dataset.configured;status.setAttribute('role','status');status.textContent=copy('waiting');frame.contentWindow.postMessage({type:'state-reference-config',id,scene,locale:getSiteLocale(),values:edits,framework:getFramework(),revision,restart},location.origin);}
 function set(item,value){try{const valid=validateStateValue(item,value,scene,document);const next={...edits,[item.attribute]:valid};if(item.attribute==='positioning'){delete next['position-x'];delete next['position-y'];for(const key of ['position-x','position-y']){const checkbox=controls.querySelector(`[data-state-enable="${key}"]`),input=controls.querySelector(`[data-state-control="${key}"]`);if(checkbox)checkbox.checked=false;if(input)input.disabled=true;}}else if(['position-x','position-y'].includes(item.attribute)){delete next.positioning;const checkbox=controls.querySelector('[data-state-enable="positioning"]'),input=controls.querySelector('[data-state-control="positioning"]');if(checkbox)checkbox.checked=false;if(input)input.disabled=true;for(const control of controls.querySelectorAll('[data-positioning-control]'))control.disabled=true;}compileReferenceAttributes(scene,next);edits=next;send();return true;}catch(err){error(err.message);return false;}}
 for(const item of fields){
  const row=make('div','state-field',controls);row.dataset.stateField=item.attribute;
  const label=make('label','state-field-title',row),toggle=make('input','',label);toggle.type='checkbox';toggle.checked=Object.hasOwn(edits,item.attribute);toggle.dataset.stateEnable=item.attribute;toggle.setAttribute('aria-label',copy('enabled')+' '+item.attribute);
  const name=make('span','',label);names.push([name,item]);
  const semantic=lesson.parameters.find(entry=>entry[0].split(' / ')[0].split(', ').includes(item.attribute));
  if(semantic){const description=make('small','',row);description.dataset.stateDescription=semantic[3];description.textContent=translate(semantic[3]);}
  const info=make('small','',row);if(item.legacy)info.dataset.stateLegacy=item.attribute;info.textContent=fieldType(item)+(item.legacy?' · '+copy('legacy'):'');
  let input, syncEntrance=()=>{}, syncSpecialEnabled=()=>{};
  if(item.kind==='select'||item.kind==='boolean'){
   input=make('select','',row);for(const value of item.kind==='boolean'?[false,true]:item.values){const option=make('option','',input);option.value=String(value);option.textContent=String(value);}
  }else if(item.kind==='json'){
   if(item.attribute==='behavior'){
    const preset=make('select','state-json-preset',row);preset.dataset.behaviorPreset='';preset.setAttribute('aria-label',copy('preset'));
    for(const type of ['wait','follow','guide','review','idle','celebrate','error']){const option=make('option','',preset);option.value=type;option.textContent=type;}
    preset.addEventListener('change',()=>{const type=preset.value,value=type==='review'?{type,targets:'.reference-item',dwell:1000}:['wait','follow','guide'].includes(type)?{type,target:'#reference-target',side:'right',gap:16}:{type};input.value=JSON.stringify(value,null,2);toggle.checked=true;input.disabled=false;set(item,value);},{signal});
   }
   input=make('textarea','',row);input.spellcheck=false;
   if(item.attribute==='positioning'){
    const editor=make('div','state-entrance-controls',row);row.insertBefore(editor,input);const values={};
    const add=(key,options)=>{const label=make('label','',editor);make('span','',label).textContent=key;const control=make(options?'select':'input','',label);control.dataset.positioningControl=key;control.setAttribute('aria-label','positioning.'+key);if(options){for(const value of options){const option=make('option','',control);option.value=String(value);option.textContent=String(value);}}else{control.type='number';control.step='any';control.required=true;}values[key]=control;};
    add('target',['viewport','#reference-target']);add('placement',POSITION_PLACEMENTS);add('gap');add('follow',['true','false']);
    syncSpecialEnabled=()=>{for(const control of Object.values(values))control.disabled=!toggle.checked;};
    syncEntrance=value=>{const config=value??{};const target=config.target??'viewport';if(![...values.target.options].some(option=>option.value===target)){const option=make('option','',values.target);option.value=target;option.textContent=target;}values.target.value=target;values.placement.value=config.placement??'bottom-right';values.gap.value=String(config.gap??16);values.follow.value=String(config.follow??true);};
    for(const control of Object.values(values))control.addEventListener('change',()=>{if(!values.gap.checkValidity())return;const previous=edits.positioning??{};const value={target:values.target.value,placement:values.placement.value,gap:Number(values.gap.value),follow:values.follow.value==='true',...(previous.offset?{offset:previous.offset}:{})};if(set(item,value)){toggle.checked=true;input.disabled=false;input.value=JSON.stringify(value,null,2);syncEntrance(value);}},{signal});
   }
   if(item.attribute==='entrance'){

    const editor=make('div','state-entrance-controls',row);row.insertBefore(editor,input);
    const values={};
    const add=(key,kind,options)=>{const label=make('label','',editor),name=make('span','',label);name.textContent=key;const control=make(kind==='select'?'select':'input','',label);control.dataset.entranceControl=key;control.setAttribute('aria-label','entrance.'+key);if(kind==='select'){for(const value of options){const option=make('option','',control);option.value=value;option.textContent=value;}}else{control.type=kind;if(kind==='number'){control.min='0';control.max=key==='at'?'1':'10000';control.step='any';control.required=true;}}values[key]={control,name,label};return control;};
    add('source','select',['element','viewport','null']);add('side','select',['left','right','top','bottom']);add('at','number');add('distance','number');add('target','text');
    syncEntrance=value=>{const declaration=value??{};const element=declaration.source==='element',absent=value===null;values.source.control.value=absent?'null':declaration.source??'element';values.side.control.value=(element?declaration.direction:declaration.edge)??'right';values.side.name.textContent=element?'direction':'edge';values.side.control.setAttribute('aria-label','entrance.'+(element?'direction':'edge'));values.at.control.value=String(declaration.at??0.5);values.distance.control.value=String((element?declaration.gap:declaration.inset)??(element?16:24));values.distance.name.textContent=(element?'gap':'inset')+' (CSS px)';values.distance.control.setAttribute('aria-label','entrance.'+(element?'gap':'inset'));values.target.control.value=declaration.target??'#reference-target';values.target.label.hidden=!element;for(const key of ['side','at','distance','target'])values[key].control.disabled=absent;};
    for(const {control}of Object.values(values))control.addEventListener('change',()=>{
     const source=values.source.control.value;
     if(control===values.source.control){const value=source==='null'?null:source==='viewport'?{source,edge:'left',at:0.5,inset:24}:{source,target:'#reference-target',direction:'right',at:0.5,gap:16};if(set(item,value)){toggle.checked=true;input.disabled=false;input.value=JSON.stringify(value,null,2);syncEntrance(value);}return;}
     if(Object.values(values).some(({control})=>!control.disabled&&!control.checkValidity()))return;
     const value=source==='null'?null:source==='viewport'?{source,edge:values.side.control.value,at:Number(values.at.control.value),inset:Number(values.distance.control.value)}:{source,target:values.target.control.value,direction:values.side.control.value,at:Number(values.at.control.value),gap:Number(values.distance.control.value)};
     if(set(item,value)){toggle.checked=true;input.disabled=false;input.value=JSON.stringify(value,null,2);syncEntrance(value);}
    },{signal});
   }
  }else{input=make('input','',row);input.type=item.kind;if(item.kind==='number'){input.required=true;input.min=String(item.min);input.max=String(item.max);input.step='any';}}
  const initial=Object.hasOwn(edits,item.attribute)?edits[item.attribute]:fieldDefault(item,scene);
  const showValue=value=>{input.value=item.kind==='json'?JSON.stringify(value,null,2):String(value);syncEntrance(value);};showValue(initial);
  input.dataset.stateControl=item.attribute;input.setAttribute('aria-label',item.attribute);input.disabled=!toggle.checked;syncSpecialEnabled();
  const read=()=>item.kind==='json'?JSON.parse(input.value):item.kind==='number'?Number(input.value):item.kind==='boolean'?input.value==='true':input.value;
  const apply=()=>{if(input.checkValidity&&!input.checkValidity()){input.reportValidity();return;}try{const value=read();if(set(item,value))syncEntrance(value);}catch(err){error(err.message);}};
  if(item.kind==='json'){const applyButton=bindText(make('button','',row),'jsonApply');applyButton.type='button';applyButton.addEventListener('click',()=>{if(toggle.checked)apply();},{signal});bindText(make('small','',row),'help');const schemaDetails=make('details','',row);bindText(make('summary','',schemaDetails),'structure');const definitions=make('dl','state-json-fields',schemaDetails);for(const [name,type]of JSON_FIELDS[item.attribute]??[]){make('dt','',definitions).textContent=name;make('dd','',definitions).textContent=type;}}
  else input.addEventListener('change',apply,{signal});
  toggle.addEventListener('change',()=>{input.disabled=!toggle.checked;syncSpecialEnabled();if(toggle.checked)apply();else{const next={...edits};delete next[item.attribute];try{compileReferenceAttributes(scene,next);edits=next;send();}catch(err){toggle.checked=true;input.disabled=false;error(err.message);}}},{signal});
  const tr=body.insertRow();make('th','',tr).scope='row';const typeCell=make('td','',tr);typeCell.dataset.stateColumn='type';typeCell.dataset.label=copy('type');typeCell.textContent=fieldType(item);const initialCell=make('td','',tr);initialCell.dataset.stateColumn='initial';initialCell.dataset.label=copy('initial');initialCell.textContent=id==='state-appearance'?copy('inherited'):['behavior','entrance','positioning'].includes(item.attribute)?'null':JSON.stringify(item.initial);const effect=make('td','',tr);effect.dataset.stateColumn='effect';effect.dataset.label=copy('effect');if(semantic){effect.dataset.stateDescription=semantic[3];effect.textContent=translate(semantic[3]);}else effect.textContent=item.legacy?copy('legacy'):'—';
 }
 reset.addEventListener('click',()=>{edits={};for(const item of fields){const input=controls.querySelector(`[data-state-control="${item.attribute}"]`);controls.querySelector(`[data-state-enable="${item.attribute}"]`).checked=false;input.disabled=true;input.value=item.kind==='json'?JSON.stringify(fieldDefault(item,scene),null,2):String(fieldDefault(item,scene));if(item.attribute==='positioning'){const value=fieldDefault(item,scene);for(const key of ['target','placement','gap','follow']){const control=controls.querySelector(`[data-positioning-control="${key}"]`);if(control){control.value=String(value[key]??(key==='follow'?true:''));control.disabled=true;}}}if(item.attribute==='entrance'){const source=controls.querySelector('[data-entrance-control=source]');source.value='null';for(const control of controls.querySelectorAll('[data-entrance-control]:not([data-entrance-control=source])'))control.disabled=true;}}send(true);},{signal});
 rerun.addEventListener('click',()=>send(true),{signal});
 copyButton.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(source.textContent);copyStatus.textContent=copy('copied');}catch{copyStatus.textContent=copy('copyFailed');}},{signal});
 window.addEventListener('message',event=>{
  if(event.source!==frame.contentWindow||event.origin!==location.origin||disposed)return;
  if(event.data?.type==='state-reference-mounted'){mounted=true;send();frame.contentWindow.postMessage({type:'state-reference-visibility',visible},location.origin);}
  if(event.data?.type==='state-reference-ready'&&event.data.revision===revision){status.setAttribute('role','status');status.textContent=copy(visible?'ready':'inactive');section.dataset.configured='true';}
  if(event.data?.type==='state-reference-error'&&event.data.revision===revision)error(event.data.message);
 },{signal});
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(mounted)frame.contentWindow.postMessage({type:'state-reference-visibility',visible},location.origin);if(!visible)status.textContent=copy('inactive');});observer.observe(frame);
 const unsubscribeFramework=subscribeFramework(()=>send(true));
 const unsubscribeLocale=subscribeSiteLocale(()=>{for(const el of section.querySelectorAll('[data-state-text]'))el.textContent=copy(el.dataset.stateText);for(const el of section.querySelectorAll('[data-state-column]'))el.dataset.label=copy(el.dataset.stateColumn);for(const el of section.querySelectorAll('[data-state-description]'))el.textContent=translate(el.dataset.stateDescription);frame.title=copy('preview');controls.setAttribute('aria-label',copy('controls'));for(const el of section.querySelectorAll('[data-state-legacy]')){const field=FIELD_BY_KEY.get(el.dataset.stateLegacy);el.textContent=fieldType(field)+' · '+copy('legacy');}section.querySelector('[data-behavior-preset]')?.setAttribute('aria-label',copy('preset'));updateSource();});
 updateSource();
 return ()=>{disposed=true;controller.abort();observer.disconnect();unsubscribeFramework();unsubscribeLocale();frame.remove();section.remove();};
}
