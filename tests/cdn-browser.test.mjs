/** Raw browser artifacts served by a different origin, like a version-pinned CDN. */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { buildReactPeers } from '../scripts/build-react-peers.mjs';
import { createPackageConsumer } from './package-fixture.mjs';

const bundleNames = ['sidekick.js', 'sidekick.iife.js', 'sidekick-react.js', 'sidekick-element.js', 'sidekick-fallback.js', 'sidekick.worker.js'];
const bundlePrefix = '/gh/hanana-kick/sidekick@cdn-fixture/dist/browser/';
const peerPrefix = '/npm/react-peers@fixture/';
const liveBundleBase = process.env.SIDEKICK_CDN_BASE;
const livePeerBase = process.env.SIDEKICK_CDN_PEERS;
const trailingSlash = value => value.replace(/\/+$/, '') + '/';
let browser, appServer, cdnServer, appOrigin, localCDNOrigin, bundleBase, peerBase, consumer, peerDirectory;
const cdnRequests = [], appRequests = [];
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const close = server => server ? new Promise(resolve => server.close(resolve)) : undefined;

before(async () => {
  // Exercise the files actually shipped to consumers, without a bundler/dev server.
  if (!liveBundleBase) consumer = createPackageConsumer();
  peerDirectory = mkdtempSync(join(tmpdir(), 'sidekick-cdn-peers-'));
  if (!livePeerBase) await buildReactPeers(peerDirectory);
  cdnServer = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const name = pathname.slice(bundlePrefix.length);
    const peer = pathname.slice(peerPrefix.length);
    const file = consumer && pathname.startsWith(bundlePrefix) && bundleNames.includes(name)
      ? join(consumer.packagePath, 'dist/browser', name)
      : pathname.startsWith(peerPrefix) && ['react.js', 'react-dom-client.js'].includes(peer)
        ? join(peerDirectory, peer) : undefined;
    let data;
    try { if (file) data = await readFile(file); } catch { /* An absent artifact must be a real 404. */ }
    const status = data ? 200 : 404;
    cdnRequests.push({ pathname, status, origin: request.headers.origin ?? null });
    response.writeHead(status, {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': data ? 'text/javascript; charset=utf-8' : 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    }).end(data ?? 'Not found');
  });
  await listen(cdnServer);
  localCDNOrigin = `http://127.0.0.1:${cdnServer.address().port}`;
  bundleBase = trailingSlash(liveBundleBase ?? localCDNOrigin + bundlePrefix);
  peerBase = trailingSlash(livePeerBase ?? localCDNOrigin + peerPrefix);
  const allowedOrigins = [...new Set([new URL(bundleBase).origin, new URL(peerBase).origin])].join(' ');
  appServer = createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    appRequests.push(url.pathname);
    if (url.pathname === '/favicon.ico') { response.writeHead(204).end(); return; }
    if (url.pathname === '/nested/customer/headers.html') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': `default-src 'none'; connect-src ${allowedOrigins}` }).end('<!doctype html><title>CDN HTTP contract</title>'); return;
    }
    if (url.pathname !== '/nested/customer/consumer.html') { response.writeHead(404).end('Not found'); return; }
    const entry = url.searchParams.get('entry');
    if (!['classic', 'esm', 'react'].includes(entry)) { response.writeHead(400).end('Unknown entry'); return; }
    const blockBlob = url.searchParams.get('blockBlob') === '1';
    // Even the successful path runs with CSP, without unsafe-eval. A consumer
    // must explicitly allow blob: workers to use the cross-origin bootstrap.
    const csp = `default-src 'none'; script-src 'self' ${allowedOrigins} 'unsafe-inline'; style-src 'unsafe-inline'; connect-src ${allowedOrigins}; worker-src 'self' ${allowedOrigins}${blockBlob ? '' : ' blob:'}`;
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': csp }).end(fixtureHTML(entry));
  });
  await listen(appServer);
  appOrigin = `http://127.0.0.1:${appServer.address().port}`;
  assert.notEqual(appOrigin, new URL(bundleBase).origin);
  const executablePath = process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  browser = await chromium.launch({ executablePath, headless: process.env.SIDEKICK_HEADED !== '1', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
});
after(async () => {
  await browser?.close();
  await Promise.all([close(appServer), close(cdnServer)]);
  consumer?.cleanup();
  if (peerDirectory) rmSync(peerDirectory, { recursive: true, force: true });
});

