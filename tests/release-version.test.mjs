import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const manifest = JSON.parse(read('package.json'));
const version = manifest.version;

test('current install and copied CDN examples match the package version', () => {
  const files = ['README.md', 'README.en.md', 'README.ja.md', 'README.zh-CN.md',
    'playground/api-playground.js', 'playground/guide-framework-code.js',
    'playground/guide-lessons.js', 'playground/lifecycle-example.js',
    'playground/playground-actions.js', 'playground/state-reference-copy.js'];
  for (const file of files) {
    const text = read(file);
    const pinned = [...text.matchAll(/(?:sidekick(?:\.git)?[#@]v|sidekick-browser-|hanana-kick-sidekick-|pinned v|고정 버전 v|固定版本 v|固定バージョン v)(\d+\.\d+\.\d+)/g)];
    assert.ok(pinned.length, `${file}: expected a versioned install/CDN reference`);
    for (const match of pinned) assert.equal(match[1], version, file);
  }
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(lock.version, version);
  assert.equal(lock.packages[''].version, version);
  assert.ok(read('.github/workflows/cdn.yml').includes(`default: 'v${version}'`));
});

test('prebuilt browser distributions carry the release version and complete license', () => {
  for (const file of readdirSync(new URL('../dist/browser/', import.meta.url)).filter(file => file.endsWith('.js'))) {
    const text = read('dist/browser/' + file);
    assert.ok(text.includes(`/*! Sidekick ${version} |`), file);
    assert.ok(text.includes(read('LICENSE')), file);
  }
});

test('GitHub-only release remains private and has no automatic registry publishing', () => {
  assert.equal(manifest.private, true);
  const workflows = readdirSync(new URL('../.github/workflows/', import.meta.url));
  for (const file of workflows) assert.doesNotMatch(read('.github/workflows/' + file), /\bnpm\s+publish\b|\bpnpm\s+publish\b|\byarn\s+(?:npm\s+)?publish\b/);
  for (const script of Object.values(manifest.scripts)) assert.doesNotMatch(script, /\bnpm\s+publish\b/);
});
