import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { createPackageConsumer } from './package-fixture.mjs';
import { buildReactPeers } from '../scripts/build-react-peers.mjs';

const filenames = ['sidekick.js', 'sidekick.iife.js', 'sidekick-react.js', 'sidekick-element.js', 'sidekick-fallback.js', 'sidekick.worker.js'];

test('freshness checking reproduces all six bundles with published tree-shaking metadata', t => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const directory = mkdtempSync(join(tmpdir(), 'sidekick-bundle-freshness-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const path of ['package.json', 'tsconfig.json', 'tsconfig.library.json', 'src', 'third_party/material-shapes', 'scripts/build-library.mjs', 'scripts/build-browser.mjs']) {
    cpSync(join(root, path), join(directory, path), { recursive: true });
  }
  symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'), 'junction');
  const build = (...args) => execFileSync(process.execPath, ['scripts/build-library.mjs', ...args], {
    cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  build();
  const browser = join(directory, 'dist/browser');
  assert.deepEqual(readdirSync(browser).sort(), [...filenames].sort());
  const original = filenames.map(file => readFileSync(join(browser, file)));
  assert.match(build('--check'), /Library and browser artifacts match source/);
  for (const [index, file] of filenames.entries()) {
    assert.ok(readFileSync(join(browser, file)).equals(original[index]), `${file} changed during the read-only check`);
  }
});

function imports(code) {
  const dependencies = [];
  const source = ts.createSourceFile('bundle.js', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const visit = node => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) dependencies.push(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      assert.equal(node.arguments.length, 1);
      assert.ok(ts.isStringLiteralLike(node.arguments[0]), 'Runtime imports must use a stable filename');
      dependencies.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return dependencies.sort();
}

test('packed ESM and classic releases are standalone and expose the complete automatic-registration API', t => {
  const consumer = createPackageConsumer(); t.after(consumer.cleanup);
  const directory = join(consumer.packagePath, 'dist/browser');
  assert.deepEqual(readdirSync(directory).sort(), [...filenames].sort());
  for (const file of filenames) {
    const code = readFileSync(join(directory, file), 'utf8');
    assert.match(code, /Apache License/);
    assert.match(code, /Material Shapes/);
    const expected = { 'sidekick-react.js': ['./sidekick-element.js', 'react'], 'sidekick-element.js': ['./sidekick-fallback.js'], 'sidekick-fallback.js': ['./sidekick-element.js'] };
    assert.deepEqual(imports(code), expected[file] ?? [], file);
  }
  assert.equal(consumer.manifest.exports['./browser/sidekick-element.js'], undefined, 'lazy chunk is private, with no mismatched public declarations');
  const output = consumer.run(['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import { runInNewContext } from 'node:vm';
    import * as library from '@hanana-kick/sidekick/register';
    const definitions = new Map();
    globalThis.HTMLElement = class HTMLElement {};
    globalThis.customElements = { get: name => definitions.get(name), define: (name, constructor) => definitions.set(name, constructor) };
    const esm = await import('@hanana-kick/sidekick/browser/sidekick.js');
    assert.equal(definitions.get('sidekick-avatar'), esm.SidekickAvatar);
    assert.deepEqual(Object.keys(esm).sort(), Object.keys(library).sort());
    const classicDefinitions = new Map();
    const context = { HTMLElement, TextEncoder, console, customElements: { get: name => classicDefinitions.get(name), define: (name, constructor) => classicDefinitions.set(name, constructor) } };
    runInNewContext('globalThis.structuredClone = value => JSON.parse(JSON.stringify(value));', context);
    runInNewContext(readFileSync(${JSON.stringify(join(directory, 'sidekick.iife.js'))}, 'utf8'), context, { timeout: 5000 });
    assert.equal(classicDefinitions.get('sidekick-avatar'), context.Sidekick.SidekickAvatar);
    assert.deepEqual(Object.keys(context.Sidekick).sort(), Object.keys(library).sort());
    const scene = esm.createScene({ design: esm.createDesign({ body: { shape: 'heart' } }) });
    assert.equal(esm.parseScene(esm.serializeScene(scene)).design.body.shape, 'heart');
    assert.equal(esm.createDesign().version, 7);
    assert.equal(typeof esm.cropPixels, 'function');
    assert.equal(typeof esm.resolveSidekickAttributes, 'function');
    const classicSceneVersion = runInNewContext('Sidekick.parseScene(Sidekick.serializeScene(Sidekick.createScene())).sceneVersion', context);
    assert.equal(classicSceneVersion, 2);
    esm.defineSidekick(); context.Sidekick.defineSidekick();
    console.log('Standalone API parity passed: ' + Object.keys(esm).length + ' exports');
  `]);
  assert.match(output, /Standalone API parity passed/);
});

test('optional release React peers are deterministic, production-only and run raw prebuilt wrapper through an import map', async t => {
  const consumer = createPackageConsumer(); t.after(consumer.cleanup);
  const directory = mkdtempSync(join(tmpdir(), 'sidekick-release-peers-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const vendor = join(directory, 'vendor');
  const result = await buildReactPeers(vendor);
  await buildReactPeers(join(directory, 'repeat'));
  assert.equal(result.versions.react, '19.3.1');
  assert.equal(result.versions['react-dom'], '19.3.1');
  for (const file of result.files) assert.ok(readFileSync(join(vendor, file)).equals(readFileSync(join(directory, 'repeat', file))), `${file} is nondeterministic`);
  assert.deepEqual(imports(readFileSync(join(vendor, 'react.js'), 'utf8')), []);
  assert.deepEqual(imports(readFileSync(join(vendor, 'react-dom-client.js'), 'utf8')), ['react']);
  for (const name of ['react', 'react-dom', 'scheduler']) assert.match(readFileSync(join(vendor, name + '-LICENSE.txt'), 'utf8'), /MIT License/);
  assert.ok(!consumer.packed.files.some(file => /vendor\/|react-LICENSE|react-dom-LICENSE|scheduler-LICENSE/.test(file.path)), 'Optional demo peers must never enter core npm installs');
  const output = execFileSync(process.execPath, ['--experimental-vm-modules', '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import { resolve, dirname } from 'node:path';
    import { SourceTextModule, createContext } from 'node:vm';
    import { JSDOM } from ${JSON.stringify(new URL('../node_modules/jsdom/lib/api.js', import.meta.url).href)};
    const vendor = ${JSON.stringify(vendor)}, browser = ${JSON.stringify(join(consumer.packagePath, 'dist/browser'))};
    const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://release.test/' });
    const globals = { console, setTimeout, clearTimeout, queueMicrotask, performance, structuredClone };
    for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'CustomEvent', 'Event', 'customElements', 'MutationObserver']) globals[key] = dom.window[key];
    Object.assign(globals, { devicePixelRatio: 1, matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }), ResizeObserver: class { observe() {} disconnect() {} }, IntersectionObserver: class { observe() {} disconnect() {} }, requestAnimationFrame: () => 0, cancelAnimationFrame() {} });
    dom.window.HTMLCanvasElement.prototype.getContext = () => null;
    const context = createContext(globals), cache = new Map();
    const mappings = { react: vendor + '/react.js', 'react-dom/client': vendor + '/react-dom-client.js' };
    async function load(specifier, parent) {
      const file = mappings[specifier] || resolve(dirname(parent), specifier);
      if (!cache.has(file)) {
        const module = new SourceTextModule(readFileSync(file, 'utf8'), {
          context, identifier: file,
          importModuleDynamically: async (specifier, referencingModule) => { const child = await load(specifier, referencingModule.identifier); if (child.status !== 'evaluated') await child.evaluate(); return child; },
        });
        cache.set(file, module);
        await module.link((specifier, referencingModule) => load(specifier, referencingModule.identifier));
      }
      return cache.get(file);
    }
    const react = await load('react', browser + '/entry.js'); await react.evaluate();
    const client = await load('react-dom/client', browser + '/entry.js'); await client.evaluate();
    const wrapper = await load('./sidekick-react.js', browser + '/entry.js'); await wrapper.evaluate();
    assert.equal(react.namespace.version, '19.3.1');
    assert.equal(react.namespace.act, undefined, 'release must use production React');
    assert.equal(globals.customElements.get('sidekick-avatar'), undefined, 'wrapper import must leave native class lazy');
    const errors = [], ref = react.namespace.createRef();
    const root = client.namespace.createRoot(globals.document.querySelector('#root'));
    root.render(react.namespace.createElement(wrapper.namespace.SidekickAvatar, { ref, shape: 'heart', bodyYaw: 12, onError: event => errors.push(event) }));
    for (let attempt = 0; attempt < 100 && !ref.current; attempt++) await new Promise(resolve => setTimeout(resolve, 20));
    const avatar = globals.document.querySelector('sidekick-avatar');
    assert.equal(typeof globals.customElements.get('sidekick-avatar'), 'function');
    assert.equal(ref.current, avatar);
    assert.equal(avatar.design.body.shape, 'heart');
    assert.equal(avatar.bodyOrientation.yaw, 12);
    assert.equal(errors.length, 1); assert.match(errors[0].detail.message, /WebGL/);
    root.unmount(); assert.equal(ref.current, null);
    dom.window.close(); console.log('Raw release import-map React passed');
  `], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.match(output, /Raw release import-map React passed/);
});
