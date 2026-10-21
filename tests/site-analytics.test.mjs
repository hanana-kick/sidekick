import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { analyticsConfigured, analyticsConsentKey, analyticsPage, createSiteAnalytics, mountSiteAnalytics } from '../playground/site-analytics.js';
import { guideIds } from '../playground/guide-navigation.js';
import { setSiteLocale } from '../playground/site-i18n.js';
const measurementId = 'G-TESTONLY01'; // Offline fixture; never loaded or sent to Google.
const config = { production: true, enabled: 'true', measurementId, page: 'guide' };
function setup(t, options = {}, url = 'https://sidekick.hananakick.cc/guide.html?context=PRIVATE&state=DESIGN#state-emotion') {
  // JSDOM does not fetch external resources: manually dispatch load to test the queue only.
  const dom = new JSDOM('<!doctype html><title>PRIVATE TITLE</title><body></body>', { url, referrer: 'https://example.com/?secret=PRIVATE' });
  t.after(() => dom.window.close());
  return { win: dom.window, analytics: createSiteAnalytics(dom.window, { ...config, ...options }) };
}
const calls = win => (win.dataLayer ?? []).map(args => [...args]);
const views = win => calls(win).filter(args => args[0] === 'event' && args[1] === 'page_view');
const loaded = win => win.document.querySelector('script')?.dispatchEvent(new win.Event('load'));

