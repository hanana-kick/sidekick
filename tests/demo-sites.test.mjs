import { emitSourceEvent } from '../playground/example-source-event.js';
import { installIntentCues } from '../playground/demo-intent.js';
import { scenarioCopy, cheaperMatch } from '../playground/demo-scenarios.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const siteExports = { company: 'renderCompany', shop: 'renderShop', community: 'renderCommunity' };
async function mount(t, site, locale = 'en') {
  const dom = new JSDOM('<!doctype html><body><div id="demo-content"></div></body>', {
    url: `https://sidekick.test/api-demo.html?site=${site}&lang=${locale}&sourceGeneration=1`, runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const w = dom.window;
  w.emitSourceEvent = emitSourceEvent;
  w.sourceEvents = [];
  Object.defineProperty(w, 'parent', {value:{postMessage:data=>w.sourceEvents.push(data)}});
  w.document.body.className = site;
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.scrollTo = () => {};
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new w.Event('close')); };
  const source = (await readFile(new URL(`../playground/demos/${site}.js`, import.meta.url), 'utf8'))
    .replace(/^import \{ emitSourceEvent \} from [^;]+;$/gm, '')
    .replace(/^import\s+['"][^'"]+\.css['"];?\s*$/gm, '')
    .replace(/^import \{ scenarioCopy \} from ['"][^'"]+['"];?$/gm, `const scenarioCopy = ${JSON.stringify(scenarioCopy)};`)
    .replace(/import\.meta\.env\.BASE_URL/g, "'./'")
    .replace(/import\.meta\.url/g, "'https://sidekick.test/playground/demos/module.js'")
    .replace(/export\s+(?=(?:function|const|let|class)\b)/g, '');
  w.eval(`${source}\nwindow.renderTestSite = ${siteExports[site]};`);
  const abort = new w.AbortController();
  const on = (node, event, fn) => node.addEventListener(event, fn, { signal: abort.signal });
  const root = w.document.getElementById('demo-content');
  const dispose = w.renderTestSite(root, { locale, on });
  t.after(() => { abort.abort(); dispose?.(); dom.window.close(); });
  return { w, root, adapter:dispose, $: selector => root.querySelector(selector), $$: selector => [...root.querySelectorAll(selector)] };
}

for (const site of Object.keys(siteExports)) {
  test(`${site} renders substantial localized content and stable integration targets in all four locales`, async t => {
    const headings = [];
    for (const locale of ['en', 'ko', 'ja', 'zh-CN']) {
      const f = await mount(t, site, locale);
      assert.equal(f.$$('h1').length, 1, `${site}/${locale} has one primary heading`);
      headings.push(f.$('h1').textContent.trim());
      assert.ok(f.$('#preview-target'), `${site}/${locale} has an anchor target`);
      assert.ok(f.$$('button, a, input').length >= 15, `${site}/${locale} has complete controls`);
      assert.ok(f.root.textContent.length > (locale === 'en' ? 1800 : 900), `${site}/${locale} has substantive content`);
      assert.ok(f.$$('img').length >= 3, `${site}/${locale} includes imagery`);
      for (const image of f.$$('img')) {
        assert.notEqual(image.getAttribute('alt'), null, 'Every image has alt semantics');
        assert.equal(new URL(image.src).origin, 'https://sidekick.test', 'No runtime third-party image request');
        const pathname = new URL(image.src).pathname;
        const asset = pathname.includes('/demo-assets/') ? pathname.slice(pathname.indexOf('/demo-assets/')) : null;
        if (asset) assert.ok((await stat(new URL(`../public${asset}`, import.meta.url))).isFile(), `Asset exists: ${asset}`);
      }
    }
    assert.equal(new Set(headings).size, 4, `${site} primary heading is translated, not silently English`);
  });
}

export { mount };

