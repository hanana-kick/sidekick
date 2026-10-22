import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {installIntentCues,intentCopy} from '../playground/demo-intent.js';
function setup(t,site,html,locale='en'){const dom=new JSDOM(`<div id="root">${html}</div>`);t.after(()=>dom.window.close());const root=dom.window.document.querySelector('#root'),cues=installIntentCues({root,site,locale});return {root,cues};}
test('company explains utility in flow before travel and preserves its measured image',t=>{
 const {root,cues}=setup(t,'company','<section id="nova-design"><img><div><h2>Design</h2></div></section>');const target=root.querySelector('img'),node=root.querySelector('[data-demo-intent]');
 assert.match(node.textContent,/aluminum/);assert.equal(node.parentElement,root.querySelector('section > div'));assert.equal(target.childNodes.length,0);
 const entry={key:'nova-design',target};cues.begin(entry);assert.equal(target.dataset.demoTarget,'moving');assert.equal(node.dataset.phase,'moving');cues.complete(entry);cues.reset();
 assert.equal(target.hasAttribute('data-demo-target'),false);assert.equal(node.dataset.phase,'result');assert.match(node.textContent,/aluminum/);
 cues.dispose();assert.equal(root.querySelector('[data-demo-intent]'),null);
});
test('shop comparison uses textContent, survives speech end, and aborted next guidance restores prior text',t=>{
 const {root,cues}=setup(t,'shop','<article class="muse-product"><div class="muse-product-picture"></div><div class="muse-product-info"></div></article>');const target=root.firstChild,node=target.querySelector('[data-demo-intent]');
 assert.equal(node.hidden,true);const entry={target,intent:cues.copy.shop({name:'<img onerror=x>',price:18},{name:'Soft tee',price:12})};cues.begin(entry);assert.match(node.textContent,/\$6 less/);assert.equal(node.querySelector('img'),null);cues.complete(entry);cues.reset();const previous=node.querySelector('span').textContent;
 cues.begin({target,intent:'New comparison'});cues.reset();assert.equal(node.querySelector('span').textContent,previous);assert.equal(target.hasAttribute('data-demo-target'),false);
});
test('aborting first travel removes incomplete result and re-rendered cards get fresh slots',t=>{
 const {root,cues}=setup(t,'shop','<article class="muse-product"><div class="muse-product-info"></div></article>');const target=root.firstChild;cues.begin({target,intent:'Found a lower price'});cues.reset();assert.equal(target.querySelector('[data-demo-intent]').hidden,true);
 root.innerHTML='<article class="muse-product"><div class="muse-product-info"></div></article>';cues.shopSlots();cues.shopSlots();assert.equal(root.querySelectorAll('[data-demo-intent]').length,1);
});
test('community guide stays outside sticky header and keyed feed, without stealing focus or adding live speech',t=>{
 const {root,cues}=setup(t,'community','<main class="th-main"><header class="th-feed-header"></header><div class="th-tabs"></div><div id="th-feed"></div><button data-nav="notifications">Notifications</button></main>');const node=root.querySelector('[data-demo-intent]'),target=root.querySelector('button');target.focus();
 assert.equal(node.previousElementSibling.className,'th-tabs');assert.equal(node.nextElementSibling.id,'th-feed');assert.match(node.textContent,/Publish a local post/);
 cues.begin({target,intent:cues.copy.mention});assert.equal(root.ownerDocument.activeElement,target);assert.equal(node.hasAttribute('aria-live'),false);assert.equal(node.hasAttribute('role'),false);cues.reset();assert.match(node.textContent,/Publish a local post/);
});
test('four locales cover specific useful company controls, comparison, and simulated arrival outcomes',()=>{
 assert.deepEqual(Object.keys(intentCopy),['en','ko','ja','zh-CN']);for(const copy of Object.values(intentCopy)){assert.equal(copy.company.length,4);for(const value of [...copy.company,copy.label,copy.read,copy.community,copy.post,copy.mention,copy.moving,copy.result])assert.ok(value.length>2);const text=copy.shop({name:'A',price:18},{name:'B',price:12});assert.match(text,/A/);assert.match(text,/B/);assert.match(text,/18/);assert.match(text,/6/);}
});

