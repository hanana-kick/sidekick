import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { SITE_LOCALES, SITE_MESSAGES, getSiteLocale, setSiteLocale, resolveSiteLocale, localizedSiteHref, subscribeSiteLocale } from '../playground/site-i18n.js';
import { mountSiteHeader } from '../playground/shared-header.js';
test('language resolution uses explicit URL, saved choice, browser preference then Korean', () => {
  assert.equal(resolveSiteLocale(), 'ko');
  assert.equal(resolveSiteLocale({query:'ja',stored:'ko',languages:['en-US']}),'ja');
  assert.equal(resolveSiteLocale({query:'invalid',stored:'zh-CN',languages:['en-US']}),'zh-CN');
  assert.equal(resolveSiteLocale({languages:['de-DE','en-GB']}),'en');
  assert.equal(resolveSiteLocale({languages:['zh-TW']}),'zh-CN');
});
test('all header dictionaries cover exactly the same nonempty keys', () => {
  const keys = Object.keys(SITE_MESSAGES.ko).sort();
  for (const locale of SITE_LOCALES) { assert.deepEqual(Object.keys(SITE_MESSAGES[locale]).sort(),keys); for (const value of Object.values(SITE_MESSAGES[locale])) assert.ok(value.trim()); }
});
test('localized route preserves relative path, other parameters and section anchor', () => {
  assert.equal(localizedSiteHref('./guide.html?example=wait#waiting','ja'),'./guide.html?example=wait&lang=ja#waiting');
  assert.equal(localizedSiteHref('./?lang=en','ko'),'./?lang=ko');
});
test('shared header changes language without remounting logo or deleting page state', () => {
  const dom = new JSDOM('<header><div id="header"></div></header><input id="draft" value="preserved">');
  const host = dom.window.document.querySelector('#header');
  setSiteLocale('ko'); const unmount = mountSiteHeader(host,'guide');
  const avatar=host.querySelector('sidekick-avatar'); let calls=0; const unsubscribe=subscribeSiteLocale(()=>calls++);
  for (const locale of SITE_LOCALES) {
    setSiteLocale(locale);
    assert.equal(host.querySelector('sidekick-avatar'),avatar);
    assert.equal(host.querySelector('[aria-current]').textContent,SITE_MESSAGES[locale].guide);
    assert.match(host.querySelector('[aria-current]').href,/guide\.html\?lang=/);
    assert.equal(host.querySelector('select').value,locale);
    assert.equal(host.ownerDocument.querySelector('#draft').value,'preserved');
    assert.equal(host.ownerDocument.title,SITE_MESSAGES[locale].guideTitle);
  }
  assert.equal(calls,3); unsubscribe(); unmount(); setSiteLocale('ko'); assert.equal(getSiteLocale(),'ko'); assert.equal(host.children.length,0);
});
