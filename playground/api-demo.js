import './api-demo.css';
import { lifecycleCSS, installLifecycleExample, lifecycleLabels } from './lifecycle-example.js';
import { applyStudioSession } from './studio-session.ts';
import { executeAction } from './playground-actions.js';

// Only authored, local examples use this runtime. No remote HTML or script is accepted.
let resolveReady, rejectReady;
window.sidekickDemoReady = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
const abort = new AbortController();
const params = new URL(location.href).searchParams;
const locale = ['en', 'ko', 'ja', 'zh-CN'].includes(params.get('lang')) ? params.get('lang') : 'en';
const site = ['company', 'shop', 'community'].includes(params.get('site')) ? params.get('site') : 'company';
document.documentElement.lang = locale;
document.body.className = site;
const translations = {
 en: {
  demo:'Fictional example. All interactions stay in this page.', services:'Services', contact:'Contact', hero:'Make room for better work.', intro:'We help teams design and build thoughtful digital experiences that create clarity, momentum, and more meaningful work.', explore:'Explore services', features:['Plan','Build','Improve'], descriptions:['Find the right opportunity with research, strategy, and clear roadmaps.','Turn ideas into robust, scalable products with a focus on quality.','Iterate with real feedback to make a bigger impact over time.'], talk:'Start a conversation.', talkText:'Share a bit about what you are working on and explore how we could help.', contactButton:'Try a contact request', contactResult:'Demo request previewed. Nothing was sent.',
  shop:'Shop', cart:'Your cart', shopHero:'Objects for everyday rituals.', shopIntro:'Considered essentials for a more intentional day, at home and at work.', products:['Field notebook','Desk tray','Everyday mug'], productDescriptions:['A durable, lay-flat notebook for notes, ideas, and plans.','A simple place for the things you reach for most.','A comfortable mug for slower mornings and brighter afternoons.'], add:'Add to cart', empty:'Your demo cart is empty.', remove:'Remove', total:'Subtotal', cartNote:'This is a demo cart. Checkout and payment are not available.',
  discussions:'Discussions', communityHero:'Good ideas start here.', communityIntro:'A community for people who design, make, and shape a more thoughtful everyday.', categories:['All','Design','Making'], posts:['A calmer workspace','What are you making?','Small rituals, big difference'], summaries:['Simple changes that make a big difference.','Show and tell: what is on your workbench right now?','Everyday habits that help you do your best work.'], bodies:['I have been experimenting with a few small changes to my workspace lately: less on my desk, a plant, and a notebook within reach. What works for you?','This week I am making a little shelf from leftover wood. The first version is not perfect, but it already has a home. What are you working on?','A short walk before starting work helps me notice the day. What small ritual would you like to try?'], reply:'Draft a local reply', preview:'Preview reply', replyEmpty:'Write a reply to preview it here.', replyNote:'Local preview only. No message is sent.'
 },
 ko: {
  demo:'가상 예시입니다. 모든 동작은 이 페이지 안에서만 처리됩니다.',services:'서비스',contact:'문의',hero:'더 나은 일을 위한 여유.',intro:'명확한 방향과 추진력을 만드는 디지털 경험을 함께 설계하고 구현합니다.',explore:'서비스 살펴보기',features:['계획','구현','개선'],descriptions:['조사와 전략, 명확한 계획으로 적절한 기회를 찾습니다.','아이디어를 품질에 집중한 견고한 제품으로 만듭니다.','실제 피드백으로 지속적으로 개선합니다.'],talk:'대화를 시작해 보세요.',talkText:'진행하고 싶은 일을 살펴보고 함께할 방법을 찾아봅니다.',contactButton:'문의 요청 체험',contactResult:'문의 미리보기입니다. 아무것도 전송하지 않았습니다.',
  shop:'상품',cart:'장바구니',shopHero:'일상에 함께하는 물건.',shopIntro:'집과 일터에서 하루를 차분하게 만드는 소품들입니다.',products:['필드 노트','데스크 트레이','데일리 머그'],productDescriptions:['생각과 계획을 편하게 펼쳐 쓰는 튼튼한 노트.','자주 찾는 물건을 두는 간결한 자리.','느긋한 아침과 밝은 오후를 위한 머그.'],add:'장바구니 담기',empty:'데모 장바구니가 비어 있습니다.',remove:'삭제',total:'합계',cartNote:'데모 장바구니입니다. 주문과 결제는 제공하지 않습니다.',
  discussions:'게시글',communityHero:'좋은 생각이 시작되는 곳.',communityIntro:'디자인하고 만들며 더 나은 일상을 나누는 커뮤니티입니다.',categories:['전체','디자인','만들기'],posts:['차분한 작업 공간','무엇을 만들고 있나요?','작은 습관의 변화'],summaries:['작은 변화가 큰 차이를 만듭니다.','지금 작업대 위에 있는 것을 나눠 보세요.','더 나은 하루를 만드는 일상의 습관.'],bodies:['최근 책상 위 물건을 줄이고 식물과 노트를 가까이 두었습니다. 여러분에게 잘 맞는 변화는 무엇인가요?','이번 주에는 남은 나무로 작은 선반을 만들고 있습니다. 완벽하지 않지만 벌써 쓸 곳이 생겼어요. 여러분은 무엇을 만드나요?','일을 시작하기 전 짧게 걷는 시간이 하루를 살펴보게 해 줍니다. 시도해 보고 싶은 작은 습관이 있나요?'],reply:'로컬 답글 작성',preview:'답글 미리보기',replyEmpty:'미리 볼 답글을 작성하세요.',replyNote:'로컬 미리보기입니다. 메시지를 전송하지 않습니다.'
 },
 ja: {
  demo:'架空のサンプルです。操作はこのページ内だけで完結します。',services:'サービス',contact:'お問い合わせ',hero:'より良い仕事のための余白。',intro:'明確な方向性と前進する力を生むデジタル体験を、一緒に設計し形にします。',explore:'サービスを見る',features:['計画','構築','改善'],descriptions:['調査と戦略、明確な計画で機会を見つけます。','アイデアを品質重視の堅牢な製品にします。','実際のフィードバックから改善を重ねます。'],talk:'会話を始めましょう。',talkText:'取り組みたいことと、一緒にできることを考えましょう。',contactButton:'お問い合わせを試す',contactResult:'デモのプレビューです。送信はしていません。',
  shop:'商品',cart:'カート',shopHero:'毎日の時間を彩る道具。',shopIntro:'家でも職場でも、心地よい一日をつくる小さな道具。',products:['フィールドノート','デスクトレー','デイリーマグ'],productDescriptions:['アイデアや計画を書ける丈夫なノート。','よく使うものを置くシンプルな場所。','ゆっくりした朝と明るい午後のためのマグ。'],add:'カートに追加',empty:'デモのカートは空です。',remove:'削除',total:'小計',cartNote:'デモのカートです。注文や決済はできません。',
  discussions:'投稿',communityHero:'良いアイデアはここから。',communityIntro:'デザインし、つくり、より良い日常を分かち合うコミュニティ。',categories:['すべて','デザイン','ものづくり'],posts:['落ち着く作業スペース','何をつくっていますか？','小さな習慣、大きな変化'],summaries:['小さな変化が大きな違いに。','今、作業台にあるものを教えてください。','より良い一日をつくる習慣。'],bodies:['机の上のものを減らし、植物とノートを近くに置いてみました。皆さんに合う工夫は何ですか？','今週は余った木で小さな棚をつくっています。完璧ではありませんが、使う場所は決まりました。','仕事を始める前の短い散歩で一日を感じます。試してみたい小さな習慣はありますか？'],reply:'ローカル返信の下書き',preview:'返信をプレビュー',replyEmpty:'返信を入力してください。',replyNote:'ローカルのプレビューのみ。送信はされません。'
 },
 'zh-CN': {
  demo:'虚构示例。所有操作仅在此页面内进行。',services:'服务',contact:'联系',hero:'为更好的工作留出空间。',intro:'我们帮助团队设计和构建清晰、有推动力的数字体验。',explore:'探索服务',features:['规划','构建','改进'],descriptions:['通过研究、策略和清晰的计划发现机会。','将创意转化为注重质量的可靠产品。','根据真实反馈持续改进。'],talk:'开始对话。',talkText:'聊聊您希望开展的工作，一起探索可能性。',contactButton:'体验联系请求',contactResult:'这是演示预览。没有发送任何内容。',
  shop:'商品',cart:'购物车',shopHero:'日常仪式中的物件。',shopIntro:'为家中和工作中的每一天挑选简单实用的小物。',products:['随行笔记本','桌面托盘','日常马克杯'],productDescriptions:['记录想法和计划的耐用笔记本。','为常用物品提供简洁的收纳空间。','陪伴悠闲早晨与明亮午后的杯子。'],add:'加入购物车',empty:'演示购物车为空。',remove:'移除',total:'小计',cartNote:'这是演示购物车。不提供下单或付款。',
  discussions:'帖子',communityHero:'好想法从这里开始。',communityIntro:'一个分享设计、制作和美好日常的社区。',categories:['全部','设计','制作'],posts:['更平静的工作空间','你正在制作什么？','小习惯，大变化'],summaries:['小小的改变带来不同。','分享你工作台上的项目。','让每一天更好的日常习惯。'],bodies:['最近我减少了桌面的物品，在身边放了一盆植物和一本笔记本。什么改变适合你？','这周我用剩余木料制作一个小架子。虽然不完美，但已经找到了用途。你在做什么？','开始工作前短暂散步让我感受新的一天。你想尝试什么小习惯？'],reply:'撰写本地回复',preview:'预览回复',replyEmpty:'请输入要预览的回复。',replyNote:'仅本地预览。不会发送消息。'
 }
};
const t = translations[locale];
const root = document.getElementById('demo-root');
const lifecycleStyle = document.createElement('style');
lifecycleStyle.textContent = lifecycleCSS;
document.head.append(lifecycleStyle);
const brand = {company:'Northstar Studio',shop:'Everyday Supply',community:'Common Ground'}[site];
document.title = `${brand} · Sidekick`;
const on = (node, event, fn) => node.addEventListener(event, fn, {signal:abort.signal});
const footer = `<footer class="site-footer"><div class="wrap"><strong>${brand}</strong><span>${t.demo}</span></div></footer>`;
function shell(nav, content) {
 root.innerHTML = `<div id="free-space"><header class="site-header"><div class="wrap"><a class="brand" href="#top">${brand}</a><nav>${nav}</nav></div></header><main id="top">${content}</main><div id="lifecycle-live"></div>${footer}</div>`;
}
if (site === 'company') {
 shell(`<a href="#features">${t.services}</a><a href="#contact">${t.contact}</a>`,
  `<section class="hero wrap"><h1>${t.hero}</h1><p>${t.intro}</p><a id="preview-target" class="button primary" href="#features">${t.explore}</a></section><section class="wrap" id="features"><div class="features">${t.features.map((name,i)=>`<article><h2>${name}</h2><p>${t.descriptions[i]}</p></article>`).join('')}</div></section><section class="contact" id="contact"><div class="wrap"><h2>${t.talk}</h2><p>${t.talkText}</p><button class="primary" id="contact-demo">${t.contactButton}</button><p role="status" class="demo-feedback" id="contact-result"></p></div></section>`);
 on(document.getElementById('contact-demo'),'click',()=>{document.getElementById('contact-result').textContent=t.contactResult;});
} else if (site === 'shop') {
 const prices = [12,28,18], quantities = [0,0,0];
 shell(`<a href="#products">${t.shop}</a><a href="#cart">${t.cart}</a>`,
  `<section class="hero wrap"><h1>${t.shopHero}</h1><p>${t.shopIntro}</p></section><div class="shop-layout wrap"><section id="products">${t.products.map((name,i)=>`<article class="product"><div class="swatch" aria-hidden="true" style="--swatch:${['#d6cdbf','#c98f80','#92967b'][i]}"></div><div><h2>${name}</h2><p>${t.productDescriptions[i]}</p><div class="product-bottom"><strong>$${prices[i]}</strong><button ${i===0?'id="preview-target"':''} class="primary" data-add="${i}">${t.add}</button></div></div></article>`).join('')}</section><aside class="cart" id="cart" aria-label="${t.cart}"><h2>${t.cart}</h2><ul id="cart-items"></ul><p id="cart-empty">${t.empty}</p><p class="cart-total"><span>${t.total}</span><strong id="cart-total">$0</strong></p><p class="notice">${t.cartNote}</p><p role="status" id="cart-status" class="demo-feedback"></p></aside></div>`);
 const render = () => {
  const items = document.getElementById('cart-items'); items.replaceChildren();
  quantities.forEach((qty,i)=>{if(!qty)return;const li=document.createElement('li'),label=document.createElement('span'),remove=document.createElement('button');label.textContent=`${t.products[i]} × ${qty}`;remove.textContent='−';remove.setAttribute('aria-label',`${t.remove}: ${t.products[i]}`);remove.dataset.remove=String(i);li.append(label,remove);items.append(li);});
  document.getElementById('cart-empty').hidden=quantities.some(Boolean);
  document.getElementById('cart-total').textContent=`$${quantities.reduce((sum,qty,i)=>sum+qty*prices[i],0)}`;
 };
 on(document.getElementById('cart-items'),'click',event=>{const button=event.target.closest('[data-remove]');if(!button)return;const index=Number(button.dataset.remove);if(quantities[index]>0)quantities[index]--;render();});
 root.querySelectorAll('[data-add]').forEach(button=>on(button,'click',()=>{quantities[Number(button.dataset.add)]++;render();document.getElementById('cart-status').textContent=`${t.cart}: ${quantities.reduce((a,b)=>a+b,0)}`;}));
} else {
 let selected=0;
 shell(`<a href="#discussions">${t.discussions}</a>`,
  `<section class="hero wrap"><h1>${t.communityHero}</h1><p>${t.communityIntro}</p></section><section class="wrap" id="discussions"><div class="filters">${t.categories.map((label,i)=>`<button data-category="${i}" aria-pressed="${i===0}">${label}</button>`).join('')}</div><div class="community-layout"><div class="post-list">${t.posts.map((title,i)=>`<button class="post" data-post="${i}" ${i===0?'id="preview-target"':''} aria-pressed="${i===0}"><strong>${title}</strong><span>${t.summaries[i]}</span><small>${t.categories[i===1?2:1]} · ${['Alex','Sam','Robin'][i]}</small></button>`).join('')}</div><article class="post-detail"><h2 id="post-title"></h2><p id="post-body"></p><label for="reply-draft">${t.reply}</label><textarea id="reply-draft" maxlength="1000"></textarea><button id="reply-preview-button">${t.preview}</button><p class="notice">${t.replyNote}</p><p class="reply-preview" id="reply-preview" role="status" hidden></p></article></div></section>`);
 const select = index => {selected=index;document.getElementById('post-title').textContent=t.posts[index];document.getElementById('post-body').textContent=t.bodies[index];root.querySelectorAll('[data-post]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.post)===index)));document.getElementById('reply-draft').value='';document.getElementById('reply-preview').hidden=true;};
 root.querySelectorAll('[data-post]').forEach(button=>on(button,'click',()=>select(Number(button.dataset.post))));
 root.querySelectorAll('[data-category]').forEach(button=>on(button,'click',()=>{const category=Number(button.dataset.category);root.querySelectorAll('[data-category]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));root.querySelectorAll('[data-post]').forEach(item=>{const index=Number(item.dataset.post);item.hidden=category!==0&&(index===1?2:1)!==category;});if(category&&((selected===1?2:1)!==category))select(category===2?1:0);}));
 on(document.getElementById('reply-preview-button'),'click',()=>{const preview=document.getElementById('reply-preview');preview.textContent=document.getElementById('reply-draft').value.trim()||t.replyEmpty;preview.hidden=false;});
 select(0);
}
let bot, disposeLifecycle;
const dispose=()=>{abort.abort();disposeLifecycle?.();disposeLifecycle=null;bot?.remove();};
window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();});
import('../src/index.ts').then(({createAccessory})=>{
 bot=document.createElement('sidekick-avatar');bot.id='bot';bot.setAttribute('placement','viewport');bot.setAttribute('interaction','none');bot.setAttribute('aria-label','Sidekick');bot.paused=true;
 // API validation intentionally requires this realm's plain objects. Clone only
 // serializable scene/actions here; live promises for lifecycle tasks stay here.
 resolveReady({
  bot,document,window,dispose,
  applySession:scene=>applyStudioSession(bot,structuredClone(scene)),
  execute:action=>executeAction(bot,structuredClone(action),createAccessory),
  moveTo:(point,options)=>bot.moveTo(structuredClone(point),structuredClone(options)),
  installLifecycle:language=>{
   disposeLifecycle?.();
   disposeLifecycle=installLifecycleExample(bot,document.getElementById('lifecycle-live'),lifecycleLabels[language]??lifecycleLabels.en);
   return ()=>{disposeLifecycle?.();disposeLifecycle=null;};
  },
 });
}).catch(rejectReady);
