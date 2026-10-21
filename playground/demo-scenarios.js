import { companyGeometry, measureCompanySpeech, planCompanyPresentation, actualCompanyClear, clearEnvelope, speechBox } from './company-presentation.js';
import { emitSourceEvent } from './example-source-event.js';
// Site-owned examples use only local fixture data. No network notifications,
// recommendation service, tracking, or perpetual animation loop is involved.
export const scenarioCopy = {
 en:{dismiss:'Dismiss tip',hint:['Scroll through the product stories. Your companion will point out the details.','Save a style with ♡, then browse. Your companion spots cheaper items in the same category.','Browse the feed or publish locally. New posts and mentions are simulated only here.'],company:['Explore the materials and controls.','Try the listening modes here.','Compare the models here.','Choose a finish. Saved only in this demo.'],cheaper:(a,b)=>`This is $${b.price}, $${a.price-b.price} less than your saved style. Same category; fit may differ.`,post:'Local demo: a new post just arrived in your feed.',mention:'Local demo: Daniel Park mentioned @alexmorgan in a new post.',localPost:'Local demo update: a small walk, a new idea. What did you notice today?',localMention:'Local demo mention: @alexmorgan, thanks for sharing your perspective!'},
 ko:{dismiss:'안내 닫기',hint:['제품 이야기를 스크롤해 보세요. 봇이 각 요소의 특징을 짚어줍니다.','♡로 관심 상품을 담고 둘러보세요. 같은 카테고리의 더 저렴한 상품을 봇이 알려줍니다.','피드를 둘러보거나 글을 써보세요. 새 글과 멘션은 이 페이지에서만 가상으로 발생합니다.'],company:['소재와 조작부를 가까이 살펴보세요.','여기서 청취 모드를 바꿔보세요.','두 모델의 사양을 비교해 보세요.','색상을 골라보세요. 이 데모에만 저장돼요.'],cheaper:(a,b)=>`이건 $${b.price}, 관심 상품보다 $${a.price-b.price} 저렴해요! 같은 카테고리지만 핏은 다를 수 있어요.`,post:'로컬 데모: 피드에 새로운 글이 도착했어요.',mention:'로컬 데모: Daniel Park가 새 글에서 @alexmorgan을 멘션했어요.',localPost:'로컬 데모 새 글: 짧은 산책에서 새로운 아이디어를 발견했어요. 오늘 무엇을 발견했나요?',localMention:'로컬 데모 멘션: @alexmorgan, 생각을 나눠주셔서 고마워요!'},
 ja:{dismiss:'案内を閉じる',hint:['製品ストーリーをスクロールすると、ボットが特徴を案内します。','♡で気になる商品を保存して見て回ると、同じカテゴリーの安い商品を案内します。','フィードを閲覧したり投稿してみましょう。新着やメンションはこのページだけのシミュレーションです。'],company:['素材と操作部を見てみましょう。','ここでリスニングモードを切り替えられます。','二つのモデルの仕様を比較できます。','色を選べます。このデモ内だけの保存です。'],cheaper:(a,b)=>`こちらは$${b.price}、保存した商品より$${a.price-b.price}安いです。同じカテゴリーですがフィットは異なる場合があります。`,post:'ローカルデモ：フィードに新しい投稿が届きました。',mention:'ローカルデモ：Daniel Parkが新しい投稿で@alexmorganにメンションしました。',localPost:'ローカルデモの新着：短い散歩で新しいアイデアを見つけました。今日は何を発見しましたか？',localMention:'ローカルデモのメンション：@alexmorgan、考えを共有してくれてありがとう！'},
 'zh-CN':{dismiss:'关闭提示',hint:['滚动浏览产品故事，机器人会介绍各处细节。','用♡收藏款式后继续浏览，机器人会发现同类别中更便宜的商品。','浏览动态或在本地发帖。新帖和提及只在此页面模拟。'],company:['近距离看看材料和控制细节。','在这里切换聆听模式。','比较这两款型号的参数。','选择颜色，仅保存在此演示中。'],cheaper:(a,b)=>`这件$${b.price}，比收藏款便宜$${a.price-b.price}。同一类别，版型可能不同。`,post:'本地演示：动态中收到了一篇新帖子。',mention:'本地演示：Daniel Park在新帖子中提到了@alexmorgan。',localPost:'本地演示新帖：短暂散步带来了新想法。你今天发现了什么？',localMention:'本地演示提及：@alexmorgan，谢谢你分享想法！'}
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
 root.addEventListener('click',mark,true);win.addEventListener('scroll',mark,{passive:true});
 const dispose=()=>{root.removeEventListener('click',mark,true);win.removeEventListener('scroll',mark);engaged=false;};
 return {take(){const value=engaged;dispose();return value;},dispose};
}
export function installDemoScenarios({bot,root,site,locale='en',adapter,initialEngaged=false,window:win=root.ownerDocument.defaultView}){
 const doc=root.ownerDocument,t=scenarioCopy[locale]||scenarioCopy.en,seen=new Set(),visible=new Set();
 let disposed=false,paused=false,engaged=initialEngaged,busy=false,epoch=0,active=null,activeEntry=null,resting=false,speechNode=null,pending=null,cooldown=0,arrivalTimer=0,mentionTimer=0,releaseTimer=0,pendingTimer=0;
 let activeCompanyPlan=null,companyDeliveredAt=0,companySettling=false,companySettleTimer=0;const companyRetried=new Set();
 const removers=[],timers=new Set();
 const later=(fn,ms)=>{const id=win.setTimeout(()=>{timers.delete(id);fn();},ms);timers.add(id);return id;};
 const cancelTimer=id=>{win.clearTimeout(id);timers.delete(id);};
 const listen=(target,event,fn,options)=>{target.addEventListener(event,fn,options);removers.push(()=>target.removeEventListener(event,fn,options));};
 const companyTarget=id=>{const section=root.querySelector('#'+id);const selector={'nova-design':'h2','nova-sound':'.nova-mode-tabs','nova-compare':'.nova-heading h2','nova-configure':'.nova-finishes>div'}[id];return section?.querySelector(selector)||section;};
 const modalOpen=()=>Boolean(root.querySelector('dialog[open]'));
 const available=()=>!disposed&&!paused&&doc.visibilityState!=='hidden'&&bot.isConnected;
 const inView=el=>{if(!el?.isConnected)return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>32&&r.top<win.innerHeight-24;};
 const clear=()=>{companySettling=false;cancelTimer(companySettleTimer);const wasActive=busy||active||resting;epoch++;busy=false;pending=null;active=null;activeEntry=null;activeCompanyPlan=null;companyDeliveredAt=0;resting=false;speechNode=null;cooldown=0;bot.clearSpeech?.();if(wasActive){bot.cancelMove();bot.detachAnchor();}cancelTimer(releaseTimer);cancelTimer(pendingTimer);};
 function returnHome(duration=400){
  const home=site==='community'&&root.querySelector('#th-companion-home');
  if(!home||!available()||modalOpen()||busy||pending||resting)return;
  resting=true;
  void bot.moveToElement(home,{alignX:'left',alignY:'top',anchor:true,duration:win.matchMedia('(prefers-reduced-motion: reduce)').matches?0:duration,travel:'none'}).catch(()=>{});
 }
 function finishPresentation(){
  cancelTimer(releaseTimer);bot.clearSpeech();bot.detachAnchor();active=null;activeEntry=null;speechNode=null;cooldown=0;
  const next=pending;pending=null;cancelTimer(pendingTimer);
  const valid=next&&currentEntry(next);
  if(valid&&!seen.has(valid.key)&&inView(valid.target))void present(valid);else returnHome();
 }
 function abandon(){const next=pending;clear();if(next)void present(next);}
 function currentEntry(entry){
  if(site!=='shop')return entry;
  const state=adapter?.getScenarioState?.();
  const match=state&&cheaperMatch(state.products,state.saved,Number(entry.target.dataset.product));
  const picture=entry.target.querySelector('.muse-product-picture'),anchor=picture||entry.target;
  const rect=anchor.getBoundingClientRect(),space=Math.min(win.innerHeight-12,rect.bottom)-Math.max(12,rect.top);
  return match&&inView(anchor)&&(!picture||space>=(bot.offsetHeight||115)+16)?{...entry,anchor,text:t.cheaper(match.reference,match.item)}:null;
 }
 function companyPlan(entry){
  const geometry=companyGeometry(entry.target,win);
  const speech=measureCompanySpeech(entry.text,doc,geometry.viewport);
  return planCompanyPresentation({...geometry,speech,host:{width:bot.offsetWidth||115,height:bot.offsetHeight||115}});
 }
 async function present(entry){
  entry=currentEntry(entry);
  if(!entry||!available()||seen.has(entry.key)||!inView(entry.target)||(site==='company'&&companySettling))return;
  if(modalOpen()||busy){pending=entry;return;}
  if(Date.now()<cooldown){pending=entry;cancelTimer(pendingTimer);pendingTimer=later(()=>{const next=pending;pending=null;if(next)void present(next);},cooldown-Date.now());return;}
  const company=site==='company'?companyPlan(entry):null;
  if(site==='company'&&!company)return; // Retry only on later real geometry/engagement events.
  busy=true;resting=false;active=entry.target;activeEntry=entry;activeCompanyPlan=company;const token=++epoch;
  try{
   // @source-start present
   const anchor=entry.anchor||entry.target;
   const result=await bot.moveToElement(anchor,{...(company?.offset||scenarioPlacement(site,anchor.getBoundingClientRect(),bot.offsetWidth||115,bot.offsetHeight||115,win.innerWidth,win.innerHeight)),anchor:true,duration:win.matchMedia('(prefers-reduced-motion: reduce)').matches?0:550,travel:'none'});
   if(token!==epoch)return;
   if(result?.finished===false){abandon();return;}
   if(modalOpen()){const waiting=pending||entry;clear();pending=waiting;return;}
   entry=currentEntry(entry);
   if(!entry){abandon();return;}
   if(!available()||!inView(entry.target)){abandon();consider();return;}
   if(company){
    const current=companyPlan(entry),actual=bot.getBoundingClientRect();
    if(!current||Math.abs(actual.left-current.host.left)>1||Math.abs(actual.top-current.host.top)>1){clear();return;}
   }
   const placement=company?.placement||(site==='shop'?'auto':site==='community'?'top':anchor.getBoundingClientRect().top>bot.getBoundingClientRect().top?'top':'bottom');
   bot.say(entry.text,{duration:6000,placement,dismissible:true,dismissLabel:t.dismiss});
   const portal=doc.querySelector('[data-sidekick-speech]');
   if(company&&!actualCompanyClear(bot,portal,entry.target,win)){clear();return;}
   seen.add(entry.key);speechNode=portal;if(company)companyDeliveredAt=Date.now();cooldown=Date.now()+7500;
   if(entry.sourceId)emitSourceEvent(entry.sourceId,win);
   // @source-end present
   releaseTimer=later(()=>{if(token===epoch)finishPresentation();},6200);
  }catch(error){if(token===epoch)root.dispatchEvent(new win.CustomEvent('sidekick-demo-scenario-error',{detail:{message:String(error.message)}}));}
  finally{if(token===epoch){busy=false;if(pending){cancelTimer(pendingTimer);pendingTimer=later(()=>{const next=pending;pending=null;if(next)void present(next);},Math.max(0,cooldown-Date.now()));}}}
 }
 function consider(){
  if(!available()||!engaged||modalOpen()||(site==='company'&&companySettling))return;
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
   for(const [i,id] of sections.entries()){
    const target=companyTarget(id);if(visible.has(target)&&inView(target)&&!seen.has(id)){const entry={key:id,sourceId:id,target,text:t.company[i]};if(companyPlan(entry)){void present(entry);break;}}
   }
   // @source-end company-section
  }else if(site==='shop'){
   // @source-start shop-cheaper
   const state=adapter?.getScenarioState?.();if(!state)return;
   for(const target of visible){const match=cheaperMatch(state.products,state.saved,Number(target.dataset.product));if(match&&!seen.has('offer-'+match.item.id)){const entry=currentEntry({key:'offer-'+match.item.id,sourceId:'shop-cheaper',target,text:t.cheaper(match.reference,match.item)});if(entry){void present(entry);break;}}}
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
 function observe(){visible.clear();observer?.disconnect();for(const el of site==='company'?['nova-design','nova-sound','nova-compare','nova-configure'].map(companyTarget).filter(Boolean):root.querySelectorAll('.muse-product'))observer?.observe(el);}
 const mutation=site==='shop'&&win.MutationObserver?new win.MutationObserver(observe):null;
 mutation?.observe(root.querySelector('#muse-product-grid'),{childList:true});observe();
 function queueArrival(){if(site==='community'&&!arrivalTimer&&!seen.has('new-post'))arrivalTimer=later(()=>{arrivalTimer=0;if(available()){adapter?.simulateArrival?.('post');seen.add('new-post');}},1800);}
 function validateCompany(){
  if(!active||!activeCompanyPlan)return;
  const geometry=companyGeometry(active,win),r=geometry.target,p=activeCompanyPlan;
  const left=r.left+p.offset.x,top=r.top+p.offset.y;
  const width=bot.offsetWidth||115,height=bot.offsetHeight||115;
  const host={left,top,width,height,right:left+width,bottom:top+height};
  const speech=p.viewport.width===geometry.viewport.width?p.bubble:measureCompanySpeech(activeEntry.text,doc,geometry.viewport);
  const bubble=speechBox(host,speech,geometry.viewport,p.placement);
  if(!busy&&clearEnvelope(host,bubble,geometry.viewport,geometry.protectedRects)){p.host=host;p.bubble=bubble;p.viewport=geometry.viewport;return;}
  const key=activeEntry?.key;
  // An interrupted glance is not a consumed story. At most one retry follows a
  // real settled-scroll event, never an idle timer loop or every wheel tick.
  if(companyDeliveredAt&&Date.now()-companyDeliveredAt<1500&&!companyRetried.has(key)){seen.delete(key);companyRetried.add(key);}
  clear();
 }
 function companyGeometryChanged(){
  if(!available())return;
  validateCompany();companySettling=true;cancelTimer(companySettleTimer);
  companySettleTimer=later(()=>{companySettling=false;consider();},180);
 }
 listen(win,'scroll',()=>{engaged=true;if(site==='company')companyGeometryChanged();else consider();queueArrival();},{passive:true});
 listen(win,'resize',()=>{if(site==='company')companyGeometryChanged();},{passive:true});
 if(win.visualViewport)for(const event of ['resize','scroll'])listen(win.visualViewport,event,()=>{if(site==='company')companyGeometryChanged();},{passive:true});
 listen(root,'click',()=>{engaged=true;if(site==='shop')later(consider,0);else if(site==='company')later(()=>{validateCompany();consider();},0);});
 // @source-start community-notice
 listen(root,'sidekick-demo-arrival',event=>{if(!available())return;const target=root.querySelector('[data-nav="notifications"]')||root.querySelector('.th-feed-header');void present({key:'arrival-'+event.detail.id,sourceId:event.detail.kind==='mention'?'community-mention-present':'community-post-present',target:inView(target)?target:root.querySelector('.th-feed-header'),text:event.detail.kind==='mention'?t.mention:t.post});});
 // @source-end community-notice
 listen(root,'sidekick-demo-published',()=>{if(mentionTimer||seen.has('mention'))return;mentionTimer=later(()=>{mentionTimer=0;if(available()){adapter?.simulateArrival?.('mention');seen.add('mention');}},1400);});
 listen(doc,'visibilitychange',()=>{if(doc.visibilityState==='hidden'){clear();for(const id of timers)win.clearTimeout(id);timers.clear();arrivalTimer=mentionTimer=0;}else if(available()){consider();if(!active)returnHome(0);}});
 if(initialEngaged)queueArrival();
 returnHome(0);
 return {setPaused(value){paused=value;if(value)clear();else{consider();if(!active)returnHome(0);}},dispose(){if(disposed)return;disposed=true;clear();for(const id of timers)win.clearTimeout(id);timers.clear();observer?.disconnect();mutation?.disconnect();modalObserver?.disconnect();speechObserver?.disconnect();removers.forEach(fn=>fn());}};
}
