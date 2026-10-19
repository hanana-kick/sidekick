import { readGuideContext, readGuideSource, guideHref, technicalHref, lessonDestinations, navigationText, guideIds } from './guide-navigation.js';
import { emotionFlowById, emotionMarkup, emotionCode, runEmotionAction, customizeEmotionAction } from './emotion-scenarios.js';
import '../src/index.ts';
import { mountSiteHeader } from './shared-header.js';
import { loadStudioSession, applyStudioSession } from './studio-session.ts';
import { scenarioGroups, scenarioById } from './scenario-catalog.js';
import { lessons, lessonById } from './guide-lessons.js';
import { getSiteLocale, subscribeSiteLocale } from './site-i18n.js';
import { guideTranslations } from './guide-translations.js';
const $ = id => document.getElementById(id);
const t = key => guideTranslations[getSiteLocale()]?.[key] ?? key;
function setText(id,key){const element=$(id);element.dataset.guideI18n=key;element.textContent=t(key);}
const exerciseMode = document.documentElement.dataset.guideExercise === 'true';
if (!exerciseMode) mountSiteHeader($('site-header-brand'), 'guide');
let restoringContext = true;
const incomingContext = readGuideContext(location.href);
const sourceContext=readGuideSource(location.href);
const navText = () => navigationText[getSiteLocale()];
new ResizeObserver(([entry]) => document.documentElement.style.setProperty('--header-height', `${entry.target.getBoundingClientRect().height}px`)).observe(document.querySelector('.app-header'));
let storage; try { storage = localStorage; } catch {}
const session = loadStudioSession(storage);
$('session-status').textContent=t(session.message);
const lessonGroups = major => [...new Set(lessons.filter(x=>x.major===major).map(x=>x.middle))].map(title=>({title,cases:lessons.filter(x=>x.major===major&&x.middle===title)}));
const navigationGroups = [{title:'빠르게 시작',groups:lessonGroups('빠르게 시작')},{title:'행동 선언',groups:scenarioGroups.map(group=>({title:group.title,cases:group.groups.flatMap(x=>x.cases)}))},{title:'직접 제어',groups:lessonGroups('직접 제어')}];
$('scenario-toc').innerHTML = '<h2 data-guide-i18n="가이드 목차">'+t('가이드 목차')+'</h2>' + navigationGroups.map(major => `<details open><summary data-guide-i18n="${major.title}">${t(major.title)}</summary>${major.groups.map(middle => `<section><h3 data-guide-i18n="${middle.title}">${t(middle.title)}</h3>${middle.cases.map(item => `<a href="#${item.id}" data-scenario="${item.id}" data-guide-i18n="${item.title}">${t(item.title)}</a>`).join('')}</section>`).join('')}</details>`).join('');
$('toc-toggle').onclick = () => $('toc-toggle').setAttribute('aria-expanded', String($('toc-toggle').getAttribute('aria-expanded') !== 'true'));
$('scenario-toc').addEventListener('click', event => {
  const link = event.target.closest('a'); if (!link) return;
  $('toc-toggle').setAttribute('aria-expanded', 'false');
  if (location.hash === link.hash) { event.preventDefault(); activate(link.hash.slice(1)); }
});
document.addEventListener('keydown', event => { if (event.key === 'Escape' && $('toc-toggle').getAttribute('aria-expanded') === 'true') { $('toc-toggle').setAttribute('aria-expanded', 'false'); $('toc-toggle').focus(); } });
let active, generation = 0, level = incomingContext?.level ?? 1;
let restorationContext = null;
let currentId = guideIds.includes(location.hash.slice(1))?location.hash.slice(1):'html-start';
function currentEvents(){
 if(!active)return [];
 const id=active.item.id,config=active.declaration;
 if(['loading','success','input','action','validation'].includes(id))return config.type==='celebrate'?[{loading:'app-complete',success:'app-save',input:'app-confirm',action:'next-action',validation:'app-validate'}[id]]:[];
 if(id==='failure')return config.type==='celebrate'?['app-retry','app-complete']:config.type==='wait'?['app-retry']:[];
 if(id==='upload')return Array(Math.min(4,Math.round(Number($('progress-label').dataset.progress??0)/25))).fill('app-progress');
 if(id==='selection')return config.target?.startsWith('#selected-')?[config.target.slice(1)]:[];
 if(['paragraph','onboarding'].includes(id)){const index=Number(config.target?.split('-').at(-1)??1);return Array(Math.max(0,Math.min(2,index-1))).fill('app-next');}
 if(id==='search')return active.events.includes('app-search')?['app-search']:[];
 return [];
}
function contextSnapshot(){return {id:currentId,level,side:active?.declaration.side??$('behavior-side').value,gap:active?.declaration.gap??Number($('behavior-gap').value),dwell:active?.declaration.dwell??Number($('behavior-dwell').value),intensity:active?.emotionOptions?.intensity??Number($('guide-emotion-intensity').value),duration:active?.emotionOptions?.duration??Number($('guide-emotion-duration').value),event:active?.emotionEvent??-1,events:currentEvents(),inputValid:currentId==='input'&&active?.declaration.type==='celebrate',emailValid:currentId==='validation'&&active?.declaration.type==='celebrate',searchMatches:active?.searchMatches??[],emotionCustomized:active?.emotionCustomized??false,scroll:Math.round(scrollY)};}
function updateContextLinks(){
 const context=contextSnapshot(), link=$('context-playground-link');
 if(link){link.hidden=!!lessonById(currentId);link.href=lessonById(currentId)?technicalHref(currentId,getSiteLocale(),context):guideHref(context,getSiteLocale(),true,context);link.textContent=navText().try;}
 // A native anchor/history change can queue scroll before hashchange. Never overwrite its new route.
 if(!restoringContext&&(!location.hash||location.hash.slice(1)===currentId)){const url=new URL(guideHref(context,getSiteLocale(),exerciseMode,sourceContext),location.href);history.replaceState(history.state,'',url);}
 const back=$('guide-source-return');if(back)back.href=guideHref(sourceContext??incomingContext??context,getSiteLocale());
}

