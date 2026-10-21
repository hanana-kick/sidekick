import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { accessSync, constants } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createAppServer } from '../scripts/serve.mjs';
import { installDemoWorkerAudit } from './helpers/demo-worker-audit.mjs';

// Use a fresh owned browser with its sandbox enabled. No user profile or CDP attachment.
let browser, launcher, server, base;
before(async () => {
  server = createAppServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  launcher = await chromium.launchServer({
    executablePath: [process.env.CHROMIUM_PATH, '/opt/google/chrome/chrome', '/usr/bin/chromium'].find(path => {
      if (!path) return false;
      try { accessSync(path, constants.X_OK); return true; } catch { return false; }
    }),
    host: '127.0.0.1', headless: true, chromiumSandbox: true, ignoreDefaultArgs: true,
    args: ['--headless', '--remote-debugging-pipe', '--no-startup-window'],
  });
  browser = await chromium.connect(launcher.wsEndpoint());
});
after(async () => {
  await browser?.close();
  await launcher?.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

async function frameFor(page, site) {
  await page.waitForFunction(site => {
    const frame = document.querySelector('#site-preview-frame');
    return frame?.contentDocument?.querySelector('#bot[data-configured]')?.ready
      && (!site || new URL(frame.src).searchParams.get('site') === site);
  }, site);
  const frame = page.frames().find(frame => frame.url().includes('/api-demo.html'));
  assert.ok(frame, 'the actual demo document is loaded');
  return frame;
}
async function pageFor(t, options = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', ...options });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(installDemoWorkerAudit);
  t.after(async () => { await page.close(); assert.deepEqual(errors, [], 'no page or iframe runtime errors'); });
  await page.goto(`${base}/api-playground.html?lang=en`);
  const consent = page.locator('#site-analytics-panel');
  if (await consent.count() && await consent.isVisible()) {
    await consent.getByRole('button', { name: 'Do not allow', exact: true }).click();
    await consent.waitFor({ state: 'hidden' });
  }
  try { await frameFor(page, 'company'); }
  catch (error) {
    const state = await page.evaluate(() => ({
      title: document.title, status: document.querySelector('#status')?.textContent,
      preview: document.querySelector('#preview-status')?.textContent,
      invalid: document.querySelector('#invalid-guide-context')?.textContent,
      frame: document.querySelector('#site-preview-frame')?.src,
      bot: document.querySelector('#site-preview-frame')?.contentDocument?.querySelector('#bot')?.outerHTML,
    }));
    throw new Error(`${error.message}\n${JSON.stringify(state)}`, { cause: error });
  }
  return page;
}
async function openTools(page) {
  if (!await page.locator('#bot-tools').isVisible()) await page.locator('#bot-tools-launcher').click();
}
async function closeTools(page) {
  if (await page.locator('#bot-tools').isVisible()) await page.locator('#bot-tools-close').click();
}
async function fill(page, id, value) {
  await page.locator(`#${id}`).evaluate(element => {
    for (let parent = element.parentElement; parent; parent = parent.parentElement)
      if (parent.tagName === 'DETAILS') parent.open = true;
  });
  await page.locator(`#${id}`).fill(value);
}
async function switchSite(page, site) {
  await page.locator('#preview-site').selectOption(site);
  return frameFor(page, site);
}
async function snapshot(frame) {
  return frame.locator('#bot').evaluate(bot => ({
    position: bot.position, activity: bot.activity, tracking: bot.trackingMode,
    design: bot.design, orientation: bot.bodyOrientation, zoom: bot.zoom,
  }));
}

test('three demos contain their own bot and real target; the parent has controls and the original header brand only', { timeout: 90000 }, async t => {
  const page = await pageFor(t);
  for (const site of ['company', 'shop', 'community']) {
    const frame = await switchSite(page, site);
    assert.equal(await page.locator('sidekick-avatar:not(.brand-avatar)').count(), 0);
    assert.equal(await page.locator('#site-preview-frame').count(), 1);
    assert.equal(await frame.locator('sidekick-avatar').count(), 1);
    assert.deepEqual(await frame.locator('#bot').evaluate(bot => ({ size: bot.size, width: bot.offsetWidth, height: bot.offsetHeight })), { size: 115, width: 115, height: 115 });
    assert.equal(await frame.locator('h1').count(), 1);
    assert.ok((await frame.locator('h1').textContent()).trim());
    assert.equal(await frame.evaluate(() => {
      const bot = document.querySelector('#bot');
      return ['#preview-target', '#free-space', '#lifecycle-live'].every(selector =>
        document.querySelector(selector)?.ownerDocument === bot.ownerDocument)
        && bot.ownerDocument.defaultView === window;
    }), true, 'bot and all action targets belong to the child document');
    assert.equal(await frame.locator('vite-error-overlay').count(), 0);
    const initialPlacement = await frame.locator('#bot').evaluate(bot => ({ actual: bot.position, expected: {
      x: Math.max(0, innerWidth - bot.offsetWidth - 16), y: Math.max(0, innerHeight - bot.offsetHeight - 16),
    }}));
    assert.ok(Math.abs(initialPlacement.actual.x - initialPlacement.expected.x) < 1 && Math.abs(initialPlacement.actual.y - initialPlacement.expected.y) < 1, 'Page-owned corner placement leaves the hero headline clear');
    await frame.locator('#bot').evaluate(bot => { bot.size = 231; });
    assert.equal(await frame.locator('#bot').evaluate(bot => bot.offsetWidth), 231, 'explicit size remains authoritative');
    await frame.locator('#bot').evaluate(bot => { bot.size = 115; });
  }
});

test('each example is a complete long-form surface with local loaded imagery and distinct structure', { timeout: 90000 }, async t => {
  const page = await pageFor(t);
  for (const site of ['company', 'shop', 'community']) {
    const frame = await switchSite(page, site);
    const structure = await frame.evaluate(() => ({
      scroll: document.documentElement.scrollHeight,
      viewport: innerHeight,
      words: document.getElementById('demo-content').textContent.trim().split(/\s+/).length,
      h1: document.querySelector('h1')?.textContent,
      images: [...document.querySelectorAll('#demo-content img')].map(image => ({ src: image.src, alt: image.getAttribute('alt') })),
      controls: document.querySelectorAll('#demo-content button, #demo-content a, #demo-content input').length,
    }));
    assert.ok(structure.scroll > structure.viewport * 3, `${site} has at least three screens of substantive content`);
    assert.ok(structure.words > 250, `${site} has real editorial/catalog/community depth`);
    assert.ok(structure.controls > 15, `${site} has realistic navigable interactions`);
    assert.ok(structure.images.length >= 3, `${site} has authored visual content`);
    for (const image of structure.images) {
      assert.equal(new URL(image.src).origin, new URL(base).origin, `${site} images are locally served`);
      assert.notEqual(image.alt, null, `${site} image includes alt semantics`);
    }
    // Decode all authored images, including lazy images below the fold.
    const failedImages = await frame.evaluate(async () => {
      const images = [...document.querySelectorAll('#demo-content img')];
      return (await Promise.all(images.map(async image => {
        image.loading = 'eager';
        try { await image.decode(); return image.naturalWidth > 0 ? null : image.src; }
        catch { return image.src; }
      }))).filter(Boolean);
    });
    assert.deepEqual(failedImages, [], `${site} has no broken image assets`);
    assert.ok((await frame.locator('.demo-disclosure').textContent()).includes('Fictional demo'));
  }
});

test('fictional site actions update local mock content without network submissions', { timeout: 90000 }, async t => {
  const page = await pageFor(t), submissions = [];
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) submissions.push(request.url()); });
  let frame = await frameFor(page);
  await frame.locator('#contact-demo').click();
  assert.ok((await frame.locator('#contact-result').textContent()).trim());
  frame = await switchSite(page, 'shop');
  assert.equal(await frame.locator('#cart-items li').count(), 0);
  await frame.locator('[data-add="0"]').click();
  assert.equal(await frame.locator('#cart-items li').count(), 1);
  assert.ok((await frame.locator('#cart-total').textContent()).includes('12'));
  await frame.locator('#cart-items [data-remove]').click();
  assert.equal(await frame.locator('#cart-items li').count(), 0);
  frame = await switchSite(page, 'community');
  await frame.locator('[data-post="0"]').click();
  const firstTitle = await frame.locator('#post-title').textContent();
  await frame.locator('#th-detail [data-close]').click();
  await frame.locator('[data-post="1"]').click();
  assert.notEqual(await frame.locator('#post-title').textContent(), firstTitle);
  await frame.locator('#reply-draft').fill('A local preview only.');
  await frame.locator('#reply-preview-button').click();
  assert.match(await frame.locator('#reply-preview').textContent(), /A local preview only\./);
  await frame.locator('#th-detail [data-close]').click();
  await frame.locator('#th-compose-text').fill('A published local post.');
  await frame.locator('#th-publish').click();
  assert.equal(await frame.locator('#th-compose-text').inputValue(), '');
  assert.match(await frame.locator('.th-post-body').first().textContent(), /A published local post\./);
  await frame.locator('.th-my-profile').click();
  await frame.locator('[data-edit]').click();
  await frame.locator('#th-profile-form [name="name"]').fill('Local QA');
  await frame.locator('#th-profile-save').click();
  assert.equal(await frame.locator('.th-self-name').textContent(), 'Local QA');
  assert.deepEqual(submissions, []);
});

