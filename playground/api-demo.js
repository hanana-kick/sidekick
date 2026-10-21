import './api-demo.css';
import { renderCompany } from './demos/company.js';
import { renderShop } from './demos/shop.js';
import { renderCommunity } from './demos/community.js';
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
const notices = {
 en: 'Fictional demo. All interactions stay on this page. No purchases or messages are sent.',
 ko: '가상 데모입니다. 모든 동작은 이 페이지 안에서만 처리되며 구매나 메시지는 전송되지 않습니다.',
 ja: '架空のデモです。すべての操作はこのページ内だけで完結し、購入やメッセージの送信は行いません。',
 'zh-CN': '虚构演示。所有操作仅在此页面内进行，不会购买商品或发送消息。',
};
const brands = { company: 'NOVA', shop: 'MUSE', community: 'THREAD' };
const root = document.getElementById('demo-root');
const lifecycleStyle = document.createElement('style');
lifecycleStyle.textContent = lifecycleCSS;
document.head.append(lifecycleStyle);
document.title = `${brands[site]} · Sidekick`;
const on = (node, event, fn) => node.addEventListener(event, fn, {signal:abort.signal});
root.innerHTML = `<div id="free-space"><div id="demo-content"></div><div id="lifecycle-live"></div><footer class="demo-disclosure"><strong>${brands[site]}</strong><p>${notices[locale]}</p><span>Sidekick · ${new Date().getFullYear()}</span></footer></div>`;
const renderers = { company: renderCompany, shop: renderShop, community: renderCommunity };
const disposeSite = renderers[site](document.getElementById('demo-content'), { locale, on });
let bot, disposeLifecycle;
const dispose=()=>{abort.abort();disposeSite?.();disposeLifecycle?.();disposeLifecycle=null;bot?.remove();};
window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();});
import('../src/index.ts').then(({createAccessory})=>{
 bot=document.createElement('sidekick-avatar');bot.id='bot';bot.setAttribute('size','144');bot.setAttribute('placement','viewport');bot.setAttribute('interaction','none');bot.setAttribute('aria-label','Sidekick');
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
