/** Website analytics only. Never import this module from src/ or library entry points. */
import { createSectionEngagement } from './section-engagement.js';
import { sanitizeProductEvent, sanitizeSiteSection } from './product-analytics-schema.js';
import { guideIds } from './guide-navigation.js';
import { getSiteLocale, subscribeSiteLocale } from './site-i18n.js';

const sections = new Set(guideIds);
const origin = 'https://sidekick.hananakick.cc';
const instances = new WeakMap();
export function analyticsConfigured({ production, measurementId, enabled } = {}) {
  return production === true && enabled === 'true' && typeof measurementId === 'string' && /^G-[A-Z0-9]{6,20}$/.test(measurementId);
}
/** Canonical, allowlisted virtual paths: never forward the actual URL, title or referrer. */
export function analyticsPage(page, hash = '') {
  const section = hash.slice(1);
  const path = page === 'guide' || page === 'usecases'
    ? `/guide/${sections.has(section) ? section : 'state-emotion'}`
    : page === 'api' ? '/api-playground' : '/studio';
  return { page_location: origin + path, page_title: `Sidekick ${path}`, page_referrer: '' };
}
const copy = {
  ko: ['방문 통계', 'Google Analytics를 허용할까요?', '동의하면 Google Analytics가 브라우저 정보와 임시 방문 식별자를 사용해 페이지 방문, 허용된 설정 범주의 선택·적용과 봇 조합 복사·내보내기 및 활성 섹션 체류 시간을 수집합니다. 입력 내용이나 저장한 디자인은 보내지 않습니다. Google Analytics가 활성화되면 쿠키도 저장됩니다. 언제든 여기에서 끌 수 있습니다.', '허용', '사용 안 함', '닫기', 'Google 개인정보처리방침', '방문 통계 사용 중', '방문 통계 꺼짐'],
  en: ['Analytics', 'Allow Google Analytics?', 'With your consent, Google Analytics uses browser information and a temporary visit identifier to measure page visits, allowlisted setting categories selected/applied, bot combinations and copies/exports and active section time. We do not send your inputs or saved designs. Google Analytics also stores cookies when enabled. You can turn this off here at any time.', 'Allow', 'Do not allow', 'Close', 'Google privacy policy', 'Analytics on', 'Analytics off'],
  ja: ['アクセス解析', 'Google Analytics を許可しますか？', '同意すると、Google Analytics がブラウザー情報と一時的な訪問識別子を使用してページ訪問、許可された設定カテゴリの選択・適用、ボットの組み合わせ・コピー・エクスポートとアクティブな節の滞在時間を計測します。入力内容や保存したデザインは送信しません。Google Analytics が有効な場合は Cookie も保存します。ここでいつでも無効にできます。', '許可', '許可しない', '閉じる', 'Google プライバシーポリシー', '解析は有効', '解析は無効'],
  'zh-CN': ['访问统计', '允许 Google Analytics？', '同意后，Google Analytics 会使用浏览器信息和临时访问标识符统计页面访问、允许的设置类别选择和应用、机器人组合、复制和导出，以及活跃章节停留时间。我们不会发送您输入的内容或保存的设计。启用 Google Analytics 时也会保存 Cookie。您可以随时在此关闭。', '允许', '不允许', '关闭', 'Google 隐私政策', '统计已开启', '统计已关闭'],
};