function fixtureHTML(entry) {
  const base = bundleBase;
  const host = '<sidekick-avatar id="avatar" shape="heart" body-color="#80b6a3" activity="still" tracking-mode="off"></sidekick-avatar>';
  const script = entry === 'classic'
    ? `<script src="${base}sidekick.iife.js"></script><script>window.cdnFixture = { imported: true, api: Sidekick };</script>`
    : entry === 'esm'
      ? `<script type="module">import * as api from '${base}sidekick.js'; window.cdnFixture = { imported: true, api };</script>`
      : `<script type="importmap">${JSON.stringify({ imports: { react: peerBase + 'react.js', 'react-dom/client': peerBase + 'react-dom-client.js' } })}</script>
<script type="module">
import { createElement, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { SidekickAvatar } from '${base}sidekick-react.js';
const ref = createRef();
window.cdnFixture = { imported: true, registeredBeforeMount: !!customElements.get('sidekick-avatar'), ref, readyEvents: 0 };
window.mountCdnReact = () => {
  const root = createRoot(document.getElementById('root'));
  window.cdnFixture.root = root;
  root.render(createElement(SidekickAvatar, {
    id: 'avatar', ref, shape: 'heart', bodyColor: '#80b6a3', activity: 'still', trackingMode: 'off',
    onReady: () => window.cdnFixture.readyEvents++,
  }));
};
</script>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Cross-origin Sidekick consumer</title><style>body{margin:0}sidekick-avatar{display:block;width:320px;height:280px}</style></head><body>${entry === 'react' ? '<div id="root"></div>' : host}${script}</body></html>`;
}

async function pageFor(t, entry, { blockBlob = false } = {}) {
  const page = await browser.newPage({ locale: 'ko-KR', viewport: { width: 900, height: 700 }, reducedMotion: 'no-preference' });
  const pageErrors = [], consoleErrors = [], failedRequests = [], remoteResponses = [];
  page.context().on('response', response => {
    if (response.url().startsWith(bundleBase) || response.url().startsWith(peerBase)) {
      remoteResponses.push({ url: response.url(), pathname: new URL(response.url()).pathname, status: response.status() });
    }
  });
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
  const firstCDN = cdnRequests.length, firstApp = appRequests.length;
  const requests = () => liveBundleBase
    ? remoteResponses
    : cdnRequests.slice(firstCDN).map(request => ({ ...request, url: localCDNOrigin + request.pathname }));
  t.after(async () => {
    await page.close();
    assert.deepEqual(pageErrors, [], 'No uncaught exceptions in the CDN consumer');
    assert.deepEqual(failedRequests, [], 'All requested entry, peer and lazy chunk files load successfully');
    if (!blockBlob) assert.deepEqual(consoleErrors, [], 'Healthy CDN loading has no console errors');
    assert.ok(requests().every(request => request.status === 200), 'No missing files on the CDN');
    assert.ok(appRequests.slice(firstApp).every(path => ['/nested/customer/consumer.html', '/favicon.ico'].includes(path)), 'Artifacts must resolve beside the CDN script, never beside the consumer HTML');
  });
  await page.addInitScript(() => {
    const audit = window.cdnAudit = { workers: [], transfers: 0, mainContexts: 0, terminated: 0, violations: [], errors: [], createdBlobURLs: [], revokedBlobURLs: [] };
    const NativeWorker = Worker;
    const createObjectURL = URL.createObjectURL, revokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = function (blob) { const url = createObjectURL.call(this, blob); audit.createdBlobURLs.push(url); return url; };
    URL.revokeObjectURL = function (url) { audit.revokedBlobURLs.push(String(url)); return revokeObjectURL.call(this, url); };
    const transfer = HTMLCanvasElement.prototype.transferControlToOffscreen;
    const getContext = HTMLCanvasElement.prototype.getContext;
    window.Worker = class extends NativeWorker {
      constructor(url, options) { super(url, options); audit.workers.push({ url: String(url), type: options?.type, name: options?.name }); }
      terminate() { audit.terminated++; return super.terminate(); }
    };
    HTMLCanvasElement.prototype.transferControlToOffscreen = function (...args) { audit.transfers++; return transfer.apply(this, args); };
    HTMLCanvasElement.prototype.getContext = function (type, ...args) { if (type === 'webgl2') audit.mainContexts++; return getContext.call(this, type, ...args); };
    document.addEventListener('securitypolicyviolation', event => audit.violations.push({ directive: event.effectiveDirective, blocked: event.blockedURI }));
    document.addEventListener('sidekick-error', event => audit.errors.push(event.detail));
  });
  await page.goto(`${appOrigin}/nested/customer/consumer.html?entry=${entry}${blockBlob ? '&blockBlob=1' : ''}`);
  await page.waitForFunction(() => window.cdnFixture?.imported, null, { timeout: 20000 });
  if (entry === 'react') {
    assert.equal(await page.evaluate(() => cdnFixture.registeredBeforeMount), false, 'Importing the React wrapper does not register the custom element');
    assert.equal(await page.evaluate(() => cdnAudit.workers.length), 0, 'Importing the React wrapper does not create a worker');
    assert.ok(!requests().some(request => /sidekick-(?:element|fallback)\.js$|sidekick\.worker\.js$/.test(request.url)), 'Native element, fallback renderer and worker remain lazy before mounting');
    await page.evaluate(() => mountCdnReact());
  }
  await page.waitForFunction(() => document.getElementById('avatar')?.ready, null, { timeout: 20000 });
  return { page, requests };
}

