import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPublishedDemoURL } from './helpers/published-demo-url.mjs';
const canonical = 'https://sidekick.hananakick.cc/';
const expected = { site: 'company', lang: 'ko' };
const check = value => assertPublishedDemoURL(value, canonical, expected);

test('published demo accepts runtime generations independent of parameter order', () => {
  for (const query of ['sourceGeneration=1&site=company&lang=ko', 'lang=ko&sourceGeneration=42&site=company']) {
    check(`${canonical}api-demo.html?${query}`);
  }
});
test('published demo rejects destination changes and malformed or duplicate parameters', () => {
  const valid = `${canonical}api-demo.html?site=company&lang=ko&sourceGeneration=1`;
  for (const value of [
    valid.replace('https:', 'http:'), valid.replace('sidekick.hananakick.cc', 'example.com'),
    valid.replace('/api-demo.html', '/sidekick/api-demo.html'), valid.replace('/api-demo.html', '/other.html'),
    valid.replace('https://', 'https://user:pass@'), `${valid}#other`,
    valid.replace('company', 'shop'), valid.replace('lang=ko', 'lang=en'),
    `${valid}&site=company`, `${valid}&sourceGeneration=2`, `${valid}&redirect=evil`,
    ...['', '0', '-1', '1.5', '01', '1e2', '9007199254740992'].map(n => valid.replace('sourceGeneration=1', `sourceGeneration=${n}`)),
    valid.replace('&sourceGeneration=1', ''),
  ]) assert.throws(() => check(value), undefined, value);
});
