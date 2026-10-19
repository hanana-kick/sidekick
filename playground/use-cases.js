import '../src/index.ts';
import { mountSiteHeader } from './shared-header.js';
import { loadStudioSession, applyStudioSession } from './studio-session.ts';
import { scenarioGroups, scenarioById } from './scenario-catalog.js';
import { lessons, lessonById } from './guide-lessons.js';
import { getSiteLocale, subscribeSiteLocale } from './site-i18n.js';
import { guideTranslations } from './guide-translations.js';
const $ = id => document.getElementById(id);
mountSiteHeader($('site-header-brand'), 'guide');
new ResizeObserver(([entry]) => document.documentElement.style.setProperty('--header-height', `${entry.target.getBoundingClientRect().height}px`)).observe(document.querySelector('.app-header'));
let storage; try { storage = localStorage; } catch {}
const session = loadStudioSession(storage);
$('session-status').textContent = session.message;
const lessonGroups = major => [...new Set(lessons.filter(x=>x.major===major).map(x=>x.middle))].map(title=>({title,cases:lessons.filter(x=>x.major===major&&x.middle===title)}));
const navigationGroups = [{title:'빠르게 시작',groups:lessonGroups('빠르게 시작')},{title:'행동 선언',groups:scenarioGroups.map(group=>({title:group.title,cases:group.groups.flatMap(x=>x.cases)}))},{title:'직접 제어',groups:lessonGroups('직접 제어')}];
$('scenario-toc').innerHTML = '<h2>가이드 목차</h2>' + navigationGroups.map(major => `<details open><summary>${major.title}</summary>${major.groups.map(middle => `<section><h3>${middle.title}</h3>${middle.cases.map(item => `<a href="#${item.id}" data-scenario="${item.id}">${item.title}</a>`).join('')}</section>`).join('')}</details>`).join('');
$('toc-toggle').onclick = () => $('toc-toggle').setAttribute('aria-expanded', String($('toc-toggle').getAttribute('aria-expanded') !== 'true'));
$('scenario-toc').addEventListener('click', event => {
  const link = event.target.closest('a'); if (!link) return;
  $('toc-toggle').setAttribute('aria-expanded', 'false');
  if (location.hash === link.hash) { event.preventDefault(); activate(link.hash.slice(1)); }
});
document.addEventListener('keydown', event => { if (event.key === 'Escape' && $('toc-toggle').getAttribute('aria-expanded') === 'true') { $('toc-toggle').setAttribute('aria-expanded', 'false'); $('toc-toggle').focus(); } });
let active, generation = 0, level = 1;
const labels = { idle:'준비', resolving:'대상 찾는 중', moving:'대상으로 이동 중', acting:'행동 중', completed:'완료', cancelled:'중단', error:'실행 오류' };
const card = content => `<div class="app-card">${content}</div>`;
const row = (id, title, description='') => `<button class="target-item" id="${id}" type="button">${title}${description ? `<small>${description}</small>` : ''}</button>`;
function applicationMarkup(kind) {
  switch(kind) {
    case 'loading': return card('<h3>내 프로젝트</h3><div id="loading-indicator" role="status"><div class="spinner"></div><span>프로젝트 불러오는 중…</span></div><button id="app-complete">불러오기 완료</button>');
    case 'upload': return card('<h3>보고서 업로드</h3><div id="upload-progress"><span id="progress-label">0% · 전송 대기</span><div class="progress-track"><i style="width:0%"></i></div></div><button id="app-progress">진행률 +25%</button>');
    case 'success': return card('<h3>문서 저장</h3><p id="save-result">수정한 내용이 있습니다.</p><button id="app-save">저장하기</button>');
    case 'failure': return card('<h3>데이터 동기화</h3><p id="request-result">연결이 끊겨 동기화하지 못했습니다.</p><button id="app-retry">다시 시도</button><button id="app-complete" hidden>응답 성공</button>');
    case 'review': return card('<h3>배포 전 확인 목록</h3>'+row('review-1','디자인 확인','색상 · 간격 · 글자')+row('review-2','접근성 확인','키보드 · 대비 · 이름')+row('review-3','최종 결과 확인','변경 사항 · 배포')+'<p id="review-result">검토 시작</p>');
    case 'selection': return card('<h3>확인할 항목 선택</h3>'+row('selected-1','첫 번째 제안','간단한 시작 화면')+row('selected-2','두 번째 제안','상세한 대시보드')+row('selected-3','세 번째 제안','모바일 우선 레이아웃'));
    case 'paragraph': return card('<h3>제품 소개 읽기</h3><article class="target-item" id="paragraph-1"><strong>1. 시작</strong><p>작은 동료가 사용자의 작업을 함께합니다.</p></article><article class="target-item" id="paragraph-2"><strong>2. 행동</strong><p>할 일을 선언하면 동작과 시선이 연결됩니다.</p></article><button id="app-next">다음 문단</button>');
    case 'search': return card('<h3>도움말 검색</h3><label>검색어<input id="search-query" value="" placeholder="설정 또는 계정"></label><button id="app-search">검색하고 검토</button><div id="search-results">검색을 실행하세요.</div>');
    case 'input': return card('<h3>프로필 만들기</h3><label id="name-field">표시할 이름<input id="profile-name" placeholder="이름을 입력하세요" autocomplete="off"></label><button id="app-confirm">입력 완료</button><p id="input-result"></p>');
    case 'validation': return card('<h3>알림 받을 주소</h3><label id="email-field">이메일<input id="profile-email" value="hello" autocomplete="off"></label><p id="validation-result">이메일 형식을 확인해 주세요.</p><button id="app-validate">형식 검사</button>');
    case 'action': return card('<h3>준비가 끝났어요</h3><p>아래 버튼으로 첫 프로젝트를 시작합니다.</p><button id="next-action">프로젝트 만들기</button><p id="action-result"></p>');
    case 'onboarding': return card('<h3>처음 사용하는 프로젝트</h3>'+row('onboard-1','① 프로젝트 이름','프로젝트를 구분할 이름')+row('onboard-2','② 팀원 초대','함께 작업할 동료')+row('onboard-3','③ 시작하기','새 작업 공간 열기')+'<div class="app-actions"><button id="app-previous">이전</button><button id="app-next">다음</button></div>');
  }
}
function declarationFor(item) {
  const targets = {loading:'#loading-indicator',upload:'#upload-progress',success:'#save-result',failure:'#request-result',selection:'#selected-1',paragraph:'#paragraph-1',input:'#name-field',validation:'#email-field',action:'#next-action',onboarding:'#onboard-1'};
  if (item.id === 'review') return {type:'review',targets:'#demo-app .target-item',dwell:1400,side:'left',gap:6};
  if (item.id === 'search') return {type:'idle'};
  return {type: ['loading','upload','input','success'].includes(item.id) ? 'wait':'guide',target:targets[item.id],side:'left',gap:6};
}
function eventCode(kind) {
 const celebrate=`bot.behavior = { type:'celebrate', duration:1600 };`;
 const guide=target=>`bot.behavior = { type:'guide', target:${target}, side:'left', gap:6 };`;
 const examples={
  loading:`document.querySelector('#app-complete').addEventListener('click', () => {\n  ${celebrate}\n});`,
  upload:`let progress = 0;\ndocument.querySelector('#app-progress').addEventListener('click', () => {\n  progress = Math.min(100, progress + 25);\n  if (progress === 100) { ${celebrate} }\n});`,
  success:`document.querySelector('#app-save').addEventListener('click', () => {\n  ${celebrate}\n});`,
  failure:`document.querySelector('#app-retry').addEventListener('click', () => {\n  bot.behavior = { type:'wait', target:'#request-result', side:'left', gap:6 };\n});\ndocument.querySelector('#app-complete').addEventListener('click', () => {\n  ${celebrate}\n});`,
  review:`bot.addEventListener('sidekick-behavior-end', event => {\n  console.log(event.detail.status, event.detail.completedItems);\n});`,
  selection:`document.querySelectorAll('#demo-app .target-item').forEach(item => {\n  item.addEventListener('click', () => {\n    ${guide("'#' + item.id")}\n  });\n});`,
  paragraph:`document.querySelector('#app-next').addEventListener('click', () => {\n  ${guide("'#paragraph-2'")}\n});`,
  search:`// Render the app's filtered results before this declaration.\nconst targets = document.querySelectorAll('#search-results .target-item');\nbot.behavior = targets.length\n  ? { type:'review', targets:Array.from(targets), dwell:1400, side:'left', gap:6 }\n  : { type:'idle' };`,
  input:`document.querySelector('#app-confirm').addEventListener('click', () => {\n  if (document.querySelector('#profile-name').value.trim()) {\n    ${celebrate}\n  }\n});`,
  validation:`document.querySelector('#app-validate').addEventListener('click', () => {\n  const input = document.querySelector('#profile-email');\n  if (input.value && input.checkValidity()) { ${celebrate} }\n  else { ${guide("'#email-field'")} }\n});`,
  action:`document.querySelector('#next-action').addEventListener('click', () => {\n  ${celebrate}\n});`,
  onboarding:`let index = 0;\nfunction showStep() {\n  ${guide("'#onboard-' + (index + 1)")}\n}\ndocument.querySelector('#app-next').addEventListener('click', () => {\n  index = Math.min(2, index + 1); showStep();\n});\ndocument.querySelector('#app-previous').addEventListener('click', () => {\n  index = Math.max(0, index - 1); showStep();\n});`,
 };
 return `// Uses the elements in the live app example.\n// In production, trigger the same declarations from real app outcomes.\nconst bot = document.querySelector('#demo-bot');\n${examples[kind]}\n\n// On leaving this screen, remove your event listeners and call:\n// bot.stopBehavior();`;
}