test('parent commands execute against the child and copied movement code keeps the exact inputs', { timeout: 90000 }, async t => {
  const page = await pageFor(t), frame = await frameFor(page);
  await openTools(page);
  await page.locator('#target-x').fill('220');
  await page.locator('#target-y').fill('145');
  await page.locator('#travel').selectOption('none');
  await fill(page, 'duration', '0');
  await page.locator('#execute').click();
  await frame.waitForFunction(() => Math.abs(document.querySelector('#bot').position.x - 220) < 1
    && Math.abs(document.querySelector('#bot').position.y - 145) < 1);
  assert.match(await page.locator('#invocation').textContent(), /x: 220, y: 145/);
  await page.locator('#action-kind').selectOption('activity');
  await page.locator('#activity-operation').selectOption('setActivity');
  await page.locator('#activity').selectOption('thinking');
  await page.locator('#execute').click();
  assert.equal((await snapshot(frame)).activity, 'thinking');
  await page.locator('#action-kind').selectOption('orientation');
  await page.locator('#body-yaw').fill('18');
  await page.locator('#zoom').fill('1.2');
  await page.locator('#execute').click();
  assert.equal((await snapshot(frame)).orientation.yaw, 18);
  assert.equal((await snapshot(frame)).zoom, 1.2);
  await page.locator('#site-framework').selectOption('react');
  assert.match(await page.locator('#invocation').textContent(), /SidekickAvatar/);
  await page.locator('#site-framework').selectOption('element');
  assert.match(await page.locator('#invocation').textContent(), /document.querySelector\('#bot'\)/);
});

