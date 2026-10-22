import { companyGeometry, measureCompanySpeech, planCompanyPresentation, actualCompanyClear, clearEnvelope, speechBox, planCompanyRest, inside, overlaps } from './company-presentation.js';
import { createScrollIntent } from './demo-scroll-intent.js';
import { installIntentCues } from './demo-intent.js';
import { emitSourceEvent } from './example-source-event.js';
// Site-owned examples use only local fixture data. No network notifications,
// recommendation service, tracking, or perpetual animation loop is involved.
export const scenarioCopy = {
 en:{dismiss:'Dismiss tip',hint:['Scroll through the product stories. Your companion will point out the details.','A demo style is already saved. Scroll the catalog to find a cheaper match; use ♡ to change your saved styles.','Browse the feed or publish locally. New posts and mentions are simulated only here.'],company:['Explore the materials and controls.','Try listening modes.','Compare the models here.','Finishes below. Demo-only save.'],cheaper:(a,b)=>`This is $${b.price}, $${a.price-b.price} less than your saved style. Same category; fit may differ.`,post:'Local demo: a new post just arrived in your feed.',mention:'Local demo: Daniel Park mentioned @alexmorgan in a new post.',localPost:'Local demo update: a small walk, a new idea. What did you notice today?',localMention:'Local demo mention: @alexmorgan, thanks for sharing your perspective!'},
 ko:{dismiss:'안내 닫기',hint:['제품 이야기를 스크롤해 보세요. 봇이 각 요소의 특징을 짚어줍니다.','비교용 데모 상품을 미리 담아두었어요. 상품 목록을 스크롤하면 더 저렴한 상품을 알려줍니다. ♡로 관심 상품을 바꿀 수 있어요.','피드를 둘러보거나 글을 써보세요. 새 글과 멘션은 이 페이지에서만 가상으로 발생합니다.'],company:['소재와 조작부 살펴보기','청취 모드를 바꿔보세요.','두 모델 사양 비교하기','아래에서 색상 선택·데모 저장'],cheaper:(a,b)=>`이건 $${b.price}, 관심 상품보다 $${a.price-b.price} 저렴해요! 같은 카테고리지만 핏은 다를 수 있어요.`,post:'로컬 데모: 피드에 새로운 글이 도착했어요.',mention:'로컬 데모: Daniel Park가 새 글에서 @alexmorgan을 멘션했어요.',localPost:'로컬 데모 새 글: 짧은 산책에서 새로운 아이디어를 발견했어요. 오늘 무엇을 발견했나요?',localMention:'로컬 데모 멘션: @alexmorgan, 생각을 나눠주셔서 고마워요!'},
 ja:{dismiss:'案内を閉じる',hint:['製品ストーリーをスクロールすると、ボットが特徴を案内します。','比較用のデモ商品を保存済みです。商品一覧をスクロールすると安い商品を案内します。♡で変更できます。','フィードを閲覧したり投稿してみましょう。新着やメンションはこのページだけのシミュレーションです。'],company:['素材と操作部を見てみよう。','聴き方を切り替えましょう。','二つのモデルを比較。','下で色を選択。デモ内保存。'],cheaper:(a,b)=>`こちらは$${b.price}、保存した商品より$${a.price-b.price}安いです。同じカテゴリーですがフィットは異なる場合があります。`,post:'ローカルデモ：フィードに新しい投稿が届きました。',mention:'ローカルデモ：Daniel Parkが新しい投稿で@alexmorganにメンションしました。',localPost:'ローカルデモの新着：短い散歩で新しいアイデアを見つけました。今日は何を発見しましたか？',localMention:'ローカルデモのメンション：@alexmorgan、考えを共有してくれてありがとう！'},
 'zh-CN':{dismiss:'关闭提示',hint:['滚动浏览产品故事，机器人会介绍各处细节。','已收藏一件演示商品。滚动商品列表即可发现更便宜的同类商品，也可用♡更改收藏。','浏览动态或在本地发帖。新帖和提及只在此页面模拟。'],company:['近距离看看材料和控制细节。','在这里切换聆听模式。','比较这两款型号的参数。','下方选颜色，仅演示内保存。'],cheaper:(a,b)=>`这件$${b.price}，比收藏款便宜$${a.price-b.price}。同一类别，版型可能不同。`,post:'本地演示：动态中收到了一篇新帖子。',mention:'本地演示：Daniel Park在新帖子中提到了@alexmorgan。',localPost:'本地演示新帖：短暂散步带来了新想法。你今天发现了什么？',localMention:'本地演示提及：@alexmorgan，谢谢你分享想法！'}
};
// @source-start shop-match
export function cheaperMatch(products, saved, candidateId){
 const item=products.find(p=>p.id===candidateId);if(!item||saved.includes(item.id))return null;
 const reference=products.filter(p=>saved.includes(p.id)&&(p.comparisonGroup??p.cat)===(item.comparisonGroup??item.cat)&&p.price>item.price).sort((a,b)=>a.price-b.price)[0];
 return reference?{reference,item}:null;
}
// @source-end shop-match
// Keep ambient companions away from commerce actions and the mobile navigation.
// Offsets are derived from the actual host/target boxes; no page layout is changed.
export function scenarioPlacement(site,rect,width,height,viewportWidth,viewportHeight){
 if(site==='shop'){
  const top=Math.max(12,rect.top),bottom=Math.min(viewportHeight-12,rect.bottom);
  return {alignX:'left',alignY:'top',x:8,y:Math.max(8,(top+bottom-height)/2-rect.top)};
 }
 if(site==='community'){
  if(rect.top>viewportHeight*.6)return {alignX:'center',alignY:'top',x:0,y:-height-16};
  return {alignX:'right',alignY:'top',x:width+12,y:0};
 }
 const above=rect.top>=height+24;
 return {alignX:'right',alignY:above?'top':'bottom',x:0,y:above?-height-12:height+12};
}
// Capture intent while the real site is interactive but its avatar is still booting.
// Only a boolean crosses readiness; no click target or stale action is replayed.
export function captureDemoEngagement(root,win=root.ownerDocument.defaultView){
 let engaged=false;
 const mark=()=>{engaged=true;};
 root.addEventListener('click',mark,true);win.addEventListener('scroll',mark,{passive:true,capture:true});
 const dispose=()=>{root.removeEventListener('click',mark,true);win.removeEventListener('scroll',mark,true);engaged=false;};
 return {take(){const value=engaged;dispose();return value;},dispose};
}
export function installDemoScenarios({bot,root,site,locale='en',adapter,initialEngaged=false,window:win=root.ownerDocument.defaultView}){
 const doc=root.ownerDocument,t=scenarioCopy[locale]||scenarioCopy.en,seen=new Set(),visible=new Set();
 const cues=installIntentCues({root,site,locale});
 let disposed=false,paused=false,engaged=initialEngaged,busy=false,epoch=0,active=null,activeEntry=null,resting=false,speechNode=null,pending=null,cooldown=0,arrivalTimer=0,mentionTimer=0,releaseTimer=0,pendingTimer=0;
 let companyRest=null,deliveredAt=0,shopPresented=false,shopPresence=null;const interrupted=new Set();
 let activeCompanyPlan=null,companyDeliveredAt=0,companySettling=false,companySettleTimer=0;const companyRetried=new Set();
 const removers=[],timers=new Set();
 const later=(fn,ms)=>{const id=win.setTimeout(()=>{timers.delete(id);fn();},ms);timers.add(id);return id;};
 const cancelTimer=id=>{win.clearTimeout(id);timers.delete(id);};
 const listen=(target,event,fn,options)=>{target.addEventListener(event,fn,options);removers.push(()=>target.removeEventListener(event,fn,options));};
 const companyTarget=id=>{const section=root.querySelector('#'+id);const selector={'nova-design':'img,h2','nova-sound':'.nova-mode-tabs','nova-compare':'.nova-heading h2','nova-configure':'.nova-config-image,.nova-finishes>div'}[id];return section?.querySelector(selector)||section;};
 const modalOpen=()=>Boolean(root.querySelector('dialog[open]'));
 const available=()=>!disposed&&!paused&&doc.visibilityState!=='hidden'&&bot.isConnected&&(site!=='shop'||shopPresence||bot.presence?.visible!==false);
 // Fresh clipping prevents stale observer membership from reviving content in
 // an overflow scroller. Reads occur only for real scenario/geometry events.
 function clippingBox(el){
  const clip={left:0,top:0,right:win.innerWidth,bottom:win.innerHeight};
  for(let parent=el?.parentElement;parent&&parent!==doc.body;parent=parent.parentElement){
   const style=win.getComputedStyle(parent),x=/(auto|scroll|hidden|clip)/.test(style.overflowX||style.overflow),y=/(auto|scroll|hidden|clip)/.test(style.overflowY||style.overflow);
   if(!x&&!y)continue;const r=parent.getBoundingClientRect();
   if(x){clip.left=Math.max(clip.left,r.left);clip.right=Math.min(clip.right,r.right);}
   if(y){clip.top=Math.max(clip.top,r.top);clip.bottom=Math.min(clip.bottom,r.bottom);}
  }
  return clip;
 }
 const inView=(el,complete=false)=>{if(!el?.isConnected)return false;const r=el.getBoundingClientRect(),c=clippingBox(el);c.top=Math.max(32,c.top);c.bottom=Math.min(win.innerHeight-24,c.bottom);return r.width>0&&r.height>0&&(complete?r.left>=c.left&&r.right<=c.right&&r.top>=c.top&&r.bottom<=c.bottom:Math.min(r.right,c.right)>Math.max(r.left,c.left)&&Math.min(r.bottom,c.bottom)>Math.max(r.top,c.top));};
 function geometryFor(target){
  const geometry=companyGeometry(target,win),clip=clippingBox(target);
  // The image can be clipped by its section, but the viewport-level bot and
  // speech portal are not its descendants. Constrain visuals, not their viewport.
  const visuals=geometry.visuals.map(v=>{const left=Math.max(v.left,clip.left),top=Math.max(v.top,clip.top),right=Math.min(v.right,clip.right),bottom=Math.min(v.bottom,clip.bottom);return {left,top,right,bottom,width:right-left,height:bottom-top};}).filter(v=>v.width>0&&v.height>0);
  return {...geometry,visuals};
 }

 const clear=()=>{cues.reset();companySettling=false;cancelTimer(companySettleTimer);const wasActive=busy||active||resting;epoch++;busy=false;pending=null;active=null;activeEntry=null;companyRest=null;activeCompanyPlan=null;companyDeliveredAt=0;deliveredAt=0;resting=false;speechNode=null;cooldown=0;bot.clearSpeech?.();if(wasActive){bot.cancelMove();bot.detachAnchor();}cancelTimer(releaseTimer);cancelTimer(pendingTimer);};
 const scrollIntent=createScrollIntent({now:()=>win.performance.now(),setTimer:later,clearTimer:cancelTimer,onFast(){
  if(!available())return;
  const retries=site==='company'?companyRetried:interrupted;
  if(activeEntry&&deliveredAt&&Date.now()-deliveredAt<1500&&!retries.has(activeEntry.key)){seen.delete(activeEntry.key);retries.add(activeEntry.key);}
  const notice=site==='community'?(pending||(!seen.has(activeEntry?.key)?activeEntry:null)):null;
  clear();pending=notice;
 },onSettle(){if(!available())return;companySettling=false;cancelTimer(companySettleTimer);if(site==='community'){const next=pending;pending=null;if(next)void present(next);if(!active)returnHome();}else{pending=null;cancelTimer(pendingTimer);consider();}}});
 scrollIntent.prime(win,win.scrollX,win.scrollY);
 function sampleScroll(event){const target=event.target;const source=target&&target!==doc&&target!==win&&target!==doc.documentElement&&target!==doc.body?target:win;scrollIntent.sample(source,source===win?win.scrollX:source.scrollLeft||0,source===win?win.scrollY:source.scrollTop||0,win.innerHeight);}
 // Company validates once in companyGeometryChanged(), including its rest state.
 function invalidateScrolledTarget(){if(!active||site==='company')return;if(!inView(active)||(site==='shop'&&!currentEntry(activeEntry)))clear();}
 function returnHome(){
  const home=site==='community'&&root.querySelector('#th-companion-home');
  if(!home||!available()||scrollIntent.blocked()||modalOpen()||busy||pending||resting)return;
  resting=true;
  void bot.moveToElement(home,{alignX:'left',alignY:'top',anchor:true,duration:win.matchMedia('(prefers-reduced-motion: reduce)').matches?0:550,travel:'none'}).catch(()=>{});
 }
 // A stopped companion over a different product implies a false recommendation.
 // Fade in place only after settlement; keep the hide latched through tiny tails.
 function parkShop(){
  if(site!=='shop'||!shopPresented||shopPresence||!available()||scrollIntent.blocked()||modalOpen()||busy||active||pending||bot.presence?.visible===false)return;
  shopPresence={previous:bot.presence??null};bot.presence={visible:false};
 }
 function releaseShopPresence(reveal=false){
  if(!shopPresence)return false;
  const owned=shopPresence;shopPresence=null;
  if(bot.presence?.visible!==false)return false; // An outside owner already changed it.
  bot.presence=owned.previous;
  // Clearing a declaration alone does not reveal the existing hidden renderer.
  // Manual control gets its original, unmoved position back before taking over.
  if(reveal&&bot.isConnected)void bot.moveTo(bot.position,{duration:0,travel:'none'}).catch(()=>{});
  return true;
 }
 function finishPresentation(){
  cancelTimer(releaseTimer);cues.reset();bot.clearSpeech();bot.detachAnchor();active=null;activeEntry=null;speechNode=null;cooldown=0;
  const next=pending;pending=null;cancelTimer(pendingTimer);
  const valid=next&&currentEntry(next);
  if(valid&&!seen.has(valid.key)&&inView(valid.target))void present(valid);else returnHome();
 }
 function abandon(){const next=pending;clear();if(next)void present(next);}
 function currentEntry(entry){
  if(site==='community'){const nav=root.querySelector('[data-nav="notifications"]');return {...entry,target:inView(nav)?nav:root.querySelector('.th-feed-header')};}
  if(site!=='shop')return entry;
  const state=adapter?.getScenarioState?.();
  const match=state&&cheaperMatch(state.products,state.saved,Number(entry.target.dataset.product));
  const picture=entry.target.querySelector('.muse-product-picture'),anchor=picture||entry.target;
  const rect=anchor.getBoundingClientRect(),space=Math.min(win.innerHeight-12,rect.bottom)-Math.max(12,rect.top);
  const price=entry.target.querySelector('.muse-price'),priceVisible=!price||inView(price,true);
  return match&&priceVisible&&inView(anchor)&&(!picture||space>=(bot.offsetHeight||115)+16)?{...entry,anchor,text:t.cheaper(match.reference,match.item),intent:cues.copy.shop(match.reference,match.item)}:null;
 }
 function companyPlan(entry){
  const geometry=geometryFor(entry.target);
  const speech=measureCompanySpeech(entry.text,doc,geometry.viewport);
  return planCompanyPresentation({...geometry,speech,host:{width:bot.offsetWidth||115,height:bot.offsetHeight||115}});
 }
 async function present(entry){
  if(!entry||!available()||(seen.has(entry.key)&&!entry.quiet))return;
  if(scrollIntent.blocked()){if(site==='community')pending=entry;return;}
  entry=currentEntry(entry);
  if(!entry||!inView(entry.target)||(site==='company'&&companySettling))return;
  if(modalOpen()||busy){pending=entry;return;}
  if(Date.now()<cooldown){pending=entry;cancelTimer(pendingTimer);pendingTimer=later(()=>{const next=pending;pending=null;if(next)void present(next);},cooldown-Date.now());return;}
  if(!entry.quiet)cues.begin(entry);
  const company=site==='company'?companyPlan(entry):null;
  if(site==='company'&&!company){cues.reset();return;} // Retry only on later real geometry/engagement events.
  busy=true;resting=false;companyRest=null;active=entry.target;activeEntry=entry;activeCompanyPlan=company;const token=++epoch;
  try{
   // @source-start present
   // A false declaration may still be fading. Only an actually hidden
   // renderer can relocate atomically without a visible discontinuity.
   const hiddenRestore=Boolean(shopPresence&&bot.presence?.visible===false&&bot.presenceState==='hidden');
   const anchor=entry.anchor||entry.target;releaseShopPresence();
   if(site==='shop')shopPresented=true;
   const result=await bot.moveToElement(anchor,{...(company?.offset||scenarioPlacement(site,anchor.getBoundingClientRect(),bot.offsetWidth||115,bot.offsetHeight||115,win.innerWidth,win.innerHeight)),anchor:true,duration:hiddenRestore||win.matchMedia('(prefers-reduced-motion: reduce)').matches?0:550,travel:'none'});
   if(token!==epoch)return;
   if(result?.finished===false){abandon();return;}
   if(scrollIntent.fast()){abandon();return;}
   if(modalOpen()){const waiting=pending||entry;clear();pending=waiting;return;}
   const previousTarget=entry.target;entry=currentEntry(entry);
   if(site==='community'&&entry?.target!==previousTarget){
    const queued=pending;clear();
    if(scrollIntent.blocked())pending=queued||entry;else{void present(entry);if(queued)pending=queued;}
    return;
   }
   if(!entry){abandon();return;}
   if(!available()||!inView(entry.target)){abandon();consider();return;}
   if(company){
    validateCompany();if(token!==epoch)return;
    const current=activeCompanyPlan,actual=bot.getBoundingClientRect();
    if(!current||Math.abs(actual.left-current.host.left)>1||Math.abs(actual.top-current.host.top)>1){clear();return;}
   }
   const placement=company?.placement||(site==='shop'?'auto':site==='community'?'top':anchor.getBoundingClientRect().top>bot.getBoundingClientRect().top?'top':'bottom');
   if(!entry.quiet)bot.say(entry.text,{duration:6000,placement,dismissible:true,dismissLabel:t.dismiss});
   const portal=doc.querySelector('[data-sidekick-speech]');
   if(company&&!actualCompanyClear(bot,portal,entry.target,win)){clear();return;}
   if(!entry.quiet){cues.complete(entry);deliveredAt=Date.now();seen.add(entry.key);speechNode=portal;if(company)companyDeliveredAt=Date.now();cooldown=Date.now()+7500;}
   if(!entry.quiet&&entry.sourceId)emitSourceEvent(entry.sourceId,win);
   // @source-end present
   releaseTimer=later(()=>{if(token===epoch)finishPresentation();},6200);
  }catch(error){if(token===epoch){cues.reset();root.dispatchEvent(new win.CustomEvent('sidekick-demo-scenario-error',{detail:{message:String(error.message)}}));}}
  finally{if(token===epoch){busy=false;if(pending){cancelTimer(pendingTimer);pendingTimer=later(()=>{const next=pending;pending=null;if(next)void present(next);},Math.max(0,cooldown-Date.now()));}}}
 }
 function parkCompany(){
  if(site!=='company'||!available()||scrollIntent.blocked()||busy||active||modalOpen())return;
  for(const id of ['nova-design','nova-sound','nova-compare','nova-configure']){
   const target=companyTarget(id);if(!target)continue;
   const geometry=geometryFor(target),actual=bot.getBoundingClientRect();
   if(inside(actual,geometry.viewport)&&geometry.protectedRects.every(r=>!overlaps(actual,r,8)))return;
   const rest=planCompanyRest({...geometry,host:{width:bot.offsetWidth||115,height:bot.offsetHeight||115}});if(!rest)continue;
   const offset={alignX:'left',alignY:'top',x:rest.left-geometry.target.left,y:rest.top-geometry.target.top};
   if(companyRest?.target===target&&Math.abs(companyRest.x-offset.x)<1&&Math.abs(companyRest.y-offset.y)<1)return;
   const attempt={target,...offset},token=epoch;companyRest=attempt;resting=true;
   const releaseOwnedRest=()=>{if(token!==epoch||companyRest!==attempt)return;companyRest=null;resting=false;bot.detachAnchor();};
   let motion;try{motion=bot.moveToElement(target,{...offset,anchor:true,duration:win.matchMedia('(prefers-reduced-motion: reduce)').matches?0:550,travel:'none'});}catch{releaseOwnedRest();return;}
   void Promise.resolve(motion).then(result=>{
    if(token!==epoch||companyRest!==attempt)return;
    const latest=geometryFor(target),actual=bot.getBoundingClientRect();
    if(result?.finished===false||!inside(actual,latest.viewport)||latest.protectedRects.some(r=>overlaps(actual,r,8)))releaseOwnedRest();
   }).catch(releaseOwnedRest);return;
  }
 }
 function relevance(target){if(!target)return Infinity;const r=target.getBoundingClientRect();return Math.abs((Math.max(32,r.top)+Math.min(win.innerHeight-24,r.bottom))/2-win.innerHeight/2);}
 function consider(){
  if(!available()||!engaged||scrollIntent.blocked()||modalOpen()||(site==='company'&&companySettling))return;
  if(active&&(!inView(active)||(site==='shop'&&!currentEntry(activeEntry)))){if(site==='company')validateCompany();else clear();}
  if(site==='company'){
   // @source-start company-section
   const sections = [
    // @source-start nova-design
    'nova-design',
    // @source-end nova-design
    // @source-start nova-sound
    'nova-sound',
    // @source-end nova-sound
    // @source-start nova-compare
    'nova-compare',
    // @source-end nova-compare
    // @source-start nova-configure
    'nova-configure',
    // @source-end nova-configure
   ];
   const candidates=sections.map((id,i)=>({id,i,target:companyTarget(id)})).map(entry=>({...entry,distance:relevance(entry.target)})).sort((a,b)=>a.distance-b.distance);
   for(const {i,id,target} of candidates){
    if(inView(target)&&!seen.has(id)){const entry={key:id,sourceId:id,target,text:t.company[i]};if(companyPlan(entry)){void present(entry);break;}}
   }
   if(!active)parkCompany();
   // @source-end company-section
  }else if(site==='shop'){
   // @source-start shop-cheaper
   const state=adapter?.getScenarioState?.();if(!state)return;
   refreshShopCues(state);
   let known=null;
   for(const {target} of [...new Set([...root.querySelectorAll('.muse-product'),...visible])].map(target=>({target,distance:relevance(target)})).sort((a,b)=>a.distance-b.distance)){
    const match=cheaperMatch(state.products,state.saved,Number(target.dataset.product));if(!match)continue;
    const entry=currentEntry({key:'offer-'+match.item.id,sourceId:'shop-cheaper',target,text:t.cheaper(match.reference,match.item)});if(!entry)continue;
    if(!seen.has(entry.key)){void present(entry);break;}
    known??=entry;
   }
   // Returning to an explained match restores its association, not its speech.
   if(!active&&!busy&&!pending){if(known&&shopPresented)void present({...known,quiet:true});else parkShop();}
   // @source-end shop-cheaper
  }
 }
 function modalChanged(){
  if(!available())return;
  if(modalOpen()){
   const waiting=pending||(activeEntry&&!seen.has(activeEntry.key)?activeEntry:null);
   clear();pending=waiting;
  }else{const next=pending;pending=null;if(next)void present(next);else{consider();if(!active)returnHome();}}
 }
 const speechObserver=win.MutationObserver?new win.MutationObserver(()=>{if(speechNode&&!speechNode.isConnected&&activeEntry&&!busy&&available())finishPresentation();}):null;
 speechObserver?.observe(doc.body,{childList:true});
 const modalObserver=win.MutationObserver?new win.MutationObserver(modalChanged):null;
 modalObserver?.observe(root,{attributes:true,attributeFilter:['open'],subtree:true});
 listen(root,'close',modalChanged,true);
 const observer=win.IntersectionObserver?new win.IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting&&e.intersectionRatio>=.25)visible.add(e.target);else visible.delete(e.target);}consider();},{threshold:[0,.25,.6]}):null;
 function refreshShopCues(state=adapter?.getScenarioState?.()){if(site!=='shop'||!state)return;cues.updateShop(target=>{const match=cheaperMatch(state.products,state.saved,Number(target.dataset.product));return match?cues.copy.shop(match.reference,match.item):null;});}
 function observe(){cues.shopSlots();refreshShopCues();visible.clear();observer?.disconnect();for(const el of site==='company'?['nova-design','nova-sound','nova-compare','nova-configure'].map(companyTarget).filter(Boolean):root.querySelectorAll('.muse-product'))observer?.observe(el);}
 const mutation=site==='shop'&&win.MutationObserver?new win.MutationObserver(observe):null;
 mutation?.observe(root.querySelector('#muse-product-grid'),{childList:true});observe();
 function queueArrival(){if(site==='community'&&!arrivalTimer&&!seen.has('new-post'))arrivalTimer=later(()=>{arrivalTimer=0;if(available()){adapter?.simulateArrival?.('post');seen.add('new-post');}},1800);}
 function validateCompany(){
  if(!active||!activeCompanyPlan)return;
  const geometry=geometryFor(active),r=geometry.target,p=activeCompanyPlan;
  const left=r.left+p.offset.x,top=r.top+p.offset.y;
  const width=bot.offsetWidth||115,height=bot.offsetHeight||115;
  const host={left,top,width,height,right:left+width,bottom:top+height};
  const speech=p.viewport.width===geometry.viewport.width?p.bubble:measureCompanySpeech(activeEntry.text,doc,geometry.viewport);
  const bubble=speechBox(host,speech,geometry.viewport,p.placement);
  if(inView(active)&&clearEnvelope(host,bubble,geometry.viewport,geometry.protectedRects)){p.host=host;p.bubble=bubble;p.viewport=geometry.viewport;return;}
  const key=activeEntry?.key;
  // An interrupted glance is not a consumed story. At most one retry follows a
  // real settled-scroll event, never an idle timer loop or every wheel tick.
  if(companyDeliveredAt&&Date.now()-companyDeliveredAt<1500&&!companyRetried.has(key)){seen.delete(key);companyRetried.add(key);}
  clear();
 }
 function companyGeometryChanged(){
  if(!available())return;
  if(companyRest){
   const geometry=geometryFor(companyRest.target),r=geometry.target;
   const host={left:r.left+companyRest.x,top:r.top+companyRest.y,width:bot.offsetWidth||115,height:bot.offsetHeight||115};host.right=host.left+host.width;host.bottom=host.top+host.height;
   if(!inView(companyRest.target)||!inside(host,geometry.viewport)||geometry.protectedRects.some(rect=>overlaps(host,rect,8))){bot.cancelMove();bot.detachAnchor();companyRest=null;resting=false;}
  }
  validateCompany();companySettling=true;cancelTimer(companySettleTimer);
  companySettleTimer=later(()=>{companySettling=false;consider();},180);
 }
 // Capture nested scrolling too; iframe documents own their own local scheduler.
 listen(win,'scroll',event=>{if(!available())return;engaged=true;sampleScroll(event);invalidateScrolledTarget();if(site==='company')companyGeometryChanged();queueArrival();},{passive:true,capture:true});
 listen(win,'resize',()=>{if(!available())return;scrollIntent.prime(win,win.scrollX,win.scrollY);scrollIntent.geometry();invalidateScrolledTarget();if(site==='company')companyGeometryChanged();},{passive:true});
 if(win.visualViewport)for(const event of ['resize','scroll'])listen(win.visualViewport,event,()=>{if(!available())return;scrollIntent.geometry();invalidateScrolledTarget();if(site==='company')companyGeometryChanged();},{passive:true});
 if(site==='community'){cues.refreshCommunity();for(const event of ['input','keydown'])listen(root,event,()=>cues.refreshCommunity());}
 listen(root,'click',()=>{cues.refreshCommunity();engaged=true;if(site==='shop')later(consider,0);else if(site==='company')later(()=>{validateCompany();consider();},0);});
 // @source-start community-notice
 listen(root,'sidekick-demo-arrival',event=>{if(!available())return;const target=root.querySelector('[data-nav="notifications"]')||root.querySelector('.th-feed-header');void present({key:'arrival-'+event.detail.id,sourceId:event.detail.kind==='mention'?'community-mention-present':'community-post-present',target:inView(target)?target:root.querySelector('.th-feed-header'),intent:event.detail.kind==='mention'?cues.copy.mention:cues.copy.post,text:event.detail.kind==='mention'?t.mention:t.post});});
 // @source-end community-notice
 listen(root,'sidekick-demo-published',()=>{if(mentionTimer||seen.has('mention'))return;mentionTimer=later(()=>{mentionTimer=0;if(available()){adapter?.simulateArrival?.('mention');seen.add('mention');}},1400);});
 listen(doc,'visibilitychange',()=>{if(doc.visibilityState==='hidden'){scrollIntent.reset();clear();for(const id of timers)win.clearTimeout(id);timers.clear();arrivalTimer=mentionTimer=0;}else if(available()){scrollIntent.prime(win,win.scrollX,win.scrollY);consider();if(!active)returnHome();}});
 if(initialEngaged)queueArrival();
 returnHome();
 if(initialEngaged)scrollIntent.geometry();
 return {setPaused(value){paused=value;scrollIntent.reset();scrollIntent.prime(win,win.scrollX,win.scrollY);if(value){clear();releaseShopPresence(true);}else{consider();if(!active)returnHome();}},dispose(){if(disposed)return;disposed=true;scrollIntent.dispose();clear();releaseShopPresence(true);cues.dispose();for(const id of timers)win.clearTimeout(id);timers.clear();observer?.disconnect();mutation?.disconnect();modalObserver?.disconnect();speechObserver?.disconnect();removers.forEach(fn=>fn());}};
}
