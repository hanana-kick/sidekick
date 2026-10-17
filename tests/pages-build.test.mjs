import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

test('a GitHub Pages subpath build resolves HTML, stylesheet, module and public preview assets beneath /sidekick/', async t => {
  const temporary = await mkdtemp(join(tmpdir(), 'sidekick-pages-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const output = join(temporary, 'site'), base = '/sidekick/';
  execFileSync(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', output, '--emptyOutDir'], { cwd: root, env: { ...process.env, SIDEKICK_BASE: base }, stdio: ['ignore', 'pipe', 'pipe'] });
  let checked = 0;
  const localAsset = async (reference, owner) => {
    if (!reference || /^(?:data:|https?:|#|blob:)/.test(reference)) return;
    const pathname = reference.split(/[?#]/, 1)[0];
    let file;
    if (pathname.startsWith('/')) {
      assert.ok(pathname.startsWith(base), `Root-relative asset escapes the project base: ${reference} in ${owner}`);
      file = resolve(output, pathname.slice(base.length));
    } else file = resolve(dirname(owner), pathname);
    assert.ok(file.startsWith(output + sep), `Asset escapes the build: ${reference}`);
    assert.equal((await stat(file)).isFile(), true, `Missing built asset ${reference} in ${owner}`);
    checked++;
  };
  const walk = async directory => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) { await walk(file); continue; }
      if (!/\.(?:html|css|js)$/.test(entry.name)) continue;
      const source = await readFile(file, 'utf8');
      if (entry.name.endsWith('.html')) {
        for (const match of source.matchAll(/(?:src|href)=["']([^"']+)["']/g)) await localAsset(match[1], file);
      } else if (entry.name.endsWith('.css')) {
        for (const match of source.matchAll(/url\(\s*["']?([^)'"\s]+)["']?\s*\)/g)) await localAsset(match[1], file);
      } else {
        for (const match of source.matchAll(/["'](\/[^"'\s]*(?:accessory-previews|models|textures|fonts)\/)["']/g)) {
          assert.ok(match[1].startsWith(base), `Computed asset URL escapes the project base: ${match[1]}`);
          assert.equal((await stat(resolve(output, match[1].slice(base.length)))).isDirectory(), true);
        }
        for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?)["'](\.[^"']+\.js)["']/g)) await localAsset(match[1], file);
        for (const match of source.matchAll(/["'](\/(?!\/)[^"'\s]+\.(?:png|svg|webp|avif|woff2?|css|js))["']/g)) await localAsset(match[1], file);
      }
    }
  };
  await walk(output);
  assert.ok(checked > 5, `Expected actual built asset references, found ${checked}`);
  const rootHTML = await readFile(join(output, 'index.html'), 'utf8');
  const nestedHTML = await readFile(join(output, 'playground/index.html'), 'utf8');
  assert.match(rootHTML, /(?:src|href)="\/sidekick\/assets\//);
  assert.match(nestedHTML, /(?:src|href)="\/sidekick\/assets\//);
  // Public thumbnails are copied unchanged, including files loaded by computed URLs.
  const publicDirectory = join(root, 'public');
  let publicExists = true;
  try { await stat(publicDirectory); } catch (error) { if (error.code === 'ENOENT') publicExists = false; else throw error; }
  if (publicExists) {
    const checkPublic = async directory => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const file = join(directory, entry.name);
        if (entry.isDirectory()) await checkPublic(file);
        else assert.deepEqual(await readFile(join(output, file.slice(publicDirectory.length + 1))), await readFile(file));
      }
    };
    await checkPublic(publicDirectory);
  }
});
