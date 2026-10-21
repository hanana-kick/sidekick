import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountSiteHeader } from '../playground/shared-header.js';
import { SITE_LOCALES, SITE_MESSAGES, setSiteLocale } from '../playground/site-i18n.js';

for (const page of ['studio', 'guide', 'api']) test(`${page}: shared GitHub mark stays accessible through locale changes and remounts`, () => {
  const dom = new JSDOM('<header class="app-header"><div id="host"></div></header>', { url: 'https://sidekick.test/' });
  const host = dom.window.document.querySelector('#host');
  for (let mount = 0; mount < 2; mount++) {
    const cleanup = mountSiteHeader(host, page);
    const link = host.querySelector('.site-github');
    assert.equal(host.querySelectorAll('.site-github').length, 1);
    assert.equal(link.href, 'https://github.com/hanana-kick/sidekick');
    assert.equal(link.target, '_blank');
    assert.equal(link.rel, 'noopener noreferrer');
    assert.equal(link.querySelector('svg').getAttribute('aria-hidden'), 'true');
    assert.equal(link.querySelector('svg').getAttribute('focusable'), 'false');
    assert.equal(link.querySelector('svg').getAttribute('viewBox'), '0 0 24 24');
    assert.equal(host.querySelectorAll('.product-nav a').length, 3);
    for (const locale of SITE_LOCALES) {
      setSiteLocale(locale);
      assert.equal(host.querySelector('.site-github'), link);
      assert.equal(link.getAttribute('aria-label'), SITE_MESSAGES[locale].github);
      assert.equal(link.title, SITE_MESSAGES[locale].github);
      assert.equal(link.href, 'https://github.com/hanana-kick/sidekick');
      assert.equal(host.querySelector('sidekick-avatar').getAttribute('body-color'), '#FFCC37');
      assert.equal(host.querySelector('#site-framework option').textContent, 'Custom Element');
    }
    cleanup();
    assert.equal(host.children.length, 0);
  }
  dom.window.close(); setSiteLocale('ko');
});

test('compact API label growth is English-only so Japanese Studio does not wrap', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('../playground/shared-header.css', import.meta.url), 'utf8');
  assert.match(css, /:root:lang\(en\) \.app-header \.product-nav #api-playground-link \{ flex-grow: 1\.5; \}/);
});
