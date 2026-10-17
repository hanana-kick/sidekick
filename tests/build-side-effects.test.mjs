import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { execFileSync } from 'node:child_process';
import { createLibraryBrowserFixture } from './library-browser-fixture.mjs';
import { build } from 'vite';
import { createPackageConsumer } from './package-fixture.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const outputs = result => (Array.isArray(result) ? result : [result]).flatMap(result => result.output);

test('production Studio retains source automatic registration, native renderer and stylesheet', async () => {
  const output = outputs(await build({
    root, configFile: join(root, 'vite.config.ts'), logLevel: 'silent',
    build: { write: false, minify: false },
  }));
  const chunks = output.filter(asset => asset.type === 'chunk');
  for (const filename of ['src/auto.ts', 'src/element/avatar.ts', 'src/renderer/webgl.ts']) {
    const modules = chunks.flatMap(chunk => Object.entries(chunk.modules)).filter(([id]) => id.replaceAll('\\', '/').endsWith('/' + filename));
    assert.ok(modules.length, `${filename} was removed from the Studio build`);
    assert.ok(modules.some(([, module]) => module.renderedLength > 0), `${filename} has no executable code in the Studio build`);
  }
  const runtime = chunks.map(chunk => chunk.code).join('\n');
  assert.match(runtime, /customElements\.define\(/, 'Custom-element registration must reach the production bundle');
  assert.match(runtime, /sidekick-ready/, 'Native lifecycle events must reach the production bundle');
  assert.match(runtime, /webgl2/, 'WebGL renderer must reach the production bundle');
  const stylesheets = output.filter(asset => asset.type === 'asset' && asset.fileName.endsWith('.css'));
  assert.ok(stylesheets.some(asset => String(asset.source).includes('--background')), 'Studio stylesheet was tree-shaken');
  for (const filename of ['index.html', 'playground/index.html']) {
    const html = output.find(asset => asset.type === 'asset' && asset.fileName === filename);
    assert.ok(html, `Missing ${filename}`);
    assert.match(String(html.source), /rel="stylesheet"[^>]+\.css/, `${filename} must load its stylesheet`);
  }
});

test('packed root and auto imports register after tree shaking while explicit entries remain pure', async t => {
  const consumer = createPackageConsumer(); t.after(consumer.cleanup);
  const entry = join(consumer.directory, 'probe.mjs');
  for (const suffix of ['', '/auto', '/register', '/core']) {
    writeFileSync(entry, `import '@hanana-kick/sidekick${suffix}'; globalThis.probeComplete = true;\n`);
    const output = outputs(await build({
      root: consumer.directory, configFile: false, logLevel: 'silent',
      build: { write: false, minify: false, lib: { entry, name: 'SidekickSideEffectsProbe', formats: ['iife'] } },
    }));
    const code = output.filter(asset => asset.type === 'chunk').map(chunk => chunk.code).join('\n');
    const definitions = new Map();
    const context = {
      HTMLElement: class HTMLElement {},
      customElements: { get: name => definitions.get(name), define: (name, constructor) => definitions.set(name, constructor) },
      console,
    };
    runInNewContext(code, context, { timeout: 5000 });
    assert.equal(context.probeComplete, true);
    if (suffix === '' || suffix === '/auto') {
      assert.equal(typeof definitions.get('sidekick-avatar'), 'function', `${suffix || 'root'} side-effect import lost registration`);
    } else {
      assert.equal(definitions.size, 0, `${suffix} must not register anything`);
      assert.doesNotMatch(code, /sidekick-ready|customElements/, `${suffix} unused import must remain tree-shakeable`);
    }
  }
});


test('packed multi-entry Vite React and hydration bundles register without circular barrel evaluation', async t => {
  // Use the exact multi-entry build shipped to Chromium, not a source import or
  // a single-entry bundle that would hide entry/shared-chunk evaluation cycles.
  const fixture = await createLibraryBrowserFixture();
  t.after(fixture.cleanup);
  const jsdom = new URL('../node_modules/jsdom/lib/api.js', import.meta.url).href;
  for (const mode of ['react', 'hydration']) {
    const script = `
      import assert from 'node:assert/strict';
      import fs from 'node:fs';
      import { pathToFileURL } from 'node:url';
      import { JSDOM } from ${JSON.stringify(jsdom)};
      const mode = ${JSON.stringify(mode)}, output = ${JSON.stringify(fixture.output)};
      const html = fs.readFileSync(output + '/' + mode + '.html', 'utf8');
      const script = html.match(/type="module"[^>]+src="([^"]+)"/)[1];
      const dom = new JSDOM(html, { url: 'https://consumer.test/' + mode + '.html' });
      for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'CustomEvent', 'Event', 'customElements', 'MutationObserver']) Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
      Object.assign(globalThis, { devicePixelRatio: 1, matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }), ResizeObserver: class { observe() {} disconnect() {} }, IntersectionObserver: class { observe() {} disconnect() {} }, requestAnimationFrame: () => 0, cancelAnimationFrame() {} });
      // JSDOM is a DOM harness, not a browser/WebGL claim. Module imports run
      // through Node; inert preload hints must not cause a fake network fetch.
      dom.window.DOMTokenList.prototype.supports = () => true;
      dom.window.HTMLCanvasElement.prototype.getContext = () => null;
      const before = document.querySelector('sidekick-avatar');
      await import(pathToFileURL(output + script).href);
      let avatar;
      for (let attempt = 0; attempt < 100; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 20));
        avatar = document.querySelector('sidekick-avatar');
        const ref = mode === 'react' ? window.consumer?.element : window.hydration?.ref;
        if (typeof avatar?.setDesign === 'function' && ref === avatar) break;
      }
      const errors = mode === 'react' ? window.consumer.events.filter(event => event.name === 'Error') : window.hydration.errors;
      assert.equal(typeof customElements.get('sidekick-avatar'), 'function', JSON.stringify(errors));
      assert.equal(typeof avatar.setDesign, 'function');
      assert.match(avatar.shadowRoot.querySelector('[part="fallback"]').textContent, /WebGL2/);
      assert.equal(window.libraryAPI, undefined, 'the unrelated vanilla auto-entry must not run during React registration');
      if (mode === 'react') {
        assert.equal(avatar.design.body.shape, 'puffy');
        assert.equal(avatar.camera.yaw, 12);
        assert.equal(avatar.design.eyes.left.weights.smile, 0.25);
        assert.equal(errors.length, 1);
        assert.match(errors[0].detail.message, /WebGL2/);
        window.unmountConsumer();
        await new Promise(resolve => setTimeout(resolve, 20));
        assert.equal(window.consumer.element, null);
      } else {
        assert.equal(avatar, before, 'hydration must preserve the original SSR host');
        assert.equal(avatar.design.body.shape, 'heart');
        assert.equal(avatar.design.body.color, '#b7a5ce');
        assert.equal(errors.length, 1);
        assert.equal(errors[0].type, 'sidekick-error');
        assert.match(errors[0].detail.message, /WebGL2/, 'only the expected JSDOM WebGL fallback is allowed');
        avatar.setCamera({ yaw: 23 });
        window.rerenderHydration();
        await new Promise(resolve => setTimeout(resolve, 20));
        assert.equal(avatar.camera.yaw, 23);
      }
      dom.window.close();
      console.log(mode + ' bundled registration passed');
    `;
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: fixture.directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    assert.match(output, /bundled registration passed/);
  }
});
