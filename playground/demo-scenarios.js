// Site-owned examples use only local fixture data. No network notifications,
// recommendation service, tracking, or perpetual animation loop is involved.
export const scenarioCopy = {
 en:{hint:['Scroll through the product stories. Your companion will point out the details.','Save a style with ♡, then browse. Your companion spots cheaper items in the same category.','Browse the feed or publish locally. New posts and mentions are simulated only here.'],company:['Notice the materials and controls in this close-up.','Try the listening modes here to compare the experience.','Compare the models here before choosing your configuration.','Choose a finish here. Your selection stays in this demo.'],cheaper:(a,b)=>`This is cheaper! ${b.name} is $${b.price}, $${a.price-b.price} less than your saved ${a.name}. Same category; fit and details may differ.`,post:'Local demo: a new post just arrived in your feed.',mention:'Local demo: Daniel Park mentioned @alexmorgan in a new post.',localPost:'Local demo update: a small walk, a new idea. What did you notice today?',localMention:'Local demo mention: @alexmorgan, thanks for sharing your perspective!'},
 ko:{hint:['제품 이야기를 스크롤해 보세요. 봇이 각 요소의 특징을 짚어줍니다.','♡로 관심 상품을 담고 둘러보세요. 같은 카테고리의 더 저렴한 상품을 봇이 알려줍니다.','피드를 둘러보거나 글을 써보세요. 새 글과 멘션은 이 페이지에서만 가상으로 발생합니다.'],company:['확대된 이미지에서 소재와 조작부를 살펴보세요.','여기서 청취 모드를 바꿔 경험을 비교해 보세요.','모델별 사양을 비교한 뒤 나에게 맞는 구성을 골라보세요.','여기서 색상을 선택할 수 있어요. 선택은 이 데모에만 남습니다.'],cheaper:(a,b)=>`이게 더 싼 거예요! ${b.name}은 $${b.price}, 관심 상품 ${a.name}보다 $${a.price-b.price} 저렴해요. 같은 카테고리이며 핏과 세부 사양은 다를 수 있어요.`,post:'로컬 데모: 피드에 새로운 글이 도착했어요.',mention:'로컬 데모: Daniel Park가 새 글에서 @alexmorgan을 멘션했어요.',localPost:'로컬 데모 새 글: 짧은 산책에서 새로운 아이디어를 발견했어요. 오늘 무엇을 발견했나요?',localMention:'로컬 데모 멘션: @alexmorgan, 생각을 나눠주셔서 고마워요!'},
 ja:{hint:['製品ストーリーをスクロールすると、ボットが特徴を案内します。','♡で気になる商品を保存して見て回ると、同じカテゴリーの安い商品を案内します。','フィードを閲覧したり投稿してみましょう。新着やメンションはこのページだけのシミュレーションです。'],company:['拡大画像で素材と操作部を見てみましょう。','ここでリスニングモードを切り替えて比較できます。','モデルの仕様を比較して、自分に合う構成を選びましょう。','ここで色を選べます。選択はこのデモ内だけに保存されます。'],cheaper:(a,b)=>`こちらの方が安いです！${b.name}は$${b.price}で、保存した${a.name}より$${a.price-b.price}安いです。同じカテゴリーですが、仕様やフィットは異なる場合があります。`,post:'ローカルデモ：フィードに新しい投稿が届きました。',mention:'ローカルデモ：Daniel Parkが新しい投稿で@alexmorganにメンションしました。',localPost:'ローカルデモの新着：短い散歩で新しいアイデアを見つけました。今日は何を発見しましたか？',localMention:'ローカルデモのメンション：@alexmorgan、考えを共有してくれてありがとう！'},
 'zh-CN':{hint:['滚动浏览产品故事，机器人会介绍各处细节。','用♡收藏款式后继续浏览，机器人会发现同类别中更便宜的商品。','浏览动态或在本地发帖。新帖和提及只在此页面模拟。'],company:['在特写图中看看材料和控制细节。','在这里切换聆听模式，比较不同体验。','先比较各型号参数，再选择适合你的配置。','在这里选择颜色，选择仅保留在此演示中。'],cheaper:(a,b)=>`这个更便宜！${b.name}为$${b.price}，比收藏的${a.name}便宜$${a.price-b.price}。属于同一类别，但版型和细节可能不同。`,post:'本地演示：动态中收到了一篇新帖子。',mention:'本地演示：Daniel Park在新帖子中提到了@alexmorgan。',localPost:'本地演示新帖：短暂散步带来了新想法。你今天发现了什么？',localMention:'本地演示提及：@alexmorgan，谢谢你分享想法！'}
};
export function cheaperMatch(products, saved, candidateId){
 const item=products.find(p=>p.id===candidateId);if(!item||saved.includes(item.id))return null;
 const reference=products.filter(p=>saved.includes(p.id)&&(p.comparisonGroup??p.cat)===(item.comparisonGroup??item.cat)&&p.price>item.price).sort((a,b)=>a.price-b.price)[0];
 return reference?{reference,item}:null;
}
export function installDemoScenarios({bot,root,site,locale='en',adapter,window:win=root.ownerDocument.defaultView}){
 const doc=root.ownerDocument,t=scenarioCopy[locale]||scenarioCopy.en,seen=new Set(),visible=new Set();
 let disposed=false,paused=false,engaged=false,busy=false,epoch=0,active=null,pending=null,cooldown=0,arrivalTimer=0,mentionTimer=0,releaseTimer=0,pendingTimer=0;
 const removers=[],timers=new Set();
 const later=(fn,ms)=>{const id=win.setTimeout(()=>{timers.delete(id);fn();},ms);timers.add(id);return id;};
 const cancelTimer=id=>{win.clearTimeout(id);timers.delete(id);};
 const listen=(target,event,fn,options)=>{target.addEventListener(event,fn,options);removers.push(()=>target.removeEventListener(event,fn,options));};
 const available=()=>!disposed&&!paused&&doc.visibilityState!=='hidden'&&bot.isConnected;
 const inView=el=>{if(!el?.isConnected)return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>32&&r.top<win.innerHeight-24;};
 const clear=()=>{const wasActive=busy||active;epoch++;busy=false;pending=null;active=null;bot.clearSpeech?.();if(wasActive){bot.cancelMove();bot.detachAnchor();}cancelTimer(releaseTimer);cancelTimer(pendingTimer);};
 async function present(entry){
  if(!available()||seen.has(entry.key)||!inView(entry.target))return;
  if(busy){pending=entry;return;}
  if(Date.now()<cooldown){pending=entry;cancelTimer(pendingTimer);pendingTimer=later(()=>{const next=pending;pending=null;if(next)void present(next);},cooldown-Date.now());return;}
  busy=true;active=entry.target;const token=++epoch;
  try{
   await bot.moveToElement(entry.target,{alignX:'right',alignY:'top',x:-8,y:8,anchor:true,duration:win.matchMedia('(prefers-reduced-motion: reduce)').matches?0:550,travel:'none'});
   if(token!==epoch)return;
   if(!available()||!inView(entry.target)){clear();consider();return;}
   bot.say(entry.text,{duration:6000});seen.add(entry.key);cooldown=Date.now()+7500;
   releaseTimer=later(()=>{if(token===epoch){bot.clearSpeech();bot.detachAnchor();active=null;}},6200);
  }catch(error){if(token===epoch)root.dispatchEvent(new win.CustomEvent('sidekick-demo-scenario-error',{detail:{message:String(error.message)}}));}
  finally{if(token===epoch){busy=false;if(pending){cancelTimer(pendingTimer);pendingTimer=later(()=>{const next=pending;pending=null;if(next)void present(next);},Math.max(0,cooldown-Date.now()));}}}
 }
 function consider(){
  if(!available()||!engaged)return;
  if(active&&!inView(active))clear();
  if(site==='company'){
   for(const [i,id] of ['nova-design','nova-sound','nova-compare','nova-configure'].entries()){
    const target=root.querySelector('#'+id);if(visible.has(target)&&!seen.has(id)){void present({key:id,target,text:t.company[i]});break;}
   }
  }else if(site==='shop'){
   const state=adapter?.getScenarioState?.();if(!state)return;
   for(const target of visible){const match=cheaperMatch(state.products,state.saved,Number(target.dataset.product));if(match&&!seen.has('offer-'+match.item.id)){void present({key:'offer-'+match.item.id,target,text:t.cheaper(match.reference,match.item)});break;}}
  }
 }
 const observer=win.IntersectionObserver?new win.IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting&&e.intersectionRatio>=.25)visible.add(e.target);else visible.delete(e.target);}consider();},{threshold:[0,.25,.6]}):null;
 function observe(){visible.clear();observer?.disconnect();for(const el of root.querySelectorAll(site==='company'?'#nova-design,#nova-sound,#nova-compare,#nova-configure':'.muse-product'))observer?.observe(el);}
 const mutation=site==='shop'&&win.MutationObserver?new win.MutationObserver(observe):null;
 mutation?.observe(root.querySelector('#muse-product-grid'),{childList:true});observe();
 listen(win,'scroll',()=>{engaged=true;consider();if(site==='community'&&!arrivalTimer&&!seen.has('new-post'))arrivalTimer=later(()=>{arrivalTimer=0;if(available()){adapter?.simulateArrival?.('post');seen.add('new-post');}},1800);},{passive:true});
 listen(root,'click',()=>{engaged=true;if(site==='shop')later(consider,0);});
 listen(root,'sidekick-demo-arrival',event=>{if(!available())return;const target=root.querySelector('[data-nav="notifications"]')||root.querySelector('.th-feed-header');void present({key:'arrival-'+event.detail.id,target:inView(target)?target:root.querySelector('.th-feed-header'),text:event.detail.kind==='mention'?t.mention:t.post});});
 listen(root,'sidekick-demo-published',()=>{if(mentionTimer||seen.has('mention'))return;mentionTimer=later(()=>{mentionTimer=0;if(available()){adapter?.simulateArrival?.('mention');seen.add('mention');}},1400);});
 listen(doc,'visibilitychange',()=>{if(doc.visibilityState==='hidden'){clear();for(const id of timers)win.clearTimeout(id);timers.clear();arrivalTimer=mentionTimer=0;}});
 return {setPaused(value){paused=value;if(value)clear();else consider();},dispose(){if(disposed)return;disposed=true;clear();for(const id of timers)win.clearTimeout(id);timers.clear();observer?.disconnect();mutation?.disconnect();removers.forEach(fn=>fn());}};
}