test('element anchors follow iframe scrolling and blank taps use child viewport coordinates', { timeout: 90000 }, async t => {
  const page = await pageFor(t), frame = await frameFor(page);
  await openTools(page);
  await page.locator('#move-method').selectOption('moveToElement');
  await page.locator('#target-selector').fill('#preview-target');
  await page.locator('#target-x').fill('0');
  await page.locator('#target-y').fill('0');
  await page.locator('#align-x').selectOption('center');
  await page.locator('#align-y').selectOption('center');
  await page.locator('#element-anchor').check();
  await page.locator('#travel').selectOption('none');
  await fill(page, 'duration', '0');
  await page.locator('#execute').click();
  await closeTools(page);
  const relation = () => frame.evaluate(() => {
    const bot = document.querySelector('#bot'), target = document.querySelector('#preview-target').getBoundingClientRect();
    return { x: bot.position.x - target.x, y: bot.position.y - target.y, scroll: scrollY };
  });
  const before = await relation();
  const parentScrollBefore = await page.evaluate(() => scrollY);
  await frame.evaluate(() => scrollBy(0, 100));
  await frame.waitForFunction(() => scrollY > 0);
  await page.waitForTimeout(100);
  const after = await relation();
  assert.ok(Math.abs(after.x - before.x) < 2 && Math.abs(after.y - before.y) < 2, 'anchored relative position survives inner scrolling');
  assert.equal(await page.evaluate(() => scrollY), parentScrollBefore, 'child scrolling must not change the inline controls page scroll');
  await openTools(page);
  await page.locator('#detach-anchor').click();
  await closeTools(page);
  await frame.evaluate(() => scrollTo(0, 0));
  await frame.waitForFunction(() => scrollY === 0);
  const point = { x: 12, y: 100 };
  assert.equal(await frame.evaluate(point => Boolean(document.elementFromPoint(point.x, point.y)?.closest('button,input,select,textarea,label,a,summary,pre,details')), point), false);
  await page.locator('#site-preview-frame').scrollIntoViewIfNeeded();
  const outer = await page.locator('#site-preview-frame').boundingBox();
  assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id, { x: outer.x + point.x, y: outer.y + point.y }), 'site-preview-frame', 'manual tap reaches the actual iframe after inline editor scrolling');
  await page.mouse.click(outer.x + point.x, outer.y + point.y);
  const expected = await frame.evaluate(point => {
    const bot = document.querySelector('#bot');
    return { x: Math.round(Math.max(0, Math.min(innerWidth - bot.offsetWidth, point.x - bot.offsetWidth / 2)) * 100) / 100,
      y: Math.round(Math.max(0, Math.min(innerHeight - bot.offsetHeight, point.y - bot.offsetHeight / 2)) * 100) / 100 };
  }, point);
  await frame.waitForFunction(expected => {
    const position = document.querySelector('#bot').position;
    return Math.abs(position.x - expected.x) < 1 && Math.abs(position.y - expected.y) < 1;
  }, expected);
});