function declare(config) {
 if (!active) return;
 active.declaration = config;
 $('demo-app').dataset.side=config.side??'left';$('demo-app').style.setProperty('--behavior-gap',`${config.gap??6}px`);
 renderCurrentCode();
 if (active.ready) { botDeclare(active,config); }
}
function botDeclare(entry,config) {
 try { entry.bot.behavior = config; } catch(error) { $('run-status').textContent = error.message; }
}
function stop() {
 if (!active) return;
 active.bot.stopBehavior?.(); $('run-status').textContent='중단 · 다시 실행할 수 있습니다';
}
function bindApp(entry,item) {
 const on=(id,fn)=>$(id)?.addEventListener('click',fn,{signal:entry.controller.signal});
 const success=()=>declare({type:'celebrate',duration:1600});
 const guide=target=>{document.querySelectorAll('#demo-app .target-item').forEach(el=>el.toggleAttribute('data-active','#'+el.id===target));declare({type:'guide',target,side:'left',gap:6});};
 on('app-complete',()=>{const target=$(item.id==='loading'?'loading-indicator':'request-result');target.textContent='완료되었습니다.';success();});
 let progress=0,index=0;
 on('app-progress',()=>{progress=Math.min(100,progress+25);$('progress-label').textContent=`${progress}% · ${progress===100?'업로드 완료':'전송 중'}`;document.querySelector('.progress-track i').style.width=`${progress}%`;if(progress===100)success();});
 on('app-save',()=>{$('save-result').textContent='변경 사항을 저장했습니다.';success();});
 on('app-retry',()=>{$('request-result').textContent='다시 연결하는 중…';$('app-complete').hidden=false;declare({type:'wait',target:'#request-result',side:'left',gap:6});});
 if(item.id==='selection') for(const el of document.querySelectorAll('#demo-app .target-item')) on(el.id,()=>guide('#'+el.id));
 on('app-next',()=>{index=Math.min(item.id==='paragraph'?1:2,index+1);guide(`#${item.id==='paragraph'?'paragraph':'onboard'}-${index+1}`);$('app-next').disabled=index===(item.id==='paragraph'?1:2);if($('app-previous'))$('app-previous').disabled=false;});
 on('app-previous',()=>{index=Math.max(0,index-1);guide(`#onboard-${index+1}`);$('app-previous').disabled=index===0;$('app-next').disabled=false;});
 if($('app-previous'))$('app-previous').disabled=true;
 on('app-search',()=>{const query=$('search-query').value.trim();const matches=['계정 설정','알림 설정','계정 삭제'].filter(title=>title.toLowerCase().includes(query.toLowerCase())||(guideTranslations[getSiteLocale()]?.[title]??title).toLowerCase().includes(query.toLowerCase()));$('search-results').innerHTML=matches.map((title,i)=>row('search-'+i,title)).join('')||'<p>검색 결과가 없습니다.</p>';declare(matches.length?{type:'review',targets:'#search-results .target-item',dwell:1400,side:'left',gap:6}:{type:'idle'});});
 on('app-confirm',()=>{const valid=$('profile-name').value.trim();$('input-result').textContent=valid?'입력이 완료되었습니다.':'이름을 먼저 입력해 주세요.';if(valid)success();});
 $('profile-email')?.setAttribute('type','email');
 on('app-validate',()=>{const valid=$('profile-email').checkValidity()&&!!$('profile-email').value;$('validation-result').textContent=valid?'올바른 이메일입니다.':'이메일 형식으로 수정해 주세요.';valid?success():guide('#email-field');});
 on('next-action',()=>{$('action-result').textContent='프로젝트가 준비되었습니다.';success();});
}
async function activate(id) {
 const lesson=lessonById(id);const item=lesson??scenarioById(id);const token=++generation;
 window.scrollTo({top:0,behavior:'instant'});
 if(active){active.controller.abort();active.bot.stopBehavior?.();active.bot.remove();} active=null;
 $('lesson-content').hidden=!lesson;document.querySelector('.scenario-workspace').hidden=!!lesson;$('progressive-guide').hidden=!!lesson;
 const controller=new AbortController();
 document.querySelectorAll('[data-scenario]').forEach(link=>{if(link.dataset.scenario===item.id){link.setAttribute('aria-current','page');link.closest('details').open=true;}else link.removeAttribute('aria-current');});
 $('breadcrumb').textContent=`${item.major} / ${item.middle} / ${item.title}`;
 $('scenario-title').textContent=item.title;$('scenario-sentence').textContent=item.sentence;$('scenario-hint').textContent=item.hint;
 if(lesson){renderLesson(lesson);return;}
 $('demo-app').innerHTML=applicationMarkup(item.id);$('event-code').textContent=eventCode(item.id);$('copy-status').textContent='';$('run-status').textContent='봇 준비 중…';
 const bot=document.createElement('sidekick-avatar');bot.id='demo-bot';bot.dataset.scenario=item.id;bot.className='demo-bot';bot.setAttribute('placement','inline');bot.setAttribute('interaction','none');bot.setAttribute('movement-bounds','none');
 const entry=active={bot,controller,item,ready:false};
 declare(declarationFor(item));bindApp(entry,item);renderLevel();
 const ready=new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('봇 초기화 시간이 초과되었습니다. 다시 실행해 주세요.')),12000);
  const finish=()=>{clearTimeout(timer);resolve();};
  bot.addEventListener('sidekick-ready',finish,{once:true,signal:controller.signal});
  bot.addEventListener('sidekick-error',event=>{if(!event.detail.recoverable){clearTimeout(timer);reject(new Error('WebGL 렌더러를 시작할 수 없습니다. 코드와 앱 예제는 계속 확인할 수 있습니다.'));}},{signal:controller.signal});
  controller.signal.addEventListener('abort',finish,{once:true});
 });
 bot.addEventListener('sidekick-behavior-change',()=>{
  if(active!==entry)return;const state=bot.behaviorState;
  $('run-status').textContent=`${labels[state.status]??state.status}${state.itemCount?` · ${state.completedItems}/${state.itemCount}`:''}`;
  if(state.type==='review')document.querySelectorAll('#demo-app .target-item').forEach((el,i)=>el.toggleAttribute('data-active',i===state.itemIndex));
 },{signal:controller.signal});
 $('demo-app').append(bot);
 try{if(!bot.ready)await ready;if(token!==generation)return;await applyStudioSession(bot,session.scene);if(token!==generation)return;bot.interaction='none';bot.zoom=Math.max(session.scene.zoom,2);entry.ready=true;bot.setAttribute('data-configured','');botDeclare(entry,entry.declaration);}
 catch(error){if(token===generation)$('run-status').textContent=error.message;}
}
const levelExplanations = {
  1:'가장 간단한 시작입니다. 무엇을 할지 선언하면 이동, 시선, 표정과 활동을 함께 처리합니다.',
  2:'같은 행동을 유지하면서 위치와 간격을 바꿉니다. 순차 검토는 각 항목을 보는 시간도 조절할 수 있습니다.',
  3:'앱의 완료, 실패, 선택 이벤트가 다음 행동을 결정합니다. 아래 앱을 조작하고 선언이 어떻게 바뀌는지 확인하세요.',
  4:'연출을 직접 만들 때는 의미 행동을 중단하고 이동, 시선, 표정 API를 순서대로 사용합니다. 다시 선언으로 돌아갈 수도 있습니다.',
};
function renderCurrentCode(){
 if(!active)return;
 const declaration='const bot = document.querySelector("#demo-bot");\n\nbot.behavior = '+JSON.stringify(active.declaration,null,2)+';';
 $('declaration-code').textContent=level===4?manualCode():declaration;
 $('event-code').textContent=eventCode(active.item.id);
 document.querySelector('.declaration-panel details').open=level===3;
}
function renderLevel(){
 document.querySelectorAll('[data-level]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.level)===level)));
 $('level-explanation').textContent=levelExplanations[level];$('level-options').hidden=level!==2;$('manual-controls').hidden=level!==4;
 $('dwell-field').hidden=active?.declaration.type!=='review';
 renderCurrentCode();
}
for(const button of document.querySelectorAll('[data-level]'))button.onclick=()=>{level=Number(button.dataset.level);renderLevel();};
$('apply-options').onclick=()=>{
 if(!active)return;for(const input of [$('behavior-gap'),$('behavior-dwell')])if(!input.checkValidity()){input.reportValidity();return;}const config={...active.declaration};
 if('target' in config||config.type==='review'){
  config.side=$('behavior-side').value;config.gap=Number($('behavior-gap').value);
  if(config.type==='review')config.dwell=Number($('behavior-dwell').value);
  declare(config);
 }else $('run-status').textContent='대상이 있는 행동을 다시 실행한 뒤 조절하세요.';
};
function manualCode(){return `const bot = document.querySelector('#demo-bot');
const target = document.querySelector(${JSON.stringify(active?.declaration.target??(active?.declaration.targets??'#demo-app .app-card'))});
bot.stopBehavior();
bot.trackingMode = 'off';
await bot.moveToElement(target, {
  alignX:'left', alignY:'center', x:-bot.offsetWidth-6, y:0
});
bot.lookAt({ space:'view', x:1, y:0 });
await bot.setExpression('both', 'smile', { duration:250 });
`}
$('run-manual').onclick=async()=>{
 const entry=active;if(!entry?.ready)return;
 const target=document.querySelector(entry.declaration.target??entry.declaration.targets??'#demo-app .app-card');if(!target)return;
 $('demo-app').dataset.side='left';$('demo-app').style.setProperty('--behavior-gap','6px');entry.bot.stopBehavior();entry.bot.trackingMode='off';$('run-status').textContent='직접 조합 실행 중';
 const result=await entry.bot.moveToElement(target,{alignX:'left',alignY:'center',x:-entry.bot.offsetWidth-6,y:0});
 if(active!==entry||!result.finished)return;
 entry.bot.lookAt({space:'view',x:1,y:0});await entry.bot.setExpression('both','smile',{duration:250});
 if(active===entry)$('run-status').textContent='직접 조합 완료';
};
$('return-declaration').onclick=()=>{level=1;renderLevel();if(active?.ready)botDeclare(active,active.declaration);};
function renderLesson(lesson){
 const host=$('lesson-content');host.replaceChildren();
 for(const text of lesson.paragraphs){const p=document.createElement('p');p.textContent=text;host.append(p);}
 const pre=document.createElement('pre');pre.textContent=lesson.code;pre.tabIndex=0;host.append(pre);
 const link=document.createElement('a');link.href='#'+lesson.next;link.textContent='관련 예제를 직접 실행하기 →';host.append(link);
}
// Translate visible prose only. API identifiers and copyable code remain unchanged.
const originals=new WeakMap();
function localizeGuide(){
 const dictionary=guideTranslations[getSiteLocale()]??{};
 document.title='Sidekick · '+(dictionary['가이드']??'가이드');
 for(const link of document.querySelectorAll('.catalog-layout a[href]')){if(!link.getAttribute('href').startsWith('#')){const url=new URL(link.href);url.searchParams.set('lang',getSiteLocale());link.href=url.href;}}
 const walker=document.createTreeWalker(document.querySelector('.catalog-layout'),NodeFilter.SHOW_TEXT);
 let node;while(node=walker.nextNode()){
  if(node.parentElement?.closest('pre,script,style'))continue;
  const current=node.nodeValue;const saved=originals.get(node);const original=saved&&saved.output===current?saved.original:current;
  const trimmed=original.trim();if(!trimmed)continue;
  const translated=dictionary[trimmed]??Object.keys(dictionary).sort((a,b)=>b.length-a.length).reduce((text,key)=>text.replaceAll(key,dictionary[key]),trimmed);const output=original.replace(trimmed,translated);
  originals.set(node,{original,output});if(current!==output)node.nodeValue=output;
 }
 for(const attribute of ['placeholder','aria-label'])for(const element of document.querySelectorAll(`.catalog-layout [${attribute}]`)){
  const storageKey='original'+attribute.replaceAll('-','');const key=element.dataset[storageKey]??element.getAttribute(attribute);element.dataset[storageKey]=key;element.setAttribute(attribute,dictionary[key]??key);
 }
}
let localizationQueued=false;
new MutationObserver(()=>{if(localizationQueued)return;localizationQueued=true;queueMicrotask(()=>{localizationQueued=false;localizeGuide();});}).observe(document.querySelector('.catalog-layout'),{childList:true,subtree:true,characterData:true});
subscribeSiteLocale(localizeGuide);localizeGuide();

$('restart-demo').onclick=()=>activate(active?.item.id??'loading');$('stop-demo').onclick=stop;
$('copy-code').onclick=async()=>{try{await navigator.clipboard.writeText($('declaration-code').textContent+(level===3?'\n\n'+eventCode(active.item.id).replace("const bot = document.querySelector('#demo-bot');\n",''):''));$('copy-status').textContent='복사했습니다.';}catch{$('copy-status').textContent='코드를 선택해서 복사해 주세요.';}};
window.addEventListener('hashchange',()=>activate(location.hash.slice(1)));
window.addEventListener('pagehide',()=>{active?.controller.abort();active?.bot.remove();});
activate(location.hash.slice(1)||'html-start');
