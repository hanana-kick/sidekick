import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
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
