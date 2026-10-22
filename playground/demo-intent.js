// Site-owned context remains readable without chasing a moving avatar.
export const intentCopy={
 en:{read:'New-post and mention alerts link to their demo conversations.',label:'Sidekick guide',company:['A closer look at the aluminum earcup and soft cushions.','Choose a listening mode to see what changes. No audio is played.','Compare battery, weight and price before choosing a model.','Try a finish, then save your choice for this visit. No order is placed.'],shop:(a,b)=>`$${a.price-b.price} less · $${a.price} → $${b.price}. Saved: ${a.name}. This style: ${b.name}. Same category; check the fit.`,community:'Browse the feed for a sample new-post alert. Publish a local post to receive a sample mention.',post:'A demo post arrived. Open Notifications to read the update.',mention:'Daniel Park mentioned @alexmorgan in this demo. Open Notifications to read it.',moving:'Found something for you',result:'Worth a look'},
 ko:{read:'새 글·멘션 알림을 선택하면 해당 데모 글이 열려요.',label:'Sidekick 안내',company:['알루미늄 이어컵과 부드러운 쿠션을 가까이 살펴보세요.','청취 모드를 선택해 차이를 비교해 보세요. 실제 소리는 재생되지 않아요.','배터리·무게·가격을 비교하고 나에게 맞는 모델을 골라보세요.','색상을 바꾸고 이번 방문에만 선택을 저장해 보세요. 주문은 생기지 않아요.'],shop:(a,b)=>`$${a.price-b.price} 저렴해요 · $${a.price} → $${b.price}. 관심: ${a.name} / 추천: ${b.name}. 같은 카테고리지만 핏도 확인하세요.`,community:'피드를 둘러보면 새 글 알림 예시가 와요. 직접 글을 쓰면 멘션 예시도 받을 수 있어요.',post:'데모 새 글이 도착했어요. 알림을 열어 내용을 확인해 보세요.',mention:'데모에서 Daniel Park가 @alexmorgan을 멘션했어요. 알림에서 읽어보세요.',moving:'여기를 짚어드릴게요',result:'확인해 보세요'},
 ja:{read:'新着やメンションの通知から対応するデモ投稿を開けます。',label:'Sidekickガイド',company:['アルミ製イヤーカップと柔らかなクッションを見てみましょう。','聴き方を選んで違いを比較。音声は再生されません。','電池・重さ・価格を比べてモデルを選びましょう。','色を試して今回の訪問中だけ保存できます。注文は作成されません。'],shop:(a,b)=>`$${a.price-b.price}お得 · $${a.price} → $${b.price}。保存：${a.name}／こちら：${b.name}。同じカテゴリーですがフィットも確認しましょう。`,community:'フィードを見ると新着通知の例が届きます。ローカル投稿をするとメンションの例も届きます。',post:'デモの新着投稿が届きました。通知を開いて確認しましょう。',mention:'デモでDaniel Parkが@alexmorganにメンションしました。通知から読めます。',moving:'ここをご案内します',result:'チェックしてみましょう'},
 'zh-CN':{read:'新帖和提及通知可打开对应的演示帖子。',label:'Sidekick导览',company:['近距离看看铝制耳罩和柔软耳垫。','选择聆听模式，比较差异。不会播放声音。','比较电池、重量和价格，再选择合适的型号。','试选颜色并仅在本次访问中保存，不会创建订单。'],shop:(a,b)=>`便宜$${a.price-b.price} · $${a.price} → $${b.price}。收藏：${a.name}／这款：${b.name}。同一类别，也请确认版型。`,community:'浏览动态会收到新帖示例通知。在本地发帖后，还会收到提及示例。',post:'演示新帖已到达。打开通知查看内容。',mention:'演示中Daniel Park提到了@alexmorgan。请在通知中阅读。',moving:'为你指出这里',result:'值得看看'}
};
export function installIntentCues({root,site,locale}){
 const t=intentCopy[locale]||intentCopy.en,doc=root.ownerDocument,owned=new Set(),replaced=new Map(),emptyCopy=new Map();let active=null;
 function create(host,text='',before=null){
  if(!host)return null;const node=doc.createElement('p');node.className='demo-intent';node.dataset.demoIntent='';
  const label=doc.createElement('strong'),body=doc.createElement('span');label.textContent=t.label;body.textContent=text;node.append(label,body);host.insertBefore(node,before);owned.add(node);return node;
 }
 const company=new Map();
 if(site==='company')for(const [i,id] of ['nova-design','nova-sound','nova-compare','nova-configure'].entries()){
  const section=root.querySelector('#'+id);const host=section?.querySelector({'nova-design':':scope > div','nova-sound':'.nova-sound-controls','nova-compare':'.nova-heading','nova-configure':'.nova-config-info'}[id]);
  if(host){
   // Use the authored lead paragraph rather than stacking a second tall block
   // before the controls. The original node is restored when this demo stops.
   const lead=host.querySelector(':scope > p'),node=create(host,t.company[i],lead||null);
   if(lead){replaced.set(node,lead);lead.remove();}company.set(id,node);
  }
 }
 const community=site==='community'?create(root.querySelector('.th-main'),t.community,root.querySelector('.th-tabs')?.nextSibling):null;
 function shopSlots(){if(site!=='shop')return;for(const node of owned)if(!node.isConnected)owned.delete(node);for(const card of root.querySelectorAll('.muse-product')){
  const host=card.querySelector('.muse-product-info');if(host&&!host.querySelector('[data-demo-intent]')){const node=create(host,'',host.querySelector('.muse-price')?.nextSibling||null);node.hidden=true;}
 }}
 shopSlots();
 function updateShop(resolve){for(const card of root.querySelectorAll('.muse-product')){const node=card.querySelector('[data-demo-intent]');if(!node)continue;const text=resolve(card)||'';if(active?.target===card){active.previous=text;if(!text)reset();}if(node.querySelector('span').textContent!==text){node.querySelector('span').textContent=text;node.querySelector('strong').textContent=t.label;delete node.dataset.phase;}node.hidden=!text;}}
 function reset(){if(active){active.target.removeAttribute('data-demo-target');if(active.node?.dataset.phase==='moving'){active.node.querySelector('strong').textContent=t.label;active.node.querySelector('span').textContent=active.previous;active.node.hidden=!active.previous;delete active.node.dataset.phase;}active=null;}if(community&&root.querySelector('[data-nav="notifications"].active'))refreshCommunity();}
 function refreshCommunity(){if(community){
  const notifications=root.querySelector('[data-nav="notifications"].active'),empty=root.querySelector('.th-empty');
  community.querySelector('span').textContent=notifications?t.read:(active?.intent||t.community);
  // Empty views already have a reading area. Reuse it instead of stacking a
  // second explainer above the short viewport and pushing text into navigation.
  community.hidden=!!empty;
  for(const node of emptyCopy.keys())if(!node.isConnected)emptyCopy.delete(node);
  const paragraph=notifications&&empty?.querySelector('p');
  if(paragraph){if(!emptyCopy.has(paragraph))emptyCopy.set(paragraph,paragraph.textContent);paragraph.textContent=t.read;}
 }}
 function begin(entry){reset();const node=site==='company'?company.get(entry.key):site==='shop'?entry.target.querySelector('[data-demo-intent]'):community;
  active={target:entry.target,node,intent:entry.intent,previous:node?.querySelector('span').textContent||''};entry.target.dataset.demoTarget='moving';
  if(node){node.hidden=false;node.dataset.phase='moving';node.querySelector('strong').textContent=t.label;node.querySelector('span').textContent=entry.intent||node.querySelector('span').textContent;refreshCommunity();}
 }
 function complete(entry){if(active?.target!==entry.target)return;entry.target.dataset.demoTarget='result';const node=active.node;if(node){node.dataset.phase='result';node.querySelector('strong').textContent=t.label;node.querySelector('span').textContent=entry.intent||node.querySelector('span').textContent;refreshCommunity();}}
 return {copy:t,shopSlots,updateShop,refreshCommunity,begin,complete,reset,dispose(){reset();for(const node of owned){const previous=replaced.get(node);if(previous&&node.isConnected)node.replaceWith(previous);else node.remove();}replaced.clear();for(const [node,text] of emptyCopy)if(node.isConnected&&node.textContent===t.read)node.textContent=text;emptyCopy.clear();}};
}