const labels = { idle:'준비', resolving:'대상 찾는 중', moving:'대상으로 이동 중', acting:'행동 중', completed:'완료', cancelled:'중단', error:'실행 오류' };
const card = content => `<div class="app-card">${content}</div>`;
const row = (id, title, description='') => `<button class="target-item" id="${id}" type="button">${`<span data-guide-i18n="${title}">${t(title)}</span>`}${description ? `<small data-guide-i18n="${description}">${t(description)}</small>` : ''}</button>`;
function applicationMarkup(kind) {
  const flow=emotionFlowById(kind);if(flow)return emotionMarkup(flow,t);
  switch(kind) {
    case 'loading': return card('<h3><span data-guide-i18n="내 프로젝트">내 프로젝트</span></h3><div id="loading-indicator" role="status"><div class="spinner"></div><span><span data-guide-i18n="프로젝트 불러오는 중…">프로젝트 불러오는 중…</span></span></div><button id="app-complete"><span data-guide-i18n="불러오기 완료">불러오기 완료</span></button>');
    case 'upload': return card('<h3><span data-guide-i18n="보고서 업로드">보고서 업로드</span></h3><div id="upload-progress"><span id="progress-label"><span data-guide-i18n="0% · 전송 대기">0% · 전송 대기</span></span><div class="progress-track"><i style="width:0%"></i></div></div><button id="app-progress"><span data-guide-i18n="진행률 +25%">진행률 +25%</span></button>');
    case 'success': return card('<h3><span data-guide-i18n="문서 저장">문서 저장</span></h3><p id="save-result"><span data-guide-i18n="수정한 내용이 있습니다.">수정한 내용이 있습니다.</span></p><button id="app-save"><span data-guide-i18n="저장하기">저장하기</span></button>');
    case 'failure': return card('<h3><span data-guide-i18n="데이터 동기화">데이터 동기화</span></h3><p id="request-result"><span data-guide-i18n="연결이 끊겨 동기화하지 못했습니다.">연결이 끊겨 동기화하지 못했습니다.</span></p><button id="app-retry"><span data-guide-i18n="다시 시도">다시 시도</span></button><button id="app-complete" hidden><span data-guide-i18n="응답 성공">응답 성공</span></button>');
    case 'review': return card('<h3><span data-guide-i18n="배포 전 확인 목록">배포 전 확인 목록</span></h3>'+row('review-1','디자인 확인','색상 · 간격 · 글자')+row('review-2','접근성 확인','키보드 · 대비 · 이름')+row('review-3','최종 결과 확인','변경 사항 · 배포')+'<p id="review-result"><span data-guide-i18n="검토 시작">검토 시작</span></p>');
    case 'selection': return card('<h3><span data-guide-i18n="확인할 항목 선택">확인할 항목 선택</span></h3>'+row('selected-1','첫 번째 제안','간단한 시작 화면')+row('selected-2','두 번째 제안','상세한 대시보드')+row('selected-3','세 번째 제안','모바일 우선 레이아웃'));
    case 'paragraph': return card('<h3><span data-guide-i18n="제품 소개 읽기">제품 소개 읽기</span></h3><article class="target-item" id="paragraph-1"><strong><span data-guide-i18n="1. 시작">1. 시작</span></strong><p><span data-guide-i18n="작은 동료가 사용자의 작업을 함께합니다.">작은 동료가 사용자의 작업을 함께합니다.</span></p></article><article class="target-item" id="paragraph-2"><strong><span data-guide-i18n="2. 행동">2. 행동</span></strong><p><span data-guide-i18n="할 일을 선언하면 동작과 시선이 연결됩니다.">할 일을 선언하면 동작과 시선이 연결됩니다.</span></p></article><button id="app-next"><span data-guide-i18n="다음 문단">다음 문단</span></button>');
    case 'search': return card('<h3><span data-guide-i18n="도움말 검색">도움말 검색</span></h3><label><span data-guide-i18n="검색어">검색어</span><input id="search-query" value="" placeholder="설정 또는 계정" data-guide-placeholder="설정 또는 계정"></label><button id="app-search"><span data-guide-i18n="검색하고 검토">검색하고 검토</span></button><div id="search-results"><span data-guide-i18n="검색을 실행하세요.">검색을 실행하세요.</span></div>');
    case 'input': return card('<h3><span data-guide-i18n="프로필 만들기">프로필 만들기</span></h3><label id="name-field"><span data-guide-i18n="표시할 이름">표시할 이름</span><input id="profile-name" placeholder="이름을 입력하세요" data-guide-placeholder="이름을 입력하세요" autocomplete="off"></label><button id="app-confirm"><span data-guide-i18n="입력 완료">입력 완료</span></button><p id="input-result"></p>');
    case 'validation': return card('<h3><span data-guide-i18n="알림 받을 주소">알림 받을 주소</span></h3><label id="email-field"><span data-guide-i18n="이메일">이메일</span><input id="profile-email" value="hello" autocomplete="off"></label><p id="validation-result"><span data-guide-i18n="이메일 형식을 확인해 주세요.">이메일 형식을 확인해 주세요.</span></p><button id="app-validate"><span data-guide-i18n="형식 검사">형식 검사</span></button>');
    case 'action': return card('<h3><span data-guide-i18n="준비가 끝났어요">준비가 끝났어요</span></h3><p><span data-guide-i18n="아래 버튼으로 첫 프로젝트를 시작합니다.">아래 버튼으로 첫 프로젝트를 시작합니다.</span></p><button id="next-action"><span data-guide-i18n="프로젝트 만들기">프로젝트 만들기</span></button><p id="action-result"></p>');
    case 'onboarding': return card('<h3><span data-guide-i18n="처음 사용하는 프로젝트">처음 사용하는 프로젝트</span></h3>'+row('onboard-1','① 프로젝트 이름','프로젝트를 구분할 이름')+row('onboard-2','② 팀원 초대','함께 작업할 동료')+row('onboard-3','③ 시작하기','새 작업 공간 열기')+'<div class="app-actions"><button id="app-previous"><span data-guide-i18n="이전">이전</span></button><button id="app-next"><span data-guide-i18n="다음">다음</span></button></div>');
  }
}
function declarationFor(item) {
  if(emotionFlowById(item.id))return {type:'wait',target:'#emotion-target',side:'left',gap:6};
  const targets = {loading:'#loading-indicator',upload:'#upload-progress',success:'#save-result',failure:'#request-result',selection:'#selected-1',paragraph:'#paragraph-1',input:'#name-field',validation:'#email-field',action:'#next-action',onboarding:'#onboard-1'};
  if (item.id === 'review') return {type:'review',targets:'#demo-app .target-item',dwell:1400,side:'left',gap:6};
  if (item.id === 'search') return {type:'idle'};
  return {type: ['loading','upload','input','success'].includes(item.id) ? 'wait':'guide',target:targets[item.id],side:'left',gap:6};
}
function eventCode(kind) {
 const flow=emotionFlowById(kind);if(flow)return emotionCode(flow,undefined,3);
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
 active.bot.stopBehavior?.();active.bot.cancelReaction?.(); setText('run-status','중단 · 다시 실행할 수 있습니다');
}
function bindApp(entry,item) {
 const flow=emotionFlowById(item.id);
 if(flow){
  entry.emotionAction=flow.initial;
  for(const button of document.querySelectorAll('[data-emotion-step]'))button.addEventListener('click',()=>{
   if(!entry.ready)return;
   entry.emotionEvent=Number(button.dataset.emotionStep);
   const [label,preset]=flow.buttons[entry.emotionEvent];
   for(const input of [$('guide-emotion-intensity'),$('guide-emotion-duration')])if(!input.checkValidity()){input.reportValidity();return;}
   entry.emotionCustomized=level===2;entry.emotionOptions={intensity:Number($('guide-emotion-intensity').value),duration:Number($('guide-emotion-duration').value)};
   const action=level===2?customizeEmotionAction(preset,Number($('guide-emotion-intensity').value),Number($('guide-emotion-duration').value)):preset;entry.emotionAction=action;renderCurrentCode();
   setText('emotion-feedback',label);
   try{Promise.resolve(runEmotionAction(entry.bot,action)).catch(error=>{if(active===entry)$('run-status').textContent=error.message;});}catch(error){$('run-status').textContent=error.message;}
  },{signal:entry.controller.signal});
  return;
 }
 const on=(id,fn)=>$(id)?.addEventListener('click',event=>{fn(event);entry.events.push(id);entry.events=entry.events.slice(-32);localizeGuideBindings();updateContextLinks();},{signal:entry.controller.signal});
 const success=()=>declare({type:'celebrate',duration:1600});
 const guide=target=>{document.querySelectorAll('#demo-app .target-item').forEach(el=>el.toggleAttribute('data-active','#'+el.id===target));declare({type:'guide',target,side:'left',gap:6});};
 on('app-complete',()=>{const target=$(item.id==='loading'?'loading-indicator':'request-result');target.dataset.guideI18n='완료되었습니다.';target.textContent=t('완료되었습니다.');success();});
 let progress=0,index=0;
 on('app-progress',()=>{progress=Math.min(100,progress+25);$('progress-label').dataset.progress=String(progress);$('progress-label').textContent=`${progress}% · ${t(progress===100?'업로드 완료':'전송 중')}`;document.querySelector('.progress-track i').style.width=`${progress}%`;if(progress===100)success();});
 on('app-save',()=>{setText('save-result','변경 사항을 저장했습니다.');success();});
 on('app-retry',()=>{setText('request-result','다시 연결하는 중…');$('app-complete').hidden=false;declare({type:'wait',target:'#request-result',side:'left',gap:6});});
 if(item.id==='selection') for(const el of document.querySelectorAll('#demo-app .target-item')) on(el.id,()=>guide('#'+el.id));
 on('app-next',()=>{index=Math.min(item.id==='paragraph'?1:2,index+1);guide(`#${item.id==='paragraph'?'paragraph':'onboard'}-${index+1}`);$('app-next').disabled=index===(item.id==='paragraph'?1:2);if($('app-previous'))$('app-previous').disabled=false;});
 on('app-previous',()=>{index=Math.max(0,index-1);guide(`#onboard-${index+1}`);$('app-previous').disabled=index===0;$('app-next').disabled=false;});
 if($('app-previous'))$('app-previous').disabled=true;
 on('app-search',()=>{const query=$('search-query').value.trim();const titles=['계정 설정','알림 설정','계정 삭제'];const matches=titles.filter((title,index)=>restoringContext&&restorationContext?.searchMatches?restorationContext.searchMatches.includes(index):title.toLowerCase().includes(query.toLowerCase())||(guideTranslations[getSiteLocale()]?.[title]??title).toLowerCase().includes(query.toLowerCase()));entry.searchMatches=matches.map(title=>titles.indexOf(title));$('search-results').innerHTML=matches.map((title,i)=>row('search-'+i,title)).join('')||'<p data-guide-i18n="검색 결과가 없습니다.">'+t('검색 결과가 없습니다.')+'</p>';declare(matches.length?{type:'review',targets:'#search-results .target-item',dwell:1400,side:'left',gap:6}:{type:'idle'});});
 on('app-confirm',()=>{const valid=$('profile-name').value.trim();setText('input-result',valid?'입력이 완료되었습니다.':'이름을 먼저 입력해 주세요.');if(valid)success();});
 $('profile-email')?.setAttribute('type','email');
 on('app-validate',()=>{const valid=$('profile-email').checkValidity()&&!!$('profile-email').value;setText('validation-result',valid?'올바른 이메일입니다.':'이메일 형식으로 수정해 주세요.');valid?success():guide('#email-field');});
 on('next-action',()=>{setText('action-result','프로젝트가 준비되었습니다.');success();});
}
async function activate(id) {
 const lesson=lessonById(id);const item=lesson??scenarioById(id);const token=++generation;
 currentId=item.id;const restored=readGuideContext(location.href);const context=restored?.id===item.id?restored:null;
 level=context?.level??1;
 for(const [field,key,fallback] of [['behavior-side','side','left'],['behavior-gap','gap',6],['behavior-dwell','dwell',1400],['guide-emotion-intensity','intensity',0.7],['guide-emotion-duration','duration',1200]])$(field).value=String(context?.[key]??fallback);
 restoringContext=true;restorationContext=context;
 window.scrollTo({top:0,behavior:'instant'});
 if(active){active.controller.abort();active.bot.stopBehavior?.();active.bot.remove();} active=null;
 $('lesson-content').hidden=!lesson;document.querySelector('.scenario-workspace').hidden=!!lesson;$('progressive-guide').hidden=!!lesson;
 const controller=new AbortController();
 document.querySelectorAll('[data-scenario]').forEach(link=>{if(link.dataset.scenario===item.id){link.setAttribute('aria-current','page');link.closest('details').open=true;}else link.removeAttribute('aria-current');});
 $('breadcrumb').textContent=(lessonById(item.id)?[item.major,item.middle,item.title]:['행동 선언',item.major,item.title]).map(t).join(' / ');
 setText('scenario-title',item.title);setText('scenario-sentence',item.sentence);setText('scenario-hint',item.hint);
 if(lesson){renderLesson(lesson);localizeGuideBindings();restoringContext=false;updateContextLinks();return;}
 $('demo-app').innerHTML=applicationMarkup(item.id);$('event-code').textContent=eventCode(item.id);delete $('copy-status').dataset.guideI18n;$('copy-status').textContent='';setText('run-status','봇 준비 중…');
 const bot=document.createElement('sidekick-avatar');bot.id='demo-bot';bot.dataset.scenario=item.id;bot.className='demo-bot';bot.setAttribute('placement','inline');bot.setAttribute('interaction','none');bot.setAttribute('movement-bounds','none');
 const entry=active={bot,controller,item,ready:false,events:[],emotionEvent:-1};
 const initial=declarationFor(item);if(context&&('target' in initial||initial.type==='review')){initial.side=context.side??initial.side;initial.gap=context.gap??initial.gap;if(initial.type==='review')initial.dwell=context.dwell??initial.dwell;}
 declare(initial);bindApp(entry,item);
 // Restore only known app buttons. Exercise URLs never start a behavior until Run is pressed.
 if(context?.event>=0&&emotionFlowById(item.id)?.buttons[context.event]){entry.emotionEvent=context.event;const preset=emotionFlowById(item.id).buttons[context.event][1];entry.emotionCustomized=!!context.emotionCustomized;entry.emotionOptions={intensity:context.intensity??0.7,duration:context.duration??1200};entry.emotionAction=context.emotionCustomized?customizeEmotionAction(preset,Number($('guide-emotion-intensity').value),Number($('guide-emotion-duration').value)):preset;}
 if($('profile-name')&&context?.inputValid)$('profile-name').value='Example';
 if($('profile-email')&&context?.emailValid)$('profile-email').value='example@example.com';
 for(const event of context?.events??[])$(event)?.click();
 if(context&&('target' in entry.declaration||entry.declaration.type==='review')){entry.declaration.side=context.side??entry.declaration.side;entry.declaration.gap=context.gap??entry.declaration.gap;if(entry.declaration.type==='review')entry.declaration.dwell=context.dwell??entry.declaration.dwell;declare(entry.declaration);}
 renderCurrentCode();restoringContext=false;updateContextLinks();

 renderLevel();localizeGuideBindings();
 const ready=new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('봇 초기화 시간이 초과되었습니다. 다시 실행해 주세요.')),12000);
  const finish=()=>{clearTimeout(timer);resolve();};
  bot.addEventListener('sidekick-ready',finish,{once:true,signal:controller.signal});
  bot.addEventListener('sidekick-error',event=>{if(!event.detail.recoverable){clearTimeout(timer);reject(new Error('WebGL 렌더러를 시작할 수 없습니다. 코드와 앱 예제는 계속 확인할 수 있습니다.'));}},{signal:controller.signal});
  controller.signal.addEventListener('abort',finish,{once:true});
 });
 bot.addEventListener('sidekick-behavior-change',()=>{
  if(active!==entry)return;const state=bot.behaviorState;
  delete $('run-status').dataset.guideI18n;
  $('run-status').textContent=`${t(labels[state.status]??state.status)}${state.itemCount?` · ${state.completedItems}/${state.itemCount}`:''}`;
  if(state.type==='review')document.querySelectorAll('#demo-app .target-item').forEach((el,i)=>el.toggleAttribute('data-active',i===state.itemIndex));
 },{signal:controller.signal});
 $('demo-app').append(bot);
 try{if(!bot.ready)await ready;if(token!==generation)return;await applyStudioSession(bot,session.scene);if(token!==generation)return;bot.interaction='none';bot.zoom=session.scene.zoom;entry.ready=true;bot.setAttribute('data-configured','');
 const resume=()=>{bot.stopBehavior();botDeclare(entry,entry.declaration);if(emotionFlowById(item.id))runEmotionAction(bot,entry.emotionAction);};
 if(exerciseMode){entry.resume=resume;setText('run-status','준비');}else resume();
 if(context?.scroll&&!exerciseMode)window.scrollTo({top:context.scroll,behavior:'instant'});}
 catch(error){if(token===generation)setText('run-status',error.message);}
}
const levelExplanations = {
  1:'가장 간단한 시작입니다. 무엇을 할지 선언하면 이동, 시선, 표정과 활동을 함께 처리합니다.',
  2:'같은 행동을 유지하면서 위치와 간격을 바꿉니다. 순차 검토는 각 항목을 보는 시간도 조절할 수 있습니다.',
  3:'앱의 완료, 실패, 선택 이벤트가 다음 행동을 결정합니다. 아래 앱을 조작하고 선언이 어떻게 바뀌는지 확인하세요.',
  4:'연출을 직접 만들 때는 의미 행동을 중단하고 이동, 시선, 표정 API를 순서대로 사용합니다. 다시 선언으로 돌아갈 수도 있습니다.',
};
function renderCurrentCode(){
 if(!active)return;updateContextLinks();
 const flow=emotionFlowById(active.item.id);if(flow){$('declaration-code').textContent=emotionCode(flow,active.emotionAction,level);$('event-code').textContent=emotionCode(flow,undefined,3);document.querySelector('.declaration-panel details').open=level===3;return;}
 const declaration='const bot = document.querySelector("#demo-bot");\n\nbot.behavior = '+JSON.stringify(active.declaration,null,2)+';';
 $('declaration-code').textContent=level===4?manualCode():declaration;
 $('event-code').textContent=eventCode(active.item.id);
 document.querySelector('.declaration-panel details').open=level===3;
}
function renderLevel(){
 document.querySelectorAll('[data-level]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.level)===level)));
 const emotional=!!emotionFlowById(active?.item.id);
 setText('level-explanation',emotional?{1:'행동과 감정을 각각 선언합니다. 앱의 결과 버튼을 누르면 같은 코드가 실행됩니다.',2:'강도와 반응 시간을 바꾸고 앱 이벤트를 실행해 비교하세요.',3:'앱 결과를 감정에 연결합니다. 이벤트 핸들러와 실행 코드는 동일한 선언에서 만들어집니다.',4:'이동·활동·눈·감정은 함께 조합할 수 있습니다. neutral은 감정 효과만 지웁니다.'}[level]:levelExplanations[level]);$('level-options').hidden=level!==2||emotional;$('emotion-options').hidden=level!==2||!emotional;$('manual-controls').hidden=level!==4||!!emotionFlowById(active?.item.id);
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
 }else setText('run-status','대상이 있는 행동을 다시 실행한 뒤 조절하세요.');
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
 $('demo-app').dataset.side='left';$('demo-app').style.setProperty('--behavior-gap','6px');entry.bot.stopBehavior();entry.bot.trackingMode='off';setText('run-status','직접 조합 실행 중');
 const result=await entry.bot.moveToElement(target,{alignX:'left',alignY:'center',x:-entry.bot.offsetWidth-6,y:0});
 if(active!==entry||!result.finished)return;
 entry.bot.lookAt({space:'view',x:1,y:0});await entry.bot.setExpression('both','smile',{duration:250});
 if(active===entry)setText('run-status','직접 조합 완료');
};
$('return-declaration').onclick=()=>{level=1;renderLevel();if(active?.ready)botDeclare(active,active.declaration);};
function renderLesson(lesson){
 const host=$('lesson-content');host.replaceChildren();
 for(const text of lesson.paragraphs){const p=document.createElement('p');p.dataset.guideI18n=text;p.textContent=t(text);host.append(p);}
 if(lesson.install){const install=document.createElement('pre');install.textContent=lesson.install;host.append(install);}
 const pre=document.createElement('pre');pre.textContent=lesson.code;pre.tabIndex=0;host.append(pre);
 const target=lessonDestinations[lesson.id];const link=document.createElement('a');link.dataset.lessonDestination=lesson.id;link.href=technicalHref(lesson.id,getSiteLocale(),contextSnapshot());link.textContent=target.id?navText().related+': '+t(scenarioById(target.id).title)+' · '+target.level:navText()[{appearance:'studio',placement:'placement','element-anchor':'anchor','manual-motion':'manual',performance:'performance'}[lesson.id]];host.append(link);
}
// Explicit bindings only: never scan or replace arbitrary application content.
function localizeGuideBindings(){
 for(const element of document.querySelectorAll('[data-guide-i18n]'))element.textContent=t(element.dataset.guideI18n);
 for(const element of document.querySelectorAll('[data-guide-placeholder]'))element.setAttribute('placeholder',t(element.dataset.guidePlaceholder));
 for(const element of document.querySelectorAll('[data-guide-label]'))element.setAttribute('aria-label',t(element.dataset.guideLabel));
 if(!exerciseMode)document.title='Sidekick · '+t('가이드');
 if(exerciseMode)$('restart-demo').textContent=navText().run;
 for(const link of document.querySelectorAll('[data-lesson-destination]'))link.href=technicalHref(link.dataset.lessonDestination,getSiteLocale(),contextSnapshot());
 updateContextLinks();
 for(const link of document.querySelectorAll('.catalog-layout a[href]'))if(!link.getAttribute('href').startsWith('#')){const url=new URL(link.href);url.searchParams.set('lang',getSiteLocale());link.href=url.href;}
}
function localizeGuide(){
 $('session-status').textContent=t(session.message);
 const item=lessonById(location.hash.slice(1))??active?.item??lessonById('html-start');
 if(item)$('breadcrumb').textContent=(lessonById(item.id)?[item.major,item.middle,item.title]:['행동 선언',item.major,item.title]).map(t).join(' / ');
 localizeGuideBindings();
 const progress=$('progress-label')?.dataset.progress;if(progress!==undefined)$('progress-label').textContent=progress+'% · '+t(Number(progress)===100?'업로드 완료':'전송 중');
 if(active){renderLevel();const state=active.bot.behaviorState;if(state&&!$('run-status').dataset.guideI18n)$('run-status').textContent=t(labels[state.status]??state.status)+(state.itemCount?' · '+state.completedItems+'/'+state.itemCount:'');}
}
subscribeSiteLocale(localizeGuide);localizeGuideBindings();

