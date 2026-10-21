import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {cheaperMatch} from '../playground/demo-scenarios.js';

async function mount(t,locale){
 const dom=new JSDOM('<!doctype html><div id="shop"></div>',{url:'https://sidekick.test/api-demo.html?site=shop',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;
 w.matchMedia=()=>({matches:false});w.HTMLElement.prototype.scrollIntoView=function(){};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 const source=(await readFile(new URL('../playground/demos/shop.js',import.meta.url),'utf8')).replace(/^import\s+['"][^'"]+\.css['"];?\s*$/gm,'').replace(/import\.meta\.env\.BASE_URL/g,"'./'").replace(/export\s+(?=(?:function|const|let|class)\b)/g,'');
 w.eval(source+'\nwindow.renderShopTest=renderShop;');
 const root=w.document.querySelector('#shop'),dispose=w.renderShopTest(root,{locale});
 t.after(()=>{dispose();w.close();});
 return {root,w,adapter:dispose,$:s=>root.querySelector(s)};
}
for(const locale of ['en','ko','ja','zh-CN'])test(`shop first-visit fixture is explicit and scroll-ready (${locale})`,async t=>{
 const f=await mount(t,locale),state=f.adapter.getScenarioState();
 assert.deepEqual(Array.from(state.saved),[12]);
 const reference=f.$('[data-reference-product="12"]');assert.ok(reference);
 assert.match(reference.textContent,/\$18/);
 assert.match(f.$('#muse-companion-instruction').textContent,/Scroll|스크롤|スクロール|滚动/);
 const first=Number(f.$('[data-product]').dataset.product),match=cheaperMatch(state.products,state.saved,first);
 assert.equal(first,0);assert.equal(match.reference.id,12);assert.equal(match.item.price,12);
 assert.equal(match.reference.price-match.item.price,6);
 assert.equal(f.$('[data-product="12"] [data-wish]').getAttribute('aria-pressed'),'true');
 assert.equal(f.$('#muse-wish-count').textContent,'1');
 assert.match(f.$('.muse-companion-caveat').textContent,/not identical|동일한 상품은 아니며|同一商品ではなく|不代表相同商品/);
 assert.equal(f.$('dialog').open,false,'No modal is needed to begin');
 for(const image of reference.querySelectorAll('img'))assert.equal(new URL(image.src).origin,'https://sidekick.test');
});
test('removing the sample stays empty through filter reset; manual selections remain authoritative',async t=>{
 const f=await mount(t,'en');
 f.$('.muse-companion-remove').click();
 assert.deepEqual(Array.from(f.adapter.getScenarioState().saved),[]);
 assert.ok(f.$('.muse-companion-empty'));assert.equal(f.$('[data-reference-product]'),null);
 f.$('[data-category="2"]').click();f.$('[data-reset]').click();
 assert.deepEqual(Array.from(f.adapter.getScenarioState().saved),[],'Reset filters does not repopulate wishlist');
 f.w.dispatchEvent(new f.w.Event('scroll'));
 assert.deepEqual(Array.from(f.adapter.getScenarioState().saved),[],'Scroll never repopulates wishlist');
 f.$('[data-product="1"] [data-wish]').click();
 assert.deepEqual(Array.from(f.adapter.getScenarioState().saved),[1]);
 assert.ok(f.$('[data-reference-product="1"]'));assert.match(f.$('[data-reference-product="1"]').textContent,/\$89/);
 f.$('#muse-saved').click();assert.equal(f.root.querySelectorAll('[data-product]').length,1);
 f.$('.muse-companion-remove').click();assert.ok(f.$('.muse-companion-empty'));
 assert.equal(f.root.querySelectorAll('[data-product]').length,0);
 f.$('[data-reset]').click();assert.deepEqual(Array.from(f.adapter.getScenarioState().saved),[]);
});
test('new isolated shop mount has its own explicit fixture, with no shared wishlist state',async t=>{
 const a=await mount(t,'en');a.$('.muse-companion-remove').click();
 const b=await mount(t,'ko');assert.deepEqual(Array.from(b.adapter.getScenarioState().saved),[12]);
 assert.deepEqual(Array.from(a.adapter.getScenarioState().saved),[]);
});

test('wishlist focus stays in the initiating surface rather than jumping to a duplicate control',async t=>{
 const f=await mount(t,'en');
 const heart=f.$('[data-product="1"] [data-wish]');heart.focus();heart.click();
 assert.equal(f.w.document.activeElement,f.$('[data-product="1"] [data-wish]'),'catalog save stays in catalog');
 f.$('.muse-companion-remove').focus();f.$('.muse-companion-remove').click();
 assert.equal(f.w.document.activeElement,f.$('#muse-companion-instruction'),'reference update keeps focus on its stable instruction');
 f.$('.muse-companion-remove').click();assert.equal(f.w.document.activeElement,f.$('#muse-companion-instruction'));
 assert.deepEqual(Array.from(f.adapter.getScenarioState().saved),[]);
});