test('production, deliberate activation and valid ID are all required; no default/preview analytics', t => {
  assert.equal(analyticsConfigured(config), true);
  for (const options of [{ production: false }, { enabled: undefined }, { enabled: 'false' }, { measurementId: undefined }, { measurementId: 'UA-123' }, { measurementId: 'G-<script>' }]) {
    const { win, analytics } = setup(t, options); assert.equal(analytics, null); assert.equal(win.document.scripts.length, 0); assert.equal(win.dataLayer, undefined);
  }
  for (const origin of ['http://localhost:5173/', 'https://preview.example/', 'https://hanana-kick.github.io/sidekick/']) assert.equal(setup(t, {}, origin).analytics, null);
});
test('all Guide IDs are allowed but raw URL/title/query/referrer and unknown hashes cannot enter payloads', () => {
  for (const id of guideIds) assert.equal(analyticsPage('guide', `#${id}`).page_location, `https://sidekick.hananakick.cc/guide/${id}`);
  for (const hash of ['#email@example.com', '#state-emotion?private=secret', '#%73tate-emotion']) assert.equal(analyticsPage('guide', hash).page_location, 'https://sidekick.hananakick.cc/guide/state-emotion');
  assert.equal(analyticsPage('api', '#private').page_location, 'https://sidekick.hananakick.cc/api-playground');
  assert.equal(analyticsPage('studio', '#private').page_location, 'https://sidekick.hananakick.cc/studio');
});
test('default and rejection never load script, queue commands, or send consent pings', t => {
  const { win, analytics } = setup(t); assert.equal(analytics.getConsent(), null);
  analytics.trackPage(); analytics.setConsent('denied');
  assert.equal(win.document.scripts.length, 0); assert.equal(win.dataLayer, undefined); assert.equal(win[`ga-disable-${measurementId}`], true);
});
test('grant loads once, disables automatic views/ads, sanitizes all page data, and repeated calls dedupe', t => {
  const { win, analytics } = setup(t); analytics.setConsent('granted'); analytics.setConsent('granted');
  assert.equal(win.document.scripts.length, 1); assert.equal(views(win).length, 0);
  assert.equal(win.document.scripts[0].referrerPolicy, 'no-referrer'); loaded(win);
  analytics.trackPage(); analytics.setConsent('granted'); assert.equal(views(win).length, 1);
  const settings = calls(win).find(args => args[0] === 'config')[2];
  assert.equal(settings.send_page_view, false); assert.equal(settings.allow_google_signals, false); assert.equal(settings.allow_ad_personalization_signals, false);
  assert.equal(settings.cookie_domain, 'none'); assert.equal(settings.cookie_prefix, 'sidekick_site');
  assert.equal(JSON.stringify(calls(win)).includes('PRIVATE'), false); assert.equal(JSON.stringify(calls(win)).includes('DESIGN'), false);
  assert.equal(views(win)[0][2].page_referrer, '');
});
test('Guide hash/back-forward changes count once; context/query/framework rerenders do not count', t => {
  const { win, analytics } = setup(t); analytics.setConsent('granted'); loaded(win);
  win.history.replaceState({}, '', '?lang=en&context=OTHER&framework=react#state-emotion'); analytics.trackPage(); assert.equal(views(win).length, 1);
  win.history.replaceState({}, '', '#state-behavior'); win.dispatchEvent(new win.HashChangeEvent('hashchange')); win.dispatchEvent(new win.PopStateEvent('popstate')); assert.equal(views(win).length, 2);
  win.history.replaceState({}, '', '#state-emotion'); win.dispatchEvent(new win.PopStateEvent('popstate')); assert.equal(views(win).length, 3);
});
test('revocation blocks new views and clears only site GA cookies; regrant works without duplicate tags', t => {
  const { win, analytics } = setup(t); analytics.setConsent('granted'); loaded(win);
  win.document.cookie = 'sidekick_site_ga=one; Path=/'; win.document.cookie = 'sidekick_site_ga_TEST=two; Path=/'; win.document.cookie = 'unrelated=keep; Path=/';
  analytics.setConsent('denied'); const count = calls(win).length;
  analytics.trackPage(); assert.equal(win[`ga-disable-${measurementId}`], true); assert.equal(calls(win).length, count);
  assert.equal(win.document.cookie, 'unrelated=keep'); analytics.setConsent('granted'); assert.equal(win.document.scripts.length, 1); assert.equal(views(win).length, 2);
});
test('revoking during slow script load cannot send a delayed page view', t => {
  const { win, analytics } = setup(t); analytics.setConsent('granted'); analytics.setConsent('denied'); loaded(win);
  assert.equal(views(win).length, 0); assert.equal(calls(win).some(args => args[0] === 'config'), false);
  analytics.setConsent('granted'); assert.equal(views(win).length, 1);
});
test('storage changes revoke across tabs; blocked storage leaves page usable', t => {
  const { win, analytics } = setup(t); analytics.setConsent('granted'); loaded(win);
  win.dispatchEvent(new win.StorageEvent('storage', { key: analyticsConsentKey({ measurementId }), newValue: 'denied' }));
  assert.equal(analytics.getConsent(), 'denied'); assert.equal(win[`ga-disable-${measurementId}`], true);
  Object.defineProperty(win, 'localStorage', { get() { throw new Error('blocked'); } });
  assert.doesNotThrow(() => analytics.setConsent('granted'));
});
test('failed load never blocks the page; explicit retry makes one new request', t => {
  const { win, analytics } = setup(t); analytics.setConsent('granted'); win.document.scripts[0].dispatchEvent(new win.Event('error'));
  assert.equal(win.document.scripts.length, 0); assert.equal(views(win).length, 0);
  analytics.setConsent('granted'); loaded(win); assert.equal(views(win).length, 1);
});
test('consent UI is singleton, accessible, localized, closable without grant, and can reopen/revoke', t => {
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://sidekick.hananakick.cc/' }); t.after(() => dom.window.close());
  const doc = dom.window.document; const analytics = mountSiteAnalytics(doc, 'studio', config);
  assert.equal(mountSiteAnalytics(doc, 'studio', config), analytics); assert.equal(doc.querySelectorAll('.site-analytics').length, 1);
  const panel = doc.querySelector('#site-analytics-panel'); const [allow, deny, close] = panel.querySelectorAll('button'); const toggle = doc.querySelector('.site-analytics-toggle');
  assert.equal(panel.hidden, true); assert.equal(analytics.getConsent(), null); assert.equal(doc.scripts.length, 0); toggle.click(); assert.equal(panel.hidden, false); close.click(); assert.equal(panel.hidden, true); assert.equal(analytics.getConsent(), null); assert.equal(doc.scripts.length, 0);
  for (const locale of ['ko', 'en', 'ja', 'zh-CN']) { setSiteLocale(locale); assert.ok(toggle.textContent.length); assert.equal(panel.querySelector('a').href, 'https://policies.google.com/privacy'); }
  toggle.click(); assert.equal(toggle.getAttribute('aria-expanded'), 'true'); allow.click(); loaded(dom.window); assert.equal(analytics.getConsent(), 'granted');
  toggle.click(); deny.click(); assert.equal(analytics.getConsent(), 'denied'); assert.equal(panel.hidden, true);
});
