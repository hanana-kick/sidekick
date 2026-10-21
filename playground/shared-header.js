import { mountSiteAnalytics } from './site-analytics.js';
import { getFramework, setFramework, subscribeFramework, frameworkHref } from './site-framework.js';
import { readGuideSource, guideHref, navigationText } from './guide-navigation.js';
import { SITE_LOCALES, SITE_LANGUAGE_NAMES, getSiteLocale, setSiteLocale, subscribeSiteLocale, translateSite, localizedSiteHref } from './site-i18n.js';
/** One brand and navigation for both the React Studio and plain-JS API page. */
export function mountSiteHeader(host, activePage, base = './') {
  const doc = host.ownerDocument;
  let privacyHost=null,privacyHeader=null;
  mountSiteAnalytics(doc, activePage);
  const brand = doc.createElement('a');
  brand.className = 'brand'; brand.href = base;

  const avatar = doc.createElement('sidekick-avatar');
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
  const github = doc.createElement('a');
  github.className = 'site-github'; github.href = 'https://github.com/hanana-kick/sidekick';
  github.target = '_blank'; github.rel = 'noopener noreferrer';
  // GitHub's standard mark, kept inline so every shared-header consumer needs no icon bundle.
  github.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true" focusable="false"><path d="M12 .297C5.37.297 0 5.67 0 12.297c0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.043-1.61-4.043-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.729.083-.729 1.205.084 1.838 1.237 1.838 1.237 1.07 1.835 2.807 1.305 3.492.998.108-.776.418-1.305.762-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.31.467-2.381 1.235-3.221-.135-.303-.54-1.524.105-3.176 0 0 1.008-.322 3.301 1.23a11.52 11.52 0 0 1 3.003-.404c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.647 1.652.242 2.873.119 3.176.765.84 1.23 1.911 1.23 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .315.21.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>';
  const source=activePage==='studio'?readGuideSource(doc.defaultView?.location.href):null;
  const returnLink=source?doc.createElement('a'):null;
  if(returnLink){returnLink.id='guide-source-return';returnLink.className='guide-source-return';}
  const update = () => {
    github.setAttribute('aria-label', translateSite('github')); github.title = translateSite('github');
    if(returnLink){returnLink.textContent=navigationText[getSiteLocale()].back;returnLink.href=guideHref(source,getSiteLocale());}
    framework.value=getFramework(); framework.setAttribute('aria-label', {ko:'문서 코드 형식',en:'Documentation framework','zh-CN':'文档代码框架',ja:'文書のコード形式'}[getSiteLocale()]);
    doc.documentElement.lang = getSiteLocale();
    brand.href = frameworkHref(localizedSiteHref(base)); brand.setAttribute('aria-label', translateSite('home'));
    nav.setAttribute('aria-label', translateSite('navigation')); selector.setAttribute('aria-label', translateSite('language')); selector.value = getSiteLocale();
    for (const link of nav.children) { link.textContent = translateSite(link.dataset.sitePage); link.href = frameworkHref(localizedSiteHref(link.dataset.sitePath)); }
    doc.title = translateSite((activePage === 'usecases' ? 'guide' : activePage) + 'Title');
  };
  const controls = doc.createElement('div'); controls.className = 'site-navigation'; controls.append(nav, framework, selector, github);if(returnLink)controls.append(returnLink);
  host.replaceChildren(brand, controls); update();
  // Studio intentionally has no document scrolling. Keep its optional consent
  // entry in the header flow instead of an unreachable footer or overlay.
  if(activePage==='studio'){
    const analyticsHost=doc.querySelector('.site-analytics'),header=host.closest('.app-header');
    if(analyticsHost&&header){privacyHost=analyticsHost;privacyHeader=header;header.classList.add('has-inline-privacy');header.append(analyticsHost);}
  }
  const unsubscribe = subscribeSiteLocale(update);
  const unsubscribeFramework = subscribeFramework(update);
  return () => { if(privacyHost?.parentElement===privacyHeader)doc.body.append(privacyHost);unsubscribeFramework(); unsubscribe(); host.replaceChildren(); };
}
