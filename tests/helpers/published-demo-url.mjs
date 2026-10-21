import assert from 'node:assert/strict';

/** Exact published demo destination, with an order-independent runtime generation. */
export function assertPublishedDemoURL(actual, canonical, { site, lang }) {
  const url = new URL(actual), expected = new URL('api-demo.html', canonical);
  assert.equal(url.origin, expected.origin, 'Demo origin must remain canonical');
  assert.equal(url.pathname, expected.pathname, 'Demo path must remain repository-owned');
  assert.equal(url.username, ''); assert.equal(url.password, ''); assert.equal(url.hash, '');
  assert.deepEqual([...url.searchParams.keys()].sort(), ['lang', 'site', 'sourceGeneration'], 'Only one of each authored parameter is allowed');
  assert.equal(url.searchParams.get('site'), site);
  assert.equal(url.searchParams.get('lang'), lang);
  const generation = url.searchParams.get('sourceGeneration');
  assert.match(generation, /^[1-9]\d*$/, 'Generation must be a positive decimal integer');
  assert.ok(Number.isSafeInteger(Number(generation)), 'Generation must be a safe integer');
}