test('repeated site replacement retires each demo worker while preserving the header worker', { timeout: 120000 }, async t => {
  const page = await pageFor(t);
  const initial = await snapshot(await frameFor(page));
  await page.waitForFunction(() => document.querySelector('.brand-avatar')?.ready);
  const initialAudit = await page.evaluate(() => window.demoWorkerAudit);
  assert.deepEqual(initialAudit.header, { created: 1, terminated: 0 }, 'one stable header worker');
  assert.equal(initialAudit.demos.length, 1, 'one initial demo document');
  assert.deepEqual({ created: initialAudit.demos[0].created, terminated: initialAudit.demos[0].terminated }, { created: 1, terminated: 0 });
  let replacements = 0;
  for (const site of ['shop', 'community', 'company', 'shop', 'community', 'company']) {
    await openTools(page);
    await page.locator('#travel').selectOption('none');
    await fill(page, 'duration', '5000');
    await page.locator('#target-x').fill('600');
    await page.locator('#target-y').fill('400');
    await page.locator('#execute').click();
    await page.evaluate(() => {
      window.previousDemoBot = document.querySelector('#site-preview-frame').contentDocument.querySelector('#bot');
    });
    await closeTools(page);
    const frame = await switchSite(page, site);
    assert.equal(await page.evaluate(() => window.previousDemoBot.isConnected), false, 'old bot is removed before new one runs');
    assert.deepEqual((await snapshot(frame)).design, initial.design, 'each new demo starts with Studio design');
    assert.equal((await snapshot(frame)).activity, initial.activity, 'in-flight previous actions do not leak into next scene');
    const audit = await page.evaluate(() => window.demoWorkerAudit);
    assert.deepEqual(audit.header, initialAudit.header, 'demo switching must neither recreate nor terminate the header worker');
    assert.equal(audit.demos.length, ++replacements + 1, 'one audited child document per demo mount');
    for (const retired of audit.demos.slice(0, -1)) {
      assert.equal(retired.created, 1, `one renderer in retired document: ${retired.url}`);
      assert.equal(retired.terminated, retired.created, `all workers retired before replacement: ${JSON.stringify(retired)}`);
    }
    const current = audit.demos.at(-1);
    assert.equal(new URL(current.url).searchParams.get('site'), site);
    assert.deepEqual({ created: current.created, terminated: current.terminated }, { created: 1, terminated: 0 }, 'exactly one live worker in the selected demo');
    assert.equal(await page.locator('#site-preview-frame').count(), 1);
  }
});