async function captureState(page) {
  return page.evaluate(async () => {
    const avatar = document.getElementById('avatar');
    const image = await avatar.capturePixelsAsync();
    let visible = 0, transparent = 0;
    for (let index = 3; index < image.pixels.length; index += 4) {
      if (image.pixels[index]) visible++;
      else transparent++;
    }
    return { backend: avatar.diagnostics.backend, size: [image.width, image.height], visible, transparent,
      shape: avatar.design.body.shape, color: avatar.design.body.color,
      audit: cdnAudit, reactRef: !cdnFixture.ref || cdnFixture.ref.current === avatar,
      readyEvents: cdnFixture.readyEvents ?? null,
    };
  });
}
function assertPixels(state) {
  assert.deepEqual(state.size, [320, 280]);
  assert.ok(state.visible > 1000, 'The actual backend renders visible avatar pixels');
  assert.ok(state.transparent > 1000, 'The actual backend preserves alpha outside the avatar');
  assert.equal(state.shape, 'heart');
  assert.equal(state.color, '#80b6a3');
  assert.equal(state.reactRef, true);
}

test('CDN artifacts and React peers expose JavaScript MIME and browser-readable CORS responses', async t => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.goto(`${appOrigin}/nested/customer/headers.html`);
  const urls = [...bundleNames.map(name => bundleBase + name), ...['react.js', 'react-dom-client.js'].map(name => peerBase + name)];
  const results = await page.evaluate(async urls => Promise.all(urls.map(async url => {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
    const source = await response.text();
    return { url, status: response.status, type: response.type, contentType: response.headers.get('content-type'), length: source.length, startsWithHTML: /^\s*<(?:!doctype|html)/i.test(source) };
  })), urls);
  for (const result of results) {
    assert.equal(result.status, 200, result.url);
    assert.equal(result.type, 'cors', `JavaScript must be readable cross-origin: ${result.url}`);
    assert.match(result.contentType ?? '', /^(?:text|application)\/(?:java|ecma)script\b/i, result.url);
    assert.ok(result.length > 1000, `Missing or empty artifact: ${result.url}`);
    assert.equal(result.startsWithHTML, false, `CDN must not return an HTML fallback: ${result.url}`);
  }
  if (liveBundleBase) t.diagnostic('Verified live CDN responses: ' + JSON.stringify(results));
});