$('restart-demo').onclick=()=>{if(exerciseMode&&active?.resume){if(level===4&&!emotionFlowById(active.item.id))$('run-manual').click();else active.resume();return;}const context=contextSnapshot();delete context.events;delete context.event;delete context.emotionCustomized;delete context.inputValid;delete context.emailValid;delete context.searchMatches;history.replaceState(history.state,'',guideHref(context,getSiteLocale(),false,sourceContext));activate(active?.item.id??'loading');};$('stop-demo').onclick=stop;
$('copy-code').onclick=async()=>{try{await navigator.clipboard.writeText($('declaration-code').textContent+(level===3&&!emotionFlowById(active.item.id)?'\n\n'+eventCode(active.item.id).replace("const bot = document.querySelector('#demo-bot');\n",''):''));setText('copy-status','복사했습니다.');}catch{setText('copy-status','코드를 선택해서 복사해 주세요.');}};
window.addEventListener('hashchange',()=>{const id=location.hash.slice(1)||'html-start';if(currentId!==id)activate(id);});
window.addEventListener('popstate',()=>activate(location.hash.slice(1)||'html-start'));
window.addEventListener('pageshow',event=>{if(event.persisted)activate(location.hash.slice(1)||'html-start');});
window.addEventListener('pagehide',()=>{active?.controller.abort();active?.bot.remove();});
if(!exerciseMode&&sourceContext){const back=document.createElement('a');back.id='guide-source-return';back.textContent=navText().back;back.href=guideHref(sourceContext,getSiteLocale());$('scenario-main').prepend(back);}
if((location.hash&&!guideIds.includes(location.hash.slice(1)))||(new URL(location.href).searchParams.has('context')&&!incomingContext)){const warning=document.createElement('p');warning.id='invalid-guide-context';warning.setAttribute('role','alert');warning.textContent=navText().invalid;$('scenario-main').prepend(warning);}
activate(location.hash.slice(1)||'html-start');
window.addEventListener('scroll',()=>{if(!restoringContext)updateContextLinks();},{passive:true});
for(const field of ['behavior-side','behavior-gap','behavior-dwell','guide-emotion-intensity','guide-emotion-duration'])$(field).addEventListener('change',updateContextLinks);
