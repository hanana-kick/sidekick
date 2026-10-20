/** Explicit site controls only: callers project accepted controls, never scan DOM/form text. */
import { recordSiteEvent, siteAnalyticsConsent, siteAnalyticsConsentVersion } from './site-analytics.js';
import { PRODUCT_SETTINGS, sanitizeSiteSection, sanitizeProductEvent } from './product-analytics-schema.js';
const instances = new WeakMap();
export function cancelSettingChange(win, { site_page, site_section, setting_key }) {
  if (!sanitizeSiteSection(site_page, site_section) || typeof setting_key !== 'string' || !Object.hasOwn(PRODUCT_SETTINGS, setting_key)) return;
  const state = instances.get(win), key = `${site_page}:${site_section}:${setting_key}`;
  if (state?.pending.has(key)) { win.clearTimeout(state.pending.get(key)); state.pending.delete(key); }
}
export function recordSettingChange(win, properties, { debounce = false } = {}) {
  const safe = sanitizeProductEvent('setting_change', properties);
  if (!safe) return false;
  const version = siteAnalyticsConsentVersion(win);
  let state = instances.get(win);
  if (!state || state.version !== version) {
    if (state) for (const timer of state.pending.values()) win.clearTimeout(timer);
    state = { version, pending: new Map(), last: new Map() }; instances.set(win, state);
  }
  const key = `${safe.site_page}:${safe.site_section}:${safe.setting_key}`;
  if (state.pending.has(key)) { win.clearTimeout(state.pending.get(key)); state.pending.delete(key); }
  if (!siteAnalyticsConsent(win) || state.last.get(key) === safe.value_category) return false;
  const send = () => {
    state.pending.delete(key);
    if (!siteAnalyticsConsent(win) || siteAnalyticsConsentVersion(win) !== version) return false;
    if (recordSiteEvent(win, 'setting_change', safe)) { state.last.set(key, safe.value_category); return true; }
    return false;
  };
  if (debounce) { state.pending.set(key, win.setTimeout(send, 600)); return true; }
  return send();
}