export function analyticsConsentKey({ measurementId } = {}) {
  return `sidekick.site.analytics.v3.ga.${measurementId ?? 'none'}`;
}
export function createSiteAnalytics(win, config = {}) {
  const { measurementId, page } = config;
  const ga = analyticsConfigured(config);
  if (!ga || win.location.origin !== origin) return null;
  const doc = win.document;
  const storageKey = analyticsConsentKey({ measurementId });
  const disableKey = `ga-disable-${measurementId}`;
  let choice = null, consentVersion = 0;
  try { const stored = win.localStorage.getItem(storageKey); if (stored === 'granted' || stored === 'denied') choice = stored; } catch { /* No persistence, no implicit consent. */ }
  let script, ready = false, initialized = false, lastPage = null;
  let pendingGa = [];
  const listeners = new Set();
  const sitePage = page === 'guide' || page === 'usecases' ? 'guide' : page === 'api' ? 'api' : 'studio';
  let section = { site_page: sitePage, site_section: sitePage === 'guide' ? (sections.has(win.location.hash.slice(1)) ? win.location.hash.slice(1) : 'state-emotion') : sitePage === 'api' ? 'overview' : 'appearance' };
  if (ga) win[disableKey] = choice !== 'granted';
  function gtag() { win.dataLayer.push(arguments); }
  const currentPage = () => analyticsPage(page, win.location.hash);
  const consent = analytics_storage => ({ analytics_storage, ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  function sendGa(name, properties) {
    if (!ga || choice !== 'granted') return;
    if (!ready) { if (pendingGa.length < 50) pendingGa.push([name, properties]); return; }
    const route = currentPage();
    if (name === 'page_view') {
      gtag('set', properties);
      gtag('config', measurementId, { ...properties, update: true, send_page_view: false });
    }
    gtag('event', name, { ...route, ...properties, send_to: measurementId });
  }
  function emit(name, properties) {
    if (choice !== 'granted') return false;
    // Freeze canonical attribution at capture, not after a slow GA load or route switch.
    const route = analyticsPage(properties.site_page, `#${properties.site_section}`);
    const payload = { ...route, ...properties };
    sendGa(name, payload); return true;
  }
  function record(name, properties) {
    const safe = sanitizeProductEvent(name, properties);
    return safe ? emit(name, safe) : false;
  }
  function recordBatch(events) {
    if (choice !== 'granted' || !Array.isArray(events) || events.length < 1 || events.length > 25) return false;
    const safe = [];
    for (let index = 0; index < events.length; index++) {
      const event = Object.getOwnPropertyDescriptor(events, String(index))?.value;
      if (!event || typeof event !== 'object') return false;
      const name = Object.getOwnPropertyDescriptor(event, 'name')?.value;
      const properties = sanitizeProductEvent(name, Object.getOwnPropertyDescriptor(event, 'properties')?.value);
      if (!properties) return false;
      safe.push({ name, properties });
    }
    const payloads = safe.map(({ name, properties }) => ({ name, properties: { ...analyticsPage(properties.site_page, `#${properties.site_section}`), ...properties } }));
    for (const event of payloads) sendGa(event.name, event.properties);
    return true;
  }
  const dwell = createSectionEngagement(win, { initialSection: section, emit: record });
  function setSection(nextPage, nextSection) {
    const safe = sanitizeSiteSection(nextPage, nextSection);
    if (!safe || nextPage !== sitePage) return false;
    const next = { site_page: nextPage, site_section: safe };
    if (!dwell.setSection(next)) return false;
    section = next;
    record('section_view', section); return true;
  }
  function trackPage() {
    if (sitePage === 'guide') setSection(sitePage, sections.has(win.location.hash.slice(1)) ? win.location.hash.slice(1) : 'state-emotion');
    else if (sitePage === 'api' && doc.documentElement.dataset.guideExercise === 'true' && sections.has(win.location.hash.slice(1))) setSection('api', win.location.hash.slice(1));
    if (choice !== 'granted') return;
    const route = currentPage();
    if (route.page_location === lastPage) return;
    emit('page_view', { ...route, ...section });
    lastPage = route.page_location;
  }
  function startGa() {
    if (!ga || choice !== 'granted') return;
    win[disableKey] = false;
    if (!script) {
      win.dataLayer = win.dataLayer || [];
      gtag('consent', 'default', consent('denied'));
      script = doc.createElement('script'); script.async = true; script.referrerPolicy = 'no-referrer';
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
      script.onload = () => { ready = true; startGa(); };
      script.onerror = () => { script.remove(); script = undefined; ready = false; };
      doc.head.append(script); return;
    }
    if (!ready) return;
    gtag('consent', 'update', consent('granted'));
    if (!initialized) {
      gtag('js', new Date());
      gtag('config', measurementId, {
        ...currentPage(), send_page_view: false, allow_google_signals: false,
        allow_ad_personalization_signals: false, cookie_prefix: 'sidekick_site',
        cookie_domain: 'none', cookie_path: '/', cookie_expires: 60 * 60 * 24 * 60,
      });
      initialized = true;
    }
    const queued = pendingGa; pendingGa = [];
    for (const [name, properties] of queued) sendGa(name, properties);
  }
  function clearCookies() {
    for (const cookie of doc.cookie.split(';')) {
      const name = cookie.trim().split('=')[0];
      if (/^sidekick_site_ga(?:_|$)/.test(name)) doc.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
    }
  }
  function activate() {
    startGa(); dwell.setEnabled(true); trackPage(); record('section_view', section);
  }
  function apply(next, persist = true) {
    if (next !== 'granted' && next !== 'denied') return;
    const changed = choice !== next; choice = next;
    if (changed) consentVersion++;
    if (persist) { try { win.localStorage.setItem(storageKey, next); } catch { /* This tab still honors the choice. */ } }
    if (ga) win[disableKey] = next !== 'granted';
    if (next === 'granted') { if (changed) activate(); else startGa(); }
    else {
      dwell.setEnabled(false); pendingGa = []; lastPage = null;
      clearCookies();
    }
    for (const listener of listeners) listener();
  }
  win.addEventListener('hashchange', trackPage); win.addEventListener('popstate', trackPage);
  win.addEventListener('storage', event => { if (event.key === storageKey || event.key === null) apply(event.newValue === 'granted' ? 'granted' : 'denied', false); });
  if (choice === 'granted') activate();
  else { clearCookies(); }
  return { setConsent: apply, trackPage, record, recordBatch, setSection, getConsent: () => choice, getConsentVersion: () => consentVersion,
    providers: ['Google Analytics'],
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); } };
}