test('lifecycle example resolves targets and application work in the selected child document', { timeout: 90000 }, async t => {
  const page = await pageFor(t), frame = await switchSite(page, 'community');
  await openTools(page);
  await page.locator('#action-kind').selectOption('lifecycle');
  await page.locator('#execute').click();
  await closeTools(page);
  await frame.locator('#reference-home').waitFor();
  assert.equal(await frame.locator('#reference-home').evaluate(element => element.ownerDocument === document.querySelector('#bot').ownerDocument), true);
  await frame.locator('[data-lifecycle-action="wait"]').click();
  await frame.waitForFunction(() => document.querySelector('#bot').task?.status === 'pending');
  await frame.locator('[data-lifecycle-action="success"]').click();
  await frame.waitForFunction(() => document.querySelector('#bot').task?.status === 'success');
  await frame.locator('[data-lifecycle-action="follow"]').click();
  await frame.waitForFunction(() => document.querySelector('#bot').task?.status === 'pending');
  await switchSite(page, 'company');
  assert.equal(await (await frameFor(page)).locator('#bot').evaluate(bot => bot.task), null);
});

test('shop localized content fits 320px and 390px without truncating labels', { timeout: 120000 }, async t => {
  const page = await pageFor(t);
  for (const width of [320, 390]) {
    for (const locale of ['ko', 'ja', 'zh-CN', 'en']) {
      // Test the demo document itself at an exact CSS viewport width, independent
      // of the parent preview's inset. Real Chromium layout, not JSDOM geometry.
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`${base}/api-demo.html?site=shop&lang=${locale}`);
      await page.locator('.muse-product').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      const layout = await page.evaluate(() => ({
        viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        overflow: [...document.querySelectorAll('.muse *')].filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.width && rect.right > innerWidth + 1 && !el.closest('.muse-nav,.muse-categories');
        }).slice(0, 12).map(el => ({tag: el.tagName, class: el.className, text: el.textContent.slice(0, 90), right: el.getBoundingClientRect().right})),
      }));
      assert.ok(layout.scrollWidth <= width + 1, `${locale}/${width}: ${JSON.stringify(layout)}`);
      assert.equal(await page.locator('.muse-product').count(), 24);
    }
  }
});