for (const locale of ['en', 'ko', 'ja', 'zh-CN']) {
  test(`NOVA product configuration, accessible sound tabs, comparison and contact stay local (${locale})`, async t => {
    const f = await mount(t, 'company', locale);
    const original = f.$('#nova-finish-image').src;
    f.$('[data-finish="1"]').click();
    assert.notEqual(f.$('#nova-finish-image').src, original);
    assert.equal(f.$('[data-finish="1"]').getAttribute('aria-pressed'), 'true');
    f.$('#nova-save-config').click();
    assert.ok(f.$('#nova-config-result').textContent.length > 10);
    const firstMode = f.$('#nova-mode-panel').textContent;
    f.$('[data-sound-mode="1"]').click();
    assert.notEqual(f.$('#nova-mode-panel').textContent, firstMode);
    f.$('[data-sound-mode="1"]').dispatchEvent(new f.w.KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    assert.equal(f.$('[data-sound-mode="2"]').getAttribute('aria-selected'), 'true');
    assert.equal(f.w.document.activeElement, f.$('[data-sound-mode="2"]'));
    f.$('[data-model="1"]').click();
    assert.match(f.$('#nova-model-result').textContent, /NOVA Buds/);
    f.$('#contact-demo').click();
    assert.ok(f.$('#contact-result').textContent.trim());
    assert.equal(f.$$('details').length, 4);
  });

  test(`MUSE catalog, favorites, search, product options and cart work repeatedly (${locale})`, async t => {
    const f = await mount(t, 'shop', locale);
    assert.equal(f.$$('[data-product]').length, 24);
    const anchor = f.$('#preview-target');
    f.$('[data-add="0"]').click();
    assert.equal(f.$$('#cart-items li').length, 1);
    assert.equal(f.$('#cart-total').textContent, '$12');
    f.$('[data-increment]').click();
    assert.equal(f.$('#cart-total').textContent, '$24');
    f.$('[data-decrement]').click();
    assert.equal(f.$('#cart-total').textContent, '$12');
    f.$('[data-remove]').click();
    assert.equal(f.$$('#cart-items li').length, 0);
    f.$('[data-wish="1"]').click();
    f.$('#muse-saved').click();
    assert.equal(f.$$('[data-product]').length, 2, 'manual saved style plus the labeled demo reference');
    assert.equal(f.$('#preview-target'), anchor, 'Filtering must not replace the bot anchor');
    f.$('#muse-all').click();
    const input = f.$('#muse-search'); input.value = 'no-such-product-test';
    input.dispatchEvent(new f.w.Event('input', { bubbles: true }));
    assert.equal(f.$$('[data-product]').length, 0);
    assert.equal(f.$('.muse-no-results').hidden, false);
    f.$('[data-reset]').click();
    assert.equal(f.$$('[data-product]').length, 24);
    f.$('#muse-sort').value = '1'; f.$('#muse-sort').dispatchEvent(new f.w.Event('change', { bubbles: true }));
    const prices = f.$$('.muse-product .muse-price strong').map(n => Number(n.textContent.replace('$', '')));
    assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
    f.$('[data-detail="0"]').click();
    assert.equal(f.$('#muse-dialog').open, true);
    f.$('[data-size="L"]').click(); f.$('[data-color="1"]').click();
    const description = f.$('#muse-detail-panel').textContent;
    f.$('[data-detail-tab="2"]').click();
    assert.notEqual(f.$('#muse-detail-panel').textContent, description);
    f.$('[data-detail-add]').click();
    assert.equal(f.$('#muse-dialog').open, false);
    assert.match(f.$('#cart-items').textContent, /L/);
    f.$('[data-decrement]').click();
    assert.equal(f.$$('#cart-items li').length, 0);
  });

  test(`THREAD feed, details, safe composition, engagement, polls and profiles stay local (${locale})`, async t => {
    const f = await mount(t, 'community', locale);
    assert.equal(f.$$('.th-post').length, 20);
    for (const control of f.$$('.th-nav [data-nav], .th-compose-link, .th-my-profile')) assert.ok(control.getAttribute('aria-label'), 'Collapsed icon navigation retains an accessible name');
    f.$('[data-post="0"]').click();
    assert.equal(f.$('#th-detail').open, true);
    const first = f.$('#post-body').textContent;
    f.$('#reply-draft').value = '<img src=x onerror=alert(1)> Local reply';
    f.$('#reply-preview-button').click();
    assert.match(f.$('#reply-preview').textContent, /<img src=x/);
    assert.equal(f.$$('#reply-preview img').length, 0);
    const seededReplies = f.$$('#th-detail-replies article').length;
    assert.equal(seededReplies, 3);
    f.$('#th-add-reply').click();
    assert.equal(f.$$('#th-detail-replies article').length, 4);
    assert.match(f.$('#th-detail-replies').textContent, /<img src=x/);
    assert.equal(f.$$('#th-detail-replies img').length, 0);
    f.$('#th-detail [data-close]').click();
    f.$('[data-open-post="3"]').click();
    assert.equal(f.$('#th-detail').open, true);
    assert.notEqual(f.$('#post-body').textContent, first);
    f.$('#th-detail [data-close]').click();
    f.$('[data-action="liked"][data-id="0"]').click();
    assert.equal(f.$('[data-action="liked"][data-id="0"]').getAttribute('aria-pressed'), 'true');
    f.$('[data-action="saved"][data-id="0"]').click();
    f.$('[data-nav="saved"]').click();
    assert.equal(f.$$('.th-post').length, 1);
    f.$('[data-nav="home"]').click();
    const text = f.$('#th-compose-text'); text.value = '<svg onload=alert(1)> A new local post';
    text.dispatchEvent(new f.w.Event('input', { bubbles: true }));
    assert.equal(f.$('#th-publish').disabled, false);
    assert.equal(f.$('#th-publish').type, 'button', 'Local composer must work without sandbox allow-forms');
    f.$('#th-publish').click();
    assert.equal(f.$$('.th-post').length, 21);
    assert.match(f.$('.th-post-body').textContent, /<svg onload/);
    assert.equal(f.$$('.th-post-body svg').length, 0);
    const poll = f.$('[data-vote]'); poll.click();
    assert.equal(f.$('[data-vote]').disabled, true);
    assert.match(f.$('.th-poll').textContent, /%/);
    const follow = f.$('[data-follow]'), id = follow.dataset.follow;
    follow.click();
    assert.equal(f.$(`[data-follow="${id}"]`).getAttribute('aria-pressed'), 'true');
    f.$('[data-profile="-1"]').click(); f.$('[data-edit]').click();
    f.$('#th-profile-form [name="name"]').value = 'Local Tester';
    assert.equal(f.$('#th-profile-save').type, 'button');
    f.$('#th-profile-save').click();
    assert.equal(f.$('.th-self-name').textContent, 'Local Tester');
  });
}

 test('real shop wishlist state is exposed to on-site recommendations without inventing prices',async t=>{
 const f=await mount(t,'shop');assert.deepEqual([...f.adapter.getScenarioState().saved],[12]);f.$('[data-wish="12"]').click();f.$('[data-wish="13"]').click();const state=f.adapter.getScenarioState();assert.deepEqual([...state.saved],[13]);assert.equal(state.products.find(p=>p.id===13).price,95);assert.equal(state.products.find(p=>p.id===1).price,89);assert.equal(cheaperMatch(state.products,[9],0),null,'skirt cannot recommend a tee');assert.equal(cheaperMatch(state.products,[21],9).item.id,9,'skirt editions are comparable');
 });
 test('local community arrivals insert real feed posts and visible notifications in every locale',async t=>{
 for(const locale of ['ko','en','ja','zh-CN']){const f=await mount(t,'community',locale);const before=f.$$('.th-post').length;let event;f.root.addEventListener('sidekick-demo-arrival',e=>event=e.detail);f.adapter.simulateArrival('mention');assert.equal(f.$$('.th-post').length,before+1);assert.ok(f.$('#th-feed').textContent.includes('@alexmorgan'));assert.equal(f.$('.th-notification-dot').hidden,false);assert.equal(event.kind,'mention');assert.deepEqual(f.w.sourceEvents.map(e=>e.id),['community-mention']);f.adapter.simulateArrival('post');assert.deepEqual(f.w.sourceEvents.map(e=>e.id),['community-mention','community-post']);}
 });

test('wishlist hit targets remain stationary while desktop quick view appears',async()=>{
 const css=await readFile(new URL('../playground/demos/shop.css',import.meta.url),'utf8');
 assert.doesNotMatch(css,/\.muse-product-picture:hover \.muse-heart\{bottom:48px\}/);
 assert.match(css,/\.muse-quick-view\{position:absolute;bottom:0;left:0;right:54px;/);
});

test('community reactions and votes retain mounted posts and focused controls', async t=>{
 const f=await mount(t,'community');
 const article=f.$('[data-post-id="0"]'),image=article.querySelector('img');
 for(const kind of ['liked','saved','reposted']){
  const button=article.querySelector(`[data-action="${kind}"]`);button.focus();button.click();
  assert.equal(f.$('[data-post-id="0"]'),article);
  assert.equal(article.querySelector('img'),image);
  assert.equal(f.w.document.activeElement,button);
  assert.equal(button.getAttribute('aria-pressed'),'true');
  button.click();assert.equal(button.getAttribute('aria-pressed'),'false');
 }
 const poll=f.$('[data-vote="1"]'),pollArticle=poll.closest('.th-post');poll.focus();poll.click();
 assert.equal(f.$('[data-vote="1"]'),poll);
 assert.equal(poll.closest('.th-post'),pollArticle);
 assert.equal(poll.disabled,true);
 assert.match(poll.textContent,/✓.*46%/);
 assert.equal(f.$('[data-post-id="0"]'),article);
});

test('community automatic arrivals retain reading position, focus and existing post nodes', async t=>{
 const f=await mount(t,'community'),posts=f.$$('.th-post'),reading=posts[4],control=reading.querySelector('[data-action="liked"]');
 let scroll=500;Object.defineProperty(f.w,'scrollY',{get:()=>scroll});
 const corrections=[];f.w.scrollBy=options=>{corrections.push(options);scroll+=options.top;};
 // Model a 120px new post prepended above the visible reading position.
 for(const post of posts)post.getBoundingClientRect=()=>{const i=[...f.$('#th-feed').children].indexOf(post);const top=i*120-scroll;return {top,bottom:top+120};};
 control.focus();const before=reading.getBoundingClientRect().top;
 f.adapter.simulateArrival('post');
 assert.equal(f.$$('.th-post').length,21);
 assert.equal(f.w.document.activeElement,control);
 for(const post of posts)assert.equal(f.$(`[data-post-id="${post.dataset.postId}"]`),post);
 assert.equal(reading.getBoundingClientRect().top,before);
 assert.equal(corrections.length,1);assert.equal(corrections[0].top,120);assert.equal(corrections[0].behavior,'instant');
 assert.equal(f.$('.th-notification-dot').hidden,false);
 scroll=0;f.adapter.simulateArrival('mention');
 assert.equal(corrections.length,1,'at the top, new posts remain visible without moving the reader');
 assert.equal(f.$$('.th-post').length,22);
});
test('explicit community feed navigation starts at its destination, unlike local reactions',async t=>{
 const f=await mount(t,'community');const scrolls=[];f.w.scrollTo=options=>scrolls.push(options);
 f.$('.th-liked').click();f.$('[data-vote]')?.click();f.adapter.simulateArrival('post');assert.equal(scrolls.length,0,'reactions and arrivals keep reading context');
 f.$('[data-nav="notifications"]').click();assert.deepEqual(JSON.parse(JSON.stringify(scrolls.at(-1))),{top:0,behavior:'instant'});
 f.$('[data-nav="home"]').click();f.$('[data-tab="following"]').click();assert.equal(scrolls.length,3);
 const following=f.$('[data-tab="following"]');following.focus();following.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));
 assert.equal(scrolls.length,4);assert.equal(f.w.document.activeElement,f.$('[data-tab="forYou"]'));
});