/** These adapters are only imported by the website UI, never the distributed avatar. */
export function recordSiteEvent(win, name, properties) { return instances.get(win)?.record(name, properties) ?? false; }
export function recordSiteEvents(win, events) { return instances.get(win)?.recordBatch(events) ?? false; }
export function setSiteSection(win, page, section) { return instances.get(win)?.setSection(page, section) ?? false; }
export function siteAnalyticsConsent(win) { return instances.get(win)?.getConsent() === 'granted'; }
export function siteAnalyticsConsentVersion(win) { return instances.get(win)?.getConsentVersion() ?? -1; }

/** Idempotent across header remounts/React renders. No configured ID means no UI or requests. */
export function mountSiteAnalytics(doc, page, config = {
  production: import.meta.env?.PROD,
  measurementId: import.meta.env?.VITE_GA_MEASUREMENT_ID,
  enabled: import.meta.env?.VITE_GA_ENABLED,
}) {
  const win = doc.defaultView;
  if (!win || instances.has(win)) return instances.get(win);
  const analytics = createSiteAnalytics(win, { ...config, page });
  if (!analytics) return null;
  instances.set(win, analytics);
  const host = doc.createElement('aside'); host.className = 'site-analytics';
  const toggle = doc.createElement('button'); toggle.type = 'button'; toggle.className = 'site-analytics-toggle'; toggle.setAttribute('aria-controls', 'site-analytics-panel');
  const panel = doc.createElement('section'); panel.id = 'site-analytics-panel'; panel.hidden = true;
  panel.setAttribute('aria-labelledby', 'site-analytics-title');
  const title = doc.createElement('strong'); title.id = 'site-analytics-title';
  const status = doc.createElement('p'); status.setAttribute('role', 'status');
  const description = doc.createElement('p');
  const privacy = doc.createElement('div');
  for (const provider of analytics.providers) { const link = doc.createElement('a'); link.href = 'https://policies.google.com/privacy'; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = provider; privacy.append(link, doc.createTextNode(' ')); }
  const actions = doc.createElement('div'); actions.className = 'site-analytics-actions';
  const allow = doc.createElement('button'), deny = doc.createElement('button'), close = doc.createElement('button');
  for (const button of [allow, deny, close]) button.type = 'button';
  actions.append(allow, deny, close); panel.append(title, description, privacy, status, actions); host.append(toggle, panel); doc.body.append(host);
  function update() {
    const text = copy[getSiteLocale()] ?? copy.ko;
    [toggle.textContent, title.textContent, description.textContent, allow.textContent, deny.textContent, close.textContent] = text;
    title.textContent = title.textContent.replace('Google Analytics', analytics.providers.join(' + '));

    status.textContent = text[analytics.getConsent() === 'granted' ? 7 : 8];
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
    host.setAttribute('aria-label', text[0]);
  }
  function hide() { panel.hidden = true; update(); toggle.focus(); }
  toggle.onclick = () => { panel.hidden = !panel.hidden; update(); if (!panel.hidden) allow.focus(); };
  allow.onclick = () => { analytics.setConsent('granted'); hide(); };
  deny.onclick = () => { analytics.setConsent('denied'); hide(); };
  close.onclick = hide;
  host.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) hide(); });
  subscribeSiteLocale(update); analytics.subscribe(update); update();
  return analytics;
}
