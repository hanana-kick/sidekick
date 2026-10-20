/** Test-only, serializable into Window or a dedicated worker before rendering.
 * Deny context creation, not renderer selection or diagnostics: production code
 * must still discover the missing capability and build its real Canvas backend.
 */
export function installNoWebGL() {
  const audit = globalThis.__sidekickNoWebGL = { denied: 0 };
  for (const name of ['HTMLCanvasElement', 'OffscreenCanvas']) {
    const prototype = globalThis[name]?.prototype;
    if (!prototype?.getContext) continue;
    const original = prototype.getContext;
    prototype.getContext = function (kind, ...args) {
      if (kind === 'webgl2' || kind === 'webgl' || kind === 'experimental-webgl') { audit.denied++; return null; }
      return original.call(this, kind, ...args);
    };
  }
}

// Native source/library modules, relocatable prebuilt packages, and Vite's
// hashed production worker. Query strings (cache keys) must not evade denial.
export function isSidekickWorkerURL(value) {
  const path = new URL(value).pathname;
  return /\/runtime\/render-worker\.(?:js|ts)$/.test(path)
    || /\/sidekick\.worker\.js$/.test(path)
    || /\/assets\/render-worker-[^/]+\.js$/.test(path);
}

/** Install before navigation. Context routing also covers iframe workers.
 * Does not select a backend: the real renderer must attempt unavailable WebGL.
 * Each browser.newPage owns a context; keep this setup on every page, including
 * copied-example replay pages. Assertions belong after bot.ready.
 */
export async function forceCanvasForPage(page) {
  let workerResponses = 0;
  await page.addInitScript(installNoWebGL);
  await page.context().route(isSidekickWorkerURL, async route => {
    const response = await route.fetch();
    workerResponses++;
    await route.fulfill({ response, body: `(${installNoWebGL.toString()})();\n${await response.text()}` });
  });
  const read = async () => ({
    workerResponses,
    mainDenied: (await Promise.all(page.frames().map(frame => frame.evaluate(() => globalThis.__sidekickNoWebGL?.denied ?? 0)))).reduce((a, b) => a + b, 0),
    workers: await Promise.all(page.workers().filter(worker => isSidekickWorkerURL(worker.url())).map(async worker => ({
      url: worker.url(), denied: await worker.evaluate(() => globalThis.__sidekickNoWebGL?.denied ?? 0),
    }))),
  });
  return {
    read,
    async assertDenied({ worker = false, minWorkerResponses = 1 } = {}) {
      const audit = await read();
      if (worker) {
        if (audit.workerResponses < minWorkerResponses) throw new Error(`Expected at least ${minWorkerResponses} instrumented worker responses: ${JSON.stringify(audit)}`);
        if (!audit.workers.some(entry => entry.denied > 0)) throw new Error(`No active Sidekick worker actually attempted denied WebGL: ${JSON.stringify(audit)}`);
      } else if (audit.mainDenied <= 0) throw new Error(`No Window/iframe renderer actually attempted denied WebGL: ${JSON.stringify(audit)}`);
      return audit;
    },
  };
}
