import { mountSiteAnalytics } from './site-analytics.js';
import { getFramework, setFramework, subscribeFramework, frameworkHref } from './site-framework.js';
import { readGuideSource, guideHref, navigationText } from './guide-navigation.js';
import { SITE_LOCALES, SITE_LANGUAGE_NAMES, getSiteLocale, setSiteLocale, subscribeSiteLocale, translateSite, localizedSiteHref } from './site-i18n.js';
/** One brand and navigation for both the React Studio and plain-JS API page. */
export function mountSiteHeader(host, activePage, base = './', { staticBrand = false } = {}) {
  const doc = host.ownerDocument;
  mountSiteAnalytics(doc, activePage);
  const brand = doc.createElement('a');
  brand.className = 'brand'; brand.href = base;

  const avatar = doc.createElement(staticBrand ? 'span' : 'sidekick-avatar');
  if (staticBrand) { avatar.textContent = 's'; avatar.style.cssText = 'display:grid;place-items:center;border-radius:10px;background:#ffcc37;color:#0f172a;font:bold 24px system-ui'; }
  // Preserve the original logo's screen scale under body-referenced framing:
  // 2 × (2.568286993103977 / 3.9982869931039766). User avatars keep their zoom.
  for (const [name, value] of Object.entries({
    class: 'brand-avatar', shape: 'ghostish', 'body-color': '#FFCC37',
    'head-accessory': 'beret', 'eyes-accessory': 'glasses', 'neck-accessory': 'bowTie',
    expression: 'smile', 'zoom': '1.2846936688304844', paused: '', interaction: 'none', 'tracking-mode': 'off',
    'aria-hidden': 'true', tabindex: '-1',
  })) avatar.setAttribute(name, value);
  // Keep renderer failure text from overflowing the compact logo slot.
  avatar.addEventListener('sidekick-error', event => { if (!event.detail?.recoverable) avatar.style.visibility = 'hidden'; });
  avatar.addEventListener('sidekick-ready', () => { avatar.style.visibility = ''; });
  const name = doc.createElement('span'); name.textContent = 'sidekick';
  brand.append(avatar, name);
  const nav = doc.createElement('nav'); nav.className = 'product-nav';

  for (const [page, label, path] of [['studio', 'studio', ''], ['api', 'api', 'api-playground.html'], ['guide', 'guide', 'guide.html']]) {
    const link = doc.createElement('a'); link.dataset.sitePage = label; link.dataset.sitePath = `${base}${path}`;
    if (page === activePage || (page === 'guide' && activePage === 'usecases')) link.setAttribute('aria-current', 'page');
    if (page === 'api') link.id = 'api-playground-link';
    nav.append(link);
  }
  const selector = doc.createElement('select'); selector.className = 'site-language'; selector.id = 'site-language';
  for (const language of SITE_LOCALES) {
    const option = doc.createElement('option'); option.value = language; option.lang = language; option.textContent = SITE_LANGUAGE_NAMES[language]; selector.append(option);
  }
  selector.addEventListener('change', () => setSiteLocale(selector.value));
  const framework = doc.createElement('select'); framework.id = 'site-framework'; framework.className = 'site-framework';
  for (const [value, label] of [['element','Custom Element'],['react','React']]) { const option=doc.createElement('option'); option.value=value; option.textContent=label; framework.append(option); }
  framework.addEventListener('change',()=>setFramework(framework.value));
  const source=activePage==='studio'?readGuideSource(doc.defaultView?.location.href):null;
  const returnLink=source?doc.createElement('a'):null;
  if(returnLink){returnLink.id='guide-source-return';returnLink.className='guide-source-return';}
  const update = () => {
    if(returnLink){returnLink.textContent=navigationText[getSiteLocale()].back;returnLink.href=guideHref(source,getSiteLocale());}
    framework.value=getFramework(); framework.setAttribute('aria-label', {ko:'문서 코드 형식',en:'Documentation framework','zh-CN':'文档代码框架',ja:'文書のコード形式'}[getSiteLocale()]);
    doc.documentElement.lang = getSiteLocale();
    brand.href = frameworkHref(localizedSiteHref(base)); brand.setAttribute('aria-label', translateSite('home'));
    nav.setAttribute('aria-label', translateSite('navigation')); selector.setAttribute('aria-label', translateSite('language')); selector.value = getSiteLocale();
    for (const link of nav.children) { link.textContent = translateSite(link.dataset.sitePage); link.href = frameworkHref(localizedSiteHref(link.dataset.sitePath)); }
    doc.title = translateSite((activePage === 'usecases' ? 'guide' : activePage) + 'Title');
  };
  const controls = doc.createElement('div'); controls.className = 'site-navigation'; controls.append(nav, framework, selector);if(returnLink)controls.append(returnLink);
  host.replaceChildren(brand, controls); update();
  const unsubscribe = subscribeSiteLocale(update);
  const unsubscribeFramework = subscribeFramework(update);
  return () => { unsubscribeFramework(); unsubscribe(); host.replaceChildren(); };
}