for (const entry of ['classic', 'esm', 'react']) {
  test(`${entry}: cross-origin CDN entry renders through a real worker and resolves sibling assets`, async t => {
    const { page, requests } = await pageFor(t, entry);
    const state = await captureState(page);
    assertPixels(state);
    assert.equal(state.backend, 'worker', 'Cross-origin loading must not silently degrade to main-thread rendering');
    assert.equal(state.audit.transfers, 1);
    assert.equal(state.audit.mainContexts, 0);
    assert.equal(state.audit.workers.length, 1);
    assert.equal(state.audit.workers[0].type, 'module');
    assert.equal(state.audit.workers[0].name, 'sidekick-render');
    assert.ok(state.audit.workers[0].url.startsWith(`blob:${appOrigin}/`), 'The bootstrap is created in the consuming page origin');
    assert.deepEqual(state.audit.errors, []);
    assert.deepEqual(state.audit.violations, []);
    assert.ok(state.audit.revokedBlobURLs.includes(state.audit.workers[0].url), 'The bootstrap object URL is released after worker startup');
    assert.ok(page.workers().some(worker => worker.url() === state.audit.workers[0].url), 'A live dedicated worker owns the renderer');
    assert.ok(requests().some(request => request.url === bundleBase + 'sidekick.worker.js'), 'The bootstrap fetches the published worker from the CDN');
    if (entry === 'react') {
      assert.equal(state.readyEvents, 1);
      assert.ok(requests().some(request => request.url === bundleBase + 'sidekick-element.js'), 'Mounting React loads the sibling native-element chunk');
      assert.ok(!requests().some(request => request.url === bundleBase + 'sidekick-fallback.js'), 'Healthy worker startup leaves the main-thread engine unloaded');
    }
    // Terminating a bootstrap must not poison a later worker generation.
    await page.evaluate(async () => {
      const avatar = document.getElementById('avatar'), parent = avatar.parentElement;
      avatar.remove(); parent.append(avatar); await avatar.capturePixelsAsync();
    });
    const reconnected = await captureState(page);
    assertPixels(reconnected);
    assert.equal(reconnected.backend, 'worker');
    assert.equal(reconnected.audit.workers.length, 2);
    assert.equal(reconnected.audit.terminated, 1);
    assert.equal(reconnected.audit.transfers, 2);
    assert.equal(reconnected.audit.mainContexts, 0);
    assert.ok(reconnected.audit.createdBlobURLs.every(url => reconnected.audit.revokedBlobURLs.includes(url)), 'Both worker generations release their bootstrap object URLs');
  });

  test(`${entry}: CDN loading recovers when CSP disallows blob workers`, async t => {
    const { page, requests } = await pageFor(t, entry, { blockBlob: true });
    const state = await captureState(page);
    assertPixels(state);
    assert.equal(state.backend, 'main');
    assert.equal(state.audit.mainContexts, 1);
    assert.ok(state.audit.createdBlobURLs.every(url => state.audit.revokedBlobURLs.includes(url)), 'A rejected bootstrap releases its object URL');
    assert.ok(state.audit.violations.some(violation => violation.directive === 'worker-src' && violation.blocked === 'blob'), 'The browser actually enforces the blob-worker policy');
    assert.ok(!requests().some(request => request.url === bundleBase + 'sidekick.worker.js'), 'A blocked bootstrap does not bypass policy to load a CDN worker');
    if (entry === 'react') {
      assert.equal(state.readyEvents, 1);
      assert.ok(requests().some(request => request.url === bundleBase + 'sidekick-element.js'));
      assert.ok(requests().some(request => request.url === bundleBase + 'sidekick-fallback.js'), 'React loads its fallback chunk from the CDN only when needed');
    }
  });
}

for (const entry of ['classic', 'esm', 'react']) test(`CDN ${entry} exposes rendered natural travel and live phase state`, async t => {
  const { page } = await pageFor(t, entry);
  const result = await page.evaluate(async () => {
    const avatar = document.getElementById('avatar'), phases = [];
    avatar.addEventListener('sidekick-move-progress', event => phases.push(event.detail.phase));
    const before = await avatar.capturePixelsAsync();
    const result = await avatar.moveTo({ x: 180, y: 100 }, { duration: 450, travel: 'natural' });
    const after = await avatar.capturePixelsAsync();
    return { result, phases, state: avatar.movementState, travel: avatar.diagnostics.travel, sizes: [before.width, before.height, after.width, after.height], activity: avatar.activity };
  });
  assert.equal(result.result.finished, true); assert.deepEqual(result.result.position, { x: 180, y: 100 });
  assert.ok(result.phases.includes('takeoff')); assert.ok(result.phases.includes('flight')); assert.ok(result.phases.includes('landing'));
  assert.equal(result.state.phase, 'idle'); assert.equal(result.travel.strength, 0); assert.equal(result.activity, 'still');
  assert.deepEqual(result.sizes.slice(0,2), result.sizes.slice(2));
});

for (const entry of ['classic', 'esm', 'react']) test(`CDN ${entry} renders emotion reactions and releases to authored state`, async t => {
  const { page } = await pageFor(t, entry);
  const result = await page.evaluate(async () => {
    const avatar = document.getElementById('avatar');
    await avatar.setExpression('both', 'neutral', { duration: 0 });
    const initial = await avatar.capturePixelsAsync();
    avatar.setEmotion('happy', { intensity: .9 });
    await new Promise(r => setTimeout(r, 600));
    const happy = await avatar.capturePixelsAsync();
    const reaction = await avatar.reactTo('surprised', { duration: 250 });
    const baseline = avatar.emotion;
    avatar.setEmotion('neutral');
    await new Promise(r => setTimeout(r, 1500));
    const settled = await avatar.capturePixelsAsync();
    let changed = 0; for (let i = 0; i < initial.pixels.length; i++) if (initial.pixels[i] !== happy.pixels[i]) changed++;
    return { reaction, baseline, emotion: avatar.emotionState, design: avatar.design.eyes, backend: avatar.diagnostics.backend, running: avatar.diagnostics.running, changed, size: [settled.width, settled.height] };
  });
  assert.equal(result.reaction.finished, true); assert.equal(result.baseline, 'happy');
  assert.equal(result.emotion.emotion, 'neutral'); assert.equal(result.emotion.reacting, false);
  assert.equal(result.design.left.weights.smile, 0); assert.ok(result.changed > 20, 'emotion must change actual GPU output');
  assert.equal(result.backend, 'worker'); assert.equal(result.running, false);
});
