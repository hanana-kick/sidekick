/** Site language only. Avatar API keys, saved designs and authored content never change. */
export const SITE_LOCALES = Object.freeze(['ko', 'en', 'zh-CN', 'ja']);
export const SITE_LANGUAGE_NAMES = Object.freeze({ ko: '한국어', en: 'English', 'zh-CN': '简体中文', ja: '日本語' });
export const SITE_LOCALE_STORAGE_KEY = 'sidekick.site.locale';
const listeners = new Set();
export function normalizeSiteLocale(value) {
  if (typeof value !== 'string') return null;
  const language = value.toLowerCase().split('-')[0];
  return language === 'zh' ? 'zh-CN' : ['ko', 'en', 'ja'].includes(language) ? language : null;
}
export function resolveSiteLocale({ query, stored, languages = [] } = {}) {
  return normalizeSiteLocale(query) ?? normalizeSiteLocale(stored) ?? languages.map(normalizeSiteLocale).find(Boolean) ?? 'ko';
}
function initialLocale() {
  if (typeof window === 'undefined') return 'ko';
  let stored; try { stored = window.localStorage.getItem(SITE_LOCALE_STORAGE_KEY); } catch { /* Private browsing may deny storage. */ }
  return resolveSiteLocale({ query: new URL(window.location.href).searchParams.get('lang'), stored, languages: window.navigator.languages ?? [window.navigator.language] });
}
let locale = initialLocale();
export function getSiteLocale() { return locale; }
export function subscribeSiteLocale(listener) { listeners.add(listener); return () => listeners.delete(listener); }
function applyDocumentLocale() { if (typeof document !== 'undefined') document.documentElement.lang = locale; }
export function setSiteLocale(next) {
  const normalized = normalizeSiteLocale(next);
  if (!normalized) throw new RangeError(`Unsupported site locale: ${next}`);
  const changed = locale !== normalized; locale = normalized;
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(SITE_LOCALE_STORAGE_KEY, locale); } catch { /* Still works for this page. */ }
    const url = new URL(window.location.href); url.searchParams.set('lang', locale);
    try { window.history.replaceState(window.history.state, '', url); } catch { /* Sandboxed embeds may deny history writes. */ }
  }
  applyDocumentLocale();
  if (changed) for (const listener of [...listeners]) listener();
}
export function localizedSiteHref(path, language = locale) {
  const [beforeHash, hash] = path.split('#', 2);
  const [pathname, search = ''] = beforeHash.split('?', 2);
  const params = new URLSearchParams(search); params.set('lang', language);
  return `${pathname}?${params}${hash === undefined ? '' : `#${hash}`}`;
}
export const SITE_MESSAGES = Object.freeze({
  ko: { home: 'Sidekick 스튜디오 홈', navigation: 'Sidekick 메뉴', language: '언어', studio: '스튜디오', api: 'API 체험', guide: '가이드', studioTitle: 'Sidekick · 스튜디오', apiTitle: 'Sidekick · API 체험', guideTitle: 'Sidekick · 가이드' },
  en: { home: 'Sidekick Studio home', navigation: 'Sidekick navigation', language: 'Language', studio: 'Studio', api: 'API playground', guide: 'Guide', studioTitle: 'Sidekick · Studio', apiTitle: 'Sidekick · API playground', guideTitle: 'Sidekick · Guide' },
  'zh-CN': { home: 'Sidekick 工作室首页', navigation: 'Sidekick 导航', language: '语言', studio: '工作室', api: 'API 体验', guide: '指南', studioTitle: 'Sidekick · 工作室', apiTitle: 'Sidekick · API 体验', guideTitle: 'Sidekick · 指南' },
  ja: { home: 'Sidekick スタジオのホーム', navigation: 'Sidekick ナビゲーション', language: '言語', studio: 'スタジオ', api: 'API 体験', guide: 'ガイド', studioTitle: 'Sidekick · スタジオ', apiTitle: 'Sidekick · API 体験', guideTitle: 'Sidekick · ガイド' },
});
export function translateSite(key) { return SITE_MESSAGES[locale][key] ?? SITE_MESSAGES.ko[key] ?? key; }
applyDocumentLocale();
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key !== SITE_LOCALE_STORAGE_KEY) return;
  const next = normalizeSiteLocale(event.newValue);
  if (next && next !== locale) { locale = next; applyDocumentLocale(); for (const listener of [...listeners]) listener(); }
});
