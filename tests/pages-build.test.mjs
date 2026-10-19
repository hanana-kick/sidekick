import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { studioBaseURL } from '../playground/studio-assets.ts';
import { createAppServer } from '../scripts/serve.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const origin = 'https://pages.test';
const entries = ['', 'index.html', 'playground/', 'playground/index.html'];

async function buildSite(t, base) {
  const temporary = await mkdtemp(join(tmpdir(), 'sidekick-pages-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const output = join(temporary, 'site');
  const env = { ...process.env };
  // Exercise the actual default config, even when the calling shell has an override.
  delete env.SIDEKICK_BASE;
  if (base !== undefined) env.SIDEKICK_BASE = base;
  execFileSync(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', output, '--emptyOutDir', '--manifest'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  return output;
}

async function filesUnder(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(file));
    else files.push(file);
  }
  return files;
}

// Parse modules rather than relying on whitespace/minifier-sensitive import regexes.
// Static imports, dynamic chunks and import.meta.url assets share URL resolution.
function moduleReferences(source) {
  const references = [];
  const ast = ts.createSourceFile('asset.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const visit = node => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) references.push(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) references.push(node.arguments[0].text);
    if (ts.isNewExpression(node) && node.expression.getText(ast) === 'URL' && node.arguments?.length === 2 && ts.isStringLiteralLike(node.arguments[0]) && node.arguments[1].getText(ast) === 'import.meta.url') references.push(node.arguments[0].text);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return references;
}

async function checkMount(output, mount, requireRelative) {
  const checked = new Set();
  const localAsset = async (reference, owner) => {
    if (!reference || /^(?:data:|https?:|#|blob:)/.test(reference)) return;
    if (requireRelative) assert.ok(!reference.startsWith('/'), `Root-relative asset in a relocatable build: ${reference} in ${owner}`);
    const url = new URL(reference, owner);
    assert.equal(url.origin, origin, `Unexpected external asset: ${url}`);
    assert.ok(url.pathname.startsWith(mount), `Asset escapes mount ${mount}: ${url}`);
    const file = resolve(output, decodeURIComponent(url.pathname.slice(mount.length)));
    assert.ok(file.startsWith(output + sep), `Asset escapes the build: ${reference}`);
    assert.equal((await stat(file)).isFile(), true, `Missing built asset ${reference} in ${owner}`);
    checked.add(url.pathname);
    return url;
  };
  for (const entry of entries) {
    const htmlFile = entry.startsWith('playground') ? 'playground/index.html' : 'index.html';
    const html = await readFile(join(output, htmlFile), 'utf8');
    const documentURL = new URL(mount + entry, origin);
    assert.match(html, /<link\b[^>]*rel="icon"[^>]*type="image\/svg\+xml"[^>]*href="[^"]*favicon\.svg"/, 'Both HTML entry points must declare the real favicon');
    for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) await localAsset(match[1], documentURL);
    const moduleReference = html.match(/<script\b[^>]*type="module"[^>]*src="([^"]+)"/)[1];
    const moduleURL = new URL(moduleReference, documentURL);
    const base = studioBaseURL(requireRelative ? './' : mount, moduleURL.href);
    assert.equal(new URL(base, documentURL).href, new URL(mount, origin).href, `Home link must point to the artifact root from ${documentURL}`);
    const manifest = JSON.parse(await readFile(join(output, 'accessory-previews/manifest.json'), 'utf8'));
    assert.equal(manifest.items.length, 12);
    for (const item of manifest.items) {
      const preview = `${base}accessory-previews/${item.filename}`;
      // Computed helper URLs may be fully qualified; validate their actual path.
      const url = new URL(preview, documentURL);
      assert.equal(url.origin, origin);
      assert.equal(url.pathname, `${mount}accessory-previews/${item.filename}`);
      await localAsset(url.pathname.slice(mount.length), new URL(mount, origin));
    }
  }
  for (const file of await filesUnder(output)) {
    if (!/\.(?:css|js)$/.test(file)) continue;
    const source = await readFile(file, 'utf8');
    const owner = new URL(mount + relative(output, file).split(sep).join('/'), origin);
    if (file.endsWith('.css')) {
      for (const match of source.matchAll(/url\(\s*["']?([^)'"\s]+)["']?\s*\)/g)) await localAsset(match[1], owner);
    } else {
      for (const reference of moduleReferences(source)) await localAsset(reference, owner);
      // Include computed public-directory prefixes and literal local assets.
      for (const match of source.matchAll(/["'](\/(?!\/)[^"'\s]*(?:(?:accessory-previews|models|textures|fonts)\/|\.(?:png|svg|webp|avif|woff2?|css|js)))["']/g)) {
        if (requireRelative) assert.fail(`Root-relative runtime asset: ${match[1]}`);
        else assert.ok(match[1].startsWith(mount), `Runtime asset escapes explicit base: ${match[1]}`);
      }
    }
  }
  // Vite's manifest includes every static/dynamic chunk edge, even if future
  // code splitting changes the generated import syntax or introduces lazy CSS.
  const manifest = JSON.parse(await readFile(join(output, '.vite/manifest.json'), 'utf8'));
  for (const chunk of Object.values(manifest)) {
    await localAsset(chunk.file, new URL(mount, origin));
    for (const dependency of [...chunk.imports ?? [], ...chunk.dynamicImports ?? []]) {
      assert.ok(manifest[dependency], `Missing chunk manifest entry: ${dependency}`);
      await localAsset(manifest[dependency].file, new URL(mount, origin));
    }
    for (const asset of [...chunk.css ?? [], ...chunk.assets ?? []]) await localAsset(asset, new URL(mount, origin));
  }
  assert.ok([...checked].some(file => file.endsWith('.js')), 'No modules were checked');
  assert.ok([...checked].some(file => file.endsWith('.css')), 'No stylesheets were checked');
  assert.ok([...checked].some(file => file.endsWith('.woff2')), 'No local fonts were checked');
  assert.ok(checked.has(mount + 'favicon.svg'), 'No favicon was checked');
  assert.equal([...checked].filter(file => file.includes('/accessory-previews/')).length, 12);
}

test('one default build resolves every asset at both root and /sidekick/, including nested playground entries', async t => {
  const output = await buildSite(t);
  for (const mount of ['/', '/sidekick/']) await checkMount(output, mount, true);
  for (const file of await filesUnder(join(root, 'public'))) {
    assert.deepEqual(await readFile(join(output, relative(join(root, 'public'), file))), await readFile(file), 'Public assets must be copied unchanged');
  }
  // Verify the real local server does not hide a missing favicon or serve images
  // as octet-stream under nosniff. This uses the same temporary production build.
  const server = createAppServer(output);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  for (const [path, mime] of [['/favicon.svg', 'image/svg+xml'], ['/accessory-previews/beret.png', 'image/png']]) {
    const response = await fetch(url + path);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type').split(';')[0], mime);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(join(output, path)));
  }
  assert.equal((await fetch(url + '/favicon.ico')).status, 404, 'An undeclared missing favicon must not be disguised as a successful response');
});

test('explicit fixed SIDEKICK_BASE remains supported', async t => {
  const output = await buildSite(t, '/fixed/');
  for (const entry of ['index.html', 'playground/index.html']) {
    assert.match(await readFile(join(output, entry), 'utf8'), /(?:src|href)="\/fixed\/assets\//);
  }
  await checkMount(output, '/fixed/', false);
  assert.equal(studioBaseURL('/', origin + '/assets/main.js'), '/');
  assert.equal(studioBaseURL('https://cdn.test/site/', origin + '/assets/main.js'), 'https://cdn.test/site/');
  assert.equal(studioBaseURL('', origin + '/sidekick/assets/main.js'), origin + '/sidekick/');
});

test('module graph checking includes static imports, dynamic chunks and module-relative assets', () => {
  assert.deepEqual(moduleReferences('import "./boot.js"; export { x } from "./shared.js"; import("./lazy.js"); new URL("./font.woff2", import.meta.url);'), ['./boot.js', './shared.js', './lazy.js', './font.woff2']);
});

test('Guide startup keeps its controller and never evaluates the Studio entry', async t => {
  const output = await buildSite(t);
  const html = await readFile(join(output, 'guide.html'), 'utf8');
  const queue = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => resolve(output, match[1]));
  const visited = new Set();
  let controllerFound = false;
  while (queue.length) {
    const path = queue.pop();
    if (visited.has(path)) continue;
    visited.add(path);
    const source = await readFile(path, 'utf8');
    assert.ok(!source.includes('Studio root is missing'), 'Guide must not import the Studio bootstrap via a shared runtime helper');
    controllerFound ||= source.includes('scenario-toc') && source.includes('context-playground-link');
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    for (const node of ast.statements) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier) && node.moduleSpecifier.text.startsWith('.')) queue.push(resolve(path, '..', node.moduleSpecifier.text));
    }
  }
  assert.ok(controllerFound, 'Shared Guide initialization must survive tree shaking');
});