test('community short desktop rail keeps actions unsqueezed with a scroll fallback, without changing mobile',async()=>{
 const css=await readFile(new URL('../playground/demos/community.css',import.meta.url),'utf8');
 assert.match(css,/@media\(min-width:601px\)\{\s*\.th-left\{[^}]*overflow-y:auto;[^}]*overscroll-behavior-y:contain;[^}]*scroll-padding-block:8px/);
 assert.match(css,/\.th-left>\*\{flex-shrink:0\}/);
 assert.match(css,/@media\(min-width:601px\) and \(max-height:500px\)/);
 assert.match(css,/\.th-nav button\{min-height:44px;padding:8px 12px\}/);
 assert.match(css,/\.th-compose-link\{height:44px;min-height:44px;margin-top:8px\}/);
});

test('simulated community alerts link to the actual arriving post in every locale',async t=>{
 for(const locale of ['ko','en','ja','zh-CN']){
  const f=await mount(t,'community',locale);let arrival;f.root.addEventListener('sidekick-demo-arrival',e=>arrival=e.detail);
  f.adapter.simulateArrival('mention');f.$('[data-nav="notifications"]').click();const row=f.$('.th-notification-link');
  assert.equal(Number(row.dataset.openPost),arrival.id);assert.match(row.textContent,/Daniel Park/);assert.match(row.textContent,/@alexmorgan/);
  row.click();assert.equal(f.$('#th-detail').open,true);assert.match(f.$('#post-title').textContent+f.$('#post-body').textContent,/@alexmorgan/);
 }
});

test('company narrow display heading scales with its iframe and can wrap unusually long words',async()=>{
 const css=await readFile(new URL('../playground/demos/company.css',import.meta.url),'utf8');assert.match(css,/@media\(max-width:360px\)\{\.nova-macro h2\{[^}]*font-size:clamp\(28px,10vw,36px\);[^}]*overflow-wrap:anywhere/);
});

test('actual company root receives the compact inline guidance style',async t=>{
 const f=await mount(t,'company');const style=f.w.document.createElement('style');style.textContent=await readFile(new URL('../playground/api-demo.css',import.meta.url),'utf8');f.w.document.head.append(style);const cues=installIntentCues({root:f.root,site:'company',locale:'en'});t.after(()=>cues.dispose());
 assert.equal(f.root.id,'demo-content');assert.equal(f.root.classList.contains('nova-site'),true);
 for(const guide of f.$$('.demo-intent')){const css=f.w.getComputedStyle(guide);assert.equal(css.display,'block');assert.equal(css.paddingTop,'0px');assert.equal(css.paddingBottom,'0px');assert.equal(css.borderTopWidth,'0px');}
 assert.equal(f.$$('.demo-intent').length,4);
});