test('shop keeps comparisons current when saved references change without a card replacement',t=>{
 const {root,cues}=setup(t,'shop','<article class="muse-product"><div class="muse-product-info"><div class="muse-price">$12</div></div></article>');const target=root.firstChild,node=target.querySelector('[data-demo-intent]');
 assert.equal(node.previousElementSibling.className,'muse-price');cues.updateShop(()=>'$18 → $12');assert.equal(node.hidden,false);cues.begin({target,intent:'$18 → $12'});cues.complete({target});cues.updateShop(()=>null);
 assert.equal(node.hidden,true);assert.equal(target.hasAttribute('data-demo-target'),false);
});

test('community instruction follows Notifications view without changing focus or geometry labels',t=>{
 const {root,cues}=setup(t,'community','<main class="th-main"><header class="th-feed-header"></header><div class="th-tabs"></div><div id="th-feed"></div><button data-nav="notifications">Notifications</button></main>');const target=root.querySelector('button'),node=root.querySelector('[data-demo-intent]');
 cues.begin({target,intent:cues.copy.post});target.classList.add('active');target.focus();cues.refreshCommunity();assert.equal(node.querySelector('span').textContent,cues.copy.read);assert.equal(root.ownerDocument.activeElement,target);const label=node.querySelector('strong').textContent;cues.complete({target,intent:cues.copy.post});assert.equal(node.querySelector('span').textContent,cues.copy.read);assert.equal(node.querySelector('strong').textContent,label);
 target.classList.remove('active');cues.refreshCommunity();assert.equal(node.querySelector('span').textContent,cues.copy.post);
});


test('empty Notifications describes the alert capability without inventing a row to click',t=>{
 const {root,cues}=setup(t,'community','<main class="th-main"><header class="th-feed-header"></header><div class="th-tabs"></div><div id="th-feed"></div><button class="active" data-nav="notifications">Notifications</button></main>');cues.refreshCommunity();
 assert.equal(root.querySelector('.th-notification-link'),null);assert.equal(root.querySelector('[data-demo-intent] span').textContent,'New-post and mention alerts link to their demo conversations.');
});

for(const locale of ['en','ko','ja','zh-CN'])test(`company ${locale} reuses lead-copy space and restores the original nodes on disposal`,t=>{
 const dom=new JSDOM('<div id="root"><section id="nova-design"><img><div><h2>Design</h2><p>Original detail</p></div></section><section id="nova-sound"><div class="nova-sound-controls"><div id="nova-mode-panel"><p>Dynamic mode description</p></div><p class="nova-fineprint">Original audio disclaimer</p></div></section><section id="nova-compare"><div class="nova-heading"><h2>Compare</h2><p>Original lead</p></div></section><section id="nova-configure"><div class="nova-config-info"><h2>Finish</h2><p>Original lead</p><fieldset class="nova-finishes"></fieldset></div></section></div>');t.after(()=>dom.window.close());
 const root=dom.window.document.querySelector('#root'),original=[...root.querySelectorAll('p')],cues=installIntentCues({root,site:'company',locale});
 assert.equal(root.querySelectorAll('p').length,original.length,'guidance must not add a second tall block');assert.equal(root.querySelector('#nova-mode-panel p'),original[1],'dynamic mode copy stays untouched');assert.equal(root.querySelectorAll('[data-demo-intent]').length,4);
 cues.dispose();assert.deepEqual([...root.querySelectorAll('p')],original,'original node identity and order survive disposal');
});

test('empty community reuses its explanation rather than stacking guidance above the mobile navigation',t=>{
 const {root,cues}=setup(t,'community','<main class="th-main"><header class="th-feed-header"></header><div class="th-tabs"></div><div id="th-feed"><div class="th-empty"><h2>All caught up</h2><p>Original explanation</p></div></div><button class="active" data-nav="notifications">Notifications</button></main>');const guide=root.querySelector('[data-demo-intent]'),paragraph=root.querySelector('.th-empty p');cues.refreshCommunity();assert.equal(guide.hidden,true);assert.equal(paragraph.textContent,cues.copy.read);
 root.querySelector('.th-empty').remove();cues.refreshCommunity();assert.equal(guide.hidden,false);assert.equal(guide.querySelector('span').textContent,cues.copy.read);
});

for(const locale of ['en','ko','ja','zh-CN'])test(`empty community restores its authored explanation on dispose (${locale})`,t=>{
 const {root,cues}=setup(t,'community','<main class="th-main"><div class="th-tabs"></div><div class="th-empty"><p>Original explanation</p></div><button class="active" data-nav="notifications">Notifications</button></main>',locale);const paragraph=root.querySelector('.th-empty p');cues.refreshCommunity();assert.equal(paragraph.textContent,intentCopy[locale].read);cues.dispose();assert.equal(paragraph.textContent,'Original explanation');
});