test('all locales and narrow viewports retain usable controls and iframe bounds after resize', { timeout: 120000 }, async t => {
  const page = await pageFor(t, { viewport: { width: 360, height: 800 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  for (const locale of ['ko', 'ja', 'zh-CN', 'en']) {
    await page.locator('#site-language').selectOption(locale);
    await page.waitForFunction(locale => document.querySelector('#site-preview-frame')?.contentDocument?.documentElement?.lang === locale, locale);
    for (const site of ['company', 'shop', 'community']) {
      const frame = await switchSite(page, site);
      assert.equal(await frame.locator('html').getAttribute('lang'), locale);
      assert.ok(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${site}/${locale} child horizontal overflow`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'parent horizontal overflow');
      await openTools(page);
      const bounds = await page.locator('#bot-tools').boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 361);
      await closeTools(page);
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  const frame = await frameFor(page);
  assert.ok(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.setViewportSize({ width: 320, height: 480 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  assert.ok(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  if (process.env.SIDEKICK_SCREENSHOTS) {
    await mkdir(process.env.SIDEKICK_SCREENSHOTS, { recursive: true });
    await page.screenshot({ path: `${process.env.SIDEKICK_SCREENSHOTS}/api-demo-mobile.png` });
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const site of ['company', 'shop', 'community']) {
      await switchSite(page, site);
      await page.screenshot({ path: `${process.env.SIDEKICK_SCREENSHOTS}/api-demo-${site}.png` });
    }
  }
});


test('shared select gutters preserve native options, keyboard input and narrow header labels', { timeout: 90000 }, async t => {
  const page = await pageFor(t, { viewport: { width: 320, height: 640 } });
  for (const route of ['/api-playground.html', '/guide.html', '/']) {
    await page.goto(`${base}${route}?lang=en`);
    await page.locator('#site-framework').waitFor();
    await page.evaluate(() => document.fonts.ready);
    const measurements = await page.locator('.app-header select').evaluateAll(selects => selects.map(select => {
      const css = getComputedStyle(select), rect = select.getBoundingClientRect();
      const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d'); ctx.font = css.font;
      return { id: select.id, label: select.selectedOptions[0].textContent, width: rect.width, end: parseFloat(css.paddingInlineEnd), start: parseFloat(css.paddingInlineStart), text: ctx.measureText(select.selectedOptions[0].textContent).width, arrow: css.backgroundImage, x: rect.x, right: rect.right, options: select.options.length };
    }));
    for (const item of measurements) {
      assert.equal(item.end, 28); assert.equal(item.start, 8); assert.match(item.arrow, /svg/);
      assert.ok(item.text + item.start + item.end + 2 <= item.width + 1, `selected label fits beside inset arrow (${route}: ${JSON.stringify(item)})`);
      assert.ok(item.x >= 0 && item.right <= 320); assert.ok(item.options >= 2);
    }
  }
  await page.goto(`${base}/api-playground.html?lang=en`); await frameFor(page);
  await page.locator('#bot-tools-launcher').click();
  const action = page.locator('#action-kind'); await action.focus();
  await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Tab');
  assert.equal(await action.inputValue(), 'anchor');
  assert.equal(await action.evaluate(el => getComputedStyle(el).paddingInlineEnd), '36px');
  await action.evaluate(el => { el.dir = 'rtl'; });
  assert.match(await action.evaluate(el => getComputedStyle(el).backgroundPosition), /^12px/);
  await page.emulateMedia({ forcedColors: 'active' });
  assert.equal(await action.evaluate(el => getComputedStyle(el).appearance), 'auto');
  assert.equal(await action.evaluate(el => getComputedStyle(el).backgroundImage), 'none');
});


test('embedded shop sorting uses the same inset native chevron and preserves options', { timeout: 60000 }, async t => {
  const page = await pageFor(t, { viewport: { width: 390, height: 844 } });
  const frame = await switchSite(page, 'shop');
  const sort = frame.locator('#muse-sort');
  await sort.selectOption('2');
  const actual = await sort.evaluate(select => {
    const css = getComputedStyle(select), rect = select.getBoundingClientRect();
    return { appearance: css.appearance, start: css.paddingInlineStart, end: css.paddingInlineEnd, image: css.backgroundImage, text: select.selectedOptions[0].textContent, left: rect.left, right: rect.right, viewport: innerWidth };
  });
  assert.equal(actual.appearance, 'none'); assert.equal(actual.start, '12px'); assert.equal(actual.end, '36px');
  assert.match(actual.image, /svg/); assert.equal(actual.text, 'Price: high to low');
  assert.ok(actual.left >= 0 && actual.right <= actual.viewport, 'sort remains within narrow shop viewport');
  await sort.focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Tab');
  assert.equal(await sort.inputValue(), '1');
});


for (const deviceScaleFactor of [1, 2]) test(`demo visible ink fits64px at DPR${deviceScaleFactor} without shrinking explicit sizes`, { timeout: 60000 }, async t => {
  const page = await pageFor(t, { deviceScaleFactor });
  const frame = await frameFor(page);
  const bounds = await frame.locator('#bot').evaluate(async bot => {
    bot.trackingMode = 'off'; bot.bodyOrientation = { yaw: 0, pitch: 0, roll: 0 };
    bot.setActivity('still'); bot.paused = true; bot.seek(0);
    const image = await bot.capturePixelsAsync();
    let minX = image.width, minY = image.height, maxX = -1, maxY = -1;
    for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) if (image.pixels[(y * image.width + x) * 4 + 3]) {
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
    const rect = bot.getBoundingClientRect();
    return { width: (maxX - minX + 1) * rect.width / image.width, height: (maxY - minY + 1) * rect.height / image.height, size: bot.size };
  });
  assert.equal(bounds.size, 115);
  assert.ok(bounds.width >= 54 && bounds.width <= 58, JSON.stringify(bounds));
  assert.ok(bounds.height >= 63 && bounds.height <= 65.5, '64px target permits antialiased edge rounding: ' + JSON.stringify(bounds));
});

 test('on-site scrolling, real wishlist and local arrivals drive dialogue without floating controls', {timeout:120000}, async t=>{
 const page=await pageFor(t);assert.equal(await page.locator('.flight-toolbar,#cancel-preview').count(),0);assert.equal(await page.locator('#bot-tools-launcher').evaluate(el=>getComputedStyle(el).position==='fixed'),false);
 let frame=await switchSite(page,'company');await frame.locator('#nova-design h2').scrollIntoViewIfNeeded();await frame.locator('[data-sidekick-speech] .message').waitFor();assert.match(await frame.locator('[data-sidekick-speech] .message').textContent(),/materials|listening|Compare|finish/);
 frame=await switchSite(page,'shop');await frame.locator('[data-wish="13"]').click();await frame.locator('[data-product="1"] .muse-product-picture').scrollIntoViewIfNeeded();await frame.locator('[data-sidekick-speech] .message').waitFor();assert.match(await frame.locator('[data-sidekick-speech] .message').textContent(),/\$89, \$6 less than your saved style.*Same category; fit may differ/);assert.equal(await frame.locator('#muse-wish-count').textContent(),'1');
 frame=await switchSite(page,'community');await frame.locator('[data-post="4"]').scrollIntoViewIfNeeded();await frame.waitForFunction(()=>document.querySelectorAll('.th-post').length===21);await frame.locator('[data-sidekick-speech] .message').waitFor();assert.match(await frame.locator('[data-sidekick-speech] .message').textContent(),/Local demo/);
 await frame.locator('#th-compose-text').fill('A local post for the demo');await frame.locator('#th-publish').click();await frame.waitForFunction(()=>document.querySelector('#th-feed').textContent.includes('Local demo mention:'));await frame.waitForFunction(()=>document.querySelector('[data-sidekick-speech]')?.shadowRoot?.textContent.includes('mentioned'),null,{timeout:20000});
 await page.locator('#preview-refresh').click();frame=await frameFor(page,'community');assert.equal(await frame.locator('[data-sidekick-speech]').count(),0);assert.equal(await frame.locator('.th-post').count(),20);
 });


test('normal-motion company stories respond after scrolling away without stale narration cooldown', {timeout:60000}, async t=>{
 const page=await pageFor(t,{reducedMotion:'no-preference',viewport:{width:504,height:800}});
 const frame=await frameFor(page,'company');
 await frame.locator('.nova-mode-tabs').scrollIntoViewIfNeeded();
 await frame.waitForFunction(()=>document.querySelector('[data-sidekick-speech]')?.shadowRoot?.textContent.includes('listening modes'));
 await frame.locator('#nova-compare .nova-heading h2').scrollIntoViewIfNeeded();
 await frame.waitForFunction(()=>document.querySelector('[data-sidekick-speech]')?.shadowRoot?.textContent.includes('Compare the models'),null,{timeout:4000});
 assert.equal(await frame.locator('#bot').evaluate(bot=>bot.elementAnchor.target.matches('#nova-compare .nova-heading h2')),true);
 const close=frame.locator('[data-sidekick-speech]').getByRole('button',{name:'Dismiss tip'});
 await close.click();assert.equal(await frame.locator('[data-sidekick-speech]').count(),0);
});

test('narrow empty community keeps compose and navigation clear of its message', {timeout:60000}, async t=>{
 const page=await pageFor(t,{viewport:{width:320,height:700}});
 const frame=await switchSite(page,'community');
 await frame.locator('[data-nav="notifications"]').click();
 const layout=await frame.evaluate(()=>{
  const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
  return {message:rect(document.querySelector('.th-empty h2')),compose:rect(document.querySelector('.th-compose-link')),nav:[...document.querySelectorAll('.th-nav button')].map(rect),width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,height:innerHeight,bar:rect(document.querySelector(".th-left"))};
 });
 const intersects=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
 assert.equal(layout.scrollWidth,layout.width);
 for(const button of [...layout.nav,layout.compose]){assert.ok(button.left>=0&&button.right<=layout.width);assert.ok(button.top>=layout.bar.top&&button.bottom<=Math.min(layout.bar.bottom,layout.height));}
 assert.ok(layout.compose.width>=40&&layout.compose.height>=40);
 assert.equal(intersects(layout.message,layout.compose),false);
 for(const button of layout.nav){assert.ok(button.width>=40&&button.height>=40);assert.equal(intersects(button,layout.compose),false);}
 // The action lives in the bottom navigation, not in the empty-state reading area.
 assert.ok(Math.abs(layout.compose.top-layout.nav[0].top)<=4);
 assert.ok(Math.abs(layout.compose.bottom-layout.nav[0].bottom)<=4);
 await frame.locator('.th-compose-link').click();
 assert.equal(await frame.locator('#th-compose-text').evaluate(el=>el===document.activeElement),true);
 assert.equal(await frame.locator('#th-feed-title').textContent(),'Home');
});
